// Background upload and reset helpers.
let backgroundPickerSettingsSnapshot = null;

async function handleBackgroundUpload(event) {
  const [file] = event.target.files || [];
  if (!file) {
    restoreSettingsAfterBackgroundPicker(true);
    return;
  }

  try {
    await saveBackgroundUpload(file);
  } finally {
    restoreSettingsAfterBackgroundPicker(true);
  }
}

function triggerBackgroundUpload() {
  const settingsForm = document.getElementById("settings-form");
  backgroundPickerSettingsSnapshot = settingsDialogEl?.open
    ? { scrollTop: settingsForm?.scrollTop || 0 }
    : null;

  if (backgroundPickerSettingsSnapshot) {
    window.addEventListener("focus", restoreSettingsAfterBackgroundPicker, { once: true });
  }

  backgroundUploadEl.value = "";
  backgroundUploadEl.click();
}

function restoreSettingsAfterBackgroundPicker(clearSnapshot = false) {
  const snapshot = backgroundPickerSettingsSnapshot;
  if (!snapshot) return;

  if (!settingsDialogEl.open) {
    ensureSettingsControlsInitialized();
    ensurePresetButtonsRendered();
    renderSettingsPanel();
    settingsDialogEl.showModal();
  }

  requestAnimationFrame(() => {
    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
      settingsForm.scrollTop = snapshot.scrollTop;
    }
  });

  if (clearSnapshot === true) {
    backgroundPickerSettingsSnapshot = null;
  }
}

async function saveBackgroundUpload(file) {
  try {
    const optimized = await optimizeImageFileForStorage(file);
    await setStoredBackgroundImage(optimized.storedAsset || optimized.dataUrl);
    state.background = {
      type: "image",
      value: CHROME_BACKGROUND_VALUE,
      name: file.name || "Custom image selected",
      mediaType: isVideoBackgroundFile(file) ? "video" : "image"
    };
    backgroundUploadEl.value = "";
    persistAndRender(true);
  } catch (error) {
    backgroundUploadEl.value = "";
    backgroundUploadNameEl.textContent = t("background.image_save_failed");
    const uploadErrorMessage = isVideoBackgroundFile(file)
      ? t("alerts.video_wallpaper_too_large")
      : t("alerts.wallpaper_too_large");
    showInlineNotice(uploadErrorMessage, "error");
    if (!isExpectedBackgroundUploadError(error)) {
      console.warn("Background upload failed", error);
    }
  }
}

function isExpectedBackgroundUploadError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("exceeds storage budget")
    || message.includes("Invalid image dimensions")
    || message.includes("Canvas unavailable");
}

async function applyPresetBackground(key) {
  state.background = { type: "preset", value: key in PRESETS ? key : "wallpaper_1", name: "", selectedByUser: true };
  backgroundUploadEl.value = "";
  persistAndRender(true);
  try {
    await clearStoredBackgroundImage();
  } catch (error) {
    console.warn("Preset background cache cleanup failed", error);
  }
}

async function clearCustomBackground() {
  state.background = structuredClone(DEFAULT_STATE.background);
  backgroundUploadEl.value = "";
  persistAndRender(true);
  try {
    await clearStoredBackgroundImage();
  } catch (error) {
    console.warn("Theme background cache cleanup failed", error);
  }
}

// Reset appearance-only settings without touching layout or positions.
function resetAppearanceSettings() {
  state.settings = sanitizeSettings({
    ...state.settings,
    theme: DEFAULT_SETTINGS.theme,
    themeStyle: DEFAULT_SETTINGS.themeStyle,
    accentColor: DEFAULT_SETTINGS.accentColor,
    textColor: DEFAULT_SETTINGS.textColor,
    fontScale: DEFAULT_SETTINGS.fontScale,
    radius: DEFAULT_SETTINGS.radius,
    panelBlur: DEFAULT_SETTINGS.panelBlur,
    clockVisible: DEFAULT_SETTINGS.clockVisible,
    clockStyle: DEFAULT_SETTINGS.clockStyle,
    panelOpacity: DEFAULT_SETTINGS.panelOpacity
  });
  persistAndRender();
}

