"""Read-only validation of the completed pilot; no model imports or inference."""
import json
from collections import Counter
from phase4_common import OUT,ROOT,read,sha,validate_job,verify_resources,alignment_gate
from phase4_metrics import evaluate,aggregate,ACCURACY_KEYS
from phase4_pilot import monitor_summary

PILOT=OUT/'runs/20261105T183320Z_92738270'

def segments(samples):
    groups=[[]]
    for sample in samples:
        if groups[-1] and sample['elapsed_seconds']<groups[-1][-1]['elapsed_seconds']:groups.append([])
        groups[-1].append(sample)
    return groups

def verify_pilot(directory=PILOT):
    directory=directory.resolve();job=read(directory/'job.json');checkpoint=read(directory/'checkpoint.json');summary=read(directory/'summary.json')
    validate_job(job);verify_resources(job['resources'])
    if not job['performance_only'] or summary['status']!='pilot_completed' or summary['error'] is not None:raise ValueError('Successful performance pilot required')
    if checkpoint['job_sha256']!=sha(directory/'job.json') or checkpoint['completed']!=summary['cases'] or checkpoint['status']!='pilot_completed':raise ValueError('Pilot checkpoint differs')
    ids=[r['id'] for r in job['cases']]
    if [r['recording_id'] for r in summary['cases']]!=ids or len(set(ids))!=3:raise ValueError('Pilot duplicate/order differs')
    successes=Counter(a['recording_id'] for a in summary['attempts'] if a['status']=='completed')
    if successes!=Counter(ids):raise ValueError('Duplicate/missing successful attempts')
    cases=[]
    for row,result in zip(job['cases'],summary['cases']):
        folder=directory/row['id'];raw=read(folder/'result.json');state=read(folder/'state.json')
        if read(folder/'evaluation.json')!=result or result['reference_text']!=row['reference_text'] or raw['report']['transcript']!=row['reference_text'] or raw['source_sha256']!=row['source_sha256']:raise ValueError('Pilot input/evidence differs')
        if result['words']!=raw['report']['runs'][0]['words'] or result['status']!='completed' or state['stage']!='completed':raise ValueError('Pilot result incomplete')
        metrics=evaluate(row['id'],row['reference_text'],result['words'],job['annotations'][row['id']],row['duration_seconds'],allow_accuracy=False)
        if metrics!=result['metrics'] or metrics['word_alignment_coverage']!=1 or any(metrics[k] is not None for k in ACCURACY_KEYS):raise ValueError('Pilot metrics differ')
        gates=[result['gate'],state['pre_import_gate'],state['pre_model_gate']]
        if any(g!=alignment_gate(g['observed']) or not g['passed'] for g in gates):raise ValueError('Pilot admission gate violation')
        samples=[json.loads(line) for line in (folder/'memory_samples.jsonl').read_text().splitlines()]
        groups=segments(samples);latest=groups[-1]
        monitor=monitor_summary(latest,[raw['memory_after']])
        if any(result[k]!=v for k,v in monitor.items()):raise ValueError('Pilot monitor differs')
        critical=sum(s['system']['available_ram_bytes']<256*1024**2 or s['system']['commit_headroom_bytes']<512*1024**2 for s in samples)
        if critical or result['supervised_seconds']>job['case_timeout_seconds']:raise ValueError('Pilot critical floor/timeout')
        if result['alignment_real_time_factor']!=result['alignment_seconds']/row['duration_seconds']:raise ValueError('Pilot RTF differs')
        cases.append({'recording_id':row['id'],'duration_seconds':row['duration_seconds'],'coverage':metrics['word_alignment_coverage'],'aligned_words':metrics['uniquely_aligned_words'],
            **{k:result[k] for k in ('alignment_seconds','alignment_real_time_factor','supervised_seconds','model_load_seconds','runtime_import_seconds')},**monitor,
            'admission_gates':gates,'log_segments':len(groups),'critical_floor_samples':critical,'stderr_bytes':(folder/'stderr.log').stat().st_size,
            'history_segments':[{'samples':len(g),'minimum_ram_bytes':min(s['system']['available_ram_bytes'] for s in g),'minimum_commit_headroom_bytes':min(s['system']['commit_headroom_bytes'] for s in g),
                'paging':monitor_summary(g)['paging_rate_maxima'],'pids':sorted({s['process']['pid'] for s in g if s.get('process')})} for g in groups]})
    if summary['metrics']!=aggregate([r['metrics'] for r in summary['cases']]):raise ValueError('Pilot aggregate differs')
    protected=job['protected_source_sha256']
    if any(sha(ROOT/name)!=digest for name,digest in protected.items()):raise ValueError('Protected source/data changed')
    frozen={str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in directory.rglob('*') if p.is_file()}
    return {'status':'verified','run_directory':str(directory.relative_to(ROOT)).replace('\\','/'),'cases':cases,'metrics':summary['metrics'],
        'attempts':summary['attempts'],'total_alignment_seconds':summary['total_alignment_seconds'],'aggregate_alignment_rtf':summary['aggregate_alignment_rtf'],
        'protected_files_verified':len(protected),'pilot_files_sha256':frozen,'inference_during_verification':False,
        'interruption':'Retained attempt records show blocked_memory before model loading. The first third-case monitor segment has RAM below 2 GiB and commit above 3 GiB throughout. Exact failed gate/state was overwritten on resume; prior inspection recorded RAM 1.491905 GiB and commit 10.840775 GiB. No timeout or model failure is evidenced.'}
