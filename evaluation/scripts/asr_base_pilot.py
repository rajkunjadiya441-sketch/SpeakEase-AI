"""Manual base.en pilot preparation/execution only; full evaluation is disabled."""
import argparse
import csv
from datetime import datetime,timezone
from pathlib import Path
import platform
import sys
import uuid
import asr_pilot as pilot
from asr_pilot_worker import cached_snapshot
from asr_metrics import POLICY,score,aggregate
from pilot_common import ROOT,MANIFEST,BASE_RAW,TINY_BASELINE,read,sha,atomic,choose_base,settings_for,tiny_baseline,validate_contract
from windows_memory import NativeMemory

REPORT=ROOT/'evaluation/results/phase3_base_en_pilot.json'

def require_scope(model,mode):
    if model!='base.en' or mode!='pilot':raise ValueError('Only a three-recording base.en pilot is prepared; full evaluation is not approved')

def make_job():
    manifest=read(MANIFEST);tiny_baseline(manifest)
    selected=[row for row in manifest['records'] if row['selected']]
    job=pilot.make_job()
    job.update(settings=settings_for('base.en'),cases=choose_base(selected),
        selection='First manifest record, shortest and longest, in original manifest order',
        scope='Three measured base.en recordings plus one excluded warmup on first record; no full evaluation',
        ordered_dataset_ids=[row['id'] for row in selected],tiny_baseline_sha256=sha(TINY_BASELINE),
        score_pilot=True,scoring_policy=POLICY,warmup='first manifest recording; excluded; repeated after resume',
        cached_model=cached_snapshot('base.en')[1],python_version=sys.version,platform=platform.platform())
    job['evaluation_script_sha256']={str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in Path(__file__).parent.glob('*.py')}
    validate_contract(job)
    return job

def summarize(directory,job,checkpoint,decision,status,error,samples,elapsed,report_path=None):
    # Explicit output path: never temporarily overwrite a completed model summary.
    if job['mode']=='full' and report_path is None:raise ValueError('Full base.en summary requires a separate output path')
    target=report_path or REPORT
    summary=pilot.summarize(directory,job,checkpoint,decision,status,error,samples,elapsed,report_path=target)
    records=checkpoint.get('completed',[])
    for record in records:record['metrics']=score(record['reference_text'],record['predicted_text'])
    duration=sum(r['duration_seconds'] for r in records)
    prior=[]
    if (directory/'memory_samples.jsonl').exists():
        import json
        for line in (directory/'memory_samples.jsonl').read_text(encoding='utf-8').splitlines():
            try:prior.append(json.loads(line))
            except json.JSONDecodeError:pass
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
    summary.update(mode='base_full' if job['mode']=='full' else 'base_en_pilot',planned_samples=len(job['cases']),corpus_evaluation_run=job['mode']=='full',metrics_scored=bool(records),metrics=aggregate(records),scoring_policy=POLICY,
        aggregate_real_time_factor=sum(r['inference_seconds'] for r in records)/duration if duration else None,
        measured_audio_seconds=duration,warmups=checkpoint.get('warmups',[]),peak_worker_resident_bytes=max(peaks) if peaks else None,
        reproducibility=job,pilot_metrics_complete=job['mode']=='pilot' and len(records)==3,metrics_complete=job['mode']=='full' and len(records)==100,
        comparison_scope='Frozen 100-file base.en evaluation' if job['mode']=='full' else 'Three-file pilot only; not the 100-file tiny/base.en comparison',
        timing_note='Same as tiny full run: inference includes VAD/recognition; excludes decode, model load and warmup.')
    memory=[s['process'] for s in prior if s.get('process')]+[r['memory_after'] for r in records]+[w['memory_after'] for w in checkpoint.get('warmups',[])]
    memory += [checkpoint[k] for k in ('memory_after_model','memory_after_inference') if k in checkpoint]
    summary['peak_private_commit_bytes']=max((m.get('peak_private_commit_bytes',0) for m in memory),default=0) or None
    atomic(directory/'summary.json',summary);atomic(target,summary)
    if records:
        with (directory/'metrics.csv').open('w',encoding='utf-8',newline='') as out:
            columns=['id','inference_seconds','duration_seconds','wer','cer','substitutions','deletions','insertions']
            writer=csv.DictWriter(out,fieldnames=columns);writer.writeheader()
            for r in records:
                words=r['metrics']['words'];writer.writerow(dict(id=r['id'],inference_seconds=r['inference_seconds'],duration_seconds=r['duration_seconds'],
                    wer=words['rate'],cer=r['metrics']['characters']['rate'],**{k:words[k] for k in ('substitutions','deletions','insertions')}))
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model',choices=['base.en'],required=True);parser.add_argument('--mode',choices=['pilot'],default='pilot')
    parser.add_argument('--resume-run',type=Path);args=parser.parse_args();require_scope(args.model,args.mode)
    if Path(sys.prefix).resolve()!=(ROOT/'backend/.venv').resolve():raise RuntimeError('Existing backend/.venv Python executable required')
    with pilot.RunLock():
        if args.resume_run:
            directory=args.resume_run.resolve(strict=True)
            if not directory.is_relative_to(BASE_RAW.resolve()):raise ValueError('Resume path escaped the base.en pilot tree')
            job=read(directory/'job.json');validate_contract(job)
            if job['settings']['model']!='base.en':raise ValueError('base.en pilot job required')
        else:
            directory=BASE_RAW/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'_'+uuid.uuid4().hex[:8]);directory.mkdir(parents=True)
            job=make_job();atomic(directory/'job.json',job)
        print('base.en pilot checkpoints: '+str(directory),flush=True)
        result=pilot.execute(directory,job,NativeMemory(),worker_name='asr_base_pilot_worker.py',reporter=summarize)
    print(result['status'],result['completed_samples'],'/ 3',result['error'])
    return 0 if result['status']=='pilot_completed' else 3
if __name__=='__main__':raise SystemExit(main())
