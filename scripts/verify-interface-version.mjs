import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const router = read('script/newtab-router.js');
const controller = read('script/interface-version.js');
assert.equal(controller, read('legacy/script/interface-version.js'), 'The version controller must be the same in both interfaces');
assert.equal(JSON.parse(read('manifest.json')).chrome_url_overrides.newtab, 'newtab.html');
// A fresh asset URL replaces the former favicon cache for the entry, both interfaces, and errors.
for (const file of ['newtab.html', 'home.html', 'unsupported.html', 'legacy/home.html', 'legacy/unsupported.html']) {
  const favicon = read(file).match(/<link\b[^>]*rel="icon"[^>]*href="([^"]+)"/)?.[1];
  assert(favicon, `Missing tab icon: ${file}`);
  assert.equal(path.resolve(root, path.dirname(file), favicon), path.join(root, 'resource/icons/lunar-v2-32.png'), `Old tab icon reference: ${file}`);
}
const manifest = JSON.parse(read('manifest.json'));
for (const [size, asset] of Object.entries({ ...manifest.icons, ...manifest.action.default_icon })) {
  assert.equal(asset, `resource/icons/lunar-v2-${size}.png`);
  const png = fs.readFileSync(path.join(root, asset));
  assert.equal(png.readUInt32BE(16), Number(size), 'Extension icon has the wrong width');
  assert.equal(png.readUInt32BE(20), Number(size), 'Extension icon has the wrong height');
  assert(!fs.existsSync(path.join(root, `resource/icons/lunar-${size}.png`)), 'Retired icon files must not remain in the package');
}
const entry = read('newtab.html');
assert(!/stylesheet|src="(?:legacy\/)?home\.html"/.test(entry), 'The entry must not preload either interface');
assert(entry.includes('newtab-router.js" defer'), 'Mount after the host document is ready');
function mount(preference, blocked=false) {
  const frames=[];
  vm.runInNewContext(router, {
    localStorage:{getItem(){if(blocked)throw new Error('Blocked');return preference;}},
    document:{createElement(name){assert.equal(name,'iframe');return{setAttribute(){}};},body:{appendChild(frame){frames.push(frame);}}},
    window:{location:{replace(){throw new Error('New Tab must not navigate to the extension URL');}}}
  });
  assert.equal(frames.length,1,'Only one selected interface may load');
  assert.equal(frames[0].id,'lunar-start-frame');return frames[0].src;
}
for (const preference of [null, 'modern', 'legacy', 'invalid']) {
  assert.equal(mount(preference), preference === 'legacy' ? 'legacy/home.html' : 'home.html');
}
assert.equal(mount(null,true), 'home.html');
const shell={location:{origin:'chrome-extension://fixture',pathname:'/newtab.html'},document:{getElementById:()=>({contentWindow:child})}};
const child={parent:shell,location:{origin:'chrome-extension://fixture'}};
const navigation=vm.createContext({window:child});vm.runInContext(read('script/newtab-navigation.js'),navigation);
assert.equal(vm.runInContext('getHomepageNavigationTarget()',navigation),shell);
shell.location.pathname='/unrelated.html';assert.equal(vm.runInContext('getHomepageNavigationTarget()',navigation),child);

