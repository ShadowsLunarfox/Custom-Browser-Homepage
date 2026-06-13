const CONTEXT_MENU_ID = "save-page-to-lunar-start";
const CONTEXT_MENU_TITLE = "Save This Page to Lunar Start";
const PENDING_LINK_IDS_KEY = "pendingSavedLinkIds";
const PENDING_LINK_KEY_PREFIX = "pendingSavedLink:";
const UPDATE_ALARM_ID = "lunar-update-check";
const UPDATE_STATE_KEY = "lunarUpdateState:v1";
const UPDATE_CHECK_INTERVAL_MINUTES = 360;
const UPDATE_CHECK_FRESHNESS_MS = 15 * 60 * 1000;
const UPDATE_RELEASE_API_URL = "https://api.github.com/repos/ShadowsLunarfox/web-browser-homepage/releases/latest";
const UPDATE_RELEASES_URL = "https://github.com/ShadowsLunarfox/web-browser-homepage/releases";
const extensionApi = getExtensionApi();
const contextMenusApi = getContextMenusApi();

extensionApi?.runtime?.onInstalled?.addListener(() => {
  ensureContextMenu();
  scheduleUpdateChecks();
  void checkForUpdates();
});

extensionApi?.runtime?.onStartup?.addListener(() => {
  ensureContextMenu();
  scheduleUpdateChecks();
  void checkForUpdates();
});

extensionApi?.runtime?.onUpdateAvailable?.addListener((details) => {
  void getUpdateState().then((state) => persistUpdateState({
    ...state,
    status: "browser_updating",
    currentVersion: getCurrentExtensionVersion(),
    latestVersion: normalizeVersion(details?.version || state.latestVersion),
    checkedAt: Date.now(),
    error: ""
  }));
});

extensionApi?.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm?.name === UPDATE_ALARM_ID) {
    void checkForUpdates();
  }
});

extensionApi?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (message?.type === "get-update-state") {
    void getUpdateState().then((state) => sendResponse({ state }));
    return true;
  }

  if (message?.type === "check-for-updates") {
    void checkForUpdates({ manual: Boolean(message.manual) })
      .then((state) => sendResponse({ state }));
    return true;
  }

  return false;
});

contextMenusApi?.onClicked?.addListener((info, tab) => {
  const pageUrl = tab?.url || info?.pageUrl || "";
  if (info.menuItemId !== CONTEXT_MENU_ID || !pageUrl) return;
  if (!/^https?:/i.test(pageUrl)) return;

  void queueSavedLink({
    id: crypto.randomUUID(),
    name: sanitizeTitle(tab?.title) || deriveNameFromUrl(pageUrl),
    url: pageUrl,
    pinned: false
  });
});

function ensureContextMenu() {
  if (!contextMenusApi) return;

  void removeContextMenu(CONTEXT_MENU_ID).then(createContextMenu);
}

function scheduleUpdateChecks() {
  const alarms = extensionApi?.alarms;
  if (!alarms?.create) return;

  try {
    alarms.create(UPDATE_ALARM_ID, {
      delayInMinutes: UPDATE_CHECK_INTERVAL_MINUTES,
      periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES
    });
  } catch {
    // Automatic checks are optional when the browser lacks alarms support.
  }
}

async function checkForUpdates({ manual = false } = {}) {
  const currentVersion = getCurrentExtensionVersion();
  const previousState = await getUpdateState();
  const checkedRecently = previousState.checkedAt
    && Date.now() - previousState.checkedAt < UPDATE_CHECK_FRESHNESS_MS;
  if (!manual && checkedRecently && previousState.status !== "checking") {
    return previousState;
  }

  await persistUpdateState({
    ...previousState,
    status: "checking",
    currentVersion,
    checkedAt: Date.now(),
    error: ""
  });

  try {
    const release = await fetchLatestRelease();
    if (!release) {
      return persistUpdateState({
        status: "no_release",
        currentVersion,
        latestVersion: "",
        releaseUrl: UPDATE_RELEASES_URL,
        checkedAt: Date.now(),
        error: ""
      });
    }

    const comparison = compareVersions(release.version, currentVersion);
    if (comparison <= 0) {
      return persistUpdateState({
        status: "up_to_date",
        currentVersion,
        latestVersion: release.version,
        releaseUrl: release.url,
        checkedAt: Date.now(),
        error: ""
      });
    }

    const browserUpdate = await requestBrowserUpdateCheck({ manual });
    return persistUpdateState({
      status: browserUpdate.status === "update_available" ? "browser_updating" : "available",
      currentVersion,
      latestVersion: browserUpdate.version || release.version,
      releaseUrl: release.url,
      checkedAt: Date.now(),
      error: ""
    });
  } catch (error) {
    return persistUpdateState({
      status: "error",
      currentVersion,
      latestVersion: "",
      releaseUrl: UPDATE_RELEASES_URL,
      checkedAt: Date.now(),
      error: sanitizeUpdateError(error)
    });
  }
}

