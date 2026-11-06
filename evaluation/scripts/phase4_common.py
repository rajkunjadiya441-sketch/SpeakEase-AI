"""Frozen Phase 4 preparation contracts. No ML imports or resource downloads."""
import csv
import hashlib
import importlib.metadata
from pathlib import Path
import sys
from pilot_common import ROOT,MANIFEST,read,sha,atomic
from phase4_metrics import POLICY,token,validate_annotations

OUT=ROOT/'evaluation/results/phase4_whisperx'
SUBSET=OUT/'subset_manifest.json'
ANNOTATIONS=OUT/'reference_annotations.csv'
ALIGN_PYTHON=ROOT/'alignment/.venv/Scripts/python.exe'
ALIGN_RUNNER=ROOT/'alignment/align_recording.py'
MODEL_FILE=ROOT/'models/alignment/wav2vec2_fairseq_base_ls960_asr_ls960.pth'
NLTK=ROOT/'models/alignment/nltk_data/tokenizers/punkt_tab/english'
FIELDS=['recording_id','word_index','word','reference_start_seconds','reference_end_seconds','annotation_status','annotator_id','reviewer_id','notes']
RAM_GATE=2*1024**3
COMMIT_GATE=3*1024**3

class MemoryGateBlocked(RuntimeError):pass

def alignment_gate(sample):
    # Same gate schema/native sampling as Phase 3, with alignment-specific limits.
    return {'passed':sample['available_ram_bytes']>=RAM_GATE and sample['commit_headroom_bytes']>=COMMIT_GATE,
            'required_available_ram_bytes':RAM_GATE,'required_commit_headroom_bytes':COMMIT_GATE,'observed':sample}

def choose25(records):
    if len(records)!=100 or len({r['id'] for r in records})!=100:raise ValueError('Frozen 100-record input required')
    def priority(r):return hashlib.sha256(('speakease-5c|phase4-alignment|42|'+r['id']).encode()).hexdigest()
    ranked=sorted(records,key=lambda r:(priority(r),r['id']))[:25]
    return [{**r,'alignment_rank':i+1,'alignment_priority_sha256':priority(r)} for i,r in enumerate(ranked)]

