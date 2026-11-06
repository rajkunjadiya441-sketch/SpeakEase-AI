"""Synthetic timestamps and non-inference execution guards only."""
import copy
import json
from pathlib import Path
import socket
import sys
import tempfile
import unittest
from unittest.mock import Mock,patch
import phase4_metrics as metrics
import phase4_common as common
import phase4_pilot as pilot
import phase4_worker as worker
import phase4_prepare as prepare
from pilot_common import read,sha,atomic
from test_asr_pilot import NativeSmoke  # existing real native counters/owned disposable-child checks

class MetricTests(unittest.TestCase):
    def refs(self,words=('alpha','beta'),status='verified'):
        return [dict(recording_id='fixture',word_index=i+1,word=w,reference_start_seconds=i,reference_end_seconds=i+.5,
            annotation_status=status,annotator_id='human-a',reviewer_id='human-b') for i,w in enumerate(words)]
    def predictions(self):return [dict(word='alpha',start=.1,end=.7),dict(word='beta',start=1.05,end=1.55)]
    def test_known_mae_median_thresholds(self):
        r=metrics.evaluate('fixture','alpha beta',self.predictions(),self.refs(),3)
        self.assertAlmostEqual(r['start_mae_seconds'],.075);self.assertAlmostEqual(r['end_mae_seconds'],.125)
        self.assertAlmostEqual(r['combined_boundary_mae_seconds'],.1);self.assertAlmostEqual(r['median_absolute_boundary_error_seconds'],.075)
        self.assertEqual(r['boundaries_within_100ms_percent'],75);self.assertEqual(r['boundaries_within_200ms_percent'],100)
        self.assertEqual(r['word_alignment_coverage'],1);self.assertEqual(r['scored_word_pairs'],2)
    def test_missing_words_keep_all_reference_denominator(self):
        r=metrics.evaluate('fixture','alpha beta',self.predictions()[:1],self.refs(),3)
        self.assertEqual(r['word_alignment_coverage'],.5);self.assertEqual(r['boundaries_within_100ms_percent'],50)
        self.assertEqual(r['all_reference_boundaries_within_100ms_percent'],25);self.assertEqual(r['all_reference_boundaries_within_200ms_percent'],50)
    def test_unverified_references_never_produce_accuracy(self):
        refs=self.refs(status='pending')
        for r in refs:r['reference_start_seconds']='';r['reference_end_seconds']=''
        result=metrics.evaluate('fixture','alpha beta',self.predictions(),refs,3)
        self.assertTrue(all(result[k] is None for k in metrics.ACCURACY_KEYS));self.assertEqual(result['word_alignment_coverage'],1)
        self.assertEqual(metrics.aggregate([result])['accuracy_scope'],'unavailable')
    def test_performance_only_suppresses_even_verified_accuracy(self):
        r=metrics.evaluate('fixture','alpha beta',self.predictions(),self.refs(),3,allow_accuracy=False)
        self.assertEqual(r['accuracy_status'],'disabled_performance_only');self.assertTrue(all(r[k] is None for k in metrics.ACCURACY_KEYS))
    def test_performance_only_distinguishes_available_refs_from_scored_refs(self):
        r=metrics.evaluate('fixture','alpha beta',self.predictions(),self.refs(),3,allow_accuracy=False)
        result=metrics.aggregate([r])
        self.assertEqual(result['fully_verified_reference_recordings'],1);self.assertEqual(result['accuracy_eligible_recordings'],0)
        self.assertIsNone(result['combined_boundary_mae_seconds'])
    def test_partial_annotation_is_not_cherry_picked(self):
        refs=self.refs();refs[1]['annotation_status']='uncertain'
        r=metrics.evaluate('fixture','alpha beta',self.predictions(),refs,3)
        self.assertEqual(r['verified_reference_words'],1);self.assertIsNone(r['start_mae_seconds'])
    def test_verified_missing_nan_or_self_review_rejected(self):
        for key,value in [('reference_start_seconds',''),('reference_end_seconds','nan'),('reviewer_id','human-a'),('reference_start_seconds',True),('reference_end_seconds',4)]:
            refs=self.refs();refs[0][key]=value
            with self.subTest(key=key,value=value),self.assertRaises(ValueError):metrics.evaluate('fixture','alpha beta',self.predictions(),refs,3)
    def test_overlapping_human_intervals_rejected(self):
        refs=self.refs();refs[1]['reference_start_seconds']=.4
        with self.assertRaises(ValueError):metrics.evaluate('fixture','alpha beta',self.predictions(),refs,3)
    def test_repeated_word_ambiguity_is_not_guessed(self):
        r=metrics.evaluate('fixture','alpha alpha',[dict(word='alpha',start=.1,end=.5)],self.refs(('alpha','alpha')),3)
        self.assertEqual(r['ambiguous_target_words'],2);self.assertEqual(r['word_alignment_coverage'],0);self.assertIsNone(r['combined_boundary_mae_seconds'])
        self.assertEqual(r['all_reference_boundaries_within_200ms_percent'],0)
    def test_crossing_edit_path_ambiguity_excluded(self):
        mapping,ambiguous,paths=metrics.mandatory_matches(['a','b'],['b','a'])
        self.assertFalse(mapping);self.assertEqual(ambiguous,{0,1});self.assertGreater(paths,1)
    def test_complete_repeated_words_are_uniquely_mapped(self):
        mapping,ambiguous,paths=metrics.mandatory_matches(['a','a'],['a','a'])
        self.assertEqual(mapping,{0:0,1:1});self.assertFalse(ambiguous);self.assertEqual(paths,1)
    def test_punctuation_case_apostrophes_and_tokenization(self):
        self.assertEqual(metrics.token('?HELLO!?'),'hello');self.assertEqual(metrics.token('don\u2019t'),"don't")
        refs=self.refs(('Alpha,','!','beta'));refs[1].update(annotation_status='excluded_punctuation',reference_start_seconds='',reference_end_seconds='')
        refs[2].update(reference_start_seconds=1,reference_end_seconds=1.5)
        r=metrics.evaluate('fixture','Alpha, ! beta',self.predictions(),refs,4)
        self.assertEqual(r['target_words'],2);self.assertEqual(r['word_alignment_coverage'],1)
        split=metrics.evaluate('fixture','ice-cream', [{'word':'ice','start':0,'end':.2},{'word':'cream','start':.2,'end':.4}],self.refs(('ice-cream',)),2)
        self.assertEqual(split['word_alignment_coverage'],0)
    def test_invalid_predictions_and_zero_duration_not_counted(self):
        for start,end in [(None,.5),(0,None),(0,0),(float('nan'),.5),(-1,.5),(0,9),(True,.5)]:
            with self.subTest(start=start,end=end):
                r=metrics.evaluate('fixture','alpha',[dict(word='alpha',start=start,end=end)],self.refs(('alpha',)),2)
                self.assertEqual(r['word_alignment_coverage'],0)
    def test_empty_predictions_do_not_have_zero_mae(self):
        r=metrics.evaluate('fixture','alpha',[],self.refs(('alpha',)),2)
        self.assertIsNone(r['combined_boundary_mae_seconds']);self.assertEqual(r['all_reference_boundaries_within_100ms_percent'],0)
    def test_aggregate_pools_boundaries_not_per_record_means(self):
        a=metrics.evaluate('fixture','alpha beta',self.predictions(),self.refs(),3)
        b=metrics.evaluate('fixture','alpha',[dict(word='alpha',start=.2,end=.7)],self.refs(('alpha',)),3)
        result=metrics.aggregate([a,b]);self.assertAlmostEqual(result['combined_boundary_mae_seconds'],(.4+.4)/6)
        self.assertEqual(result['fully_verified_reference_recordings'],2)

class PreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.job=common.make_job(performance_only=True)
    def test_deterministic_25_selection_and_blank_template(self):
        parent=read(common.MANIFEST);subset=read(common.SUBSET)
        self.assertEqual(common.choose25(list(reversed(parent['records']))),subset['records'])
        self.assertEqual(len(subset['records']),25);self.assertEqual(len(set(r['id'] for r in subset['records'])),25)
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'references.csv';prepare.write_template(path,subset['records'])
            groups=common.annotation_groups(path,subset['records']);self.assertEqual(sum(map(len,groups.values())),457)
            self.assertTrue(all(row['reference_start_seconds'] is None and row['reference_end_seconds'] is None and row['annotation_status']=='pending' for group in groups.values() for row in group))
    def test_missing_verified_annotations_block_default_pilot(self):
        subset=read(common.SUBSET);groups=common.annotation_groups(common.ANNOTATIONS,subset['records'])
        for rows in groups.values():
            for row in rows:row.update(annotation_status='pending',reference_start_seconds=None,reference_end_seconds=None)
        with patch.object(common,'annotation_groups',return_value=groups),self.assertRaisesRegex(ValueError,'Verified independent'):common.make_job()
    def test_prepare_preserves_existing_editable_template(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'references.csv';path.write_text('human draft must survive')
            before=sha(path);self.assertFalse(prepare.write_template(path,read(common.SUBSET)['records']));self.assertEqual(sha(path),before)
    def test_alignment_specific_gate_boundaries(self):
        self.assertTrue(common.alignment_gate(dict(available_ram_bytes=2*1024**3,commit_headroom_bytes=3*1024**3))['passed'])
        for sample in [dict(available_ram_bytes=2*1024**3-1,commit_headroom_bytes=4*1024**3),dict(available_ram_bytes=3*1024**3,commit_headroom_bytes=3*1024**3-1)]:self.assertFalse(common.alignment_gate(sample)['passed'])
    def test_job_rejects_changed_scope_gates_and_annotation_claims(self):
        common.validate_job(self.job)
        for key in ('mode','gates','annotations','accuracy'):
            job=copy.deepcopy(self.job)
            if key=='mode':job['mode']='full'
            elif key=='gates':job['ram_gate_bytes']=1
            elif key=='annotations':job['annotations'][job['cases'][0]['id']][0]['word']='changed frozen token'
            else:job['performance_only']='False'
            with self.subTest(key=key),self.assertRaises(ValueError):common.validate_job(job)
    def test_cache_cpu_identity_without_runtime_import(self):
        resource=self.job['resources'];self.assertEqual(resource['model'],'WAV2VEC2_ASR_BASE_960H');self.assertTrue(resource['packages']['torch'].endswith('+cpu'))
        self.assertEqual(resource['files'][str(common.MODEL_FILE.relative_to(common.ROOT)).replace('\\','/')]['bytes'],377664473)
        for name in ('torch','whisperx','numpy'):self.assertNotIn(name,sys.modules)
    def test_network_is_denied_and_restored(self):
        original=socket.getaddrinfo
        with worker.no_network():
            with self.assertRaisesRegex(RuntimeError,'disabled'):socket.getaddrinfo('example.com',443)
        self.assertIs(socket.getaddrinfo,original)


class PilotGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.job=common.make_job(performance_only=True)
    def folder(self):
        (common.OUT/'runs').mkdir(parents=True,exist_ok=True);return tempfile.TemporaryDirectory(dir=common.OUT/'runs')
    def test_parent_low_ram_blocks_before_spawn(self):
        counter=Mock();counter.system.return_value=dict(available_ram_bytes=1,commit_headroom_bytes=4*1024**3)
        with self.folder() as temp,patch.object(pilot.subprocess,'Popen') as spawn:
            result=pilot.run_case(Path(temp),self.job,self.job['cases'][0],counter)
        self.assertEqual(result['status'],'blocked_memory');spawn.assert_not_called()
    def test_worker_low_gate_prevents_imports_and_model_loading(self):
        job=self.job;row=job['cases'][0];counter=Mock();counter.system.return_value=dict(available_ram_bytes=1,commit_headroom_bytes=4*1024**3)
        with self.folder() as temp:
            folder=Path(temp);atomic(folder/'job.json',job);case=folder/row['id'];case.mkdir();atomic(case/'start.json',{})
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counter),patch.object(worker,'decode') as decode,patch.object(worker,'align_existing') as align:
                self.assertEqual(worker.run(folder/'job.json',row['id']),3)
            decode.assert_not_called();align.assert_not_called()
    def test_worker_reuses_original_reference_and_one_alignment_call(self):
        job=self.job;row=job['cases'][0];counter=Mock();counter.system.return_value=dict(available_ram_bytes=3*1024**3,commit_headroom_bytes=4*1024**3);counter.process.return_value={'peak_working_set_bytes':1234,'peak_private_commit_bytes':4321}
        report={'transcript':row['reference_text'],'runs':[{'words':[],'unaligned_words':row['reference_text'].split(),'alignment_status':'failed','alignment_seconds':.25}]}
        with self.folder() as temp:
            folder=Path(temp);atomic(folder/'job.json',job);case=folder/row['id'];case.mkdir();atomic(case/'start.json',{})
            with patch.object(worker.OwnedJob,'join_current'),patch.object(worker,'NativeMemory',return_value=counter),patch.object(worker,'verify_resources'),patch.object(worker,'decode',return_value=object()),patch.object(worker,'align_existing',return_value=(report,{'runtime_import_seconds':.1,'model_load_seconds':.1})) as align:
                self.assertEqual(worker.run(folder/'job.json',row['id']),0)
            self.assertEqual(align.call_args.args[1],row['reference_text']);self.assertEqual(align.call_count,1)
    def test_original_runner_called_without_transcription(self):
        import ast
        tree=ast.parse(Path(worker.__file__).read_text())
        alignment=[n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='run_alignment']
        self.assertEqual(len(alignment),1);self.assertEqual(next(ast.literal_eval(k.value) for k in alignment[0].keywords if k.arg=='repetitions'),1)
        self.assertFalse(any(isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='transcribe' for n in ast.walk(tree)))
    def test_checkpoint_resume_preserves_prefix_and_keeps_accuracy_null(self):
        job=self.job;counter=Mock();called=[];stop=[True]
        def fake_case(directory,contract,row,counters):
            called.append(row['id'])
            if len(called)==2 and stop[0]:return {'status':'failed','recording_id':row['id'],'error':'unit interruption'}
            folder=directory/row['id'];folder.mkdir(exist_ok=True)
            result={'status':'completed','recording_id':row['id'],'reference_text':row['reference_text'],'source_sha256':row['source_sha256'],
                'duration_seconds':row['duration_seconds'],'words':[],'alignment_status':'failed','alignment_seconds':.25,'peak_resident_bytes':1234,'peak_private_commit_bytes':4321,
                'metrics':metrics.evaluate(row['id'],row['reference_text'],[],job['annotations'][row['id']],row['duration_seconds'],allow_accuracy=False)}
            atomic(folder/'evaluation.json',result);return result
        real_atomic=atomic
        def private_only(path,value):
            if Path(path)!=common.OUT/'pilot_result.json':real_atomic(path,value)
        with self.folder() as temp:
            folder=Path(temp);atomic(folder/'job.json',job)
            with patch.object(pilot,'verify_resources'),patch.object(pilot,'run_case',side_effect=fake_case),patch.object(pilot,'atomic',side_effect=private_only):
                initial=pilot.execute(folder,job,counter);self.assertEqual(initial['completed_recordings'],1);self.assertEqual(initial['all_planned_word_yield'],0);self.assertGreater(initial['planned_target_words'],initial['metrics']['target_words'])
                first=copy.deepcopy(initial['cases'][0]);stop[0]=False
                final=pilot.execute(folder,job,counter)
            self.assertEqual(final['failed_attempts'],1);self.assertEqual(len(final['attempts']),4);self.assertEqual(final['status'],'pilot_completed_with_alignment_failures')
            self.assertEqual(final['completed_recordings'],3);self.assertEqual(final['cases'][0],first)
            self.assertEqual(called.count(job['cases'][0]['id']),1)
            self.assertTrue(all(final['metrics'][k] is None for k in metrics.ACCURACY_KEYS))
            state=read(folder/'checkpoint.json');state['completed'][0]['metrics']['word_alignment_coverage']=1;atomic(folder/'checkpoint.json',state)
            with patch.object(pilot,'verify_resources'),self.assertRaises(ValueError):pilot.execute(folder,job,counter)