function clearDebugLocalStorage() {
  const confirmed = window.confirm(t("alerts.clear_local_storage_confirm"));
  if (!confirmed) return;

  try {
    localStorage.clear();
    window.location.reload();
  } catch (error) {
    console.warn("Local storage clear failed", error);
    showInlineNotice(t("alerts.clear_local_storage_failed"), "error");
  }
}

// Update a single setting, sanitize it, then redraw the UI.
function updateSetting(key, value) {
  if (key === "theme") {
    value = value === "light" ? "light" : "dark";
    const currentTextColor = normalizeHexColor(state.settings.textColor, THEME_TEXT_DEFAULTS[state.settings.theme]);
    const isUsingThemeDefault = currentTextColor === THEME_TEXT_DEFAULTS.dark || currentTextColor === THEME_TEXT_DEFAULTS.light;
    state.settings = sanitizeSettings({
      ...state.settings,
      theme: value,
      textColor: isUsingThemeDefault ? THEME_TEXT_DEFAULTS[value] : currentTextColor
    });
  } else {
    state.settings = sanitizeSettings({
      ...state.settings,
      [key]: value
    });
  }
  saveState();
  renderAfterSettingChange(key);
}

function renderAfterSettingChange(key) {
  applyThemeSettings();
  applyThemeStyle();
  applyGridSettings();

  if (key === "theme" || key === "themeStyle") {
    refreshBackgroundVideoAfterThemeChange();
  }

  if (key === "searchSuggestionsEnabled" && !state.settings.searchSuggestionsEnabled) {
    cancelPendingSearchSuggestions();
  }

  renderSettingsPanelIfReady();
  if (shouldNormalizePanelsAfterSettingChange(key)) {
    requestAnimationFrame(() => normalizePanelsToViewport(true));
  }
}

function shouldNormalizePanelsAfterSettingChange(key) {
  return [
    "fontScale",
    "radius",
    "panelBlur",
    "clockVisible",
    "clockStyle",
    "columns",
    "rows",
    "cardGap",
    "cardHeight",
    "searchUiVisible",
    "shortcutsVisible"
  ].includes(key);
}

// Import/export helpers for bookmark backups.
async function exportState() {
  const exportableState = await createExportableState();
  const payload = JSON.stringify({
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    state: exportableState
  }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "my-home-bookmarks.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function importStateFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedState = sanitizeState(parsed.state || parsed);
      await normalizeBackgroundStorage(importedState);
      if (importedState.background.type !== "image") {
        await clearStoredBackgroundImage();
      }
      state = importedState;
      bookmarkFilter = "";
      persistAndRender(true);
    } catch {
      showInlineNotice(t("alerts.import_failed"), "error");
    } finally {
      importFileEl.value = "";
    }
  };
  reader.readAsText(file);
}

function persistAndRender(showSaveError = false) {
  renderAll();
  return saveState(showSaveError);
}

// Persistence and sanitization.
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return sanitizeState(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function sanitizeState(value) {
  const next = {
    version: DATA_VERSION,
    layout: value?.layout === "list" ? "list" : "grid",
    searchEngine: value?.searchEngine in SEARCH_ENGINES ? value.searchEngine : "google",
    language: normalizeLanguage(value?.language || detectPreferredLanguage()),
    searchHistory: sanitizeSearchHistory(value?.searchHistory),
    settings: sanitizeSettings(value?.settings),
    links: Array.isArray(value?.links) ? value.links.map(sanitizeLink).filter(Boolean) : structuredClone(DEFAULT_STATE.links),
    background: sanitizeBackground(value?.background)
  };

  next.links = reorderPinnedLinks(next.links);
  return next;
}

function sanitizeSearchHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_SEARCH_HISTORY);
}

