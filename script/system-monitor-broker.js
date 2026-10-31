// A single sampler serves all modern pages and optional background operation.
(() => {
  const shared=globalThis.lunarWidgetBackground,api=shared?.api;
  if(!api?.runtime?.onConnect)return;
  const permissions=["system.cpu","system.memory"],clients=new Set(),connected=new Set();
  const alarm="lunar-system-monitor-background";
  const {cpuSample,cpuUsage,memoryUsage}=globalThis.lunarSystemUsage;
  let settings={enabled:false,background:false},latest=null,previous=null,timer=0,epoch=0,running=false;
  const ready=Promise.all([shared.readSetting("system"),shared.readCache("system")]).then(([saved,cached])=>{settings=saved;if(saved.enabled&&saved.background&&shared.fresh(cached))latest=cached;}).catch(()=>{});
  const hasPermission=async()=>{try{return Boolean(await api.permissions?.contains({permissions}));}catch{return false;}};
  const wanted=()=>settings.enabled&&settings.background||clients.size>0;
  function clear() {latest=previous=null;void shared.clearCache("system");}
  function stop() {epoch++;clearTimeout(timer);timer=0;running=false;clear();}
  function publish(message) {for(const client of clients)shared.reply(client,message);}
  async function sample(token) {
    if(token!==epoch||!wanted())return;
    let timeout;
    try {
      if(!await hasPermission())throw new Error("permission_required");
      if(token!==epoch||!wanted())return;
      if(!api.system?.cpu?.getInfo||!api.system?.memory?.getInfo)throw new Error("unsupported");
      const [cpu,memory]=await Promise.race([Promise.all([api.system.cpu.getInfo(),api.system.memory.getInfo()]),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error("read_failed")),5000);})]);
      if(token!==epoch||!wanted())return;
      const current=cpuSample(cpu),usage=cpuUsage(previous,current),mem=memoryUsage(memory);
      previous=current;
      // Keep a fresh restored CPU value until the second new sample is ready.
      const restored=usage===null&&shared.fresh(latest)?latest:null;
      latest={snapshot:{cpu:usage ?? restored?.snapshot?.cpu ?? null,memory:mem},phase:usage===null?"sampling":"live",sampledAt:restored?.sampledAt || Date.now()};
      void shared.writeCache("system",latest);publish({type:"snapshot",...latest});
    } catch(error) {
      if(token!==epoch)return;
      clear();publish({type:"unavailable",error:error.message});
      if(error.message==="permission_required"){
        settings={enabled:false,background:false,consentVersion:2};void shared.writeSetting("system",settings);
        shared.alarm(alarm,false);clients.clear();stop();return;
      }
    } finally {
      clearTimeout(timeout);
      if(token===epoch&&wanted())timer=setTimeout(()=>void sample(token),2000);
    }
  }
  async function ensure() {
    await ready;
    shared.alarm(alarm,settings.enabled&&settings.background);
    if(!wanted()){stop();return;}
    if(running)return;
    running=true;void sample(epoch);
  }
  api.runtime.onConnect.addListener(client=>{
    if(client.name!=="lunar-system-monitor")return;
    if(!shared.isClient(client)){client.disconnect();return;}
    connected.add(client);
    client.onMessage.addListener(async message=>{
      const id=message?.id;if(!Number.isSafeInteger(id))return;
      await ready;
      if(!connected.has(client))return;
      if(message.command==="configure"){
        if(message.enabled && (message.consentVersion!==2||!await hasPermission())){shared.reply(client,{id,ok:false,error:"permission_required"});return;}
        try {
          settings=await shared.writeSetting("system",message);
          if(!settings.enabled){clients.clear();stop();}
          await ensure();shared.reply(client,{id,ok:true,settings});
        }catch{shared.reply(client,{id,ok:false,error:"storage_failed"});}
        return;
      }
      if(message.command!=="status"||message.consentVersion!==2){shared.reply(client,{id,ok:false,error:"unsupported_command"});return;}
      if(!settings.enabled||!await hasPermission()){shared.reply(client,{id,ok:false,error:"permission_required"});return;}
      if(!connected.has(client))return;
      clients.add(client);
      if(shared.fresh(latest))shared.reply(client,{id,ok:true,...latest});
      else shared.reply(client,{id,ok:true,snapshot:null,phase:"sampling"});
      void ensure();
    });
    client.onDisconnect.addListener(()=>{connected.delete(client);clients.delete(client);if(!wanted())stop();});
  });
  api.permissions?.onRemoved?.addListener(change=>{
    if(!change.permissions?.some(permission=>permissions.includes(permission)))return;
    settings={enabled:false,background:false,consentVersion:2};void shared.writeSetting("system",settings);
    publish({type:"permission_revoked"});clients.clear();stop();shared.alarm(alarm,false);
  });
  api.alarms?.onAlarm?.addListener(event=>{if(event.name===alarm)void ensure();});
  api.runtime.onStartup?.addListener(()=>void ensure());
  void ensure();
})();
