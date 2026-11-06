"""Tiny pilot CLI and shared monitored supervisor; entry points enforce scope."""
import argparse
import csv
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid
from pilot_common import ROOT,MANIFEST,RAW,SETTINGS,atomic,read,sha,choose,validate_contract,resume_records
from windows_memory import NativeMemory,PagingCounters,OwnedJob,PressureGuard,gate

REPORT=ROOT/'evaluation/results/phase3_tiny_pilot.json'

def require_scope(model,mode):
    if model!='tiny' or mode!='pilot':raise ValueError('Only the tiny three-record pilot is approved; base.en and corpus runs are disabled')

def make_job():
    m=read(MANIFEST)
    cases=choose([row for row in m['records'] if row['selected']])
    scripts={str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in Path(__file__).parent.glob('*pilot*.py')}
    scripts['evaluation/scripts/windows_memory.py']=sha(Path(__file__).parent/'windows_memory.py')
    return {'contract_version':1,'mode':'pilot','settings':SETTINGS,'manifest_sha256':sha(MANIFEST),
            'cases':cases,'selection':'duration ascending, ID tie-break: ranks 1,50,100; no predictions used',
            'protected_source_sha256':m['protected_source_sha256'],'evaluation_script_sha256':scripts,
            'scope':'tiny only, three cases including longest; no scoring, installs, base.en or full run'}

class RunLock:
    def __enter__(self):
        import msvcrt
        RAW.mkdir(parents=True,exist_ok=True);self.file=(RAW/'.runner.lock').open('a+b')
        self.file.seek(0)
        if not self.file.read(1):self.file.write(b'0');self.file.flush()
        self.file.seek(0)
        try:msvcrt.locking(self.file.fileno(),msvcrt.LK_NBLCK,1)
        except OSError:self.file.close();raise RuntimeError('Another pilot supervisor is active')
        return self
    def __exit__(self,*args):
        import msvcrt
        self.file.seek(0);msvcrt.locking(self.file.fileno(),msvcrt.LK_UNLCK,1);self.file.close()

def summarize(directory,job,checkpoint,decision,status,error,samples,elapsed,report_path=None):
    results=checkpoint.get('completed',[])
    peaks=[r['memory_after']['peak_working_set_bytes'] for r in results]
    for name in ('memory_after_model','memory_after_inference','memory_at_failure'):
        if name in checkpoint:peaks.append(checkpoint[name]['peak_working_set_bytes'])
    peaks.extend(s['process']['peak_working_set_bytes'] for s in samples if s.get('process'))
    valid=[s['paging'] for s in samples if s.get('paging',{}).get('available')]
    paging={name:max((p[name] for p in valid if p.get(name) is not None),default=None) for name in PagingCounters.NAMES}
    summary={'observed_at_utc':datetime.now(timezone.utc).isoformat(),'phase':3,'mode':job['settings']['model'].replace('.','_')+'_pilot_only','status':status,'error':error,
        'run_directory':str(directory.relative_to(ROOT)).replace('\\','/'),'gate':decision,'worker_gate':checkpoint.get('pre_load_gate',checkpoint.get('pre_import_gate')),
        'settings':job['settings'],'manifest_sha256':job['manifest_sha256'],'selected_ids':[r['id'] for r in job['cases']],
        'selected_durations_seconds':[r['duration_seconds'] for r in job['cases']],
        'model_load_attempted':checkpoint.get('model_load_attempted',False),'model_loaded':checkpoint.get('model_loaded',False),
        'inference_attempts':checkpoint.get('inference_attempts',[]),'completed_samples':len(results),'planned_samples':3,
        'model_load_seconds':checkpoint.get('model_load_seconds'),'imports_seconds':checkpoint.get('imports_seconds'),
        'total_supervisor_seconds':elapsed,'total_inference_seconds':sum(r['inference_seconds'] for r in results) if results else None,
        'peak_worker_resident_bytes':max(peaks) if peaks else None,'last_worker_memory':checkpoint.get('memory_after_inference'),
        'minimum_sampled_available_ram_bytes':min((s['system']['available_ram_bytes'] for s in samples),default=None),
        'minimum_sampled_commit_headroom_bytes':min((s['system']['commit_headroom_bytes'] for s in samples),default=None),
        'paging_rate_maxima':paging,'paging_samples_with_valid_rates':len(valid),'monitor_samples':len(samples),
        'paging_limitations':'System-wide hard-read counters include file-backed reads; not pagefile-only faults. Sampling does not measure every transient peak.',
        'sample_results':results,'cached_model':checkpoint.get('cached_model'),'versions':checkpoint.get('versions'),
        'checkpoint_preserved':(directory/'checkpoint.json').is_file(),'corpus_evaluation_run':False,'base_en_run':job['settings']['model']=='base.en' and bool(checkpoint.get('inference_attempts')),'metrics_scored':False,'dependencies_installed':False}
    protected=job['protected_source_sha256'];summary['protected_files_unchanged']=all(sha(ROOT/p)==expected for p,expected in protected.items())
    atomic(directory/'summary.json',summary);atomic(report_path or REPORT,summary)
    if results:
        columns=['id','reference_text','predicted_text','duration_seconds','decode_seconds','inference_seconds','real_time_factor','status','first_call_in_process','source_sha256']
        with (directory/'samples.csv').open('w',encoding='utf-8',newline='') as out:
            writer=csv.DictWriter(out,fieldnames=columns,extrasaction='ignore');writer.writeheader();writer.writerows(results)
    return summary