class ReportingTests(unittest.TestCase):
    def test_partial_and_failed_alignment_are_explicit(self):
        row={'alignment_status':'completed','metrics':{'uniquely_aligned_words':2,'word_alignment_coverage':1}}
        self.assertEqual(pilot.outcome([row]*3),'pilot_completed')
        partial={'alignment_status':'partial','metrics':{'uniquely_aligned_words':1,'word_alignment_coverage':.5}}
        self.assertEqual(pilot.outcome([row,row,partial]),'pilot_completed_with_partial_alignment')
        failed={'alignment_status':'failed','metrics':{'uniquely_aligned_words':0,'word_alignment_coverage':0}}
        self.assertEqual(pilot.outcome([row,row,failed]),'pilot_completed_with_alignment_failures')
    def test_monitor_retains_failure_peaks_without_summing_processes(self):
        samples=[{'system':{'available_ram_bytes':100,'commit_headroom_bytes':200},'process':{'peak_working_set_bytes':300,'peak_private_commit_bytes':500},'paging':{'available':False}},
            {'system':{'available_ram_bytes':80,'commit_headroom_bytes':180},'process':{'peak_working_set_bytes':400,'peak_private_commit_bytes':450},'paging':{'available':False}}]
        result=pilot.monitor_summary(samples)
        self.assertEqual(result['peak_resident_bytes'],400);self.assertEqual(result['peak_private_commit_bytes'],500);self.assertEqual(result['minimum_sampled_available_ram_bytes'],80)

if __name__=='__main__':unittest.main()
