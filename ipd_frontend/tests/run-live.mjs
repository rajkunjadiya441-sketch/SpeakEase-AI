import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
fs.mkdirSync('qa',{recursive:true});
await fetch('http://127.0.0.1:5173/',{signal:AbortSignal.timeout(3000)}).catch(()=>{throw new Error('Start npm run dev on 127.0.0.1:5173 before npm test.');});
const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required','--remote-debugging-port='+port,'--user-data-dir='+path.resolve('qa/live-profile'),'http://127.0.0.1:5173/tests/live.html'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='';chrome.stderr.on('data',b=>{stderr+=b;});
let socket;let id=0;const pending=new Map();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let target;for(let i=0;i<100;i++){try{const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=tabs.find(t=>t.type==='page');if(target)break;}catch{}await delay(200);}if(!target)throw new Error('Headless browser did not expose a test page');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const callback=pending.get(message.id);pending.delete(message.id);if(message.error)callback.reject(new Error(JSON.stringify(message.error)));else callback.resolve(message.result);}};
 const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 await command('Page.enable');await command('Runtime.enable');
 await command('Page.navigate',{url:'http://127.0.0.1:5173/tests/live.html'});
 let ready=false;for(let i=0;i<100;i++){try{const value=await command('Runtime.evaluate',{expression:'window.__liveReady===true',returnByValue:true});if(value.result?.value){ready=true;break;}}catch{}await delay(100);}if(!ready)throw new Error('Live test page did not initialize');
 const file=path.resolve(process.argv[2] || '../test_audio/recording_2_test.wav');
 const source=fs.readFileSync(file);
 await command('Runtime.evaluate',{expression:'navigator.userAgent',returnByValue:true}).then(r=>console.log('Browser:',r.result.value));const {createHash}=await import('node:crypto');const hash=createHash('sha256').update(source).digest('hex');
 const document=await command('DOM.getDocument');const input=await command('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#real-recording'});await command('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});
 let report;for(let i=0;i<380;i++){const result=await command('Runtime.evaluate',{expression:"document.querySelector('#live-result')?.textContent",returnByValue:true});const text=result.result?.value;if(text&&text!=='WAITING_FOR_FILE'){report=JSON.parse(text);break;}await delay(500);}if(!report)throw new Error('Live browser request did not finish');
 report.sourceUnchanged=createHash('sha256').update(fs.readFileSync(file)).digest('hex')===hash&&report.sourceSha256===hash;
 if(report.completed){
  await command('Page.navigate',{url:'http://127.0.0.1:5173/patient/history/'+report.attemptId});await delay(1500);
  const persisted=await command('Runtime.evaluate',{expression:"JSON.stringify({transcript:document.querySelector('main')?.textContent,audio:document.querySelector('main audio')?.currentSrc,ready:document.querySelector('main audio')?.readyState})",returnByValue:true});const actual=JSON.parse(persisted.result.value);report.reloadVerified=actual.transcript.includes(report.response.transcript)&&actual.transcript.includes('Live integration review test.')&&actual.ready>=1&&actual.audio.startsWith('blob:');
 }
 await command('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});await delay(200);
 fs.writeFileSync('qa/playback-live-result.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));
 fs.writeFileSync('qa/playback-live-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.completed||!report.reloadVerified||!report.sourceUnchanged)process.exitCode=1;
}catch(error){console.error(error);process.exitCode=1;}finally{socket?.close();if(chrome.pid)spawnSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});fs.writeFileSync('qa/live-stderr.txt',stderr);}