def pilot_ids(records):
    ordered=sorted(records,key=lambda r:(r['duration_seconds'],r['id']))
    chosen={ordered[0]['id'],ordered[len(ordered)//2]['id'],ordered[-1]['id']}
    return [r['id'] for r in records if r['id'] in chosen]

def source_path(row):
    path=(ROOT/row['audio_path']).resolve(strict=True)
    if not path.is_relative_to((ROOT/'evaluation/data').resolve()) or path.name!=row['id']+'.flac':raise ValueError('Dataset path/ID differs')
    return path

def packages():
    site=ROOT/'alignment/.venv/Lib/site-packages';wanted={'whisperx','torch','torchaudio','numpy','av','nltk','transformers','huggingface-hub'}
    found={d.metadata['Name'].lower().replace('_','-'):d.version for d in importlib.metadata.distributions(path=[str(site)]) if d.metadata['Name'].lower().replace('_','-') in wanted}
    if set(found)!=wanted or found['whisperx']!='3.8.6' or not all(found[n].endswith('+cpu') for n in ('torch','torchaudio')):
        raise ValueError('Expected existing CPU-only WhisperX environment')
    return found

def resources():
    if not ALIGN_PYTHON.is_file():raise ValueError('Existing alignment interpreter missing; no repair attempted')
    paths=[MODEL_FILE,ALIGN_RUNNER,ROOT/'alignment/.venv/pyvenv.cfg',ROOT/'alignment/requirements-lock.txt',
        ROOT/'alignment/.venv/Lib/site-packages/whisperx/alignment.py',ROOT/'alignment/.venv/Lib/site-packages/torchaudio/pipelines/_wav2vec2/impl.py']
    paths += [NLTK/name for name in ('abbrev_types.txt','collocations.tab','ortho_context.tab','sent_starters.txt')]
    if MODEL_FILE.stat().st_size!=377664473:raise ValueError('Cached model size differs; no download permitted')
    return {'model':'WAV2VEC2_ASR_BASE_960H','device':'cpu','dtype':'float32','cpu_threads':2,'interpolate_method':'ignore',
        'packages':packages(),'files':{str(p.relative_to(ROOT)).replace('\\','/'):{'bytes':p.stat().st_size,'sha256':sha(p)} for p in paths}}

def verify_resources(expected):
    if resources()!=expected:raise ValueError('Alignment cache/source/environment identity changed; downloads are prohibited')

def annotation_groups(path,records):
    with Path(path).open(encoding='utf-8-sig',newline='') as source:
        reader=csv.DictReader(source)
        if not set(FIELDS).issubset(reader.fieldnames or []):raise ValueError('Annotation CSV schema differs')
        groups={r['id']:[] for r in records}
        for row in reader:
            if row['recording_id'] not in groups:raise ValueError('Annotation has an unknown recording')
            groups[row['recording_id']].append(row)
    for record in records:
        rows=sorted(groups[record['id']],key=lambda row:int(row['word_index']))
        groups[record['id']]=validate_annotations(record['reference_text'].split(),rows,record['duration_seconds'],record['id'])
    return groups

def make_job(performance_only=False,annotation_path=ANNOTATIONS):
    subset=read(SUBSET);manifest=read(MANIFEST)
    if subset['parent_manifest_sha256']!=sha(MANIFEST) or subset['records']!=choose25([r for r in manifest['records'] if r['selected']]):raise ValueError('Frozen subset differs')
    groups=annotation_groups(annotation_path,subset['records']);chosen=[r for r in subset['records'] if r['id'] in subset['pilot_ids']]
    if len(chosen)!=3 or subset['pilot_ids']!=pilot_ids(subset['records']):raise ValueError('Pilot selection differs')
    if not performance_only and any(row['annotation_status'] not in ('verified','adjudicated') for r in chosen for row in groups[r['id']] if token(row['word'])):
        raise ValueError('Verified independent timestamps required for accuracy; use explicit --performance-only for readiness testing')
    protected=read(OUT/'preservation.json')['sha256']
    return {'version':1,'mode':'pilot','cases':chosen,'subset_sha256':sha(SUBSET),'annotation_path':str(Path(annotation_path).resolve()),
        'annotation_sha256':sha(annotation_path),'annotations':{r['id']:groups[r['id']] for r in chosen},'performance_only':performance_only,
        'metric_policy':POLICY,'resources':subset['resources'],'protected_source_sha256':protected,
        'script_sha256':{str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in Path(__file__).parent.glob('phase4_*.py')},
        'ram_gate_bytes':RAM_GATE,'commit_gate_bytes':COMMIT_GATE,'case_timeout_seconds':300,'sampling_interval_seconds':.5}

def validate_job(job):
    if job.get('version')!=1 or job.get('mode')!='pilot' or len(job.get('cases',[]))!=3:raise ValueError('Only a three-record Phase 4 pilot is prepared')
    if job.get('metric_policy')!=POLICY or job.get('ram_gate_bytes')!=RAM_GATE or job.get('commit_gate_bytes')!=COMMIT_GATE:raise ValueError('Policy/gates differ')
    subset=read(SUBSET)
    if job.get('resources')!=subset['resources'] or type(job.get('performance_only')) is not bool or job.get('case_timeout_seconds')!=300 or job.get('sampling_interval_seconds')!=.5:raise ValueError('Resource/performance/monitor policy differs')
    if sha(SUBSET)!=job['subset_sha256'] or job['cases']!=[r for r in subset['records'] if r['id'] in subset['pilot_ids']]:raise ValueError('Pilot inputs differ')
    if sha(job['annotation_path'])!=job['annotation_sha256']:raise ValueError('Annotation file changed; start a new explicitly approved run')
    groups=annotation_groups(job['annotation_path'],subset['records'])
    if job.get('annotations')!={r['id']:groups[r['id']] for r in job['cases']}:raise ValueError('Frozen annotation rows differ from the CSV')
    if not job['performance_only'] and any(a['annotation_status'] not in ('verified','adjudicated') for r in job['cases'] for a in groups[r['id']] if token(a['word'])):raise ValueError('Unverified timestamps cannot enable accuracy')
    for row in job['cases']:
        if sha(source_path(row))!=row['source_sha256']:raise ValueError('Audio source changed')
        validate_annotations(row['reference_text'].split(),job['annotations'][row['id']],row['duration_seconds'],row['id'])
    for path,expected in job['script_sha256'].items():
        if sha(ROOT/path)!=expected:raise ValueError('Phase 4 code changed')
    return True
