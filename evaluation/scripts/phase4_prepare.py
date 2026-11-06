"""Prepare immutable subset and blank annotations. Never run models/downloads."""
import csv
from pathlib import Path
from phase4_common import OUT,SUBSET,ANNOTATIONS,FIELDS,ROOT,MANIFEST,choose25,pilot_ids,resources,annotation_groups,read,sha,atomic
from phase4_metrics import token

def write_template(path,rows):
    if path.exists():return False
    with path.open('x',encoding='utf-8',newline='') as output:
        writer=csv.DictWriter(output,fieldnames=FIELDS);writer.writeheader()
        for recording in rows:
            for index,word in enumerate(recording['reference_text'].split(),1):
                writer.writerow({'recording_id':recording['id'],'word_index':index,'word':word,
                    'reference_start_seconds':'','reference_end_seconds':'','annotation_status':'pending' if token(word) else 'excluded_punctuation',
                    'annotator_id':'','reviewer_id':'','notes':''})
    return True

def prepare():
    OUT.mkdir(parents=True,exist_ok=True)
    if not (OUT/'preservation.json').exists():
        protected={}
        for p in (ROOT/'evaluation/results').rglob('*'):
            if p.is_file() and not p.is_relative_to(OUT):protected[str(p.relative_to(ROOT)).replace('\\','/')]=sha(p)
        parent=read(MANIFEST);protected.update(parent['protected_source_sha256'])
        for r in parent['records']:protected[r['audio_path']]=r['source_sha256']
        for p in (ROOT/'evaluation/scripts').glob('*.py'):
            if not p.name.startswith(('phase4_','test_phase4')):protected[str(p.relative_to(ROOT)).replace('\\','/')]=sha(p)
        for relative in ('alignment/align_recording.py','backend/app/services/alignment.py','backend/.venv/pyvenv.cfg','alignment/.venv/pyvenv.cfg','alignment/requirements-lock.txt','evaluation/metadata/librispeech_verified_manifest.json','evaluation/metadata/librispeech_test_clean_inventory.jsonl'):
            protected[relative]=sha(ROOT/relative)
        atomic(OUT/'preservation.json',{'date':'2026-11-05','sha256':protected})
    manifest=read(MANIFEST);rows=choose25([r for r in manifest['records'] if r['selected']])
    subset={'phase':4,'seed':42,'selection':'sha256 UTF8(speakease-5c|phase4-alignment|42| + recording_id), ascending hex/ID; first 25',
        'parent_manifest_sha256':sha(MANIFEST),'records':rows,'pilot_ids':pilot_ids(rows),'resources':resources(),
        'reference_timestamp_status':'No trustworthy human word timestamps found in local sources; LibriSpeech labels are sentence text only',
        'ground_truth_available':False}
    if SUBSET.exists():
        if read(SUBSET)!=subset:raise ValueError('Existing subset/resources differ; frozen artifacts were not overwritten')
    else:atomic(SUBSET,subset)
    write_template(ANNOTATIONS,rows)
    groups=annotation_groups(ANNOTATIONS,rows)
    return {'selected_recordings':25,'annotation_rows':sum(len(g) for g in groups.values()),'pilot_ids':subset['pilot_ids'],
            'verified_timestamp_rows':sum(r['annotation_status'] in ('verified','adjudicated') for group in groups.values() for r in group),'model_inference_executed':False}

if __name__=='__main__':
    import json
    print(json.dumps(prepare(),indent=2))
