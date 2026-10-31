// Modern-only Windows media session widget. No media files or preferences enter shared sync.
(() => {
  const PREFS_KEY = "lunarWindowsMediaWidget:v1";
  const CONSENT_VERSION = 1;
  const fallbackArtwork = "resource/icons/lunar-v2-128.png";
  let initialized = false;
  let prefs = {};
  let panel, toggle, play, progress, title, artist, artwork, status;
  let port = null;
  let sequence = 0;
  let generation = 0;
  let lastApplied = 0;
  let selectedId = "";
  let artworkKey = "";
  let snapshot = null;
  let observedAt = 0;
  let connection = "offline";
  let connectionFailure = "bridge_unavailable";
  let setupNotice = "";
  let busy = false;
  let seeking = false;
  let seekSessionId = "";
  let pollTimer = 0;
  let tickTimer = 0;
  let notice = "";
  let noticeUntil = 0;
  let permissionGranted = false;
  let boundPermissions = null;
  let consentBusy = false;
  const requests = new Map();
  const defaults = {
    play: "Play", pause: "Pause", empty_title: "Nothing playing", empty_hint: "Play music or a video on your computer.",
    connecting: "Connecting to Windows…", offline: "Install or reconnect the Windows connector.", connected: "Connected to Windows media.",
    seek_unavailable: "This media source does not support seeking.", no_session: "No media session", unsupported: "The media source cannot perform this action.",
    session_gone: "This media session has closed. Refreshing…", extension_id: "Extension ID",
    permission_only: "Permission granted. {status}", connector_missing: "Windows connector not found. Install it, then check the connection.",
    connector_denied: "The connector does not allow this extension. Reinstall it with the extension ID shown here.",
    connector_start_failed: "The Windows connector could not start. Repair or reinstall it.",
    connector_timeout: "The Windows connector did not respond. Check the connection again.",
    connected_idle: "Windows connector connected. No current media session."
  };
  const label = key => {
    const value = typeof t === "function" ? t(`player.${key}`) : "";
    return value && value !== `player.${key}` ? value : defaults[key] || key;
  };
  const node = id => document.getElementById(`player-${id}`);
  const api = () => typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : null;
  const permissions = () => location.hostname === "127.0.0.1" && window.__lunarMediaTestPermissions ? window.__lunarMediaTestPermissions : api()?.permissions;
  const supported = () => /Win/i.test(navigator.userAgentData?.platform || navigator.platform || "");
  const enabled = () => prefs.enabled === true && prefs.consentVersion === CONSENT_VERSION && permissionGranted;
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} };
  const expanded = () => typeof prefs.expanded === "boolean" ? prefs.expanded : window.innerWidth > 640 && window.innerHeight > 600;
  const visible = () => enabled() && prefs.visible !== false && document.visibilityState !== "hidden";
  async function hasPermission() {
    try { return Boolean(await permissions()?.contains({ permissions: ["nativeMessaging"] })); } catch { return false; }
  }
  function connectionText() {
    if (connection === "connecting") return label("connecting");
    if (connection === "connected") return label(snapshot?.available ? "connected" : "connected_idle");
    return label(({bridge_missing:"connector_missing",bridge_denied:"connector_denied",bridge_start_failed:"connector_start_failed",bridge_timeout:"connector_timeout"})[connectionFailure] || "offline");
  }
  function updateSetup(message) {
    if (message !== undefined) setupNotice = message;
    node("enable").hidden = enabled();
    node("enable").disabled = consentBusy || !supported();
    node("disable").hidden = !prefs.enabled;
    node("disable").disabled = consentBusy;
    node("check").hidden = !enabled();
    node("check").disabled = connection === "connecting" || consentBusy;
    node("consent-status").textContent = setupNotice || (!supported() ? label("windows_only") : enabled() ? label("permission_only").replace("{status}", connectionText()) : "");
  }
  function stopMedia() {
    disconnect(); snapshot = null; busy = seeking = false; seekSessionId = "";
    artwork.src = fallbackArtwork;
    connection = "offline";
    renderVisibility(); localize();
  }
  function revokeLocally() {
    permissionGranted = false;
    prefs.enabled = false; prefs.visible = false; prefs.consentVersion = 0;
    savePrefs(); stopMedia(); updateSetup(label("disabled"));
  }
  function bindPermissions() {
    const current = permissions();
    if (!current || current === boundPermissions) return;
    boundPermissions = current;
    current.onRemoved?.addListener(change => { if (change.permissions?.includes("nativeMessaging")) revokeLocally(); });
  }
  function showSetup() {
    bindPermissions();
    node("extension-id").value = api()?.runtime?.id || "Preview";
    updateSetup("");
    document.getElementById("player-setup-dialog").showModal();
  }
  async function enableFromClick() {
    if (consentBusy || !supported()) return;
    consentBusy = true; updateSetup("");
    try {
      // This call must occur directly in the explicit consent button's user gesture.
      const granted = await permissions()?.request({ permissions: ["nativeMessaging"] });
      permissionGranted = Boolean(granted);
      if (!permissionGranted) { updateSetup(label("permission_denied")); return; }
      prefs.enabled = true; prefs.visible = true; prefs.consentVersion = CONSENT_VERSION;
      savePrefs(); renderVisibility();
      document.getElementById("player-setup-dialog").close();
      await reconnect();
    } catch { updateSetup(label("permission_denied")); }
    finally { consentBusy = false; updateSetup(); }
  }
  async function disableFromClick() {
    revokeLocally();
    try { await permissions()?.remove({ permissions: ["nativeMessaging"] }); } catch { /* Local consent remains off even when browser removal fails. */ }
  }
  const format = seconds => {
    seconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(seconds / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  };
  function position() {
    if (!snapshot?.available) return 0;
    const elapsed = snapshot.playing ? (performance.now() - observedAt) / 1000 * snapshot.rate : 0;
    return Math.max(0, Math.min(snapshot.duration, snapshot.position + elapsed));
  }
  function renderProgress() {
    if (!initialized || seeking) return;
    const seconds = position();
    const duration = snapshot?.duration || 0;
    progress.max = String(Math.max(1, Math.round(duration * 10)));
    progress.value = String(Math.round(seconds * 10));
    progress.style.setProperty("--player-progress", `${duration > 0 ? seconds / duration * 100 : 0}%`);
    progress.setAttribute("aria-valuetext", `${format(seconds)} / ${format(duration)}`);
    node("current").textContent = format(seconds);
    node("duration").textContent = format(duration);
  }
  function localize() {
    if (!initialized) return;
    const available = Boolean(snapshot?.available && connection === "connected");
    title.textContent = available ? snapshot.title || snapshot.app || label("empty_title") : label("empty_title");
    title.title = title.textContent;
    artist.textContent = available ? snapshot.artist || snapshot.app || "" : label("empty_hint");
    artist.title = artist.textContent;
    panel.classList.toggle("is-playing", Boolean(available && snapshot.playing));
    play.setAttribute("aria-label", label(snapshot?.playing ? "pause" : "play"));
    play.disabled = busy || !available || !(snapshot.playing ? snapshot.canPause : snapshot.canPlay);
    progress.disabled = busy || !available || !snapshot.canSeek;
    node("forward").disabled = node("rewind").disabled = progress.disabled;
    node("previous").disabled = busy || !available || !snapshot.canPrevious;
    node("next").disabled = busy || !available || !snapshot.canNext;
    status.textContent = performance.now() < noticeUntil ? notice : connection !== "connected" || !available ? connectionText() : !snapshot.canSeek ? label("seek_unavailable") : label("connected");
    node("setup").hidden = connection === "connected";
    updateSetup();
    renderProgress();
  }
  function renderVisibility() {
    panel.hidden = !enabled() || prefs.visible === false;
    panel.classList.toggle("is-compact", !expanded());
    toggle.setAttribute("aria-pressed", String(!panel.hidden));
    node("expand").setAttribute("aria-expanded", String(expanded()));
    if (typeof keepPanelInViewport === "function" && !panel.hidden) requestAnimationFrame(() => keepPanelInViewport(panel));
  }
  function normalize(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.available !== "boolean") throw new Error("invalid_snapshot");
    const clean = { ...raw };
    clean.position = Number.isFinite(raw.position) ? Math.max(0, raw.position) : 0;
    clean.duration = Number.isFinite(raw.duration) ? Math.max(0, Math.min(86400000, raw.duration)) : 0;
    clean.rate = Number.isFinite(raw.rate) ? Math.max(0, Math.min(16, raw.rate)) : 1;
    for (const key of ["title", "artist", "app", "sessionId"]) clean[key] = typeof raw[key] === "string" ? raw[key].slice(0, 1000) : "";
    return clean;
  }
  function apply(raw, id, requestGeneration) {
    if (requestGeneration !== generation || id < lastApplied) return;
    lastApplied = id;
    const previousSessionId = snapshot?.sessionId;
    snapshot = normalize(raw);
    if (snapshot.sessionId !== previousSessionId) {
      seeking = false;
      seekSessionId = "";
      notice = "";
      noticeUntil = 0;
    }
    observedAt = performance.now();
    connection = "connected";
    setupNotice = "";
    selectedId = snapshot.sessionId || "";
    if (typeof raw.artwork === "string") {
      artwork.src = raw.artwork.length < 750000 && /^data:image\/(?:png|jpeg|webp|gif|bmp);base64,[a-z0-9+/=]+$/i.test(raw.artwork) ? raw.artwork : fallbackArtwork;
    }
    artworkKey = typeof raw.artworkKey === "string" ? raw.artworkKey : "";
    if (!snapshot.available) artwork.src = fallbackArtwork;
    localize();
  }
  function disconnect() {
    clearTimeout(pollTimer);
    pollTimer = 0;
    const previous = port;
    port = null;
    generation++;
    if (previous) { try { previous.disconnect(); } catch {} }
    for (const request of requests.values()) { clearTimeout(request.timer); request.reject(new Error("bridge_unavailable")); }
    requests.clear();
    selectedId = artworkKey = "";
  }
  function setOffline(error) {
    connectionFailure = typeof error === "string" ? error : error?.message || "bridge_unavailable";
    connection = "offline";
    disconnect(); snapshot = null; busy = seeking = false; seekSessionId = "";
    notice = ""; noticeUntil = 0; setupNotice = "";
    artwork.src = fallbackArtwork;
    localize();
  }
  function openPort() {
    if (port) return port;
    if (!enabled()) throw new Error("permission_required");
    if (location.hostname === "127.0.0.1" && typeof window.__lunarMediaTestTransport === "function") port = window.__lunarMediaTestTransport();
    else {
      const api = typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : null;
      if (!api?.runtime?.connect) throw new Error("bridge_unavailable");
      port = api.runtime.connect({ name: "lunar-windows-media" });
    }
    const current = port;
    current.onMessage.addListener(message => {
      if (port !== current) return;
      if (message?.type === "permission_revoked") { revokeLocally(); return; }
      if (message?.type === "disconnected") { setOffline(message.error); return; }
      const request = requests.get(message?.id);
      if (!request) return;
      requests.delete(message.id);
      clearTimeout(request.timer);
      if (message.ok) request.resolve(message.snapshot);
      else request.reject(new Error(message.error || "bridge_unavailable"));
    });
    current.onDisconnect.addListener(() => {
      if (port !== current) return;
      const api = typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : null;
      void api?.runtime?.lastError;
      setOffline("bridge_unavailable");
    });
    return port;
  }
  async function request(command, extra = {}) {
    const id = ++sequence;
    const requestGeneration = generation;
    const current = openPort();
    const value = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { requests.delete(id); reject(new Error("bridge_timeout")); }, 10000);
      requests.set(id, { resolve, reject, timer });
      // Status always follows Windows. Only actions carry the displayed session ID
      // so an intervening system selection change cannot control a stale target.
      try { current.postMessage({ id, command, sessionId: command === "status" ? "" : selectedId, artworkKey, ...extra }); }
      catch (error) { clearTimeout(timer); requests.delete(id); reject(error); }
    });
    apply(value, id, requestGeneration);
  }
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (visible() && connection === "connected") pollTimer = setTimeout(async () => {
      const pollGeneration = generation;
      try { await request("status"); if (pollGeneration === generation) schedulePoll(); }
      catch (error) { if (pollGeneration === generation) setOffline(error); }
    }, 1000);
  }
  async function reconnect() {
    disconnect();
    if (!visible()) return;
    const reconnectGeneration = generation;
    const granted = await hasPermission();
    if (reconnectGeneration !== generation) return;
    permissionGranted = granted;
    if (!permissionGranted) { revokeLocally(); return; }
    if (!visible()) return;
    connection = "connecting";
    setupNotice = "";
    localize();
    try { await request("status"); if (reconnectGeneration === generation) schedulePoll(); }
    catch (error) { if (reconnectGeneration === generation) { if (error.message === "permission_required") revokeLocally(); else setOffline(error); } }
  }
  async function command(name, extra = {}) {
    if (busy || !snapshot?.available) return;
    clearTimeout(pollTimer);
    busy = true;
    localize();
    try { await request(name, extra); }
    catch (error) {
      if (/bridge/.test(error.message)) setOffline(error);
      else {
        notice = label(error.message === "session_gone" ? "session_gone" : "unsupported"); noticeUntil = performance.now() + 4000;
        if (error.message === "session_gone") {
          try { await request("status"); } catch (refreshError) { setOffline(refreshError); }
        }
      }
    } finally { busy = false; localize(); schedulePoll(); }
  }
  function initialize() {
    if (initialized || document.documentElement.dataset.interfaceVersion !== "modern") return;
    panel = document.getElementById("windows-media-player");
    toggle = document.getElementById("toggle-media-player");
    if (!panel || !toggle) return;
    initialized = true;
    try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); if (!prefs || typeof prefs !== "object") prefs = {}; } catch { prefs = {}; }
    play = node("play"); progress = node("progress"); title = node("track-title"); artist = node("track-artist"); artwork = node("artwork"); status = node("status");
    artwork.addEventListener("error", () => { if (!artwork.src.endsWith(fallbackArtwork)) artwork.src = fallbackArtwork; });
    toggle.addEventListener("click", () => {
      if (!enabled()) { showSetup(); return; }
      prefs.visible = panel.hidden; savePrefs(); renderVisibility(); if (prefs.visible) void reconnect(); else stopMedia();
    });
    node("hide").addEventListener("click", () => { prefs.visible = false; savePrefs(); stopMedia(); });
    node("expand").addEventListener("click", () => { prefs.expanded = !expanded(); savePrefs(); renderVisibility(); });
    play.addEventListener("click", () => void command(snapshot?.playing ? "pause" : "play"));
    node("forward").addEventListener("click", () => void command("seekBy", { seconds: 10 }));
    node("rewind").addEventListener("click", () => void command("seekBy", { seconds: -10 }));
    node("previous").addEventListener("click", () => void command("previous"));
    node("next").addEventListener("click", () => void command("next"));
    node("reconnect").addEventListener("click", () => void reconnect());
    node("enable").addEventListener("click", () => void enableFromClick());
    node("disable").addEventListener("click", () => void disableFromClick());
    node("manage").addEventListener("click", showSetup);
    node("check").addEventListener("click", () => void reconnect());
    progress.addEventListener("input", () => {
      if (!seeking) seekSessionId = selectedId;
      seeking = true;
      const value = Number(progress.value) / 10;
      node("current").textContent = format(value);
      progress.style.setProperty("--player-progress", `${Number(progress.value) / Number(progress.max) * 100}%`);
      progress.setAttribute("aria-valuetext", `${format(value)} / ${format(snapshot?.duration || 0)}`);
    });
    progress.addEventListener("change", () => {
      const value = Number(progress.value) / 10;
      const target = seekSessionId;
      seeking = false; seekSessionId = "";
      if (target && target === selectedId) void command("seekTo", { seconds: value });
      else renderProgress();
    });
    progress.addEventListener("blur", () => { seeking = false; seekSessionId = ""; renderProgress(); });
    node("setup").addEventListener("click", showSetup);
    bindPermissions();
    window.addEventListener("storage", event => {
      if (event.key !== PREFS_KEY) return;
      try { prefs = JSON.parse(event.newValue || "{}"); } catch { prefs = {}; }
      if (!prefs || typeof prefs !== "object") prefs = {};
      if (prefs.enabled && prefs.consentVersion === CONSENT_VERSION) void resume();
      else { permissionGranted = false; stopMedia(); updateSetup(); }
    });
    document.addEventListener("visibilitychange", () => { if (visible()) void reconnect(); else stopMedia(); });
    window.addEventListener("resize", renderVisibility);
    window.addEventListener("focus", () => { if (visible() && connection !== "connected") void reconnect(); });
    window.addEventListener("pagehide", () => { disconnect(); clearInterval(tickTimer); });
    tickTimer = setInterval(() => { if (visible()) renderProgress(); }, 250);
    renderVisibility();
    localize();
    void resume();
  }
  async function resume() {
    // Old visible-widget preferences do not imply consent to Windows media access.
    if (!supported() || !prefs.enabled || prefs.consentVersion !== CONSENT_VERSION) return;
    permissionGranted = await hasPermission();
    if (!permissionGranted) { revokeLocally(); return; }
    renderVisibility();
    if (visible()) await reconnect(); else disconnect();
  }
  window.lunarMediaPlayer = { initialize, localize, reconnect, destroy() { disconnect(); clearInterval(tickTimer); } };
})();
