"""Offline saved-pilot verification. Never constructs an ASR model."""
import math
from pathlib import Path
from asr_metrics import POLICY,score,aggregate
from pilot_common import ROOT,MANIFEST,TINY_BASELINE,read,sha,settings_for,choose_base,tiny_baseline
from windows_memory import gate

PILOT=ROOT/'evaluation/results/phase3_base_en_pilot.json'

def verify_saved_pilot(check_cache=False):
    report=read(PILOT);directory=(ROOT/report['run_directory']).resolve()
    if not directory.is_relative_to((ROOT/'evaluation/results/raw/asr_pilot_base_en').resolve()):raise ValueError('Pilot path escaped its result directory')
    job=read(directory/'job.json');state=read(directory/'checkpoint.json');raw=read(directory/'summary.json')
    if report!=raw or report.get('status')!='pilot_completed' or state.get('stage')!='completed' or report.get('error') or state.get('error'):
        raise ValueError('Pilot is incomplete or has errors')
    if (directory/'stderr.log').read_text(encoding='utf-8').strip():raise ValueError('Pilot stderr is not empty; review required')
    manifest=read(MANIFEST);tiny=tiny_baseline(manifest);selected=[r for r in manifest['records'] if r['selected']];cases=choose_base(selected)
    if job['cases']!=cases or report['sample_results']!=state['completed'] or len(state['completed'])!=3 or report.get('completed_samples')!=3:
        raise ValueError('Pilot completed cases/checkpoint differ')
    if report['settings']!=settings_for('base.en') or job['settings']!=report['settings'] or state['settings']!=job['settings']:
        raise ValueError('Pilot CPU/int8/two-thread settings differ')
    if report.get('versions')!=tiny.get('versions') or report.get('scoring_policy')!=POLICY or report.get('manifest_sha256')!=sha(MANIFEST):
        raise ValueError('Pilot library versions, scoring or dataset differ from tiny')
    if job['tiny_baseline_sha256']!=sha(TINY_BASELINE) or job['ordered_dataset_ids']!=tiny['selected_ids']:
        raise ValueError('Pilot tiny baseline/order differs')
    scoring='evaluation/scripts/asr_metrics.py'
    if job['evaluation_script_sha256'][scoring]!=sha(ROOT/scoring):raise ValueError('Scoring source changed')
    gates={key:value for key,value in [('supervisor',report['gate']),('pre_import',state['pre_import_gate']),('pre_load',state['pre_load_gate'])]}
    for name,decision in gates.items():
        if decision!=gate(decision['observed'],'base.en') or not decision['passed']:raise ValueError('Pilot memory gate failed: '+name)
    records=state['completed']
    for record,source in zip(records,cases):
        if record.get('status')!='completed' or any(record.get(k)!=source[k] for k in ('id','reference_text','source_sha256','duration_seconds')):
            raise ValueError('Pilot record provenance/status differs')
        if sha(ROOT/source['audio_path'])!=source['source_sha256']:raise ValueError('Pilot source audio changed')
        if record.get('metrics')!=score(source['reference_text'],record['predicted_text']):raise ValueError('Pilot scoring differs')
        if not math.isfinite(record['inference_seconds']) or record['inference_seconds']<0 or not math.isclose(record['real_time_factor'],record['inference_seconds']/source['duration_seconds'],rel_tol=1e-12):
            raise ValueError('Pilot inference timing/RTF invalid')
    seconds=sum(r['inference_seconds'] for r in records);duration=sum(r['duration_seconds'] for r in records)
    if report['metrics']!=aggregate(records) or not math.isclose(seconds,report['total_inference_seconds'],rel_tol=1e-12) or not math.isclose(seconds/duration,report['aggregate_real_time_factor'],rel_tol=1e-12):
        raise ValueError('Pilot aggregate metrics/timing differ')
    if not state.get('warmups') or any(w['id']!=cases[0]['id'] for w in state['warmups']):raise ValueError('Pilot warmup differs')
    import json
    samples=[json.loads(line) for line in (directory/'memory_samples.jsonl').read_text(encoding='utf-8').splitlines() if line.strip()]
    if not samples or len(samples)!=report['monitor_samples']:raise ValueError('Pilot monitor log missing/inconsistent')
    all_start_gates=all(gate(s['system'],'base.en')['passed'] for s in samples)
    all_floors=all(s['system']['available_ram_bytes']>=256*1024**2 and s['system']['commit_headroom_bytes']>=512*1024**2 for s in samples)
    if not all_start_gates or not all_floors:raise ValueError('Pilot had sampled memory-threshold violations')
    memory=[s['process'] for s in samples if s.get('process')]+[r['memory_after'] for r in records]+[w['memory_after'] for w in state['warmups']]
    memory += [state[k] for k in ('memory_before_model','memory_after_model','memory_after_inference') if k in state]
    peak_ws=max(m['peak_working_set_bytes'] for m in memory);peak_commit=max(m['peak_private_commit_bytes'] for m in memory)
    if peak_ws!=report['peak_worker_resident_bytes']:raise ValueError('Pilot resident peak differs')
    if report['cached_model']!=job['cached_model'] or state['cached_model']!=job['cached_model']:raise ValueError('Pilot model provenance differs')
    if check_cache:
        from asr_pilot_worker import cached_snapshot
        if cached_snapshot('base.en')[1]!=job['cached_model']:raise ValueError('Current base.en cache differs from successful pilot')
    return {'status':'PASS','pilot_sha256':sha(PILOT),'pilot_run_directory':report['run_directory'],'completed_samples':3,
        'all_gate_checks_passed':True,'all_sampled_memory_thresholds_passed':all_start_gates,'all_operating_floors_passed':all_floors,
        'error':None,'stderr_bytes':(directory/'stderr.log').stat().st_size,'peak_resident_bytes':peak_ws,
        'peak_private_commit_bytes':peak_commit,'final_private_commit_bytes':state['memory_after_inference']['private_commit_bytes'],
        'total_inference_seconds':seconds,'aggregate_real_time_factor':seconds/duration,'model_load_seconds':state['model_load_seconds'],
        'warmups_excluded':len(state['warmups']),'sampled_available_ram_min_bytes':min(s['system']['available_ram_bytes'] for s in samples),
        'sampled_commit_headroom_min_bytes':min(s['system']['commit_headroom_bytes'] for s in samples),'monitor_samples':len(samples),
        'paging_rate_maxima':report['paging_rate_maxima'],'paging_note':'System-wide sampled rates include file-backed reads; not proof of pagefile-only activity. Sampling may miss brief system-memory dips.',
        'per_sample':[{'id':r['id'],'inference_seconds':r['inference_seconds'],'real_time_factor':r['real_time_factor']} for r in records],
        'settings_match_tiny_except_model':True,'scoring_and_versions_match_tiny':True,'current_cached_files_verified':check_cache,
        'verification_executed_inference':False}
