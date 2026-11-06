import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {DownloadBudget} from './download_guard.mjs';
const ROOT=process.cwd(),REV='71cacbfb7e2354c4226d01e70d77d5fca3d04ba1',REPO='openslr/librispeech_asr';
const MAX_FILES=120,MAX_BYTES=17109200,TARGET=100;
const manifestPath='evaluation/metadata/librispeech_seed42_manifest.json';const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));const hash=data=>createHash('sha256').update(data).digest('hex');
if(m.revision!==REV||m.seed!==42||m.records.length!==MAX_FILES||m.all_120_flac_bytes!==MAX_BYTES)throw new Error('Frozen approval manifest does not match');
const inventoryText=fs.readFileSync('evaluation/metadata/librispeech_test_clean_inventory.jsonl','utf8');if(hash(inventoryText)!==m.inventory_sha256)throw new Error('Reference inventory changed');
const ranked=inventoryText.trim().split('\n').map(JSON.parse).sort((a,b)=>a.priority_sha256<b.priority_sha256?-1:a.priority_sha256>b.priority_sha256?1:0);
if(!m.records.every((row,i)=>row.id===ranked[i].id&&row.rank===i+1&&row.role===(i<TARGET?'candidate':'reserve')))throw new Error('Sampling order differs from seed-42 manifest');
const dataRoot=path.resolve('evaluation/data/librispeech_test_clean');const flacRoot=path.join(dataRoot,'flac');const ledgerFile=path.join(dataRoot,'download_ledger.json');
const resume=process.argv.includes('--resume');const prior=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile,'utf8')):null;
if(prior&&!resume)throw new Error('A prior acquisition exists; inspect its ledger before explicit --resume.');
if(resume&&!prior)throw new Error('No prior ledger to resume');
if(prior&&(prior.preflight_manifest_sha256!==hash(fs.readFileSync(manifestPath))||prior.inventory_sha256!==m.inventory_sha256||prior.budget.max_files!==MAX_FILES||prior.budget.max_bytes!==MAX_BYTES))throw new Error('Resume ledger does not match frozen approval');
const python=path.resolve('backend/.venv/Scripts/python.exe'),verifier=path.resolve('evaluation/scripts/verify_flac.py');
const probe=spawnSync(python,['-B','-I','-c','import av,json; print(json.dumps({"av":av.__version__}))'],{encoding:'utf8',windowsHide:true,timeout:20000});if(probe.status!==0)throw new Error('Existing PyAV interpreter is unavailable: '+(probe.stderr||probe.error?.message));
const protectedFiles=[...Object.keys(JSON.parse(fs.readFileSync('evaluation/phase1_audit.json','utf8')).source_sha256),'backend/.venv/pyvenv.cfg','alignment/.venv/pyvenv.cfg','ipd_frontend/src/hooks/useAudioRecorder.js','ipd_frontend/src/components/ui/AudioPlayer.jsx','ipd_frontend/src/services/speechService.js','ipd_frontend/src/services/attemptService.js','ipd_frontend/src/services/recordingStore.js'];
const currentProtected=Object.fromEntries(protectedFiles.map(file=>[file,hash(fs.readFileSync(file))]));const protectedBefore=prior?.protected_source_sha256||currentProtected;
if(prior&&protectedFiles.some(file=>currentProtected[file]!==protectedBefore[file]))throw new Error('Protected application changed before resume');
if(prior){
 const tried=new Set(prior.budget.attempted_ids);const saved=prior.records.filter(row=>tried.has(row.id));
 if(saved.length!==tried.size||saved.some(row=>!row.download_success||!row.decode_success||!row.duration_verified||hash(fs.readFileSync(path.resolve(row.audio_path)))!==row.source_sha256))throw new Error('Resume requires fully verified existing source files; inspect partial ledger manually');
 const actual=saved.reduce((n,row)=>n+row.actual_bytes,0);if(actual!==prior.budget.received_bytes||actual!==prior.budget.reserved_bytes)throw new Error('Resume byte ledger differs from existing files');
}
fs.mkdirSync(flacRoot,{recursive:true});const safeRoot=fs.realpathSync(dataRoot);const records=prior?prior.records.filter(row=>prior.budget.attempted_ids.includes(row.id)):[];const budget=new DownloadBudget(m.records,{maxFiles:MAX_FILES,maxBytes:MAX_BYTES},prior?.budget);
const state={date:'2026-11-05',timezone:'Asia/Calcutta',phase:2,status:'in_progress',dataset:REPO,config:'clean',split:'test',revision:REV,license:m.license,seed:42,approved_max_files:MAX_FILES,approved_max_audio_payload_bytes:MAX_BYTES,approval_scope:'100 candidates first; listed reserves only if needed; decoding/reference verification; no model runs',preflight_manifest_sha256:hash(fs.readFileSync(manifestPath)),inventory_sha256:m.inventory_sha256,models_run:false,dependencies_installed:false,environments_modified:false,derived_wav_files_created:0,records};
if(prior)state.resume_events=[...(prior.resume_events||[]),{previous_status:prior.status,error:prior.error,retained_verified_files:records.length,metadata_failures:prior.records.filter(row=>!prior.budget.attempted_ids.includes(row.id)).map(row=>({id:row.id,status:row.status,error:row.error})),audio_retries:0}];
function saveLedger(){state.budget=budget.snapshot();fs.writeFileSync(ledgerFile,JSON.stringify(state,null,2)+'\n');}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function metadata(url){const u=new URL(url);if(!['huggingface.co','datasets-server.huggingface.co'].includes(u.hostname)||!(u.pathname.startsWith('/api/datasets/')||u.pathname==='/rows'))throw new Error('Unexpected metadata endpoint');for(let attempt=0;attempt<3;attempt++){await pause(1200);const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});if([429,502,503].includes(response.status)&&attempt<2){const retry=Number(response.headers.get('retry-after'));await pause(Number.isFinite(retry)&&retry>0?Math.min(60000,retry*1000):5000*(attempt+1));continue;}if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('Metadata HTTP '+response.status);return response.json();}}
async function checkedAsset(row){
 const query=new URLSearchParams({dataset:REPO,config:'clean',split:'test',offset:String(row.row_index),length:'1'});const page=await metadata('https://datasets-server.huggingface.co/rows?'+query);const item=page.rows?.[0],fresh=item?.row;
 if(page.partial||page.num_rows_total!==2620||item?.row_idx!==row.row_index||item?.truncated_cells?.length||fresh?.id!==row.id||fresh?.text!==row.reference_text||fresh?.speaker_id!==row.speaker_id||fresh?.chapter_id!==row.chapter_id||!fresh?.file?.endsWith('/'+row.id+'.flac'))throw new Error('Source ID/reference provenance changed for '+row.id);
 const asset=fresh.audio?.find(a=>a.type==='audio/flac');if(!asset)throw new Error('Source is no longer advertised FLAC');const u=new URL(asset.src);if(u.protocol!=='https:'||u.hostname!=='datasets-server.huggingface.co'||u.origin+u.pathname!==row.source_asset_url||!u.pathname.includes('/'+REV+'/'))throw new Error('Asset revision/path mismatch');
 const head=await fetch(asset.src,{method:'HEAD',headers:{'Accept-Encoding':'identity'},signal:AbortSignal.timeout(25000)});if(head.status!==200||Number(head.headers.get('content-length'))!==row.content_length_bytes)throw new Error('Asset HEAD status/size changed for '+row.id);
 if(head.headers.get('content-encoding')&&!['identity'].includes(head.headers.get('content-encoding')))throw new Error('Unexpected content encoding');return asset.src;
}

