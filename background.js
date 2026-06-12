const CONTEXT_MENU_ID = "save-page-to-lunar-start";
const CONTEXT_MENU_TITLE = "Save This Page to Lunar Start";
const PENDING_LINK_IDS_KEY = "pendingSavedLinkIds";
const PENDING_LINK_KEY_PREFIX = "pendingSavedLink:";
const extensionApi = getExtensionApi();
const contextMenusApi = getContextMenusApi();

extensionApi?.runtime?.onInstalled?.addListener(() => {
  ensureContextMenu();
});

extensionApi?.runtime?.onStartup?.addListener(() => {
  ensureContextMenu();
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
