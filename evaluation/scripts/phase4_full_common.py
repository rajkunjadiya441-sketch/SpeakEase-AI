"""Full25 contracts; pilot/application scripts remain byte-for-byte unchanged."""
from pathlib import Path
import math
from phase4_common import OUT,ROOT,SUBSET,ANNOTATIONS,MANIFEST,RAM_GATE,COMMIT_GATE,ALIGN_PYTHON,MODEL_FILE,read,sha,atomic,choose25,annotation_groups,source_path,verify_resources
from phase4_metrics import POLICY,evaluate,ACCURACY_KEYS
from phase4_common import alignment_gate
from phase4_verify import verify_pilot

FULL=OUT/'full25'
RESULT=OUT/'full_result.json'
PROOF=OUT/'pilot_verification.json'

def script_hashes():
    paths=list(Path(__file__).parent.glob('phase4_*.py'))+[Path(__file__).with_name('windows_memory.py'),Path(__file__).with_name('pilot_common.py')]
    return {str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in paths}

def make_full_job():
    proof=verify_pilot();saved=read(PROOF)
    if proof!=saved:raise ValueError('Frozen pilot verification differs')
    subset=read(SUBSET);groups=annotation_groups(ANNOTATIONS,subset['records'])
    return {'version':1,'mode':'full25','performance_only':True,'cases':subset['records'],'subset_sha256':sha(SUBSET),
        'manifest_sha256':sha(MANIFEST),'annotation_path':str(ANNOTATIONS),'annotation_sha256':sha(ANNOTATIONS),'annotations':groups,
        'resources':subset['resources'],'metric_policy':POLICY,'ram_gate_bytes':RAM_GATE,'commit_gate_bytes':COMMIT_GATE,
        'sampling_interval_seconds':.5,'case_timeout_seconds':300,'script_sha256':script_hashes(),
        'pilot_verification_sha256':sha(PROOF),'pilot_files_sha256':proof['pilot_files_sha256'],
        'protected_source_sha256':read(OUT/'preservation.json')['sha256'],
        'reuse_pilot_results':False,'model_reuse':'one fresh CPU child per recording; serialized; no excluded warmup'}

def validate_full_job(job):
    if job.get('version')!=1 or job.get('mode')!='full25' or job.get('performance_only') is not True:raise ValueError('Only full25 performance-only is authorized by this runner')
    subset=read(SUBSET);parent=read(MANIFEST)
    if sha(MANIFEST)!=job['manifest_sha256'] or subset['parent_manifest_sha256']!=job['manifest_sha256'] or choose25([r for r in parent['records'] if r['selected']])!=subset['records']:raise ValueError('Dataset selection differs')
    if len(job['cases'])!=25 or job['cases']!=subset['records'] or job['subset_sha256']!=sha(SUBSET):raise ValueError('Frozen25 order differs')
    if (job.get('ram_gate_bytes'),job.get('commit_gate_bytes'),job.get('sampling_interval_seconds'),job.get('case_timeout_seconds'))!=(RAM_GATE,COMMIT_GATE,.5,300):raise ValueError('Resource gates/monitor policy differs')
    if job.get('resources')!=subset['resources'] or job.get('metric_policy')!=POLICY or job.get('reuse_pilot_results') is not False:raise ValueError('Alignment protocol differs')
    if Path(job['annotation_path']).resolve()!=ANNOTATIONS.resolve() or job['annotation_sha256']!=sha(ANNOTATIONS) or job['annotations']!=annotation_groups(ANNOTATIONS,subset['records']):raise ValueError('Frozen annotations differ')
    if job['script_sha256']!=script_hashes():raise ValueError('Evaluation code changed; do not resume with mixed code')
    if sha(PROOF)!=job['pilot_verification_sha256'] or read(PROOF)['status']!='verified' or job['pilot_files_sha256']!=read(PROOF)['pilot_files_sha256']:raise ValueError('Pilot proof differs')
    expected=read(OUT/'preservation.json')['sha256']
    if job['protected_source_sha256']!=expected:raise ValueError('Preservation contract differs')
    for name,digest in {**expected,**job['pilot_files_sha256']}.items():
        if sha(ROOT/name)!=digest:raise ValueError('Protected file changed: '+name)
    for row in job['cases']:
        if sha(source_path(row))!=row['source_sha256']:raise ValueError('Source recording differs')
    return True

def validate_result(result,row,job):
    if result.get('status')!='completed' or result.get('recording_id')!=row['id'] or result.get('reference_text')!=row['reference_text'] or result.get('source_sha256')!=row['source_sha256'] or result.get('duration_seconds')!=row['duration_seconds']:raise ValueError('Completed result input differs')
    metrics=evaluate(row['id'],row['reference_text'],result['words'],job['annotations'][row['id']],row['duration_seconds'],allow_accuracy=False)
    if result.get('metrics')!=metrics or any(metrics[k] is not None for k in ACCURACY_KEYS):raise ValueError('Saved metrics differ or claim accuracy')
    for key in ('alignment_seconds','supervised_seconds','alignment_real_time_factor','supervised_real_time_factor','model_load_seconds','runtime_import_seconds'):
        value=result[key]
        if type(value) not in (int,float) or not math.isfinite(value) or value<0:raise ValueError('Invalid measured timing')
    for key in ('peak_resident_bytes','peak_private_commit_bytes'):
        if type(result[key]) is not int or result[key]<=0:raise ValueError('Invalid process peak')
    state=result['worker_state']
    for gate in (result['gate'],state['pre_import_gate'],state['pre_model_gate']):
        if gate!=alignment_gate(gate['observed']) or not gate['passed']:raise ValueError('Completed result failed admission gate')
    if state['stage']!='completed' or not state['model_load_attempted'] or result['supervised_seconds']>job['case_timeout_seconds']+2:raise ValueError('Worker incomplete or timed out')
    if result['alignment_real_time_factor']!=result['alignment_seconds']/row['duration_seconds'] or result['supervised_real_time_factor']!=result['supervised_seconds']/row['duration_seconds']:raise ValueError('Saved timing differs')
    return True
