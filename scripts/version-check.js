// Run only on the isolated preview origin, never against installed extension storage.
(async () => {
  const keys = ['lunarInterfaceVersion', 'customHomeState', 'customHomeStateLegacy'];
  const saved = new Map(keys.map(key => [key, localStorage.getItem(key)]));
  const sharedKeys = () => Object.keys(localStorage).filter(key => key.startsWith('lunarShared:v1:'));
  const savedShared = new Map(sharedKeys().map(key => [key, localStorage.getItem(key)]));
  const results = [];
  let frame;
  let peer;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = async predicate => {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('Interface did not initialize');
  };
  const stylesReady = () => [...frame.contentDocument.querySelectorAll('link[rel="stylesheet"]')].every(link => !link.getAttribute('href') || link.sheet);
  const ready = async version => {
    await wait(() => frame.contentDocument?.documentElement?.dataset.interfaceVersion === version && frame.contentDocument.body?.classList.contains('app-ready'));
    await wait(stylesReady);
  };
  const record = name => {
    results.push({ scenario: name, passed: true });
    const li = document.createElement('li');
    li.textContent = `PASS: ${name}`;
    document.getElementById('results').append(li);
  };
  const open = async version => {
    frame?.remove();
    frame = document.createElement('iframe');
    frame.src = `../newtab.html?version-check=${Date.now()}`;
    document.body.append(frame);
    await ready(version);
  };
  const assertIsolated = () => {
    const page = frame.contentDocument;
    const win = frame.contentWindow;
    assert(win.location.pathname.endsWith('/legacy/home.html'), 'Legacy entry loaded the wrong page');
    assert(!page.querySelector('.start-area, .workspace-controls, [data-settings-page]'), 'Modern interface HTML appeared in legacy mode');
    assert(page.getElementById('theme-style'), 'Original legacy theme controls are missing');
    const resources = win.performance.getEntriesByType('resource').map(entry => new URL(entry.name)).filter(url => url.origin === location.origin);
    assert(resources.some(url => url.pathname.endsWith('/legacy/script/08-app.js')), 'Legacy app was not initialized');
    const allowed = url => url.pathname.startsWith('/legacy/') || /^\/resource\/icons\/.*\.(?:png|ico|svg)$/.test(url.pathname) || /^\/themes\/wallpaper\/.*\.(?:jpg|jpeg|png|webp|gif|mp4)$/.test(url.pathname);
    assert(!resources.some(url => url.pathname.startsWith('/legacy/resource/')), 'Legacy mode loaded outdated bundled icons');
    assert(resources.every(allowed), `Legacy mode requested modern interface code: ${resources.filter(url => !allowed(url)).map(url => url.pathname).join(', ')}`);
  };
  const assertSharedMedia = async () => {
    const page = frame.contentDocument;
    const win = frame.contentWindow;
    const imageLoads = async source => {
      const image = new win.Image();
      image.src = source;
      await wait(() => image.complete && image.naturalWidth > 0);
    };
    assert(new URL(page.querySelector('link[rel="icon"]').href).pathname === '/resource/icons/lunar-v2-32.png', 'Legacy favicon did not use the current icon');
    await imageLoads(page.querySelector('link[rel="icon"]').href);
    const engineIcon = page.querySelector('.custom-select-engine-icon');
    assert(new URL(engineIcon.src).pathname.startsWith('/resource/icons/logo/'), 'Search-engine icon did not use the shared resource');
    await imageLoads(engineIcon.src);
    const initialWallpaper = page.documentElement.style.getPropertyValue('--initial-wallpaper-image');
    assert(initialWallpaper.includes('../themes/wallpaper/'), 'First paint still points at legacy wallpaper files');
    page.getElementById('open-settings').click();
    for (const key of ['wallpaper_1', 'wallpaper_2', 'wallpaper_3']) {
      const button = page.querySelector(`[data-preset="${key}"]`);
      const source = button.style.backgroundImage.match(/url\("([^"]+)"\)/)?.[1];
      assert(source && new URL(source, win.location.href).pathname.startsWith('/themes/wallpaper/'), 'Wallpaper preview did not use the shared file');
      await imageLoads(new URL(source, win.location.href).href);
    }
    page.querySelector('[data-preset="komainu_desktop"]').click();
    const video = page.querySelector('.background-video');
    await wait(() => video.readyState >= 2);
    assert(new URL(video.currentSrc).pathname === '/themes/wallpaper/Mp4/Komainu_Desktop.mp4', 'Video wallpaper did not use the current video');
    page.querySelector('[data-preset="wallpaper_2"]').click();
    await wait(() => page.querySelector('.background-layer').style.backgroundImage.includes('../themes/wallpaper/'));
    page.getElementById('settings-dialog').close();
    assertIsolated();
  };
  const choose = async next => {
    const page = frame.contentDocument;
    page.getElementById('open-settings').click();
    frame.contentWindow.activateSettingsPage?.('appearance');
    const select = page.getElementById('interface-version');
    assert(select.value !== next, 'Version selector did not reflect its current page');
    const shell = select.nextElementSibling;
    shell.querySelector('.custom-select-button').click();
    const option = shell.querySelector(`[role="option"][data-value="${next}"]`);
    assert(option, 'Version dropdown option is missing');
    option.click();
    await ready(next);
  };
  const assertSharedQuickSave = async (modernWin, legacyWin) => {
    // Use the real producer and both real import/render paths over an isolated storage boundary.
    const records = {};
    const listeners = new Map();
    const paused = new Set();
    const originals = new Map();
    const originalWorkerSet = window.extensionStorageSet;
    const preference = localStorage.getItem('lunarInterfaceVersion');
    const emit = changes => Promise.resolve().then(() => listeners.forEach((listener, win) => { if (!paused.has(win)) listener(changes, 'local'); }));
    const get = async keys => structuredClone(keys === null ? records : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in records).map(key => [key, records[key]])));
    const set = async values => {
      Object.assign(records, structuredClone(values));
      await emit(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])));
    };
    const remove = async keys => {
      const changes = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (!(key in records)) continue;
        changes[key] = { oldValue: records[key] };
        delete records[key];
      }
      if (Object.keys(changes).length) await emit(changes);
    };
    const appeared = (win, id) => Boolean(win.document.querySelector(`.shortcut-card[data-id="${id}"]`));
    const makeLink = id => ({ id, name: `Shared right-click ${id}`, url: `https://quick-save.example/${id}`, pinned: false });
    try {
      for (const win of [modernWin, legacyWin]) {
        const fns = { canUseExtensionStorage: () => true, extensionStorageGet: get, extensionStorageSet: set, extensionStorageRemove: remove, addExtensionStorageChangeListener: listener => listeners.set(win, listener) };
        originals.set(win, Object.fromEntries(Object.keys(fns).map(key => [key, win[key]])));
        Object.assign(win, fns);
        win.bindPendingLinkSync();
      }
      window.extensionStorageSet = set;
      localStorage.setItem('lunarInterfaceVersion', 'legacy');
      await window.queueSavedLink(makeLink('saved-from-legacy'));
      await wait(() => appeared(modernWin, 'saved-from-legacy') && appeared(legacyWin, 'saved-from-legacy'));
      localStorage.setItem('lunarInterfaceVersion', 'modern');
      await Promise.all(['saved-from-modern', 'rapid-one', 'rapid-two'].map(id => window.queueSavedLink(makeLink(id))));
      await wait(() => ['saved-from-modern', 'rapid-one', 'rapid-two'].every(id => appeared(modernWin, id) && appeared(legacyWin, id)));
      await window.queueSavedLink({ ...makeLink('duplicate-save'), url: 'https://quick-save.example/saved-from-modern' });
      await wait(() => !records['pendingSavedLink:duplicate-save'] && !records['legacy:pendingSavedLink:duplicate-save']);
      for (const win of [modernWin, legacyWin]) assert(win.eval('state.links.filter(link => link.url === "https://quick-save.example/saved-from-modern").length') === 1, 'Repeated right-click saves created duplicates');
      paused.add(legacyWin);
      await window.queueSavedLink(makeLink('saved-while-legacy-closed'));
      await wait(() => appeared(modernWin, 'saved-while-legacy-closed') && !records['pendingSavedLink:saved-while-legacy-closed']);
      assert(records['legacy:pendingSavedLink:saved-while-legacy-closed'], 'The unopened interface lost its delivery');
      paused.delete(legacyWin);
      await legacyWin.importPendingSavedLinks();
      await wait(() => appeared(legacyWin, 'saved-while-legacy-closed'));
      await wait(() => [modernWin, legacyWin].every(win => win.eval('pendingLinkImport === null')));
      assert(modernWin.eval('state.links.some(link => link.id === "legacy-concurrent")'), 'Legacy manual bookmarks did not synchronize');
      assert(legacyWin.eval('state.links.some(link => link.id === "modern-concurrent")'), 'Modern manual bookmarks did not synchronize');
      assert(modernWin.eval('state.settings.radius') === 26 && legacyWin.eval('state.settings.radius') === 26, 'Shared preferences diverged during quick saves');
    } finally {
      listeners.clear();
      for (const [win, functions] of originals) Object.assign(win, functions);
      window.extensionStorageSet = originalWorkerSet;
      if (preference === null) localStorage.removeItem('lunarInterfaceVersion');
      else localStorage.setItem('lunarInterfaceVersion', preference);
    }
  };
  try {
    keys.forEach(key => localStorage.removeItem(key));
    sharedKeys().forEach(key => localStorage.removeItem(key));
    const sample = {
      version: 3, language: 'zh-CN', layout: 'list', searchEngine: 'bing', searchHistory: ['saved search'],
      links: [{ id: 'existing-bookmark', name: 'Existing bookmark', url: 'https://example.com/', pinned: true, icon: 'resource/icons/lunar-v2-32.png' }],
      background: { type: 'preset', value: 'wallpaper_2', selectedByUser: true, name: '' },
      settings: { interfaceLayoutVersion: 2, theme: 'light', radius: 18, cardHeight: 96 }
    };
    localStorage.setItem('customHomeState', JSON.stringify(sample));
    await open('modern');
    assert(frame.contentDocument.querySelector('.start-area'), 'Default mode is not the modern interface');
    record('A fresh profile opens the modern interface');
    await choose('legacy');
    assert(localStorage.getItem('lunarInterfaceVersion') === 'legacy', 'Legacy choice was not saved');
    assertIsolated();
    const legacyPage = frame.contentDocument;
    assert(legacyPage.querySelector('.shortcut-title').textContent === 'Existing bookmark', 'Existing bookmarks did not carry over');
    assert(frame.contentWindow.eval('state.settings.cardHeight') === 192, 'Legacy card height did not adapt the shared compact height');
    record('The settings dropdown switches to the original legacy interface and keeps bookmarks');
    await assertSharedMedia();
    record('Legacy uses current icons, image previews, first-paint wallpaper, and a playable shared video');
    if (new URLSearchParams(location.search).has('preview')) {
      legacyPage.getElementById('open-settings').click();
      legacyPage.getElementById('interface-version').closest('.settings-subsection').scrollIntoView({ block: 'center' });
      frame.style.opacity = '1';
      await new Promise(() => {});
    }

    // Persist a legacy theme and bookmark through the actual legacy handlers.
    frame.contentWindow.updateSetting('themeStyle', 'win98');
    await wait(stylesReady);
    frame.contentWindow.eval('state.links.push({id:"legacy-bookmark",name:"Added in legacy",url:"https://example.org/",pinned:false}); saveState();');
    for (let index = 0; index < 2; index++) {
      await open('legacy');
      assertIsolated();
      assert(frame.contentDocument.body.dataset.themeStyle === 'win98', 'Legacy theme was not retained on a new tab');
      assert(JSON.parse(localStorage.getItem('customHomeStateLegacy')).links.length === 2, 'Legacy bookmark was not retained');
      assert(frame.contentDocument.body.dataset.wallpaperPreset === 'wallpaper_2', 'Shared wallpaper choice was not retained');
      assert(frame.contentDocument.documentElement.style.getPropertyValue('--initial-wallpaper-image').includes('../themes/wallpaper/'), 'A new legacy tab no longer uses the shared wallpaper at first paint');
    }
    record('Repeated new tabs retain legacy code, current wallpaper assets, theme, and saved bookmarks');
    await choose('modern');
    const modernState = JSON.parse(localStorage.getItem('customHomeState'));
    assert(modernState.links.length === 2, 'Manual bookmarks were not synchronized');
    assert(modernState.settings.radius === 18 && modernState.settings.theme === 'light', 'Returning to modern mode lost its appearance');
    assert(localStorage.getItem('lunarInterfaceVersion') === 'modern', 'Modern choice was not saved');
    await open('modern');
    assert(frame.contentDocument.querySelector('.start-area'), 'A new tab did not retain modern mode');
    record('Switching versions retains shared bookmarks and each version’s own theme');
    await choose('legacy');
    assertIsolated();
    assert(frame.contentDocument.body.dataset.themeStyle === 'win98', 'Switching back to legacy lost its old theme');
    await wait(() => frame.contentDocument.documentElement.lang.startsWith('zh'));
    record('Legacy appearance survives a round trip and the selector is translated');

    // Keep both actual interfaces open while editing, switching, and maintaining their stores.
    peer = document.createElement('iframe');
    peer.src = '../home.html';
    document.body.append(peer);
    await wait(() => peer.contentDocument?.body?.classList.contains('app-ready'));
    const modernWin = peer.contentWindow;
    const legacyWin = frame.contentWindow;
    modernWin.eval('state.links.find(link=>link.id==="existing-bookmark").name="Renamed in modern"; state.links.push({id:"modern-concurrent",name:"Modern concurrent edit",url:"https://modern.example/",pinned:false}); saveState();');
    legacyWin.eval('state.links.find(link=>link.id==="existing-bookmark").pinned=false; state.links.push({id:"legacy-concurrent",name:"Legacy concurrent edit",url:"https://legacy.example/",pinned:false}); saveState();');
    await wait(() => [modernWin, legacyWin].every(win => win.eval('state.links.some(link=>link.id==="modern-concurrent") && state.links.some(link=>link.id==="legacy-concurrent") && state.links.find(link=>link.id==="existing-bookmark").name==="Renamed in modern" && !state.links.find(link=>link.id==="existing-bookmark").pinned')));
    record('Concurrent bookmark additions, renaming, and pin changes merge in both live interfaces');

    modernWin.updateSetting('clockStyle', 'analog');
    modernWin.updateSetting('radius', 26);
    modernWin.updateSetting('fontScale', 110);
    modernWin.updateSetting('columns', 4);
    modernWin.updateSetting('cardHeight', 112);
    modernWin.flushPendingSettingChanges();
    await wait(() => legacyWin.eval('state.settings.clockStyle==="analog" && state.settings.radius===26 && state.settings.fontScale===110 && state.settings.columns===4 && state.settings.cardHeight===224'));
    modernWin.document.getElementById('language-select').value = 'ja';
    await modernWin.handleLanguageChange();
    await wait(() => legacyWin.document.documentElement.lang.startsWith('ja'));
    legacyWin.eval('state.searchEngine="duckduckgo"; state.layout="list"; state.settings.panelDesiredPositions.clock={x:35,y:70}; state.settings.panelScales.clock=1.1; persistAndRender();');
    await wait(() => modernWin.eval('state.searchEngine==="duckduckgo" && state.layout==="list" && state.settings.panelDesiredPositions.clock.x===35 && state.settings.panelScales.clock===1.1'));
    assert(modernWin.eval('state.settings.theme') === 'light' && legacyWin.eval('state.settings.theme') === 'dark', 'Shared preferences overwrote independent display modes');
    assert(legacyWin.document.body.dataset.themeStyle === 'win98', 'Shared preferences overwrote the legacy skin');
    record('Language, search, clock, density, adapted card sizes, and desired layout synchronize while themes stay local');

    modernWin.document.querySelector('.shortcut-card[data-id="legacy-bookmark"] [data-action="delete"]').click();
    await wait(() => !legacyWin.eval('state.links.some(link=>link.id==="legacy-bookmark")'));
    modernWin.eval('state.links=state.links.map(link=>({...link,pinned:false})).reverse(); persistAndRender();');
    await wait(() => JSON.stringify(modernWin.eval('state.links.map(link=>link.id)')) === JSON.stringify(legacyWin.eval('state.links.map(link=>link.id)')));
    record('Deleting a bookmark and reordering the collection updates both interfaces');
    await assertSharedQuickSave(modernWin, legacyWin);
    record('Right-click saves reach both versions and remain queued for an unopened version without duplicates');

    // Uploads and selections share one asset store and refresh without changing either theme.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK/0AAAAASUVORK5CYII=';
    const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    await modernWin.setStoredBackgroundImage(png);
    modernWin.eval('state.background={type:"image",value:CHROME_BACKGROUND_VALUE,mediaType:"image",name:"Shared upload"}; persistAndRender();');
    await wait(() => legacyWin.eval('state.background.type==="image" && state.background.name==="Shared upload"'));
    assert(await legacyWin.getStoredBackgroundImageForExport() === png, 'The uploaded wallpaper did not reach the legacy interface');
    await legacyWin.setStoredBackgroundImage(gif);
    legacyWin.persistAndRender();
    await wait(async () => await modernWin.getStoredBackgroundImageForExport() === gif);
    await legacyWin.applyPresetBackground('wallpaper_3');
    await wait(() => modernWin.document.body.dataset.wallpaperPreset === 'wallpaper_3');
    assert(modernWin.eval('state.settings.theme') === 'light' && legacyWin.eval('state.settings.themeStyle') === 'win98', 'Wallpaper synchronization changed a theme');
    record('Custom uploads, replacement images, and wallpaper selections update both versions without theme changes');

    const currentLegacy = JSON.parse(localStorage.getItem('customHomeStateLegacy'));
    currentLegacy.links.push({id:'imported-shared',name:'Imported bookmark',url:'https://imported.example/',pinned:false});
    currentLegacy.settings.clockStyle = 'calendar';
    currentLegacy.settings.themeStyle = 'terminal';
    const legacySnapshot = legacyWin.getLocalStorageSnapshot();
    assert(!('customHomeState' in legacySnapshot) && !('lunarInterfaceVersion' in legacySnapshot), 'Legacy backup contains the other interface');
    legacyWin.confirm = () => true;
    await legacyWin.importDebugBackup({ state: currentLegacy, localStorage: { customHomeStateLegacy: JSON.stringify(currentLegacy), customHomeState: 'should never be written', lunarInterfaceVersion: 'modern' } });
    await wait(() => modernWin.eval('state.links.some(link=>link.id==="imported-shared") && state.settings.clockStyle==="calendar"'));
    assert(modernWin.eval('state.settings.theme') === 'light', 'Importing shared data overwrote the other theme');
    assert(localStorage.getItem('lunarInterfaceVersion') === 'legacy', 'Importing legacy backup changed the selected interface');
    legacyWin.clearInterfaceLocalStorage();
    await open('legacy');
    assert(frame.contentWindow.eval('state.links.some(link=>link.id==="imported-shared") && state.settings.clockStyle==="calendar"'), 'Clearing a local cache removed shared user data');
    assert(frame.contentDocument.body.dataset.themeStyle === 'default', 'Clearing the legacy theme cache did not restore its default skin');
    assert(modernWin.eval('state.settings.theme') === 'light', 'Clearing legacy data changed the modern theme');
    assert(localStorage.getItem('lunarInterfaceVersion') === 'legacy', 'Clearing legacy data changed the selected interface');
    record('Backup imports synchronize user data, preserve the other theme, and survive local cache cleanup');
  } catch (error) {
    results.push({ scenario: 'Interface version switching', passed: false, error: error.message });
    const li = document.createElement('li');
    li.className = 'fail';
    li.textContent = error.message;
    document.getElementById('results').append(li);
  } finally {
    frame?.remove();
    peer?.remove();
    sharedKeys().forEach(key => localStorage.removeItem(key));
    for (const [key, value] of savedShared) localStorage.setItem(key, value);
    for (const [key, value] of saved) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    const passed = results.filter(result => result.passed).length;
    document.getElementById('summary').textContent = `${passed}/${results.length} passed`;
    await fetch('/__viewport-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passed, total: results.length, results }) });
  }
})();
