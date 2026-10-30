// Shared user data and preferences. Theme fields and view-derived panel bounds stay local.
const SHARED_SYNC_PREFIX = "lunarShared:v1:";
const SHARED_THEME_KEYS = ["theme", "themeStyle", "accentColor", "textColor", "panelColor", "dropdownColor", "sliderTrackColor", "sliderFillColor"];
const SHARED_TOP_KEYS = ["layout", "language", "searchEngine", "searchHistory", "background"];
const SHARED_SETTING_KEYS = ["fontScale", "radius", "panelBlur", "panelOpacity", "searchSuggestionsEnabled", "searchSuggestionsAllEnginesEnabled", "searchSuggestionEngineKeys", "searchUiVisible", "shortcutsVisible", "clockVisible", "clockStyle", "columns", "rows", "cardGap", "cardHeight"];
const SHARED_LINK_KEYS = ["name", "url", "pinned"];
let sharedSyncReady = false;
let sharedSyncBaseline = null;
let sharedSyncThemeBaseline = null;
let sharedSyncRenderTimer = 0;
let sharedSyncRendering = false;
let sharedSyncNeedsRender = false;
let sharedBackgroundRevision = "";

function sharedSyncIsLegacy() { return STORAGE_KEY === "customHomeStateLegacy"; }
function sharedSyncClone(value) { return value === undefined ? undefined : structuredClone(value); }
function sharedSyncEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function sharedSyncRead(key, fallback = null) {
  const raw = localStorage.getItem(SHARED_SYNC_PREFIX + key);
  return raw === null ? fallback : JSON.parse(raw);
}
function sharedSyncWrite(key, value) { localStorage.setItem(SHARED_SYNC_PREFIX + key, JSON.stringify(value)); }
function sharedSyncProfile(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function sharedSyncLinkKey(id, field) { return `link:${encodeURIComponent(id)}:${field}`; }
function sharedSyncTheme(settings) {
  return Object.fromEntries(SHARED_THEME_KEYS.filter(key => key in settings).map(key => [key, sharedSyncClone(settings[key])]));
}

function sharedSyncProject(input) {
  const fields = {};
  for (const key of SHARED_TOP_KEYS) if (key in input) fields[key] = sharedSyncClone(input[key]);
  for (const key of SHARED_SETTING_KEYS) {
    if (!(key in input.settings)) continue;
    fields[`settings.${key}`] = sharedSyncClone(input.settings[key]);
  }
  if (sharedSyncIsLegacy() && typeof fields["settings.cardHeight"] === "number") fields["settings.cardHeight"] /= 2;
  for (const panel of ["clock", "search", "collection"]) {
    const desired = input.settings.panelDesiredPositions?.[panel] || input.settings.panelPositions?.[panel];
    if (desired) fields[`position.${panel}`] = sharedSyncClone(desired);
    if (input.settings.panelScales?.[panel] !== undefined) fields[`scale.${panel}`] = input.settings.panelScales[panel];
  }
  const links = {};
  for (const link of input.links || []) links[link.id] = Object.fromEntries(SHARED_LINK_KEYS.map(key => [key, sharedSyncClone(link[key])]));
  return { fields, links, order: (input.links || []).map(link => link.id) };
}

function readSharedDocument() {
  const seed = sharedSyncRead("seed");
  if (!seed) return null;
  const document = sharedSyncClone(seed);
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(SHARED_SYNC_PREFIX)) continue;
    const relative = key.slice(SHARED_SYNC_PREFIX.length);
    if (relative.startsWith("field:")) document.fields[relative.slice(6)] = JSON.parse(localStorage.getItem(key));
    else if (relative === "order") document.order = JSON.parse(localStorage.getItem(key));
    else if (relative.startsWith("link:")) {
      const match = relative.match(/^link:([^:]+):(exists|name|url|pinned)$/);
      if (!match) continue;
      const id = decodeURIComponent(match[1]);
      document.links[id] ||= {};
      document.links[id][match[2]] = JSON.parse(localStorage.getItem(key));
    }
  }
  return document;
}

