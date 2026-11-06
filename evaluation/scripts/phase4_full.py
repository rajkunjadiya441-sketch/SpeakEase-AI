"""Resumable fixed25 performance-only benchmark. Manual approval required."""
import argparse
from datetime import datetime,timezone
from pathlib import Path
import sys
import uuid
from phase4_common import ROOT,OUT,atomic,read,sha
from phase4_full_common import FULL,RESULT,make_full_job,validate_full_job,validate_result
from phase4_full_monitor import run_case
from phase4_pilot import lock
from phase4_metrics import aggregate,token
from windows_memory import NativeMemory

def attempt_folder(directory,entry):
    folder=(directory/entry['attempt_path']).resolve()
    if not folder.is_relative_to((directory/'attempts').resolve()):raise ValueError('Attempt path escaped benchmark')
    return folder

def evidence(directory,entry,row,job):
    folder=attempt_folder(directory,entry);result=read(folder/'evaluation.json');validate_result(result,row,job)
    if sha(folder/'job.json')!=sha(directory/'job.json'):raise ValueError('Attempt job differs')
    raw=read(folder/'result.json');state=read(folder/'state.json')
    if raw['reference_text']!=row['reference_text'] or raw['source_sha256']!=row['source_sha256'] or raw['report']['transcript']!=row['reference_text'] or raw['report']['runs'][0]['words']!=result['words'] or state!=result['worker_state'] or state['stage']!='completed':raise ValueError('Attempt evidence differs')
    return result

def summary_of(directory,job,state,failure=None):
    cases=[c['result'] for c in state['completed']];done=len(cases)==25
    status='full_completed' if done else 'blocked_or_failed'
    if done and any(c['alignment_status']=='failed' or c['metrics']['uniquely_aligned_words']==0 for c in cases):status='full_completed_with_alignment_failures'
    elif done and any(c['metrics']['word_alignment_coverage']<1 for c in cases):status='full_completed_with_partial_alignment'
    duration=sum(c['duration_seconds'] for c in cases);seconds=sum(c['alignment_seconds'] for c in cases);supervised=sum(c['supervised_seconds'] for c in cases)
    targets=sum(bool(token(w)) for r in job['cases'] for w in r['reference_text'].split());metrics=aggregate([c['metrics'] for c in cases])
    peaks={k:max((a.get(k) for a in state['attempts'] if a.get(k) is not None),default=None) for k in ('peak_resident_bytes','peak_private_commit_bytes')}
    return {'phase':4,'mode':'full25','performance_only':True,'status':status,'completed_recordings':len(cases),'planned_recordings':25,'error':failure,
        'run_directory':str(directory.relative_to(ROOT)).replace('\\','/'),'cases':cases,'metrics':metrics,'planned_target_words':targets,
        'coverage_scope':'completed recordings; planned yield includes blocked/unattempted recordings','all_planned_word_yield':metrics['uniquely_aligned_words']/targets,
        'audio_seconds_completed':duration,'total_alignment_seconds':seconds,'aggregate_alignment_rtf':seconds/duration if duration else None,
        'total_supervised_seconds_completed':supervised,'aggregate_supervised_rtf':supervised/duration if duration else None,
        'attempts':state['attempts'],'failed_attempts':sum(a['status'] not in ('completed','running') for a in state['attempts']),**peaks,'job':job}

