import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const exists = file => fs.existsSync(path.join(root, file));
const html = read('home.html');
assert(!html.includes('class="app-header"'), 'The top navigation bar must be removed');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');

// Catch mismatched nesting before a browser silently reparents controls.
const stack = [];
const voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
for (const match of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
  const [tag, closing, rawName] = match;
  const name = rawName.toLowerCase();
  if (closing) assert.equal(stack.pop(), name, `Unbalanced HTML at ${tag}`);
  else if (!voids.has(name) && !tag.endsWith('/>')) stack.push(name);
}
assert.equal(stack.length, 0, 'All HTML elements must close');

// Every existing DOM binding, settings panel, and local asset must remain reachable.
for (const source of ['script/08-app.js', 'script/05-workspace.js']) {
  for (const [, id] of read(source).matchAll(/getElementById\("([^"]+)"\)/g)) {
    assert(ids.includes(id), `Missing interface control: ${id}`);
  }
}
const tabs = [...html.matchAll(/data-settings-target="([^"]+)"/g)].map(match => match[1]);
assert.equal(tabs.length, 4);
for (const key of tabs) {
  assert(html.includes(`id="settings-page-${key}"`));
  assert(html.includes(`aria-labelledby="settings-tab-${key}"`));
}
for (const key of ['overview', 'storage', 'testing']) {
  assert(html.includes(`data-debug-target="${key}"`));
  assert(html.includes(`id="debug-page-${key}"`));
  assert(html.includes(`aria-labelledby="debug-tab-${key}"`));
}
for (const [, asset] of html.matchAll(/(?:src|href)="((?:script|styles|resource)\/[^"?#]+)"/g)) {
  assert(exists(asset), `Missing asset: ${asset}`);
}
for (const [, asset] of read('styles.css').matchAll(/@import url\("([^"]+)"\)/g)) assert(exists(asset), `Missing stylesheet: ${asset}`);
for (const file of fs.readdirSync(path.join(root, 'script')).filter(file => file.endsWith('.js'))) {
  new vm.Script(read(`script/${file}`), { filename: file });
}
for (const [, source] of read('script/script-loader.js').matchAll(/"(script\/[^"\n]+\.js)"/g)) assert(exists(source));

const en = JSON.parse(read('data/language/en.json'));
const resolve = (data, key) => key.split('.').reduce((value, segment) => value?.[segment], data);
for (const [, key] of html.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)) {
  assert.equal(typeof resolve(en, key), 'string', `Missing English translation: ${key}`);
}
for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'th', 'ms']) {
  const data = JSON.parse(read(`data/language/${locale}.json`));
  for (const key of Object.keys(en.workspace)) assert.equal(typeof data.workspace[key], 'string', `Missing ${locale} workspace.${key}`);
  for (const key of Object.keys(en.debug_tabs)) {
    assert.equal(typeof data.debug_tabs[key], 'string', `Missing ${locale} debug_tabs.${key}`);
    assert(!/^\?+$/.test(data.debug_tabs[key]), `Invalid ${locale} debug label`);
  }
}
for (const skin of ['cartoon', 'win98', 'winxp', 'terminal']) {
  assert(!exists(`themes/theme-${skin}.css`), `Legacy skin still present: ${skin}`);
}
for (const source of ['home.html', 'script/01-config.js', 'script/05-ui.js', 'script/07-storage.js', 'script/08-app.js', 'script/prepaint.js']) {
  assert(!/THEME_STYLE_FILES|THEME_FONT_FILES|applyThemeStyle|theme-style|themeStyle/.test(read(source)), `Legacy theme wiring in ${source}`);
}

