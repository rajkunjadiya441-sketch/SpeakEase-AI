"""base.en preparation tests only; fake transcription, no model loading/inference."""
import ast
import copy
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock,patch
import asr_base_pilot as base
import asr_base_pilot_worker as entry
import asr_pilot as pilot
import asr_pilot_worker as worker
import pilot_common as common
from asr_metrics import POLICY,score,aggregate
from pilot_common import ROOT,MANIFEST,BASE_RAW,TINY_BASELINE,SETTINGS,read,atomic,validate_contract,resume_records,sha
from windows_memory import GiB

class BasePilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.original_job=base.make_job()
    def job(self):return copy.deepcopy(self.original_job)

    def test_identical_100_manifest_ids_and_relative_pilot_order(self):
        job=self.job();baseline=read(TINY_BASELINE);self.assertEqual(job['ordered_dataset_ids'],baseline['selected_ids'])
        positions=[baseline['selected_ids'].index(r['id']) for r in job['cases']]
        self.assertEqual(positions,sorted(positions));self.assertEqual(len(job['cases']),3)
        self.assertEqual(job['cases'][0]['id'],baseline['selected_ids'][0]);self.assertEqual(max(r['duration_seconds'] for r in job['cases']),29.14)
        validate_contract(job)

    def test_decoding_and_scoring_match_completed_tiny(self):
        job=self.job();baseline=read(TINY_BASELINE)
        self.assertEqual(job['settings'],dict(baseline['settings'],model='base.en'))
        self.assertEqual(job['scoring_policy'],baseline['scoring_policy']);self.assertEqual(job['scoring_policy'],POLICY)
        self.assertEqual(job['warmup'],baseline['reproducibility']['warmup'])
        self.assertEqual(sha(ROOT/'evaluation/scripts/asr_metrics.py'),baseline['reproducibility']['evaluation_script_sha256']['evaluation/scripts/asr_metrics.py'])
        self.assertEqual(SETTINGS['model'],'tiny')

    def test_full_other_model_and_changed_contract_rejected(self):
        for model,mode in [('base.en','full'),('tiny','pilot'),('base','pilot')]:
            with self.assertRaises(ValueError):base.require_scope(model,mode)
        for name in ('full','order','dataset_order','settings','baseline','scoring','warmup'):
            job=self.job()
            if name=='full':job['mode']='full'
            elif name=='order':job['cases'].reverse()
            elif name=='dataset_order':job['ordered_dataset_ids'].reverse()
            elif name=='settings':job['settings']['cpu_threads']=4
            elif name=='baseline':job['tiny_baseline_sha256']='changed'
            elif name=='scoring':job['score_pilot']=False
            else:job['warmup']='disabled'
            with self.subTest(name=name),self.assertRaises(ValueError):validate_contract(job)

    def test_parent_enforces_base_ram_gate_before_spawn(self):
        job=self.job();counter=Mock();counter.system.return_value=dict(available_ram_bytes=6*GiB//5,commit_headroom_bytes=4*GiB)
        reporter=Mock(return_value={'status':'blocked_memory'})
        with tempfile.TemporaryDirectory() as temp,patch.object(pilot,'atomic'),patch.object(pilot.subprocess,'Popen') as spawn:
            pilot.execute(Path(temp),job,counter,reporter=reporter)
        spawn.assert_not_called();decision=reporter.call_args.args[3]
        self.assertEqual(decision['required_available_ram_bytes'],5*GiB//4);self.assertFalse(decision['passed'])

    def test_parent_enforces_base_commit_gate_before_spawn(self):
        job=self.job();counter=Mock();counter.system.return_value=dict(available_ram_bytes=2*GiB,commit_headroom_bytes=2*GiB)
        reporter=Mock(return_value={'status':'blocked_memory'})
        with tempfile.TemporaryDirectory() as temp,patch.object(pilot,'atomic'),patch.object(pilot.subprocess,'Popen') as spawn:
            pilot.execute(Path(temp),job,counter,reporter=reporter)
        spawn.assert_not_called();self.assertEqual(reporter.call_args.args[3]['required_commit_headroom_bytes'],5*GiB//2)

    def folder(self):
        BASE_RAW.mkdir(parents=True,exist_ok=True)
        return tempfile.TemporaryDirectory(dir=BASE_RAW)

    def test_worker_gate_failure_prevents_runtime_import(self):
        with self.folder() as temp:
            folder=Path(temp);job=self.job();atomic(folder/'job.json',job);atomic(folder/'start.json',{})
            counters=Mock();counters.system.return_value=dict(available_ram_bytes=6*GiB//5,commit_headroom_bytes=4*GiB)
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),patch.object(worker,'cached_snapshot') as cache,patch.object(worker,'runtime') as runtime:
                self.assertEqual(worker.run(folder/'job.json',BASE_RAW),3)
            cache.assert_not_called();runtime.assert_not_called();self.assertEqual(read(folder/'checkpoint.json')['stage'],'blocked_memory')

    def test_worker_rechecks_base_gate_before_model_prepare(self):
        with self.folder() as temp:
            folder=Path(temp);job=self.job();atomic(folder/'job.json',job);atomic(folder/'start.json',{})
            counters=Mock();counters.system.side_effect=[dict(available_ram_bytes=3*GiB,commit_headroom_bytes=4*GiB),dict(available_ram_bytes=6*GiB//5,commit_headroom_bytes=4*GiB)];counters.process.return_value={}
            service=Mock()
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),patch.object(worker,'cached_snapshot',return_value=(folder,job['cached_model'])) as cache,patch.object(worker,'runtime',return_value=(service,Mock())) as runtime:
                self.assertEqual(worker.run(folder/'job.json',BASE_RAW),3)
            cache.assert_called_once_with('base.en');runtime.assert_called_once_with(folder,'base.en');service.prepare.assert_not_called()

    def test_base_cache_optional_preprocessor_and_required_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);cache=root/'models/models--Systran--faster-whisper-base.en';revision='b'*40
            snapshot=cache/'snapshots'/revision;snapshot.mkdir(parents=True);(cache/'refs').mkdir();(cache/'refs/main').write_text(revision)
            for name in ('model.bin','config.json','tokenizer.json','vocabulary.txt'):(snapshot/name).write_bytes(b'unit fixture never loaded')
            with patch.object(worker,'ROOT',root):
                found,meta=worker.cached_snapshot('base.en');self.assertEqual(found,snapshot);self.assertEqual(meta['model'],'base.en')
                self.assertEqual(meta['absent_optional_files'],['preprocessor_config.json'])
                (snapshot/'tokenizer.json').unlink()
                with self.assertRaises(FileNotFoundError):worker.cached_snapshot('base.en')
                with self.assertRaises(ValueError):worker.cached_snapshot('../escape')

    def test_offline_runtime_passes_identical_model_configuration(self):
        capture={};model_factory=Mock()
        def service_factory(**kwargs):capture.update(kwargs);return Mock()
        av=types.ModuleType('av');numpy=types.ModuleType('numpy');faster=types.ModuleType('faster_whisper');faster.WhisperModel=model_factory
        app=types.ModuleType('app');app.__path__=[];services=types.ModuleType('app.services');services.__path__=[]
        transcription=types.ModuleType('app.services.transcription');transcription.TranscriptionService=service_factory
        with patch.dict(sys.modules,{'av':av,'numpy':numpy,'faster_whisper':faster,'app':app,'app.services':services,'app.services.transcription':transcription}):
            worker.runtime(Path('local-snapshot'),'base.en')
            capture['model_factory']('base.en',device='cpu',compute_type='int8',cpu_threads=2,num_workers=1,download_root='local-cache')
        self.assertEqual(capture['model_name'],'base.en');self.assertEqual(capture['cpu_threads'],2)
        model_factory.assert_called_once_with('local-snapshot',local_files_only=True,device='cpu',compute_type='int8',cpu_threads=2,num_workers=1,download_root='local-cache')
        self.assertNotIn('faster_whisper',sys.modules)

    def test_worker_entry_rejects_full_job(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'job.json';job=self.job();job['mode']='full';atomic(path,job)
            with patch.object(sys,'argv',['worker','--job',str(path)]),patch.object(entry,'run') as run:
                with self.assertRaises(ValueError):entry.main()
            run.assert_not_called()

    def test_cached_weight_change_stops_before_model(self):
        with self.folder() as temp:
            folder=Path(temp);job=self.job();atomic(folder/'job.json',job);atomic(folder/'start.json',{})
            counters=Mock();counters.system.return_value=dict(available_ram_bytes=3*GiB,commit_headroom_bytes=4*GiB);counters.process.return_value={}
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),patch.object(worker,'cached_snapshot',return_value=(folder,{'changed':True})),patch.object(worker,'runtime') as runtime:
                with self.assertRaisesRegex(ValueError,'Cached weights changed'):worker.run(folder/'job.json',BASE_RAW)
            runtime.assert_not_called()

    def record(self,row):
        return dict(id=row['id'],source_sha256=row['source_sha256'],reference_text=row['reference_text'],predicted_text='unit test fixture',
            duration_seconds=row['duration_seconds'],inference_seconds=.25,decode_seconds=.01,real_time_factor=.25/row['duration_seconds'],
            status='completed',first_call_in_process=True,metrics=score(row['reference_text'],'unit test fixture'),memory_after={'peak_working_set_bytes':1234})

    def test_resume_rejects_changed_metrics_and_reference(self):
        job=self.job();state={'manifest_sha256':job['manifest_sha256'],'settings':job['settings'],'completed':[self.record(job['cases'][0])]}
        resume_records(state,job)
        for key in ('reference_text','metrics','inference_seconds'):
            bad=copy.deepcopy(state)
            if key=='reference_text':bad['completed'][0][key]='changed'
            elif key=='metrics':bad['completed'][0][key]['words']['errors']+=1
            else:bad['completed'][0][key]=-1
            with self.subTest(key=key),self.assertRaises(ValueError):resume_records(bad,job)

    def test_interruption_resume_three_scored_cases_and_excluded_warmup(self):
        job=self.job();counters=Mock();counters.system.return_value=dict(available_ram_bytes=3*GiB,commit_headroom_bytes=4*GiB)
        counters.process.return_value={'peak_working_set_bytes':1234}
        service=Mock();service.transcribe.side_effect=[Mock(transcript='unit test fixture'),Mock(transcript='unit test fixture'),KeyboardInterrupt()]
        with self.folder() as temp:
            folder=Path(temp);atomic(folder/'job.json',job);atomic(folder/'start.json',{})
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),patch.object(worker,'cached_snapshot',return_value=(folder,job['cached_model'])),patch.object(worker,'runtime',return_value=(service,Mock(return_value=object()))):
                with self.assertRaises(KeyboardInterrupt):worker.run(folder/'job.json',BASE_RAW)
            state=read(folder/'checkpoint.json');self.assertEqual(len(state['completed']),1);saved=copy.deepcopy(state['completed'][0]);resume_records(state,job)
            service.transcribe.side_effect=None;service.transcribe.return_value=Mock(transcript='unit test fixture')
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),patch.object(worker,'cached_snapshot',return_value=(folder,job['cached_model'])),patch.object(worker,'runtime',return_value=(service,Mock(return_value=object()))):
                self.assertEqual(worker.run(folder/'job.json',BASE_RAW),0)
            state=read(folder/'checkpoint.json');self.assertEqual(len(state['completed']),3);self.assertEqual(state['completed'][0],saved)
            self.assertEqual(len(state['warmups']),2);self.assertEqual(service.transcribe.call_count,6)
            self.assertEqual([r['id'] for r in state['completed']],[r['id'] for r in job['cases']])
            for record in state['completed']:self.assertEqual(record['metrics'],score(record['reference_text'],record['predicted_text']))

    def test_summary_writes_only_base_outputs_and_uses_same_aggregation(self):
        job=self.job();records=[self.record(row) for row in job['cases']];state=dict(completed=records,settings=job['settings'],warmups=[{'id':job['cases'][0]['id'],'inference_seconds':99,'memory_after':{'peak_working_set_bytes':1234}}])
        with self.folder() as temp:
            folder=Path(temp)
            with patch.object(pilot,'atomic') as pilot_writes,patch.object(base,'atomic') as base_writes:
                result=base.summarize(folder,job,state,{},'pilot_completed',None,[],1)
            paths=[call.args[0] for call in [*pilot_writes.call_args_list,*base_writes.call_args_list]]
            self.assertIn(base.REPORT,paths);self.assertNotIn(pilot.REPORT,paths);self.assertNotIn(TINY_BASELINE,paths)
            self.assertEqual(result['settings']['model'],'base.en');self.assertTrue(result['pilot_metrics_complete']);self.assertFalse(result['metrics_complete'])
            self.assertEqual(result['metrics'],aggregate(records));self.assertEqual(result['total_inference_seconds'],.75)
            self.assertAlmostEqual(result['aggregate_real_time_factor'],.75/sum(r['duration_seconds'] for r in records))
            self.assertEqual(result['planned_samples'],3);self.assertEqual(result['mode'],'base_en_pilot')

if __name__=='__main__':unittest.main()
