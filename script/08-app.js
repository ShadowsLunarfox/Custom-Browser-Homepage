// Application bootstrapping, state, DOM caches, and event wiring.
function createDefaultLink(name, url, pinned) {
  return {
    id: crypto.randomUUID(),
    name,
    url,
    pinned,
    icon: faviconForUrl(url)
  };
}

const DEFAULT_STATE = {
  version: DATA_VERSION,
  layout: "grid",
  searchEngine: "google",
  language: DEFAULT_LANGUAGE,
  searchHistory: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  links: [
    createDefaultLink("YouTube", "https://www.youtube.com", true),
    createDefaultLink("x", "https://x.com", false),
    createDefaultLink("facebook", "https://facebook.com", false)
    
  ],
  background: {
    type: "theme",
    value: "",
    name: ""
  }
};

let state = loadState();
let draggedLinkId = null;
let bookmarkFilter = "";
let activePanelDrag = null;
let storedBackgroundImageDataUrl = "";
let storedBackgroundObjectUrl = "";
let searchSuggestionItems = [];
let activeSuggestionIndex = -1;
let searchSuggestionRequestId = 0;
let searchSuggestionTimer = null;
let searchSuggestionAbortController = null;
let voiceSearchRecognition = null;
let isVoiceSearchListening = false;
let voiceSearchAbortRequested = false;
let voiceSearchPressTimer = null;
let currentLanguage = DEFAULT_LANGUAGE;
let translations = {};
let didMarkAppReady = false;
let didInitializeDebugTools = false;
let loadedThemeFontKey = "";

const clockEl = document.getElementById("clock");
const dateTextEl = document.getElementById("date-text");
const clockPanelEl = document.querySelector(".floating-clock");
const analogClockEl = document.getElementById("analog-clock");
const hourHandEl = document.getElementById("hour-hand");
const minuteHandEl = document.getElementById("minute-hand");
const secondHandEl = document.getElementById("second-hand");
const collectionGridEl = document.getElementById("collection-grid");
const collectionShellEl = document.getElementById("collection-shell");
const searchFormEl = document.getElementById("search-form");
const searchInputEl = document.getElementById("search-input");
const searchEngineEl = document.getElementById("search-engine");
const imageSearchButtonEl = document.getElementById("image-search-button");
const imageSearchDialogEl = document.getElementById("image-search-dialog");
const imageSearchDropzoneEl = document.getElementById("image-search-dropzone");
const imageSearchUploadEl = document.getElementById("image-search-upload");
const imageSearchChooseEl = document.getElementById("image-search-choose");
const imageSearchFileNameEl = document.getElementById("image-search-file-name");
const voiceSearchButtonEl = document.getElementById("voice-search-button");
const searchAllEnginesButtonEl = document.getElementById("search-all-engines");
const settingsDialogEl = document.getElementById("settings-dialog");
const settingsSearchEngineEl = document.getElementById("settings-search-engine");
const searchSuggestionsSettingEl = document.getElementById("search-suggestions-setting");
const searchSuggestionsAllEnginesSettingEl = document.getElementById("search-suggestions-all-engines-setting");
const searchSuggestionEngineListEl = document.getElementById("search-suggestion-engine-list");
const languageSelectEl = document.getElementById("language-select");
const searchSuggestionsEl = document.getElementById("search-suggestions");
const appNoticesEl = document.getElementById("app-notices");
const backgroundVideoEl = document.querySelector(".background-video");
const backgroundLayerEl = document.querySelector(".background-layer");
const backgroundStatusEl = document.getElementById("background-status");
const presetGridEl = document.getElementById("preset-grid");
const layoutGridButtonEl = document.getElementById("layout-grid");
const layoutListButtonEl = document.getElementById("layout-list");
const importFileEl = document.getElementById("import-file");
const backgroundUploadEl = document.getElementById("background-upload");
const backgroundUploadTriggerEl = document.getElementById("background-upload-trigger");
const backgroundUploadNameEl = document.getElementById("background-upload-name");
const themeStyleLinkEl = document.getElementById("theme-style-link");
const wallpaperStyleLinkEl = document.getElementById("wallpaper-style-link");
const themeModeEl = document.getElementById("theme-mode");
const themeStyleEl = document.getElementById("theme-style");
const accentColorEl = document.getElementById("accent-color");
const accentColorValueEl = document.getElementById("accent-color-value");
const textColorEl = document.getElementById("text-color");
const textColorValueEl = document.getElementById("text-color-value");
const fontScaleRangeEl = document.getElementById("font-scale-range");
const fontScaleValueEl = document.getElementById("font-scale-value");
const radiusRangeEl = document.getElementById("radius-range");
const radiusValueEl = document.getElementById("radius-value");
const blurRangeEl = document.getElementById("blur-range");
const blurValueEl = document.getElementById("blur-value");
const searchUiShowButtonEl = document.getElementById("search-ui-show");
const searchUiHideButtonEl = document.getElementById("search-ui-hide");
const shortcutsUiShowButtonEl = document.getElementById("shortcuts-ui-show");
const shortcutsUiHideButtonEl = document.getElementById("shortcuts-ui-hide");
const clockVisibilityEl = document.getElementById("clock-visibility");
const clockStyleEl = document.getElementById("clock-style");
const columnsRangeEl = document.getElementById("columns-range");
const columnsValueEl = document.getElementById("columns-value");
const rowsRangeEl = document.getElementById("rows-range");
const rowsValueEl = document.getElementById("rows-value");
const cardGapRangeEl = document.getElementById("card-gap-range");
const cardGapValueEl = document.getElementById("card-gap-value");
const cardHeightRangeEl = document.getElementById("card-height-range");
const cardHeightValueEl = document.getElementById("card-height-value");
const panelOpacityRangeEl = document.getElementById("panel-opacity-range");
const panelOpacityValueEl = document.getElementById("panel-opacity-value");
const openDebugToolsButtonEl = document.getElementById("open-debug-tools");
const debugDialogEl = document.getElementById("debug-dialog");
const debugStatusListEl = document.getElementById("debug-status-list");
const debugIssuesListEl = document.getElementById("debug-issues-list");
const debugFeatureListEl = document.getElementById("debug-feature-list");
const debugStorageUsageListEl = document.getElementById("debug-storage-usage-list");
const debugLocalStorageListEl = document.getElementById("debug-local-storage-list");
const debugPreflightCacheEl = document.getElementById("debug-preflight-cache");
const debugSimulationSelectEl = document.getElementById("debug-simulation-select");
const debugLanguagePreviewEl = document.getElementById("debug-language-preview");
const debugRefreshStatusButtonEl = document.getElementById("debug-refresh-status");
const debugCopyDiagnosticsButtonEl = document.getElementById("debug-copy-diagnostics");
const debugRerunBrowserCheckButtonEl = document.getElementById("debug-rerun-browser-check");
const debugShowCompatibilityNoticeButtonEl = document.getElementById("debug-show-compatibility-notice");
const debugOpenUnsupportedPreviewButtonEl = document.getElementById("debug-open-unsupported-preview");
const debugRefreshStorageButtonEl = document.getElementById("debug-refresh-storage");
const debugClearCompatAcksButtonEl = document.getElementById("debug-clear-compat-acks");
const debugClearWallpaperCacheButtonEl = document.getElementById("debug-clear-wallpaper-cache");
const debugResetSettingsKeepBookmarksButtonEl = document.getElementById("debug-reset-settings-keep-bookmarks");
const debugResetBookmarksKeepSettingsButtonEl = document.getElementById("debug-reset-bookmarks-keep-settings");
const debugExportBackupButtonEl = document.getElementById("debug-export-backup");
const debugImportBackupTriggerEl = document.getElementById("debug-import-backup-trigger");
const debugBackupImportEl = document.getElementById("debug-backup-import");
const debugForceFirstRunButtonEl = document.getElementById("debug-force-first-run");
const debugShowSimulatedNoticeButtonEl = document.getElementById("debug-show-simulated-notice");
const debugPreviewSimulatedUnsupportedButtonEl = document.getElementById("debug-preview-simulated-unsupported");
const debugPreviewLanguageButtonEl = document.getElementById("debug-preview-language");
const clearLocalStorageButtonEl = document.getElementById("clear-local-storage");
const browserCompatibilityDialogEl = document.getElementById("browser-compatibility-dialog");
const browserCompatibilityTitleEl = document.getElementById("browser-compatibility-title");
const browserCompatibilityDescEl = document.getElementById("browser-compatibility-desc");
const browserCompatibilityFeatureHeadingEl = document.getElementById("browser-compatibility-feature-heading");
const browserCompatibilityListEl = document.getElementById("browser-compatibility-list");
const browserCompatibilityAcknowledgeEl = document.getElementById("browser-compatibility-acknowledge");
const draggablePanelEls = [...document.querySelectorAll("[data-draggable-id]")];

