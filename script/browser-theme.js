// Open the browser's own UI; no theme settings or extra permissions are changed here.
(() => {
  const message = key => {
    const value = typeof t === "function" ? t(`browser_theme.${key}`) : "";
    if (value && value !== `browser_theme.${key}`) return value;
    return key === "unavailable" ? "Open the installed extension in Chrome or Edge to change browser colors." : "Could not open browser theme settings. Please try again.";
  };
  function notice(key) {
    if (typeof showInlineNotice === "function") showInlineNotice(message(key), "error");
  }
  document.querySelectorAll("[data-browser-theme]").forEach(button => {
    button.addEventListener("click", async () => {
      const api = typeof chrome !== "undefined" ? chrome : typeof browser !== "undefined" ? browser : null;
      if (!api?.runtime?.id || !api?.tabs?.create) { notice("unavailable"); return; }
      const isEdge = /Edg\//.test(navigator.userAgent) || navigator.userAgentData?.brands?.some(item => item.brand === "Microsoft Edge");
      const url = isEdge ? "edge://settings/appearance" : "chrome://new-tab-page/?customize=themes";
      button.disabled = true;
      try { await api.tabs.create({url}); }
      catch {
        try { await api.tabs.create({url:isEdge ? "edge://settings/appearance" : "chrome://settings/manageProfile"}); }
        catch { notice("failed"); }
      } finally { button.disabled = false; }
    });
  });
})();
