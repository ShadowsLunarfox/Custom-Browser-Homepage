// Live clock rendering.
const BACKGROUND_VIDEO_HAVE_METADATA = 1;
const BACKGROUND_VIDEO_HAVE_CURRENT_DATA = 2;
const BACKGROUND_VIDEO_RECOVERY_DELAY_MS = 520;
const BACKGROUND_VIDEO_THEME_REFRESH_DELAY_MS = 140;
let backgroundVideoRecoveryTimer = 0;
let activeBackgroundLayerSource = "";
let clockTimer = 0;
let activeCustomSelect = null;
let activeCustomRange = null;
let didBindCustomSelectDocumentEvents = false;
let didBindCustomRangeDocumentEvents = false;
let didInitializeSettingsControls = false;

function startClock() {
  updateClock();
  syncClockTimer();
  document.addEventListener("visibilitychange", syncClockTimer);
}

function syncClockTimer() {
  window.clearTimeout(clockTimer);
  clockTimer = 0;

  if (!shouldRunClockTimer()) {
    return;
  }

  const delay = Math.max(250, 1020 - (Date.now() % 1000));
  clockTimer = window.setTimeout(() => {
    clockTimer = 0;
    updateClock();
    syncClockTimer();
  }, delay);
}

function shouldRunClockTimer() {
  return document.visibilityState !== "hidden" && Boolean(state.settings.clockVisible);
}

function updateClock() {
  const now = new Date();
  const locale = getActiveLocale();
  clockEl.textContent = now.toLocaleTimeString(locale, { hour12: false });
  dateTextEl.textContent = now.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "long"
  });

  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;
  const secondDeg = seconds * 6;
  const minuteDeg = (minutes * 6) + (seconds * 0.1);
  const hourDeg = (hours * 30) + (minutes * 0.5);

  hourHandEl.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
  minuteHandEl.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
  secondHandEl.style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
}

function renderPriorityBackgroundShell() {
  applyThemeSettings();
  applyThemeStyle();
  renderInitialBackgroundShell();
}

// Render the full page from the current state object.
function renderAll(options = {}) {
  const includeBackground = options.includeBackground !== false;
  applyThemeSettings();
  applyThemeStyle();
  renderPanelPositions();
  renderSearchEngine();
  renderCollection();
  if (includeBackground) {
    renderBackground();
  }
  renderLayoutSwitch();
  renderSettingsPanelIfReady();
  applyTranslations();
  syncVoiceSearchUi();
}

// Update search engine label, color, and custom select state.

function renderSearchEngine() {
  const engineKey = state.searchEngine in SEARCH_ENGINES ? state.searchEngine : "google";
  const engine = SEARCH_ENGINES[engineKey];
  const allEnabled = Boolean(state.settings.searchSuggestionsAllEnginesEnabled);
  searchEngineEl.value = engineKey;
  settingsSearchEngineEl.value = engineKey;
  searchEngineEl.dataset.engine = engineKey;
  searchEngineEl.style.setProperty("--engine-color", engine.color);
  searchAllEnginesButtonEl.classList.toggle("is-active", allEnabled);
  searchAllEnginesButtonEl.setAttribute("aria-pressed", allEnabled ? "true" : "false");
  searchAllEnginesButtonEl.textContent = allEnabled ? t("actions.search_all_on") : t("actions.search_single");
  searchAllEnginesButtonEl.setAttribute("title", allEnabled ? t("actions.search_all_engines") : t("actions.search_single_engine"));
  syncCustomSelect(searchEngineEl);
  syncCustomSelect(settingsSearchEngineEl);
}

// Reflect current layout mode inside the settings switch.
function renderLayoutSwitch() {
  layoutGridButtonEl.classList.toggle("is-active", state.layout === "grid");
  layoutListButtonEl.classList.toggle("is-active", state.layout === "list");
}

// Mirror settings values back into the settings UI controls.
function renderSettingsPanel() {
  const resolvedTextColor = resolveThemeTextColor(state.settings.textColor, state.settings.theme);
  languageSelectEl.value = currentLanguage;
  themeModeEl.value = state.settings.theme;
  themeStyleEl.value = state.settings.themeStyle;
  if (settingsColorsSectionEl) {
    const hideColorSettings = !["default", "cartoon"].includes(state.settings.themeStyle);
    settingsColorsSectionEl.hidden = hideColorSettings;
    settingsColorsSectionEl.classList.toggle("is-hidden", hideColorSettings);
    settingsColorsSectionEl.setAttribute("aria-hidden", hideColorSettings ? "true" : "false");
  }
  searchSuggestionsSettingEl.value = state.settings.searchSuggestionsEnabled ? "on" : "off";
  searchSuggestionsAllEnginesSettingEl.value = state.settings.searchSuggestionsAllEnginesEnabled ? "all" : "selected";
  searchSuggestionsAllEnginesSettingEl.disabled = !state.settings.searchSuggestionsEnabled;
  renderSearchSuggestionEngineList();
  accentColorEl.value = state.settings.accentColor;
  accentColorValueEl.textContent = state.settings.accentColor.toUpperCase();
  textColorEl.value = resolvedTextColor;
  textColorValueEl.textContent = resolvedTextColor.toUpperCase();
  panelColorEl.value = state.settings.panelColor;
  panelColorValueEl.textContent = state.settings.panelColor.toUpperCase();
  dropdownColorEl.value = state.settings.dropdownColor;
  dropdownColorValueEl.textContent = state.settings.dropdownColor.toUpperCase();
  sliderTrackColorEl.value = state.settings.sliderTrackColor;
  sliderTrackColorValueEl.textContent = state.settings.sliderTrackColor.toUpperCase();
  sliderFillColorEl.value = state.settings.sliderFillColor;
  sliderFillColorValueEl.textContent = state.settings.sliderFillColor.toUpperCase();
  fontScaleRangeEl.value = String(state.settings.fontScale);
  fontScaleValueEl.textContent = `${state.settings.fontScale}%`;
  radiusRangeEl.value = String(state.settings.radius);
  radiusValueEl.textContent = `${state.settings.radius}px`;
  blurRangeEl.value = String(state.settings.panelBlur);
  blurValueEl.textContent = `${state.settings.panelBlur}px`;
  searchUiShowButtonEl.classList.toggle("is-active", state.settings.searchUiVisible);
  searchUiHideButtonEl.classList.toggle("is-active", !state.settings.searchUiVisible);
  searchUiShowButtonEl.setAttribute("aria-pressed", state.settings.searchUiVisible ? "true" : "false");
  searchUiHideButtonEl.setAttribute("aria-pressed", state.settings.searchUiVisible ? "false" : "true");
  shortcutsUiShowButtonEl.classList.toggle("is-active", state.settings.shortcutsVisible);
  shortcutsUiHideButtonEl.classList.toggle("is-active", !state.settings.shortcutsVisible);
  shortcutsUiShowButtonEl.setAttribute("aria-pressed", state.settings.shortcutsVisible ? "true" : "false");
  shortcutsUiHideButtonEl.setAttribute("aria-pressed", state.settings.shortcutsVisible ? "false" : "true");
  clockVisibilityEl.value = state.settings.clockVisible ? "show" : "hide";
  clockStyleEl.value = state.settings.clockStyle;
  columnsRangeEl.value = String(state.settings.columns);
  columnsValueEl.textContent = String(state.settings.columns);
  rowsRangeEl.value = String(state.settings.rows);
  rowsValueEl.textContent = String(state.settings.rows);
  cardGapRangeEl.value = String(state.settings.cardGap);
  cardGapValueEl.textContent = `${state.settings.cardGap}px`;
  cardHeightRangeEl.value = String(state.settings.cardHeight);
  cardHeightValueEl.textContent = `${state.settings.cardHeight}px`;
  panelOpacityRangeEl.value = String(state.settings.panelOpacity);
  panelOpacityValueEl.textContent = `${state.settings.panelOpacity}%`;
  settingsSearchEngineEl.value = state.searchEngine;
  syncCustomSelects();
  syncCustomRanges();
}

