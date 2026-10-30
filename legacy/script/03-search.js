// Search handler for the combined query bar.
let imageSearchDragDepth = 0;
let imageSearchOpenedByDrag = false;
let didBindImageSearchDialogEvents = false;
let didBindImageSearchDocumentDropEvents = false;
const searchSuggestionProviderCooldowns = new Map();
const SEARCH_SUGGESTION_PROVIDER_COOLDOWN_MS = 5 * 60 * 1000;
function handleSearch(event) {
  event.preventDefault();
  submitSearchQuery(searchInputEl.value);
}

function submitSearchQuery(query) {
  const normalizedQuery = typeof query === "string" ? query.trim() : "";
  if (!normalizedQuery) return;

  searchInputEl.value = normalizedQuery;
  addSearchHistoryEntry(normalizedQuery);
  hideSearchSuggestions();

  const engine = SEARCH_ENGINES[state.searchEngine] || SEARCH_ENGINES.google;
  window.location.href = engine.url.replace("%s", encodeURIComponent(normalizedQuery));
}

function handleSearchInput() {
  if (!state.settings.searchSuggestionsEnabled) {
    abortSearchSuggestionRequest();
    hideSearchSuggestions();
    return;
  }

  const query = searchInputEl.value.trim();
  if (!query) {
    abortSearchSuggestionRequest();
    hideSearchSuggestions();
    return;
  }

  if (searchSuggestionTimer) {
    window.clearTimeout(searchSuggestionTimer);
  }
  abortSearchSuggestionRequest();

  const requestId = ++searchSuggestionRequestId;
  searchSuggestionTimer = window.setTimeout(() => {
    searchSuggestionTimer = null;
    void updateSearchSuggestions(query, requestId);
  }, SEARCH_SUGGESTION_DEBOUNCE_MS);
}

function handleSearchInputBlur() {
  window.setTimeout(() => {
    abortSearchSuggestionRequest();
    hideSearchSuggestions();
  }, 120);
}

function handleSearchSuggestionKeydown(event) {
  if (event.key === "Escape" && isVoiceSearchListening) {
    voiceSearchAbortRequested = true;
    voiceSearchRecognition?.stop();
    return;
  }

  if (!state.settings.searchSuggestionsEnabled) return;
  if (!searchSuggestionItems.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeSuggestionIndex = Math.min(searchSuggestionItems.length - 1, activeSuggestionIndex + 1);
    renderSearchSuggestions();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeSuggestionIndex = Math.max(0, activeSuggestionIndex - 1);
    renderSearchSuggestions();
    return;
  }

  if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    applySearchSuggestion(searchSuggestionItems[activeSuggestionIndex].value);
    handleSearch(event);
    return;
  }

  if (event.key === "Escape") {
    hideSearchSuggestions();
  }
}

async function updateSearchSuggestions(query, requestId) {
  if (!state.settings.searchSuggestionsEnabled) return;

  const localSuggestions = getSearchSuggestions(query);
  renderSuggestionState(localSuggestions);

  const controller = createSearchSuggestionAbortController();
  let remoteSuggestions = [];
  try {
    remoteSuggestions = await fetchRemoteSearchSuggestions(query, controller?.signal);
  } finally {
    clearSearchSuggestionAbortController(controller);
  }
  if (controller?.signal.aborted) return;
  if (requestId !== searchSuggestionRequestId) return;
  if (!state.settings.searchSuggestionsEnabled) return;
  if (searchInputEl.value.trim().toLowerCase() !== query.trim().toLowerCase()) return;

  const mergedSuggestions = mergeSearchSuggestions(localSuggestions, remoteSuggestions);
  renderSuggestionState(mergedSuggestions);
}

function cancelPendingSearchSuggestions() {
  searchSuggestionRequestId += 1;
  abortSearchSuggestionRequest();
  if (searchSuggestionTimer) {
    window.clearTimeout(searchSuggestionTimer);
    searchSuggestionTimer = null;
  }
  hideSearchSuggestions();
}

function createSearchSuggestionAbortController() {
  abortSearchSuggestionRequest();
  if (typeof AbortController === "undefined") return null;
  searchSuggestionAbortController = new AbortController();
  return searchSuggestionAbortController;
}

