"""Manually invoked tiny-only evaluation. No downloads, installs or base.en."""
import argparse
import csv
import platform
import sys
from pathlib import Path
import asr_pilot as pilot
from asr_pilot_worker import cached_snapshot
from asr_metrics import POLICY,score,aggregate
from pilot_common import ROOT,MANIFEST,SETTINGS,read,sha,atomic,resume_records
from windows_memory import NativeMemory

RAW=ROOT/'evaluation/results/raw/asr_full_tiny'
DIRECTORY=RAW/'seed42'

def make_job():
    manifest=read(MANIFEST)
    job=pilot.make_job()
    job.update(mode='full',cases=[r for r in manifest['records'] if r['selected']],
        selection='Frozen verified seed42 manifest order; all 100 selected recordings',
        scope='100 measured tiny recordings, one excluded warmup per process; base.en disabled',
        scoring_policy=POLICY,python_version=sys.version,platform=platform.platform(),
        cached_model=cached_snapshot()[1],warmup='first manifest recording; excluded; repeated after resume')
    job['evaluation_script_sha256']={str(p.relative_to(ROOT)).replace('\\','/'):sha(p)
        for p in Path(__file__).parent.glob('*.py')}
    return job

def summarize(directory,job,checkpoint,decision,status,error,samples,elapsed):
    # Reuse native monitoring summary, preserving the historical pilot report.
    old=pilot.REPORT;pilot.REPORT=ROOT/'evaluation/results/phase3_tiny_full.json'
    try:summary=pilot.summarize(directory,job,checkpoint,decision,status,error,samples,elapsed)
    finally:pilot.REPORT=old
    records=checkpoint.get('completed',[])
    for record in records:record['metrics']=score(record['reference_text'],record['predicted_text'])
    duration=sum(r['duration_seconds'] for r in records)
    prior=[]
    if (directory/'memory_samples.jsonl').exists():
        import json
        for line in (directory/'memory_samples.jsonl').read_text(encoding='utf-8').splitlines():
            try:prior.append(json.loads(line))
            except json.JSONDecodeError:pass  # Interrupted final log write only.
    peaks=[s['process']['peak_working_set_bytes'] for s in prior if s.get('process')]
    peaks += [r['memory_after']['peak_working_set_bytes'] for r in records]
    peaks += [w['memory_after']['peak_working_set_bytes'] for w in checkpoint.get('warmups',[])]
    if summary['peak_worker_resident_bytes'] is not None:peaks.append(summary['peak_worker_resident_bytes'])
    if prior:
        summary['minimum_sampled_available_ram_bytes']=min(s['system']['available_ram_bytes'] for s in prior)
        summary['minimum_sampled_commit_headroom_bytes']=min(s['system']['commit_headroom_bytes'] for s in prior)
        valid=[s['paging'] for s in prior if s.get('paging',{}).get('available')]
        summary['paging_rate_maxima']={k:max((v[k] for v in valid if v.get(k) is not None),default=None) for k in pilot.PagingCounters.NAMES}
        summary['paging_samples_with_valid_rates']=len(valid);summary['monitor_samples']=len(prior)
    summary.update(mode='tiny_full',planned_samples=100,corpus_evaluation_run=True,
        metrics_scored=bool(records),metrics=aggregate(records),scoring_policy=POLICY,
        aggregate_real_time_factor=sum(r['inference_seconds'] for r in records)/duration if duration else None,
        measured_audio_seconds=duration,warmups=checkpoint.get('warmups',[]),
        peak_worker_resident_bytes=max(peaks) if peaks else None,
        reproducibility=job,metrics_complete=len(records)==100,
        timing_note='Inference includes VAD/recognition; excludes decode, model load and warmup. First measured call follows warmup.')
    atomic(directory/'summary.json',summary);atomic(ROOT/'evaluation/results/phase3_tiny_full.json',summary)
    if records:
        with (directory/'metrics.csv').open('w',encoding='utf-8',newline='') as out:
            columns=['id','inference_seconds','duration_seconds','wer','cer','substitutions','deletions','insertions']
            writer=csv.DictWriter(out,fieldnames=columns);writer.writeheader()
            for r in records:
                w=r['metrics']['words'];writer.writerow(dict(id=r['id'],inference_seconds=r['inference_seconds'],
                    duration_seconds=r['duration_seconds'],wer=w['rate'],cer=r['metrics']['characters']['rate'],
                    **{k:w[k] for k in ('substitutions','deletions','insertions')}))
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--model',choices=['tiny'],required=True)
    parser.parse_args()
    if Path(sys.prefix).resolve()!=(ROOT/'backend/.venv').resolve():raise RuntimeError('Existing backend venv required')
    # Same OS lock as pilot: never overlap these supervisors.
    with pilot.RunLock():
        DIRECTORY.mkdir(parents=True,exist_ok=True);path=DIRECTORY/'job.json'
        job=read(path) if path.exists() else make_job()
        if job.get('mode')!='full' or job.get('scoring_policy')!=POLICY:raise ValueError('Full contract differs')
        if cached_snapshot()[1]!=job['cached_model']:raise ValueError('Cached model changed')
        if not path.exists():atomic(path,job)
        cp=DIRECTORY/'checkpoint.json'
        pilot.validate_contract(job)
        for file,expected in job['evaluation_script_sha256'].items():
            if sha(ROOT/file)!=expected:raise ValueError('Evaluation code changed; resume refused')
        if cp.exists():
            state=read(cp);resume_records(state,job)
            for r in state['completed']:
                if r.get('metrics')!=score(r['reference_text'],r['predicted_text']):raise ValueError('Checkpoint metrics differ')
            if state.get('stage')=='completed':
                pilot.validate_contract(job)
                print('Already completed; see evaluation/results/phase3_tiny_full.json');return 0
        print('Run/checkpoints: '+str(DIRECTORY),flush=True)
        result=pilot.execute(DIRECTORY,job,NativeMemory(),worker_name='asr_full_worker.py',reporter=summarize)
        print(result['status'],result['completed_samples'],'/ 100',result['error'])
        return 0 if result['status']=='full_completed' else 3

if __name__=='__main__':raise SystemExit(main())