function renderSearchSuggestionEngineList() {
  if (!searchSuggestionEngineListEl) return;

  const selectedKeys = new Set(state.settings.searchSuggestionEngineKeys);
  const disabled = !state.settings.searchSuggestionsEnabled || !state.settings.searchSuggestionsAllEnginesEnabled;
  searchSuggestionEngineListEl.classList.toggle("is-disabled", disabled);
  searchSuggestionEngineListEl.textContent = "";

  SEARCH_ENGINE_CATEGORY_ORDER.forEach((category) => {
    const engineKeys = Object.keys(SEARCH_ENGINES)
      .filter((engineKey) => getSearchEngineCategory(engineKey) === category);
    if (!engineKeys.length) return;

    const group = document.createElement("section");
    group.className = `engine-check-group engine-check-group-${category}`;

    const heading = document.createElement("div");
    heading.className = "engine-check-group-head";

    const title = document.createElement("strong");
    title.textContent = getSearchEngineCategoryLabel(category);
    const note = document.createElement("span");
    note.textContent = t(`search_engine_categories.${category}_note`);
    heading.append(title, note);

    const items = document.createElement("div");
    items.className = "engine-check-group-items";

    engineKeys.forEach((engineKey) => {
      const engineLabel = t(`engines.${engineKey}`);
      const item = document.createElement("label");
      item.className = "engine-check-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = engineKey;
      input.checked = selectedKeys.has(engineKey);
      input.disabled = disabled;

      const icon = createSearchEngineIcon(engineKey, "engine-check-icon", engineLabel);
      const text = document.createElement("span");
      text.className = "engine-check-label";
      text.textContent = engineLabel;

      item.append(input);
      if (icon) {
        item.append(icon);
      }
      item.append(text);
      items.appendChild(item);
    });

    group.append(heading, items);
    searchSuggestionEngineListEl.appendChild(group);
  });
}

function getSearchEngineCategory(engineKey) {
  const category = SEARCH_ENGINES[engineKey]?.category;
  return SEARCH_ENGINE_CATEGORY_ORDER.includes(category) ? category : "niche";
}

function getSearchEngineCategoryLabel(category) {
  return t(`search_engine_categories.${category}`);
}

function renderSettingsPanelIfReady() {
  if (didInitializeSettingsControls) {
    renderSettingsPanel();
  }
}

function setLayout(layout) {
  state.layout = layout === "list" ? "list" : "grid";
  persistAndRender();
}

function initializeCustomSelects(root = document) {
  const scope = root || document;
  scope.querySelectorAll("select").forEach((select) => {
    if (scope === document && select.closest("#settings-dialog, #debug-dialog")) {
      return;
    }

    if (select.dataset.customSelectReady === "true") {
      syncCustomSelect(select);
      return;
    }

    select.dataset.customSelectReady = "true";
    select.classList.add("native-select-source");

    const shell = document.createElement("div");
    shell.className = "custom-select";
    if (select.classList.contains("search-engine")) {
      shell.classList.add("custom-select-search");
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "custom-select-button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");

    const valueLabel = document.createElement("span");
    valueLabel.className = "custom-select-value";

    const arrow = document.createElement("span");
    arrow.className = "custom-select-arrow";
    arrow.setAttribute("aria-hidden", "true");

    const list = document.createElement("div");
    list.className = "custom-select-list";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    const listId = `${select.id || `select-${Math.random().toString(36).slice(2)}`}-custom-list`;
    list.id = listId;
    button.setAttribute("aria-controls", listId);

    button.append(valueLabel, arrow);
    shell.append(button, list);
    select.insertAdjacentElement("afterend", shell);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (select.disabled) return;
      toggleCustomSelect(select);
    });
    button.addEventListener("keydown", (event) => handleCustomSelectButtonKeydown(event, select));
    list.addEventListener("keydown", (event) => handleCustomSelectListKeydown(event, select));
    select.addEventListener("change", () => syncCustomSelect(select));

    syncCustomSelect(select);
  });

  if (didBindCustomSelectDocumentEvents) return;
  didBindCustomSelectDocumentEvents = true;

  document.addEventListener("click", (event) => {
    if (!activeCustomSelect) return;
    const shell = getCustomSelectShell(activeCustomSelect);
    if (shell?.contains(event.target) || activeCustomSelect.contains(event.target)) return;
    closeCustomSelect(activeCustomSelect);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeCustomSelect) {
      closeCustomSelect(activeCustomSelect, true);
    }
  });
}