async function fetchLatestRelease() {
  const response = await fetch(UPDATE_RELEASE_API_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);

  const release = await response.json();
  const version = normalizeVersion(release?.tag_name || release?.name || "");
  if (!version) throw new Error("Invalid release version");

  return {
    version,
    url: isSafeReleaseUrl(release?.html_url) ? release.html_url : UPDATE_RELEASES_URL
  };
}

function requestBrowserUpdateCheck() {
  const runtime = extensionApi?.runtime;
  if (!runtime?.requestUpdateCheck) {
    return Promise.resolve({ status: "unsupported", version: "" });
  }

  if (isPromiseExtensionApi()) {
    try {
      return runtime.requestUpdateCheck().then((value) => ({
        status: typeof value?.status === "string" ? value.status : "unknown",
        version: normalizeVersion(value?.version || "")
      }), () => ({ status: "error", version: "" }));
    } catch {
      return Promise.resolve({ status: "unsupported", version: "" });
    }
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (status, details) => {
      if (settled) return;
      settled = true;
      clearExtensionRuntimeError();
      resolve({
        status: typeof status === "string" ? status : "unknown",
        version: normalizeVersion(details?.version || "")
      });
    };

    try {
      const result = runtime.requestUpdateCheck((status, details) => finish(status, details));
      if (isPromiseLike(result)) {
        result.then((value) => {
          if (Array.isArray(value)) {
            finish(value[0], value[1]);
          } else {
            finish(value?.status, value);
          }
        }, () => finish("error"));
      }
    } catch {
      finish("unsupported");
    }
  });
}

async function getUpdateState() {
  const currentVersion = getCurrentExtensionVersion();
  try {
    const stored = await extensionStorageGet(UPDATE_STATE_KEY);
    const value = stored?.[UPDATE_STATE_KEY];
    if (value && typeof value === "object") {
      return {
        status: typeof value.status === "string" ? value.status : "idle",
        currentVersion,
        latestVersion: typeof value.latestVersion === "string" ? value.latestVersion : "",
        releaseUrl: isSafeReleaseUrl(value.releaseUrl) ? value.releaseUrl : UPDATE_RELEASES_URL,
        checkedAt: Number.isFinite(Number(value.checkedAt)) ? Number(value.checkedAt) : 0,
        error: typeof value.error === "string" ? value.error : ""
      };
    }
  } catch {
    // Return a fresh state when storage is unavailable.
  }

  return {
    status: "idle",
    currentVersion,
    latestVersion: "",
    releaseUrl: UPDATE_RELEASES_URL,
    checkedAt: 0,
    error: ""
  };
}

async function persistUpdateState(state) {
  const normalized = {
    status: state.status,
    currentVersion: normalizeVersion(state.currentVersion) || getCurrentExtensionVersion(),
    latestVersion: normalizeVersion(state.latestVersion),
    releaseUrl: isSafeReleaseUrl(state.releaseUrl) ? state.releaseUrl : UPDATE_RELEASES_URL,
    checkedAt: Number(state.checkedAt) || Date.now(),
    error: typeof state.error === "string" ? state.error : ""
  };
  try {
    await extensionStorageSet({ [UPDATE_STATE_KEY]: normalized });
  } catch {
    // The caller still receives the result when persistence is unavailable.
  }
  return normalized;
}

function getCurrentExtensionVersion() {
  return normalizeVersion(extensionApi?.runtime?.getManifest?.().version || "0.0.0") || "0.0.0";
}

function compareVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  const length = Math.max(leftVersion.numbers.length, rightVersion.numbers.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftVersion.numbers[index] || 0) - (rightVersion.numbers[index] || 0);
    if (difference) return difference > 0 ? 1 : -1;
  }

  if (leftVersion.prerelease === rightVersion.prerelease) return 0;
  if (!leftVersion.prerelease) return 1;
  if (!rightVersion.prerelease) return -1;
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease, undefined, { numeric: true });
}

