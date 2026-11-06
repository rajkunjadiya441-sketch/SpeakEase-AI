import fs from 'node:fs';import {createHash} from 'node:crypto';import os from 'node:os';
const REPO='openslr/librispeech_asr', REV='71cacbfb7e2354c4226d01e70d77d5fca3d04ba1';
const output='evaluation/metadata';
const sha=text=>createHash('sha256').update(text).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function jsonMetadata(url){
 const u=new URL(url);if(!['huggingface.co','datasets-server.huggingface.co'].includes(u.hostname)||!(u.pathname.startsWith('/api/datasets/')||u.pathname==='/rows'))throw new Error('Metadata GET endpoint not allowed');
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});
  if([429,502,503].includes(response.status)&&attempt<2){await pause(1200*(attempt+1));continue;}
  if(!response.ok)throw new Error('Metadata HTTP '+response.status);
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Refusing non-JSON GET response');
  return response.json();
 }
}
const rowsUrl=(offset,length)=>'https://datasets-server.huggingface.co/rows?'+new URLSearchParams({dataset:REPO,config:'clean',split:'test',offset:String(offset),length:String(length)});
const repoBefore=await jsonMetadata('https://huggingface.co/api/datasets/'+REPO);
if(repoBefore.sha!==REV)throw new Error('Repository revision changed; stop for review');
const license=repoBefore.cardData?.license;if(!(Array.isArray(license)?license:[license]).includes('cc-by-4.0'))throw new Error('License requires review');
const first=await jsonMetadata(rowsUrl(0,100)), total=first.num_rows_total;
if(total!==2620||first.partial)throw new Error('Unexpected corpus size/partial metadata');
const pages=[first];for(let offset=100;offset<total;offset+=300){const offsets=[offset,offset+100,offset+200].filter(x=>x<total);const batch=await Promise.allSettled(offsets.map(x=>jsonMetadata(rowsUrl(x,Math.min(100,total-x)))));for(const item of batch){if(item.status!=='fulfilled')throw item.reason;pages.push(item.value);}console.log('Metadata rows received:',Math.min(offset+300,total));}
const signed=new Map(), inventory=[];
for(const page of pages){if(page.num_rows_total!==total||page.partial)throw new Error('Incomplete or changing metadata');for(const wrapper of page.rows){
 const row=wrapper.row;if(wrapper.truncated_cells?.length)throw new Error('Truncated metadata '+wrapper.row_idx);
 if(typeof row.id!=='string'||typeof row.text!=='string'||!row.text.trim()||!Array.isArray(row.audio))throw new Error('Invalid reference row');
 const asset=row.audio.find(audio=>['audio/flac','audio/x-flac'].includes(audio.type));if(!asset)throw new Error('No advertised lossless FLAC for '+row.id);
 const u=new URL(asset.src);if(u.protocol!=='https:'||u.hostname!=='datasets-server.huggingface.co'||!u.pathname.includes('/'+REV+'/')||!u.pathname.endsWith('/audio/audio.flac'))throw new Error('Unpinned/unexpected asset');
 if(!row.file.endsWith('/'+row.id+'.flac')||String(row.speaker_id)!==row.id.split('-')[0]||String(row.chapter_id)!==row.id.split('-')[1])throw new Error('ID/reference provenance mismatch');
 if(signed.has(row.id))throw new Error('Duplicate ID');signed.set(row.id,asset.src);
 inventory.push({id:row.id,row_index:wrapper.row_idx,speaker_id:row.speaker_id,chapter_id:row.chapter_id,reference_text:row.text,source_file:row.id+'.flac',source_revision:REV,source_asset_url:u.origin+u.pathname,advertised_mime:asset.type,priority_sha256:sha('speakease-5c|42|'+row.id)});
}}
if(inventory.length!==total||new Set(inventory.map(x=>x.row_index)).size!==total)throw new Error('Incomplete metadata inventory');
const ranked=[...inventory].sort((a,b)=>(a.priority_sha256<b.priority_sha256?-1:a.priority_sha256>b.priority_sha256?1:a.id<b.id?-1:a.id>b.id?1:0));
const chosen=ranked.slice(0,120).map((row,index)=>({...row,rank:index+1,role:index<100?'candidate':'reserve',duration_seconds:null,duration_verified:false,audio_downloaded:false}));
async function head(row){
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(signed.get(row.id),{method:'HEAD',headers:{'Accept-Encoding':'identity'},signal:AbortSignal.timeout(25000)});
  if([429,502,503].includes(response.status)&&attempt<2){await pause(1000*(attempt+1));continue;}
  if(response.status!==200)throw new Error('Asset HEAD '+response.status+' for '+row.id);
  const bytes=Number(response.headers.get('content-length'));if(!Number.isSafeInteger(bytes)||bytes<=0)throw new Error('Asset size unavailable');
  const encoding=response.headers.get('content-encoding');if(encoding&&encoding!=='identity')throw new Error('Unexpected encoded transfer');
  return {...row,head_status:response.status,content_length_bytes:bytes,head_content_type:response.headers.get('content-type'),etag_opaque:response.headers.get('etag'),size_verified_by:'HEAD only; no audio body requested'};
 }
}
const sized=[];for(let offset=0;offset<chosen.length;offset+=3){const batch=await Promise.allSettled(chosen.slice(offset,offset+3).map(head));for(const item of batch){if(item.status!=='fulfilled')throw item.reason;sized.push(item.value);}console.log('FLAC HEAD sizes checked:',sized.length);}
const repoAfter=await jsonMetadata('https://huggingface.co/api/datasets/'+REPO);if(repoAfter.sha!==REV)throw new Error('Repository changed during preflight');
const candidate=sized.filter(x=>x.role==='candidate'), reserve=sized.filter(x=>x.role==='reserve');const sum=rows=>rows.reduce((n,x)=>n+x.content_length_bytes,0);
const manifest={status:'metadata_and_head_preflight_only_no_audio_acquired',date:'2026-11-05',timezone:'Asia/Calcutta',dataset:REPO,config:'clean',split:'test',revision:REV,license:'CC-BY-4.0',seed:42,ranking:'sha256(UTF8("speakease-5c|42|" + utterance_id)), hexadecimal ascending, ID tie-break',selection_final:false,reason:'Candidate durations and actual audio decoding cannot be verified without approved audio acquisition',candidate_count:candidate.length,reserve_count:reserve.length,candidate_flac_bytes:sum(candidate),reserve_flac_bytes:sum(reserve),all_120_flac_bytes:sum(sized),audio_download_approved:false,asset_urls:'stable paths omit expiring signatures; refresh metadata for these row indices and validate IDs/revision before a future approved download',audio_format_verification:'Provider advertises FLAC; headers and bytes not read or decoded',records:sized};
const inventoryText=inventory.sort((a,b)=>a.row_index-b.row_index).map(row=>JSON.stringify(row)).join('\n')+'\n';manifest.inventory_sha256=sha(inventoryText);
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/librispeech_test_clean_inventory.jsonl',inventoryText);fs.writeFileSync(output+'/librispeech_seed42_manifest.json',JSON.stringify(manifest,null,2)+'\n');
const columns=['rank','role','id','row_index','speaker_id','chapter_id','reference_text','source_revision','source_asset_url','advertised_mime','content_length_bytes','head_content_type','duration_verified'];const cell=value=>'"'+String(value??'').replaceAll('"','""')+'"';fs.writeFileSync(output+'/librispeech_seed42_candidates.csv',[columns.join(','),...sized.map(row=>columns.map(column=>cell(row[column])).join(','))].join('\n')+'\n');
console.log(JSON.stringify({metadata_records:inventory.length,unique_speakers:new Set(inventory.map(x=>x.speaker_id)).size,candidates:candidate.length,candidate_speakers:new Set(candidate.map(x=>x.speaker_id)).size,reserves:reserve.length,candidate_flac_bytes:sum(candidate),reserve_flac_bytes:sum(reserve),all_120_flac_bytes:sum(sized),candidate_mib:sum(candidate)/2**20,all_120_mib:sum(sized)/2**20,audio_body_requests:0,revision:REV,inventory_sha256:manifest.inventory_sha256,ram_available_bytes:os.freemem(),first_candidate_ids:candidate.slice(0,3).map(x=>x.id)},null,2));
