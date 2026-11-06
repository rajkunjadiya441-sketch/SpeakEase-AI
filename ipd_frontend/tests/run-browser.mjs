import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
fs.mkdirSync('qa',{recursive:true});
await fetch('http://127.0.0.1:5173/',{signal:AbortSignal.timeout(3000)}).catch(()=>{throw new Error('Start npm run dev on 127.0.0.1:5173 before npm test.');});
const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required','--remote-debugging-port='+port,'--user-data-dir='+path.resolve('qa/cdp-profile'),'http://127.0.0.1:5173/tests/browser.html'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='';chrome.stderr.on('data',b=>{stderr+=b;});
let socket;let id=0;const pending=new Map();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let target;for(let i=0;i<100;i++){try{const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=tabs.find(t=>t.type==='page');if(target)break;}catch{}await delay(200);}if(!target)throw new Error('Headless browser did not expose a test page');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const callback=pending.get(message.id);pending.delete(message.id);if(message.error)callback.reject(new Error(JSON.stringify(message.error)));else callback.resolve(message.result);}};
 const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 await command('Page.enable');await command('Runtime.enable');
 let report;for(let i=0;i<180;i++){const result=await command('Runtime.evaluate',{expression:"document.getElementById('test-results')?.textContent",returnByValue:true});const text=result.result?.value;if(text&&text!=='RUNNING'){report=JSON.parse(text);break;}await delay(500);}if(!report)throw new Error('Browser test harness did not finish');
 fs.writeFileSync('qa/browser-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(report.localAudioAttemptId){
  await command('Page.navigate',{url:'http://127.0.0.1:5173/patient/history/'+report.localAudioAttemptId});await delay(1200);
  let actual;for(let poll=0;poll<100;poll++){const saved=await command('Runtime.evaluate',{expression:"JSON.stringify({source:document.querySelector('main audio')?.currentSrc,ready:document.querySelector('main audio')?.readyState,review:document.querySelector('main')?.textContent.includes('Reviewed'),error:document.querySelector('main [role=alert]')?.textContent})",returnByValue:true});actual=JSON.parse(saved.result.value);if(actual.ready>=1&&actual.review)break;await delay(100);}
  report.reloadMedia=actual;report.reloadPersistence=!!actual.source?.startsWith('blob:')&&actual.ready>=1&&actual.review;console.log('Native recording playback persists after reload:',report.reloadPersistence);if(!report.reloadPersistence)process.exitCode=1;
 }
 fs.writeFileSync('qa/browser-results.json',JSON.stringify(report,null,2));
 await command('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
 await command('Page.navigate',{url:'http://127.0.0.1:5173/patient/results-preview'});await delay(1200);
 fs.writeFileSync('qa/results-desktop.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(250);
 fs.writeFileSync('qa/results-mobile.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const width=await command('Runtime.evaluate',{expression:'JSON.stringify({viewport:innerWidth,body:document.documentElement.scrollWidth})',returnByValue:true});console.log('Mobile layout:',width.result.value);
 await command('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
 for(const [route,name] of [['/therapist/attempts','review-desktop'],['/patient/practice/session/ex-2?assignmentId=as-2','practice-desktop']]) { await command('Page.navigate',{url:'http://127.0.0.1:5173'+route}); await delay(800); fs.writeFileSync('qa/'+name+'.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64')); }
 if(report.failed||report.fatal)process.exitCode=1;
}catch(error){console.error(error);process.exitCode=1;}finally{socket?.close();if(chrome.pid)spawnSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});fs.writeFileSync('qa/browser-stderr.txt',stderr);}
