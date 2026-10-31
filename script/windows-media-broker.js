// One on-demand native host for modern homepage clients. No connections from legacy pages.
(() => {
  const api = typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : null;
  if (!api?.runtime?.onConnect) return;
  const clients = new Set();
  const pending = new Map();
  let native = null;
  let sequence = 0;
  const hostName = "com.lunarfox.lunar_media";
  const commands = new Set(["status", "play", "pause", "toggle", "seekTo", "seekBy", "next", "previous"]);
  const nativeFailure = error => {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("native messaging host not found")) return "bridge_missing";
    if (message.includes("forbidden") || message.includes("access is denied")) return "bridge_denied";
    if (message.includes("failed to start native messaging host")) return "bridge_start_failed";
    return "bridge_unavailable";
  };
  const reply = (client, payload) => { try { client.postMessage(payload); } catch {} };
  const fail = error => {
    for (const [id, request] of pending) {
      clearTimeout(request.timer);
      reply(request.client, { id: request.id, ok: false, error });
      pending.delete(id);
    }
  };
  const hasPermission = async () => {
    try { return Boolean(await api.permissions?.contains({ permissions: ["nativeMessaging"] })); } catch { return false; }
  };
  api.permissions?.onRemoved?.addListener(change => {
    if (!change.permissions?.includes("nativeMessaging")) return;
    fail("permission_required");
    if (native) { const port = native; native = null; port.disconnect(); }
    for (const client of clients) { reply(client, { type: "permission_revoked" }); client.disconnect(); }
    clients.clear();
  });
  function connect() {
    if (native) return native;
    native = api.runtime.connectNative(hostName);
    const port = native;
    port.onMessage.addListener(message => {
      const request = pending.get(message?.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      reply(request.client, { ...message, id: request.id });
    });
    port.onDisconnect.addListener(() => {
      const error = api.runtime.lastError;
      if (native !== port) return;
      native = null;
      const reason = nativeFailure(error);
      fail(reason);
      for (const client of clients) reply(client, { type: "disconnected", error: reason });
    });
    return port;
  }
  api.runtime.onConnect.addListener(client => {
    if (client.name !== "lunar-windows-media") return;
    if (client.sender?.id !== api.runtime.id || client.sender?.url?.split(/[?#]/)[0] !== api.runtime.getURL("home.html")) { client.disconnect(); return; }
    clients.add(client);
    client.onMessage.addListener(async message => {
      const id = message?.id;
      if (!Number.isSafeInteger(id) || !commands.has(message?.command)) { reply(client, { id, ok: false, error: "unsupported_command" }); return; }
      if (message.sessionId && !/^[a-f0-9]{32}$/.test(message.sessionId)) { reply(client, { id, ok: false, error: "session_gone" }); return; }
      const body = { id: `media-${++sequence}`, command: message.command, sessionId: message.sessionId || "", artworkKey: String(message.artworkKey || "").slice(0, 3100) };
      if (message.command === "seekTo" || message.command === "seekBy") {
        if (!Number.isFinite(message.seconds) || Math.abs(message.seconds) > 86400000) { reply(client, { id, ok: false, error: "invalid_position" }); return; }
        body.seconds = message.seconds;
      }
      if (!await hasPermission()) { reply(client, { id, ok: false, error: "permission_required" }); return; }
      if (!clients.has(client)) return;
      const timer = setTimeout(() => { pending.delete(body.id); reply(client, { id, ok: false, error: "bridge_timeout" }); }, 9000);
      pending.set(body.id, { client, id, timer });
      try { connect().postMessage(body); }
      catch (error) { clearTimeout(timer); pending.delete(body.id); reply(client, { id, ok: false, error: nativeFailure(error) }); }
    });
    client.onDisconnect.addListener(() => {
      clients.delete(client);
      for (const [id, request] of pending) if (request.client === client) { clearTimeout(request.timer); pending.delete(id); }
      if (!clients.size && native) { const port = native; native = null; port.disconnect(); }
    });
  });
})();
