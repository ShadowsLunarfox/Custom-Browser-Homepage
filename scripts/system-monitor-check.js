// Isolated localhost fixture: deterministic API values, no real hardware access.
(async () => {
  const key='lunarSystemMonitor:v1',results=[],listeners=[];
  let frame,win,doc,granted=false,answer=false,requests=0,calls=0,ticks=0,fail=false,releaseSample;
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const wait=async predicate=>{const until=Date.now()+10000;while(Date.now()<until){if(predicate())return;await delay(25);}throw new Error('System monitor check timed out');};
  const node=name=>doc.getElementById('monitor-'+name);
  const record=scenario=>{results.push({scenario,passed:true});const item=document.createElement('li');item.textContent='PASS: '+scenario;document.querySelector('ol').append(item);};
  const fake={
    runtime:{id:'system-monitor-fixture'},
    permissions:{contains:async()=>granted,request:async options=>{assert(options.permissions.length===2&&options.permissions.includes('system.cpu')&&options.permissions.includes('system.memory'),'Unexpected permissions requested');requests++;granted=answer;return granted;},remove:async options=>{assert(!options.permissions.includes('nativeMessaging'),'System monitor revoked media permission');granted=false;listeners.forEach(fn=>fn({permissions:['system.cpu','system.memory']}));return true;},onRemoved:{addListener:fn=>listeners.push(fn)}},
    system:{cpu:{getInfo:async()=>{calls++;if(fail)throw new Error('Fixture read failure');if(releaseSample==='pending')await new Promise(resolve=>{releaseSample=resolve;});ticks++;return{processors:[{usage:{total:ticks*1000,idle:ticks*600}},{usage:{total:ticks*1000,idle:ticks*600}}]};}},memory:{getInfo:async()=>({capacity:16*1024**3,availableCapacity:6*1024**3})}}
  };
  const open=async(path='../home.html')=>{
    // Hold each fixture at the general agreement gate until its fake API is bound.
    // Monitor-specific consent and browser permission remain unchanged across visits.
    localStorage.removeItem('lunarLegalConsent:v1');
    frame?.remove();frame=document.createElement('iframe');frame.src=path;
    frame.addEventListener('load',()=>{frame.contentWindow.__lunarSystemMonitorTestApi=fake;});document.body.append(frame);
    await wait(()=>frame.contentDocument?.body?.classList.contains('app-ready'));
    win=frame.contentWindow;doc=frame.contentDocument;
  };
  try {
    localStorage.setItem(key,JSON.stringify({visible:true}));
    await open();await delay(150);
    assert(doc.querySelector('#system-monitor').hidden&&calls===0&&requests===0,'Default-off widget accessed system data');
    doc.querySelector('#toggle-system-monitor').click();
    assert(doc.querySelector('#monitor-setup-dialog').open,'Setup disclosure was not shown');
    doc.querySelector('#monitor-setup-dialog [type=submit]').click();
    assert(calls===0&&requests===0,'Closing the disclosure granted access');
    doc.querySelector('#toggle-system-monitor').click();node('enable').click();
    await wait(()=>requests===1&&!node('enable').disabled);
    assert(calls===0&&doc.querySelector('#system-monitor').hidden,'Denied permission accessed hardware');
    record('Default-off, disclosure cancellation and denied permission perform no CPU or memory reads');

    node('background').checked=false;
    answer=true;node('enable').click();
    await wait(()=>calls>0&&node('memory-value').textContent.includes('63'));
    assert(node('cpu-value').textContent==='—','First CPU sample fabricated a usage percentage');
    await wait(()=>node('cpu-value').textContent==='40%');
    assert(Number(node('cpu-meter').getAttribute('aria-valuenow'))===40,'CPU meter is inaccurate');
    assert(Number(node('memory-meter').getAttribute('aria-valuenow'))===62.5&&node('memory-detail').textContent.includes('10.0 / 16.0'),'Memory usage or GiB detail is inaccurate');
    assert(!localStorage.getItem('lunarWindowsMediaWidget:v1'),'Enabling monitor changed media preferences');
    assert(!Object.keys(localStorage).some(name=>name.startsWith('lunarShared:v1:')&&name.includes('monitor')),'Monitor preferences leaked into shared state');
    record('Explicit permission enables interval-based CPU usage, physical memory percentages and used/total GiB without media access');

    node('hide').click();const hiddenCalls=calls;await delay(2200);
    assert(calls===hiddenCalls&&node('cpu-value').textContent==='—','Hidden widget kept polling or retained readings');
    doc.querySelector('#toggle-system-monitor').click();await wait(()=>node('cpu-value').textContent==='40%');
    assert(requests===2,'Reopening an enabled widget requested permission again');
    let visibility='hidden';Object.defineProperty(doc,'visibilityState',{configurable:true,get:()=>visibility});doc.dispatchEvent(new win.Event('visibilitychange'));
    const backgroundCalls=calls;await delay(2200);
    assert(calls===backgroundCalls&&node('memory-value').textContent==='—','Background page kept polling or retained readings');
    visibility='visible';doc.dispatchEvent(new win.Event('visibilitychange'));await wait(()=>node('cpu-value').textContent==='40%');
    record('With background updates off, hiding the widget or page pauses sampling and clears readings');

    releaseSample='pending';node('retry').click();await wait(()=>typeof releaseSample==='function');
    node('hide').click();releaseSample();await delay(150);
    assert(node('cpu-value').textContent==='—'&&node('memory-value').textContent==='—','An old result restored hidden readings');
    releaseSample=undefined;doc.querySelector('#toggle-system-monitor').click();await wait(()=>node('memory-value').textContent!=='—');
    fail=true;node('retry').click();await wait(()=>!node('retry').hidden);
    assert(node('cpu-value').textContent==='—','Read failure retained old measurements');
    fail=false;node('retry').click();await wait(()=>node('cpu-value').textContent==='40%');
    record('Late results cannot restore hidden values; read failures clear data and recover through retry');

    for(const language of ['en','zh-CN','ja','ko','th','ms']){
      await win.loadLanguage(language);win.applyTranslations();
      assert(!node('heading').textContent.startsWith('monitor.'),'Missing localized monitor title');
      for(const theme of ['light','dark']){
        win.eval(`state.settings.theme=${JSON.stringify(theme)};applyThemeSettings()`);
        frame.style.width='390px';win.dispatchEvent(new win.Event('resize'));await delay(40);
        const bounds=doc.querySelector('#system-monitor').getBoundingClientRect();
        assert(bounds.left>=0&&bounds.right<=win.innerWidth+1,'Monitor overflows a narrow viewport');
        assert(win.getComputedStyle(node('cpu-value')).color!==win.getComputedStyle(doc.querySelector('#system-monitor')).backgroundColor,'Theme obscured readings');
      }
    }
    record('All six interface languages, light/dark themes and narrow viewport bounds remain usable');
    const player=doc.getElementById('windows-media-player');player.hidden=false;await delay(150);
    assert(doc.getElementById('system-monitor').getBoundingClientRect().bottom<=player.getBoundingClientRect().top,'Default narrow-screen docks overlap');
    player.hidden=true;await delay(150);
    record('The narrow-screen monitor dock leaves space for the media widget without enabling media access');
    if(new URLSearchParams(location.search).has('preview')){frame.style.opacity='1';return;}

    await open();await wait(()=>node('cpu-value').textContent!=='—');
    assert(requests===2,'Saved consent was not reused after reload');
    node('manage').click();node('disable').click();await wait(()=>doc.querySelector('#system-monitor').hidden);
    const disabledCalls=calls;await delay(2200);
    assert(calls===disabledCalls&&!JSON.parse(localStorage.getItem(key)).enabled,'Disable did not stop and persist the revocation');
    doc.querySelector('#monitor-setup-dialog [type=submit]').click();doc.querySelector('#toggle-system-monitor').click();node('enable').click();await wait(()=>!doc.querySelector('#system-monitor').hidden);
    granted=false;listeners.forEach(fn=>fn({permissions:['system.cpu']}));
    assert(doc.querySelector('#system-monitor').hidden&&node('memory-value').textContent==='—','Browser permission revocation did not clear and hide the widget');
    record('Reload reuses consent; disable and external permission revocation stop access and erase temporary readings');

    await open('../legacy/home.html');
    assert(!doc.querySelector('#system-monitor')&&!win.lunarSystemMonitor,'Legacy mode loaded the new widget');
    assert(!win.performance.getEntriesByType('resource').some(entry=>/06-system-monitor\.js/.test(entry.name)),'Legacy mode loaded system polling code');
    record('Legacy mode loads no system monitor UI or monitoring code');
  }catch(error){results.push({scenario:error.stack||error.message,passed:false});}
  finally {
    if(!new URLSearchParams(location.search).has('preview')){
      frame?.remove();localStorage.removeItem(key);
      await fetch('/__viewport-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passed:results.filter(result=>result.passed).length,total:results.length,results})});
    }
  }
})();
