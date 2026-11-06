"""One cold CPU alignment child; calls existing runner once, never ASR."""
import argparse
from contextlib import contextmanager,redirect_stdout
import importlib.util
import os
from pathlib import Path
import socket
import sys
import time
import urllib.request
from phase4_common import OUT,ROOT,ALIGN_RUNNER,MemoryGateBlocked,alignment_gate,verify_resources,source_path,validate_job,read,sha,atomic
from windows_memory import NativeMemory,OwnedJob

@contextmanager
def no_network():
    def denied(*args,**kwargs):raise RuntimeError('Network/download disabled for Phase 4 evaluation')
    targets=[(socket.socket,'connect'),(socket.socket,'connect_ex'),(socket,'create_connection'),(socket,'getaddrinfo'),(urllib.request,'urlopen')]
    originals=[]
    for owner,name in targets:originals.append((owner,name,getattr(owner,name)));setattr(owner,name,denied)
    try:yield denied
    finally:
        for owner,name,original in reversed(originals):setattr(owner,name,original)

def decode(row):
    import av
    import numpy as np
    chunks=[]
    with av.open(str(source_path(row)),mode='r',format='flac',options={'err_detect':'explode'}) as container:
        stream=container.streams.audio[0];stream.codec_context.thread_count=1
        resampler=av.AudioResampler(format='flt',layout='mono',rate=16000)
        for frame in container.decode(stream):
            for converted in resampler.resample(frame):chunks.append(converted.to_ndarray().reshape(-1))
        for converted in resampler.resample(None):chunks.append(converted.to_ndarray().reshape(-1))
    waveform=np.concatenate(chunks).astype(np.float32,copy=False)
    if waveform.size!=row['verification']['decoded_samples'] or not np.isfinite(waveform).all():raise ValueError('Decoded audio differs from frozen samples')
    return waveform

def align_existing(audio,text,counters,save):
    start=time.perf_counter()
    with no_network() as deny:
        import torch
        import nltk
        import whisperx.alignment as alignment
        imports=time.perf_counter()-start
        original_load=alignment.load_align_model;original_download=torch.hub.download_url_to_file;original_nltk=nltk.download
        timing={}
        def local_load(*args,**kwargs):
            decision=alignment_gate(counters.system());save('pre_model_gate',pre_model_gate=decision)
            if not decision['passed']:raise MemoryGateBlocked('Alignment gate failed before model loading')
            if args[:2]!=('en','cpu') or kwargs.get('model_name')!='WAV2VEC2_ASR_BASE_960H':raise ValueError('Unexpected alignment model/device')
            kwargs['model_cache_only']=True
            save('model_loading');clock=time.perf_counter();result=original_load(*args,**kwargs);timing['model_load_seconds']=time.perf_counter()-clock
            save('aligning');return result
        alignment.load_align_model=local_load;torch.hub.download_url_to_file=deny;nltk.download=deny
        try:
            spec=importlib.util.spec_from_file_location('phase4_original_runner',ALIGN_RUNNER);runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
            with redirect_stdout(sys.stderr):report=runner.run_alignment(audio,text,repetitions=1)
        finally:
            alignment.load_align_model=original_load;torch.hub.download_url_to_file=original_download;nltk.download=original_nltk
    return report,{'runtime_import_seconds':imports,**timing}

def run(job_path,recording_id):
    job_path=Path(job_path).resolve()
    if not job_path.parent.is_relative_to((OUT/'runs').resolve()):raise ValueError('Job escaped Phase 4 run tree')
    job=read(job_path);validate_job(job);row=next((r for r in job['cases'] if r['id']==recording_id),None)
    if row is None:raise ValueError('Recording not in prepared three-case pilot')
    folder=job_path.parent/recording_id;state_path=folder/'state.json';state={'pid':os.getpid(),'recording_id':recording_id,'model_load_attempted':False}
    def save(stage,**values):
        if stage=='model_loading':state['model_load_attempted']=True
        state.update(stage=stage,**values);atomic(state_path,state)
    save('waiting_for_supervisor');deadline=time.monotonic()+15
    while not (folder/'start.json').exists():
        if time.monotonic()>deadline:raise RuntimeError('No supervised start handshake')
        time.sleep(.05)
    OwnedJob.join_current(os.environ.get('SPEAKEASE_EVAL_JOB'));counters=NativeMemory()
    try:
        decision=alignment_gate(counters.system());save('pre_import_gate',pre_import_gate=decision)
        if not decision['passed']:save('blocked_memory');return 3
        start=time.perf_counter();verify_resources(job['resources']);resource_time=time.perf_counter()-start
        start=time.perf_counter();audio=decode(row);decode_time=time.perf_counter()-start
        report,timings=align_existing(audio,row['reference_text'],counters,save);del audio
        if report['transcript']!=row['reference_text'] or len(report['runs'])!=1:raise ValueError('Alignment result input differs')
        if sha(source_path(row))!=row['source_sha256']:raise ValueError('Source audio changed')
        result={'recording_id':recording_id,'reference_text':row['reference_text'],'source_sha256':row['source_sha256'],
            'duration_seconds':row['duration_seconds'],'decode_seconds':decode_time,'resource_verification_seconds':resource_time,
            'report':report,'memory_after':counters.process(),**timings}
        atomic(folder/'result.json',result);save('completed',memory_after=result['memory_after']);return 0
    except MemoryGateBlocked as exc:save('blocked_memory',error=str(exc));return 3
    except BaseException as exc:save('failed',error=type(exc).__name__+': '+str(exc));raise

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--job',required=True,type=Path);parser.add_argument('--recording-id',required=True);args=parser.parse_args()
    return run(args.job,args.recording_id)
if __name__=='__main__':raise SystemExit(main())