// Execute real sanitizers with legacy and current saved settings, without a browser or user storage.
const noop = () => {};
const context = vm.createContext({ console, URL, structuredClone, window: { addEventListener: noop }, document: {}, localStorage: { getItem: () => null }, navigator: { language: 'en' } });
for (const file of ['01-config', '02-utils', '04-collection', '06-i18n', '07-storage']) vm.runInContext(read(`script/${file}.js`), context);
const legacy = { themeStyle: 'winxp', theme: 'dark', accentColor: '#123456', panelColor: '#202020', clockStyle: 'analog', clockVisible: true, searchSuggestionsEnabled: false, searchUiVisible: false, shortcutsVisible: true, columns: 4, rows: 3, fontScale: 110, panelPositions: { clock: { x: 800, y: 100 }, search: { x: 20, y: 100 }, collection: { x: -200, y: 60 } }, panelScales: { clock: 1.5, search: .8, collection: 1.4 } };
context.legacy = legacy;
const migrated = JSON.parse(vm.runInContext('JSON.stringify(sanitizeSettings(legacy))', context));
assert.equal(migrated.interfaceLayoutVersion, 2);
assert(!('themeStyle' in migrated));
for (const key of ['theme', 'accentColor', 'panelColor', 'clockStyle', 'clockVisible', 'searchSuggestionsEnabled', 'searchUiVisible', 'shortcutsVisible', 'columns', 'rows', 'fontScale']) assert.equal(migrated[key], legacy[key], `Feature setting lost: ${key}`);
assert.deepEqual(migrated.panelPositions.clock, { x: 0, y: 0 });
assert.equal(migrated.panelScales.clock, 1);
const newDisplayDefaults = JSON.parse(vm.runInContext('JSON.stringify(sanitizeSettings({textColor: "#f3f6ff", panelColor: "#1c2438", accentColor: "#7dc4ff"}))', context));
assert.equal(newDisplayDefaults.textColor, '#edf2ef', 'Legacy default text must migrate for readable display-mode switching');
assert.equal(newDisplayDefaults.accentColor, '#b6d7c3');
const migratedLight = JSON.parse(vm.runInContext('JSON.stringify(sanitizeSettings({theme: "light", textColor: "#f3f6ff", panelColor: "#1c2438", dropdownColor: "#26304a", sliderTrackColor: "#33405e"}))', context));
assert.equal(migratedLight.textColor, '#25362b');
assert.equal(migratedLight.panelColor, '#ffffff', 'Legacy light text must not sit on a dark default panel');
assert.equal(migratedLight.dropdownColor, '#ffffff');
assert.equal(migratedLight.sliderTrackColor, '#dfe4dc');

// Reloading and changing themes must paint the same colors, including migrated settings.
const themeUiSource = read('script/05-ui.js');
for (const settings of [
  { theme: 'light' },
  { theme: 'dark' },
  { theme: 'light', textColor: '#f3f6ff', panelColor: '#1c2438', dropdownColor: '#26304a', accentColor: '#7dc4ff', sliderTrackColor: '#33405e', sliderFillColor: '#7dc4ff' },
  { theme: 'light', panelColor: '#1a201f', dropdownColor: '#202823' },
  { theme: 'light', interfaceLayoutVersion: 2, textColor: '#123456', panelColor: '#f0e6d2', dropdownColor: '#e8ddd2', accentColor: '#c0ffee' },
  { theme: 'dark', interfaceLayoutVersion: 2, panelColor: '#ffffff', dropdownColor: '#ffffff' }
]) {
  const properties = {};
  const body = { dataset: {}, classList: { toggle: noop } };
  const rootElement = { dataset: {}, style: { setProperty(key, value) { properties[key] = value; } } };
  const paintContext = vm.createContext({ window: {}, document: { body, documentElement: rootElement }, localStorage: { getItem: () => JSON.stringify({ settings }) } });
  vm.runInContext(read('script/prepaint.js'), paintContext);
  const initialColors = { ...properties };
  const runtimeContext = vm.createContext({
    document: { body, documentElement: rootElement },
    state: { settings: JSON.parse(vm.runInContext(`JSON.stringify(sanitizeSettings(${JSON.stringify(settings)}))`, context)) },
    clockPanelEl: { dataset: {} }, analogClockEl: { classList: { toggle: noop } }, syncClockTimer: noop
  });
  vm.runInContext(read('script/01-config.js') + '\n' + read('script/02-utils.js'), runtimeContext);
  vm.runInContext(themeUiSource.slice(themeUiSource.indexOf('function applyThemeSettings('), themeUiSource.indexOf('function runWhenIdle(')), runtimeContext);
  vm.runInContext('applyThemeSettings()', runtimeContext);
  for (const key of Object.keys(initialColors).filter(key => /accent|text|panel$|panel-strong|panel-soft|dropdown|slider/.test(key))) {
    assert.equal(properties[key], initialColors[key], `First paint and initialized theme differ at ${key}: ${JSON.stringify(settings)}`);
  }
  assert.equal(rootElement.dataset.theme, settings.theme);
  assert.equal(body.dataset.theme, settings.theme);
}
context.current = { ...legacy, interfaceLayoutVersion: 2 };
const restored = JSON.parse(vm.runInContext('JSON.stringify(sanitizeSettings(current))', context));
assert.deepEqual(restored.panelPositions.clock, legacy.panelPositions.clock, 'Newly saved dragging must persist');
assert.equal(restored.panelScales.clock, 1.5, 'Newly saved resizing must persist');
const compactMigration = JSON.parse(vm.runInContext('JSON.stringify(sanitizeSettings({interfaceLayoutVersion: 1, cardHeight: 280, cardGap: 16, rows: 5, columns: 4, panelScales: {collection: 1.8}}))', context));
assert.equal(compactMigration.cardHeight, 112, 'Old oversized cards must migrate to a compact height');
assert.equal(compactMigration.cardGap, 12);
assert.equal(compactMigration.rows, 5);
assert.equal(compactMigration.columns, 4);
assert.equal(compactMigration.panelScales.collection, 1);
assert.equal(vm.runInContext('sanitizeSettings({interfaceLayoutVersion: 2, cardHeight: 112}).cardHeight', context), 112, 'New compact card customization must persist');
context.sampleState = { language: 'zh-CN', layout: 'list', searchEngine: 'bing', links: [{ id: 'kept-link', name: 'My saved site', url: 'https://example.com/', pinned: true, icon: 'https://example.com/favicon.ico' }], settings: legacy, background: { type: 'preset', value: 'wallpaper_2', selectedByUser: true } };
const retained = JSON.parse(vm.runInContext('JSON.stringify(sanitizeState(sampleState))', context));
assert.equal(retained.links[0].id, 'kept-link');
assert.equal(retained.links[0].name, 'My saved site');
assert.equal(retained.background.value, 'wallpaper_2');
assert.equal(retained.layout, 'list');
assert.equal(retained.searchEngine, 'bing');
assert.equal(retained.language, 'zh-CN');