async function selectVersion(version, entries, next, blocked = false) {
  const storage = new Map(Object.entries(entries));
  const select = { value: '', addEventListener(name, handler) { this[name] = handler; } };
  const status = { setAttribute(name, value) { this[name] = value; } };
  let destination;
  let flushes = 0;
  vm.runInNewContext(controller, {
    document: {
      documentElement: { dataset: { interfaceVersion: version } },
      getElementById: id => id === 'interface-version' ? select : status,
      addEventListener(name, handler) { handler(); }
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      removeItem: key => storage.delete(key),
      setItem(key, value) { if (blocked) throw new Error('Storage full'); storage.set(key, value); }
    },
    window: { flushPendingSettingChanges() { flushes++; }, t: key => key, location: { replace(value) { destination = value; } } }
  });
  assert.equal(select.value, version);
  select.value = next;
  await select.change();
  return { storage, select, status, destination, flushes };
}
const modern = { links: [{ id: 'new-link', name: 'A saved site', url: 'https://example.com' }], language: 'zh-CN', searchEngine: 'bing', searchHistory: ['test'], background: { type: 'theme' }, layout: 'list', settings: { interfaceLayoutVersion: 2, radius: 24, panelColor: '#f0e6d2' } };
const legacy = { links: [], layout: 'grid', settings: { themeStyle: 'win98', cardHeight: 208, panelPositions: { clock: { x: 50, y: 100 } } } };
const entries = { customHomeState: JSON.stringify(modern), customHomeStateLegacy: JSON.stringify(legacy) };
const switched = await selectVersion('modern', entries, 'legacy');
assert.equal(switched.destination, 'legacy/home.html');
assert.equal(switched.storage.get('lunarInterfaceVersion'), 'legacy');
assert.equal(switched.storage.get('customHomeState'), entries.customHomeState, 'Switching cannot overwrite the source state');
const storedLegacy = JSON.parse(switched.storage.get('customHomeStateLegacy'));
assert.deepEqual(storedLegacy, legacy, 'Switching must never overwrite an existing legacy profile');
assert.equal(switched.flushes, 1);
storedLegacy.links.push({ id: 'legacy-link', name: 'Legacy bookmark', url: 'https://example.org' });
const returned = await selectVersion('legacy', { ...entries, customHomeStateLegacy: JSON.stringify(storedLegacy) }, 'modern');
assert.equal(returned.destination, '../home.html');
const storedModern = JSON.parse(returned.storage.get('customHomeState'));
assert.deepEqual(storedModern.settings, modern.settings);
assert.equal(storedModern.layout, modern.layout);
assert.deepEqual(storedModern, modern, 'Returning to modern mode cannot copy legacy changes into it');
const first = await selectVersion('modern', { customHomeState: entries.customHomeState }, 'legacy');
assert(!('settings' in JSON.parse(first.storage.get('customHomeStateLegacy'))), 'A first legacy visit should use original legacy appearance defaults');
for (const key of ['links', 'language', 'searchEngine', 'searchHistory', 'background']) assert.deepEqual(JSON.parse(first.storage.get('customHomeStateLegacy'))[key], modern[key], 'A first legacy profile may seed existing content once');
const blocked = await selectVersion('modern', entries, 'legacy', true);
assert.equal(blocked.destination, undefined);
assert.equal(blocked.select.value, 'modern');
assert.equal(blocked.status.role, 'alert');
assert(!blocked.storage.has('lunarInterfaceVersion'));
const corrupt = await selectVersion('modern', { ...entries, customHomeStateLegacy: 'broken json' }, 'legacy');
assert.equal(corrupt.destination, undefined);
assert.equal(corrupt.storage.get('customHomeStateLegacy'), 'broken json', 'Damaged data must not be silently overwritten');

