function initializeLocalization() {
  return loadLanguage(state.language || detectPreferredLanguage());
}

function primeCachedLocalization(language = state.language || detectPreferredLanguage()) {
  const normalizedLanguage = normalizeLanguage(language);
  const cachedTranslations = getCachedLanguageFile(normalizedLanguage);
  if (!cachedTranslations) return false;

  const cachedFallback = normalizedLanguage === DEFAULT_LANGUAGE
    ? {}
    : (getCachedLanguageFile(DEFAULT_LANGUAGE) || {});
  currentLanguage = normalizedLanguage;
  state.language = normalizedLanguage;
  translations = {
    ...cachedFallback,
    ...cachedTranslations
  };
  document.documentElement.lang = getActiveLocale();
  return true;
}

async function loadLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);
  const fallbackTranslationsPromise = normalizedLanguage === DEFAULT_LANGUAGE
    ? Promise.resolve({})
    : fetchLanguageFile(DEFAULT_LANGUAGE);
  const localizedTranslationsPromise = fetchLanguageFile(normalizedLanguage);
  const [fallbackTranslations, localizedTranslations] = await Promise.all([
    fallbackTranslationsPromise,
    localizedTranslationsPromise
  ]);

  currentLanguage = normalizedLanguage;
  state.language = normalizedLanguage;
  translations = {
    ...fallbackTranslations,
    ...localizedTranslations
  };
  document.documentElement.lang = getActiveLocale();
}

async function fetchLanguageFile(language) {
  try {
    const response = await fetch(`${LANGUAGE_BASE_PATH}/${language}.json`);
    if (!response.ok) throw new Error(`Language file load failed: ${language}`);
    const languageFile = await response.json();
    cacheLanguageFile(language, languageFile);
    return languageFile;
  } catch (error) {
    console.warn("Language file load failed", error);
    return {};
  }
}

function getCachedLanguageFile(language) {
  try {
    const raw = localStorage.getItem(getLanguageCacheKey(language));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheLanguageFile(language, languageFile) {
  try {
    localStorage.setItem(getLanguageCacheKey(language), JSON.stringify(languageFile));
  } catch {
    // Language files are a performance cache only; failing to cache is harmless.
  }
}

function getLanguageCacheKey(language) {
  return `language:${DATA_VERSION}:${language}`;
}

function applyTranslations() {
  if (!Object.keys(translations || {}).length) return;

  document.title = t("app.title");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    setTranslatedNodeText(node, t(node.dataset.i18n));
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });

  if (typeof syncCustomSelects === "function") {
    syncCustomSelects();
  }
}

function setTranslatedNodeText(node, text) {
  const hasElementChildren = [...node.childNodes].some((child) => child.nodeType === Node.ELEMENT_NODE);
  if (!hasElementChildren) {
    node.textContent = text;
    return;
  }

  let textNode = [...node.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
  if (!textNode) {
    textNode = document.createTextNode("");
    node.insertBefore(textNode, node.firstChild);
  }

  const leadingWhitespace = (textNode.textContent.match(/^(\s*)/) || ["", ""])[1];
  const trailingWhitespace = (textNode.textContent.match(/(\s*)$/) || ["", " "])[1] || " ";
  textNode.textContent = `${leadingWhitespace}${text}${trailingWhitespace}`;
}

function t(key, vars = {}) {
  const template = resolveTranslationKey(key);
  const base = typeof template === "string" ? template : key;
  return Object.entries(vars).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    base
  );
}

function resolveTranslationKey(path) {
  return path.split(".").reduce((value, segment) => (
    value && typeof value === "object" ? value[segment] : undefined
  ), translations);
}

function getPresetLabel(key) {
  const translated = t(`preset.${key}`);
  return translated === `preset.${key}` ? (PRESET_LABELS[key] || PRESET_LABELS.wallpaper_1) : translated;
}

function detectPreferredLanguage() {
  return normalizeLanguage(typeof navigator?.language === "string" ? navigator.language : DEFAULT_LANGUAGE);
}

function getActiveLocale() {
  if (currentLanguage === "ms") return "ms-MY";
  return currentLanguage || DEFAULT_LANGUAGE;
}

function normalizeLanguage(language) {
  if (typeof language !== "string" || !language.trim()) return DEFAULT_LANGUAGE;
  const normalized = language.trim();
  const lower = normalized.toLowerCase();
  if (lower.startsWith("yue") || lower.startsWith("zh-hk") || lower.startsWith("zh-mo")) return "zh-CN";
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("th")) return "th";
  if (lower.startsWith("ms")) return "ms";
  if (lower.startsWith("en")) return "en";
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : DEFAULT_LANGUAGE;
}


