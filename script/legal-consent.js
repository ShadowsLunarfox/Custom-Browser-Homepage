// Shared first-run agreement. No homepage modules run until it is recorded locally.
(function () {
  if (window.__lunarBlockMainPage) return;

  const STORAGE_KEY = "lunarLegalConsent:v1";
  // Bump these when publishing a revision that requires renewed agreement.
  const TERMS_VERSION = "2026-10-31";
  const PRIVACY_VERSION = "2026-10-31";
  const LEGAL_BASE = "https://github.com/ShadowsLunarfox/Lunar-Start-Page/blob/main/";
  const LANGUAGES = { en: "English", "zh-CN": "简体中文", yue: "繁體粵語", ja: "日本語", ko: "한국어", th: "ไทย", ms: "Bahasa Melayu" };
  const fallback = {
    title: "Before you begin",
    intro: "Please review the Terms of Service and Privacy Policy before using Lunar Start Page.",
    language: "Language",
    agreement: "I agree to the Terms of Service and acknowledge the Privacy Policy.",
    note: "Your agreement is saved only in this browser profile. Optional Windows media access requires separate permission.",
    accept: "Accept and continue",
    decline: "Decline and leave",
    storage_error: "Your agreement could not be saved. Free up browser storage or allow local storage, then try again."
  };
  let resolveReady;
  let completed = false;
  let languageSequence = 0;
  let localizing = false;
  let labels = { ...fallback };
  const ready = new Promise(resolve => { resolveReady = resolve; });
  window.lunarLegalConsent = { ready };

  function hasAgreement() {
    try {
      const record = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return record?.termsVersion === TERMS_VERSION
        && record?.privacyVersion === PRIVACY_VERSION
        && typeof record.acceptedAt === "string"
        && Number.isFinite(Date.parse(record.acceptedAt));
    } catch { return false; }
  }

  if (hasAgreement()) {
    resolveReady();
    return;
  }

  const dialog = document.createElement("dialog");
  dialog.id = "legal-consent-dialog";
  dialog.setAttribute("aria-labelledby", "legal-consent-title");
  dialog.setAttribute("aria-describedby", "legal-consent-intro");
  dialog.setAttribute("closedby", "none");
  dialog.innerHTML = `
    <form id="legal-consent-form">
      <div class="legal-consent-header"><strong>Lunar Start Page</strong><label><span data-consent-text="language">Language</span><select id="legal-consent-language"></select></label></div>
      <h2 id="legal-consent-title" data-consent-text="title">Before you begin</h2>
      <p id="legal-consent-intro" data-consent-text="intro">Please review the Terms of Service and Privacy Policy before using Lunar Start Page.</p>
      <nav class="legal-consent-links" aria-label="Legal documents">
        <a data-legal-document="terms" href="${LEGAL_BASE}TERMS.md" target="_blank" rel="noopener noreferrer">Terms of service ↗</a>
        <a data-legal-document="privacy" href="${LEGAL_BASE}PRIVACY.md" target="_blank" rel="noopener noreferrer">Privacy policy ↗</a>
      </nav>
      <label class="legal-consent-agreement"><input id="legal-consent-checkbox" type="checkbox" required><span data-consent-text="agreement">I agree to the Terms of Service and acknowledge the Privacy Policy.</span></label>
      <p class="legal-consent-note" data-consent-text="note">Your agreement is saved only in this browser profile. Optional Windows media access requires separate permission.</p>
      <p id="legal-consent-error" role="alert" hidden></p>
      <div class="legal-consent-actions"><button id="legal-consent-decline" type="button" data-consent-text="decline">Decline and leave</button><button id="legal-consent-accept" type="submit" disabled data-consent-text="accept">Accept and continue</button></div>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const checkbox = dialog.querySelector("input");
  const accept = dialog.querySelector("[type=submit]");
  const error = dialog.querySelector("[role=alert]");
  const select = dialog.querySelector("select");
  for (const [value, name] of Object.entries(LANGUAGES)) select.add(new Option(name, value));

  function normalizeLanguage(value) {
    const lower = String(value || "").toLowerCase();
    if (/^(yue|zh-hk|zh-mo)/.test(lower)) return "yue";
    if (lower.startsWith("zh")) return "zh-CN";
    return Object.keys(LANGUAGES).find(code => lower.startsWith(code)) || "en";
  }

  function preferredLanguage() {
    try {
      const shared = JSON.parse(localStorage.getItem("lunarShared:v1:field:language"));
      const key = document.documentElement.dataset.interfaceVersion === "legacy" ? "customHomeStateLegacy" : "customHomeState";
      const state = JSON.parse(localStorage.getItem(key));
      return normalizeLanguage(shared || state?.language || navigator.language);
    } catch { return normalizeLanguage(navigator.language); }
  }

  async function localize(language) {
    const sequence = ++languageSequence;
    localizing = true;
    checkbox.disabled = true;
    const path = name => language === "en" ? `${name}.md` : `docs/legal/${name}.${language}.md`;
    dialog.lang = language;
    dialog.querySelector('[data-legal-document="terms"]').href = LEGAL_BASE + path("TERMS");
    dialog.querySelector('[data-legal-document="privacy"]').href = LEGAL_BASE + path("PRIVACY");
    // Changing language is not agreement; always require a fresh check.
    checkbox.checked = false;
    accept.disabled = true;
    error.hidden = true;
    let legal = {};
    try {
      const response = await fetch(new URL(`data/language/${language}.json`, document.baseURI));
      if (response.ok) legal = (await response.json()).legal || {};
    } catch { /* The bundled English fallback remains usable offline. */ }
    if (sequence !== languageSequence || completed) return;
    labels = { ...fallback, ...legal.consent };
    dialog.querySelectorAll("[data-consent-text]").forEach(node => { node.textContent = labels[node.dataset.consentText]; });
    dialog.querySelector('[data-legal-document="terms"]').textContent = `${legal.terms || "Terms of service"} ↗`;
    dialog.querySelector('[data-legal-document="privacy"]').textContent = `${legal.privacy || "Privacy policy"} ↗`;
    localizing = false;
    checkbox.disabled = false;
  }

  function complete() {
    if (completed) return;
    completed = true;
    window.removeEventListener("storage", onStorage);
    dialog.close();
    dialog.remove();
    resolveReady();
  }

  function onStorage(event) {
    if (event.key === STORAGE_KEY && hasAgreement()) complete();
  }

  dialog.addEventListener("cancel", event => event.preventDefault());
  dialog.addEventListener("close", () => { if (!completed) dialog.showModal(); });
  checkbox.addEventListener("change", () => { accept.disabled = !checkbox.checked; });
  select.addEventListener("change", () => { void localize(select.value); });
  dialog.querySelector("#legal-consent-decline").addEventListener("click", () => { window.location.replace("about:blank"); });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (localizing || !checkbox.checked || accept.disabled) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, acceptedAt: new Date().toISOString(), language: select.value }));
      if (!hasAgreement()) throw new Error("Agreement was not retained");
      complete();
    } catch {
      error.textContent = labels.storage_error;
      error.hidden = false;
    }
  });
  window.addEventListener("storage", onStorage);
  select.value = preferredLanguage();
  void localize(select.value);
  dialog.showModal();
}());
