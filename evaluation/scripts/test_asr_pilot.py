"""Contract, interruption and native monitor checks; no speech inference."""
import ast
import copy
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch,Mock
import asr_pilot as pilot
import asr_pilot_worker as worker
from pilot_common import ROOT,RAW,SETTINGS,atomic,read,choose,resume_records,validate_contract,audio_path
from windows_memory import GiB,gate,PressureGuard,NativeMemory,PagingCounters,OwnedJob

class Contracts(unittest.TestCase):
    def test_exact_gates_for_both_models(self):
        for model,ram,commit in [('tiny',GiB,2*GiB),('base.en',5*GiB//4,5*GiB//2)]:
            self.assertTrue(gate({'available_ram_bytes':ram,'commit_headroom_bytes':commit},model)['passed'])
            self.assertFalse(gate({'available_ram_bytes':ram-1,'commit_headroom_bytes':commit},model)['passed'])
            self.assertFalse(gate({'available_ram_bytes':ram,'commit_headroom_bytes':commit-1},model)['passed'])

    def test_missing_counters_fail_closed(self):
        with self.assertRaises(KeyError):gate({'available_ram_bytes':GiB})

    def test_scope_blocks_base_and_corpus(self):
        for model,mode in [('base.en','pilot'),('tiny','full'),('tiny','corpus')]:
            with self.assertRaises(ValueError):pilot.require_scope(model,mode)

    def test_three_reproducible_cases_include_longest(self):
        job=pilot.make_job();cases=job['cases'];self.assertEqual(len(cases),3)
        self.assertEqual(cases,choose(list(reversed(read(pilot.MANIFEST)['records']))))
        self.assertEqual(cases[-1]['duration_seconds'],29.14)
        self.assertEqual(cases[0]['duration_seconds'],2.02)
        validate_contract(job)

    def test_changed_settings_or_manifest_rejected(self):
        job=pilot.make_job();job['settings']=dict(SETTINGS,cpu_threads=4)
        with self.assertRaises(ValueError):validate_contract(job)
        job=pilot.make_job();job['manifest_sha256']='changed'
        with self.assertRaises(ValueError):validate_contract(job)

    def test_more_than_three_cases_rejected(self):
        job=pilot.make_job();job['cases'].append(job['cases'][0])
        with self.assertRaises(ValueError):validate_contract(job)

    def test_audio_path_cannot_escape_data(self):
        with self.assertRaises(ValueError):audio_path({'audio_path':'README.md','id':'1-1-0000'})

    def test_atomic_checkpoint_survives_failed_replace(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'checkpoint.json';atomic(target,{'completed':[1]})
            with patch('pilot_common.os.replace',side_effect=OSError('simulated interruption')):
                with self.assertRaises(OSError):atomic(target,{'completed':[1,2]})
            self.assertEqual(read(target),{'completed':[1]});self.assertEqual(list(Path(temp).iterdir()),[target])

    def test_atomic_checkpoint_retries_transient_windows_lock(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'checkpoint.json';original=os.replace
            attempts=[]
            def transient(source,destination):
                attempts.append(1)
                if len(attempts)==1:raise PermissionError('simulated transient file lock')
                original(source,destination)
            with patch('pilot_common.os.replace',side_effect=transient):atomic(path,{'completed':[1]})
            self.assertEqual(read(path),{'completed':[1]});self.assertEqual(len(attempts),2)

    def test_resume_preserves_completed_prefix(self):
        job=pilot.make_job();row=job['cases'][0]
        record={'id':row['id'],'source_sha256':row['source_sha256'],'status':'completed'}
        checkpoint={'manifest_sha256':job['manifest_sha256'],'settings':SETTINGS,'completed':[record]}
        self.assertEqual(resume_records(checkpoint,job),[record])
        bad=copy.deepcopy(checkpoint);bad['completed'][0]['id']=job['cases'][-1]['id']
        with self.assertRaises(ValueError):resume_records(bad,job)
        bad=copy.deepcopy(checkpoint);bad['completed'][0]['source_sha256']='changed'
        with self.assertRaises(ValueError):resume_records(bad,job)

    def test_pressure_requires_sustained_low_memory_and_resets(self):
        guard=PressureGuard();low={'available_ram_bytes':100,'commit_headroom_bytes':2*GiB};high={'available_ram_bytes':GiB,'commit_headroom_bytes':2*GiB}
        self.assertFalse(guard.update(low,0));self.assertFalse(guard.update(low,4.9));self.assertTrue(guard.update(low,5))
        self.assertFalse(guard.update(high,6));self.assertFalse(guard.update(low,7));self.assertFalse(guard.update(low,11.9))

    def test_parent_gate_failure_never_spawns(self):
        job=pilot.make_job();counter=Mock();counter.system.return_value={'available_ram_bytes':GiB-1,'commit_headroom_bytes':3*GiB}
        with tempfile.TemporaryDirectory() as temp,patch.object(pilot,'atomic'),patch.object(pilot,'summarize',return_value={'status':'blocked_memory'}) as report,patch.object(pilot.subprocess,'Popen') as spawn:
            result=pilot.execute(Path(temp),job,counter)
        self.assertEqual(result['status'],'blocked_memory');spawn.assert_not_called();report.assert_called_once()

    def test_blocked_report_has_no_fake_timing_or_checkpoint(self):
        job=pilot.make_job()
        with tempfile.TemporaryDirectory() as temp,patch.object(pilot,'atomic'):
            summary=pilot.summarize(ROOT/'evaluation/results/raw/no_worker_test',job,{},gate({'available_ram_bytes':1,'commit_headroom_bytes':3*GiB}),'blocked_memory',None,[],None)
        self.assertIsNone(summary['total_supervisor_seconds']);self.assertIsNone(summary['total_inference_seconds'])
        self.assertIsNone(summary['peak_worker_resident_bytes']);self.assertFalse(summary['checkpoint_preserved'])

    def test_worker_gate_failure_prevents_imports_or_load(self):
        RAW.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=RAW) as temp:
            folder=Path(temp);job=pilot.make_job();atomic(folder/'job.json',job);atomic(folder/'start.json',{})
            counters=Mock();counters.system.return_value={'available_ram_bytes':1,'commit_headroom_bytes':3*GiB}
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),patch.object(worker,'runtime') as runtime,patch.object(worker,'cached_snapshot') as cache:
                self.assertEqual(worker.run(folder/'job.json'),3)
                runtime.assert_not_called();cache.assert_not_called()
            self.assertEqual(read(folder/'checkpoint.json')['stage'],'blocked_memory')

    def test_gate_rechecked_before_prepare(self):
        RAW.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=RAW) as temp:
            folder=Path(temp);job=pilot.make_job();atomic(folder/'job.json',job);atomic(folder/'start.json',{})
            counters=Mock();counters.system.side_effect=[{'available_ram_bytes':2*GiB,'commit_headroom_bytes':3*GiB},{'available_ram_bytes':GiB-1,'commit_headroom_bytes':3*GiB}];counters.process.return_value={}
            service=Mock()
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),patch.object(worker,'cached_snapshot',return_value=(folder,{})),patch.object(worker,'runtime',return_value=(service,Mock())):
                self.assertEqual(worker.run(folder/'job.json'),3)
                service.prepare.assert_not_called()

    def test_transcription_settings_match_application_call(self):
        tree=ast.parse((ROOT/'backend/app/services/transcription.py').read_text())
        call=next(node for node in ast.walk(tree) if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=='transcribe' and any(k.arg=='beam_size' for k in node.keywords))
        supplied={k.arg:ast.literal_eval(k.value) for k in call.keywords}
        self.assertEqual(supplied,{'language':'en','beam_size':1,'vad_filter':True,'word_timestamps':False,'condition_on_previous_text':False})
        self.assertEqual(SETTINGS['cpu_threads'],2);self.assertEqual(SETTINGS['compute_type'],'int8')

    def cache_fixture(self, root, preprocessor=False):
        revision='a'*40
        cache=root/'models/models--Systran--faster-whisper-tiny'
        snapshot=cache/'snapshots'/revision;snapshot.mkdir(parents=True)
        (cache/'refs').mkdir();(cache/'refs/main').write_text(revision)
        for name in ('model.bin','config.json','tokenizer.json','vocabulary.txt'):
            (snapshot/name).write_bytes(b'cache-validation test fixture; never loaded')
        if preprocessor:(snapshot/'preprocessor_config.json').write_text('{"feature_size":80}')
        return snapshot

    def test_cached_snapshot_allows_absent_optional_preprocessor(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snapshot=self.cache_fixture(root)
            with patch.object(worker,'ROOT',root):found,metadata=worker.cached_snapshot()
            self.assertEqual(found,snapshot)
            self.assertEqual(set(metadata['files']),{'model.bin','config.json','tokenizer.json','vocabulary.txt'})
            self.assertEqual(metadata['absent_optional_files'],['preprocessor_config.json'])
            self.assertFalse((snapshot/'preprocessor_config.json').exists())

    def test_cached_snapshot_records_present_optional_config(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snapshot=self.cache_fixture(root,preprocessor=True)
            with patch.object(worker,'ROOT',root):found,metadata=worker.cached_snapshot()
            self.assertEqual(metadata['absent_optional_files'],[])
            self.assertEqual(metadata['files']['preprocessor_config.json']['sha256'],worker.sha(snapshot/'preprocessor_config.json'))

    def test_cached_snapshot_still_rejects_missing_required_files(self):
        for name in ('model.bin','config.json','tokenizer.json'):
            with self.subTest(name=name),tempfile.TemporaryDirectory() as temp:
                root=Path(temp);snapshot=self.cache_fixture(root);(snapshot/name).unlink()
                with patch.object(worker,'ROOT',root),self.assertRaises(FileNotFoundError):worker.cached_snapshot()

    def test_installed_loader_uses_defaults_without_optional_config(self):
        # Execute only the installed pure configuration reader, not WhisperModel.__init__.
        source=ROOT/'backend/.venv/Lib/site-packages/faster_whisper/transcribe.py'
        tree=ast.parse(source.read_text(encoding='utf-8'))
        method=next(node for node in ast.walk(tree) if isinstance(node,ast.FunctionDef) and node.name=='_get_feature_kwargs')
        namespace={'os':os,'json':json}
        exec(compile(ast.Module(body=[method],type_ignores=[]),str(source),'exec'),namespace)
        with tempfile.TemporaryDirectory() as temp:
            self.assertEqual(namespace['_get_feature_kwargs'](None,temp),{})
        self.assertNotIn('faster_whisper',sys.modules)

    def test_offline_factory_uses_local_path_only(self):
        tree=ast.parse(Path(worker.__file__).read_text())
        factory=next(node for node in ast.walk(tree) if isinstance(node,ast.FunctionDef) and node.name=='factory')
        call=next(node for node in ast.walk(factory) if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='WhisperModel')
        local=next(k.value for k in call.keywords if k.arg=='local_files_only');self.assertIs(ast.literal_eval(local),True)

@unittest.skipUnless(os.name=='nt','Native Windows counters required')
class NativeSmoke(unittest.TestCase):
    def test_real_system_and_self_counters(self):
        counters=NativeMemory();system=counters.system();process=counters.process()
        self.assertGreater(system['total_ram_bytes'],system['available_ram_bytes']);self.assertGreater(system['commit_headroom_bytes'],0)
        self.assertEqual(process['pid'],os.getpid());self.assertGreater(process['peak_working_set_bytes'],0)

    def test_real_paging_counter_rates(self):
        paging=PagingCounters()
        try:
            paging.sample();time.sleep(1.1);sample=paging.sample()
            self.assertTrue(sample['available'],sample)
            self.assertGreaterEqual(sample['pages_input_per_sec'],0)
        finally:paging.close()

    def test_owned_job_stops_only_test_child_tree(self):
        with tempfile.TemporaryDirectory() as temp:
            marker=Path(temp)/'joined';job=OwnedJob();child=None;native_handle=None
            script='import os,sys,time;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from windows_memory import OwnedJob;OwnedJob.join_current(os.environ["SPEAKEASE_EVAL_JOB"]);Path(sys.argv[2]).write_text(str(os.getpid()));time.sleep(30)'
            try:
                child=subprocess.Popen([sys.executable,'-B','-I','-S','-c',script,str(Path(__file__).parent),str(marker)],env={**os.environ,'SPEAKEASE_EVAL_JOB':job.name},creationflags=subprocess.CREATE_NO_WINDOW)
                job.assign(child);deadline=time.monotonic()+10
                while not marker.exists() and time.monotonic()<deadline and child.poll() is None:time.sleep(.05)
                self.assertTrue(marker.exists(),'Test worker failed to join its owned job')
                dll=ctypes.WinDLL('kernel32',use_last_error=True)
                dll.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];dll.OpenProcess.restype=wintypes.HANDLE
                dll.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD];dll.WaitForSingleObject.restype=wintypes.DWORD
                dll.CloseHandle.argtypes=[wintypes.HANDLE]
                native_handle=dll.OpenProcess(0x100000,False,int(marker.read_text()))
                self.assertTrue(native_handle);self.assertEqual(dll.WaitForSingleObject(native_handle,0),258)
                job.close();self.assertEqual(dll.WaitForSingleObject(native_handle,3000),0)
                child.wait(timeout=5)
            finally:
                job.close()
                if native_handle:dll.CloseHandle(native_handle)
                if child and child.poll() is None:child.kill();child.wait(timeout=5)

if __name__=='__main__':unittest.main()
