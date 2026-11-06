"""Saved pilot verification and full base.en tests; never run speech inference."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock,patch
import asr_base_full as full
import asr_base_pilot as base
import asr_pilot as pilot
import asr_pilot_worker as worker
import verify_base_pilot as verify
from pilot_common import ROOT,TINY_BASELINE,read,atomic,validate_contract,resume_records
from asr_metrics import score
from windows_memory import GiB

class BaseFullTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.template=full.make_job()
    def job(self):return copy.deepcopy(self.template)
    def folder(self):
        full.RAW.mkdir(parents=True,exist_ok=True);return tempfile.TemporaryDirectory(dir=full.RAW)

    def test_saved_real_pilot_checks_pass(self):
        result=verify.verify_saved_pilot()
        self.assertEqual(result['status'],'PASS');self.assertEqual(result['completed_samples'],3)
        self.assertEqual(result['peak_resident_bytes'],329900032)
        self.assertEqual(result['peak_private_commit_bytes'],1584185344)
        self.assertTrue(result['settings_match_tiny_except_model']);self.assertTrue(result['all_gate_checks_passed'])

    def test_pilot_errors_or_failed_gate_refuse_full_prerequisite(self):
        original=verify.read
        for failure in ('error','gate','count'):
            report=copy.deepcopy(original(verify.PILOT));directory=ROOT/report['run_directory']
            if failure=='error':report['error']='unit-test failure'
            elif failure=='gate':report['gate']['observed']['available_ram_bytes']=1
            else:report['completed_samples']=2
            def altered(path):return report if Path(path) in (verify.PILOT,directory/'summary.json') else original(path)
            with self.subTest(failure=failure),patch.object(verify,'read',side_effect=altered),self.assertRaises(ValueError):verify.verify_saved_pilot()

    def test_sampled_memory_violation_is_rejected(self):
        original=Path.read_text;report=read(verify.PILOT);log=(ROOT/report['run_directory']/'memory_samples.jsonl').resolve()
        rows=[json.loads(line) for line in original(log).splitlines()];rows[0]['system']['available_ram_bytes']=1
        def changed(path,*args,**kwargs):
            return '\n'.join(json.dumps(r) for r in rows) if path.resolve()==log else original(path,*args,**kwargs)
        with patch.object(Path,'read_text',changed),self.assertRaisesRegex(ValueError,'sampled memory'):verify.verify_saved_pilot()

    def test_full_contract_exact_same_100_order_and_model_settings(self):
        job=self.job();tiny=read(TINY_BASELINE);validate_contract(job)
        self.assertEqual(len(job['cases']),100);self.assertEqual([r['id'] for r in job['cases']],tiny['selected_ids'])
        self.assertEqual(job['settings'],dict(tiny['settings'],model='base.en'));self.assertEqual(job['scoring_policy'],tiny['scoring_policy'])
        for kind in ('order','count','cpu','proof','scope'):
            bad=self.job()
            if kind=='order':bad['cases'].reverse()
            elif kind=='count':bad['cases'].pop()
            elif kind=='cpu':bad['settings']['cpu_threads']=4
            elif kind=='proof':bad['successful_pilot_sha256']='changed'
            else:bad['scope_id']='other'
            with self.subTest(kind=kind),self.assertRaises(ValueError):validate_contract(bad)

    def test_full_parent_base_gate_blocks_before_spawn(self):
        counter=Mock();counter.system.return_value=dict(available_ram_bytes=6*GiB//5,commit_headroom_bytes=4*GiB)
        reporter=Mock(return_value={'status':'blocked_memory'})
        with tempfile.TemporaryDirectory() as temp,patch.object(pilot,'atomic'),patch.object(pilot.subprocess,'Popen') as spawn:
            pilot.execute(Path(temp),self.job(),counter,reporter=reporter)
        spawn.assert_not_called();decision=reporter.call_args.args[3]
        self.assertEqual(decision['required_available_ram_bytes'],5*GiB//4);self.assertEqual(decision['required_commit_headroom_bytes'],5*GiB//2)

    def test_changed_cached_weights_or_source_rejects_resume(self):
        with self.folder() as temp:
            with patch.object(full,'cached_snapshot',return_value=(Path(temp),{'different':True})),self.assertRaisesRegex(ValueError,'weights changed'):
                full.validate_existing(Path(temp),self.job())
            bad=self.job();bad['evaluation_script_sha256']['evaluation/scripts/windows_memory.py']='changed'
            with self.assertRaisesRegex(ValueError,'code changed'):full.validate_existing(Path(temp),bad)

    def record(self,source):
        return dict(id=source['id'],source_sha256=source['source_sha256'],reference_text=source['reference_text'],predicted_text='unit fixture',
            metrics=score(source['reference_text'],'unit fixture'),inference_seconds=.25,duration_seconds=source['duration_seconds'],
            decode_seconds=.01,real_time_factor=.25/source['duration_seconds'],status='completed',memory_after={'peak_working_set_bytes':1234,'peak_private_commit_bytes':4321})

    def test_finished_checkpoint_never_reloads_model(self):
        job=self.job();state=dict(stage='completed',manifest_sha256=job['manifest_sha256'],settings=job['settings'],completed=[self.record(r) for r in job['cases']])
        with self.folder() as temp:
            folder=Path(temp);atomic(folder/'checkpoint.json',state)
            with patch.object(full,'cached_snapshot',return_value=(folder,job['cached_model'])),patch.object(pilot.subprocess,'Popen') as spawn:
                self.assertTrue(full.validate_existing(folder,job));spawn.assert_not_called()
            state['completed'].pop();atomic(folder/'checkpoint.json',state)
            with patch.object(full,'cached_snapshot',return_value=(folder,job['cached_model'])),self.assertRaises(ValueError):full.validate_existing(folder,job)

    def test_fake_interruption_resume_all_100_and_full_only_output(self):
        job=self.job();counter=Mock();counter.system.return_value=dict(available_ram_bytes=3*GiB,commit_headroom_bytes=4*GiB)
        counter.process.return_value={'peak_working_set_bytes':1234,'peak_private_commit_bytes':4321}
        service=Mock();service.transcribe.side_effect=[Mock(transcript='unit fixture'),Mock(transcript='unit fixture'),KeyboardInterrupt()]
        with self.folder() as temp:
            folder=Path(temp);atomic(folder/'job.json',job);atomic(folder/'start.json',{})
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counter),patch.object(worker,'cached_snapshot',return_value=(folder,job['cached_model'])),patch.object(worker,'runtime',return_value=(service,Mock(return_value=object()))):
                with self.assertRaises(KeyboardInterrupt):worker.run(folder/'job.json',full.RAW)
            state=read(folder/'checkpoint.json');self.assertEqual(len(state['completed']),1);saved=copy.deepcopy(state['completed'][0]);resume_records(state,job)
            service.transcribe.side_effect=None;service.transcribe.return_value=Mock(transcript='unit fixture')
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counter),patch.object(worker,'cached_snapshot',return_value=(folder,job['cached_model'])),patch.object(worker,'runtime',return_value=(service,Mock(return_value=object()))):
                self.assertEqual(worker.run(folder/'job.json',full.RAW),0)
            state=read(folder/'checkpoint.json');self.assertEqual(len(state['completed']),100);self.assertEqual(state['completed'][0],saved)
            self.assertEqual(len(state['warmups']),2);self.assertEqual(service.transcribe.call_count,103)
            with patch.object(base,'atomic') as outputs,patch.object(pilot,'atomic') as common_outputs:
                summary=full.summarize(folder,job,state,{},'full_completed',None,[],1)
            paths=[c.args[0] for c in [*outputs.call_args_list,*common_outputs.call_args_list]]
            self.assertIn(full.REPORT,paths);self.assertNotIn(base.REPORT,paths);self.assertNotIn(TINY_BASELINE,paths)
            self.assertEqual(summary['planned_samples'],100);self.assertTrue(summary['metrics_complete']);self.assertTrue(summary['corpus_evaluation_run'])
            self.assertEqual(summary['mode'],'base_full');self.assertEqual(summary['peak_private_commit_bytes'],4321)
            self.assertEqual(summary['total_inference_seconds'],sum(r['inference_seconds'] for r in state['completed']))
            self.assertAlmostEqual(summary['aggregate_real_time_factor'],sum(r['inference_seconds'] for r in state['completed'])/sum(r['duration_seconds'] for r in state['completed']))
            bad=copy.deepcopy(state);bad['completed'][0]['metrics']['words']['errors']+=1
            with self.assertRaises(ValueError):resume_records(bad,job)

    def test_completed_checkpoint_recovers_exports_without_inference(self):
        job=self.job();state=dict(stage='completed',manifest_sha256=job['manifest_sha256'],settings=job['settings'],completed=[self.record(r) for r in job['cases']])
        with self.folder() as temp:
            folder=Path(temp);atomic(folder/'checkpoint.json',state)
            with patch.object(full,'REPORT',folder/'final.json'),patch.object(pilot,'execute') as inference:
                result=full.finalize_completed(folder,job)
                self.assertTrue((folder/'final.json').exists());self.assertTrue(result['metrics_complete'])
                self.assertTrue(result['recovered_from_completed_checkpoint']);self.assertIsNone(result['total_supervisor_seconds'])
                again=full.finalize_completed(folder,job);self.assertEqual(again,result)
                inference.assert_not_called()

if __name__=='__main__':unittest.main()