assert(read('legacy/script/01-config.js').includes('const STORAGE_KEY = "customHomeStateLegacy"'));
assert(read('legacy/script/prepaint.js').includes('var STORAGE_KEY = "customHomeStateLegacy"'));
assert(read('legacy/script/01-config.js').includes('const LANGUAGE_CACHE_PREFIX = "language:legacy:"'));
for (const file of fs.readdirSync(path.join(root, 'legacy/script')).filter(file => file.endsWith('.js'))) new vm.Script(read(`legacy/script/${file}`), { filename: file });
for (const [, asset] of read('legacy/home.html').matchAll(/(?:src|href)="((?:\.\.\/resource|script|themes)\/[^"?#]+|styles\.css)"/g)) assert(fs.existsSync(path.join(root, 'legacy', asset)), `Missing legacy asset: ${asset}`);
for (const [, asset] of read('legacy/script/script-loader.js').matchAll(/"(script\/[^"\n]+\.js)"/g)) assert(fs.existsSync(path.join(root, 'legacy', asset)));
for (const file of ['legacy/home.html', 'legacy/unsupported.html']) assert(read(file).includes('href="../resource/icons/lunar-v2-32.png"'), `${file} must use the current favicon`);
const modernConfig = vm.createContext({});
const legacyConfig = vm.createContext({});
vm.runInContext(read('script/01-config.js'), modernConfig);
vm.runInContext(read('legacy/script/01-config.js'), legacyConfig);
for (const constant of ['STORAGE_KEY', 'PENDING_LINKS_KEY', 'PENDING_LINK_IDS_KEY', 'PENDING_LINK_KEY_PREFIX', 'BROWSER_PREFLIGHT_CACHE_KEY', 'FIREFOX_COMPAT_NOTICE_ACK_KEY', 'BROWSER_COMPAT_NOTICE_ACK_PREFIX']) assert.notEqual(vm.runInContext(constant, modernConfig), vm.runInContext(constant, legacyConfig), `Versions share a local theme/cache/queue store: ${constant}`);
for (const constant of ['BACKGROUND_DB_NAME', 'BACKGROUND_IMAGE_KEY']) assert.equal(vm.runInContext(constant, modernConfig), vm.runInContext(constant, legacyConfig), 'Uploaded wallpaper must be shared');

// Maintenance actions in either interface must leave the other profile and global choice intact.
for (const base of ['script', 'legacy/script']) {
  const store = new Map([
    ['customHomeState', entries.customHomeState], ['customHomeStateLegacy', entries.customHomeStateLegacy],
    ['language:3:en', '{}'], ['language:legacy:3:en', '{}'], ['legacy:storageIsolationVersion', '1'],
    ['lunarBrowserPreflightCache:v2', '{}'], ['legacy:lunarBrowserPreflightCache:v2', '{}'], ['lunarInterfaceVersion', 'legacy']
  ]);
  const local = {
    get length() { return store.size; }, key: index => [...store.keys()][index] ?? null,
    getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)
  };
  const scope = vm.createContext({ localStorage: local, window: {}, document: {}, navigator: {}, URL });
  vm.runInContext(read(`${base}/01-config.js`) + '\n' + read(`${base}/02-utils.js`), scope);
  const app = read(`${base}/08-app.js`);
  scope.getLocalStorageKeyType = () => 'test';
  scope.getTextBytes = value => value.length;
  vm.runInContext(app.slice(app.indexOf('function getLocalStorageEntries('), app.indexOf('function getLocalStorageKeyType(')), scope);
  const ownKey = base === 'script' ? 'customHomeState' : 'customHomeStateLegacy';
  const otherKey = base === 'script' ? 'customHomeStateLegacy' : 'customHomeState';
  const snapshot = scope.getLocalStorageSnapshot();
  assert(ownKey in snapshot && !(otherKey in snapshot), 'Diagnostic exports must exclude the other profile');
  assert(!('lunarInterfaceVersion' in snapshot));
  scope.clearInterfaceLocalStorage();
  assert(!store.has(ownKey));
  assert.equal(store.get(otherKey), entries[otherKey]);
  assert.equal(store.get('lunarInterfaceVersion'), 'legacy');
  assert(!/localStorage\.clear\(/.test(app + read(`${base}/07-storage.js`)), 'Maintenance must not clear the shared origin');
}

// A right-click save is delivered to both independently acknowledged queues.
const queued = { pendingSavedLinkIds: ['modern-existing'], 'legacy:pendingSavedLinkIds': ['legacy-existing'] };
const worker = vm.createContext({ console });
vm.runInContext(read('background.js'), worker);
worker.extensionStorageGet = async key => ({ [key]: queued[key] });
worker.extensionStorageSet = async values => Object.assign(queued, values);
queued.lunarInterfaceVersion = 'legacy';
await worker.queueSavedLink({ id: 'legacy-new' });
assert.deepEqual([...queued.pendingSavedLinkIds], ['modern-existing']);
assert.deepEqual([...queued['legacy:pendingSavedLinkIds']], ['legacy-existing']);
assert.equal(queued['pendingSavedLink:legacy-new'].id, 'legacy-new');
assert.equal(queued['legacy:pendingSavedLink:legacy-new'].id, 'legacy-new');
queued.lunarInterfaceVersion = 'modern';
await worker.queueSavedLink({ id: 'modern-new' });
assert.equal(queued['pendingSavedLink:modern-new'].id, 'modern-new');
assert.equal(queued['legacy:pendingSavedLink:modern-new'].id, 'modern-new');
for (const registry of ['SEARCH_ENGINES', 'PRESETS']) {
  const modernEntries = JSON.parse(vm.runInContext(`JSON.stringify(${registry})`, modernConfig));
  const legacyEntries = JSON.parse(vm.runInContext(`JSON.stringify(${registry})`, legacyConfig));
  const property = registry === 'PRESETS' ? 'path' : 'icon';
  for (const [key, entry] of Object.entries(modernEntries)) {
    assert.equal(legacyEntries[key][property], `../${entry[property]}`, `Legacy ${key} must use the same current media file`);
    assert(fs.existsSync(path.join(root, entry[property])), `Missing shared media: ${entry[property]}`);
    if (registry === 'PRESETS') assert(read('legacy/script/prepaint.js').includes(`path: "../${entry.path}"`), `First paint must also use the shared ${key} wallpaper`);
  }
}
for (const base of ['data/language', 'legacy/data/language']) {
  for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'th', 'ms']) {
    const strings = JSON.parse(read(`${base}/${locale}.json`)).interface_version;
    for (const key of ['label', 'modern', 'legacy', 'note', 'storage_error']) {
      assert.equal(typeof strings[key], 'string');
      assert(!/^\?+$/.test(strings[key]), `Damaged ${locale} interface-version translation`);
    }
  }
}
console.log('PASS: routing, independent profiles and wallpaper stores, one-time legacy initialization, safe maintenance and exports, separate bookmark queues, storage failure recovery, shared media paths and first paint, legacy scripts, and six-language version controls.');