function initializeCustomRanges(root = document) {
  const scope = root || document;
  scope.querySelectorAll("input[type='range']").forEach((input) => {
    if (scope === document && input.closest("#settings-dialog, #debug-dialog")) {
      return;
    }

    if (input.dataset.customRangeReady === "true") {
      syncCustomRange(input);
      return;
    }

    input.dataset.customRangeReady = "true";
    input.classList.add("native-range-source");

    const shell = document.createElement("div");
    shell.className = "custom-range";
    shell.tabIndex = 0;
    shell.setAttribute("role", "slider");

    const track = document.createElement("div");
    track.className = "custom-range-track";

    const fill = document.createElement("div");
    fill.className = "custom-range-fill";

    const thumb = document.createElement("div");
    thumb.className = "custom-range-thumb";
    thumb.setAttribute("aria-hidden", "true");

    track.append(fill, thumb);
    shell.appendChild(track);
    input.insertAdjacentElement("afterend", shell);

    shell.addEventListener("pointerdown", (event) => startCustomRangeDrag(event, input));
    shell.addEventListener("keydown", (event) => handleCustomRangeKeydown(event, input));
    input.addEventListener("input", () => syncCustomRange(input));
    input.addEventListener("change", () => syncCustomRange(input));

    syncCustomRange(input);
  });

  if (didBindCustomRangeDocumentEvents) return;
  didBindCustomRangeDocumentEvents = true;

  document.addEventListener("pointermove", handleCustomRangePointerMove);
  document.addEventListener("pointerup", stopCustomRangeDrag);
  window.addEventListener("blur", stopCustomRangeDrag);
  window.addEventListener("resize", syncCustomRanges);
}

function syncCustomRanges() {
  document.querySelectorAll("input[type='range'][data-custom-range-ready='true']").forEach(syncCustomRange);
}

function syncCustomRange(input) {
  if (!input?.dataset || input.dataset.customRangeReady !== "true") return;

  const shell = getCustomRangeShell(input);
  const fill = shell?.querySelector(".custom-range-fill");
  const thumb = shell?.querySelector(".custom-range-thumb");
  if (!shell || !fill || !thumb) return;

  const percent = getRangePercent(input);
  shell.style.setProperty("--range-progress", `${percent}%`);
  fill.style.width = `${percent}%`;
  thumb.style.left = `${percent}%`;
  shell.setAttribute("aria-valuemin", input.min || "0");
  shell.setAttribute("aria-valuemax", input.max || "100");
  shell.setAttribute("aria-valuenow", input.value);
  shell.setAttribute("aria-label", getCustomRangeLabel(input));
  shell.classList.toggle("is-disabled", input.disabled);
  shell.tabIndex = input.disabled ? -1 : 0;
}

function getCustomRangeShell(input) {
  return input?.nextElementSibling?.classList?.contains("custom-range")
    ? input.nextElementSibling
    : null;
}

function getRangePercent(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || min);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function getCustomRangeLabel(input) {
  const explicitLabel = input.getAttribute("aria-label");
  if (explicitLabel) return explicitLabel;

  const label = input.closest("label");
  return [...label?.childNodes || []]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent.trim())
    .filter(Boolean)
    .join(" ") || input.id || "Range";
}

function startCustomRangeDrag(event, input) {
  if (input.disabled || event.button !== 0) return;
  event.preventDefault();
  activeCustomRange = input;
  getCustomRangeShell(input)?.classList.add("is-dragging");
  updateCustomRangeFromPointer(input, event.clientX, true);
}

function handleCustomRangePointerMove(event) {
  if (!activeCustomRange) return;
  event.preventDefault();
  updateCustomRangeFromPointer(activeCustomRange, event.clientX, true);
}

function stopCustomRangeDrag() {
  if (!activeCustomRange) return;
  getCustomRangeShell(activeCustomRange)?.classList.remove("is-dragging");
  activeCustomRange.dispatchEvent(new Event("change", { bubbles: true }));
  activeCustomRange = null;
}

function updateCustomRangeFromPointer(input, clientX, emitInput = false) {
  const shell = getCustomRangeShell(input);
  const track = shell?.querySelector(".custom-range-track");
  const rect = track?.getBoundingClientRect();
  if (!rect || rect.width <= 0) return;

  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  setCustomRangeValue(input, ratioToRangeValue(input, ratio), emitInput);
}

function ratioToRangeValue(input, ratio) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = Number(input.step || 1);
  const rawValue = min + ((max - min) * ratio);
  if (!Number.isFinite(step) || step <= 0) return rawValue;

  const steps = Math.round((rawValue - min) / step);
  const steppedValue = min + (steps * step);
  const decimals = getStepDecimals(step);
  return Number(steppedValue.toFixed(decimals));
}

function getStepDecimals(step) {
  const stepText = String(step);
  return stepText.includes(".") ? stepText.split(".")[1].length : 0;
}

function setCustomRangeValue(input, value, emitInput = true) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const clampedValue = Math.min(max, Math.max(min, Number(value)));
  const nextValue = String(clampedValue);
  if (input.value === nextValue) return;

  input.value = nextValue;
  syncCustomRange(input);
  if (emitInput) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function handleCustomRangeKeydown(event, input) {
  if (input.disabled) return;

  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = Number(input.step || 1) || 1;
  const current = Number(input.value || min);
  let nextValue = current;

  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    nextValue = current - step;
  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    nextValue = current + step;
  } else if (event.key === "PageDown") {
    nextValue = current - (step * 5);
  } else if (event.key === "PageUp") {
    nextValue = current + (step * 5);
  } else if (event.key === "Home") {
    nextValue = min;
  } else if (event.key === "End") {
    nextValue = max;
  } else {
    return;
  }

  event.preventDefault();
  setCustomRangeValue(input, nextValue, true);
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function syncCustomSelects() {
  document.querySelectorAll("select[data-custom-select-ready='true']").forEach(syncCustomSelect);
}

function syncCustomSelect(select) {
  if (!select?.dataset || select.dataset.customSelectReady !== "true") return;

  const shell = getCustomSelectShell(select);
  const button = shell?.querySelector(".custom-select-button");
  const valueLabel = shell?.querySelector(".custom-select-value");
  const list = shell?.querySelector(".custom-select-list");
  if (!shell || !button || !valueLabel || !list) return;

  const selectedOption = select.selectedOptions[0] || select.options[select.selectedIndex] || select.options[0];
  setCustomSelectValueContent(valueLabel, select, selectedOption);
  button.setAttribute("aria-label", getCustomSelectLabel(select, selectedOption));
  button.disabled = select.disabled;
  button.setAttribute("aria-disabled", select.disabled ? "true" : "false");
  shell.classList.toggle("is-disabled", select.disabled);

  const optionsSignature = getCustomSelectOptionsSignature(select);
  if (list.dataset.optionsSignature !== optionsSignature) {
    renderCustomSelectOptions(select, list);
    list.dataset.optionsSignature = optionsSignature;
  } else {
    syncCustomSelectOptionStates(select, list);
  }
}