function sanitizeSettings(value) {
  const theme = value?.theme === "light" ? "light" : "dark";
  const rawTextColor = normalizeHexColor(value?.textColor, THEME_TEXT_DEFAULTS[theme]);
  const textColor = resolveThemeTextColor(rawTextColor, theme);
  return {
    theme,
    themeStyle: value?.themeStyle in THEME_STYLE_FILES ? value.themeStyle : DEFAULT_SETTINGS.themeStyle,
    accentColor: normalizeHexColor(value?.accentColor, DEFAULT_SETTINGS.accentColor),
    textColor,
    searchSuggestionsEnabled: typeof value?.searchSuggestionsEnabled === "boolean"
      ? value.searchSuggestionsEnabled
      : DEFAULT_SETTINGS.searchSuggestionsEnabled,
    searchSuggestionsAllEnginesEnabled: typeof value?.searchSuggestionsAllEnginesEnabled === "boolean"
      ? value.searchSuggestionsAllEnginesEnabled
      : DEFAULT_SETTINGS.searchSuggestionsAllEnginesEnabled,
    searchSuggestionEngineKeys: sanitizeSearchSuggestionEngineKeys(value?.searchSuggestionEngineKeys, value?.searchSuggestionEngineLimit),
    searchUiVisible: typeof value?.searchUiVisible === "boolean"
      ? value.searchUiVisible
      : (typeof value?.uiVisible === "boolean" ? value.uiVisible : DEFAULT_SETTINGS.searchUiVisible),
    shortcutsVisible: typeof value?.shortcutsVisible === "boolean"
      ? value.shortcutsVisible
      : (typeof value?.uiVisible === "boolean" ? value.uiVisible : DEFAULT_SETTINGS.shortcutsVisible),
    fontScale: clampNumber(value?.fontScale, 90, 120, DEFAULT_SETTINGS.fontScale),
    radius: clampNumber(value?.radius, 8, 32, DEFAULT_SETTINGS.radius),
    panelBlur: clampNumber(value?.panelBlur, 0, 30, DEFAULT_SETTINGS.panelBlur),
    clockVisible: typeof value?.clockVisible === "boolean" ? value.clockVisible : DEFAULT_SETTINGS.clockVisible,
    clockStyle: CLOCK_STYLES.includes(value?.clockStyle) ? value.clockStyle : DEFAULT_SETTINGS.clockStyle,
    columns: clampNumber(value?.columns, 2, 8, DEFAULT_SETTINGS.columns),
    rows: clampNumber(value?.rows, 1, 5, DEFAULT_SETTINGS.rows),
    cardGap: clampNumber(value?.cardGap, 8, 28, DEFAULT_SETTINGS.cardGap),
    cardHeight: clampNumber(value?.cardHeight, 160, 280, DEFAULT_SETTINGS.cardHeight),
    panelOpacity: clampNumber(value?.panelOpacity ?? value?.backgroundOpacity, 45, 100, DEFAULT_SETTINGS.panelOpacity),
    panelPositions: sanitizePanelPositions(value?.panelPositions),
    panelDesiredPositions: sanitizePanelDesiredPositions(value?.panelDesiredPositions, value?.panelPositions),
    panelScales: sanitizePanelScales(value?.panelScales, value?.clockScale)
  };
}

function sanitizeSearchSuggestionEngineKeys(value, legacyLimit) {
  const validEngineKeys = Object.keys(SEARCH_ENGINES);
  if (Array.isArray(value)) {
    const keys = value.filter((engineKey, index, list) => (
      typeof engineKey === "string"
        && engineKey in SEARCH_ENGINES
        && list.indexOf(engineKey) === index
    ));
    return keys.length ? keys : [...DEFAULT_SETTINGS.searchSuggestionEngineKeys];
  }

  if (legacyLimit === "all") {
    return validEngineKeys;
  }

  if (legacyLimit !== undefined) {
    const limit = clampNumber(legacyLimit, 2, validEngineKeys.length, DEFAULT_SETTINGS.searchSuggestionEngineKeys.length);
    return validEngineKeys.slice(0, limit);
  }

  return [...DEFAULT_SETTINGS.searchSuggestionEngineKeys];
}

function sanitizePanelPositions(value) {
  const defaults = DEFAULT_SETTINGS.panelPositions;
  return {
    clock: sanitizePanelPositionItem(value?.clock, defaults.clock),
    search: sanitizePanelPositionItem(value?.search, defaults.search),
    collection: sanitizePanelPositionItem(value?.collection, defaults.collection)
  };
}

function sanitizePanelPositionItem(value, fallback) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return {
    x: Number.isFinite(x) ? x : fallback.x,
    y: Number.isFinite(y) ? y : fallback.y
  };
}

function sanitizePanelDesiredPositions(value, fallbackValue) {
  return sanitizePanelPositions(value || fallbackValue || DEFAULT_SETTINGS.panelDesiredPositions);
}

