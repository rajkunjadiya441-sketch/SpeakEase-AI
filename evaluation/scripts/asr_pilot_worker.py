"""Shared isolated ASR worker: explicit contracts and lazy ML imports after memory gates."""
import argparse
import importlib.metadata
import os
from pathlib import Path
import sys
import time
from pilot_common import ROOT,RAW,SETTINGS,atomic,read,sha,validate_contract,resume_records,audio_path
from windows_memory import NativeMemory,OwnedJob,gate

def cached_snapshot(model_name='tiny'):
    if model_name not in ('tiny','base.en'):raise ValueError('Unsupported cached model')
    cache = ROOT/('models/models--Systran--faster-whisper-'+model_name)
    revision = (cache/'refs/main').read_text(encoding='utf-8').strip()
    if len(revision)!=40 or any(c not in '0123456789abcdef' for c in revision):
        raise ValueError('Invalid cached model revision')
    snapshot = cache/'snapshots'/revision
    required = ('model.bin','config.json','tokenizer.json')
    # faster-whisper uses FeatureExtractor defaults when this optional config is absent.
    optional = ('preprocessor_config.json','vocabulary.txt')
    present = tuple(name for name in optional if (snapshot/name).is_file())
    files = {name:{'bytes':(snapshot/name).stat().st_size,'sha256':sha(snapshot/name)} for name in required+present}
    return snapshot,{'model':model_name,'revision':revision,'files':files,
                     'absent_optional_files':[name for name in optional if name not in present]}

def runtime(snapshot,model_name='tiny'):
    import av
    import numpy as np
    from faster_whisper import WhisperModel
    sys.path.insert(0,str(ROOT/'backend'))
    from app.services.transcription import TranscriptionService
    def factory(name,**kwargs):
        if name!=model_name: raise ValueError('Unapproved model')
        return WhisperModel(str(snapshot),local_files_only=True,**kwargs)
    service = TranscriptionService(model_name=model_name,cpu_threads=2,model_dir=str(ROOT/'models'),model_factory=factory)
    def decode(row):
        chunks=[]
        with av.open(str(audio_path(row)),mode='r',format='flac',options={'err_detect':'explode'}) as container:
            stream=container.streams.audio[0];stream.codec_context.thread_count=1
            resampler=av.AudioResampler(format='flt',layout='mono',rate=16000)
            for frame in container.decode(stream):
                for converted in resampler.resample(frame):chunks.append(converted.to_ndarray().reshape(-1))
            for converted in resampler.resample(None):chunks.append(converted.to_ndarray().reshape(-1))
        waveform=np.concatenate(chunks).astype(np.float32,copy=False)
        if waveform.size!=row['verification']['decoded_samples'] or not np.isfinite(waveform).all():
            raise ValueError('Decoded waveform differs from verified sample count')
        return waveform
    return service,decode

def run(job_path,allowed_raw=RAW):
    directory=Path(job_path).resolve().parent
    if not directory.is_relative_to(allowed_raw.resolve()):raise ValueError('Worker job must be under its evaluation run directory')
    job=read(job_path);validate_contract(job);checkpoint_path=directory/'checkpoint.json'
    state=read(checkpoint_path) if checkpoint_path.exists() else {'manifest_sha256':job['manifest_sha256'],'settings':job['settings'],'completed':[]}
    state['completed']=resume_records(state,job);state.update(pid=os.getpid(),stage='waiting_for_supervisor',stage_started_monotonic=time.monotonic())
    def save(stage,**values):
        state.update(stage=stage,stage_started_monotonic=time.monotonic(),**values);atomic(checkpoint_path,state)
    save('waiting_for_supervisor')
    deadline=time.monotonic()+15
    while not (directory/'start.json').exists():
        if time.monotonic()>deadline:raise RuntimeError('Supervisor did not attach an owned process job')
        time.sleep(0.05)
    OwnedJob.join_current(os.environ.get('SPEAKEASE_EVAL_JOB'))
    state['owned_job_attached']=True
    counters=NativeMemory()
    try:
        decision=gate(counters.system(),job['settings']['model']);save('pre_import_gate',pre_import_gate=decision,model_loaded=False)
        if not decision['passed']:save('blocked_memory');return 3
        start=time.perf_counter();snapshot,model=cached_snapshot() if job['settings']['model']=='tiny' else cached_snapshot(job['settings']['model'])
        if 'cached_model' in job and model!=job['cached_model']:raise ValueError('Cached weights changed')
        save('cache_verified',cached_model=model,cache_verification_seconds=time.perf_counter()-start)
        start=time.perf_counter();service,decode=runtime(snapshot) if job['settings']['model']=='tiny' else runtime(snapshot,job['settings']['model']);imports=time.perf_counter()-start
        decision=gate(counters.system(),job['settings']['model']);save('pre_load_gate',pre_load_gate=decision,imports_seconds=imports,memory_before_model=counters.process())
        if not decision['passed']:save('blocked_memory');return 3
        save('model_loading',model_load_attempted=True);start=time.perf_counter();service.prepare();load=time.perf_counter()-start
        versions={package:importlib.metadata.version(package) for package in ('faster-whisper','ctranslate2','av','numpy','onnxruntime','tokenizers','huggingface-hub')}
        save('model_loaded',model_loaded=True,model_load_seconds=load,versions=versions,memory_after_model=counters.process())
        if job['mode']=='full' or job.get('score_pilot'):
            row=job['cases'][0];save('decoding',current_id=row['id'])
            waveform=decode(row);save('inference',current_id=row['id'])
            start=time.perf_counter();service.transcribe(waveform);elapsed=time.perf_counter()-start;del waveform
            save('warmup_completed',warmups=[*state.get('warmups',[]),{'id':row['id'],'inference_seconds':elapsed,'memory_after':counters.process()}])
        completed_on_entry=len(state['completed'])
        for index,row in enumerate(job['cases']):
            if index<len(state['completed']):continue
            save('decoding',current_id=row['id']);start=time.perf_counter();waveform=decode(row);decode_seconds=time.perf_counter()-start
            save('inference',current_id=row['id'],inference_attempts=[*state.get('inference_attempts',[]),row['id']]);start=time.perf_counter();result=service.transcribe(waveform);elapsed=time.perf_counter()-start
            del waveform
            if sha(audio_path(row))!=row['source_sha256']:raise ValueError('Source changed during inference')
            record={'id':row['id'],'source_sha256':row['source_sha256'],'reference_text':row['reference_text'],'predicted_text':result.transcript,
                'duration_seconds':row['duration_seconds'],'decode_seconds':decode_seconds,'inference_seconds':elapsed,
                'real_time_factor':elapsed/row['duration_seconds'],'status':'completed','first_call_in_process':index==completed_on_entry,
                'corpus_scored':False,'memory_after':counters.process()}
            if job['mode']=='full' or job.get('score_pilot'):
                from asr_metrics import score
                record['metrics']=score(record['reference_text'],record['predicted_text']);record['corpus_scored']=True
            state['completed'].append(record);save('case_completed',current_id=row['id'])
        save('completed',memory_after_inference=counters.process());return 0
    except BaseException as exc:
        save('failed',error=type(exc).__name__+': '+str(exc),memory_at_failure=counters.process());raise

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--job',required=True,type=Path);args=parser.parse_args()
    return run(args.job)
if __name__=='__main__':sys.exit(main())
