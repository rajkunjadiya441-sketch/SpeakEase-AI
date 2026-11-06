import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../src/App';
import {storage} from '../src/mocks/storage';
import '../src/index.css';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function until(fn,message,timeout=10000){const start=performance.now();while(performance.now()-start<timeout){if(fn())return;await wait(50);}throw new Error(message);}
const output=document.querySelector('#live-result');
document.querySelector('#real-recording').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 const report={fixture:'User-provided real speech file; controlled capture supplies original bytes; actual HTTP/inference are not mocked',requestCount:0};
 const originalFetch=window.fetch.bind(window);
 try{
  const mime=file.name.toLowerCase().endsWith('.webm')?'audio/webm':'audio/wav';const expected=mime==='audio/webm'?'Ship':'I have three apples.';report.sourceBytes=file.size;report.sourceName=file.name;report.sourceMime=mime;const bytes=await file.arrayBuffer();report.sourceSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
  localStorage.clear();storage.resetDefaults();
  storage.setTargets([...storage.getTargets(),{id:'t-live',patientId:'p-1',type:'SENTENCE',value:expected,difficulty:'Beginner'}]);
  storage.setExercises([...storage.getExercises(),{id:'ex-live',patientId:'p-1',targetId:'t-live',title:'Live sentence integration check',instructions:'Use the existing real English recording for this test.',content:{prompt:expected},status:'ASSIGNED'}]);
  storage.setAssignments([...storage.getAssignments(),{id:'as-live',patientId:'p-1',exerciseId:'ex-live',repetitions:1,completedRepetitions:0,status:'PENDING'}]);
  class RealFileRecorder{
   static isTypeSupported(type){return type===mime;}
   constructor(_stream,{mimeType}){this.mimeType=mimeType;this.state='inactive';}
   start(){this.state='recording';}
   stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob([bytes],{type:mime})});this.onstop?.();});}
  }
  window.MediaRecorder=RealFileRecorder;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>Promise.resolve({getTracks:()=>[{stop(){}}]})}});
  window.fetch=async(url,options)=>{if(!String(url).includes('/speech/analyze'))return originalFetch(url,options);report.requestCount++;report.requestFields=[...options.body.keys()];report.expectedTextSent=options.body.get('expected_text');report.manualContentType=Object.keys(options.headers).some(key=>key.toLowerCase()==='content-type');const start=performance.now();const response=await originalFetch(url,options);report.httpStatus=response.status;report.response=await response.clone().json();report.requestSeconds=(performance.now()-start)/1000;return response;};
  history.replaceState({},'','/patient/practice/session/ex-live?assignmentId=as-live');
  createRoot(document.querySelector('#app')).render(<App/>);
  const button=text=>[...document.querySelectorAll('#app main button')].find(b=>b.textContent.trim()===text);
  await until(()=>button('Start Recording'),'Practice did not load');button('Start Recording').click();await until(()=>button('Stop Recording'),'Recording did not start');await wait(100);button('Stop Recording').click();await until(()=>button('Submit for Analysis'),'Recording did not finish');
  await until(()=>document.querySelector('#app main audio')?.readyState>=1,'Real recording preview unavailable');const preview=document.querySelector('#app main audio');await preview.play();await wait(120);report.previewPlayed=!preview.paused&&preview.currentTime>0;preview.pause();assert(report.previewPlayed,'Real recording preview did not play');
  const started=performance.now();button('Submit for Analysis').click();
  await until(()=>button('Cancel Analysis'),'Processing state missing');report.processingMessageShown=document.querySelector('#app main').textContent.includes('Analyzing your speech. This may take around 20 seconds.');
  await wait(1100);report.elapsedTimerShown=/Elapsed: 0:0[1-9]/.test(document.querySelector('#app main').textContent);
  await until(()=>report.response&&!!button('View Attempt Details')||report.httpStatus>=400,'Real speech request did not finish',170000);report.totalUiSeconds=(performance.now()-started)/1000;
  if(report.httpStatus!==200){report.error='Backend returned HTTP '+report.httpStatus;output.textContent=JSON.stringify(report);return;}
  assert(report.requestCount===1,'Duplicate real analysis');assert(!report.manualContentType,'Manual multipart boundary');
  const attempt=storage.getAttempts().find(a=>a.exerciseId==='ex-live');assert(attempt,'Analysis was not persisted');report.attemptId=attempt.id;report.storedMetadata={patientId:attempt.patientId,assignmentId:attempt.assignmentId,exerciseId:attempt.exerciseId,submittedAt:attempt.submittedAt,reviewStatus:attempt.reviewStatus};report.exactResponsePersisted=JSON.stringify(attempt.analysis)===JSON.stringify(report.response);assert(report.exactResponsePersisted,'Response mapping changed values');
  if(report.response.words?.length){await until(()=>document.querySelector('#app main audio')?.readyState>=1,'Original recording not playable');const wordButton=document.querySelector('#app main button[aria-pressed]');wordButton.click();await until(()=>wordButton.getAttribute('aria-pressed')==='true','Real word playback did not start');const audio=document.querySelector('#app main audio');report.wordClickSeekSucceeded=wordButton.getAttribute('aria-pressed')==='true'&&Math.abs(audio.currentTime-report.response.words[0].start)<0.3;audio.pause();assert(report.wordClickSeekSucceeded,'Word seeking failed');}
  history.pushState({},'','/therapist/attempts');window.dispatchEvent(new PopStateEvent('popstate'));await until(()=>document.querySelector('#app main textarea'),'Review did not load');
  const textarea=document.querySelector('#app main textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(textarea,'Live integration review test.');textarea.dispatchEvent(new Event('input',{bubbles:true}));await wait(50);textarea.closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await until(()=>storage.getAttempts().find(a=>a.id===attempt.id)?.reviewStatus==='REVIEWED','Review status not saved');
  const reviewed=storage.getAttempts().find(a=>a.id===attempt.id);report.manualFeedbackSaved=reviewed.notes==='Live integration review test.';assert(report.manualFeedbackSaved,'Manual feedback not saved');
  report.completed=true;
 }catch(error){report.error=error.message;}
 finally{output.textContent=JSON.stringify(report,null,2);document.title=report.completed?'LIVE CHECK COMPLETE':'LIVE CHECK FAILED';}
});

window.__liveReady=true;