function abortSearchSuggestionRequest() {
  if (!searchSuggestionAbortController) return;
  searchSuggestionAbortController.abort();
  searchSuggestionAbortController = null;
}

function clearSearchSuggestionAbortController(controller) {
  if (controller && searchSuggestionAbortController === controller) {
    searchSuggestionAbortController = null;
  }
}

// Keep the main search bar and settings panel in sync.
function handleSearchEngineChange() {
  state.searchEngine = searchEngineEl.value in SEARCH_ENGINES ? searchEngineEl.value : "google";
  saveState();
  renderSearchEngine();
  renderSettingsPanelIfReady();
  if (state.settings.searchSuggestionsEnabled && searchInputEl.value.trim()) {
    handleSearchInput();
  }
}

function handleSettingsSearchEngineChange() {
  state.searchEngine = settingsSearchEngineEl.value in SEARCH_ENGINES ? settingsSearchEngineEl.value : "google";
  persistAndRender();
}

function handleAllEngineSuggestionsSettingChange() {
  const nextValue = searchSuggestionsAllEnginesSettingEl.value === "all";
  const wasEnabled = Boolean(state.settings.searchSuggestionsAllEnginesEnabled);
  updateSetting("searchSuggestionsAllEnginesEnabled", nextValue);

  if (nextValue && !wasEnabled) {
    showInlineNotice(t("alerts.all_engine_suggestions_warning"), "warning");
  }

  if (state.settings.searchSuggestionsEnabled && searchInputEl.value.trim()) {
    handleSearchInput();
  }
}

function handleSearchSuggestionEngineListChange() {
  const selectedKeys = [...searchSuggestionEngineListEl.querySelectorAll("input[type='checkbox']:checked")]
    .map((input) => input.value);
  updateSetting("searchSuggestionEngineKeys", selectedKeys);

  if (state.settings.searchSuggestionsEnabled && state.settings.searchSuggestionsAllEnginesEnabled && searchInputEl.value.trim()) {
    handleSearchInput();
  }
}

function handleImageSearchClick() {
  openImageSearchDialog();
}

function bindImageSearchDropUi() {
  document.addEventListener("dragenter", handleImageSearchDragEnter);
}

function ensureImageSearchDialogEvents() {
  if (didBindImageSearchDialogEvents) return;
  didBindImageSearchDialogEvents = true;

  imageSearchChooseEl.addEventListener("click", () => {
    imageSearchUploadEl.value = "";
    imageSearchUploadEl.click();
  });
  imageSearchUploadEl.addEventListener("change", handleImageSearchUploadChange);
  imageSearchDropzoneEl.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    imageSearchUploadEl.value = "";
    imageSearchUploadEl.click();
  });
  imageSearchDropzoneEl.addEventListener("keydown", handleImageSearchDropzoneKeydown);
  imageSearchDialogEl.addEventListener("close", resetImageSearchDropUi);
}

function bindImageSearchDocumentDropEvents() {
  if (didBindImageSearchDocumentDropEvents) return;
  didBindImageSearchDocumentDropEvents = true;
  document.addEventListener("dragover", handleImageSearchDragOver);
  document.addEventListener("dragleave", handleImageSearchDragLeave);
  document.addEventListener("drop", handleImageSearchDrop);
}

function unbindImageSearchDocumentDropEvents() {
  if (!didBindImageSearchDocumentDropEvents) return;
  didBindImageSearchDocumentDropEvents = false;
  document.removeEventListener("dragover", handleImageSearchDragOver);
  document.removeEventListener("dragleave", handleImageSearchDragLeave);
  document.removeEventListener("drop", handleImageSearchDrop);
}

function openImageSearchDialog(options = {}) {
  ensureImageSearchDialogEvents();
  bindImageSearchDocumentDropEvents();

  if (state.searchEngine !== "google") {
    showInlineNotice(t("alerts.image_search_google_only"), "warning");
  }

  imageSearchOpenedByDrag = Boolean(options.fromDrag);
  if (!imageSearchDialogEl.open) {
    openDialog("image-search-dialog");
  }
  imageSearchDropzoneEl.classList.toggle("is-drag-over", Boolean(options.fromDrag));
  imageSearchFileNameEl.textContent = t("image_search.no_file");
}