// Continuous settings input updates state immediately but writes only once per frame.
const animationFrames = new Map();
let nextFrame = 1;
let settingsSaves = 0;
let settingsFits = 0;
context.window.requestAnimationFrame = handler => { const id = nextFrame++; animationFrames.set(id, handler); return id; };
context.window.cancelAnimationFrame = id => animationFrames.delete(id);
context.state = { settings: structuredClone(restored), links: [] };
context.saveState = () => { settingsSaves++; };
context.applyThemeSettings = noop;
context.applyGridSettings = noop;
context.renderSettingsPanelIfReady = noop;
context.schedulePanelNormalization = () => { settingsFits++; };
vm.runInContext('updateSetting("fontScale", 108); updateSetting("radius", 18); updateSetting("accentColor", "#abcdef")', context);
assert.equal(context.state.settings.fontScale, 108);
assert.equal(context.state.settings.radius, 18);
assert.equal(settingsSaves, 0);
assert.equal(animationFrames.size, 1);
[...animationFrames.values()][0]();
assert.equal(settingsSaves, 1);
assert.equal(settingsFits, 1);
vm.runInContext('updateSetting("panelOpacity", 90); flushPendingSettingChanges()', context);
assert.equal(settingsSaves, 2, 'A pagehide flush must retain the final setting');
assert.equal(animationFrames.size, 0);

context.refreshBackgroundVideoAfterThemeChange = noop;
context.state.settings = JSON.parse(vm.runInContext('JSON.stringify(sanitizeSettings())', context));
for (const theme of ['light', 'dark', 'light']) {
  vm.runInContext(`updateSetting("theme", "${theme}"); flushPendingSettingChanges()`, context);
  assert.equal(context.state.settings.textColor, theme === 'light' ? '#25362b' : '#edf2ef');
  assert.equal(context.state.settings.panelColor, theme === 'light' ? '#ffffff' : '#1a201f');
  assert.equal(context.state.settings.dropdownColor, theme === 'light' ? '#ffffff' : '#202823');
}
vm.runInContext('updateSetting("textColor", "#123456"); updateSetting("panelColor", "#f0e6d2"); updateSetting("theme", "dark"); flushPendingSettingChanges()', context);
assert.equal(context.state.settings.textColor, '#123456', 'Changing modes must preserve custom text colors');
assert.equal(context.state.settings.panelColor, '#f0e6d2', 'Changing modes must preserve custom panel colors');
vm.runInContext('updateSetting("panelColor", "#ffffff"); flushPendingSettingChanges()', context);
assert.equal(context.state.settings.panelColor, '#ffffff', 'Choosing a white custom panel in dark mode must remain possible');