function initializeSharedState() {
  if (sharedSyncReady) return;
  if (!sharedSyncRead("seed")) {
    const seed = sharedSyncProject(state);
    seed.links = {};
    seed.order = [];
    const seen = new Set();
    const other = sharedSyncProfile(sharedSyncIsLegacy() ? "customHomeState" : "customHomeStateLegacy");
    for (const raw of [...(state.links || []), ...(other?.links || [])]) {
      const link = sanitizeLink(raw);
      if (!link) continue;
      const url = normalizeUrl(link.url).toLowerCase();
      if (seen.has(url)) continue;
      seen.add(url);
      const id = seed.links[link.id] ? crypto.randomUUID() : link.id;
      seed.links[id] = Object.fromEntries(SHARED_LINK_KEYS.map(key => [key, sharedSyncClone(link[key])]));
      seed.order.push(id);
    }
    seed.backgroundSource = sharedSyncIsLegacy() ? "legacy" : "modern";
    sharedSyncWrite("seed", seed);
  }
  sharedSyncReady = true;
  state = materializeSharedState(state);
  sharedSyncBaseline = sharedSyncProject(state);
  sharedSyncThemeBaseline = sharedSyncTheme(state.settings);
  sharedBackgroundRevision = localStorage.getItem(SHARED_SYNC_PREFIX + "assetRevision") || "";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.addEventListener("storage", event => {
    if (event.key?.startsWith(SHARED_SYNC_PREFIX) || event.key === STORAGE_KEY) scheduleSharedStateRender();
  });
}

function materializeSharedState(input) {
  const shared = readSharedDocument();
  if (!shared) return input;
  const result = sharedSyncClone(input);
  const cached = sharedSyncProfile(STORAGE_KEY);
  // A stale tab cannot overwrite another tab's newer theme unless it changed that field itself.
  if (sharedSyncThemeBaseline && cached?.settings) for (const key of SHARED_THEME_KEYS) {
    if (sharedSyncEqual(input.settings[key], sharedSyncThemeBaseline[key]) && key in cached.settings) result.settings[key] = cached.settings[key];
  }
  for (const [key, value] of Object.entries(shared.fields)) {
    if (SHARED_TOP_KEYS.includes(key)) result[key] = sharedSyncClone(value);
    else if (key.startsWith("settings.") && SHARED_SETTING_KEYS.includes(key.slice(9))) result.settings[key.slice(9)] = sharedSyncClone(value);
    else if (key.startsWith("position.")) {
      result.settings.panelDesiredPositions ||= {};
      result.settings.panelDesiredPositions[key.slice(9)] = sharedSyncClone(value);
    } else if (key.startsWith("scale.")) {
      result.settings.panelScales ||= {};
      result.settings.panelScales[key.slice(6)] = value;
    }
  }
  if (sharedSyncIsLegacy() && typeof result.settings.cardHeight === "number") result.settings.cardHeight *= 2;
  const ordered = [...new Set([...(shared.order || []), ...Object.keys(shared.links)])];
  const seen = new Set();
  result.links = [];
  for (const id of ordered) {
    const value = shared.links[id];
    if (!value || value.exists === false || !value.url || !value.name) continue;
    const url = normalizeUrl(value.url).toLowerCase();
    if (seen.has(url)) continue;
    seen.add(url);
    result.links.push({ id, name: value.name, url: value.url, pinned: Boolean(value.pinned) });
  }
  return sanitizeState(result);
}