const CHINESE_BROWSER_COMPAT_MESSAGES = {
  "dialogs.browser_compat_severe_title": "{browser} 无法正常运行",
  "dialogs.browser_compat_severe_desc": "该浏览器插件无法正常运行。请更新到最新浏览器或内核版本，否则无法正常使用。",
  "dialogs.browser_compat_named_title": "{browser} 兼容提示",
  "dialogs.browser_compat_named_desc": "已为 {browser} 检测到以下兼容提示：",
  "dialogs.browser_compat_unavailable_heading": "无法使用的功能",
  "dialogs.browser_compat_notes_heading": "兼容提示",
  "dialogs.browser_compat_chinese_fast_mode": "如果这是双核浏览器，请使用“极速模式/Chromium 内核”，不要使用“兼容模式/IE 内核”。",
  "dialogs.browser_compat_ie_mode": "当前页面可能处于兼容模式/IE 内核，请切换到极速模式/Chromium 内核。",
  "dialogs.browser_compat_old_chromium": "当前 Chromium 内核版本较旧（{version}），搜索、壁纸或设置功能可能异常，建议更新浏览器。",
  "dialogs.browser_compat_voice": "语音搜索在当前浏览器中不可用或被限制。",
  "dialogs.browser_compat_random_uuid": "当前浏览器缺少 crypto.randomUUID，新建快捷方式可能无法可靠生成 ID。",
  "dialogs.browser_compat_structured_clone": "当前浏览器缺少 structuredClone，保存的设置可能无法正常读取。",
  "dialogs.browser_compat_dialog": "当前浏览器缺少原生弹窗支持，设置和上传弹窗可能无法正常打开。",
  "dialogs.browser_compat_data_transfer": "拖拽图片搜索可能不可用，请改用“选择图片”按钮。",
  "dialogs.browser_compat_indexeddb": "IndexedDB 不可用，较大的自定义壁纸可能无法保存。",
  "dialogs.browser_compat_color_mix": "CSS color-mix 不可用，部分主题颜色可能与预期不同。",
  "dialogs.browser_compat_backdrop_filter": "背景模糊不可用，毛玻璃视觉效果可能与预期不同。",
  "dialogs.browser_compat_no_issue_found": "暂未检测到阻塞问题，但同类浏览器的不同版本兼容性可能不一致。"
};

void initialize();

async function initialize() {
  document.documentElement.lang = normalizeLanguage(state.language || detectPreferredLanguage());
  renderPriorityBackgroundShell();
  const backgroundReady = initializeBackgroundStorage();

  try {
    await backgroundReady;
    renderBackground();
  } catch (error) {
    console.warn("Background storage initialization failed", error);
    renderBackground();
  }

  bindEvents();
  startClock();
  bindPendingLinkSync();
  primeCachedLocalization();
  renderStartupShell();
  const localizationReady = initializeLocalization();

  renderAll({ includeBackground: false });
  markAppReady();
  void localizationReady.then(() => {
    renderAll({ includeBackground: false });
  });

  void localizationReady.finally(() => {
    renderSettingsPanelIfReady();
    applyTranslations();
    showBrowserCompatibilityNoticeIfNeeded();
  });
  void importPendingSavedLinks();
}

function markAppReady() {
  if (didMarkAppReady) return;
  didMarkAppReady = true;
  document.body.classList.remove("app-loading");
  document.body.classList.add("app-ready");
}