// Exercise the actual category navigation and toolbar handlers with a small DOM boundary.
const element = dataset => ({ dataset, attributes: {}, events: {}, tabIndex: -1, hidden: false, setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(key, handler) { this.events[key] = handler; }, focus() { this.focused = true; } });
const tabNodes = tabs.map(key => element({ settingsTarget: key }));
const pages = tabs.map(key => element({ settingsPage: key }));
const layouts = ['grid', 'list'].map(key => element({ workspaceLayout: key }));
const navigation = element({});
const content = { scrollTop: 100 };
const add = element({});
const count = element({});
const filter = element({});
filter.value = '';
const layoutActions = ['toggle', 'done', 'reset', 'edit-from-settings'].map(action => element({ layoutAction: action }));
const toolbar = element({});
toolbar.hidden = true;
const bodyClasses = new Set();
const media = { matches: false, addEventListener(key, handler) { this.listener = handler; } };
context.window.matchMedia = () => media;
context.document = {
  addEventListener: noop,
  body: { classList: { contains: name => bodyClasses.has(name), toggle(name, value) { if (value) bodyClasses.add(name); else bodyClasses.delete(name); } } },
  querySelectorAll(selector) {
    if (selector === '[data-layout-action="toggle"]') return [layoutActions[0]];
    return ({ '[data-settings-target]': tabNodes, '[data-settings-page]': pages, '[data-workspace-layout]': layouts, '[data-layout-action]': layoutActions })[selector] || [];
  },
  querySelector(selector) {
    if (selector === '.settings-nav') return navigation;
    if (selector === '.settings-content') return content;
    if (selector === '[data-layout-toolbar]') return toolbar;
    return pages.find(page => selector === `[data-settings-page="${page.dataset.settingsPage}"]`) || null;
  },
  getElementById(id) { return id === 'workspace-add-link' ? add : id === 'collection-count' ? count : id === 'bookmark-filter' ? filter : null; }
};
context.activeCustomSelect = null;
context.syncCustomRanges = noop;
context.state = { layout: 'grid', settings: structuredClone(restored), links: [{name: 'GitHub', url: 'https://github.com'}, {name: 'Google', url: 'https://google.com'}] };
context.setLayout = layout => { context.state.layout = layout; };
context.openLinkDialog = () => { context.addInvoked = true; };
context.t = (key, vars) => `${vars.count} shortcuts`;
context.endPanelDrag = noop;
context.endPanelResize = noop;
context.renderPanelPositions = noop;
context.closeDialog = id => { context.closedDialog = id; };
context.renderCollection = noop;
context.collectionGridEl = { scrollTop: 25 };
vm.runInContext(read('script/05-workspace.js'), context);
vm.runInContext('initializeWorkspaceInterface()', context);
tabNodes[1].events.click();
assert.equal(tabNodes[1].attributes['aria-selected'], 'true');
assert.equal(tabNodes[0].attributes['aria-selected'], 'false');
assert.equal(pages.filter(page => !page.hidden).length, 1);
assert.equal(pages[1].hidden, false);
assert.equal(content.scrollTop, 0);
tabNodes[1].events.keydown({ key: 'End', preventDefault: noop });
assert.equal(tabNodes.at(-1).focused, true);
assert.equal(pages.at(-1).hidden, false);
media.matches = true; media.listener();
assert.equal(navigation.attributes['aria-orientation'], 'horizontal');
layouts[1].events.click();
vm.runInContext('syncWorkspaceLayout()', context);
assert.equal(context.state.layout, 'list');
assert.equal(layouts[1].attributes['aria-pressed'], 'true');
add.events.click();
assert.equal(context.addInvoked, true);
layoutActions[0].events.click();
assert(bodyClasses.has('layout-editing'));
assert.equal(toolbar.hidden, false);
assert.equal(layoutActions[0].attributes['aria-pressed'], 'true');
layoutActions[1].events.click();
assert(!bodyClasses.has('layout-editing'));
assert.equal(toolbar.hidden, true);
layoutActions[3].events.click();
assert.equal(context.closedDialog, 'settings-dialog');
assert(bodyClasses.has('layout-editing'));
layoutActions[2].events.click();
assert.equal(context.state.settings.panelPositions.clock.x, 0);
assert.equal(context.state.settings.panelScales.clock, 1);
assert.equal(context.state.settings.accentColor, restored.accentColor);
assert.equal(context.state.links.length, 2, 'Resetting layout must preserve shortcuts');
filter.value = 'GITHUB';
filter.events.input();
assert.equal(vm.runInContext('getFilteredLinks().length', context), 1);
assert.equal(context.collectionGridEl.scrollTop, 0);
filter.events.keydown({key: 'Escape', preventDefault: noop});
assert.equal(filter.value, '');
assert.equal(vm.runInContext('getFilteredLinks().length', context), 2);
context.state.links = Array.from({length: 12}, () => ({}));
vm.runInContext('syncWorkspaceCollectionCount(12)', context);
assert.equal(count.textContent, '12');
assert.equal(count.attributes['aria-label'], '12 shortcuts');