function handleImageSearchUploadChange() {
  const file = imageSearchUploadEl.files?.[0];
  submitGoogleImageSearchFile(file, imageSearchUploadEl);
}

function handleImageSearchDropzoneKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  imageSearchUploadEl.value = "";
  imageSearchUploadEl.click();
}

function handleImageSearchDragEnter(event) {
  if (!eventHasPotentialImageFile(event)) return;
  event.preventDefault();
  imageSearchDragDepth += 1;
  openImageSearchDialog({ fromDrag: true });
}

function handleImageSearchDragOver(event) {
  if (!eventHasPotentialImageFile(event) && !imageSearchDialogEl.open) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
  if (!imageSearchDialogEl.open) {
    openImageSearchDialog({ fromDrag: true });
  }
  imageSearchDropzoneEl.classList.add("is-drag-over");
}

function handleImageSearchDragLeave(event) {
  if (!imageSearchDialogEl.open) return;
  imageSearchDragDepth = Math.max(0, imageSearchDragDepth - 1);
  if (imageSearchDragDepth > 0 && !isDragLeavingWindow(event)) return;
  imageSearchDropzoneEl.classList.remove("is-drag-over");
  if (imageSearchOpenedByDrag && isDragLeavingWindow(event)) {
    closeDialog("image-search-dialog");
  }
}

function handleImageSearchDrop(event) {
  if (!imageSearchDialogEl.open && !eventHasPotentialImageFile(event)) return;

  const file = getImageSearchFileFromTransfer(event.dataTransfer);
  if (!file && !eventHasPotentialImageFile(event)) return;

  event.preventDefault();
  imageSearchDragDepth = 0;
  imageSearchOpenedByDrag = false;
  imageSearchDropzoneEl.classList.remove("is-drag-over");
  submitGoogleImageSearchFile(file);
}

function resetImageSearchDropUi() {
  imageSearchDragDepth = 0;
  imageSearchOpenedByDrag = false;
  imageSearchDropzoneEl.classList.remove("is-drag-over");
  imageSearchFileNameEl.textContent = t("image_search.no_file");
  imageSearchUploadEl.value = "";
  unbindImageSearchDocumentDropEvents();
}

function eventHasPotentialImageFile(event) {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return false;

  const items = [...(dataTransfer.items || [])];
  if (items.length) {
    return items.some((item) => item.kind === "file");
  }

  return [...(dataTransfer.files || [])].some(isImageSearchFile);
}

function getImageSearchFileFromTransfer(dataTransfer) {
  const files = [...(dataTransfer?.files || [])];
  return files.find(isImageSearchFile) || files[0] || null;
}

function isImageSearchFile(file) {
  if (!file) return false;
  if (typeof file.type === "string" && file.type.startsWith("image/")) return true;
  return /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(file.name || "");
}

function isDragLeavingWindow(event) {
  return (
    event.clientX <= 0
    || event.clientY <= 0
    || event.clientX >= window.innerWidth
    || event.clientY >= window.innerHeight
  );
}

function submitGoogleImageSearchFile(file, sourceInput = null) {
  if (!file) {
    return;
  }

  if (!isImageSearchFile(file)) {
    showInlineNotice(t("alerts.image_search_invalid_file"), "warning");
    return;
  }

  const imageInput = createImageSearchFileInput(file, sourceInput);
  if (!imageInput) {
    showInlineNotice(t("alerts.image_search_upload_unavailable"), "error");
    return;
  }

  imageSearchFileNameEl.textContent = t("image_search.uploading", { name: file.name || "image" });

  const form = document.createElement("form");
  form.method = "post";
  form.action = GOOGLE_IMAGE_SEARCH_UPLOAD_URL;
  form.enctype = "multipart/form-data";
  form.target = "_self";
  form.style.display = "none";

  form.appendChild(imageInput);
  form.appendChild(createHiddenFormField("filename", file.name || "image"));
  form.appendChild(createHiddenFormField("hl", getGoogleImageSearchLocale()));

  document.body.appendChild(form);
  form.submit();
}

