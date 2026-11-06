import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../src/App';
import {recordingStore} from '../src/services/recordingStore';
import {storage} from '../src/mocks/storage';
import '../src/index.css';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function until(fn,message){for(let i=0;i<200;i++){if(fn())return;await wait(30);}throw new Error(message);}
export function NativeTestApp(){return <App/>;}
const root=createRoot(document.querySelector('#harness'));
const report={fixture:'Native MediaRecorder encodes AudioContext test tone into WebM/Opus. Physical microphone and analysis HTTP are controlled. No new real ASR/alignment claim.',checks:[]};
const originalFetch=window.fetch.bind(window),originalDevices=navigator.mediaDevices;
let context,oscillator,stream;
try {
 localStorage.clear();storage.resetDefaults();await recordingStore.clear();
 context=new AudioContext();await context.resume();const destination=context.createMediaStreamDestination();stream=destination.stream;oscillator=context.createOscillator();oscillator.connect(destination);oscillator.start();
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>Promise.resolve(stream)}});
 let submitted;
 window.fetch=async(url,options)=>{
  if(!String(url).includes('/speech/analyze'))return originalFetch(url,options);
  submitted=options.body.get('file');report.requestMime=submitted.type;
  return Response.json({status:'completed',processing_status:'completed',filename:'recording.webm',duration_seconds:1.8,expected_text:'Ship',transcript:'Controlled native media test.',words:[{word:'Test position',start:0.7,end:1.0}],model:'tiny',language:'en',alignment_status:'completed',alignment_error:null,unaligned_words:[]});
 };
 history.replaceState({},'','/patient/practice/session/ex-2?assignmentId=as-2');root.render(<NativeTestApp/>);
 const button=text=>[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===text);
 await until(()=>button('Start Recording'),'Practice not ready');button('Start Recording').click();await until(()=>button('Stop Recording'),'Native capture did not start');await wait(1800);button('Stop Recording').click();await until(()=>button('Submit for Analysis'),'Native capture did not stop');
 await until(()=>document.querySelector('main audio')?.readyState>=1,'Preview metadata unavailable');const preview=document.querySelector('main audio');await preview.play();await wait(120);assert(!preview.paused&&preview.currentTime>0,'Preview did not play');preview.pause();report.checks.push('Native WebM preview plays');
 button('Submit for Analysis').click();await until(()=>button('View Attempt Details'),'Analysis/save did not complete');
 const attempt=storage.getAttempts()[0],blob=await recordingStore.get(attempt.audioId);const a=new Uint8Array(await blob.arrayBuffer()),b=new Uint8Array(await submitted.arrayBuffer());assert(a.length===b.length&&a.every((value,index)=>value===b[index]),'Stored/submitted bytes differ');assert(attempt.audioBlobUrl===null&&attempt.audioId===attempt.id,'Transient URL persisted');
 report.nativeId=attempt.id;report.nativeMime=blob.type;report.nativeBytes=blob.size;report.sameSubmittedBytes=true;report.checks.push('Binary IndexedDB recording matches submitted original bytes');
 const savedAudio=()=>document.querySelector('main audio[data-recording-id="'+attempt.audioId+'"]');
 await until(()=>savedAudio()?.readyState>=1,'Post-analysis recording unavailable');await savedAudio().play();await wait(80);assert(!savedAudio().paused,'Post-analysis audio did not play');savedAudio().pause();report.checks.push('Post-analysis recording plays');
 button('View Attempt Details').click();await until(()=>document.querySelector('main h1')?.textContent==='Attempt Details','Details route not ready');await until(()=>savedAudio()?.readyState>=1,'Details recording unavailable');await until(()=>!document.querySelector('main button[aria-pressed]')?.disabled,'Word chip not ready');const word=document.querySelector('main button[aria-pressed]');word.click();await until(()=>word.getAttribute('aria-pressed')==='true','Word seek did not succeed');await wait(60);assert(!savedAudio().paused&&savedAudio().currentTime>=0.7,'Details word did not play');savedAudio().pause();report.checks.push('Navigated details word click seeks and plays');
 const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
 const legacy={...attempt,id:'legacy-'+attempt.id,audioId:undefined,audioBlobUrl:data,targetText:'Legacy native WebM recording'};storage.setAttempts([legacy,...storage.getAttempts()]);report.legacyId=legacy.id;report.legacyBytes=blob.size;
 report.completed=true;
} catch(error){report.failure=error.stack;const audio=document.querySelector('main audio');report.mediaDiagnostic=audio?{time:audio.currentTime,paused:audio.paused,ready:audio.readyState,seeking:audio.seeking,duration:String(audio.duration),error:audio.error?.message,seekable:Array.from({length:audio.seekable.length},(_,i)=>[audio.seekable.start(i),audio.seekable.end(i)]),text:document.querySelector('main')?.textContent}:null;}
finally {window.fetch=originalFetch;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:originalDevices});oscillator?.stop();stream?.getTracks().forEach(track=>track.stop());await context?.close();document.querySelector('#native-result').textContent=JSON.stringify(report);}
