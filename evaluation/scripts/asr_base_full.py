"""Manual resumable 100-recording base.en benchmark. Never run automatically."""
import argparse
import importlib.metadata
from pathlib import Path
import sys
import asr_pilot as pilot
import asr_base_pilot as base
from asr_pilot_worker import cached_snapshot
from asr_metrics import POLICY
from pilot_common import ROOT,MANIFEST,read,sha,atomic,validate_contract,resume_records
from verify_base_pilot import PILOT,verify_saved_pilot
from windows_memory import NativeMemory

RAW=ROOT/'evaluation/results/raw/asr_full_base_en'
DIRECTORY=RAW/'seed42'
REPORT=ROOT/'evaluation/results/phase3_base_full.json'

def make_job():
    verified=verify_saved_pilot(check_cache=True)
    successful=read(PILOT)
    if any(importlib.metadata.version(name)!=version for name,version in successful['versions'].items()):
        raise ValueError('Installed versions differ from successful pilot')
    job=base.make_job()
    job.update(mode='full',cases=[r for r in read(MANIFEST)['records'] if r['selected']],
        selection='Frozen verified seed42 manifest order; same 100 records as tiny',
        scope='100 measured base.en recordings; one excluded warmup per process; no alignment/API work',
        scope_id='base_en_full_after_verified_pilot_v1',score_pilot=False,
        successful_pilot_sha256=verified['pilot_sha256'],pilot_verification_sha256=sha(ROOT/'evaluation/results/phase3_base_pilot_verification.json'))
    job['evaluation_script_sha256']={str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in Path(__file__).parent.glob('*.py')}
    validate_contract(job)
    return job

def summarize(directory,job,checkpoint,decision,status,error,samples,elapsed):
    return base.summarize(directory,job,checkpoint,decision,status,error,samples,elapsed,report_path=REPORT)

def validate_existing(directory,job):
    if job.get('settings',{}).get('model')!='base.en' or job.get('mode')!='full':raise ValueError('Full base.en job required')
    validate_contract(job)
    for file,expected in job['evaluation_script_sha256'].items():
        if sha(ROOT/file)!=expected:raise ValueError('Evaluation code changed; resume refused')
    if cached_snapshot('base.en')[1]!=job['cached_model']:raise ValueError('Cached weights changed')
    checkpoint=directory/'checkpoint.json'
    if checkpoint.exists():
        state=read(checkpoint);resume_records(state,job)
        if state.get('stage')=='completed':
            if len(state['completed'])!=100:raise ValueError('Completed checkpoint has fewer than 100 records')
            return True
    return False

def finalize_completed(directory,job):
    """Recover missing final exports after worker completion, without inference."""
    state=read(directory/'checkpoint.json');resume_records(state,job)
    if state.get('stage')!='completed' or len(state['completed'])!=100:raise ValueError('Complete 100-record checkpoint required')
    if REPORT.exists():
        previous=read(REPORT)
        if previous.get('status')=='full_completed' and previous.get('sample_results')==state['completed'] and previous.get('metrics_complete'):
            return previous
    decision=read(directory/'gate.json') if (directory/'gate.json').exists() else {}
    summary=summarize(directory,job,state,decision,'full_completed',None,[],None)
    summary['recovered_from_completed_checkpoint']=True
    atomic(directory/'summary.json',summary);atomic(REPORT,summary)
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--model',choices=['base.en'],required=True);parser.parse_args()
    if Path(sys.prefix).resolve()!=(ROOT/'backend/.venv').resolve():raise RuntimeError('Existing backend venv required')
    with pilot.RunLock():
        DIRECTORY.mkdir(parents=True,exist_ok=True);path=DIRECTORY/'job.json'
        job=read(path) if path.exists() else make_job()
        if validate_existing(DIRECTORY,job):
            finalize_completed(DIRECTORY,job)
            print('Already completed; see evaluation/results/phase3_base_full.json');return 0
        if not path.exists():atomic(path,job)
        print('Full base.en checkpoints: '+str(DIRECTORY),flush=True)
        result=pilot.execute(DIRECTORY,job,NativeMemory(),worker_name='asr_base_full_worker.py',reporter=summarize)
    print(result['status'],result['completed_samples'],'/ 100',result['error'])
    return 0 if result['status']=='full_completed' else 3
if __name__=='__main__':raise SystemExit(main())