function sanitizePanelScales(value, legacyClockScale) {
  const defaults = DEFAULT_SETTINGS.panelScales;
  const migratedClockScale = clampValue(Number(legacyClockScale) / 100, 0.7, 1.8, defaults.clock);
  return {
    clock: sanitizePanelScaleItem(value?.clock, migratedClockScale),
    search: sanitizePanelScaleItem(value?.search, defaults.search),
    collection: sanitizePanelScaleItem(value?.collection, defaults.collection)
  };
}

function sanitizePanelScaleItem(value, fallback) {
  return clampValue(value, 0.7, 1.8, fallback);
}

function sanitizeBackground(value) {
  if (value?.type === "theme") {
    return {
      type: "theme",
      value: "",
      name: ""
    };
  }

  if (value?.type === "image" && typeof value.value === "string" && value.value) {
    return {
      type: "image",
      value: value.value,
      name: typeof value.name === "string" ? value.name : "Custom image selected",
      mediaType: value?.mediaType === "video" ? "video" : "image"
    };
  }

  if (value?.type === "preset" && value.value in PRESETS) {
    if (value.value === "wallpaper_1" && value.selectedByUser !== true) {
      return structuredClone(DEFAULT_STATE.background);
    }

    return {
      type: "preset",
      value: value.value,
      name: "",
      selectedByUser: true
    };
  }

  return structuredClone(DEFAULT_STATE.background);
}

function sanitizeLink(link) {
  if (!link || typeof link !== "object") return null;

  const id = typeof link.id === "string" && link.id ? link.id : crypto.randomUUID();
  const name = typeof link.name === "string" ? link.name.trim().slice(0, 30) : "";
  const url = typeof link.url === "string" ? link.url.trim() : "";
  if (!name || !url) return null;

  return {
    id,
    name,
    url,
    pinned: Boolean(link.pinned),
    icon: faviconForUrl(url)
  };
}