async function acquire(row){
 if(!/^\d+-\d+-\d{4}$/.test(row.id))throw new Error('Unsafe source ID');
 const target=path.join(flacRoot,row.id+'.flac'),part=target+'.part';
 if(!target.startsWith(safeRoot+path.sep)||fs.existsSync(target)||fs.existsSync(part))throw new Error('Unsafe/existing audio target');
 const record={...row,status:'metadata_check',download_success:false,decode_success:false,eligible:false,selected:false,audio_path:path.relative(ROOT,target).replaceAll('\\','/')};records.push(record);
 let url;try{url=await checkedAsset(row);record.reference_pairing_verified=true;}catch(error){record.status='metadata_or_provenance_failed';record.error=error.message;saveLedger();throw error;}
 const ticket=budget.begin(row.id,row.content_length_bytes);record.status='download_reserved';saveLedger();let response,fd;
 try{
  response=await fetch(url,{headers:{'Accept-Encoding':'identity',Range:'bytes=0-'+(row.content_length_bytes-1)},signal:AbortSignal.timeout(60000)});
  if(![200,206].includes(response.status)||Number(response.headers.get('content-length'))!==row.content_length_bytes)throw new Error('Audio HTTP status/length mismatch: '+response.status);
  if(response.status===206&&response.headers.get('content-range')!=='bytes 0-'+(row.content_length_bytes-1)+'/'+row.content_length_bytes)throw new Error('Unexpected source range');
  if(response.headers.get('content-encoding')&&!['identity'].includes(response.headers.get('content-encoding')))throw new Error('Encoded audio transfer refused');
  fd=fs.openSync(part,'wx');record.status='downloading';
  for await(const chunk of response.body){budget.receive(ticket,chunk.byteLength);fs.writeFileSync(fd,chunk);record.received_bytes=ticket.received;saveLedger();}
  budget.complete(ticket);fs.closeSync(fd);fd=undefined;fs.renameSync(part,target);
  record.download_success=true;record.audio_downloaded=true;record.actual_bytes=fs.statSync(target).size;record.source_sha256=hash(fs.readFileSync(target));record.status='downloaded_pending_decode';saveLedger();
 }catch(error){
  if(fd!==undefined)fs.closeSync(fd);try{await response?.body?.cancel();}catch{}
  if(part.startsWith(safeRoot+path.sep)&&fs.existsSync(part))fs.unlinkSync(part);
  record.status='download_failed';record.error=error.message;record.received_bytes=ticket.received;saveLedger();return;
 }
 const checked=spawnSync(python,['-B',verifier,target,row.id],{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 let result;try{result=JSON.parse(checked.stdout);}catch{record.status='verifier_runtime_failed';record.error=(checked.stderr||checked.error?.message||'No verifier JSON').slice(0,2000);saveLedger();throw new Error('Decode worker could not return valid JSON; stopping downloads');}
 record.verification=result;record.decode_success=checked.status===0&&result.decode_success===true;
 if(record.decode_success){
  if(result.source_sha256!==record.source_sha256||result.source_bytes!==record.actual_bytes)throw new Error('Source bytes changed during decode');
  record.duration_seconds=result.duration_seconds;record.duration_verified=true;record.eligible=result.eligible;record.selected=result.eligible;record.status=result.eligible?'verified_selected':'decoded_excluded';
 }else{record.status='decode_failed';record.error=result.error||'Decode worker failed';}
 saveLedger();
 const recent=records.filter(r=>r.download_success).slice(-2);if(recent.length===2&&recent.every(r=>!r.decode_success))throw new Error('Two consecutive decode failures; stopped for investigation');
}
const selected=()=>records.filter(r=>r.selected);
function emitArtifacts(error){
 const downloaded=records.filter(r=>r.download_success),decoded=records.filter(r=>r.decode_success),chosen=selected();
 const durations=chosen.map(r=>r.duration_seconds).sort((a,b)=>a-b),sum=values=>values.reduce((a,b)=>a+b,0);
 const changed=protectedFiles.filter(file=>hash(fs.readFileSync(file))!==protectedBefore[file]);
 state.status=!error&&chosen.length===TARGET&&changed.length===0?'verified_100_samples':'partial_or_failed';state.error=error?.message||null;state.protected_source_files_unchanged=changed.length===0;state.changed_protected_files=changed;state.protected_source_sha256=protectedBefore;
 state.summary={audio_get_attempts:budget.attempted.size,successful_downloads:downloaded.length,download_failures:records.filter(r=>r.status==='download_failed').length,decode_successes:decoded.length,decode_failures:records.filter(r=>r.status==='decode_failed').length,eligible_verified_samples:chosen.length,decoded_but_ineligible:decoded.filter(r=>!r.eligible).length,reserves_requested:records.filter(r=>r.role==='reserve').length,received_audio_payload_bytes:budget.receivedBytes,reserved_payload_upper_bound_bytes:budget.reservedBytes,successful_source_file_bytes:sum(downloaded.map(r=>r.actual_bytes)),selected_source_file_bytes:sum(chosen.map(r=>r.actual_bytes)),selected_duration_seconds:sum(durations),selected_min_duration_seconds:durations[0]??null,selected_max_duration_seconds:durations.at(-1)??null,selected_median_duration_seconds:durations.length?(durations[Math.floor((durations.length-1)/2)]+durations[Math.floor(durations.length/2)])/2:null,selected_speakers:new Set(chosen.map(r=>r.speaker_id)).size,pcm_md5_verified_files:decoded.filter(r=>r.verification.flac_pcm_md5_verified).length,reference_pairings_verified:records.filter(r=>r.reference_pairing_verified).length,within_file_cap:budget.attempted.size<=MAX_FILES,within_byte_cap:budget.receivedBytes<=MAX_BYTES&&budget.reservedBytes<=MAX_BYTES};
 state.selected_ids=chosen.map(r=>r.id);state.reference_verification_scope='Fresh corpus metadata ID/text/speaker/chapter/filename and pinned audio URL pairing; not human listening or model transcription';saveLedger();
 const output={...state,budget:budget.snapshot(),selection_final:state.status==='verified_100_samples',audio_directory:path.relative(ROOT,flacRoot).replaceAll('\\','/')};
 fs.mkdirSync('evaluation/results',{recursive:true});fs.writeFileSync('evaluation/metadata/librispeech_verified_manifest.json',JSON.stringify(output,null,2)+'\n');
 fs.writeFileSync('evaluation/results/dataset_verification.json',JSON.stringify({...output,records:undefined,failures:records.filter(r=>!r.download_success||!r.decode_success),exclusions:decoded.filter(r=>!r.eligible)},null,2)+'\n');
 const cols=['id','rank','role','status','reference_text','audio_path','actual_bytes','source_sha256','duration_seconds','decode_success','eligible','selected'];const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';fs.writeFileSync('evaluation/metadata/librispeech_verified_records.csv',cols.join(',')+'\n'+records.map(r=>cols.map(c=>csv(r[c])).join(',')).join('\n')+'\n');
 console.log(JSON.stringify({status:state.status,error:state.error,summary:state.summary,protected_source_files_unchanged:changed.length===0},null,2));if(state.status!=='verified_100_samples')process.exitCode=1;
}
let fatal;
try{
 saveLedger();const repo=await metadata('https://huggingface.co/api/datasets/'+REPO);if(repo.sha!==REV||!JSON.stringify(repo.cardData?.license).includes('cc-by-4.0'))throw new Error('Repository revision/license changed');
 for(const row of m.records.filter(r=>r.role==='candidate')){if(records.some(r=>r.id===row.id))continue;await acquire(row);if(records.length%5===0)console.log('Processed '+records.length+' candidates; verified eligible '+selected().length+'; received '+budget.receivedBytes+' bytes');}
 for(const row of m.records.filter(r=>r.role==='reserve')){if(selected().length===TARGET)break;if(records.some(r=>r.id===row.id))continue;await acquire(row);console.log('Reserve '+row.rank+': '+records.at(-1).status+'; eligible '+selected().length);}
 if(selected().length!==TARGET)throw new Error('Insufficient eligible recordings inside approved pool');
 const finalRepo=await metadata('https://huggingface.co/api/datasets/'+REPO);if(finalRepo.sha!==REV)throw new Error('Repository revision changed during acquisition');
}catch(error){fatal=error;}finally{emitArtifacts(fatal);}