function bindEvents() {
  bindBackgroundVideoRecovery();
  initializeCustomSelects();
  initializeCustomRanges();
  bindBrowserCompatibilityNotice();

  document.querySelectorAll("dialog.app-dialog").forEach((dialog) => {
    bindDialogBackdropClose(dialog);
  });
  settingsDialogEl.addEventListener("close", pausePresetVideoPreviews);

  searchFormEl.addEventListener("submit", handleSearch);
  searchInputEl.addEventListener("input", handleSearchInput);
  searchInputEl.addEventListener("keydown", handleSearchSuggestionKeydown);
  searchInputEl.addEventListener("focus", handleSearchInput);
  searchInputEl.addEventListener("blur", handleSearchInputBlur);
  searchEngineEl.addEventListener("change", handleSearchEngineChange);
  imageSearchButtonEl.addEventListener("click", handleImageSearchClick);
  bindImageSearchDropUi();
  voiceSearchButtonEl.addEventListener("click", handleVoiceSearchToggle);
  searchAllEnginesButtonEl.addEventListener("click", handleMultiSuggestionsToggleClick);
  settingsSearchEngineEl.addEventListener("change", handleSettingsSearchEngineChange);
  searchSuggestionsSettingEl.addEventListener("change", () => updateSetting("searchSuggestionsEnabled", searchSuggestionsSettingEl.value === "on"));
  searchSuggestionsAllEnginesSettingEl.addEventListener("change", handleAllEngineSuggestionsSettingChange);
  searchSuggestionEngineListEl.addEventListener("change", handleSearchSuggestionEngineListChange);
  languageSelectEl.addEventListener("change", handleLanguageChange);

  document.getElementById("export-links").addEventListener("click", exportState);
  document.getElementById("import-links").addEventListener("click", () => importFileEl.click());
  importFileEl.addEventListener("change", importStateFile);

  document.getElementById("open-settings").addEventListener("click", openSettingsDialog);
  document.getElementById("clear-background").addEventListener("click", clearCustomBackground);
  document.getElementById("reset-appearance").addEventListener("click", resetAppearanceSettings);
  bindOptionalClick(openDebugToolsButtonEl, openDebugToolsDialog);
  backgroundUploadTriggerEl.addEventListener("click", triggerBackgroundUpload);
  backgroundUploadEl.addEventListener("change", handleBackgroundUpload);
  layoutGridButtonEl.addEventListener("click", () => setLayout("grid"));
  layoutListButtonEl.addEventListener("click", () => setLayout("list"));
  document.getElementById("link-form").addEventListener("submit", saveLink);

  themeModeEl.addEventListener("change", () => updateSetting("theme", themeModeEl.value));
  themeStyleEl.addEventListener("change", () => updateSetting("themeStyle", themeStyleEl.value));
  accentColorEl.addEventListener("input", () => updateSetting("accentColor", accentColorEl.value));
  textColorEl.addEventListener("input", () => updateSetting("textColor", textColorEl.value));
  fontScaleRangeEl.addEventListener("input", () => updateSetting("fontScale", Number(fontScaleRangeEl.value)));
  radiusRangeEl.addEventListener("input", () => updateSetting("radius", Number(radiusRangeEl.value)));
  blurRangeEl.addEventListener("input", () => updateSetting("panelBlur", Number(blurRangeEl.value)));
  searchUiShowButtonEl.addEventListener("click", () => updateSetting("searchUiVisible", true));
  searchUiHideButtonEl.addEventListener("click", () => updateSetting("searchUiVisible", false));
  shortcutsUiShowButtonEl.addEventListener("click", () => updateSetting("shortcutsVisible", true));
  shortcutsUiHideButtonEl.addEventListener("click", () => updateSetting("shortcutsVisible", false));
  clockVisibilityEl.addEventListener("change", () => updateSetting("clockVisible", clockVisibilityEl.value === "show"));
  clockStyleEl.addEventListener("change", () => updateSetting("clockStyle", clockStyleEl.value));
  columnsRangeEl.addEventListener("input", () => updateSetting("columns", Number(columnsRangeEl.value)));
  rowsRangeEl.addEventListener("input", () => updateSetting("rows", Number(rowsRangeEl.value)));
  cardGapRangeEl.addEventListener("input", () => updateSetting("cardGap", Number(cardGapRangeEl.value)));
  cardHeightRangeEl.addEventListener("input", () => updateSetting("cardHeight", Number(cardHeightRangeEl.value)));
  panelOpacityRangeEl.addEventListener("input", () => updateSetting("panelOpacity", Number(panelOpacityRangeEl.value)));

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.dataset.closeDialog));
  });

  collectionGridEl.addEventListener("dragover", handleCollectionDragOver);
  collectionGridEl.addEventListener("drop", handleCollectionDrop);
  collectionGridEl.addEventListener("click", handleCollectionClick);
  collectionGridEl.addEventListener("dragstart", handleCollectionCardDragStart);
  collectionGridEl.addEventListener("dragover", handleCollectionCardDragOver);
  collectionGridEl.addEventListener("dragleave", handleCollectionCardDragLeave);
  collectionGridEl.addEventListener("drop", handleCollectionCardDrop);
  collectionGridEl.addEventListener("dragend", handleCollectionCardDragEnd);
  bindPanelDragging();
}

function bindBrowserCompatibilityNotice() {
  browserCompatibilityAcknowledgeEl?.addEventListener("click", acknowledgeBrowserCompatibilityNotice);
  browserCompatibilityDialogEl?.addEventListener("cancel", (event) => {
    event.preventDefault();
  });
}

function openDebugToolsDialog() {
  ensureDebugToolsInitialized();
  renderDebugToolsDialog();
  if (settingsDialogEl?.open) {
    closeDialog("settings-dialog");
  }
  openDialog("debug-dialog");
}

function ensureDebugToolsInitialized() {
  if (didInitializeDebugTools) return;
  didInitializeDebugTools = true;
  initializeCustomSelects(debugDialogEl);
  bindDebugToolEvents();
}

function bindDebugToolEvents() {
  bindOptionalClick(debugRefreshStatusButtonEl, renderDebugToolsDialog);
  bindOptionalClick(debugCopyDiagnosticsButtonEl, copyDebugDiagnostics);
  bindOptionalClick(debugRerunBrowserCheckButtonEl, rerunBrowserCompatibilityCheck);
  bindOptionalClick(debugShowCompatibilityNoticeButtonEl, showBrowserCompatibilityNoticeFromDebug);
  bindOptionalClick(debugOpenUnsupportedPreviewButtonEl, openUnsupportedPreviewFromDebug);
  bindOptionalClick(debugRefreshStorageButtonEl, renderDebugToolsDialog);
  bindOptionalClick(debugClearCompatAcksButtonEl, clearCompatibilityAcknowledgementsFromDebug);
  bindOptionalClick(debugClearWallpaperCacheButtonEl, clearWallpaperCacheFromDebug);
  bindOptionalClick(debugResetSettingsKeepBookmarksButtonEl, resetSettingsKeepBookmarksFromDebug);
  bindOptionalClick(debugResetBookmarksKeepSettingsButtonEl, resetBookmarksKeepSettingsFromDebug);
  bindOptionalClick(debugExportBackupButtonEl, exportDebugBackup);
  bindOptionalClick(debugImportBackupTriggerEl, () => debugBackupImportEl?.click());
  bindOptionalEvent(debugBackupImportEl, "change", importDebugBackupFile);
  bindOptionalClick(debugForceFirstRunButtonEl, forceFirstRunFlowFromDebug);
  bindOptionalClick(debugShowSimulatedNoticeButtonEl, showSimulatedCompatibilityNoticeFromDebug);
  bindOptionalClick(debugPreviewSimulatedUnsupportedButtonEl, previewSimulatedUnsupportedFromDebug);
  bindOptionalClick(debugPreviewLanguageButtonEl, previewDebugLanguage);
  bindOptionalEvent(debugLocalStorageListEl, "click", handleDebugLocalStorageClick);
  bindOptionalClick(clearLocalStorageButtonEl, clearDebugLocalStorage);
}

function renderDebugToolsDialog() {
  const report = getDebugBrowserCompatibilityReport();
  renderDebugStatusList(report);
  renderDebugIssuesList(report);
  renderDebugFeatureList();
  renderDebugLocalStorageList();
  renderDebugPreflightCache();
  syncDebugSelects();
  void renderDebugStorageUsageList();
}

function getDebugBrowserCompatibilityReport() {
  const report = getBrowserCompatibilityReport();
  if (report.issues.length) {
    return {
      ...report,
      actualIssueCount: report.issues.length
    };
  }

  return {
    ...report,
    shouldShow: true,
    issues: [{ key: "dialogs.browser_compat_no_issue_found", critical: false }],
    actualIssueCount: 0
  };
}

function renderDebugStatusList(report) {
  if (!debugStatusListEl) return;

  const preflight = window.__lunarBrowserPreflight || {};
  const chromeMajor = getReportChromeMajor(report) || getChromiumMajorVersion() || preflight.chromeMajor || 0;
  const issueCount = Number.isFinite(report.actualIssueCount) ? report.actualIssueCount : report.issues.length;
  const rows = [
    [t("dialogs.debug_status_browser"), report.name],
    [t("dialogs.debug_status_chromium"), chromeMajor ? String(chromeMajor) : t("dialogs.debug_value_not_detected")],
    [t("dialogs.debug_status_chinese"), report.forceChinese ? t("dialogs.debug_value_yes") : t("dialogs.debug_value_no")],
    [t("dialogs.debug_status_severity"), getDebugSeverityLabel(report, issueCount)],
    [t("dialogs.debug_status_preflight_cache"), hasBrowserPreflightCache() ? t("dialogs.debug_value_cached") : t("dialogs.debug_value_uncached")],
    [t("dialogs.debug_status_issue_count"), String(issueCount)]
  ];

  debugStatusListEl.innerHTML = "";
  rows.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    debugStatusListEl.append(term, description);
  });
}

