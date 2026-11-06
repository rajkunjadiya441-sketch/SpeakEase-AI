// Offline integrity/provenance checks only; no network, imports or model execution.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const frozenPath='evaluation/metadata/librispeech_seed42_manifest.json',frozen=read(frozenPath),verified=read('evaluation/metadata/librispeech_verified_manifest.json'),report=read('evaluation/results/dataset_verification.json');
assert.equal(verified.status,'verified_100_samples');assert.equal(verified.selection_final,true);assert.equal(verified.seed,42);assert.equal(verified.preflight_manifest_sha256,sha(fs.readFileSync(frozenPath)));
const inventoryText=fs.readFileSync('evaluation/metadata/librispeech_test_clean_inventory.jsonl','utf8');assert.equal(sha(inventoryText),frozen.inventory_sha256);
const inventory=inventoryText.trim().split('\n').map(line=>JSON.parse(line));assert.equal(inventory.length,2620);
for(const row of inventory)assert.equal(row.priority_sha256,sha('speakease-5c|42|'+row.id));
const ranked=[...inventory].sort((a,b)=>a.priority_sha256.localeCompare(b.priority_sha256)||a.id.localeCompare(b.id));
assert.deepEqual(frozen.records.map(r=>r.id),ranked.slice(0,120).map(r=>r.id));
assert.equal(frozen.all_120_flac_bytes,17109200);assert.equal(frozen.records.reduce((n,r)=>n+r.content_length_bytes,0),17109200);
const frozenById=new Map(frozen.records.map(r=>[r.id,r]));const seen=new Set();let bytes=0,duration=0;const chosen=[];
const audioRoot=path.resolve(verified.audio_directory);assert.ok(audioRoot.startsWith(path.resolve('evaluation/data')+path.sep));
for(const row of verified.records){
 assert.ok(!seen.has(row.id));seen.add(row.id);const original=frozenById.get(row.id);assert.ok(original);
 for(const key of ['id','rank','role','speaker_id','chapter_id','reference_text','source_file','source_revision','source_asset_url','content_length_bytes'])assert.deepEqual(row[key],original[key]);
 assert.equal(row.reference_pairing_verified,true);
 if(!row.download_success)continue;
 const file=path.resolve(row.audio_path);assert.equal(path.dirname(file),audioRoot);assert.equal(path.basename(file),row.id+'.flac');const raw=fs.readFileSync(file);assert.equal(raw.subarray(0,4).toString(),'fLaC');assert.equal(raw.length,row.content_length_bytes);assert.equal(raw.length,row.actual_bytes);assert.equal(sha(raw),row.source_sha256);bytes+=raw.length;
 if(!row.decode_success)continue;
 const result=row.verification;assert.equal(result.decode_success,true);assert.equal(result.source_sha256,row.source_sha256);assert.equal(result.decoded_samples,result.streaminfo_samples);assert.equal(result.models_imported,false);assert.equal(result.flac_pcm_md5_verified,true);assert.equal(result.source_unchanged,true);assert.equal(row.duration_seconds,result.decoded_samples/result.sample_rate);
 if(row.selected){assert.equal(row.eligible,true);assert.equal(result.sample_rate,16000);assert.equal(result.channels,1);assert.equal(result.bits_per_sample,16);assert.ok(row.duration_seconds>0&&row.duration_seconds<=30);chosen.push(row);duration+=row.duration_seconds;}
}
assert.equal(chosen.length,100);assert.deepEqual(verified.selected_ids,chosen.map(r=>r.id));
const candidateIds=frozen.records.filter(r=>r.role==='candidate').map(r=>r.id);assert.deepEqual(verified.records.slice(0,100).map(r=>r.id),candidateIds);
const needed=100-verified.records.slice(0,100).filter(r=>r.selected).length;
assert.equal(verified.records.filter(r=>r.role==='reserve'&&r.selected).length,needed);
assert.ok(verified.budget.audio_get_attempts<=120);assert.ok(verified.budget.received_bytes<=17109200);assert.ok(verified.budget.reserved_bytes<=17109200);assert.equal(verified.budget.attempted_ids.length,new Set(verified.budget.attempted_ids).size);
assert.equal(bytes,verified.summary.successful_source_file_bytes);assert.equal(duration,verified.records.filter(r=>r.selected).reduce((n,r)=>n+r.duration_seconds,0));assert.ok(Math.abs(duration-verified.summary.selected_duration_seconds)<1e-8);
assert.deepEqual(fs.readdirSync(audioRoot).sort(),verified.records.filter(r=>r.download_success).map(r=>r.id+'.flac').sort());assert.equal(verified.summary.eligible_verified_samples,100);assert.deepEqual(report.summary,verified.summary);
assert.equal(verified.models_run,false);assert.equal(verified.dependencies_installed,false);assert.equal(verified.environments_modified,false);
for(const [file,expected]of Object.entries(verified.protected_source_sha256))assert.equal(sha(fs.readFileSync(file)),expected);
for(const [file,expected]of Object.entries(read('evaluation/phase1_audit.json').source_sha256))assert.equal(sha(fs.readFileSync(file)),expected);
assert.ok(/^data\/$/m.test(fs.readFileSync('evaluation/.gitignore','utf8')));
console.log(JSON.stringify({status:'PASS',verified_samples:chosen.length,downloaded_audio_files:seen.size,source_bytes:bytes,selected_duration_seconds:duration,seed:42,source_checksums_valid:true,reference_manifest_consistent:true,protected_files_unchanged:true,models_run:false},null,2));