function renderCustomSelectOptions(select, list) {
  list.innerHTML = "";
  let activeCategory = "";
  getCustomSelectOptionEntries(select).forEach(({ option, index }) => {
    if (isSearchEngineSelect(select)) {
      const category = getSearchEngineCategory(option.value);
      if (category !== activeCategory) {
        const heading = document.createElement("div");
        heading.className = `custom-select-group custom-select-group-${category}`;
        heading.textContent = getSearchEngineCategoryLabel(category);
        heading.setAttribute("role", "presentation");
        list.appendChild(heading);
        activeCategory = category;
      }
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "custom-select-option";
    item.setAttribute("role", "option");
    item.dataset.value = option.value;
    item.dataset.index = String(index);
    setCustomSelectOptionContent(item, select, option);
    item.disabled = option.disabled;
    item.setAttribute("aria-selected", option.selected ? "true" : "false");
    item.classList.toggle("is-selected", option.selected);
    item.addEventListener("click", (event) => {
      event.preventDefault();
      chooseCustomSelectOption(select, index);
    });
    list.appendChild(item);
  });
}

function syncCustomSelectOptionStates(select, list) {
  list.querySelectorAll(".custom-select-option").forEach((item) => {
    const index = Number(item.dataset.index);
    const option = select.options[index];
    if (!option) {
      item.remove();
      return;
    }

    item.disabled = option.disabled;
    item.setAttribute("aria-selected", option.selected ? "true" : "false");
    item.classList.toggle("is-selected", option.selected);
  });
}

function getCustomSelectOptionsSignature(select) {
  return getCustomSelectOptionEntries(select).map(({ option }) => (
    isSearchEngineSelect(select)
      ? `${option.value}\u0001${option.textContent.trim()}\u0001${option.disabled ? "1" : "0"}\u0001${getSearchEngineCategory(option.value)}\u0001${getSearchEngineCategoryLabel(getSearchEngineCategory(option.value))}`
      : `${option.value}\u0001${option.textContent.trim()}\u0001${option.disabled ? "1" : "0"}`
  )).join("\u0002");
}

function getCustomSelectOptionEntries(select) {
  const entries = [...select.options].map((option, index) => ({ option, index }));
  if (!isSearchEngineSelect(select)) return entries;

  return entries.sort((left, right) => (
    SEARCH_ENGINE_CATEGORY_ORDER.indexOf(getSearchEngineCategory(left.option.value))
    - SEARCH_ENGINE_CATEGORY_ORDER.indexOf(getSearchEngineCategory(right.option.value))
  ));
}

function setCustomSelectValueContent(target, select, option) {
  const label = option?.textContent?.trim() || "";
  target.textContent = "";

  const icon = createSelectOptionIcon(select, option, "custom-select-engine-icon", label);
  if (icon) {
    target.appendChild(icon);
  }

  const text = document.createElement("span");
  text.className = "custom-select-label-text";
  text.textContent = label;
  target.appendChild(text);
}

function setCustomSelectOptionContent(target, select, option) {
  target.textContent = "";

  const label = option.textContent.trim();
  const icon = createSelectOptionIcon(select, option, "custom-select-engine-icon", label);
  if (icon) {
    target.appendChild(icon);
  }

  const text = document.createElement("span");
  text.className = "custom-select-label-text";
  text.textContent = label;
  target.appendChild(text);
}

function createSelectOptionIcon(select, option, className, label) {
  if (!isSearchEngineSelect(select)) return null;
  return createSearchEngineIcon(option?.value, className, label);
}

function createSearchEngineIcon(engineKey, className, label = "") {
  const engine = SEARCH_ENGINES[engineKey];
  if (!engine?.icon) return null;

  const image = document.createElement("img");
  image.className = className;
  image.src = engine.icon;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.setAttribute("aria-hidden", "true");
  image.title = label || engine.label || engineKey;
  return image;
}

function isSearchEngineSelect(select) {
  return select?.id === "search-engine" || select?.id === "settings-search-engine";
}

function getCustomSelectLabel(select, selectedOption) {
  const explicitLabel = select.getAttribute("aria-label");
  if (explicitLabel) {
    return `${explicitLabel}: ${selectedOption?.textContent?.trim() || ""}`;
  }

  const label = select.closest("label");
  const labelText = [...label?.childNodes || []]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent.trim())
    .filter(Boolean)
    .join(" ");
  return labelText
    ? `${labelText}: ${selectedOption?.textContent?.trim() || ""}`
    : (selectedOption?.textContent?.trim() || "");
}

function getCustomSelectShell(select) {
  return select?.nextElementSibling?.classList?.contains("custom-select")
    ? select.nextElementSibling
    : null;
}

function toggleCustomSelect(select) {
  const shell = getCustomSelectShell(select);
  if (!shell) return;
  if (shell.classList.contains("is-open")) {
    closeCustomSelect(select, true);
  } else {
    openCustomSelect(select);
  }
}

function openCustomSelect(select) {
  if (activeCustomSelect && activeCustomSelect !== select) {
    closeCustomSelect(activeCustomSelect);
  }

  syncCustomSelect(select);
  const shell = getCustomSelectShell(select);
  const button = shell?.querySelector(".custom-select-button");
  const list = shell?.querySelector(".custom-select-list");
  if (!shell || !button || !list) return;

  activeCustomSelect = select;
  shell.classList.add("is-open");
  setCustomSelectContainerLayer(select, true);
  button.setAttribute("aria-expanded", "true");
  list.hidden = false;
  positionCustomSelectList(select);

  const selectedItem = list.querySelector(".custom-select-option.is-selected");
  (selectedItem || list.querySelector(".custom-select-option:not(:disabled)"))?.focus();
}