function renderDebugIssuesList(report) {
  if (!debugIssuesListEl) return;

  debugIssuesListEl.innerHTML = "";
  report.issues.forEach((issue) => {
    const item = document.createElement("li");
    item.textContent = getBrowserCompatibilityText(report, issue.key, issue.vars);
    debugIssuesListEl.appendChild(item);
  });
}

function renderDebugFeatureList() {
  if (!debugFeatureListEl) return;

  debugFeatureListEl.innerHTML = "";
  getDebugFeatureChecks().forEach((feature) => {
    const item = document.createElement("li");
    item.className = `debug-feature-item${feature.ok ? "" : " is-failed"}`;

    const badge = document.createElement("span");
    badge.className = "debug-feature-badge";
    badge.textContent = feature.ok ? t("dialogs.debug_value_ok") : t("dialogs.debug_value_failed");

    const content = document.createElement("div");
    const name = document.createElement("div");
    name.className = "debug-storage-key";
    name.textContent = feature.label;
    const detail = document.createElement("div");
    detail.className = "debug-feature-detail";
    detail.textContent = feature.detail;
    content.append(name, detail);

    item.append(badge, content);
    debugFeatureListEl.appendChild(item);
  });
}

function getDebugFeatureChecks() {
  return [
    {
      label: "HTMLDialogElement.showModal",
      ok: typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal === "function",
      detail: t("dialogs.debug_feature_dialog")
    },
    {
      label: "IndexedDB",
      ok: typeof indexedDB !== "undefined",
      detail: t("dialogs.debug_feature_indexeddb")
    },
    {
      label: "crypto.randomUUID",
      ok: Boolean(window.crypto?.randomUUID),
      detail: t("dialogs.debug_feature_random_uuid")
    },
    {
      label: "structuredClone",
      ok: typeof structuredClone === "function",
      detail: t("dialogs.debug_feature_structured_clone")
    },
    {
      label: "SpeechRecognition",
      ok: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      detail: t("dialogs.debug_feature_voice")
    },
    {
      label: "DataTransfer",
      ok: typeof DataTransfer !== "undefined",
      detail: t("dialogs.debug_feature_data_transfer")
    },
    {
      label: "CSS color-mix",
      ok: supportsCssDeclaration("background", "color-mix(in srgb, #000 50%, #fff)"),
      detail: t("dialogs.debug_feature_color_mix")
    },
    {
      label: "backdrop-filter",
      ok: supportsCssDeclaration("backdrop-filter", "blur(1px)") || supportsCssDeclaration("-webkit-backdrop-filter", "blur(1px)"),
      detail: t("dialogs.debug_feature_backdrop_filter")
    },
    {
      label: "localStorage write",
      ok: canWriteLocalStorage(),
      detail: t("dialogs.debug_feature_local_storage")
    },
    {
      label: "Extension storage",
      ok: canUseExtensionStorage(),
      detail: t("dialogs.debug_feature_extension_storage")
    },
    {
      label: "Clipboard",
      ok: Boolean(navigator.clipboard?.writeText) || typeof document.execCommand === "function",
      detail: t("dialogs.debug_feature_clipboard")
    }
  ];
}

function canWriteLocalStorage() {
  try {
    const key = "__lunar_debug_storage_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

async function renderDebugStorageUsageList() {
  if (!debugStorageUsageListEl) return;
  renderDefinitionRows(debugStorageUsageListEl, [[t("dialogs.debug_storage_loading"), "..."]]);

  try {
    const usage = await getDebugStorageUsage();
    renderDefinitionRows(debugStorageUsageListEl, [
      [t("dialogs.debug_storage_local_storage"), formatBytes(usage.localStorageBytes)],
      [t("dialogs.debug_storage_extension_storage"), usage.extensionStorageBytes >= 0 ? formatBytes(usage.extensionStorageBytes) : t("dialogs.debug_value_not_available")],
      [t("dialogs.debug_storage_wallpaper"), formatBytes(usage.wallpaperBytes)],
      [t("dialogs.debug_storage_quota"), usage.quotaBytes ? `${formatBytes(usage.usageBytes)} / ${formatBytes(usage.quotaBytes)}` : t("dialogs.debug_value_not_available")]
    ]);
  } catch (error) {
    console.warn("Debug storage usage failed", error);
    renderDefinitionRows(debugStorageUsageListEl, [[t("dialogs.debug_storage_error"), t("dialogs.debug_value_not_available")]]);
  }
}

async function getDebugStorageUsage() {
  const localStorageBytes = getLocalStorageBytes();
  const extensionStorageBytes = await getExtensionStorageBytesInUseSafe();
  const wallpaperBytes = await getStoredWallpaperBytes();
  const storageEstimate = navigator.storage?.estimate ? await navigator.storage.estimate() : {};

  return {
    localStorageBytes,
    extensionStorageBytes,
    wallpaperBytes,
    usageBytes: Number(storageEstimate.usage) || 0,
    quotaBytes: Number(storageEstimate.quota) || 0
  };
}

function renderDebugLocalStorageList() {
  if (!debugLocalStorageListEl) return;
  const entries = getLocalStorageEntries();
  debugLocalStorageListEl.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "debug-storage-item";
    empty.textContent = t("dialogs.debug_local_storage_empty");
    debugLocalStorageListEl.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "debug-storage-item";

    const main = document.createElement("div");
    main.className = "debug-storage-item-main";
    const key = document.createElement("div");
    key.className = "debug-storage-key";
    key.textContent = entry.key;
    const meta = document.createElement("div");
    meta.className = "debug-storage-meta";
    meta.textContent = `${entry.type} · ${formatBytes(entry.bytes)}`;
    main.append(key, meta);

    const button = document.createElement("button");
    button.className = "mini-button danger";
    button.type = "button";
    button.dataset.debugStorageKey = entry.key;
    button.textContent = t("actions.delete");

    item.append(main, button);
    debugLocalStorageListEl.appendChild(item);
  });
}

function renderDebugPreflightCache() {
  if (!debugPreflightCacheEl) return;
  const details = {
    runtime: window.__lunarBrowserPreflight || null,
    cache: getParsedPreflightCache()
  };
  debugPreflightCacheEl.textContent = JSON.stringify(details, null, 2);
}

function renderDefinitionRows(list, rows) {
  list.innerHTML = "";
  rows.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    list.append(term, description);
  });
}

function syncDebugSelects() {
  if (debugLanguagePreviewEl) {
    debugLanguagePreviewEl.value = currentLanguage || "current";
    syncCustomSelect(debugLanguagePreviewEl);
  }
  if (debugSimulationSelectEl) {
    syncCustomSelect(debugSimulationSelectEl);
  }
}

