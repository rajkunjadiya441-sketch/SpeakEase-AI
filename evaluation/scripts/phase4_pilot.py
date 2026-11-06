"""Manual three-recording alignment pilot. No ASR or full evaluation entry point."""
import argparse
from contextlib import contextmanager
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid
from phase4_common import OUT,ROOT,ALIGN_PYTHON,ANNOTATIONS,alignment_gate,make_job,validate_job,verify_resources,read,sha,atomic
from phase4_metrics import evaluate,aggregate,token
from windows_memory import NativeMemory,PagingCounters,PressureGuard,OwnedJob

@contextmanager
def lock():
    import msvcrt
    OUT.mkdir(parents=True,exist_ok=True)
    with (OUT/'.worker.lock').open('a+b') as handle:
        handle.seek(0)
        if not handle.read(1):handle.write(b'0');handle.flush()
        handle.seek(0);msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
        try:yield
        finally:handle.seek(0);msvcrt.locking(handle.fileno(),msvcrt.LK_UNLCK,1)

def monitor_summary(samples,extra=()):
    memories=[s['process'] for s in samples if s.get('process')]+list(extra)
    valid=[s['paging'] for s in samples if s.get('paging',{}).get('available')]
    return {'peak_resident_bytes':max((m['peak_working_set_bytes'] for m in memories),default=None),
        'peak_private_commit_bytes':max((m['peak_private_commit_bytes'] for m in memories),default=None),
        'minimum_sampled_available_ram_bytes':min((s['system']['available_ram_bytes'] for s in samples),default=None),
        'minimum_sampled_commit_headroom_bytes':min((s['system']['commit_headroom_bytes'] for s in samples),default=None),
        'paging_rate_maxima':{key:max((p[key] for p in valid if p.get(key) is not None),default=None) for key in PagingCounters.NAMES}}

def outcome(completed):
    if len(completed)!=3:return 'blocked_or_failed'
    if any(r['alignment_status']=='failed' or r['metrics']['uniquely_aligned_words']==0 for r in completed):return 'pilot_completed_with_alignment_failures'
    if any(r['alignment_status']=='partial' or r['metrics']['word_alignment_coverage']<1 for r in completed):return 'pilot_completed_with_partial_alignment'
    return 'pilot_completed'

def run_case(directory,job,row,counters):
    validate_job(job);folder=directory/row['id'];folder.mkdir(exist_ok=True)
    decision=alignment_gate(counters.system());atomic(folder/'gate.json',decision)
    if not decision['passed']:return {'status':'blocked_memory','recording_id':row['id'],'gate':decision}
    process=None;owned=None;paging=None;samples=[];started=time.monotonic();failure=None
    try:
        owned=OwnedJob();paging=PagingCounters();pressure=PressureGuard()
        start_file=folder/'start.json'
        if start_file.exists():start_file.unlink()
        env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_HUB_DISABLE_TELEMETRY':'1','SPEAKEASE_EVAL_JOB':owned.name}
        with (folder/'stdout.log').open('ab') as stdout,(folder/'stderr.log').open('ab') as stderr,(folder/'memory_samples.jsonl').open('a',encoding='utf-8') as monitor:
            process=subprocess.Popen([str(ALIGN_PYTHON),'-B',str(Path(__file__).with_name('phase4_worker.py')),'--job',str(directory/'job.json'),'--recording-id',row['id']],
                cwd=str(ROOT),env=env,stdout=stdout,stderr=stderr,shell=False,creationflags=subprocess.CREATE_NO_WINDOW)
            owned.assign(process);atomic(start_file,{'supervisor_pid':os.getpid()})
            while process.poll() is None:
                now=time.monotonic();system=counters.system();state=read(folder/'state.json') if (folder/'state.json').exists() else {}
                memory=None
                if state.get('pid'):
                    try:memory=counters.process(state['pid'])
                    except OSError:pass
                sample={'elapsed_seconds':now-started,'system':system,'process':memory,'stage':state.get('stage'),'paging':paging.sample()};samples.append(sample)
                monitor.write(json.dumps(sample,allow_nan=False)+'\n');monitor.flush()
                if pressure.update(system,now):raise RuntimeError('Critical RAM/commit floor for five seconds')
                if now-started>job['case_timeout_seconds']:raise TimeoutError('Alignment worker timeout')
                time.sleep(job['sampling_interval_seconds'])
            state=read(folder/'state.json')
            if process.returncode!=0 or state.get('stage')!='completed':failure=state.get('error','Alignment worker exited '+str(process.returncode))
    except BaseException as exc:failure=type(exc).__name__+': '+str(exc)
    finally:
        if owned:owned.close()
        if process:
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
        if paging:paging.close()
    elapsed=time.monotonic()-started
    state=read(folder/'state.json') if (folder/'state.json').exists() else {}
    if failure:return {'status':'blocked_memory' if state.get('stage')=='blocked_memory' else 'failed','recording_id':row['id'],'error':failure,'gate':decision,'supervised_seconds':elapsed,**monitor_summary(samples)}
    raw=read(folder/'result.json');run=raw['report']['runs'][0]
    if raw['reference_text']!=row['reference_text'] or raw['source_sha256']!=row['source_sha256']:raise ValueError('Worker result input differs')
    metrics=evaluate(row['id'],row['reference_text'],run['words'],job['annotations'][row['id']],row['duration_seconds'],allow_accuracy=not job['performance_only'])
    result={**raw,'status':'completed','gate':decision,'worker_state':state,'alignment_status':run['alignment_status'],'words':run['words'],'unaligned_words':run['unaligned_words'],
        'metrics':metrics,'alignment_seconds':run['alignment_seconds'],'alignment_real_time_factor':run['alignment_seconds']/row['duration_seconds'],
        'supervised_seconds':elapsed,'supervised_real_time_factor':elapsed/row['duration_seconds'],**monitor_summary(samples,[raw['memory_after']])}
    atomic(folder/'evaluation.json',result);return result