function closeCustomSelect(select, restoreFocus = false) {
  const shell = getCustomSelectShell(select);
  const button = shell?.querySelector(".custom-select-button");
  const list = shell?.querySelector(".custom-select-list");
  if (!shell || !button || !list) return;

  shell.classList.remove("is-open");
  setCustomSelectContainerLayer(select, false);
  button.setAttribute("aria-expanded", "false");
  list.hidden = true;
  if (activeCustomSelect === select) {
    activeCustomSelect = null;
  }
  if (restoreFocus) {
    button.focus();
  }
}

function setCustomSelectContainerLayer(select, isOpen) {
  const shell = getCustomSelectShell(select);
  [
    ".custom-select",
    ".search-engine-wrap",
    ".search-box-combined",
    ".search-form",
    ".hero-content",
    ".hero-card",
    ".panel",
    ".app-dialog",
    ".settings-subsection",
    ".settings-section"
  ].forEach((selector) => {
    shell?.closest(selector)?.classList.toggle("is-select-menu-open", isOpen);
  });
}

function positionCustomSelectList(select) {
  const shell = getCustomSelectShell(select);
  const list = shell?.querySelector(".custom-select-list");
  if (!shell || !list) return;

  shell.classList.remove("is-drop-up");
  const shellRect = shell.getBoundingClientRect();
  const spaceBelow = window.innerHeight - shellRect.bottom;
  const spaceAbove = shellRect.top;
  const listHeight = Math.min(list.scrollHeight, window.innerHeight * 0.44, 280);
  if (spaceBelow < listHeight + 12 && spaceAbove > spaceBelow) {
    shell.classList.add("is-drop-up");
  }
}

function chooseCustomSelectOption(select, index) {
  const option = select.options[index];
  if (!option || option.disabled || select.value === option.value) {
    closeCustomSelect(select, true);
    return;
  }

  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  syncCustomSelect(select);
  closeCustomSelect(select, true);
}

function handleCustomSelectButtonKeydown(event, select) {
  if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    openCustomSelect(select);
  }
}

function handleCustomSelectListKeydown(event, select) {
  const shell = getCustomSelectShell(select);
  const items = [...shell?.querySelectorAll(".custom-select-option:not(:disabled)") || []];
  const currentIndex = items.indexOf(document.activeElement);
  if (!items.length) return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + direction + items.length) % items.length;
    items[nextIndex].focus();
  } else if (event.key === "Home") {
    event.preventDefault();
    items[0].focus();
  } else if (event.key === "End") {
    event.preventDefault();
    items[items.length - 1].focus();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    chooseCustomSelectOption(select, Number(document.activeElement?.dataset.index));
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeCustomSelect(select, true);
  }
}

function openSettingsDialog() {
  ensureSettingsControlsInitialized();
  ensurePresetButtonsRendered();
  renderSettingsPanel();
  openDialog("settings-dialog");
}

function ensureSettingsControlsInitialized() {
  if (didInitializeSettingsControls) return;
  didInitializeSettingsControls = true;
  initializeCustomSelects(settingsDialogEl);
  initializeCustomRanges(settingsDialogEl);
}

function ensurePresetButtonsRendered(force = false) {
  if (!force && presetGridEl.dataset.presetsRendered === "true") {
    syncPresetButtonSelection();
    return;
  }

  renderPresetButtons();
}

function renderPresetButtons() {
  presetGridEl.innerHTML = "";

  const groups = [
    ["image", getWallpaperCategoryLabel("image")],
    ["video", getWallpaperCategoryLabel("video")]
  ];

  groups.forEach(([mediaType, label]) => {
    const presets = Object.entries(PRESETS).filter(([, preset]) => preset.mediaType === mediaType);
    if (!presets.length) return;

    const heading = document.createElement("h6");
    heading.className = "preset-group-title";
    heading.textContent = label;
    presetGridEl.appendChild(heading);

    presets.forEach(([key, preset]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `preset-button preset-button-${mediaType}`;
      button.dataset.preset = key;
      button.dataset.mediaType = mediaType;
      if (mediaType === "image") {
        button.style.backgroundImage = `
          linear-gradient(180deg, rgba(5, 8, 16, 0.05), rgba(5, 8, 16, 0.34)),
          url("${escapeCssUrl(preset.path)}")
        `;
      }
      button.innerHTML = `
        ${mediaType === "video" ? `<video class="preset-video-preview" src="${escapeAttribute(preset.path)}" muted loop playsinline preload="metadata" aria-hidden="true"></video>` : ""}
        <span class="preset-name">${escapeHtml(getPresetLabel(key))}</span>
        <span class="preset-check">${escapeHtml(t("preset.selected"))}</span>
      `;
      if (mediaType === "video") {
        const previewVideo = button.querySelector(".preset-video-preview");
        const showPreviewFrame = () => {
          button.classList.add("has-preview");
        };
        const playPreview = () => {
          if (!previewVideo || document.visibilityState !== "visible") return;
          void previewVideo.play().catch(() => {});
        };
        const pausePreview = () => {
          previewVideo?.pause();
        };
        previewVideo?.addEventListener("loadeddata", showPreviewFrame, { once: true });
        previewVideo?.addEventListener("loadedmetadata", showPreviewFrame, { once: true });
        button.addEventListener("pointerenter", playPreview);
        button.addEventListener("focusin", playPreview);
        button.addEventListener("pointerleave", pausePreview);
        button.addEventListener("focusout", pausePreview);
      }
      button.addEventListener("click", () => {
        void applyPresetBackground(key);
      });
      presetGridEl.appendChild(button);
    });
  });
  presetGridEl.dataset.presetsRendered = "true";
  syncPresetButtonSelection();
}

function pausePresetVideoPreviews() {
  document.querySelectorAll(".preset-video-preview").forEach((video) => {
    video.pause();
  });
}

function getWallpaperCategoryLabel(mediaType) {
  const labels = {
    en: { image: "Images", video: "Live wallpapers" },
    "zh-CN": { image: "图片", video: "动态壁纸" },
    ko: { image: "이미지", video: "라이브 배경화면" },
    ja: { image: "画像", video: "ライブ壁紙" },
    th: { image: "รูปภาพ", video: "วอลเปเปอร์เคลื่อนไหว" },
    ms: { image: "Imej", video: "Kertas dinding hidup" }
  };
  return labels[currentLanguage]?.[mediaType] || labels.en[mediaType];
}

