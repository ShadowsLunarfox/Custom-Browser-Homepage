// One Windows host, shared latest-state cache and explicit background opt-in.
(() => {
  const shared=globalThis.lunarWidgetBackground,api=shared?.api;
  if(!api?.runtime?.onConnect)return;
  const clients=new Set(),active=new Set(),pending=new Map();
  const alarm="lunar-windows-media-background",hostName="com.lunarfox.lunar_media";
  const commands=new Set(["status","play","pause","toggle","seekTo","seekBy","next","previous"]);
  let settings={enabled:false,background:false},latest=null,native=null,sequence=0,epoch=0,timer=0,polling=false,statusInFlight=null;
  let savedArtwork="",savedArtworkKey="";
  const ready=Promise.all([shared.readSetting("media"),shared.readCache("media"),shared.readCache("media-artwork")]).then(([saved,cached,art])=>{
    settings=saved;
    if(saved.enabled&&saved.background&&shared.fresh(cached)){
      latest=cached;
      if(art?.key===latest.snapshot?.artworkKey)latest.snapshot.artwork=art.data;
      savedArtwork=latest.snapshot.artwork || "";
      savedArtworkKey=latest.snapshot.artworkKey || "";
    }
  }).catch(()=>{});
  const hasPermission=async()=>{try{return Boolean(await api.permissions?.contains({permissions:["nativeMessaging"]}));}catch{return false;}};
  const wanted=()=>settings.enabled&&(settings.background||active.size>0);
  const nativeFailure=error=>{
    const message=String(error?.message||error||"").toLowerCase();
    if(message.includes("native messaging host not found"))return "bridge_missing";
    if(message.includes("forbidden")||message.includes("access is denied"))return "bridge_denied";
    if(message.includes("failed to start native messaging host"))return "bridge_start_failed";
    return /^bridge_|^permission_required$/.test(message)?message:"bridge_unavailable";
  };
  function clearCache(){latest=null;savedArtwork=savedArtworkKey="";void shared.clearCache("media");void shared.clearCache("media-artwork");}
  function fail(error){for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error(error));}pending.clear();}
  function stop(){epoch++;clearTimeout(timer);timer=0;polling=false;statusInFlight=null;clearCache();fail("bridge_unavailable");const old=native;native=null;try{old?.disconnect();}catch{}}
  function broadcast(message){for(const client of clients)shared.reply(client,message);}
  function cacheSnapshot(raw){
    if(typeof raw?.available!=="boolean")throw new Error("bridge_unavailable");
    const snapshot={available:raw.available};
    for(const key of ["sessionId","title","artist","app"])snapshot[key]=typeof raw[key]==="string"?raw[key].slice(0,1000):"";
    snapshot.artworkKey=typeof raw.artworkKey==="string"?raw.artworkKey.slice(0,3100):"";
    for(const key of ["playing","canPlay","canPause","canSeek","canPrevious","canNext"])snapshot[key]=raw[key]===true;
    for(const key of ["position","duration"])snapshot[key]=Number.isFinite(raw[key])?Math.max(0,Math.min(86400000,raw[key])):0;
    snapshot.rate=Number.isFinite(raw.rate)?Math.max(0,Math.min(16,raw.rate)):1;
    if(typeof raw.artwork==="string"&&raw.artwork.length<750000&&/^data:image\/(?:png|jpeg|webp|gif|bmp);base64,[a-z0-9+/=]+$/i.test(raw.artwork))snapshot.artwork=raw.artwork;
    else if(snapshot.available&&latest?.snapshot.artworkKey===snapshot.artworkKey)snapshot.artwork=latest.snapshot.artwork || "";
    else snapshot.artwork="";
    if(!snapshot.available)snapshot.artwork="";
    latest={snapshot,sampledAt:Math.max(Date.now(),(latest?.sampledAt||0)+1)};
    // Artwork is stored once per change, rather than copied every sampling tick.
    const slim={...snapshot};delete slim.artwork;
    void shared.writeCache("media",{snapshot:slim,sampledAt:latest.sampledAt});
    if(savedArtwork!==snapshot.artwork||savedArtworkKey!==snapshot.artworkKey){savedArtwork=snapshot.artwork;savedArtworkKey=snapshot.artworkKey;void shared.writeCache("media-artwork",{key:snapshot.artworkKey,data:snapshot.artwork});}
    return latest;
  }
  function connect(){
    if(native)return native;
    native=api.runtime.connectNative(hostName);const port=native;
    port.onMessage.addListener(message=>{
      if(native!==port)return;
      const request=pending.get(message?.id);if(!request)return;
      clearTimeout(request.timer);pending.delete(message.id);
      if(message.ok&&message.snapshot){try{const cached=cacheSnapshot(message.snapshot);request.resolve({...message,...cached});}catch(error){request.reject(error);}}
      else {if(message.error==="session_gone")clearCache();request.resolve(message);}
    });
    port.onDisconnect.addListener(()=>{
      const error=api.runtime.lastError;if(native!==port)return;
      native=null;clearCache();const reason=nativeFailure(error);fail(reason);broadcast({type:"disconnected",error:reason});
    });
    return port;
  }
  async function nativeRequest(command,extra={},owner=null){
    const token=epoch;
    if(!await hasPermission()||token!==epoch||!settings.enabled)throw new Error("permission_required");
    const body={id:`media-${++sequence}`,command,sessionId:extra.sessionId||"",artworkKey:String(extra.artworkKey||"").slice(0,3100)};
    if(command==="seekTo"||command==="seekBy")body.seconds=extra.seconds;
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{pending.delete(body.id);reject(new Error("bridge_timeout"));},9000);
      pending.set(body.id,{resolve,reject,timer:timeout,owner});
      try{connect().postMessage(body);}catch(error){clearTimeout(timeout);pending.delete(body.id);reject(new Error(nativeFailure(error)));}
    });
  }
  function readStatus(){
    if(!statusInFlight){
      const task=nativeRequest("status",{artworkKey:latest?.snapshot.artworkKey||""}).then(result=>{if(!result.ok)throw new Error(result.error||"bridge_unavailable");return result;});statusInFlight=task;
      void task.finally(()=>{if(statusInFlight===task)statusInFlight=null;}).catch(()=>{});
    }
    return statusInFlight;
  }
  async function poll(token){
    if(token!==epoch||!wanted())return;
    polling=true;let retry=2000;
    try{await readStatus();}
    catch(error){
      if(token!==epoch)return;
      clearCache();broadcast({type:"disconnected",error:nativeFailure(error)});retry=10000;
      if(error.message==="permission_required"){settings={enabled:false,background:false,consentVersion:2};void shared.writeSetting("media",settings);shared.alarm(alarm,false);stop();return;}
    }finally{if(token===epoch){polling=false;if(wanted())timer=setTimeout(()=>{timer=0;void poll(token);},retry);}}
  }
  async function ensure(){await ready;shared.alarm(alarm,settings.enabled&&settings.background);if(!wanted()){stop();return;}if(!polling&&!timer){const token=epoch;timer=setTimeout(()=>{timer=0;void poll(token);},shared.fresh(latest)?2000:0);}}
  function response(cached,id,artworkKey){const snapshot={...cached.snapshot};if(snapshot.artworkKey===artworkKey)delete snapshot.artwork;return{id,ok:true,snapshot,sampledAt:cached.sampledAt};}
  api.runtime.onConnect.addListener(client=>{
    if(client.name!=="lunar-windows-media")return;
    if(!shared.isClient(client)){client.disconnect();return;}
    clients.add(client);
    client.onMessage.addListener(async message=>{
      const id=message?.id;if(!Number.isSafeInteger(id))return;
      await ready;if(!clients.has(client))return;
      if(message.command==="configure"){
        if(message.enabled&&(message.consentVersion!==2||!await hasPermission())){shared.reply(client,{id,ok:false,error:"permission_required"});return;}
        try{settings=await shared.writeSetting("media",message);if(!settings.enabled){active.clear();stop();}await ensure();shared.reply(client,{id,ok:true,settings});}catch{shared.reply(client,{id,ok:false,error:"storage_failed"});}
        return;
      }
      if(!commands.has(message.command)){shared.reply(client,{id,ok:false,error:"unsupported_command"});return;}
      if(message.sessionId&&!/^[a-f0-9]{32}$/.test(message.sessionId)){shared.reply(client,{id,ok:false,error:"session_gone"});return;}
      if((message.command==="seekTo"||message.command==="seekBy")&&(!Number.isFinite(message.seconds)||Math.abs(message.seconds)>86400000)){shared.reply(client,{id,ok:false,error:"invalid_position"});return;}
      if(!settings.enabled||!await hasPermission()){shared.reply(client,{id,ok:false,error:"permission_required"});return;}
      if(!clients.has(client))return;
      active.add(client);
      try{
        if(message.command==="status"){
          const cached=shared.fresh(latest)?latest:await readStatus();
          if(!cached.ok&&cached.ok!==undefined){shared.reply(client,{id,ok:false,error:cached.error});return;}
          shared.reply(client,response(cached,id,message.artworkKey));void ensure();
        }else{
          const result=await nativeRequest(message.command,message,client);
          shared.reply(client,result.ok&&result.snapshot?response(result,id,message.artworkKey):{...result,id});
        }
      }catch(error){shared.reply(client,{id,ok:false,error:nativeFailure(error)});}
    });
    client.onDisconnect.addListener(()=>{
      clients.delete(client);active.delete(client);
      for(const[id,request]of pending)if(request.owner===client){clearTimeout(request.timer);pending.delete(id);request.reject(new Error("bridge_unavailable"));}
      if(!wanted())stop();
    });
  });
  api.permissions?.onRemoved?.addListener(change=>{
    if(!change.permissions?.includes("nativeMessaging"))return;
    settings={enabled:false,background:false,consentVersion:2};void shared.writeSetting("media",settings);active.clear();stop();shared.alarm(alarm,false);
    for(const client of clients){shared.reply(client,{type:"permission_revoked"});client.disconnect();}clients.clear();
  });
  api.alarms?.onAlarm?.addListener(event=>{if(event.name===alarm)void ensure();});
  api.runtime.onStartup?.addListener(()=>void ensure());
  void ensure();
})();