function saveState(showSaveError = false) {
  const payload = JSON.stringify(state);

  try {
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (error) {
    const retried = retrySaveStateAfterCleanup(payload);
    if (retried) {
      return true;
    }

    console.warn("State save failed", error);
    if (showSaveError) {
      showInlineNotice(t("alerts.save_failed"), "error");
    }
    return false;
  }
}

function retrySaveStateAfterCleanup(payload) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

async function initializeBackgroundStorage() {
  if (state.background.type !== "image") {
    storedBackgroundImageDataUrl = "";
    return;
  }

  const didMigrate = await normalizeBackgroundStorage(state);
  if (didMigrate) {
    saveState(true);
  }
}

async function normalizeBackgroundStorage(targetState) {
  if (targetState.background.type !== "image") {
    storedBackgroundImageDataUrl = "";
    return false;
  }

  if (targetState.background.value === CHROME_BACKGROUND_VALUE) {
    storedBackgroundImageDataUrl = await getStoredBackgroundImage();
    return false;
  }

  if (/^data:(image|video)\//i.test(targetState.background.value) && canUseExtensionStorage()) {
    await setStoredBackgroundImage(targetState.background.value);
    targetState.background = {
      ...targetState.background,
      value: CHROME_BACKGROUND_VALUE
    };
    return true;
  }

  storedBackgroundImageDataUrl = targetState.background.value;
  return false;
}

async function createExportableState() {
  const exportableState = structuredClone(state);
  if (exportableState.background.type === "image" && exportableState.background.value === CHROME_BACKGROUND_VALUE) {
    exportableState.background.value = await getStoredBackgroundImageForExport();
  }
  return exportableState;
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function getExtensionApi() {
  if (typeof browser !== "undefined") return browser;
  if (typeof chrome !== "undefined") return chrome;
  return null;
}

function isPromiseExtensionApi(api) {
  return typeof browser !== "undefined" && api === browser;
}

function canUseExtensionStorage() {
  return Boolean(getExtensionApi()?.storage?.local);
}

function getExtensionStorageLastError(api) {
  return api?.runtime?.lastError || (typeof chrome !== "undefined" ? chrome.runtime?.lastError : null);
}

function extensionStorageGet(keys) {
  const api = getExtensionApi();
  const storage = api?.storage?.local;
  if (!storage?.get) return Promise.resolve({});
  if (isPromiseExtensionApi(api)) {
    return storage.get(keys);
  }

  return new Promise((resolve, reject) => {
    storage.get(keys, (items) => {
      const error = getExtensionStorageLastError(api);
      if (error) {
        reject(new Error(error.message || "Extension storage get failed"));
        return;
      }
      resolve(items || {});
    });
  });
}

function extensionStorageSet(items) {
  const api = getExtensionApi();
  const storage = api?.storage?.local;
  if (!storage?.set) return Promise.resolve();
  if (isPromiseExtensionApi(api)) {
    return storage.set(items);
  }

  return new Promise((resolve, reject) => {
    storage.set(items, () => {
      const error = getExtensionStorageLastError(api);
      if (error) {
        reject(new Error(error.message || "Extension storage set failed"));
        return;
      }
      resolve();
    });
  });
}

function extensionStorageRemove(keys) {
  const api = getExtensionApi();
  const storage = api?.storage?.local;
  if (!storage?.remove) return Promise.resolve();
  if (isPromiseExtensionApi(api)) {
    return storage.remove(keys);
  }

  return new Promise((resolve, reject) => {
    storage.remove(keys, () => {
      const error = getExtensionStorageLastError(api);
      if (error) {
        reject(new Error(error.message || "Extension storage remove failed"));
        return;
      }
      resolve();
    });
  });
}

function addExtensionStorageChangeListener(listener) {
  const api = getExtensionApi();
  api?.storage?.onChanged?.addListener(listener);
}

async function getStoredBackgroundImage() {
  if (canUseIndexedDb()) {
    try {
      const storedAsset = await getBackgroundAssetFromIndexedDb();
      const renderSource = await resolveStoredBackgroundRenderSource(storedAsset);
      if (renderSource) {
        storedBackgroundImageDataUrl = renderSource;
        return renderSource;
      }
    } catch (error) {
      console.warn("IndexedDB background read failed", error);
    }
  }

  if (!canUseExtensionStorage()) return storedBackgroundImageDataUrl;
  const stored = await extensionStorageGet(BACKGROUND_IMAGE_KEY);
  const dataUrl = typeof stored[BACKGROUND_IMAGE_KEY] === "string" ? stored[BACKGROUND_IMAGE_KEY] : "";
  storedBackgroundImageDataUrl = dataUrl;
  return dataUrl;
}

async function setStoredBackgroundImage(asset) {
  if (canUseIndexedDb()) {
    const storedAsset = await createStoredBackgroundAsset(asset);
    await setBackgroundAssetInIndexedDb(storedAsset);
    storedBackgroundImageDataUrl = await resolveStoredBackgroundRenderSource(storedAsset);
    if (canUseExtensionStorage()) {
      await extensionStorageRemove(BACKGROUND_IMAGE_KEY);
    }
    return;
  }

  const dataUrl = typeof asset === "string"
    ? asset
    : await convertBlobToDataUrl(asset?.blob);
  storedBackgroundImageDataUrl = dataUrl;
  if (!canUseExtensionStorage()) return;
  await extensionStorageSet({ [BACKGROUND_IMAGE_KEY]: dataUrl });
}

async function createStoredBackgroundAsset(asset) {
  if (typeof asset !== "string" || !asset.startsWith("data:")) {
    return asset;
  }

  try {
    const blob = await dataUrlToBlob(asset);
    if (!blob) return asset;
    return {
      kind: "blob",
      mimeType: blob.type || getDataUrlMimeType(asset),
      blob
    };
  } catch {
    return asset;
  }
}

async function clearStoredBackgroundImage() {
  revokeStoredBackgroundObjectUrl();
  storedBackgroundImageDataUrl = "";
  if (canUseIndexedDb()) {
    try {
      await clearBackgroundAssetInIndexedDb();
    } catch (error) {
      console.warn("IndexedDB background clear failed", error);
    }
  }
  if (!canUseExtensionStorage()) return;
  await extensionStorageRemove(BACKGROUND_IMAGE_KEY);
}

function revokeStoredBackgroundObjectUrl() {
  if (!storedBackgroundObjectUrl) return;
  URL.revokeObjectURL(storedBackgroundObjectUrl);
  storedBackgroundObjectUrl = "";
}

async function resolveStoredBackgroundRenderSource(storedAsset) {
  if (!storedAsset) return "";
  if (typeof storedAsset === "string") {
    revokeStoredBackgroundObjectUrl();
    return storedAsset;
  }

  if (storedAsset.kind === "blob" && storedAsset.blob instanceof Blob) {
    revokeStoredBackgroundObjectUrl();
    storedBackgroundObjectUrl = URL.createObjectURL(storedAsset.blob);
    return storedBackgroundObjectUrl;
  }

  return "";
}

async function getStoredBackgroundImageForExport() {
  if (canUseIndexedDb()) {
    try {
      const storedAsset = await getBackgroundAssetFromIndexedDb();
      if (typeof storedAsset === "string") {
        return storedAsset;
      }
      if (storedAsset?.kind === "blob" && storedAsset.blob instanceof Blob) {
        return await convertBlobToDataUrl(storedAsset.blob);
      }
    } catch (error) {
      console.warn("IndexedDB background export read failed", error);
    }
  }

  return storedBackgroundImageDataUrl || await getStoredBackgroundImage();
}

function openBackgroundAssetDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKGROUND_DB_NAME, BACKGROUND_DB_VERSION);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BACKGROUND_DB_STORE)) {
        database.createObjectStore(BACKGROUND_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function withBackgroundAssetStore(mode, callback) {
  const database = await openBackgroundAssetDatabase();
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(BACKGROUND_DB_STORE, mode);
    const store = transaction.objectStore(BACKGROUND_DB_STORE);
    let transactionResult;

    let settled = false;
    const finishResolve = (value) => {
      transactionResult = value;
    };
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      database.close();
      resolve(transactionResult);
    };
    transaction.onerror = () => {
      database.close();
      finishReject(transaction.error || new Error("IndexedDB transaction failed"));
    };
    transaction.onabort = () => {
      database.close();
      finishReject(transaction.error || new Error("IndexedDB transaction aborted"));
    };

    callback(store, finishResolve, finishReject);
  });
}