function createImageSearchFileInput(file, sourceInput) {
  const input = document.createElement("input");
  input.type = "file";
  input.name = "encoded_image";
  input.style.display = "none";

  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    return input;
  } catch (error) {
    console.warn("Image search file transfer failed", error);
  }

  if (sourceInput?.files?.[0] === file) {
    sourceInput.name = "encoded_image";
    return sourceInput;
  }

  return null;
}

function createHiddenFormField(name, value) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  return input;
}

function handleVoiceSearchToggle() {
  triggerVoiceSearchPressFeedback();

  if (isVoiceSearchListening) {
    voiceSearchAbortRequested = true;
    voiceSearchRecognition?.stop();
    return;
  }

  const recognition = ensureVoiceSearchRecognition();
  if (!recognition) {
    showInlineNotice(t("alerts.voice_search_unsupported"), "warning");
    syncVoiceSearchUi();
    return;
  }

  recognition.lang = getVoiceSearchLocale();
  voiceSearchAbortRequested = false;
  searchInputEl.focus();

  try {
    recognition.start();
  } catch (error) {
    console.warn("Voice search start failed", error);
    showInlineNotice(t("alerts.voice_search_failed"), "error");
    syncVoiceSearchUi();
  }
}

function triggerVoiceSearchPressFeedback() {
  if (!voiceSearchButtonEl || voiceSearchButtonEl.disabled) return;

  if (voiceSearchPressTimer) {
    window.clearTimeout(voiceSearchPressTimer);
  }

  voiceSearchButtonEl.classList.add("is-pressed");
  voiceSearchPressTimer = window.setTimeout(() => {
    voiceSearchButtonEl.classList.remove("is-pressed");
    voiceSearchPressTimer = null;
  }, 220);
}

function ensureVoiceSearchRecognition() {
  const RecognitionCtor = getVoiceSearchRecognitionCtor();
  if (!RecognitionCtor) return null;
  if (voiceSearchRecognition) return voiceSearchRecognition;

  const recognition = new RecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    isVoiceSearchListening = true;
    syncVoiceSearchUi();
  });

  recognition.addEventListener("result", handleVoiceSearchResult);

  recognition.addEventListener("end", () => {
    isVoiceSearchListening = false;
    voiceSearchAbortRequested = false;
    syncVoiceSearchUi();
  });

  recognition.addEventListener("error", (event) => {
    isVoiceSearchListening = false;
    syncVoiceSearchUi();

    if (event.error === "aborted" && voiceSearchAbortRequested) {
      voiceSearchAbortRequested = false;
      return;
    }

    voiceSearchAbortRequested = false;

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showInlineNotice(t("alerts.voice_search_denied"), "warning");
      return;
    }

    if (event.error === "no-speech") {
      showInlineNotice(t("alerts.voice_search_no_speech"), "warning");
      return;
    }

    console.warn("Voice search error", event.error);
    showInlineNotice(t("alerts.voice_search_failed"), "error");
  });

  voiceSearchRecognition = recognition;
  return recognition;
}

function handleVoiceSearchResult(event) {
  let latestTranscript = "";
  let finalTranscript = "";

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    const transcript = result[0]?.transcript?.trim() || "";
    if (!transcript) continue;
    latestTranscript = transcript;
    if (result.isFinal) {
      finalTranscript = transcript;
    }
  }

  const nextQuery = finalTranscript || latestTranscript;
  if (!nextQuery) return;

  searchInputEl.value = nextQuery;
  handleSearchInput();

  if (finalTranscript) {
    submitSearchQuery(finalTranscript);
  }
}

function getVoiceSearchRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getVoiceSearchLocale() {
  if (currentLanguage === "zh-CN") return "zh-CN";
  if (currentLanguage === "ko") return "ko-KR";
  if (currentLanguage === "ja") return "ja-JP";
  if (currentLanguage === "th") return "th-TH";
  if (currentLanguage === "ms") return "ms-MY";
  return typeof navigator?.language === "string" && navigator.language.trim()
    ? navigator.language
    : "en-US";
}

