"""One offline full25 child; existing alignment functions, no ASR."""
import argparse
import os
from pathlib import Path
import sys
import time
from phase4_common import ROOT,MemoryGateBlocked,alignment_gate,verify_resources,source_path,read,sha,atomic
from phase4_full_common import FULL,validate_full_job
from phase4_worker import decode,align_existing
from windows_memory import NativeMemory,OwnedJob

def run(job_path,recording_id):
    path=Path(job_path).resolve(strict=True)
    if not path.parent.is_relative_to((FULL/'attempts').resolve()):raise ValueError('Worker job escaped full25 attempts')
    job=read(path);validate_full_job(job);row=next(r for r in job['cases'] if r['id']==recording_id)
    folder=path.parent;state={'pid':os.getpid(),'recording_id':recording_id,'model_load_attempted':False}
    def save(stage,**values):
        if stage=='model_loading':state['model_load_attempted']=True
        state.update(stage=stage,**values);atomic(folder/'state.json',state)
    save('waiting_for_supervisor');deadline=time.monotonic()+15
    while not (folder/'start.json').exists():
        if time.monotonic()>deadline:raise RuntimeError('No supervised start handshake')
        time.sleep(.05)
    OwnedJob.join_current(os.environ.get('SPEAKEASE_EVAL_JOB'));counters=NativeMemory()
    try:
        decision=alignment_gate(counters.system());save('pre_import_gate',pre_import_gate=decision)
        if not decision['passed']:raise MemoryGateBlocked('Alignment gate failed before runtime imports')
        start=time.perf_counter();verify_resources(job['resources']);resource_time=time.perf_counter()-start
        start=time.perf_counter();audio=decode(row);decode_time=time.perf_counter()-start
        report,timings=align_existing(audio,row['reference_text'],counters,save);del audio
        if report['transcript']!=row['reference_text'] or len(report['runs'])!=1 or sha(source_path(row))!=row['source_sha256']:raise ValueError('Alignment result source/transcript differs')
        result={'recording_id':recording_id,'reference_text':row['reference_text'],'source_sha256':row['source_sha256'],
            'duration_seconds':row['duration_seconds'],'decode_seconds':decode_time,'resource_verification_seconds':resource_time,
            'report':report,'memory_after':counters.process(),**timings}
        atomic(folder/'result.json',result);save('completed',memory_after=result['memory_after']);return 0
    except MemoryGateBlocked as exc:save('blocked_memory',error=str(exc));return 3
    except BaseException as exc:save('failed',error=type(exc).__name__+': '+str(exc));raise

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--job',required=True,type=Path);parser.add_argument('--recording-id',required=True);args=parser.parse_args()
    if Path(sys.prefix).resolve()!=(ROOT/'alignment/.venv').resolve():raise RuntimeError('Use existing alignment environment for worker')
    return run(args.job,args.recording_id)
if __name__=='__main__':raise SystemExit(main())
