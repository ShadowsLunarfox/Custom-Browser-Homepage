import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const stored = { pendingSavedLinkIds: [], 'legacy:pendingSavedLinkIds': [], unrelated: 'keep' };
const listeners = new Set();
const notify = changes => Promise.resolve().then(() => listeners.forEach(listener => listener(changes, 'local')));
const get = async keys => structuredClone(keys === null ? stored : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in stored).map(key => [key, stored[key]])));
const set = async values => {
  Object.assign(stored, structuredClone(values));
  await notify(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])));
};
const remove = async keys => {
  const changes = {};
  for (const key of Array.isArray(keys) ? keys : [keys]) {
    if (!(key in stored)) continue;
    changes[key] = { oldValue: stored[key] };
    delete stored[key];
  }
  if (Object.keys(changes).length) await notify(changes);
};
const worker = vm.createContext({ console });
vm.runInContext(read('background.js'), worker);
worker.extensionStorageSet = set;

function consumer(base) {
  const scope = vm.createContext({
    console, URL, structuredClone,
    window: { addEventListener() {} }, document: {}, navigator: { language: 'en' },
    localStorage: { getItem: () => null },
    state: { links: [{ id: `${base}-private`, name: 'Private existing bookmark', url: `https://${base === 'script' ? 'modern' : 'legacy'}.example/`, pinned: false }], settings: { private: base }, background: { type: 'theme' } }
  });
  for (const file of ['01-config', '02-utils', '04-collection', '07-storage']) vm.runInContext(read(`${base}/${file}.js`), scope);
  scope.canUseExtensionStorage = () => true;
  scope.extensionStorageGet = get;
  scope.extensionStorageSet = set;
  scope.extensionStorageRemove = remove;
  scope.addExtensionStorageChangeListener = listener => listeners.add(listener);
  scope.renderAll = () => {};
  scope.persistAndRender = () => !scope.failSave;
  return scope;
}
const modern = consumer('script');
const legacy = consumer('legacy/script');
const page = (id, url = `https://saved.example/${id}`) => ({ id, name: `Saved ${id}`, url, pinned: false });
const settle = async predicate => {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  assert.fail('Quick-save import did not settle');
};
const has = (scope, id) => scope.state.links.some(link => link.id === id);

await worker.queueSavedLink(page('saved-with-legacy-selected'));
assert(stored['pendingSavedLink:saved-with-legacy-selected']);
assert(stored['legacy:pendingSavedLink:saved-with-legacy-selected']);
await modern.importPendingSavedLinks();
assert(has(modern, 'saved-with-legacy-selected'));
assert(stored['legacy:pendingSavedLink:saved-with-legacy-selected'], 'An unopened version must retain its own delivery');
assert(!stored['pendingSavedLink:saved-with-legacy-selected']);
await legacy.importPendingSavedLinks();
assert(has(legacy, 'saved-with-legacy-selected'), 'The other version must receive the saved page when opened');
assert.equal(modern.state.settings.private, 'script');
assert.equal(legacy.state.settings.private, 'legacy/script');
assert(!legacy.state.links.some(link => link.url === 'https://modern.example/'), 'Sharing right-click saves must not copy private bookmarks');

modern.bindPendingLinkSync();
legacy.bindPendingLinkSync();
await Promise.all(['rapid-a', 'rapid-b', 'rapid-c'].map(id => worker.queueSavedLink(page(id))));
await settle(() => ['rapid-a', 'rapid-b', 'rapid-c'].every(id => has(modern, id) && has(legacy, id)));
await worker.queueSavedLink(page('duplicate-id', 'https://saved.example/rapid-a'));
await settle(() => !stored['pendingSavedLink:duplicate-id'] && !stored['legacy:pendingSavedLink:duplicate-id']);
for (const scope of [modern, legacy]) assert.equal(scope.state.links.filter(link => link.url === 'https://saved.example/rapid-a').length, 1, 'Repeated saves should not duplicate a website');

modern.failSave = true;
await worker.queueSavedLink(page('retry-after-full-storage'));
await settle(() => has(legacy, 'retry-after-full-storage'));
assert(stored['pendingSavedLink:retry-after-full-storage'], 'A failed local save must keep the pending record');
assert(!has(modern, 'retry-after-full-storage'), 'A failed save must roll back the in-memory change');
modern.failSave = false;
await modern.importPendingSavedLinks();
await settle(() => has(modern, 'retry-after-full-storage') && !stored['pendingSavedLink:retry-after-full-storage']);
assert.equal(stored.unrelated, 'keep');
assert.equal(modern.state.settings.private, 'script');
assert.equal(legacy.state.settings.private, 'legacy/script');
console.log('PASS: right-click delivery to both versions, unopened-version persistence, rapid saves, stale-index recovery, URL deduplication, retry after save failure, and preservation of existing importer state.');