def execute(directory,job,counters,worker_name="asr_pilot_worker.py",reporter=None):
    report = reporter or summarize
    validate_contract(job)
    for file,expected in job['evaluation_script_sha256'].items():
        if sha(ROOT/file)!=expected:raise ValueError('Evaluation code changed; explicit new run required')
    checkpoint_path=directory/'checkpoint.json';checkpoint=read(checkpoint_path) if checkpoint_path.exists() else {}
    if checkpoint:resume_records(checkpoint,job)
    if checkpoint.get('stage')=='completed':raise ValueError('Pilot already completed; refusing to reload the model')
    decision=gate(counters.system(),job['settings']['model']);atomic(directory/'gate.json',decision)
    if not decision['passed']:
        return report(directory,job,checkpoint,decision,'blocked_memory',None,[],None)
    samples=[];process=None;owned=None;status='failed';error=None;started=time.monotonic();paging=None
    try:
        paging=PagingCounters();pressure=PressureGuard()
        start_file=directory/'start.json'
        if start_file.exists():start_file.unlink()
        env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_HUB_DISABLE_TELEMETRY':'1'}
        owned=OwnedJob();env['SPEAKEASE_EVAL_JOB']=owned.name
        with (directory/'stdout.log').open('ab') as stdout,(directory/'stderr.log').open('ab') as stderr,(directory/'memory_samples.jsonl').open('a',encoding='utf-8') as log:
            process=subprocess.Popen([sys.executable,'-B',str(Path(__file__).with_name(worker_name)),'--job',str(directory/'job.json')],
                cwd=str(ROOT),env=env,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW,shell=False)
            owned.assign(process);atomic(start_file,{'supervisor_pid':os.getpid(),'owned_job_attached':True})
            while process.poll() is None:
                now=time.monotonic();system=counters.system()
                try:checkpoint=read(checkpoint_path)
                except FileNotFoundError:pass
                worker_memory=None
                if checkpoint.get('pid'):
                    try:worker_memory=counters.process(checkpoint['pid'])
                    except OSError:pass
                sample={'elapsed_seconds':now-started,'system':system,'process':worker_memory,'paging':paging.sample(),'stage':checkpoint.get('stage')}
                samples.append(sample);log.write(json.dumps(sample,allow_nan=False)+'\n');log.flush()
                if pressure.update(system,now):raise RuntimeError('Critical memory floor sustained for 5 seconds; stopped only the owned pilot child tree')
                stage_age=now-checkpoint.get('stage_started_monotonic',started)
                if stage_age>(300 if checkpoint.get('stage')=='inference' else 180):raise TimeoutError('Pilot stage timeout: '+str(checkpoint.get('stage')))
                if now-started>(900 if job['mode']=='pilot' else 36000):raise TimeoutError('Pilot total timeout')
                time.sleep(0.5)
            checkpoint=read(checkpoint_path)
            if checkpoint.get('stage')=='blocked_memory':status='blocked_memory'
            elif process.returncode==0 and checkpoint.get('stage')=='completed' and len(checkpoint.get('completed',[]))==len(job['cases']):status='pilot_completed' if job['mode']=='pilot' else 'full_completed'
            else:error=checkpoint.get('error','Worker exited with code '+str(process.returncode))
    except BaseException as exc:
        status='interrupted' if isinstance(exc,KeyboardInterrupt) else 'failed';error=type(exc).__name__+': '+str(exc)
    finally:
        if owned:owned.close()
        if process:
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
        if paging:paging.close()
        if checkpoint_path.exists():checkpoint=read(checkpoint_path)
    return report(directory,job,checkpoint,decision,status,error,samples,time.monotonic()-started)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--model',default='tiny');parser.add_argument('--mode',default='pilot');parser.add_argument('--resume-run',type=Path)
    args=parser.parse_args();require_scope(args.model,args.mode)
    if Path(sys.prefix).resolve()!=(ROOT/'backend/.venv').resolve():raise RuntimeError('Use the existing backend/.venv Python executable')
    counters=NativeMemory()
    with RunLock():
        if args.resume_run:
            directory=args.resume_run.resolve(strict=True)
            if not directory.is_relative_to(RAW.resolve()):raise ValueError('Resume path escaped evaluation pilot data')
            job=read(directory/'job.json')
        else:
            directory=RAW/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'_'+uuid.uuid4().hex[:8]);directory.mkdir()
            job=make_job();atomic(directory/'job.json',job)
        result=execute(directory,job,counters)
    print(json.dumps({key:result[key] for key in ('status','gate','selected_ids','selected_durations_seconds','completed_samples','model_load_attempted','model_loaded','total_inference_seconds','peak_worker_resident_bytes','error')},indent=2))
    return 0 if result['status']=='pilot_completed' else 3
if __name__=='__main__':sys.exit(main())