async function getBackgroundAssetFromIndexedDb() {
  let result = "";
  await withBackgroundAssetStore("readonly", (store, finishResolve, finishReject) => {
    const request = store.get(BACKGROUND_DB_RECORD_KEY);
    request.onerror = () => finishReject(request.error || new Error("IndexedDB get failed"));
    request.onsuccess = () => {
      result = request.result || "";
      finishResolve(result);
    };
  });
  return result;
}

async function setBackgroundAssetInIndexedDb(dataUrl) {
  await withBackgroundAssetStore("readwrite", (store, finishResolve, finishReject) => {
    const request = store.put(dataUrl, BACKGROUND_DB_RECORD_KEY);
    request.onerror = () => finishReject(request.error || new Error("IndexedDB put failed"));
    request.onsuccess = () => finishResolve();
  });
}

async function clearBackgroundAssetInIndexedDb() {
  await withBackgroundAssetStore("readwrite", (store, finishResolve, finishReject) => {
    const request = store.delete(BACKGROUND_DB_RECORD_KEY);
    request.onerror = () => finishReject(request.error || new Error("IndexedDB delete failed"));
    request.onsuccess = () => finishResolve();
  });
}

async function optimizeImageFileForStorage(file) {
  if (isVideoBackgroundFile(file)) {
    if (file.size > MAX_BACKGROUND_VIDEO_DATA_URL_LENGTH) {
      throw new Error("Video exceeds storage budget");
    }
    return {
      storedAsset: {
        kind: "blob",
        mimeType: file.type || "video/mp4",
        blob: file
      }
    };
  }

  if (isGifBackgroundFile(file)) {
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl.length > MAX_BACKGROUND_DATA_URL_LENGTH) {
      throw new Error("GIF exceeds storage budget");
    }
    return { dataUrl };
  }

  const image = await loadImageFile(file);
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;

  if (!width || !height) {
    throw new Error("Invalid image dimensions");
  }

  const initialScale = Math.min(1, MAX_BACKGROUND_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * initialScale));
  height = Math.max(1, Math.round(height * initialScale));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas unavailable");
  }

  let attempts = 0;
  let quality = 0.9;
  let format = file.type === "image/png" ? "image/webp" : (file.type || "image/webp");
  let dataUrl = "";

  while (attempts < 8) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    dataUrl = canvas.toDataURL(format, quality);

    if (dataUrl.length <= MAX_BACKGROUND_DATA_URL_LENGTH) {
      return { dataUrl };
    }

    if (quality > 0.55) {
      quality -= 0.1;
    } else {
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }

    attempts += 1;
  }

  throw new Error("Optimized image still exceeds storage budget");
}

