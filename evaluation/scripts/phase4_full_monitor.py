"""Serialized cold-child monitoring; one immutable folder per attempt."""
import json
import os
from pathlib import Path
import subprocess
import time
from phase4_common import ROOT,ALIGN_PYTHON,alignment_gate,read,atomic
from phase4_pilot import monitor_summary
from phase4_metrics import evaluate
from windows_memory import OwnedJob,PagingCounters,PressureGuard

def run_case(folder,job,row,counters):
    decision=alignment_gate(counters.system());atomic(folder/'gate.json',decision)
    if not decision['passed']:
        result={'status':'blocked_memory','recording_id':row['id'],'error':'Supervisor admission gate failed','gate':decision}
        atomic(folder/'outcome.json',result);return result
    process=None;owned=None;paging=None;samples=[];started=time.monotonic();failure=None;interrupted=False
    try:
        owned=OwnedJob();paging=PagingCounters();pressure=PressureGuard()
        env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_HUB_DISABLE_TELEMETRY':'1','SPEAKEASE_EVAL_JOB':owned.name}
        with (folder/'stdout.log').open('xb') as stdout,(folder/'stderr.log').open('xb') as stderr,(folder/'memory_samples.jsonl').open('x',encoding='utf-8') as log:
            process=subprocess.Popen([str(ALIGN_PYTHON),'-B',str(Path(__file__).with_name('phase4_full_worker.py')),'--job',str(folder/'job.json'),'--recording-id',row['id']],cwd=str(ROOT),env=env,stdout=stdout,stderr=stderr,shell=False,creationflags=subprocess.CREATE_NO_WINDOW)
            owned.assign(process);atomic(folder/'start.json',{'supervisor_pid':os.getpid()})
            while process.poll() is None:
                now=time.monotonic();system=counters.system();state=read(folder/'state.json') if (folder/'state.json').exists() else {};memory=None
                if state.get('pid'):
                    try:memory=counters.process(state['pid'])
                    except OSError:pass
                sample={'elapsed_seconds':now-started,'system':system,'process':memory,'stage':state.get('stage'),'paging':paging.sample()};samples.append(sample)
                log.write(json.dumps(sample,allow_nan=False)+'\n');log.flush()
                if pressure.update(system,now):raise RuntimeError('Critical RAM/commit floor for five seconds')
                if now-started>job['case_timeout_seconds']:raise TimeoutError('Alignment worker timeout')
                time.sleep(job['sampling_interval_seconds'])
            state=read(folder/'state.json')
            if process.returncode!=0 or state.get('stage')!='completed':failure=state.get('error','Alignment worker exited '+str(process.returncode))
    except BaseException as exc:
        interrupted=isinstance(exc,KeyboardInterrupt);failure=type(exc).__name__+': '+str(exc)
    finally:
        if owned:owned.close()
        if process:
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
        if paging:paging.close()
    elapsed=time.monotonic()-started;state=read(folder/'state.json') if (folder/'state.json').exists() else {}
    if failure:
        result={'status':'interrupted' if interrupted else 'blocked_memory' if state.get('stage')=='blocked_memory' else 'failed',
            'recording_id':row['id'],'error':failure,'gate':decision,'worker_state':state,'supervised_seconds':elapsed,**monitor_summary(samples)}
        atomic(folder/'outcome.json',result);return result
    raw=read(folder/'result.json');run=raw['report']['runs'][0]
    if raw['reference_text']!=row['reference_text'] or raw['source_sha256']!=row['source_sha256'] or raw['report']['transcript']!=row['reference_text']:raise ValueError('Worker result input differs')
    result={**raw,'status':'completed','gate':decision,'worker_state':state,'alignment_status':run['alignment_status'],'words':run['words'],'unaligned_words':run['unaligned_words'],
        'metrics':evaluate(row['id'],row['reference_text'],run['words'],job['annotations'][row['id']],row['duration_seconds'],allow_accuracy=False),
        'alignment_seconds':run['alignment_seconds'],'alignment_real_time_factor':run['alignment_seconds']/row['duration_seconds'],
        'supervised_seconds':elapsed,'supervised_real_time_factor':elapsed/row['duration_seconds'],**monitor_summary(samples,[raw['memory_after']])}
    atomic(folder/'evaluation.json',result);atomic(folder/'outcome.json',result);return result