function handleDebugLocalStorageClick(event) {
  const button = event.target.closest("[data-debug-storage-key]");
  if (!button) return;

  const key = button.dataset.debugStorageKey || "";
  if (!key) return;
  const confirmed = window.confirm(t("alerts.delete_local_storage_key_confirm", { key }));
  if (!confirmed) return;

  try {
    localStorage.removeItem(key);
    renderDebugToolsDialog();
    showInlineNotice(t("alerts.local_storage_key_deleted"), "info");
  } catch (error) {
    console.warn("Local storage key delete failed", error);
    showInlineNotice(t("alerts.local_storage_key_delete_failed"), "error");
  }
}

async function copyDebugDiagnostics() {
  try {
    const diagnostics = await createDebugDiagnostics();
    await copyTextToClipboard(JSON.stringify(diagnostics, null, 2));
    showInlineNotice(t("alerts.diagnostics_copied"), "info");
  } catch (error) {
    console.warn("Copy diagnostics failed", error);
    showInlineNotice(t("alerts.diagnostics_copy_failed"), "error");
  }
}

async function createDebugDiagnostics() {
  const report = getDebugBrowserCompatibilityReport();
  return {
    exportedAt: new Date().toISOString(),
    app: {
      dataVersion: DATA_VERSION,
      extensionVersion: getExtensionVersion(),
      page: window.location.href
    },
    browser: {
      userAgent: navigator.userAgent || "",
      language: navigator.language || "",
      languages: Array.isArray(navigator.languages) ? navigator.languages : [],
      brands: getUserAgentBrandsText(),
      chromiumMajor: getChromiumMajorVersion() || null
    },
    compatibility: {
      id: report.id,
      name: report.name,
      forceChinese: report.forceChinese,
      isSevere: report.isSevere,
      shouldShow: report.shouldShow,
      issues: report.issues.map((issue) => ({
        key: issue.key,
        critical: Boolean(issue.critical),
        vars: issue.vars || {},
        text: getBrowserCompatibilityText(report, issue.key, issue.vars)
      })),
      preflight: window.__lunarBrowserPreflight || null,
      preflightCache: getParsedPreflightCache()
    },
    features: getDebugFeatureChecks().map(({ label, ok, detail }) => ({ label, ok, detail })),
    stateSummary: {
      layout: state.layout,
      searchEngine: state.searchEngine,
      language: state.language,
      linkCount: state.links.length,
      backgroundType: state.background.type,
      backgroundValue: state.background.value === CHROME_BACKGROUND_VALUE ? CHROME_BACKGROUND_VALUE : state.background.value,
      settings: state.settings
    },
    storage: {
      usage: await getDebugStorageUsage(),
      localStorageKeys: getLocalStorageEntries().map(({ key, type, bytes }) => ({ key, type, bytes }))
    }
  };
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand("copy");
  textarea.remove();
  if (!didCopy) {
    throw new Error("Fallback copy failed");
  }
}

function clearCompatibilityAcknowledgementsFromDebug() {
  try {
    clearBrowserCompatibilityAcknowledgements();
    renderDebugToolsDialog();
    showInlineNotice(t("alerts.compatibility_acks_cleared"), "info");
  } catch (error) {
    console.warn("Compatibility acknowledgement clear failed", error);
    showInlineNotice(t("alerts.compatibility_acks_clear_failed"), "error");
  }
}

function clearBrowserCompatibilityAcknowledgements() {
  localStorage.removeItem(FIREFOX_COMPAT_NOTICE_ACK_KEY);
  removeLocalStorageKeysByPrefix(BROWSER_COMPAT_NOTICE_ACK_PREFIX);
}

async function clearWallpaperCacheFromDebug() {
  const confirmed = window.confirm(t("alerts.clear_wallpaper_cache_confirm"));
  if (!confirmed) return;

  try {
    await clearStoredBackgroundImage();
    state.background = structuredClone(DEFAULT_STATE.background);
    persistAndRender(true);
    renderDebugToolsDialog();
    showInlineNotice(t("alerts.wallpaper_cache_cleared"), "info");
  } catch (error) {
    console.warn("Wallpaper cache clear failed", error);
    showInlineNotice(t("alerts.wallpaper_cache_clear_failed"), "error");
  }
}

async function resetSettingsKeepBookmarksFromDebug() {
  const confirmed = window.confirm(t("alerts.reset_settings_keep_bookmarks_confirm"));
  if (!confirmed) return;

  try {
    const links = structuredClone(state.links);
    await clearStoredBackgroundImage();
    state = sanitizeState({
      ...structuredClone(DEFAULT_STATE),
      links
    });
    bookmarkFilter = "";
    persistAndRender(true);
    renderDebugToolsDialog();
    showInlineNotice(t("alerts.settings_reset_keep_bookmarks_done"), "info");
  } catch (error) {
    console.warn("Settings reset failed", error);
    showInlineNotice(t("alerts.debug_action_failed"), "error");
  }
}

function resetBookmarksKeepSettingsFromDebug() {
  const confirmed = window.confirm(t("alerts.reset_bookmarks_keep_settings_confirm"));
  if (!confirmed) return;

  try {
    state.links = reorderPinnedLinks(structuredClone(DEFAULT_STATE.links));
    bookmarkFilter = "";
    persistAndRender(true);
    renderDebugToolsDialog();
    showInlineNotice(t("alerts.bookmarks_reset_keep_settings_done"), "info");
  } catch (error) {
    console.warn("Bookmarks reset failed", error);
    showInlineNotice(t("alerts.debug_action_failed"), "error");
  }
}

async function exportDebugBackup() {
  try {
    const payload = {
      type: "lunar-start-debug-backup",
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      state: await createExportableState(),
      localStorage: getLocalStorageSnapshot(),
      diagnostics: await createDebugDiagnostics()
    };
    downloadJson(payload, "lunar-start-debug-backup.json");
    showInlineNotice(t("alerts.debug_backup_exported"), "info");
  } catch (error) {
    console.warn("Debug backup export failed", error);
    showInlineNotice(t("alerts.debug_backup_export_failed"), "error");
  }
}

function importDebugBackupFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      await importDebugBackup(parsed);
    } catch (error) {
      console.warn("Debug backup import failed", error);
      showInlineNotice(t("alerts.debug_backup_import_failed"), "error");
    } finally {
      debugBackupImportEl.value = "";
    }
  };
  reader.readAsText(file);
}