function isGifBackgroundFile(file) {
  if (!file) return false;
  return file.type === "image/gif" || /\.gif$/i.test(file.name || "");
}

function isVideoBackgroundFile(file) {
  if (!file) return false;
  return file.type === "video/mp4" || /\.mp4$/i.test(file.name || "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function convertBlobToDataUrl(blob) {
  return await readFileAsDataUrl(blob);
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return await response.blob();
}

function getDataUrlMimeType(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)/i);
  return match ? match[1] : "";
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image decode failed"));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function importPendingSavedLinks() {
  if (!canUseExtensionStorage()) return;

  try {
    const { pendingLinks, keysToRemove, shouldPersistEmptyIndex } = await readPendingSavedLinks();
    if (!pendingLinks.length) {
      if (shouldPersistEmptyIndex) {
        await extensionStorageSet({ [PENDING_LINK_IDS_KEY]: [] });
      }
      return;
    }

    let didChange = false;
    const existingUrls = new Set(state.links.map((link) => normalizeUrl(link.url).toLowerCase()));

    pendingLinks.forEach((rawLink) => {
      const link = sanitizeLink(rawLink);
      if (!link) return;

      const normalizedUrl = normalizeUrl(link.url).toLowerCase();
      if (existingUrls.has(normalizedUrl)) return;

      existingUrls.add(normalizedUrl);
      state.links.push(link);
      didChange = true;
    });

    if (keysToRemove.length) {
      await extensionStorageRemove(keysToRemove);
    }
    await extensionStorageSet({ [PENDING_LINK_IDS_KEY]: [] });

    if (!didChange) return;

    state.links = reorderPinnedLinks(state.links);
    persistAndRender(true);
  } catch (error) {
    console.warn("Pending link import failed", error);
  }
}

async function readPendingSavedLinks() {
  const indexed = await extensionStorageGet(PENDING_LINK_IDS_KEY);
  const hasIndex = Array.isArray(indexed[PENDING_LINK_IDS_KEY]);

  if (hasIndex) {
    const pendingIds = [...new Set(indexed[PENDING_LINK_IDS_KEY].filter((id) => typeof id === "string" && id))];
    if (!pendingIds.length) {
      return { pendingLinks: [], keysToRemove: [], shouldPersistEmptyIndex: false };
    }

    const pendingKeys = pendingIds.map((id) => `${PENDING_LINK_KEY_PREFIX}${id}`);
    const stored = await extensionStorageGet(pendingKeys);
    return {
      pendingLinks: pendingKeys.map((key) => stored[key]).filter(Boolean),
      keysToRemove: pendingKeys,
      shouldPersistEmptyIndex: true
    };
  }

  const stored = await extensionStorageGet(null);
  const pendingKeys = Object.keys(stored).filter((key) => key.startsWith(PENDING_LINK_KEY_PREFIX));
  const pendingLinks = pendingKeys.map((key) => stored[key]).filter(Boolean);
  const legacyPendingLinks = Array.isArray(stored[PENDING_LINKS_KEY]) ? stored[PENDING_LINKS_KEY] : [];
  pendingLinks.push(...legacyPendingLinks);

  return {
    pendingLinks,
    keysToRemove: legacyPendingLinks.length ? [...pendingKeys, PENDING_LINKS_KEY] : pendingKeys,
    shouldPersistEmptyIndex: true
  };
}

function bindPendingLinkSync() {
  addExtensionStorageChangeListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes[BACKGROUND_IMAGE_KEY] && state.background.type === "image") {
      storedBackgroundImageDataUrl = typeof changes[BACKGROUND_IMAGE_KEY].newValue === "string"
        ? changes[BACKGROUND_IMAGE_KEY].newValue
        : "";
      renderBackground();
    }

    const hasPendingLinkChange = Object.keys(changes).some((key) => (
      key === PENDING_LINKS_KEY || key === PENDING_LINK_IDS_KEY || key.startsWith(PENDING_LINK_KEY_PREFIX)
    ));
    if (hasPendingLinkChange) {
      void importPendingSavedLinks();
    }
  });
}