function parseVersion(version) {
  const normalized = normalizeVersion(version);
  const match = normalized.match(/^(\d+(?:\.\d+)*)(?:-([0-9a-z.-]+))?$/i);
  if (!match) throw new Error("Invalid version format");
  return {
    numbers: match[1].split(".").map(Number),
    prerelease: match[2] || ""
  };
}

function normalizeVersion(version) {
  return typeof version === "string" ? version.trim().replace(/^v/i, "") : "";
}

function isSafeReleaseUrl(url) {
  return typeof url === "string" && /^https:\/\/github\.com\/ShadowsLunarfox\/web-browser-homepage\/releases(?:\/|$)/i.test(url);
}

function sanitizeUpdateError(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return message.replace(/[\r\n]+/g, " ").slice(0, 160);
}

function createContextMenu() {
  if (!contextMenusApi?.create) return Promise.resolve();

  const item = {
    id: CONTEXT_MENU_ID,
    title: CONTEXT_MENU_TITLE,
    contexts: ["page"]
  };

  return new Promise((resolve) => {
    const finish = () => {
      clearExtensionRuntimeError();
      resolve();
    };

    try {
      const result = contextMenusApi.create(item, finish);
      if (isPromiseLike(result)) {
        result.then(resolve, resolve);
      } else if (contextMenusApi.create.length < 2) {
        finish();
      }
    } catch {
      resolve();
    }
  });
}

async function queueSavedLink(link) {
  const ids = await getPendingLinkIds();
  const nextIds = ids.includes(link.id) ? ids : [...ids, link.id];
  await extensionStorageSet({
    [PENDING_LINK_IDS_KEY]: nextIds,
    [`${PENDING_LINK_KEY_PREFIX}${link.id}`]: link
  });
}

function getExtensionApi() {
  if (typeof browser !== "undefined") return browser;
  if (typeof chrome !== "undefined") return chrome;
  return null;
}

function getContextMenusApi() {
  return extensionApi?.contextMenus || extensionApi?.menus || null;
}

function isPromiseExtensionApi() {
  return typeof browser !== "undefined" && extensionApi === browser;
}

function removeContextMenu(id) {
  if (!contextMenusApi?.remove) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearExtensionRuntimeError();
      resolve();
    };

    try {
      const result = contextMenusApi.remove(id, finish);
      if (isPromiseLike(result)) {
        result.then(resolve, resolve);
      } else if (contextMenusApi.remove.length < 2) {
        finish();
      }
    } catch {
      resolve();
    }
  });
}

function getExtensionRuntimeError() {
  return extensionApi?.runtime?.lastError || (typeof chrome !== "undefined" ? chrome.runtime?.lastError : null);
}

function clearExtensionRuntimeError() {
  getExtensionRuntimeError();
}

function isPromiseLike(value) {
  return Boolean(value) && typeof value.then === "function";
}

function extensionStorageGet(keys) {
  const storage = extensionApi?.storage?.local;
  if (!storage?.get) return Promise.resolve({});
  if (isPromiseExtensionApi()) {
    return storage.get(keys);
  }

  return new Promise((resolve) => {
    storage.get(keys, (items) => {
      resolve(items || {});
    });
  });
}

function extensionStorageSet(items) {
  const storage = extensionApi?.storage?.local;
  if (!storage?.set) return Promise.resolve();
  if (isPromiseExtensionApi()) {
    return storage.set(items);
  }

  return new Promise((resolve) => {
    storage.set(items, () => {
      resolve();
    });
  });
}

async function getPendingLinkIds() {
  try {
    const stored = await extensionStorageGet(PENDING_LINK_IDS_KEY);
    return Array.isArray(stored[PENDING_LINK_IDS_KEY])
      ? stored[PENDING_LINK_IDS_KEY].filter((id) => typeof id === "string" && id)
      : [];
  } catch {
    return [];
  }
}

function sanitizeTitle(title) {
  if (typeof title !== "string") return "";
  return title.trim().replace(/\s+/g, " ").slice(0, 30);
}

function deriveNameFromUrl(url) {
  try {
    const target = new URL(url);
    return target.hostname.replace(/^www\./i, "");
  } catch {
    return "Saved Page";
  }
}