function getGoogleImageSearchLocale() {
  if (currentLanguage === "zh-CN") return "zh-CN";
  if (currentLanguage === "ko") return "ko";
  if (currentLanguage === "ja") return "ja";
  if (currentLanguage === "th") return "th";
  if (currentLanguage === "ms") return "ms";
  return "en";
}

function syncVoiceSearchUi() {
  if (!voiceSearchButtonEl) return;

  const supported = Boolean(getVoiceSearchRecognitionCtor());
  const labelKey = !supported
    ? "actions.voice_search_unavailable"
    : isVoiceSearchListening
      ? "actions.voice_search_stop"
      : "actions.voice_search";
  const label = t(labelKey);

  voiceSearchButtonEl.disabled = !supported;
  voiceSearchButtonEl.classList.toggle("is-listening", isVoiceSearchListening);
  voiceSearchButtonEl.setAttribute("aria-pressed", isVoiceSearchListening ? "true" : "false");
  voiceSearchButtonEl.setAttribute("aria-label", label);
  voiceSearchButtonEl.setAttribute("title", label);
}

async function handleLanguageChange() {
  const nextLanguage = normalizeLanguage(languageSelectEl.value);
  if (nextLanguage === currentLanguage) return;

  state.language = nextLanguage;
  saveState();
  await loadLanguage(nextLanguage);
  renderAll();
  if (settingsDialogEl?.open) {
    ensurePresetButtonsRendered(true);
  }
}


function getSearchSuggestions(query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const historyItems = (state.searchHistory || [])
    .filter((item) => matchesSuggestionQuery(item, normalizedQuery))
    .map((item) => ({ value: item, source: t("search.recent_search") }));

  const defaultItems = DEFAULT_SEARCH_SUGGESTIONS
    .filter((item) => matchesSuggestionQuery(item, normalizedQuery))
    .filter((item) => !historyItems.some((historyItem) => historyItem.value.toLowerCase() === item.toLowerCase()))
    .map((item) => ({ value: item, source: t("search.suggested") }));

  return [...historyItems, ...defaultItems].slice(0, 6);
}

function matchesSuggestionQuery(candidate, query) {
  const normalizedCandidate = candidate.toLowerCase();
  if (normalizedCandidate.includes(query)) return true;

  let queryIndex = 0;
  for (const character of normalizedCandidate) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) return true;
    }
  }

  return false;
}

function mergeSearchSuggestions(localSuggestions, remoteSuggestions) {
  const mergedMap = new Map();

  [...localSuggestions, ...remoteSuggestions].forEach((item) => {
    const key = item.value.trim().toLowerCase();
    if (!key) return;

    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, {
        ...item,
        sourceKeys: Array.isArray(item.sourceKeys) ? [...item.sourceKeys] : []
      });
      return;
    }

    const incomingSourceKeys = Array.isArray(item.sourceKeys) ? item.sourceKeys : [];
    const existingSourceKeys = Array.isArray(existing.sourceKeys) ? existing.sourceKeys : [];
    const mergedSourceKeys = [...new Set([...existingSourceKeys, ...incomingSourceKeys])];

    if (mergedSourceKeys.length > existingSourceKeys.length) {
      existing.sourceKeys = mergedSourceKeys;
    }

    if (!existing.source && item.source) {
      existing.source = item.source;
    }
  });

  const merged = [...mergedMap.values()].map((item) => ({
    ...item,
    source: formatSuggestionSource(item.sourceKeys, item.source)
  }));
  return merged.slice(0, 8);
}

function formatSuggestionSource(sourceKeys = [], fallbackSource = "") {
  if (sourceKeys.length) {
    return sourceKeys
      .map((engineKey) => t(`engines.${engineKey}`))
      .join(" / ");
  }
  return fallbackSource || t("search.live_suggestion");
}

function renderSuggestionState(items) {
  searchSuggestionItems = items;
  activeSuggestionIndex = -1;
  renderSearchSuggestions();
}