def execute(directory,job,counters):
    validate_job(job);verify_resources(job['resources'])
    path=directory/'checkpoint.json';state=read(path) if path.exists() else {'job_sha256':sha(directory/'job.json'),'completed':[]}
    if state.get('job_sha256')!=sha(directory/'job.json'):raise ValueError('Checkpoint job differs')
    completed=state['completed']
    if [r['recording_id'] for r in completed]!=[r['id'] for r in job['cases'][:len(completed)]] or len(completed)>3:raise ValueError('Checkpoint prefix differs')
    for saved,row in zip(completed,job['cases']):
        evidence=read(directory/row['id']/'evaluation.json')
        if saved!=evidence or saved.get('status')!='completed' or saved.get('reference_text')!=row['reference_text'] or saved.get('source_sha256')!=row['source_sha256']:
            raise ValueError('Checkpoint result differs from saved evidence/input')
        recomputed=evaluate(row['id'],row['reference_text'],saved['words'],job['annotations'][row['id']],row['duration_seconds'],allow_accuracy=not job['performance_only'])
        if recomputed!=saved['metrics']:raise ValueError('Checkpoint metrics differ')
    if str(state.get('status','')).startswith('pilot_completed'):raise ValueError('Pilot already completed; no automatic rerun')
    for relative,expected in job['protected_source_sha256'].items():
        if sha(ROOT/relative)!=expected:raise ValueError('Protected earlier data/source changed')
    failure=None;attempts=state.get('attempts',[])
    for row in job['cases'][len(completed):]:
        result=run_case(directory,job,row,counters)
        attempts.append({key:result.get(key) for key in ('recording_id','status','error','supervised_seconds','alignment_seconds','peak_resident_bytes','peak_private_commit_bytes')})
        state['attempts']=attempts;atomic(path,state)
        if result['status']!='completed':failure=result;break
        completed.append(result);state.update(completed=completed,status='in_progress');atomic(path,state)
        print(row['id']+': '+result['alignment_status'],flush=True)
    summary={'phase':4,'status':outcome(completed),'performance_only':job['performance_only'],'error':failure,
        'run_directory':str(directory.relative_to(ROOT)).replace('\\','/'),'completed_recordings':len(completed),'planned_recordings':3,
        'metrics':aggregate([r['metrics'] for r in completed]),'cases':completed,'job':job,
        'total_alignment_seconds':sum(r['alignment_seconds'] for r in completed) if completed else None,
        'aggregate_alignment_rtf':sum(r['alignment_seconds'] for r in completed)/sum(r['duration_seconds'] for r in completed) if completed else None,
        'peak_resident_bytes':max((r['peak_resident_bytes'] for r in completed),default=None),
        'peak_private_commit_bytes':max((r['peak_private_commit_bytes'] for r in completed),default=None),
        'attempts':attempts,'failed_attempts':sum(a['status']!='completed' for a in attempts),
        'alignment_status_counts':{s:sum(r['alignment_status']==s for r in completed) for s in ('completed','partial','failed')}}
    summary['coverage_scope']='successfully processed recordings; failures and unattempted cases reported separately'
    summary['planned_target_words']=sum(bool(token(word)) for row in job['cases'] for word in row['reference_text'].split())
    summary['all_planned_word_yield']=summary['metrics']['uniquely_aligned_words']/summary['planned_target_words'] if summary['planned_target_words'] else None
    summary['peak_resident_bytes']=max((a['peak_resident_bytes'] for a in attempts if a.get('peak_resident_bytes') is not None),default=summary['peak_resident_bytes'])
    summary['peak_private_commit_bytes']=max((a['peak_private_commit_bytes'] for a in attempts if a.get('peak_private_commit_bytes') is not None),default=summary['peak_private_commit_bytes'])
    state.update(status=summary['status'],completed=completed,error=failure);atomic(path,state)
    atomic(directory/'summary.json',summary);atomic(OUT/'pilot_result.json',summary)
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--performance-only',action='store_true');parser.add_argument('--annotations',type=Path,default=ANNOTATIONS);parser.add_argument('--resume-run',type=Path);args=parser.parse_args()
    if Path(sys.prefix).resolve()!=(ROOT/'backend/.venv').resolve():raise RuntimeError('Use the existing backend Python for supervision; child uses alignment/.venv')
    with lock():
        if args.resume_run:
            directory=args.resume_run.resolve(strict=True)
            if not directory.is_relative_to((OUT/'runs').resolve()):raise ValueError('Resume path escaped Phase 4')
            job=read(directory/'job.json')
        else:
            job=make_job(args.performance_only,args.annotations)
            directory=OUT/'runs'/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'_'+uuid.uuid4().hex[:8]);directory.mkdir(parents=True);atomic(directory/'job.json',job)
        result=execute(directory,job,NativeMemory())
    print(result['status'],result['completed_recordings'],'/ 3; accuracy:',result['metrics']['accuracy_scope'])
    return 0 if result['status'] in ('pilot_completed','pilot_completed_with_partial_alignment') else 3
if __name__=='__main__':raise SystemExit(main())
