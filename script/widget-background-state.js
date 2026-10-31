// Durable opt-in settings and browser-session-only latest readings. No history.
(() => {
  const api = typeof chrome !== "undefined" ? chrome : typeof browser !== "undefined" ? browser : null;
  const queues = new Map();
  const settingKey = feature => `lunarBackgroundWidget:v2:${feature}`;
  const cacheKey = feature => `lunarWidgetLatest:v2:${feature}`;
  const setting = value => ({enabled:value?.enabled === true && value?.consentVersion === 2, background:value?.background === true, consentVersion:2});
  function enqueue(key, action) {
    const next = (queues.get(key) || Promise.resolve()).catch(() => {}).then(action);
    queues.set(key, next); return next;
  }
  globalThis.lunarWidgetBackground = {
    api,
    isClient: client => client.sender?.id === api?.runtime?.id && client.sender?.url?.split(/[?#]/)[0] === api.runtime.getURL("home.html"),
    async readSetting(feature) { const key=settingKey(feature); return setting((await api?.storage?.local?.get(key))?.[key]); },
    async writeSetting(feature, value) { const key=settingKey(feature),clean=setting(value); await enqueue(key,()=>api?.storage?.local?.set({[key]:clean})); return clean; },
    async readCache(feature) { const key=cacheKey(feature); return (await api?.storage?.session?.get(key))?.[key] || null; },
    writeCache(feature, value) { const key=cacheKey(feature); return enqueue(key,()=>api?.storage?.session?.set({[key]:value})).catch(()=>{}); },
    clearCache(feature) { const key=cacheKey(feature); return enqueue(key,()=>api?.storage?.session?.remove(key)).catch(()=>{}); },
    fresh: value => Number.isFinite(value?.sampledAt) && Date.now()-value.sampledAt >= 0 && Date.now()-value.sampledAt < 10000,
    reply(client, value) { try { client.postMessage(value); } catch {} },
    alarm(name, enabled) {
      try { const task=enabled?api?.alarms?.create(name,{periodInMinutes:1}):api?.alarms?.clear(name);task?.catch?.(()=>{}); } catch {}
    }
  };
})();