function publishSharedState() {
  if (!sharedSyncReady) return;
  const current = sharedSyncProject(state);
  const baseline = sharedSyncBaseline;
  const latest = readSharedDocument();
  for (const [key, candidate] of Object.entries(current.fields)) {
    let value = candidate;
    if (key === "searchHistory" && Array.isArray(value) && value.length) {
      const previous = new Set((baseline.fields.searchHistory || []).map(query => query.toLowerCase()));
      const added = value.filter(query => !previous.has(query.toLowerCase()));
      if (added.length) {
        const seen = new Set();
        value = [...added, ...(latest.fields.searchHistory || [])].filter(query => {
          const key = query.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, MAX_SEARCH_HISTORY);
      }
    }
    if (!sharedSyncEqual(value, baseline.fields[key])) sharedSyncWrite(`field:${key}`, value);
  }
  for (const id of Object.keys(baseline.links)) {
    if (id in current.links) continue;
    const url = normalizeUrl(baseline.links[id].url).toLowerCase();
    sharedSyncWrite(sharedSyncLinkKey(id, "exists"), false);
    for (const [duplicateId, link] of Object.entries(latest.links)) if (link.url && normalizeUrl(link.url).toLowerCase() === url) sharedSyncWrite(sharedSyncLinkKey(duplicateId, "exists"), false);
  }
  for (const [id, link] of Object.entries(current.links)) {
    const previous = baseline.links[id];
    if (previous && latest.links[id]?.exists === false) continue;
    if (!previous) sharedSyncWrite(sharedSyncLinkKey(id, "exists"), true);
    for (const key of SHARED_LINK_KEYS) if (!previous || !sharedSyncEqual(link[key], previous[key])) sharedSyncWrite(sharedSyncLinkKey(id, key), link[key]);
  }
  if (!sharedSyncEqual(current.order, baseline.order)) sharedSyncWrite("order", current.order);
  state = materializeSharedState(state);
  sharedSyncBaseline = sharedSyncProject(state);
  sharedSyncThemeBaseline = sharedSyncTheme(state.settings);
  if (!sharedSyncEqual(current, sharedSyncBaseline)) {
    sharedSyncNeedsRender = true;
    scheduleSharedStateRender();
  }
}

function isSharedBookmarkDeleted(id) { return sharedSyncReady && readSharedDocument()?.links[id]?.exists === false; }

function scheduleSharedStateRender() {
  if (!sharedSyncReady || sharedSyncRenderTimer) return;
  sharedSyncRenderTimer = window.setTimeout(() => {
    sharedSyncRenderTimer = 0;
    if (activePanelDrag || (typeof activePanelResize !== "undefined" && activePanelResize) || activeCustomRange) {
      scheduleSharedStateRender();
      return;
    }
    void refreshSharedState();
  }, 32);
}

async function refreshSharedState() {
  if (!sharedSyncReady || sharedSyncRendering) return;
  if (typeof flushPendingSettingChanges === "function") flushPendingSettingChanges();
  const previous = sharedSyncProject(state);
  const oldTheme = sharedSyncTheme(state.settings);
  const previousLanguage = state.language;
  const previousBackground = sharedSyncClone(state.background);
  publishSharedState();
  const next = sharedSyncProject(state);
  const revision = localStorage.getItem(SHARED_SYNC_PREFIX + "assetRevision") || "";
  if (!sharedSyncNeedsRender && sharedSyncEqual(previous, next) && sharedSyncEqual(oldTheme, sharedSyncTheme(state.settings)) && revision === sharedBackgroundRevision) return;
  sharedSyncNeedsRender = false;
  sharedBackgroundRevision = revision;
  sharedSyncRendering = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (previousLanguage !== state.language) {
      await loadLanguage(state.language);
      applyTranslations();
    }
    if (!sharedSyncEqual(previousBackground, state.background) || state.background.type === "image") await initializeBackgroundStorage();
    renderAll();
  } catch (error) {
    console.warn("Shared state refresh failed", error);
  } finally {
    sharedSyncRendering = false;
    sharedSyncBaseline = sharedSyncProject(state);
    sharedSyncThemeBaseline = sharedSyncTheme(state.settings);
    scheduleSharedStateRender();
  }
}

function notifySharedBackgroundChange() {
  if (sharedSyncReady) sharedSyncWrite("assetRevision", crypto.randomUUID());
}

async function migrateSharedBackgroundStorage() {
  if (!sharedSyncReady || sharedSyncRead("backgroundMigrated")) return;
  if (state.background.type === "image" && state.background.value === CHROME_BACKGROUND_VALUE) {
    let asset = canUseIndexedDb() ? await getBackgroundAssetFromIndexedDb() : "";
    const source = sharedSyncRead("seed")?.backgroundSource;
    const databases = source === "legacy" ? ["lunarStartLegacyBackgrounds", "lunarStartBackgrounds"] : ["lunarStartBackgrounds", "lunarStartLegacyBackgrounds"];
    for (const name of databases) if (!asset && canUseIndexedDb()) asset = await getBackgroundAssetFromIndexedDb(name);
    if (!asset && canUseExtensionStorage()) {
      const keys = source === "legacy" ? ["legacy:customBackgroundImageDataUrl", "customBackgroundImageDataUrl"] : ["customBackgroundImageDataUrl", "legacy:customBackgroundImageDataUrl"];
      const stored = await extensionStorageGet(keys);
      asset = keys.map(key => stored[key]).find(Boolean);
    }
    if (asset) await setStoredBackgroundImage(asset);
  }
  sharedSyncWrite("backgroundMigrated", true);
}