function escapeCssUrl(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isBackgroundVideoActive(source = "") {
  if (!backgroundVideoEl) return false;
  if (!document.body.classList.contains("has-custom-background-video")) return false;
  const activeSource = backgroundVideoEl.getAttribute("src") || "";
  return source ? activeSource === source : Boolean(activeSource);
}

function playBackgroundVideo(source, options = {}) {
  if (!backgroundVideoEl || !source) return;

  const shouldNudge = Boolean(options.nudge);
  const shouldVerify = options.verify !== false || shouldNudge;
  const recoveryDelay = Number.isFinite(options.delay)
    ? options.delay
    : BACKGROUND_VIDEO_RECOVERY_DELAY_MS;
  const currentSource = backgroundVideoEl.getAttribute("src") || "";

  window.clearTimeout(backgroundVideoRecoveryTimer);
  backgroundVideoEl.muted = true;
  backgroundVideoEl.loop = true;
  backgroundVideoEl.playsInline = true;
  backgroundVideoEl.preload = "metadata";
  backgroundVideoEl.setAttribute("muted", "");
  backgroundVideoEl.setAttribute("playsinline", "");
  backgroundVideoEl.setAttribute("preload", "metadata");

  if (currentSource !== source) {
    backgroundVideoEl.setAttribute("src", source);
    backgroundVideoEl.load();
  }

  const startTime = Number.isFinite(backgroundVideoEl.currentTime)
    ? backgroundVideoEl.currentTime
    : 0;
  const playAttempt = backgroundVideoEl.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    void playAttempt.catch(() => {
      scheduleBackgroundVideoRecovery(source, startTime, 180, true);
    });
  }

  if (shouldVerify) {
    scheduleBackgroundVideoRecovery(source, startTime, recoveryDelay, shouldNudge);
  }
}

function stopBackgroundVideo() {
  if (!backgroundVideoEl) return;

  window.clearTimeout(backgroundVideoRecoveryTimer);
  backgroundVideoEl.pause();
  if (backgroundVideoEl.getAttribute("src")) {
    backgroundVideoEl.removeAttribute("src");
    backgroundVideoEl.load();
  }
}

function scheduleBackgroundVideoRecovery(source, startTime, delay, forceNudge = false) {
  window.clearTimeout(backgroundVideoRecoveryTimer);
  backgroundVideoRecoveryTimer = window.setTimeout(() => {
    if (!isBackgroundVideoActive(source)) return;

    const currentTime = Number.isFinite(backgroundVideoEl.currentTime)
      ? backgroundVideoEl.currentTime
      : 0;
    const didNotAdvance = Math.abs(currentTime - startTime) < 0.03;
    const hasNoFrame = backgroundVideoEl.readyState < BACKGROUND_VIDEO_HAVE_CURRENT_DATA;
    const needsRecovery = forceNudge
      || backgroundVideoEl.paused
      || backgroundVideoEl.ended
      || hasNoFrame
      || didNotAdvance;

    if (needsRecovery) {
      restartBackgroundVideoPlayback(source);
    }
  }, delay);
}

function restartBackgroundVideoPlayback(source) {
  if (!isBackgroundVideoActive(source)) return;

  nudgeBackgroundVideoFrame();
  const playAttempt = backgroundVideoEl.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    void playAttempt.catch(() => {
      if (!isBackgroundVideoActive(source)) return;
      backgroundVideoEl.load();
      const retryAttempt = backgroundVideoEl.play();
      if (retryAttempt && typeof retryAttempt.catch === "function") {
        void retryAttempt.catch(() => {});
      }
    });
  }
}

function nudgeBackgroundVideoFrame() {
  try {
    if (backgroundVideoEl.readyState >= BACKGROUND_VIDEO_HAVE_METADATA) {
      const duration = Number.isFinite(backgroundVideoEl.duration) ? backgroundVideoEl.duration : 0;
      const currentTime = Number.isFinite(backgroundVideoEl.currentTime) ? backgroundVideoEl.currentTime : 0;
      if (duration > 0.2) {
        const maxTime = Math.max(0, duration - 0.08);
        backgroundVideoEl.currentTime = currentTime >= maxTime ? 0 : Math.min(currentTime + 0.06, maxTime);
      } else {
        backgroundVideoEl.currentTime = Math.max(0, currentTime + 0.01);
      }
      return;
    }
  } catch {
    // Some browsers throw while seeking a media element that is changing source.
  }

  backgroundVideoEl.load();
}

function refreshBackgroundVideoAfterThemeChange() {
  const source = backgroundVideoEl?.getAttribute("src") || "";
  if (!isBackgroundVideoActive(source)) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!isBackgroundVideoActive(source)) return;
      playBackgroundVideo(source, {
        delay: BACKGROUND_VIDEO_THEME_REFRESH_DELAY_MS,
        nudge: true
      });
    });
  });
}

function bindBackgroundVideoRecovery() {
  if (!backgroundVideoEl) return;

  const recoverActiveVideo = () => {
    const source = backgroundVideoEl.getAttribute("src") || "";
    if (!isBackgroundVideoActive(source)) return;
    scheduleBackgroundVideoRecovery(source, backgroundVideoEl.currentTime || 0, 220, true);
  };

  ["stalled", "waiting", "error"].forEach((eventName) => {
    backgroundVideoEl.addEventListener(eventName, recoverActiveVideo);
  });
  backgroundVideoEl.addEventListener("pause", () => {
    if (document.visibilityState === "visible") {
      recoverActiveVideo();
    }
  });
  document.addEventListener("visibilitychange", () => {
    const source = backgroundVideoEl.getAttribute("src") || "";
    if (!isBackgroundVideoActive(source)) return;

    if (document.visibilityState === "hidden") {
      window.clearTimeout(backgroundVideoRecoveryTimer);
      backgroundVideoEl.pause();
      return;
    }

    refreshBackgroundVideoAfterThemeChange();
  });
}

