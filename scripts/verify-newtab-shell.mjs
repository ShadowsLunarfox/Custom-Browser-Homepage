// Isolated unpacked-extension check. No existing browser profile or native media host.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=process.cwd(),profile=await mkdtemp(path.join(tmpdir(),'lunar-newtab-qa-'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let edge,socket,send;
try{
 edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,`--disable-extensions-except=${root}`,`--load-extension=${root}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;for(let count=0;;count++){try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch(error){if(count>100)throw error;await pause(100);}}
 const endpoint=`http://127.0.0.1:${port}`;
 const targets=await(await fetch(endpoint+'/json/list')).json();
 socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl.replace('ws://localhost:','ws://127.0.0.1:'));
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 const pending=new Map(),contexts=new Map();let sequence=0;
 socket.onmessage=event=>{
   const message=JSON.parse(event.data);
   if(message.method==='Runtime.executionContextCreated')contexts.set(message.params.context.id,message.params.context);
   if(message.method==='Runtime.executionContextDestroyed')contexts.delete(message.params.executionContextId);
   if(message.method==='Runtime.executionContextsCleared')contexts.clear();
   if(!message.id)return;const item=pending.get(message.id);if(!item)return;
   pending.delete(message.id);clearTimeout(item.timer);if(message.error)item.reject(new Error(message.error.message));else item.resolve(message.result);
 };
 send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Command timed out: '+method));},10000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression,child=false)=>{
   let contextId;
   if(child){const tree=await send('Page.getFrameTree');const frame=tree.frameTree.childFrames?.[0]?.frame;if(!frame)return null;contextId=[...contexts.values()].find(context=>context.auxData?.frameId===frame.id&&context.auxData?.isDefault)?.id;if(!contextId)return null;}
   const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true,...(contextId?{contextId}:{})});
   if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
   return result.result.value;
 };
 const wait=async predicate=>{const until=Date.now()+15000;while(Date.now()<until){try{if(await predicate())return;}catch(error){if(!/context|frame|document|Cannot read|not defined/i.test(error.message))throw error;}await pause(100);}throw new Error('New Tab check timed out');};
 await send('Runtime.enable');await send('Page.enable');
 await send('Page.navigate',{url:'edge://newtab/'});
 await wait(()=>evaluate("Boolean(document.getElementById('lunar-start-frame'))"));
 const shellUrl=await evaluate('location.href');
 if(!shellUrl.endsWith('/newtab.html'))throw new Error('Browser did not retain the New Tab entry: '+shellUrl);
 await wait(()=>evaluate("Boolean(document.querySelector('#legal-consent-checkbox:not(:disabled)'))",true));
 await evaluate("document.querySelector('#legal-consent-checkbox').click();document.querySelector('#legal-consent-accept').click()",true);
 await wait(()=>evaluate("document.body.classList.contains('app-ready')",true));
 await evaluate("document.querySelector('[data-browser-theme]').click()",true);
 await wait(async()=>{
   const pages=await(await fetch(endpoint+'/json/list')).json();
   return pages.some(target=>target.url.startsWith('edge://settings/appearance'));
 });
 await send('Target.activateTarget',{targetId:targets.find(target=>target.type==='page').id});
 if(await evaluate("getHomepageNavigationTarget() !== parent",true))throw new Error('Search does not target the New Tab host');
 await evaluate("document.getElementById('toggle-system-monitor').click();document.getElementById('monitor-enable').click()",true);
 await wait(()=>evaluate("document.getElementById('monitor-cpu-meter').hasAttribute('aria-valuenow')",true));
 await evaluate("document.getElementById('interface-version').value='legacy';document.getElementById('interface-version').dispatchEvent(new Event('change'))",true);
 await wait(()=>evaluate("document.documentElement.dataset.interfaceVersion==='legacy'&&document.body.classList.contains('app-ready')",true));
 if(await evaluate('location.href')!==shellUrl)throw new Error('Switching to legacy exposed its URL');
 if(await evaluate("Boolean(window.lunarSystemMonitor||document.getElementById('system-monitor'))",true))throw new Error('Modern monitoring code leaked into legacy');
 await evaluate("document.getElementById('interface-version').value='modern';document.getElementById('interface-version').dispatchEvent(new Event('change'))",true);
 await wait(()=>evaluate("document.documentElement.dataset.interfaceVersion==='modern'&&document.body.classList.contains('app-ready')",true));
 await wait(()=>evaluate("document.getElementById('monitor-cpu-meter').hasAttribute('aria-valuenow')",true));
 if(await evaluate('location.href')!==shellUrl)throw new Error('Switching to modern exposed its URL');
 await evaluate("document.getElementById('monitor-manage').click();document.getElementById('monitor-disable').click()",true);
 await wait(()=>evaluate("document.getElementById('system-monitor').hidden",true));
 await evaluate("document.getElementById('monitor-setup-dialog').close();SEARCH_ENGINES.google.url=chrome.runtime.getURL('connector.html')+'?q=%s';document.getElementById('search-input').value='new tab navigation';document.getElementById('search-form').requestSubmit()",true);
 await wait(()=>evaluate("location.pathname==='/connector.html'"));
 if(await evaluate("Boolean(document.getElementById('lunar-start-frame'))"))throw new Error('Search provider remained embedded');
 console.log('PASS: native New Tab entry stays unchanged across modern/legacy switches; the browser theme button opens native Edge appearance; framed permissions and real CPU readings work; searches leave the host normally.');
 console.log(JSON.stringify({newTabDocument:shellUrl,searchDestination:await evaluate('location.pathname')}));
}finally{if(send)await send('Browser.close').catch(()=>{});socket?.close();edge?.kill();}
