(function () {
  const UPDATE_STATE_KEY = "lunarUpdateState:v1";
  const RELEASES_URL = "https://github.com/ShadowsLunarfox/web-browser-homepage/releases";

  const currentVersionEl = document.getElementById("update-current-version");
  const latestVersionEl = document.getElementById("update-latest-version");
  const statusEl = document.getElementById("update-status");
  const checkButtonEl = document.getElementById("check-for-updates");
  const releaseButtonEl = document.getElementById("open-update-release");

  if (!currentVersionEl || !latestVersionEl || !statusEl || !checkButtonEl || !releaseButtonEl) return;

  let updateState = createInitialState();

  checkButtonEl.addEventListener("click", checkForUpdates);
  releaseButtonEl.addEventListener("click", openLatestRelease);
  window.addEventListener("lunar:translations-ready", renderUpdateState);

  const api = getExtensionApi();
  api?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[UPDATE_STATE_KEY]?.newValue) return;
    updateState = sanitizeUpdateState(changes[UPDATE_STATE_KEY].newValue);
    renderUpdateState();
  });

  void loadUpdateState();

  function createInitialState() {
    return {
      status: "idle",
      currentVersion: getExtensionVersion(),
      latestVersion: "",
      releaseUrl: RELEASES_URL,
      checkedAt: 0,
      error: ""
    };
  }

  async function loadUpdateState() {
    const response = await sendRuntimeMessage({ type: "get-update-state" });
    if (response?.state) {
      updateState = sanitizeUpdateState(response.state);
      renderUpdateState();
      return;
    }

    try {
      const stored = await extensionStorageGet(UPDATE_STATE_KEY);
      if (stored?.[UPDATE_STATE_KEY]) {
        updateState = sanitizeUpdateState(stored[UPDATE_STATE_KEY]);
      }
    } catch {
      updateState.status = "unsupported";
    }
    renderUpdateState();
  }

  async function checkForUpdates() {
    checkButtonEl.disabled = true;
    updateState = {
      ...updateState,
      status: "checking",
      currentVersion: getExtensionVersion() || updateState.currentVersion,
      error: ""
    };
    renderUpdateState();

    const response = await sendRuntimeMessage({ type: "check-for-updates", manual: true });
    if (response?.state) {
      updateState = sanitizeUpdateState(response.state);
    } else {
      updateState.status = "unsupported";
    }
    renderUpdateState();
  }

  function openLatestRelease() {
    const target = updateState.releaseUrl || RELEASES_URL;
    window.open(target, "_blank", "noopener,noreferrer");
  }

  function renderUpdateState() {
    const currentVersion = updateState.currentVersion || getExtensionVersion() || "-";
    currentVersionEl.textContent = formatVersion(currentVersion);
    latestVersionEl.textContent = updateState.latestVersion
      ? formatVersion(updateState.latestVersion)
      : "-";
    statusEl.textContent = getStatusMessage(updateState);
    statusEl.dataset.tone = getStatusTone(updateState.status);
    checkButtonEl.disabled = updateState.status === "checking";
    releaseButtonEl.hidden = !shouldShowReleaseButton(updateState);
  }

  function getStatusMessage(value) {
    const key = `updates.status.${value.status || "idle"}`;
    const checkedAt = value.checkedAt ? formatCheckedAt(value.checkedAt) : "";
    const vars = {
      current: formatVersion(value.currentVersion || getExtensionVersion() || "-"),
      latest: formatVersion(value.latestVersion || "-"),
      time: checkedAt,
      error: value.error || ""
    };
    const translated = typeof t === "function" ? t(key, vars) : key;
    if (translated !== key) return translated;

    const fallbacks = {
      idle: "Updates have not been checked yet.",
      checking: "Checking for updates...",
      up_to_date: `Version ${vars.current} is up to date.`,
      available: `Version ${vars.latest} is available. The browser update source did not install it automatically.`,
      browser_updating: `Version ${vars.latest} was found. The browser is downloading or installing it automatically.`,
      no_release: "No published GitHub Release was found.",
      unsupported: "Automatic update checks are unavailable in this installation.",
      error: `Update check failed${vars.error ? `: ${vars.error}` : "."}`
    };
    return fallbacks[value.status] || fallbacks.idle;
  }

  function getStatusTone(status) {
    if (status === "up_to_date" || status === "browser_updating") return "success";
    if (status === "available" || status === "no_release" || status === "unsupported") return "warning";
    if (status === "error") return "error";
    return "info";
  }

  function shouldShowReleaseButton(value) {
    return Boolean(value.releaseUrl) && ["available", "browser_updating", "no_release", "unsupported", "error"].includes(value.status);
  }

  function sanitizeUpdateState(value) {
    const fallback = createInitialState();
    return {
      status: typeof value?.status === "string" ? value.status : fallback.status,
      currentVersion: typeof value?.currentVersion === "string" ? value.currentVersion : fallback.currentVersion,
      latestVersion: typeof value?.latestVersion === "string" ? value.latestVersion : "",
      releaseUrl: isSafeReleaseUrl(value?.releaseUrl) ? value.releaseUrl : RELEASES_URL,
      checkedAt: Number.isFinite(Number(value?.checkedAt)) ? Number(value.checkedAt) : 0,
      error: typeof value?.error === "string" ? value.error : ""
    };
  }

  function isSafeReleaseUrl(url) {
    return typeof url === "string" && /^https:\/\/github\.com\/ShadowsLunarfox\/web-browser-homepage\/releases(?:\/|$)/i.test(url);
  }

  function formatVersion(version) {
    const normalized = String(version || "").trim().replace(/^v/i, "");
    return normalized ? `v${normalized}` : "-";
  }

  function formatCheckedAt(timestamp) {
    try {
      return new Intl.DateTimeFormat(document.documentElement.lang || "en", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(timestamp));
    } catch {
      return "";
    }
  }

  function getExtensionVersion() {
    try {
      return getExtensionApi()?.runtime?.getManifest?.().version || "";
    } catch {
      return "";
    }
  }

  function sendRuntimeMessage(message) {
    const runtime = getExtensionApi()?.runtime;
    if (!runtime?.sendMessage) return Promise.resolve(null);
    if (typeof browser !== "undefined" && runtime === browser.runtime) {
      return runtime.sendMessage(message).catch(() => null);
    }

    return new Promise((resolve) => {
      try {
        runtime.sendMessage(message, (response) => {
          const error = runtime.lastError || (typeof chrome !== "undefined" ? chrome.runtime?.lastError : null);
          resolve(error ? null : (response || null));
        });
      } catch {
        resolve(null);
      }
    });
  }
}());