def execute(directory,job,counters):
    validate_full_job(job)
    path=directory/'checkpoint.json';state=read(path) if path.exists() else {'job_sha256':sha(directory/'job.json'),'completed':[],'attempts':[],'status':'prepared'}
    if state['job_sha256']!=sha(directory/'job.json'):raise ValueError('Checkpoint job differs')
    completed=state['completed'];expected=[r['id'] for r in job['cases']]
    if len(completed)>25 or [c['recording_id'] for c in completed]!=expected[:len(completed)]:raise ValueError('Checkpoint duplicate/order differs')
    paths=[a['attempt_path'] for a in state['attempts']]
    if len(paths)!=len(set(paths)):raise ValueError('Duplicate attempt folder')
    for saved,row in zip(completed,job['cases']):
        actual=evidence(directory,saved,row,job)
        if saved['result']!=actual or saved['evaluation_sha256']!=sha(attempt_folder(directory,saved)/'evaluation.json'):raise ValueError('Saved checkpoint result differs')
        matches=[a for a in state['attempts'] if a['attempt_path']==saved['attempt_path'] and a['status']=='completed' and a['recording_id']==row['id']]
        if len(matches)!=1:raise ValueError('Completed attempt ledger differs')
    if sum(a['status']=='completed' for a in state['attempts'])!=len(completed):raise ValueError('Unmatched successful ledger entry')
    running=[a for a in state['attempts'] if a['status']=='running']
    if len(running)>1:raise ValueError('Concurrent attempts in checkpoint')
    def accept(entry,row,result):
        validate_result(result,row,job)
        entry.update({k:result.get(k) for k in ('status','error','supervised_seconds','alignment_seconds','peak_resident_bytes','peak_private_commit_bytes')})
        completed.append({'recording_id':row['id'],'attempt_path':entry['attempt_path'],'evaluation_sha256':sha(attempt_folder(directory,entry)/'evaluation.json'),'result':result})
        state['status']='in_progress';atomic(path,state)
    if running:
        entry=running[0]
        if len(completed)==25 or entry['recording_id']!=expected[len(completed)] or entry is not state['attempts'][-1]:raise ValueError('Pending attempt is not next recording')
        folder=attempt_folder(directory,entry);row=job['cases'][len(completed)]
        if (folder/'evaluation.json').exists():accept(entry,row,evidence(directory,entry,row,job))
        else:
            previous=read(folder/'outcome.json') if (folder/'outcome.json').exists() else {'status':'interrupted','error':'Uncommitted attempt retained; no completed result'}
            entry.update({k:previous.get(k) for k in ('status','error','supervised_seconds','peak_resident_bytes','peak_private_commit_bytes')})
            atomic(path,state)
    failure=None
    for row in job['cases'][len(completed):]:
        entry={'recording_id':row['id'],'attempt_path':'attempts/'+row['id']+'_'+uuid.uuid4().hex[:12],'status':'running','started_utc':datetime.now(timezone.utc).isoformat()}
        folder=attempt_folder(directory,entry);folder.mkdir(parents=True);atomic(folder/'job.json',job)
        state['attempts'].append(entry);atomic(path,state)
        result=run_case(folder,job,row,counters)
        if result['status']=='completed':
            if result!=evidence(directory,entry,row,job):raise ValueError('Returned result differs')
            accept(entry,row,result);print(row['id']+': '+result['alignment_status'],flush=True)
        else:
            entry.update({k:result.get(k) for k in ('status','error','supervised_seconds','peak_resident_bytes','peak_private_commit_bytes')});failure=result;atomic(path,state);break
    report=summary_of(directory,job,state,failure);state['status']=report['status'];state['error']=failure;atomic(path,state)
    atomic(directory/'summary.json',report);atomic(RESULT,report);return report

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--performance-only',action='store_true',required=True);args=parser.parse_args()
    if Path(sys.prefix).resolve()!=(ROOT/'backend/.venv').resolve():raise RuntimeError('Use existing backend environment for supervision')
    with lock():
        FULL.mkdir(parents=True,exist_ok=True);path=FULL/'job.json'
        if not path.exists():atomic(path,make_full_job())
        result=execute(FULL,read(path),NativeMemory())
    print(result['status'],result['completed_recordings'],'/ 25; accuracy:',result['metrics']['accuracy_scope'])
    return 0 if result['status'] in ('full_completed','full_completed_with_partial_alignment') else 3
if __name__=='__main__':raise SystemExit(main())