async function importDebugBackup(parsed) {
  const confirmed = window.confirm(t("alerts.debug_backup_import_confirm"));
  if (!confirmed) return;

  if (parsed?.localStorage && typeof parsed.localStorage === "object") {
    localStorage.clear();
    Object.entries(parsed.localStorage).forEach(([key, value]) => {
      localStorage.setItem(key, String(value));
    });
  }

  if (parsed?.state) {
    const importedState = sanitizeState(parsed.state);
    await normalizeBackgroundStorage(importedState);
    if (importedState.background.type !== "image") {
      await clearStoredBackgroundImage();
    }
    state = importedState;
    saveState(true);
  } else if (parsed?.localStorage) {
    state = loadState();
  }

  bookmarkFilter = "";
  renderAll();
  renderDebugToolsDialog();
  showInlineNotice(t("alerts.debug_backup_imported"), "info");
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function forceFirstRunFlowFromDebug() {
  const confirmed = window.confirm(t("alerts.force_first_run_flow_confirm"));
  if (!confirmed) return;

  try {
    clearBrowserCompatibilityDebugFlags();
    window.location.reload();
  } catch (error) {
    console.warn("First-run flow reset failed", error);
    showInlineNotice(t("alerts.rerun_browser_check_failed"), "error");
  }
}

function showSimulatedCompatibilityNoticeFromDebug() {
  if (!browserCompatibilityDialogEl) return;
  const report = getSelectedDebugSimulationReport();
  renderBrowserCompatibilityNotice(report);
  browserCompatibilityDialogEl.dataset.browserId = report.id;
  browserCompatibilityDialogEl.dataset.noticeSeverity = report.isSevere ? "severe" : "notice";

  if (debugDialogEl?.open) {
    closeDialog("debug-dialog");
  }
  openDialog("browser-compatibility-dialog");
}

function previewSimulatedUnsupportedFromDebug() {
  openUnsupportedPreviewForReport(getSelectedDebugSimulationReport());
}

async function previewDebugLanguage() {
  const language = debugLanguagePreviewEl?.value || "current";
  if (language === "current") return;

  try {
    await loadLanguage(language);
    renderAll();
    renderDebugToolsDialog();
    applyTranslations();
    showInlineNotice(t("alerts.language_preview_applied"), "info");
  } catch (error) {
    console.warn("Language preview failed", error);
    showInlineNotice(t("alerts.language_preview_failed"), "error");
  }
}

function getSelectedDebugSimulationReport() {
  const scenario = debugSimulationSelectEl?.value || "current";
  if (scenario === "current") return getDebugBrowserCompatibilityReport();
  return createSimulatedCompatibilityReport(scenario);
}

function createSimulatedCompatibilityReport(scenario) {
  const map = {
    firefox: {
      id: "firefox",
      name: "Firefox",
      forceChinese: false,
      isSevere: false,
      issues: [
        { key: "dialogs.browser_compat_voice", critical: false },
        { key: "dialogs.browser_compat_backdrop_filter", critical: false }
      ]
    },
    chinese: {
      id: "360",
      name: "360浏览器",
      forceChinese: true,
      isSevere: false,
      issues: [
        { key: "dialogs.browser_compat_chinese_fast_mode", critical: false },
        { key: "dialogs.browser_compat_no_issue_found", critical: false }
      ]
    },
    "old-chromium": {
      id: "chromium-79",
      name: "Chromium 79",
      forceChinese: false,
      isSevere: true,
      issues: [
        { key: "dialogs.browser_compat_old_chromium", vars: { version: 79 }, critical: true },
        { key: "dialogs.browser_compat_random_uuid", critical: true },
        { key: "dialogs.browser_compat_structured_clone", critical: true }
      ]
    },
    "ie-mode": {
      id: "360",
      name: "360浏览器",
      forceChinese: true,
      isSevere: true,
      issues: [
        { key: "dialogs.browser_compat_ie_mode", critical: true },
        { key: "dialogs.browser_compat_chinese_fast_mode", critical: false }
      ]
    },
    "missing-core": {
      id: "unknown",
      name: t("dialogs.browser_compat_unknown_browser"),
      forceChinese: false,
      isSevere: true,
      issues: [
        { key: "dialogs.browser_compat_dialog", critical: true },
        { key: "dialogs.browser_compat_indexeddb", critical: true },
        { key: "dialogs.browser_compat_random_uuid", critical: true },
        { key: "dialogs.browser_compat_structured_clone", critical: true }
      ]
    }
  };
  const base = map[scenario] || map["missing-core"];

  return {
    ...base,
    shouldShow: true,
    actualIssueCount: base.issues.length
  };
}

function getDebugSeverityLabel(report, issueCount) {
  if (report.isSevere) return t("dialogs.debug_value_severe");
  if (issueCount > 0) return t("dialogs.debug_value_notice");
  return t("dialogs.debug_value_ok");
}

function hasBrowserPreflightCache() {
  try {
    return Boolean(localStorage.getItem(BROWSER_PREFLIGHT_CACHE_KEY));
  } catch {
    return false;
  }
}

function getParsedPreflightCache() {
  try {
    const raw = localStorage.getItem(BROWSER_PREFLIGHT_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLocalStorageEntries() {
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) keys.push(key);
    }

    return keys.sort((left, right) => left.localeCompare(right)).map((key) => {
      const value = localStorage.getItem(key) || "";
      return {
        key,
        type: getLocalStorageKeyType(key),
        bytes: getTextBytes(key) + getTextBytes(value)
      };
    });
  } catch {
    return [];
  }
}

function getLocalStorageSnapshot() {
  const snapshot = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      snapshot[key] = localStorage.getItem(key) || "";
    }
  } catch {
    // Snapshot is diagnostic-only; storage blocks should not break export.
  }
  return snapshot;
}

function getLocalStorageBytes() {
  return getLocalStorageEntries().reduce((total, entry) => total + entry.bytes, 0);
}

function getLocalStorageKeyType(key) {
  if (key === STORAGE_KEY) return t("dialogs.debug_storage_type_state");
  if (key === BROWSER_PREFLIGHT_CACHE_KEY) return t("dialogs.debug_storage_type_preflight");
  if (key === FIREFOX_COMPAT_NOTICE_ACK_KEY || key.startsWith(BROWSER_COMPAT_NOTICE_ACK_PREFIX)) {
    return t("dialogs.debug_storage_type_ack");
  }
  if (key.startsWith("language:")) return t("dialogs.debug_storage_type_language");
  if (key === PENDING_LINKS_KEY || key.startsWith(PENDING_LINK_KEY_PREFIX)) {
    return t("dialogs.debug_storage_type_pending_link");
  }
  return t("dialogs.debug_storage_type_other");
}

async function getExtensionStorageBytesInUseSafe() {
  const api = getExtensionApi();
  const storage = api?.storage?.local;
  if (!storage?.getBytesInUse) return -1;

  try {
    if (isPromiseExtensionApi(api)) {
      return await storage.getBytesInUse(null);
    }

    return await new Promise((resolve, reject) => {
      storage.getBytesInUse(null, (bytes) => {
        const error = getExtensionStorageLastError(api);
        if (error) {
          reject(new Error(error.message || "Extension storage size failed"));
          return;
        }
        resolve(Number(bytes) || 0);
      });
    });
  } catch {
    return -1;
  }
}

async function getStoredWallpaperBytes() {
  let total = 0;
  if (canUseIndexedDb()) {
    try {
      const asset = await getBackgroundAssetFromIndexedDb();
      if (typeof asset === "string") {
        total += getTextBytes(asset);
      } else if (asset?.kind === "blob" && asset.blob instanceof Blob) {
        total += asset.blob.size;
      }
    } catch {
      // IndexedDB may be blocked or empty.
    }
  }

  try {
    const stored = await extensionStorageGet(BACKGROUND_IMAGE_KEY);
    if (typeof stored[BACKGROUND_IMAGE_KEY] === "string") {
      total += getTextBytes(stored[BACKGROUND_IMAGE_KEY]);
    }
  } catch {
    // Extension storage may not exist outside an installed extension.
  }

  if (state.background.type === "image" && state.background.value && state.background.value !== CHROME_BACKGROUND_VALUE) {
    total += getTextBytes(state.background.value);
  }

  return total;
}

function getTextBytes(value) {
  return new Blob([String(value || "")]).size;
}