// Resolve either built-in wallpaper presets or uploaded wallpaper files.
function renderBackground() {
  syncPresetButtonSelection();

  if (state.background.type === "image" && state.background.value) {
    const backgroundAsset = state.background.value === CHROME_BACKGROUND_VALUE
      ? storedBackgroundImageDataUrl
      : state.background.value;
    const mediaType = state.background.mediaType === "video" ? "video" : "image";
    backgroundStatusEl.textContent = state.background.name
      ? `Current background: ${state.background.name}`
      : t("background.current_custom_image");
    backgroundUploadNameEl.textContent = state.background.name || t("background.custom_image_selected");

    if (backgroundAsset) {
      document.body.classList.add("has-custom-background");
      document.body.classList.toggle("has-custom-background-video", mediaType === "video");
      document.body.classList.remove("has-preset-wallpaper");
      delete document.body.dataset.wallpaperPreset;
      wallpaperStyleLinkEl.removeAttribute("href");
      if (mediaType === "video") {
        hideBackgroundLayerImage();
        playBackgroundVideo(backgroundAsset);
      } else {
        stopBackgroundVideo();
        if (backgroundAsset !== storedBackgroundObjectUrl) {
          revokeStoredBackgroundObjectUrl();
        }
        setBackgroundLayerImage(backgroundAsset);
      }
    } else {
      document.body.classList.remove("has-custom-background");
      document.body.classList.remove("has-custom-background-video");
      document.body.classList.remove("has-preset-wallpaper");
      delete document.body.dataset.wallpaperPreset;
      wallpaperStyleLinkEl.removeAttribute("href");
      clearBackgroundLayerImage();
      stopBackgroundVideo();
      revokeStoredBackgroundObjectUrl();
    }
    return;
  }

  if (state.background.type !== "preset" || !(state.background.value in PRESETS)) {
    renderThemeBackground();
    return;
  }

  const presetKey = state.background.value;
  const preset = PRESETS[presetKey];
  const presetMediaType = preset.mediaType === "video" ? "video" : "image";

  document.body.classList.remove("has-custom-background");
  document.body.classList.toggle("has-custom-background-video", presetMediaType === "video");
  document.body.classList.add("has-preset-wallpaper");
  revokeStoredBackgroundObjectUrl();
  backgroundUploadNameEl.textContent = t("background.no_custom_image");
  const presetLabel = getPresetLabel(presetKey);
  backgroundStatusEl.textContent = t("background.current_preset", { name: presetLabel });
  document.body.dataset.wallpaperPreset = presetKey;
  wallpaperStyleLinkEl.removeAttribute("href");
  applyBuiltInWallpaper(preset);
}

function syncPresetButtonSelection() {
  const presetButtons = [...document.querySelectorAll(".preset-button")];
  presetButtons.forEach((button) => {
    const key = button.dataset.preset;
    button.classList.toggle("active", state.background.type === "preset" && state.background.value === key);
  });
}

function renderInitialBackgroundShell() {
  if (state.background.type === "image" && state.background.value && state.background.value !== CHROME_BACKGROUND_VALUE) {
    const mediaType = state.background.mediaType === "video" ? "video" : "image";
    document.body.classList.add("has-custom-background");
    document.body.classList.toggle("has-custom-background-video", mediaType === "video");
    document.body.classList.remove("has-preset-wallpaper");
    delete document.body.dataset.wallpaperPreset;
    wallpaperStyleLinkEl.removeAttribute("href");

    if (mediaType === "video") {
      hideBackgroundLayerImage();
    } else {
      stopBackgroundVideo();
      setBackgroundLayerImage(state.background.value);
    }
    return;
  }

  if (state.background.type === "image") {
    renderThemeBackground();
    return;
  }

  if (state.background.type !== "preset" || !(state.background.value in PRESETS)) {
    renderThemeBackground();
    return;
  }

  const presetKey = state.background.value;
  const preset = PRESETS[presetKey];
  document.body.classList.remove("has-custom-background");
  document.body.classList.toggle("has-custom-background-video", preset.mediaType === "video");
  document.body.classList.add("has-preset-wallpaper");
  document.body.dataset.wallpaperPreset = presetKey;
  wallpaperStyleLinkEl.removeAttribute("href");
  if (preset.mediaType === "video") {
    hideBackgroundLayerImage();
  } else {
    applyBuiltInWallpaper(preset);
  }
}

function applyBuiltInWallpaper(preset) {
  document.body.style.background = "";

  if (preset.mediaType === "video") {
    hideBackgroundLayerImage();
    playBackgroundVideo(preset.path);
    return;
  }

  stopBackgroundVideo();
  setBackgroundLayerImage(preset.path);
}

function renderThemeBackground() {
  document.body.classList.remove("has-custom-background");
  document.body.classList.remove("has-custom-background-video");
  document.body.classList.remove("has-preset-wallpaper");
  delete document.body.dataset.wallpaperPreset;
  document.documentElement.style.removeProperty("--initial-wallpaper-image");
  wallpaperStyleLinkEl.removeAttribute("href");
  clearBackgroundLayerImage();
  backgroundUploadNameEl.textContent = t("background.no_custom_image");
  backgroundStatusEl.textContent = t("background.current_theme");
  stopBackgroundVideo();
  revokeStoredBackgroundObjectUrl();
}

function setBackgroundLayerImage(source) {
  if (!backgroundLayerEl || !source || activeBackgroundLayerSource === source) return;
  activeBackgroundLayerSource = source;
  backgroundLayerEl.style.backgroundImage = `url("${escapeCssUrl(source)}")`;
}

function hideBackgroundLayerImage() {
  if (!backgroundLayerEl || activeBackgroundLayerSource === "__none__") return;
  activeBackgroundLayerSource = "__none__";
  backgroundLayerEl.style.backgroundImage = "none";
}

function clearBackgroundLayerImage() {
  if (!backgroundLayerEl || (!activeBackgroundLayerSource && !backgroundLayerEl.style.backgroundImage)) return;
  activeBackgroundLayerSource = "";
  backgroundLayerEl.style.backgroundImage = "";
}

