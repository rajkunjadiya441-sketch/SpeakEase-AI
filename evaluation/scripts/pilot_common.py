"""Pilot contracts/checkpoint helpers. No ML or third-party imports."""
import hashlib
import json
import os
from pathlib import Path
import re
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT/'evaluation/metadata/librispeech_verified_manifest.json'
RAW = ROOT/'evaluation/results/raw/asr_pilot_tiny'
BASE_RAW = ROOT/'evaluation/results/raw/asr_pilot_base_en'
TINY_BASELINE = ROOT/'evaluation/results/phase3_tiny_full.json'
SETTINGS = {'model':'tiny','device':'cpu','compute_type':'int8','cpu_threads':2,'num_workers':1,
            'language':'en','beam_size':1,'vad_filter':True,'condition_on_previous_text':False,
            'word_timestamps':False,'silence_rms_threshold':0.0001,'expected_text_prompt':None,
            'offline_only':True,'preserve_unset_library_defaults':True}

def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for block in iter(lambda:source.read(1024*1024),b''):
            digest.update(block)
    return digest.hexdigest()

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def atomic(path, value):
    path = Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    temporary = path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    try:
        with temporary.open('x',encoding='utf-8',newline='\n') as output:
            json.dump(value,output,ensure_ascii=False,allow_nan=False,indent=2); output.write('\n'); output.flush(); os.fsync(output.fileno())
        for attempt in range(10):
            try:
                os.replace(temporary,path);break
            except PermissionError:
                if attempt==9:raise
                time.sleep(0.02*(attempt+1))
    finally:
        if temporary.exists(): temporary.unlink()

def choose(records):
    ordered = sorted(records,key=lambda row:(row['duration_seconds'],row['id']))
    if len(ordered)!=100 or len({row['id'] for row in ordered})!=100:
        raise ValueError('Expected the frozen 100 unique selected recordings')
    return [ordered[0],ordered[(len(ordered)-1)//2],ordered[-1]]

def audio_path(row):
    source = (ROOT/row['audio_path']).resolve(strict=True)
    if not source.is_relative_to((ROOT/'evaluation/data').resolve()) or source.name!=row['id']+'.flac':
        raise ValueError('Source audio path escaped evaluation data or mismatched its ID')
    return source

def settings_for(model):
    if model not in ('tiny','base.en'):raise ValueError('Unsupported evaluation model')
    return dict(SETTINGS,model=model)

def choose_base(records):
    # Keep the three pilot cases in the completed tiny run's manifest order.
    duration_order=choose(records)
    ids={records[0]['id'],duration_order[0]['id'],duration_order[-1]['id']}
    for row in records:
        if len(ids)==3:break
        ids.add(row['id'])
    return [row for row in records if row['id'] in ids]

def tiny_baseline(manifest):
    from asr_metrics import POLICY
    baseline=read(TINY_BASELINE);selected=[r for r in manifest['records'] if r['selected']]
    if baseline.get('status')!='full_completed' or baseline.get('completed_samples')!=100 or not baseline.get('metrics_complete'):
        raise ValueError('Completed tiny 100-recording baseline required')
    if baseline.get('settings')!=SETTINGS or baseline.get('scoring_policy')!=POLICY or baseline.get('manifest_sha256')!=sha(MANIFEST):
        raise ValueError('Tiny baseline settings/scoring/dataset differ')
    if baseline.get('selected_ids')!=[r['id'] for r in selected] or len(baseline.get('sample_results',[]))!=100:
        raise ValueError('Tiny baseline manifest order differs')
    for measured,source in zip(baseline['sample_results'],selected):
        if any(measured.get(k)!=source[k] for k in ('id','source_sha256','reference_text','duration_seconds')):
            raise ValueError('Tiny baseline source provenance differs')
    policy_file='evaluation/scripts/asr_metrics.py'
    if baseline['reproducibility']['evaluation_script_sha256'].get(policy_file)!=sha(ROOT/policy_file):
        raise ValueError('Scoring source changed since completed tiny benchmark')
    return baseline

def validate_contract(job):
    model=job.get('settings',{}).get('model')
    if job.get('mode') not in ('pilot','full') or job.get('settings')!=settings_for(model):
        raise ValueError('CPU/int8 two-thread evaluation settings required')
    manifest=read(MANIFEST)
    if manifest['status']!='verified_100_samples' or sha(MANIFEST)!=job['manifest_sha256']:
        raise ValueError('Verified manifest changed')
    selected=[row for row in manifest['records'] if row['selected']];choose(selected)
    if model=='base.en':
        tiny_baseline(manifest)
        if job.get('tiny_baseline_sha256')!=sha(TINY_BASELINE) or job.get('ordered_dataset_ids')!=[r['id'] for r in selected]:
            raise ValueError('Frozen tiny baseline or full dataset order differs')
        from asr_metrics import POLICY
        if job.get('scoring_policy')!=POLICY or job.get('warmup')!='first manifest recording; excluded; repeated after resume':
            raise ValueError('base.en evaluation must preserve tiny scoring and warmup rules')
        if job['mode']=='pilot':
            if job.get('score_pilot') is not True:raise ValueError('Scored base.en pilot required')
            expected=choose_base(selected)
        else:
            from verify_base_pilot import PILOT,verify_saved_pilot
            if job.get('scope_id')!='base_en_full_after_verified_pilot_v1' or job.get('score_pilot') is not False:
                raise ValueError('Explicit full base.en contract required')
            verified=verify_saved_pilot()
            proof=ROOT/'evaluation/results/phase3_base_pilot_verification.json'
            if job.get('successful_pilot_sha256')!=sha(PILOT) or job.get('pilot_verification_sha256')!=sha(proof) or verified['status']!='PASS':
                raise ValueError('Successful pilot proof changed')
            expected=selected
    else:expected=choose(selected) if job['mode']=='pilot' else selected
    if job['cases']!=expected:raise ValueError('Evaluation cases/order differ from the fixed contract')
    for row in job['cases']:
        if not re.fullmatch(r'\d+-\d+-\d{4}',row['id']) or sha(audio_path(row))!=row['source_sha256']:
            raise ValueError('Audio ID/checksum changed')
    for file,expected_hash in job['protected_source_sha256'].items():
        if sha(ROOT/file)!=expected_hash:raise ValueError('Protected application file changed: '+file)
    return manifest

def resume_records(checkpoint, job):
    if checkpoint.get('manifest_sha256')!=job['manifest_sha256'] or checkpoint.get('settings')!=job['settings']:
        raise ValueError('Checkpoint fingerprint differs')
    records = checkpoint.get('completed',[])
    if len(records)>len(job['cases']) or len({row['id'] for row in records})!=len(records):
        raise ValueError('Invalid checkpoint results')
    expected = job['cases'][:len(records)]
    if any(result['id']!=source['id'] or result['source_sha256']!=source['source_sha256'] or result['status']!='completed' for result,source in zip(records,expected)):
        raise ValueError('Checkpoint is not a completed pilot prefix')
    if job['mode']=='full' or job.get('score_pilot'):
        import math
        from asr_metrics import score
        for result,source in zip(records,expected):
            if result.get('reference_text')!=source['reference_text'] or result.get('metrics')!=score(source['reference_text'],result['predicted_text']):
                raise ValueError('Checkpoint text/scoring differs')
            if not math.isfinite(result['inference_seconds']) or result['inference_seconds']<0 or result['duration_seconds']!=source['duration_seconds']:
                raise ValueError('Checkpoint timing differs')
    return records