function formatBytes(bytes) {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function getExtensionVersion() {
  try {
    return getExtensionApi()?.runtime?.getManifest?.().version || "";
  } catch {
    return "";
  }
}

function rerunBrowserCompatibilityCheck() {
  const confirmed = window.confirm(t("alerts.rerun_browser_check_confirm"));
  if (!confirmed) return;

  try {
    clearBrowserCompatibilityDebugFlags();
    window.location.reload();
  } catch (error) {
    console.warn("Browser compatibility re-check failed", error);
    showInlineNotice(t("alerts.rerun_browser_check_failed"), "error");
  }
}

function clearBrowserCompatibilityDebugFlags() {
  localStorage.removeItem(BROWSER_PREFLIGHT_CACHE_KEY);
  localStorage.removeItem(FIREFOX_COMPAT_NOTICE_ACK_KEY);
  removeLocalStorageKeysByPrefix(BROWSER_COMPAT_NOTICE_ACK_PREFIX);
}

function removeLocalStorageKeysByPrefix(prefix) {
  const keys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

function showBrowserCompatibilityNoticeFromDebug() {
  if (!browserCompatibilityDialogEl) return;

  const report = getDebugBrowserCompatibilityReport();
  renderBrowserCompatibilityNotice(report);
  browserCompatibilityDialogEl.dataset.browserId = report.id;
  browserCompatibilityDialogEl.dataset.noticeSeverity = report.isSevere ? "severe" : "notice";

  if (debugDialogEl?.open) {
    closeDialog("debug-dialog");
  }
  openDialog("browser-compatibility-dialog");
}

function openUnsupportedPreviewFromDebug() {
  openUnsupportedPreviewForReport(getDebugBrowserCompatibilityReport());
}

function openUnsupportedPreviewForReport(report) {
  const preflight = window.__lunarBrowserPreflight || {};
  const chromeMajor = getReportChromeMajor(report) || getChromiumMajorVersion() || preflight.chromeMajor || "";
  const reasons = getUnsupportedPreviewReasons(report, preflight);
  const url = new URL("unsupported.html", window.location.href);

  url.searchParams.set("browser", report.id || preflight.browserId || "unknown");
  url.searchParams.set("chrome", String(chromeMajor || ""));
  url.searchParams.set("chinese", report.forceChinese || preflight.knownChineseBrowser ? "1" : "0");
  url.searchParams.set("reasons", reasons.join(","));

  const opened = window.open(url.toString(), "_blank", "noopener");
  if (!opened) {
    showInlineNotice(t("alerts.unsupported_preview_blocked"), "warning");
  }
}

function getReportChromeMajor(report) {
  const oldChromiumIssue = report.issues?.find((issue) => issue.key === "dialogs.browser_compat_old_chromium");
  const issueVersion = Number(oldChromiumIssue?.vars?.version);
  if (Number.isFinite(issueVersion) && issueVersion > 0) return issueVersion;

  const idMatch = String(report.id || "").match(/chromium-(\d+)/i);
  return idMatch ? Number(idMatch[1]) : 0;
}

function getUnsupportedPreviewReasons(report, preflight) {
  const reasons = new Set(Array.isArray(preflight.severeReasons) ? preflight.severeReasons : []);
  const issueReasonMap = {
    "dialogs.browser_compat_ie_mode": "ie-mode",
    "dialogs.browser_compat_old_chromium": "old-chromium",
    "dialogs.browser_compat_random_uuid": "random-uuid",
    "dialogs.browser_compat_structured_clone": "structured-clone",
    "dialogs.browser_compat_dialog": "dialog",
    "dialogs.browser_compat_indexeddb": "indexeddb"
  };

  report.issues.forEach((issue) => {
    const reason = issueReasonMap[issue.key];
    if (reason) reasons.add(reason);
  });

  const chromeMajor = getChromiumMajorVersion() || preflight.chromeMajor || 0;
  if (chromeMajor > 0 && chromeMajor < 80) {
    reasons.add("modern-js");
  }

  return [...reasons];
}

function showBrowserCompatibilityNoticeIfNeeded() {
  if (!browserCompatibilityDialogEl) return;
  const report = getBrowserCompatibilityReport();
  if (!report.shouldShow) return;
  if (hasAcknowledgedBrowserCompatibilityNotice(report)) return;
  if (browserCompatibilityDialogEl.open) return;

  renderBrowserCompatibilityNotice(report);
  browserCompatibilityDialogEl.dataset.browserId = report.id;
  browserCompatibilityDialogEl.dataset.noticeSeverity = report.isSevere ? "severe" : "notice";
  openDialog("browser-compatibility-dialog");
}

function acknowledgeBrowserCompatibilityNotice() {
  const browserId = browserCompatibilityDialogEl?.dataset.browserId || "unknown";
  const severity = browserCompatibilityDialogEl?.dataset.noticeSeverity || "notice";
  try {
    localStorage.setItem(getBrowserCompatibilityAckKey(browserId, severity), "true");
    if (browserId === "firefox" && severity === "notice") {
      localStorage.setItem(FIREFOX_COMPAT_NOTICE_ACK_KEY, "true");
    }
  } catch {
    // The acknowledgement is a convenience flag; failing to save should not block closing.
  }

  closeDialog("browser-compatibility-dialog");
}

function hasAcknowledgedBrowserCompatibilityNotice(report) {
  const severity = report.isSevere ? "severe" : "notice";
  try {
    if (localStorage.getItem(getBrowserCompatibilityAckKey(report.id, severity)) === "true") {
      return true;
    }

    if (severity === "severe") {
      return false;
    }

    return (
      localStorage.getItem(getLegacyBrowserCompatibilityAckKey(report.id)) === "true"
      || (report.id === "firefox" && localStorage.getItem(FIREFOX_COMPAT_NOTICE_ACK_KEY) === "true")
    );
  } catch {
    return false;
  }
}

function getBrowserCompatibilityAckKey(browserId, severity = "notice") {
  return `${BROWSER_COMPAT_NOTICE_ACK_PREFIX}${browserId || "unknown"}:${severity}`;
}

function getLegacyBrowserCompatibilityAckKey(browserId) {
  return `${BROWSER_COMPAT_NOTICE_ACK_PREFIX}${browserId || "unknown"}`;
}

function renderBrowserCompatibilityNotice(report) {
  browserCompatibilityDialogEl?.classList.toggle("is-severe", report.isSevere);

  if (browserCompatibilityTitleEl) {
    browserCompatibilityTitleEl.textContent = getBrowserCompatibilityText(
      report,
      report.isSevere ? "dialogs.browser_compat_severe_title" : "dialogs.browser_compat_named_title",
      { browser: report.name }
    );
  }
  if (browserCompatibilityDescEl) {
    browserCompatibilityDescEl.textContent = getBrowserCompatibilityText(
      report,
      report.isSevere ? "dialogs.browser_compat_severe_desc" : "dialogs.browser_compat_named_desc",
      { browser: report.name }
    );
  }
  if (browserCompatibilityFeatureHeadingEl) {
    browserCompatibilityFeatureHeadingEl.textContent = getBrowserCompatibilityText(
      report,
      report.isSevere ? "dialogs.browser_compat_unavailable_heading" : "dialogs.browser_compat_notes_heading"
    );
  }
  if (!browserCompatibilityListEl) return;

  browserCompatibilityListEl.innerHTML = "";
  report.issues.forEach((issue) => {
    const item = document.createElement("li");
    item.textContent = getBrowserCompatibilityText(report, issue.key, issue.vars);
    browserCompatibilityListEl.appendChild(item);
  });

}

function getBrowserCompatibilityReport() {
  const identity = detectBrowserIdentity();
  const issues = getBrowserCompatibilityIssues(identity);
  const criticalIssues = issues.filter((issue) => issue.critical);
  const isSevere = Boolean(criticalIssues.length);
  const forceChinese = Boolean(identity.isChineseBrowser);

  return {
    id: identity.id,
    name: identity.name,
    forceChinese,
    isSevere,
    shouldShow: identity.shouldWarn || isSevere,
    issues: isSevere ? criticalIssues : issues
  };
}

function getBrowserCompatibilityIssues(identity) {
  const issues = [];
  const chromeMajor = getChromiumMajorVersion();
  const preflight = window.__lunarBrowserPreflight || {};

  if (identity.isChineseBrowser) {
    issues.push({
      key: "dialogs.browser_compat_chinese_fast_mode",
      critical: false
    });
  }

  if (preflight.isIeMode || /MSIE|Trident/i.test(navigator.userAgent || "")) {
    issues.push({
      key: "dialogs.browser_compat_ie_mode",
      critical: true
    });
  }

  if (chromeMajor && chromeMajor < 98) {
    issues.push({
      key: "dialogs.browser_compat_old_chromium",
      vars: { version: chromeMajor },
      critical: true
    });
  }

  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    issues.push({
      key: "dialogs.browser_compat_voice",
      critical: false
    });
  }

  if (!window.crypto?.randomUUID) {
    issues.push({
      key: "dialogs.browser_compat_random_uuid",
      critical: true
    });
  }

  if (typeof structuredClone !== "function") {
    issues.push({
      key: "dialogs.browser_compat_structured_clone",
      critical: true
    });
  }

  if (typeof HTMLDialogElement === "undefined" || typeof HTMLDialogElement.prototype.showModal !== "function") {
    issues.push({
      key: "dialogs.browser_compat_dialog",
      critical: true
    });
  }

  if (typeof DataTransfer === "undefined") {
    issues.push({
      key: "dialogs.browser_compat_data_transfer",
      critical: false
    });
  }

  if (typeof indexedDB === "undefined") {
    issues.push({
      key: "dialogs.browser_compat_indexeddb",
      critical: true
    });
  }

  if (!supportsCssDeclaration("background", "color-mix(in srgb, #000 50%, #fff)")) {
    issues.push({
      key: "dialogs.browser_compat_color_mix",
      critical: false
    });
  }

  if (
    !supportsCssDeclaration("backdrop-filter", "blur(1px)")
    && !supportsCssDeclaration("-webkit-backdrop-filter", "blur(1px)")
  ) {
    issues.push({
      key: "dialogs.browser_compat_backdrop_filter",
      critical: false
    });
  }

  if (!issues.length && identity.isChineseBrowser) {
    issues.push({
      key: "dialogs.browser_compat_no_issue_found",
      critical: false
    });
  }

  return dedupeCompatibilityIssues(issues);
}

function dedupeCompatibilityIssues(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.key}:${JSON.stringify(issue.vars || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBrowserCompatibilityText(report, key, vars = {}) {
  if (report.forceChinese && CHINESE_BROWSER_COMPAT_MESSAGES[key]) {
    return interpolateCompatibilityText(CHINESE_BROWSER_COMPAT_MESSAGES[key], vars);
  }
  return t(key, vars);
}

function interpolateCompatibilityText(template, vars = {}) {
  return Object.entries(vars).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    template
  );
}

function supportsCssDeclaration(property, value) {
  return Boolean(window.CSS?.supports?.(property, value));
}

function detectBrowserIdentity() {
  const ua = navigator.userAgent || "";
  const brands = getUserAgentBrandsText();
  const source = `${ua} ${brands}`;
  const matchers = [
    { id: "firefox", name: "Firefox", pattern: /\b(Firefox|FxiOS)\b/i },
    { id: "360", name: "360浏览器", pattern: /\b(360SE|360EE|QihooBrowser|QHBrowser|360Browser)\b|Qihoo|QIHU/i, isChineseBrowser: true },
    { id: "2345", name: "2345浏览器", pattern: /\b(2345Explorer|2345Chrome)\b/i, isChineseBrowser: true },
    { id: "sogou", name: "搜狗浏览器", pattern: /\b(MetaSr|SogouMobileBrowser|Sogou|SogouExplorer|SOGO|SOGOU)\b|SE 2\.X/i, isChineseBrowser: true },
    { id: "qq", name: "QQ浏览器", pattern: /\b(QQBrowser|MQQBrowser|TencentTraveler)\b/i, isChineseBrowser: true },
    { id: "liebao", name: "猎豹浏览器", pattern: /\b(LBBROWSER|LieBaoFast|LieBao)\b/i, isChineseBrowser: true },
    { id: "maxthon", name: "傲游浏览器", pattern: /\b(Maxthon|MxBrowser|MxNitro)\b/i, isChineseBrowser: true },
    { id: "baidu", name: "百度浏览器", pattern: /\b(BIDUBrowser|BaiduBrowser|BaiduHD)\b/i, isChineseBrowser: true },
    { id: "uc", name: "UC浏览器", pattern: /\b(UBrowser|UCBrowser)\b/i, isChineseBrowser: true },
    { id: "theworld", name: "世界之窗浏览器", pattern: /\bTheWorld\b/i, isChineseBrowser: true }
  ];

  const matched = matchers.find((item) => item.pattern.test(source));
  if (matched) {
    return {
      id: matched.id,
      name: matched.name,
      isChineseBrowser: Boolean(matched.isChineseBrowser),
      shouldWarn: true
    };
  }

  const preflight = window.__lunarBrowserPreflight || {};
  if (preflight.knownChineseBrowser) {
    return {
      id: "chinese-browser",
      name: t("dialogs.browser_compat_chinese_browser"),
      isChineseBrowser: true,
      shouldWarn: true
    };
  }

  const chromeMajor = getChromiumMajorVersion();
  if (chromeMajor) {
    return {
      id: `chromium-${chromeMajor}`,
      name: `Chromium ${chromeMajor}`,
      isChineseBrowser: false,
      shouldWarn: false
    };
  }

  return {
    id: "unknown",
    name: t("dialogs.browser_compat_unknown_browser"),
    isChineseBrowser: false,
    shouldWarn: false
  };
}

function getUserAgentBrandsText() {
  const brands = navigator.userAgentData?.brands || navigator.userAgentData?.uaList || [];
  if (!Array.isArray(brands)) return "";
  return brands.map((brand) => brand.brand || "").join(" ");
}

function getChromiumMajorVersion() {
  const ua = navigator.userAgent || "";
  const match = ua.match(/(?:Chrome|Chromium|CriOS)\/(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function handleMultiSuggestionsToggleClick() {
  state.settings = sanitizeSettings({
    ...state.settings,
    searchSuggestionsEnabled: true,
    searchSuggestionsAllEnginesEnabled: !state.settings.searchSuggestionsAllEnginesEnabled
  });
  persistAndRender();
  if (searchInputEl.value.trim()) {
    handleSearchInput();
  }
}
