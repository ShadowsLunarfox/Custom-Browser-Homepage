// Modern-only display of shared background readings; no history, backup or upload.
(() => {
  const PREFS_KEY = "lunarSystemMonitor:v1";
  const PERMISSIONS = ["system.cpu", "system.memory"];
  const CONSENT_VERSION = 2;
  const SAMPLE_MS = 2000;
  let initialized = false, granted = false, busy = false, disposed = false;
  let panel, toggle, prefs = {}, previousCpu = null, latest = null;
  let timer = 0, generation = 0, actionSequence = 0;
  let phase = "sampling", setupNotice = "";
  let boundPermissions = null;
  let broker = null, brokerSequence = 0;
  const brokerRequests = new Map();
  const {cpuSample,cpuUsage,memoryUsage} = globalThis.lunarSystemUsage;
  const defaults = {
    sampling: "Measuring CPU usage…", live: "Whole computer · updates every 2 seconds",
    error: "Could not read system usage. Try again.", unsupported: "System monitoring is not available in this browser. Open the installed extension in Chrome or Edge.",
    permission_denied: "CPU and memory access was not granted.", disabled: "System monitoring is disabled.",
    active: "CPU and memory access is enabled.", memory_detail: "{used} / {total} GiB used"
  };
  const node = name => document.getElementById(`monitor-${name}`);
  const api = () => location.hostname === "127.0.0.1" && window.__lunarSystemMonitorTestApi
    ? window.__lunarSystemMonitorTestApi
    : typeof chrome !== "undefined" ? chrome : typeof browser !== "undefined" ? browser : null;
  const supported = () => Boolean(api()?.runtime?.id && api()?.permissions?.request);
  const enabled = () => prefs.enabled === true && prefs.consentVersion === CONSENT_VERSION && granted;
  const visible = () => enabled() && prefs.visible !== false && document.visibilityState === "visible" && !disposed;
  const label = (key, values = {}) => {
    const translated = typeof t === "function" ? t(`monitor.${key}`, values) : "";
    if (translated && translated !== `monitor.${key}`) return translated;
    return Object.entries(values).reduce((text, [name,value]) => text.replaceAll(`{${name}}`, value), defaults[key] || key);
  };
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* A storage failure cannot grant access on the next visit. */ } };
  function readPrefs() {
    try { const value = JSON.parse(localStorage.getItem(PREFS_KEY)); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
  }
  async function hasPermission() {
    try { return Boolean(await api()?.permissions?.contains({ permissions: PERMISSIONS })); } catch { return false; }
  }
  function bindPermissions() {
    const permissions = api()?.permissions;
    if (!permissions || permissions === boundPermissions) return;
    boundPermissions = permissions;
    permissions.onRemoved?.addListener(change => { if (change.permissions?.some(permission => PERMISSIONS.includes(permission))) { resetAccess(); localize(); } });
  }

  const usesBroker = () => Boolean(api()?.runtime?.connect) && !(location.hostname === "127.0.0.1" && window.__lunarSystemMonitorTestApi);
  function applyBackground(message) {
    if (!visible()) return;
    latest = message.snapshot || null;
    phase = message.phase || "sampling";
    localize();
  }
  function connectBroker() {
    if (broker) return broker;
    const port = api().runtime.connect({name:"lunar-system-monitor"}); broker = port;
    port.onMessage.addListener(message => {
      if (broker !== port) return;
      if (message.type === "permission_revoked") { resetAccess(); return; }
      if (message.type === "snapshot") { applyBackground(message); return; }
      if (message.type === "unavailable") { latest = null; phase = message.error === "unsupported" ? "unsupported" : "error"; localize(); return; }
      const request = brokerRequests.get(message.id);
      if (!request) return;
      clearTimeout(request.timer); brokerRequests.delete(message.id);
      if (message.ok) request.resolve(message); else request.reject(new Error(message.error || "read_failed"));
    });
    port.onDisconnect.addListener(() => {
      if (broker !== port) return;
      const error = api()?.runtime?.lastError;
      broker = null;
      for (const request of brokerRequests.values()) { clearTimeout(request.timer); request.reject(new Error(error?.message || "read_failed")); }
      brokerRequests.clear();
      if (visible()) {
        latest = null; phase = "error"; localize();
        clearTimeout(timer); timer = setTimeout(() => { if (visible()) void resume(); },2000);
      }
    });
    return port;
  }
  function brokerRequest(command, extra = {}) {
    const port = connectBroker(),id = ++brokerSequence;
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { brokerRequests.delete(id); reject(new Error("read_failed")); },8000);
      brokerRequests.set(id,{resolve,reject,timer});
      try { port.postMessage({id,command,consentVersion:CONSENT_VERSION,...extra}); }
      catch(error) { clearTimeout(timer); brokerRequests.delete(id); reject(error); }
    });
  }
  function disconnectBroker() {
    const port = broker; broker = null;
    for (const request of brokerRequests.values()) { clearTimeout(request.timer); request.reject(new Error("read_failed")); }
    brokerRequests.clear();
    try { port?.disconnect(); } catch {}
  }
  async function configureBackground(enabled = prefs.enabled, background = prefs.background) {
    if (!usesBroker()) return;
    try { await brokerRequest("configure",{enabled:enabled === true,background:background === true}); }
    finally { if (!visible()) disconnectBroker(); }
  }
  function setMeter(name, value) {
    const meter = node(`${name}-meter`);
    meter.style.setProperty("--usage", `${value ?? 0}%`);
    if (value === null) { meter.removeAttribute("aria-valuenow"); meter.setAttribute("aria-valuetext", label(phase)); }
    else { meter.setAttribute("aria-valuenow", value.toFixed(1)); meter.removeAttribute("aria-valuetext"); }
  }
  function renderReadings() {
    const locale = document.documentElement.lang || "en";
    const percent = new Intl.NumberFormat(locale, {style:"percent", maximumFractionDigits:0});
    node("cpu-value").textContent = latest?.cpu === null || !latest ? "—" : percent.format(latest.cpu / 100);
    node("memory-value").textContent = latest ? percent.format(latest.memory.percent / 100) : "—";
    setMeter("cpu", latest?.cpu ?? null); setMeter("memory", latest?.memory.percent ?? null);
    const number = new Intl.NumberFormat(locale, {minimumFractionDigits:1, maximumFractionDigits:1});
    node("memory-detail").textContent = latest ? label("memory_detail", {used:number.format(latest.memory.used / 1024 ** 3), total:number.format(latest.memory.total / 1024 ** 3)}) : "—";
  }
  function localize() {
    if (!initialized) return;
    renderReadings();
    const status = label(phase);
    if (node("status").textContent !== status) node("status").textContent = status;
    node("retry").hidden = !["error", "unsupported"].includes(phase);
    node("enable").hidden = enabled();
    node("enable").disabled = busy || !supported();
    node("disable").hidden = !prefs.enabled;
    node("disable").disabled = busy;
    node("background").disabled = busy;
    node("consent-status").textContent = !supported() ? label("unsupported") : setupNotice ? label(setupNotice) : enabled() ? label("active") : "";
  }
  function renderVisibility() {
    panel.hidden = !enabled() || prefs.visible === false;
    toggle.setAttribute("aria-pressed", String(!panel.hidden));
    const player = document.getElementById("windows-media-player");
    const playerHeight = player && !player.hidden ? player.getBoundingClientRect().height : 0;
    panel.style.setProperty("--monitor-bottom", `${playerHeight ? playerHeight + 34 : 18}px`);
    if (!panel.hidden && typeof keepPanelInViewport === "function") requestAnimationFrame(() => keepPanelInViewport(panel));
  }
  function stop() {
    generation++;
    clearTimeout(timer); timer = 0;
    disconnectBroker();
    previousCpu = latest = null;
    phase = "sampling";
    localize();
  }
  function resetAccess() {
    actionSequence++;
    granted = false; prefs.enabled = false; prefs.consentVersion = 0;
    savePrefs(); stop(); renderVisibility();
  }
  async function sample(epoch) {
    if (epoch !== generation || !visible()) return;
    let timeout;
    try {
      if (usesBroker()) {
        const result = await brokerRequest("status");
        if (epoch === generation && visible()) applyBackground(result);
        return;
      }
      if (!api()?.system?.cpu?.getInfo || !api()?.system?.memory?.getInfo) { phase = "unsupported"; localize(); return; }
      const [cpu, memory] = await Promise.race([
        Promise.all([api().system.cpu.getInfo(), api().system.memory.getInfo()]),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("System sample timed out")), 5000); })
      ]);
      if (epoch !== generation || !visible()) return;
      const current = cpuSample(cpu);
      latest = {cpu:cpuUsage(previousCpu, current), memory:memoryUsage(memory)};
      previousCpu = current;
      phase = latest.cpu === null ? "sampling" : "live";
    } catch {
      if (epoch !== generation || !visible()) return;
      previousCpu = latest = null;
      phase = "error";
      if (!await hasPermission()) {
        if (epoch === generation) resetAccess();
        return;
      }
    } finally {
      clearTimeout(timeout);
      if (epoch === generation && visible()) {
        localize();
        if (phase !== "unsupported" && !usesBroker()) timer = setTimeout(() => void sample(epoch), SAMPLE_MS);
      }
    }
  }
  async function resume() {
    bindPermissions();
    stop();
    if (!prefs.enabled || prefs.consentVersion !== CONSENT_VERSION || !supported() || disposed) { renderVisibility(); return; }
    const epoch = generation;
    const allowed = await hasPermission();
    if (epoch !== generation || disposed) return;
    granted = allowed;
    if (!allowed) { resetAccess(); return; }
    renderVisibility();
    if (visible()) void sample(epoch);
  }
  function showSetup() {
    bindPermissions();
    setupNotice = ""; localize();
    node("background").checked = prefs.background !== false;
    document.getElementById("monitor-setup-dialog").showModal();
  }
  async function enableFromClick() {
    if (busy || !supported() || disposed) return;
    busy = true; setupNotice = ""; localize();
    const action = ++actionSequence;
    try {
      // Request directly from this button's gesture; never from page initialization.
      const allowed = await api().permissions.request({permissions:PERMISSIONS});
      if (action !== actionSequence || disposed) return;
      if (!allowed) { setupNotice = "permission_denied"; return; }
      granted = true;
      prefs.enabled = true; prefs.visible = true; prefs.consentVersion = CONSENT_VERSION;
      prefs.background = node("background").checked;
      await configureBackground(true,prefs.background);
      savePrefs(); renderVisibility();
      document.getElementById("monitor-setup-dialog").close();
      void resume();
    } catch { resetAccess(); try { await api()?.permissions?.remove({permissions:PERMISSIONS}); } catch {} setupNotice = "permission_denied"; }
    finally { busy = false; localize(); }
  }
  async function disableFromClick() {
    resetAccess(); setupNotice = "disabled"; localize();
    try { await configureBackground(false,false); } catch {}
    try { await api()?.permissions?.remove({permissions:PERMISSIONS}); } catch { /* Local monitoring remains disabled. */ }
  }
  function initialize() {
    if (initialized || document.documentElement.dataset.interfaceVersion !== "modern") return;
    panel = document.getElementById("system-monitor"); toggle = document.getElementById("toggle-system-monitor");
    if (!panel || !toggle) return;
    initialized = true; prefs = readPrefs();
    toggle.addEventListener("click", () => {
      if (!enabled()) { showSetup(); return; }
      prefs.visible = panel.hidden; savePrefs(); renderVisibility();
      if (prefs.visible) void resume(); else stop();
    });
    node("hide").addEventListener("click", () => { prefs.visible = false; savePrefs(); stop(); renderVisibility(); });
    node("manage").addEventListener("click", showSetup);
    node("enable").addEventListener("click", () => void enableFromClick());
    node("disable").addEventListener("click", () => void disableFromClick());
    node("background").addEventListener("change", async () => {
      if (!enabled()) return;
      prefs.background = node("background").checked; savePrefs();
      try { await configureBackground(); } catch { setupNotice = "error"; localize(); }
    });
    node("retry").addEventListener("click", () => void resume());
    bindPermissions();
    window.addEventListener("storage", event => {
      if (event.key !== PREFS_KEY && event.key !== null) return;
      actionSequence++; prefs = readPrefs();
      if (prefs.enabled && prefs.consentVersion === CONSENT_VERSION) void resume();
      else { granted = false; stop(); renderVisibility(); }
    });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void resume(); else stop(); });
    window.addEventListener("focus", () => { if (enabled() && prefs.visible !== false) void resume(); });
    window.addEventListener("resize", renderVisibility);
    // On narrow screens, keep the default dock above the optional media widget.
    const player = document.getElementById("windows-media-player");
    if (player && typeof ResizeObserver === "function") new ResizeObserver(renderVisibility).observe(player);
    window.addEventListener("pagehide", () => { disposed = true; actionSequence++; stop(); });
    window.addEventListener("pageshow", () => { if (disposed) { disposed = false; void resume(); } });
    renderVisibility(); localize(); void resume();
    if (!prefs.enabled || prefs.consentVersion !== CONSENT_VERSION) void configureBackground(false,false).catch(()=>{});
  }
  window.lunarSystemMonitor = {initialize, localize};
})();