async function fetchRemoteSearchSuggestions(query, signal) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const providerMap = {
    google: [fetchGoogleSuggestions],
    duckduckgo: [fetchDuckDuckGoSuggestions],
    bing: [fetchBingSuggestions],
    brave: [fetchGoogleSuggestions, fetchDuckDuckGoSuggestions],
    yahoo: [fetchYahooSuggestions],
    yandex: [fetchGoogleSuggestions, fetchDuckDuckGoSuggestions],
    naver: [fetchGoogleSuggestions, fetchDuckDuckGoSuggestions],
    ecosia: [fetchDuckDuckGoSuggestions, fetchGoogleSuggestions],
    startpage: [fetchGoogleSuggestions, fetchDuckDuckGoSuggestions],
    qwant: [fetchDuckDuckGoSuggestions, fetchGoogleSuggestions],
    perplexity: [fetchGoogleSuggestions, fetchDuckDuckGoSuggestions],
    you: [fetchGoogleSuggestions, fetchDuckDuckGoSuggestions],
    bing_cn: [fetchBingSuggestions],
    baidu: [fetchBaiduSuggestions],
    sogou: [fetchSogouSuggestions],
    so360: [fetchSo360Suggestions, fetchBaiduSuggestions],
    shenma: [fetchBaiduSuggestions, fetchSogouSuggestions],
    toutiao: [fetchBaiduSuggestions, fetchSogouSuggestions],
    quark: [fetchBaiduSuggestions, fetchSogouSuggestions]
  };

  if (state.settings.searchSuggestionsAllEnginesEnabled) {
    const engineKeys = getActiveSuggestionEngineKeys();
    const settledResults = await Promise.all(engineKeys.map(async (engineKey) => {
      const suggestions = await fetchSuggestionsForEngine(engineKey, normalizedQuery, providerMap, signal);
      return suggestions.map((value) => ({
        value,
        source: t("search.from_engine", { engine: t(`engines.${engineKey}`) }),
        sourceKeys: [engineKey]
      }));
    }));

    return settledResults.flat();
  }

  const engineKey = state.searchEngine in SEARCH_ENGINES ? state.searchEngine : "google";
  const suggestions = await fetchSuggestionsForEngine(engineKey, normalizedQuery, providerMap, signal);
  return suggestions.map((value) => ({
    value,
    source: t("search.from_engine", { engine: t(`engines.${engineKey}`) }),
    sourceKeys: [engineKey]
  }));
}

function getActiveSuggestionEngineKeys() {
  const selectedEngine = state.searchEngine in SEARCH_ENGINES ? state.searchEngine : "google";
  const selectedKeys = Array.isArray(state.settings.searchSuggestionEngineKeys)
    ? state.settings.searchSuggestionEngineKeys.filter((engineKey) => engineKey in SEARCH_ENGINES)
    : [];

  if (!selectedKeys.length) {
    return [selectedEngine];
  }

  return selectedKeys.includes(selectedEngine)
    ? selectedKeys
    : [selectedEngine, ...selectedKeys];
}

async function fetchSuggestionsForEngine(engineKey, query, providerMap, signal) {
  const providers = providerMap[engineKey] || [fetchGoogleSuggestions, fetchDuckDuckGoSuggestions];
  for (const provider of providers) {
    const providerKey = getSuggestionProviderKey(engineKey, provider);
    if (isSuggestionProviderCoolingDown(providerKey)) {
      continue;
    }

    try {
      const suggestions = await provider(query, signal);
      if (suggestions.length) {
        return suggestions;
      }
    } catch (error) {
      if (isSearchSuggestionAbort(error)) {
        return [];
      }
      markSuggestionProviderCooldown(providerKey);
    }
  }

  return [];
}

function getSuggestionProviderKey(engineKey, provider) {
  return `${engineKey}:${provider?.name || "provider"}`;
}

function isSuggestionProviderCoolingDown(providerKey) {
  const retryAt = searchSuggestionProviderCooldowns.get(providerKey) || 0;
  if (!retryAt) return false;
  if (Date.now() < retryAt) return true;
  searchSuggestionProviderCooldowns.delete(providerKey);
  return false;
}

function markSuggestionProviderCooldown(providerKey) {
  searchSuggestionProviderCooldowns.set(providerKey, Date.now() + SEARCH_SUGGESTION_PROVIDER_COOLDOWN_MS);
}

function isSearchSuggestionAbort(error) {
  return error?.name === "AbortError";
}

