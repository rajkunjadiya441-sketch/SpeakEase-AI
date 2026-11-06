import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
fs.mkdirSync('qa',{recursive:true});
await fetch('http://127.0.0.1:5173/',{signal:AbortSignal.timeout(3000)}).catch(()=>{throw new Error('Start npm run dev on 127.0.0.1:5173 before npm test.');});
const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required','--remote-debugging-port='+port,'--user-data-dir='+path.resolve('qa/native-profile'),'http://127.0.0.1:5173/tests/native-media.html'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='';chrome.stderr.on('data',b=>{stderr+=b;});
let socket;let id=0;const pending=new Map();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let target;for(let i=0;i<100;i++){try{const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=tabs.find(t=>t.type==='page');if(target)break;}catch{}await delay(200);}if(!target)throw new Error('Headless browser did not expose a test page');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const callback=pending.get(message.id);pending.delete(message.id);if(message.error)callback.reject(new Error(JSON.stringify(message.error)));else callback.resolve(message.result);}};
 const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 await command('Page.enable');await command('Runtime.enable');
 let report;for(let i=0;i<180;i++){const result=await command('Runtime.evaluate',{expression:"document.getElementById('native-result')?.textContent",returnByValue:true});const text=result.result?.value;if(text&&text!=='RUNNING'){report=JSON.parse(text);break;}await delay(500);}if(!report)throw new Error('Browser test harness did not finish');

 if(report.completed){
  report.reloadRoutes=[];
  for(const attemptId of [report.nativeId,report.legacyId]){
   for(const route of ['/patient/history/'+attemptId,'/patient/history','/therapist/attempts']){
    await command('Page.navigate',{url:'http://127.0.0.1:5173'+route});
    const expression=String.raw`(async()=>{
      const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let audio,word;
      for(let i=0;i<120;i++){
       if(location.pathname.startsWith('/patient/history/')){audio=document.querySelector('main audio');word=document.querySelector('main button[aria-pressed]');}
       else if(location.pathname==='/patient/history'){const link=[...document.querySelectorAll('main a')].find(a=>a.getAttribute('href')==='/patient/history/ATTEMPT');const card=link?.parentElement;audio=card?.querySelector('audio');word=card?.querySelector('button[aria-pressed]');}
       else {const media=[...document.querySelectorAll('main audio')];audio=media.find(a=>a.dataset.recordingId==='ATTEMPT');if(!audio){const form=[...document.querySelectorAll('main form')].find(f=>f.parentElement.textContent.includes('Legacy native WebM recording'));audio=form?.parentElement.querySelector('audio');}word=audio?.closest('[aria-label="Speech analysis results"]')?.querySelector('button[aria-pressed]');}
       if(audio?.readyState>=1&&word&&!word.disabled)break;await pause(50);
      }
      if(!audio||audio.readyState<1||!word||word.disabled)return {passed:false,error:'Audio or word chips not ready'};
      word.click();for(let i=0;i<100&&word.getAttribute('aria-pressed')!=='true';i++)await pause(20);
      const start=audio.currentTime;await pause(120);const result={passed:audio.currentSrc.startsWith('blob:')&&!audio.paused&&word.getAttribute('aria-pressed')==='true'&&start>=0.7&&audio.currentTime>start,sourceKind:audio.currentSrc.split(':')[0],selected:word.getAttribute('aria-pressed'),start,end:audio.currentTime,playing:!audio.paused};audio.pause();return result;
    })()`.replaceAll('ATTEMPT',attemptId);
    const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});report.reloadRoutes.push({attemptId,route,...result.result?.value});
   }
  }
  report.reloadVerified=report.reloadRoutes.every(result=>result.passed);
  await command('Page.navigate',{url:'http://127.0.0.1:5173/patient/history/'+report.nativeId});await delay(900);
  fs.writeFileSync('qa/native-playback.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 fs.writeFileSync('qa/native-media-after.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(report.failed||report.fatal||report.failure||!report.completed||!report.reloadVerified)process.exitCode=1;
}catch(error){console.error(error);process.exitCode=1;}finally{socket?.close();if(chrome.pid)spawnSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});fs.writeFileSync('qa/native-stderr.txt',stderr);}
