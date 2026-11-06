"""Synthetic/mocked full25 tests. Never load models or execute alignment."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock,patch
import phase4_common as c
import phase4_full_common as contract
import phase4_full as full
import phase4_full_monitor as monitor
import phase4_full_worker as worker
from phase4_metrics import evaluate,ACCURACY_KEYS
from phase4_verify import verify_pilot

class FullTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.job=contract.make_full_job()
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=c.OUT);self.addCleanup(self.temp.cleanup);self.directory=Path(self.temp.name)
        c.atomic(self.directory/'job.json',self.job)
        self.output=patch.object(full,'RESULT',self.directory/'public.json');self.output.start();self.addCleanup(self.output.stop)
    def result(self,folder,row,empty=False):
        words=[] if empty else [{'word':w,'start':i*row['duration_seconds']/(len(row['reference_text'].split())+1),'end':(i+.8)*row['duration_seconds']/(len(row['reference_text'].split())+1)} for i,w in enumerate(row['reference_text'].split())]
        gate=c.alignment_gate({'available_ram_bytes':3*1024**3,'commit_headroom_bytes':4*1024**3})
        state={'stage':'completed','model_load_attempted':True,'pre_import_gate':gate,'pre_model_gate':gate}
        raw={'reference_text':row['reference_text'],'source_sha256':row['source_sha256'],'report':{'transcript':row['reference_text'],'runs':[{'words':words}]}}
        result={'status':'completed','recording_id':row['id'],'reference_text':row['reference_text'],'source_sha256':row['source_sha256'],'duration_seconds':row['duration_seconds'],
            'words':words,'alignment_status':'failed' if empty else 'completed','gate':gate,'worker_state':state,'unaligned_words':[],
            'alignment_seconds':.25,'alignment_real_time_factor':.25/row['duration_seconds'],'supervised_seconds':1,'supervised_real_time_factor':1/row['duration_seconds'],
            'model_load_seconds':.1,'runtime_import_seconds':.1,'peak_resident_bytes':1234,'peak_private_commit_bytes':4321,
            'metrics':evaluate(row['id'],row['reference_text'],words,self.job['annotations'][row['id']],row['duration_seconds'],allow_accuracy=False)}
        for name,value in [('evaluation',result),('result',raw),('state',state),('outcome',result)]:c.atomic(folder/(name+'.json'),value)
        return result
    def execution(self,fake):
        return patch.multiple(full,validate_full_job=Mock(),run_case=Mock(side_effect=fake))
    def test_contract_exact_frozen_order_environment_and_accuracy(self):
        self.assertTrue(contract.validate_full_job(self.job));self.assertEqual(len(self.job['cases']),25)
        self.assertEqual(sum(len(rows) for rows in self.job['annotations'].values()),457)
        self.assertEqual(self.job['resources']['cpu_threads'],2);self.assertFalse(self.job['reuse_pilot_results'])
        self.assertTrue(self.job['resources']['packages']['torch'].endswith('+cpu'))
        for name in ('torch','whisperx','numpy','faster_whisper'):self.assertNotIn(name,sys.modules)
    def test_changed_gates_dataset_mode_and_accuracy_rejected(self):
        changes=[('ram_gate_bytes',1),('commit_gate_bytes',1),('performance_only',False),('mode','pilot'),('cases',list(reversed(self.job['cases']))),('annotation_sha256','changed'),('script_sha256',{})]
        for key,value in changes:
            job=copy.deepcopy(self.job);job[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):contract.validate_full_job(job)
    def test_real_saved_pilot_integrity_and_no_duplicate_successes(self):
        proof=verify_pilot();self.assertEqual(proof,c.read(contract.PROOF));self.assertEqual(proof['metrics']['uniquely_aligned_words'],63)
        self.assertEqual([x['log_segments'] for x in proof['cases']],[1,1,2])
    def test_all25_once_then_completed_rerun_only_rebuilds_summary(self):
        called=[]
        def fake(folder,job,row,counters):called.append(row['id']);return self.result(folder,row)
        with self.execution(fake):
            result=full.execute(self.directory,self.job,Mock());(self.directory/'public.json').unlink()
            again=full.execute(self.directory,self.job,Mock())
        self.assertEqual(called,[r['id'] for r in self.job['cases']]);self.assertEqual(again['cases'],result['cases']);self.assertEqual(result['status'],'full_completed')
        self.assertTrue(all(result['metrics'][key] is None for key in ACCURACY_KEYS));self.assertEqual(result['all_planned_word_yield'],1)
    def test_interrupted_resume_skips_completed_prefix(self):
        called=[];stop=[True]
        def fake(folder,job,row,counters):
            called.append(row['id'])
            if len(called)==3 and stop[0]:raise KeyboardInterrupt()
            return self.result(folder,row)
        with self.execution(fake):
            with self.assertRaises(KeyboardInterrupt):full.execute(self.directory,self.job,Mock())
            saved=c.read(self.directory/'checkpoint.json')['completed'];stop[0]=False
            result=full.execute(self.directory,self.job,Mock())
        self.assertEqual(result['cases'][:2],[r['result'] for r in saved]);self.assertEqual(called.count(self.job['cases'][0]['id']),1)
        self.assertEqual(called.count(self.job['cases'][2]['id']),2);self.assertEqual(len(result['cases']),25);self.assertEqual(result['failed_attempts'],1)
    def test_result_committed_before_checkpoint_recovered_without_inference(self):
        called=[];stop=[True]
        def fake(folder,job,row,counters):
            called.append(row['id']);result=self.result(folder,row)
            if stop[0]:stop[0]=False;raise KeyboardInterrupt()
            return result
        with self.execution(fake):
            with self.assertRaises(KeyboardInterrupt):full.execute(self.directory,self.job,Mock())
            result=full.execute(self.directory,self.job,Mock())
        self.assertEqual(called,[r['id'] for r in self.job['cases']]);self.assertEqual(result['status'],'full_completed')
    def test_blocked_attempt_stops_and_resume_keeps_original_failure(self):
        stop=[True];called=[]
        def fake(folder,job,row,counters):
            called.append(row['id'])
            if stop[0]:
                stop[0]=False;c.atomic(folder/'gate.json',{'fixture':'retained'})
                return {'recording_id':row['id'],'status':'blocked_memory','error':'synthetic low RAM'}
            return self.result(folder,row)
        with self.execution(fake):
            result=full.execute(self.directory,self.job,Mock());self.assertEqual(len(called),1);self.assertEqual(result['completed_recordings'],0)
            old=full.attempt_folder(self.directory,c.read(self.directory/'checkpoint.json')['attempts'][0]);digest=c.sha(old/'gate.json')
            result=full.execute(self.directory,self.job,Mock())
        self.assertEqual(c.sha(old/'gate.json'),digest);self.assertEqual(result['failed_attempts'],1);self.assertEqual(len(set(a['attempt_path'] for a in result['attempts'])),26)
    def test_modified_checkpoint_evidence_and_order_rejected(self):
        def fake(folder,job,row,counters):return self.result(folder,row)
        with self.execution(fake):full.execute(self.directory,self.job,Mock())
        original=c.read(self.directory/'checkpoint.json')
        for mutation in ('duplicate','metric','path','digest'):
            state=copy.deepcopy(original)
            if mutation=='duplicate':state['completed'][1]=state['completed'][0]
            if mutation=='metric':state['completed'][0]['result']['metrics']['word_alignment_coverage']=0
            if mutation=='path':state['completed'][0]['attempt_path']='../escape'
            if mutation=='digest':state['job_sha256']='bad'
            c.atomic(self.directory/'checkpoint.json',state)
            with self.execution(fake),self.subTest(mutation=mutation),self.assertRaises(ValueError):full.execute(self.directory,self.job,Mock())
    def test_zero_alignment_is_recorded_as_failure_not_success(self):
        def fake(folder,job,row,counters):return self.result(folder,row,empty=True)
        with self.execution(fake):result=full.execute(self.directory,self.job,Mock())
        self.assertEqual(result['status'],'full_completed_with_alignment_failures');self.assertEqual(result['metrics']['word_alignment_coverage'],0)
        self.assertIsNone(result['metrics']['combined_boundary_mae_seconds'])

    def test_parent_both_gates_block_before_subprocess(self):
        for available,commit in [(c.RAM_GATE-1,c.COMMIT_GATE+1),(c.RAM_GATE+1,c.COMMIT_GATE-1)]:
            with tempfile.TemporaryDirectory(dir=c.OUT) as temp,patch.object(monitor.subprocess,'Popen') as spawn:
                counter=Mock();counter.system.return_value={'available_ram_bytes':available,'commit_headroom_bytes':commit}
                result=monitor.run_case(Path(temp),self.job,self.job['cases'][0],counter)
                self.assertEqual(result['status'],'blocked_memory');spawn.assert_not_called()
    def test_worker_gate_blocks_before_decode_or_model_imports(self):
        folder=self.directory/'attempts/fixture';folder.mkdir(parents=True);c.atomic(folder/'job.json',self.job);c.atomic(folder/'start.json',{})
        counter=Mock();counter.system.return_value={'available_ram_bytes':1,'commit_headroom_bytes':4*1024**3}
        with patch.object(worker,'FULL',self.directory),patch.object(worker,'validate_full_job'),patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counter),patch.object(worker,'decode') as decode,patch.object(worker,'align_existing') as align:
            self.assertEqual(worker.run(folder/'job.json',self.job['cases'][0]['id']),3)
        decode.assert_not_called();align.assert_not_called();self.assertFalse(c.read(folder/'state.json')['model_load_attempted'])
    def monitor_failure(self,pressure=False):
        counter=Mock();high={'available_ram_bytes':3*1024**3,'commit_headroom_bytes':4*1024**3};low={'available_ram_bytes':100,'commit_headroom_bytes':100}
        counter.system.side_effect=[high,low,low] if pressure else [high,high]
        counter.process.return_value={'peak_working_set_bytes':1234,'peak_private_commit_bytes':4321}
        child=Mock();child.poll.return_value=None;child.returncode=0
        owned=Mock();owned.name='synthetic-owned-job';paging=Mock();paging.sample.return_value={'available':False}
        c.atomic(self.directory/'state.json',{'stage':'aligning','pid':123})
        times=[0,1,7,8] if pressure else [0,301,302]
        with patch.object(monitor,'OwnedJob',return_value=owned),patch.object(monitor,'PagingCounters',return_value=paging),patch.object(monitor.subprocess,'Popen',return_value=child) as spawn,patch.object(monitor.time,'monotonic',side_effect=times),patch.object(monitor.time,'sleep'):
            result=monitor.run_case(self.directory,self.job,self.job['cases'][0],counter)
        self.assertFalse(spawn.call_args.kwargs['shell']);owned.close.assert_called_once();child.wait.assert_called_once();paging.close.assert_called_once()
        self.assertEqual(result['status'],'failed');self.assertEqual(result['peak_private_commit_bytes'],4321)
        return result
    def test_timeout_cleans_only_owned_child_and_retains_failure(self):self.assertIn('TimeoutError',self.monitor_failure()['error'])
    def test_pressure_guard_is_not_bypassed(self):self.assertIn('Critical RAM/commit floor',self.monitor_failure(True)['error'])
    def test_full_and_pilot_share_one_nonblocking_lock(self):
        self.assertIs(full.lock,__import__('phase4_pilot').lock)
        with full.lock():
            with self.assertRaises(OSError):
                with full.lock():pass
    def test_bad_times_or_failed_gate_cannot_be_checkpointed(self):
        row=self.job['cases'][0];result=self.result(self.directory,row)
        for key,value in [('alignment_seconds',float('nan')),('peak_private_commit_bytes',-1)]:
            bad=copy.deepcopy(result);bad[key]=value
            with self.assertRaises(ValueError):contract.validate_result(bad,row,self.job)
        bad=copy.deepcopy(result);bad['gate']['passed']=False
        with self.assertRaises(ValueError):contract.validate_result(bad,row,self.job)

if __name__=='__main__':unittest.main()
