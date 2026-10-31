// Standalone guide: no homepage, native host, permissions or consent state is loaded.
(function () {
  const languages = ['en', 'zh-CN', 'yue', 'ja', 'ko', 'th', 'ms'];
  const select = document.getElementById('connector-language');
  const nodes = [...document.querySelectorAll('[data-connector-i18n]')];
  const english = nodes.map(node => [...node.childNodes].map(child => child.cloneNode(true)));
  const englishTitle = document.title;
  const cache = new Map();
  let sequence = 0;

  function normalize(value) {
    const lower = String(value || '').trim().toLowerCase();
    if (/^(yue|zh-hk|zh-mo)/.test(lower)) return 'yue';
    if (lower.startsWith('zh')) return 'zh-CN';
    return languages.find(language => lower.startsWith(language.toLowerCase())) || 'en';
  }

  function preferredLanguage() {
    const explicit = new URL(location.href).searchParams.get('lang');
    if (explicit) return normalize(explicit);
    try {
      const shared = JSON.parse(localStorage.getItem('lunarShared:v1:field:language'));
      const key = localStorage.getItem('lunarInterfaceVersion') === 'legacy' ? 'customHomeStateLegacy' : 'customHomeState';
      const state = JSON.parse(localStorage.getItem(key));
      return normalize(shared || state?.language || navigator.language);
    } catch { return normalize(navigator.language); }
  }

  function render(node, message, player) {
    const tokens = {
      install: ['code', 'Install.cmd'], uninstall: ['code', 'Uninstall.cmd'],
      chrome: ['code', 'chrome://extensions'], edge: ['code', 'edge://extensions'],
      path: ['code', '%LOCALAPPDATA%\\LunarStart\\MediaConnector'],
      cache: ['code', 'native\\windows-media\\bin'], yes: ['code', 'YES'],
      enable: ['strong', player.enable], disable: ['strong', player.disable], check: ['strong', player.check_connection]
    };
    node.replaceChildren(...message.split(/(\{\w+\})/).map(part => {
      const token = tokens[part.slice(1, -1)];
      if (!/^\{\w+\}$/.test(part) || !token) return document.createTextNode(part);
      const element = document.createElement(token[0]); element.textContent = token[1]; return element;
    }));
  }

  async function load(language) {
    if (cache.has(language)) return cache.get(language);
    const response = await fetch(new URL(`data/language/${language}.json`, document.baseURI));
    if (!response.ok) throw new Error('Guide language is unavailable');
    const data = await response.json();
    const labels = {...data.connector, privacy:data.legal?.privacy, terms:data.legal?.terms};
    if (!labels.page_title || nodes.some(node => typeof labels[node.dataset.connectorI18n] !== 'string')) throw new Error('Incomplete guide language');
    if (!data.player?.enable || !data.player?.disable || !data.player?.check_connection) throw new Error('Missing player labels');
    cache.set(language, {labels,player:data.player});
    return cache.get(language);
  }

  async function localize(language) {
    const current = ++sequence;
    document.documentElement.setAttribute('aria-busy', 'true');
    let data;
    try { data = await load(language); }
    catch {
      language = 'en';
      try { data = await load('en'); } catch { /* Complete English HTML remains available. */ }
    }
    if (current !== sequence) return;
    if (data) {
      nodes.forEach(node => render(node, data.labels[node.dataset.connectorI18n], data.player));
      document.title = data.labels.page_title;
    } else {
      nodes.forEach((node,index) => node.replaceChildren(...english[index].map(child => child.cloneNode(true))));
      document.title = englishTitle;
    }
    const base = 'https://github.com/ShadowsLunarfox/Lunar-Start-Page/blob/main/';
    document.querySelectorAll('[data-legal-document]').forEach(link => {
      const name = link.dataset.legalDocument === 'terms' ? 'TERMS' : 'PRIVACY';
      link.href = base + (language === 'en' ? `${name}.md` : `docs/legal/${name}.${language}.md`);
    });
    document.documentElement.lang = language;
    select.value = language;
    const url = new URL(location.href); url.searchParams.set('lang', language);
    try { history.replaceState(null, '', url); } catch { /* History is optional. */ }
    document.documentElement.setAttribute('aria-busy', 'false');
  }

  select.addEventListener('change', () => { void localize(select.value); });
  void localize(preferredLanguage());
}());