// Clicking or keyboard-activating a child must not be mistaken for a backdrop click at (0, 0).
let closedFromBackdrop = 0;
const dialog = { dataset: {}, addEventListener(name, listener) { this[name] = listener; }, getBoundingClientRect: () => ({left: 100, top: 100, right: 600, bottom: 600}), close() { closedFromBackdrop++; } };
context.bindDialogBackdropClose(dialog);
dialog.click({target: {}, clientX: 0, clientY: 0});
assert.equal(closedFromBackdrop, 0);
dialog.click({target: dialog, clientX: 150, clientY: 150});
assert.equal(closedFromBackdrop, 0);
dialog.click({target: dialog, clientX: 0, clientY: 0});
assert.equal(closedFromBackdrop, 1);

// Rejected clipboard permissions must still allow copying from within an active modal.
const appSource = read('script/08-app.js');
let fallbackCopies = 0;
let removedTextareas = 0;
let restoredFocus = 0;
let selectedText = '';
const copyHost = { appendChild(node) { node.host = this; } };
const clipboardContext = vm.createContext({
  navigator: { clipboard: { writeText: async () => { throw new Error('Permission denied'); } } },
  document: {
    activeElement: { focus() { restoredFocus++; } },
    querySelector: () => copyHost,
    body: { appendChild() { assert.fail('The page behind a modal cannot receive copy focus'); } },
    createElement: () => ({ style: {}, setAttribute() {}, focus() { assert.equal(this.host, copyHost); }, select() { selectedText = this.value; }, remove() { removedTextareas++; } }),
    execCommand(command) { assert.equal(command, 'copy'); fallbackCopies++; return true; }
  }
});
vm.runInContext(appSource.slice(appSource.indexOf('async function copyTextToClipboard('), appSource.indexOf('function clearCompatibilityAcknowledgementsFromDebug(')), clipboardContext);
await clipboardContext.copyTextToClipboard('Diagnostic report');
assert.equal(selectedText, 'Diagnostic report');
assert.equal(fallbackCopies, 1);
assert.equal(removedTextareas, 1);
assert.equal(restoredFocus, 1);
clipboardContext.navigator.clipboard.writeText = async () => {};
await clipboardContext.copyTextToClipboard('Direct copy');
assert.equal(fallbackCopies, 1, 'Available clipboard API should avoid the fallback');
clipboardContext.navigator.clipboard = null;
clipboardContext.document.execCommand = () => false;
await assert.rejects(clipboardContext.copyTextToClipboard('Blocked copy'), /Fallback copy failed/);
assert.equal(removedTextareas, 2, 'Failed copies must remove the temporary textarea');
assert.equal(restoredFocus, 2, 'Failed copies must restore keyboard focus');

const debugNotice = { dataset: {}, textContent: '', hidden: true };
const noticeContext = vm.createContext({ document: { querySelector: () => debugNotice }, appNoticesEl: null });
const uiSource = read('script/05-ui.js');
vm.runInContext(uiSource.slice(uiSource.indexOf('function showInlineNotice(')), noticeContext);
noticeContext.showInlineNotice('Diagnostics copied', 'info');
assert.equal(debugNotice.textContent, 'Diagnostics copied');
assert.equal(debugNotice.hidden, false, 'Action feedback must be visible inside the modal');
noticeContext.showInlineNotice('Copy failed', 'error');
assert.equal(debugNotice.dataset.tone, 'error');

console.log(`PASS: ${ids.length} controls, settings and debug categories, JavaScript syntax, six locales, saved-data and light-theme migration, first-paint color consistency, theme switching and custom colors, batched settings persistence, layout edit/reset, bookmark filtering, modal action feedback, and clipboard recovery.`);
