// Offline reference validation and scoring. Node.js standard library only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export function parseCSV(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;} else if(!quoted && cell!=='') throw Error('Malformed CSV quote'); else quoted=!quoted; }
    else if(!quoted && (c===',' || c==='\n' || c==='\r')) {
      row.push(cell);cell='';
      if(c!==','){if(c==='\r' && text[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[];}
    } else cell+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(cell!=='' || row.length){row.push(cell);rows.push(row);}
  const header=rows.shift();
  const required=['recording_id','word_index','word','reference_start_seconds','reference_end_seconds','annotation_status','annotator_id','reviewer_id','notes'];
  if(!header || new Set(header).size!==header.length || required.some(k=>!header.includes(k)))throw Error('Invalid CSV header');
  return rows.map(r=>{if(r.length!==header.length)throw Error('CSV column count');return Object.fromEntries(header.map((k,i)=>[k,r[i]]));});
}
export function validate(rows,cases) {
  const grouped=new Map(cases.map(c=>[c.recording_id,[]])); const seen=new Set();
  const statuses=new Set(['pending','annotated','uncertain','inaudible','unresolved_transcript','verified','adjudicated']);
  for(const r of rows){
    if(!grouped.has(r.recording_id))throw Error('Unknown recording');
    const key=`${r.recording_id}:${r.word_index}`;
    if(seen.has(key))throw Error('Duplicate annotation');seen.add(key);grouped.get(r.recording_id).push(r);
  }
  const report=[];
  for(const c of cases){
    const rr=grouped.get(c.recording_id), words=c.reference_text.split(/\s+/);
    if(rr.length!==words.length)throw Error(`Incomplete row set: ${c.recording_id}`);
    let lastEnd=0,verified=0;
    rr.forEach((r,i)=>{
      if(r.word_index!==String(i+1) || r.word!==words[i])throw Error('Word-order or reference-word mismatch');
      if(!statuses.has(r.annotation_status))throw Error('Unknown annotation status');
      const a=r.reference_start_seconds.trim(), b=r.reference_end_seconds.trim();
      const trusted=['verified','adjudicated'].includes(r.annotation_status);
      if((a==='')!==(b==='') || (trusted && a===''))throw Error('Missing timestamps');
      if(a!==''){
        const start=Number(a),end=Number(b);
        if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>=end||end>c.duration_seconds)throw Error('Invalid reference interval');
        if(start<lastEnd)throw Error('Overlapping or out-of-order reference intervals');lastEnd=end;
      }
      if(trusted){if(!r.annotator_id.trim()||!r.reviewer_id.trim()||r.annotator_id.trim()===r.reviewer_id.trim())throw Error('Independent reviewer required');verified++;}
    });
    report.push({recording_id:c.recording_id,rows:rr,reference_words:words.length,verified_words:verified,eligible:verified===words.length});
  }
  return report;
}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function metrics(start,end,totalWords) {
  const pooled=[...start,...end], sorted=[...pooled].sort((a,b)=>a-b),n=sorted.length;
  const out={scored_word_pairs:start.length,start_mae_seconds:mean(start),end_mae_seconds:mean(end),combined_boundary_mae_seconds:mean(pooled),median_absolute_boundary_error_seconds:n?(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2:null};
  for(const ms of [50,100,200]){
    const count=a=>a.filter(e=>e<=ms/1000+1e-9).length;
    for(const [name,arr] of [['start',start],['end',end],['pooled',pooled]])out[`${name}_within_${ms}ms_percent`]=arr.length?100*count(arr)/arr.length:null;
    out[`all_reference_boundaries_within_${ms}ms_percent`]=totalWords?100*count(pooled)/(2*totalWords):null;
  }
  return out;
}
export function score(rows,cases,fullDatasetCount=25) {
  const checked=validate(rows,cases);let allStart=[],allEnd=[],eligibleWords=0;
  const recordings=checked.map((r,k)=>{
    const c=cases[k],words=c.reference_text.split(/\s+/),pred=c.words;
    // This frozen full25 has an exact one-to-one word sequence. Fail closed if it changes.
    if(pred.length!==words.length || pred.some((p,i)=>p.word!==words[i]))throw Error('Prediction sequence mismatch; no positional guessing permitted');
    let last=-1;const valid=pred.map(p=>{const ok=typeof p.start==='number'&&typeof p.end==='number'&&Number.isFinite(p.start)&&Number.isFinite(p.end)&&0<=p.start&&p.start<p.end&&p.end<=c.duration_seconds+.01&&p.start>=last;if(ok)last=p.start;return ok;});
    let start=[],end=[];
    if(r.eligible){eligibleWords+=words.length;r.rows.forEach((a,i)=>{if(valid[i]){start.push(Math.abs(pred[i].start-Number(a.reference_start_seconds)));end.push(Math.abs(pred[i].end-Number(a.reference_end_seconds)));}});allStart.push(...start);allEnd.push(...end);}
    return {recording_id:r.recording_id,reference_words:r.reference_words,verified_words:r.verified_words,status:r.eligible?'verified_complete':'unavailable_incomplete_or_unverified',valid_prediction_words:valid.filter(Boolean).length,invalid_prediction_words:valid.filter(v=>!v).length,...metrics(start,end,r.eligible?words.length:0)};
  });
  const eligible=checked.filter(r=>r.eligible).length;
  return {accuracy_scope:eligible===0?'unavailable':eligible===fullDatasetCount&&cases.length===fullDatasetCount?'full_dataset':'partial_verified_subset',full_dataset_recordings:fullDatasetCount,supplied_recordings:cases.length,eligible_recordings:eligible,unverified_or_incomplete_recordings:cases.length-eligible,eligible_reference_words:eligibleWords,...metrics(allStart,allEnd,eligibleWords),recordings};
}
export function loadInputs(manifestPath,annotationPath){
  const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  for(const [rel,digest] of Object.entries(m.frozen_inputs))if(hash(path.join(root,rel))!==digest)throw Error(`Frozen input changed: ${rel}`);
  const full=JSON.parse(fs.readFileSync(path.join(root,m.predictions_path),'utf8'));
  const cases=m.recordings.map(r=>{const c=full.cases.find(c=>c.recording_id===r.recording_id);if(!c || c.duration_seconds!==r.duration_seconds || c.reference_text!==r.reference_text || c.source_sha256!==r.source_sha256 || hash(path.join(root,r.audio_path))!==r.source_sha256)throw Error('Pilot source mismatch');return c;});
  return {m,cases,rows:parseCSV(fs.readFileSync(annotationPath,'utf8'))};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [mode,manifest,annotations,output]=process.argv.slice(2);
    if(!['validate','score'].includes(mode)||!manifest||!annotations)throw Error('Usage: node phase5_accuracy.mjs validate|score manifest.json annotations.csv [NEW-output.json]');
    const {m,cases,rows}=loadInputs(manifest,annotations);const check=validate(rows,cases);
    const result=mode==='score'?score(rows,cases,m.full_dataset_recordings):{status:'structurally_valid',supplied_recordings:cases.length,eligible_recordings:check.filter(r=>r.eligible).length,unverified_rows:check.reduce((n,r)=>n+r.reference_words-r.verified_words,0),accuracy_calculated:false};
    const report={...result,annotation_sha256:hash(annotations),manifest_sha256:hash(manifest),evaluated_utc:new Date().toISOString()};
    const text=JSON.stringify(report,null,2)+'\n';if(output)fs.writeFileSync(output,text,{flag:'wx'});else process.stdout.write(text);
  }catch(e){console.error(e.message);process.exitCode=1;}
}
