"""Full-run tests use fake transcription only; no ML imports or inference."""
import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock,patch
import asr_full as full
import asr_pilot_worker as worker
from asr_metrics import score,normalize,aggregate,edits
from pilot_common import ROOT,SETTINGS,atomic,read,resume_records,validate_contract
from windows_memory import GiB

class FullTests(unittest.TestCase):
    def test_normalization_and_known_edits(self):
        self.assertEqual(normalize("  IT’S—A, Test! 42 "),"it's a test 42")
        w=score('one two three','one four')['words']
        self.assertEqual((w['substitutions'],w['deletions'],w['insertions']),(1,1,0))
        self.assertEqual(score('a','a b c')['words']['rate'],2)
        self.assertEqual(score('a b','ab')['characters']['rate'],0)
        with self.assertRaises(ValueError):score('!!!','a')
        self.assertEqual(edits([],['x'])['insertions'],1)

    def test_full_contract_and_rejections(self):
        job=full.make_job();validate_contract(job);self.assertEqual(len(job['cases']),100)
        for change in ('order','model','count'):
            bad=copy.deepcopy(job)
            if change=='order':bad['cases'].reverse()
            if change=='count':bad['cases'].pop()
            if change=='model':bad['settings']=dict(SETTINGS,model='base.en')
            with self.assertRaises(ValueError):validate_contract(bad)

    def test_weighted_aggregation(self):
        records=[{'metrics':score('a','b')},{'metrics':score('a b c','a b c')}]
        self.assertEqual(aggregate(records)['words']['rate'],0.25)

    def test_mock_interruption_resume_all_100_and_report(self):
        job=full.make_job();full.RAW.mkdir(parents=True,exist_ok=True)
        counters=Mock();counters.system.return_value=dict(available_ram_bytes=2*GiB,commit_headroom_bytes=3*GiB)
        counters.process.return_value={'peak_working_set_bytes':1234}
        service=Mock();service.transcribe.side_effect=[Mock(transcript='test'),Mock(transcript='test'),KeyboardInterrupt()]
        with tempfile.TemporaryDirectory(dir=full.RAW) as temp:
            folder=Path(temp);atomic(folder/'job.json',job);atomic(folder/'start.json',{})
            patches=[patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),
                patch.object(worker,'cached_snapshot',return_value=(folder,job['cached_model'])),
                patch.object(worker,'runtime',return_value=(service,Mock(return_value=object())))]
            with patches[0],patches[1],patches[2],patches[3]:
                with self.assertRaises(KeyboardInterrupt):worker.run(folder/'job.json',full.RAW)
            state=read(folder/'checkpoint.json');self.assertEqual(len(state['completed']),1)
            resume_records(state,job);saved=copy.deepcopy(state['completed'][0])
            service.transcribe.side_effect=None;service.transcribe.return_value=Mock(transcript='test')
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counters),patch.object(worker,'cached_snapshot',return_value=(folder,job['cached_model'])),patch.object(worker,'runtime',return_value=(service,Mock(return_value=object()))):
                self.assertEqual(worker.run(folder/'job.json',full.RAW),0)
            state=read(folder/'checkpoint.json');self.assertEqual(len(state['completed']),100)
            self.assertEqual(state['completed'][0],saved);self.assertEqual(len(state['warmups']),2)
            self.assertEqual(service.transcribe.call_count,103)
            with patch.object(full,'atomic'),patch.object(full.pilot,'atomic'):
                summary=full.summarize(folder,job,state,{},'full_completed',None,[],1)
            self.assertTrue(summary['metrics_complete']);self.assertEqual(summary['planned_samples'],100)
            self.assertGreaterEqual(summary['peak_worker_resident_bytes'],1234)
            self.assertAlmostEqual(summary['aggregate_real_time_factor'],sum(r['inference_seconds'] for r in state['completed'])/sum(r['duration_seconds'] for r in state['completed']))

if __name__=='__main__':unittest.main()
