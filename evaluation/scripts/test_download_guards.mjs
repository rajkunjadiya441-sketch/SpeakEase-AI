import assert from 'node:assert/strict';
import {DownloadBudget} from './download_guard.mjs';
const rows=[{id:'test-a',content_length_bytes:6},{id:'test-b',content_length_bytes:4},{id:'test-c',content_length_bytes:1}];
const b=new DownloadBudget(rows,{maxFiles:2,maxBytes:10});const a=b.begin('test-a',6);b.receive(a,2);b.receive(a,4);b.complete(a);
assert.throws(()=>b.begin('test-a',6),/Duplicate/);assert.throws(()=>b.begin('unknown',1),/outside/);assert.throws(()=>b.begin('test-b',3),/outside/);
const c=b.begin('test-b',4);b.receive(c,4);b.complete(c);assert.throws(()=>b.begin('test-c',1),/count/);assert.equal(b.snapshot().received_bytes,10);
const bytes=new DownloadBudget(rows,{maxFiles:3,maxBytes:6});bytes.begin('test-a',6);assert.throws(()=>bytes.begin('test-b',4),/reservation/);
const truncated=new DownloadBudget(rows,{maxFiles:2,maxBytes:10});const t=truncated.begin('test-a',6);truncated.receive(t,3);assert.throws(()=>truncated.complete(t),/Truncated/);assert.throws(()=>truncated.receive(t,4),/exceeds/);assert.equal(truncated.snapshot().received_bytes,3);
console.log('PASS: exact-cap success, duplicate/unknown/changed-size rejection, file and byte caps, truncated/oversized body guards. No network or model calls.');

const resumed=new DownloadBudget(rows,{maxFiles:2,maxBytes:10},b.snapshot());assert.equal(resumed.snapshot().received_bytes,10);assert.throws(()=>resumed.begin('test-a',6),/Duplicate/);assert.throws(()=>resumed.begin('test-c',1),/count/);
assert.throws(()=>new DownloadBudget(rows,{maxFiles:2,maxBytes:10},{attempted_ids:['test-a','test-a']}),/request IDs/);
assert.throws(()=>new DownloadBudget(rows,{maxFiles:2,maxBytes:10},{attempted_ids:['unknown']}),/request IDs/);
assert.throws(()=>new DownloadBudget(rows,{maxFiles:2,maxBytes:10},{attempted_ids:['test-a'],reserved_bytes:5,received_bytes:5}),/byte budget/);
assert.throws(()=>new DownloadBudget(rows,{maxFiles:2,maxBytes:10},{received_bytes:-1}),/byte budget/);
console.log('PASS: resumed budgets preserve cumulative limits; duplicate/unknown saved IDs and corrupt/negative byte ledgers are rejected.');