// Apply current theme colors plus fine-grained visual customization variables.
function applyThemeSettings() {
  const theme = state.settings.theme;
  document.body.dataset.theme = theme;

  const accent = normalizeHexColor(state.settings.accentColor, DEFAULT_SETTINGS.accentColor);
  const panelBase = normalizeHexColor(state.settings.panelColor, PANEL_COLOR_DEFAULTS[theme]);
  const dropdown = normalizeHexColor(state.settings.dropdownColor, DROPDOWN_COLOR_DEFAULTS[theme]);
  const sliderTrack = normalizeHexColor(state.settings.sliderTrackColor, SLIDER_TRACK_COLOR_DEFAULTS[theme]);
  const sliderFill = normalizeHexColor(state.settings.sliderFillColor, DEFAULT_SETTINGS.sliderFillColor);
  const accentStrong = mixHex(accent, theme === "dark" ? "#ffffff" : "#000000", theme === "dark" ? 0.12 : 0.16);
  const accentMuted = mixHex(accent, theme === "dark" ? "#0f1421" : "#ffffff", theme === "dark" ? 0.66 : 0.38);
  const mainText = resolveThemeTextColor(state.settings.textColor, theme);
  const softText = mixHex(mainText, theme === "dark" ? "#8f99ae" : "#5e6a81", 0.44);
  const buttonInk = pickReadableTextColor(accent);
  const panelOpacity = state.settings.panelOpacity / 100;
  const panelStrongOpacity = Math.min(1, panelOpacity + 0.08);
  const panelSoftOpacity = Math.min(1, Math.max(0.44, panelOpacity - 0.08));

  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-strong", accentStrong);
  document.documentElement.style.setProperty("--accent-muted", accentMuted);
  document.documentElement.style.setProperty("--accent-ink", buttonInk);
  document.documentElement.style.setProperty("--dropdown", dropdown);
  document.documentElement.style.setProperty("--dropdown-hover", mixHex(dropdown, accent, 0.18));
  document.documentElement.style.setProperty("--dropdown-ink", pickReadableTextColor(dropdown));
  document.documentElement.style.setProperty("--slider-track", sliderTrack);
  document.documentElement.style.setProperty("--slider-track-strong", mixHex(sliderTrack, theme === "dark" ? "#000000" : "#ffffff", 0.18));
  document.documentElement.style.setProperty("--slider-fill", sliderFill);
  document.documentElement.style.setProperty("--slider-fill-strong", mixHex(sliderFill, theme === "dark" ? "#ffffff" : "#000000", theme === "dark" ? 0.16 : 0.12));
  document.documentElement.style.setProperty("--slider-ink", pickReadableTextColor(sliderFill));
  document.documentElement.style.setProperty("--text-main", mainText);
  document.documentElement.style.setProperty("--text-soft", softText);
  document.documentElement.style.setProperty("--font-scale", String(state.settings.fontScale / 100));
  document.documentElement.style.setProperty("--ui-radius-xl", `${state.settings.radius}px`);
  document.documentElement.style.setProperty("--ui-radius-lg", `${Math.max(6, state.settings.radius - 4)}px`);
  document.documentElement.style.setProperty("--ui-radius-md", `${Math.max(4, state.settings.radius - 8)}px`);
  document.documentElement.style.setProperty("--panel-blur", `${state.settings.panelBlur}px`);
  document.documentElement.style.setProperty("--card-gap", `${state.settings.cardGap}px`);
  document.documentElement.style.setProperty("--card-height", `${state.settings.cardHeight}px`);
  document.documentElement.style.setProperty("--clock-display", state.settings.clockVisible ? "grid" : "none");
  document.body.classList.toggle("search-ui-hidden", !state.settings.searchUiVisible);
  document.body.classList.toggle("shortcuts-ui-hidden", !state.settings.shortcutsVisible);
  clockPanelEl.dataset.clockStyle = state.settings.clockStyle;
  analogClockEl.classList.toggle("is-visible", state.settings.clockStyle.startsWith("analog"));
  syncClockTimer();

  const panelStrong = mixHex(panelBase, theme === "dark" ? "#ffffff" : "#ffffff", theme === "dark" ? 0.12 : 0.34);
  const panelSoft = mixHex(panelBase, theme === "dark" ? "#ffffff" : "#ffffff", theme === "dark" ? 0.22 : 0.48);
  const panelRgb = hexToRgb(panelBase);
  const panelStrongRgb = hexToRgb(panelStrong);
  const panelSoftRgb = hexToRgb(panelSoft);
  document.documentElement.style.setProperty("--panel", `rgba(${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}, ${panelOpacity})`);
  document.documentElement.style.setProperty("--panel-strong", `rgba(${panelStrongRgb.r}, ${panelStrongRgb.g}, ${panelStrongRgb.b}, ${panelStrongOpacity})`);
  document.documentElement.style.setProperty("--panel-soft", `rgba(${panelSoftRgb.r}, ${panelSoftRgb.g}, ${panelSoftRgb.b}, ${panelSoftOpacity})`);
}

// Load the optional external style theme file.
function applyThemeStyle() {
  const styleKey = state.settings.themeStyle in THEME_STYLE_FILES ? state.settings.themeStyle : "default";
  const href = THEME_STYLE_FILES[styleKey];
  const currentHref = themeStyleLinkEl.getAttribute("href") || "";
  document.body.dataset.themeStyle = styleKey;
  loadThemeFont(styleKey);

  if (!href) {
    if (currentHref) {
      themeStyleLinkEl.removeAttribute("href");
      refreshBackgroundVideoAfterThemeChange();
    }
    return;
  }

  if (currentHref === href) {
    return;
  }

  themeStyleLinkEl.addEventListener("load", refreshBackgroundVideoAfterThemeChange, { once: true });
  themeStyleLinkEl.addEventListener("error", refreshBackgroundVideoAfterThemeChange, { once: true });
  themeStyleLinkEl.setAttribute("href", href);
}

function loadThemeFont(styleKey) {
  const href = THEME_FONT_FILES[styleKey];
  if (!href || loadedThemeFontKey === styleKey) return;

  loadedThemeFontKey = styleKey;
  runWhenIdle(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.themeFont = styleKey;
    document.head.appendChild(link);
  });
}

function runWhenIdle(callback) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 1800 });
    return;
  }

  window.setTimeout(callback, 900);
}

// Push layout-related settings into CSS custom properties.
function applyGridSettings() {
  collectionGridEl.style.setProperty("--column-count", String(state.settings.columns));
  collectionGridEl.style.setProperty("--visible-rows", String(state.settings.rows));
  collectionGridEl.classList.toggle("row-limited", state.layout === "grid");
}


function showInlineNotice(message, tone = "info") {
  if (!appNoticesEl || !message) return;

  const notice = document.createElement("section");
  notice.className = `app-notice${tone === "warning" || tone === "error" ? ` is-${tone}` : ""}`;

  const text = document.createElement("p");
  text.className = "app-notice-message";
  text.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "app-notice-close";
  closeButton.setAttribute("aria-label", t("actions.close"));
  closeButton.textContent = "\u00d7";
  closeButton.addEventListener("click", () => {
    notice.remove();
  });

  notice.append(text, closeButton);
  appNoticesEl.appendChild(notice);

  window.setTimeout(() => {
    notice.remove();
  }, 5200);
}



