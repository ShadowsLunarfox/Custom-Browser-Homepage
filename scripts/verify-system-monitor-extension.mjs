// Read-only hardware smoke check in a fresh, hidden Edge profile. Never attaches to user profiles.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=process.cwd(),profile=await mkdtemp(path.join(tmpdir(),'lunar-system-extension-'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let edge,socket,send;
try {
  edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,`--disable-extensions-except=${root}`,`--load-extension=${root}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;
  for(let tries=0;;tries++){try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch(error){if(tries>100)throw error;await pause(100);}}
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl.replace('ws://localhost:','ws://127.0.0.1:'));
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  const pending=new Map();let id=0;
  socket.onmessage=event=>{const result=JSON.parse(event.data);if(result.id){const item=pending.get(result.id);if(!item)return;pending.delete(result.id);clearTimeout(item.timer);if(result.error)item.reject(new Error(result.error.message));else item.resolve(result.result);}};
  send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;const timer=setTimeout(()=>{pending.delete(next);reject(new Error(`Command timed out: ${method}`));},10000);pending.set(next,{resolve,reject,timer});socket.send(JSON.stringify({id:next,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  const wait=async predicate=>{const until=Date.now()+12000;while(Date.now()<until){if(await predicate())return;await pause(100);}throw new Error('Installed-extension smoke check timed out');};
  await send('Page.enable');
  let extensionId;
  await wait(async()=>{
    const list=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const worker=list.find(target=>/^chrome-extension:\/\/[a-p]+\/background\.js$/.test(target.url));
    extensionId=worker?.url.split('/')[2];return Boolean(extensionId);
  });
  await send('Page.navigate',{url:`chrome-extension://${extensionId}/home.html`});
  await wait(()=>evaluate("Boolean(document.querySelector('#legal-consent-checkbox:not(:disabled)'))"));
  await evaluate("document.querySelector('#legal-consent-checkbox').click();document.querySelector('#legal-consent-accept').click()");
  await wait(()=>evaluate("document.body.classList.contains('app-ready')"));
  await evaluate("document.getElementById('toggle-system-monitor').click();document.getElementById('monitor-enable').click()");
  await wait(()=>evaluate("document.getElementById('monitor-cpu-meter').hasAttribute('aria-valuenow')"));
  const readings=await evaluate("({cpu:Number(document.getElementById('monitor-cpu-meter').getAttribute('aria-valuenow')),memory:Number(document.getElementById('monitor-memory-meter').getAttribute('aria-valuenow')),detail:document.getElementById('monitor-memory-detail').textContent,fake:!!window.__lunarSystemMonitorTestApi,permission:chrome.permissions.contains({permissions:['system.cpu','system.memory']})})");
  if(readings.fake||!Number.isFinite(readings.cpu)||readings.cpu<0||readings.cpu>100||!Number.isFinite(readings.memory)||readings.memory<0||readings.memory>100)throw new Error('Invalid live hardware usage');
  readings.permission=await evaluate("chrome.permissions.contains({permissions:['system.cpu','system.memory']})");
  if(!readings.permission)throw new Error('System permissions were not granted');
  const firstStamp=await evaluate("chrome.storage.session.get('lunarWidgetLatest:v2:system').then(value=>value['lunarWidgetLatest:v2:system'].sampledAt)");
  await evaluate("localStorage.removeItem('lunarLegalConsent:v1')");
  await send('Page.navigate',{url:'about:blank'});await pause(2600);
  await send('Page.navigate',{url:`chrome-extension://${extensionId}/home.html`});
  await wait(()=>evaluate("Boolean(document.querySelector('#legal-consent-checkbox:not(:disabled)'))"));
  const closedPageStamp=await evaluate("chrome.storage.session.get('lunarWidgetLatest:v2:system').then(value=>value['lunarWidgetLatest:v2:system'].sampledAt)");
  if(closedPageStamp<=firstStamp)throw new Error('System sampling stopped while all homepages were closed');
  const openingAt=Date.now();
  await evaluate("document.querySelector('#legal-consent-checkbox').click();document.querySelector('#legal-consent-accept').click()");
  await wait(()=>evaluate("Boolean(document.getElementById('monitor-cpu-meter')?.hasAttribute('aria-valuenow'))"));
  const warmDisplayMs=Date.now()-openingAt;
  if(warmDisplayMs>=2000)throw new Error('Warm page waited for a new CPU interval');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});const output=path.join(profile,'system-monitor-live.png');await writeFile(output,Buffer.from(screenshot.data,'base64'));
  await evaluate("document.getElementById('monitor-manage').click();document.getElementById('monitor-disable').click()");
  await wait(()=>evaluate("document.getElementById('system-monitor').hidden"));
  if(await evaluate("chrome.permissions.contains({permissions:['system.cpu','system.memory']})"))throw new Error('Disable did not revoke real system permissions');
  if(await evaluate("chrome.storage.session.get('lunarWidgetLatest:v2:system').then(value=>Boolean(value['lunarWidgetLatest:v2:system']))"))throw new Error('Disable retained a latest-reading cache');
  console.log(JSON.stringify({result:'PASS: actual CPU/memory APIs, closed-page background sampling, warm display without a CPU-interval wait, permission revocation and cache clearing',readings,warmDisplayMs,screenshot:output},null,2));
} finally {if(send)await send('Browser.close').catch(()=>{});socket?.close();edge?.kill();}
