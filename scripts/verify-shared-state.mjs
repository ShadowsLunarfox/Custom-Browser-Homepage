import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
assert.equal(read('script/07-sync.js'), read('legacy/script/07-sync.js'));
const store = new Map();
const a = { id: 'a', name: 'A', url: 'https://a.example/', pinned: false };
const b = { id: 'b', name: 'B', url: 'https://b.example/', pinned: false };
const modernData = { language: 'zh-CN', layout: 'grid', searchEngine: 'bing', links: [a], settings: { interfaceLayoutVersion: 2, theme: 'light', radius: 18, cardHeight: 96 }, background: { type: 'theme' } };
const legacyData = { language: 'en', links: [{ ...a, id: 'duplicate-a' }, b], settings: { theme: 'dark', themeStyle: 'win98', accentColor: '#123456', cardHeight: 208 }, background: { type: 'theme' } };
store.set('customHomeState', JSON.stringify(modernData));
store.set('customHomeStateLegacy', JSON.stringify(legacyData));
let timer = 0;
let uuid = 0;
function create(base, data) {
  const localStorage = { get length() { return store.size; }, key: index => [...store.keys()][index] ?? null, getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
  const scope = vm.createContext({
    console, URL, structuredClone, crypto: { randomUUID: () => `test-${++uuid}` }, navigator: { language: 'en' },
    localStorage, window: { addEventListener() {}, setTimeout: () => ++timer, clearTimeout() {} }, document: { documentElement: {} },
    activePanelDrag: null, activeCustomRange: null, renderAll() {}, renderBackground() {}, applyTranslations() {},
    DEFAULT_STATE: { language: 'en', links: [], settings: {}, background: { type: 'theme' } }, inputState: data
  });
  for (const name of ['01-config', '02-utils', '04-collection', '06-i18n', '07-storage', '07-sync']) vm.runInContext(read(`${base}/${name}.js`), scope);
  scope.state = vm.runInContext('sanitizeState(inputState)', scope);
  scope.initializeBackgroundStorage = async () => {};
  scope.loadLanguage = async () => {};
  scope.applyTranslations = () => {};
  scope.initializeSharedState();
  return scope;
}
const modern = create('script', modernData);
const legacy = create('legacy/script', legacyData);
const run = (scope, source) => vm.runInContext(source, scope);
assert.deepEqual(Array.from(modern.state.links, link => link.url), ['https://a.example/', 'https://b.example/']);
assert.equal(legacy.state.links.length, 2, 'Existing collections should merge and deduplicate once');
assert.equal(legacy.state.settings.themeStyle, 'win98');
assert.equal(legacy.state.settings.theme, 'dark');
assert.equal(modern.state.settings.theme, 'light');
assert.equal(legacy.state.language, 'zh-CN');
assert.equal(legacy.state.settings.radius, 18);
assert.equal(legacy.state.settings.cardHeight, 192, 'Legacy cards should adapt the common compact height');

run(modern, 'state.links[0].name = "Renamed in modern"; saveState();');
run(legacy, 'state.links[0].pinned = true; state.links.push({id:"c",name:"C",url:"https://c.example/",pinned:false}); state.settings.clockStyle="analog"; saveState();');
await modern.refreshSharedState();
assert.equal(modern.state.links.find(link => link.id === 'a').name, 'Renamed in modern');
assert.equal(modern.state.links.find(link => link.id === 'a').pinned, true, 'Concurrent edits to different bookmark fields must merge');
assert(modern.state.links.some(link => link.id === 'c'));
assert.equal(modern.state.settings.clockStyle, 'analog');
run(modern, 'state.links = state.links.filter(link => link.id !== "a"); saveState();');
run(legacy, 'state.links.find(link => link.id === "a").name="Stale edit after deletion"; saveState();');
await modern.refreshSharedState();
assert(!legacy.state.links.some(link => link.id === 'a'), 'A stale tab must not resurrect a deleted bookmark');
assert(modern.isSharedBookmarkDeleted('a'), 'Old queued deliveries must respect deletions');

run(modern, 'state.language="ja"; state.searchEngine="duckduckgo"; state.layout="list"; state.settings.panelDesiredPositions.clock={x:35,y:70}; state.settings.panelScales.clock=1.2; state.settings.radius=26; saveState();');
await legacy.refreshSharedState();
assert.equal(legacy.state.language, 'ja');
assert.equal(legacy.state.searchEngine, 'duckduckgo');
assert.equal(legacy.state.layout, 'list');
assert.equal(legacy.state.settings.panelDesiredPositions.clock.x, 35);
assert.equal(legacy.state.settings.panelScales.clock, 1.2);
assert.equal(legacy.state.settings.radius, 26);
run(legacy, 'state.settings.cardHeight=240; saveState();');
await modern.refreshSharedState();
assert.equal(modern.state.settings.cardHeight, 120);
run(modern, 'state.settings.cardHeight=160; saveState();');
await legacy.refreshSharedState();
assert.equal(legacy.state.settings.cardHeight, 280);
run(legacy, 'state.settings.clockVisible=false; saveState();');
await modern.refreshSharedState();
assert.equal(modern.state.settings.cardHeight, 160, 'UI size limits must not feed adapted values back into the shared preference');

run(modern, 'state.searchHistory=["modern query"]; saveState();');
run(legacy, 'state.searchHistory=["legacy query"]; saveState();');
await modern.refreshSharedState();
assert(modern.state.searchHistory.includes('modern query') && modern.state.searchHistory.includes('legacy query'));
run(legacy, 'state.settings.themeStyle="terminal"; state.settings.theme="light"; state.settings.accentColor="#abcdef"; saveState();');
await modern.refreshSharedState();
assert.equal(modern.state.settings.theme, 'light');
assert.notEqual(modern.state.settings.accentColor, '#abcdef');
assert.equal(legacy.state.settings.themeStyle, 'terminal');
run(modern, 'state.background={type:"preset",value:"wallpaper_3",selectedByUser:true}; saveState();');
await legacy.refreshSharedState();
assert.equal(legacy.state.background.value, 'wallpaper_3');
run(modern, 'state.links.push({id:"duplicate-b",name:"Duplicate B",url:"https://b.example/",pinned:false}); saveState();');
await legacy.refreshSharedState();
run(legacy, 'state.links=state.links.filter(link=>link.url!=="https://b.example/"); saveState();');
await modern.refreshSharedState();
assert(!modern.state.links.some(link => link.url === 'https://b.example/'), 'A hidden duplicate must not reappear after deleting a website');
let finishLanguage;
modern.loadLanguage = () => new Promise(resolve => { finishLanguage = resolve; });
run(legacy, 'state.language="ko"; saveState();');
const refreshing = modern.refreshSharedState();
run(modern, 'state.settings.columns=7; saveState();');
finishLanguage();
await refreshing;
await legacy.refreshSharedState();
assert.equal(legacy.state.settings.columns, 7, 'Editing while remote localization loads must still publish the edit');
const secondModern = create('script', JSON.parse(store.get('customHomeState')));
run(modern, 'state.settings.theme="dark"; state.settings.accentColor="#998877"; saveState();');
run(secondModern, 'state.settings.rows=4; saveState();');
assert.equal(secondModern.state.settings.theme, 'dark', 'A stale tab of the same interface must preserve its newer theme');
assert.equal(secondModern.state.settings.accentColor, '#998877');
assert.equal(legacy.state.settings.accentColor, '#abcdef', 'Theme merging must stay inside the same interface');
console.log('PASS: existing collection merge, live shared preferences, concurrent per-field bookmark edits, deletion tombstones, adapted layout sizes, search-history merging, wallpaper selection, and independent themes.');