async function fetchDuckDuckGoSuggestions(query, signal) {
  const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`DuckDuckGo suggestions failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => typeof item?.phrase === "string" ? item.phrase.trim() : "")
    .filter(Boolean);
}

async function fetchGoogleSuggestions(query, signal) {
  const url = `https://www.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Google suggestions failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return [];
  return payload[1]
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchBingSuggestions(query, signal) {
  const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Bing suggestions failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return [];
  return payload[1]
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchYahooSuggestions(query, signal) {
  const url = `https://search.yahoo.com/sugg/gossip/gossip-us-ura/?output=fxjson&command=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Yahoo suggestions failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.r)) return [];
  return payload.r
    .map((item) => typeof item?.k === "string" ? item.k.trim() : "")
    .filter(Boolean);
}

async function fetchBaiduSuggestions(query, signal) {
  const callbackName = `baiduSug_${crypto.randomUUID().replaceAll("-", "")}`;
  const url = `https://suggestion.baidu.com/su?cb=${callbackName}&wd=${encodeURIComponent(query)}`;
  const text = await fetchTextWithEncoding(url, "gb18030", "Baidu", signal);
  const match = text.match(/,\s*s:\s*(\[[\s\S]*\])\s*\}/);
  if (!match) return [];

  try {
    const suggestions = JSON.parse(match[1]);
    if (!Array.isArray(suggestions)) return [];
    return suggestions
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchSogouSuggestions(query, signal) {
  const url = `https://www.sogou.com/suggnew/ajajjson?key=${encodeURIComponent(query)}&type=web`;
  const text = await fetchTextWithEncoding(url, "gb18030", "Sogou", signal);
  const matches = [...text.matchAll(/\["([^\"]+)"(?:,[^\]]*)?\]/g)];
  return matches
    .map((match) => decodeSogouSuggestion(match[1]))
    .filter(Boolean);
}

async function fetchSo360Suggestions(query, signal) {
  const url = `https://sug.so.360.cn/suggest?word=${encodeURIComponent(query)}&encodein=utf-8&encodeout=utf-8&format=json`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`360 Search suggestions failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.result)) return [];
  return payload.result
    .map((item) => typeof item?.word === "string" ? item.word.trim() : "")
    .filter(Boolean);
}

async function fetchTextWithEncoding(url, encoding, sourceName, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${sourceName} suggestions failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new TextDecoder(encoding).decode(buffer);
}

function decodeSogouSuggestion(value) {
  try {
    return value
      .replaceAll("\\u003c", "<")
      .replaceAll("\\u003e", ">")
      .replaceAll("\\/", "/")
      .trim();
  } catch {
    return value;
  }
}

function renderSearchSuggestions() {
  searchSuggestionsEl.innerHTML = "";
  if (!searchSuggestionItems.length) {
    hideSearchSuggestions();
    return;
  }

  searchInputEl.setAttribute("aria-expanded", "true");
  searchSuggestionsEl.hidden = false;

  searchSuggestionItems.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-suggestion";
    button.setAttribute("role", "option");
    button.classList.toggle("is-active", index === activeSuggestionIndex);
    button.innerHTML = `
      <span class="search-suggestion-title">${escapeHtml(item.value)}</span>
      <span class="search-suggestion-meta">${escapeHtml(item.source)}</span>
    `;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applySearchSuggestion(item.value);
      handleSearch(event);
    });
    searchSuggestionsEl.appendChild(button);
  });
}

function hideSearchSuggestions() {
  searchSuggestionItems = [];
  activeSuggestionIndex = -1;
  searchInputEl.setAttribute("aria-expanded", "false");
  searchSuggestionsEl.hidden = true;
  searchSuggestionsEl.innerHTML = "";
}

function applySearchSuggestion(value) {
  searchInputEl.value = value;
  hideSearchSuggestions();
}

function addSearchHistoryEntry(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;

  const deduped = [trimmedQuery, ...(state.searchHistory || []).filter((item) => item.toLowerCase() !== trimmedQuery.toLowerCase())];
  state.searchHistory = deduped.slice(0, MAX_SEARCH_HISTORY);
  saveState();
}

// Build the bookmark grid or list from stored links.

