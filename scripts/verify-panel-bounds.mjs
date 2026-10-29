import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let editing = false;
let toolbarTop = 650;
let saves = 0;
const visualViewport = { width: 1200, height: 800, offsetLeft: 0, offsetTop: 0, addEventListener() {} };
const toolbar = { hidden: false, getClientRects: () => [1], getBoundingClientRect: () => ({ top: toolbarTop, height: 72 }) };
const header = { getClientRects: () => [1], getBoundingClientRect: () => ({ bottom: 72 }) };
const style = () => {
  const values = new Map();
  return { getPropertyValue: key => values.get(key) || '', setProperty: (key, value) => values.set(key, value) };
};
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
class Panel {
  constructor(id = 'clock', width = 300, height = 180, scale = 1) {
    this.dataset = { draggableId: id };
    this.width = width; this.height = height;
    this.style = style(); this.style.setProperty('--panel-scale', String(scale));
    this.classList = { add() {}, remove() {} };
    this.grid = { style: style(), getBoundingClientRect: () => {
      const bounds = this.getBoundingClientRect();
      return rect(bounds.left, bounds.top + 48 * this.scale, bounds.width, this.gridHeight * this.scale);
    } };
    this.resizeHandle = { getClientRects: () => [1], getBoundingClientRect: () => {
      const bounds = this.getBoundingClientRect();
      return rect(bounds.right - 13 * this.scale, bounds.bottom - 13 * this.scale, 23 * this.scale, 23 * this.scale);
    } };
  }
  get scale() { return Number(this.style.getPropertyValue('--panel-scale')) || 1; }
  get gridHeight() { return Math.min(this.contentHeight || 1000, Math.max(0, parseFloat(this.grid.style.getPropertyValue('--collection-viewport-height')) || 1000)); }
  get logicalWidth() { return this.dataset.draggableId === 'collection' ? Math.min(this.width, parseFloat(this.style.getPropertyValue('--collection-max-width')) || this.width) : this.width; }
  get scrollWidth() { return Math.max(this.logicalWidth, this.dataset.draggableId === 'collection' ? 180 : 0); }
  getClientRects() { return [this.getBoundingClientRect()]; }
  getBoundingClientRect() {
    return rect(80 + (parseFloat(this.style.getPropertyValue('--drag-x')) || 0), 60 + (parseFloat(this.style.getPropertyValue('--drag-y')) || 0), this.logicalWidth * this.scale, (this.dataset.draggableId === 'collection' ? 48 + this.gridHeight : this.height) * this.scale);
  }
  querySelectorAll() { return [this.resizeHandle]; }
}
const context = vm.createContext({
  window: { innerWidth: 1200, innerHeight: 800, visualViewport, addEventListener() {} },
  document: { body: { classList: { contains: () => editing } }, querySelector: selector => selector === '.app-header' ? header : toolbar },
  getComputedStyle: target => target.dataset ? { outlineStyle: editing ? 'dashed' : 'none', outlineOffset: '6px', outlineWidth: '1px' } : { gridAutoRows: '96px' },
  activePanelDrag: null,
  state: { links: [{ id: 'retained' }], settings: { cardHeight: 96, panelPositions: {}, panelDesiredPositions: {}, panelScales: {} } },
  sanitizeSettings: value => value,
  saveState: () => { saves++; }
});
vm.runInContext(fs.readFileSync(new URL('../script/02-utils.js', import.meta.url), 'utf8'), context);
vm.runInContext(fs.readFileSync(new URL('../script/04-collection.js', import.meta.url), 'utf8'), context);
const fits = panel => {
  const viewport = context.getPanelViewportBounds();
  const bounds = context.getPanelRenderBounds(panel);
  assert(bounds.left >= viewport.left - .01 && bounds.right <= viewport.right + .01, `Horizontal overflow: ${JSON.stringify(bounds)}`);
  assert(bounds.top >= viewport.top - .01 && bounds.bottom <= viewport.bottom + .01, `Bottom or top overflow: ${JSON.stringify({ bounds, viewport })}`);
};
let checks = 0;
for (const editingMode of [false, true]) {
  editing = editingMode;
  for (const [x, y] of [[0, 10000], [-10000, -10000], [10000, 10000]]) {
    const panel = new Panel();
    context.setPanelPositionWithinViewport(panel, x, y);
    fits(panel); checks++;
  }
}
editing = true;
toolbarTop = 540;
assert.equal(context.getPanelViewportBounds().bottom, 784, 'Layout tools must not create a full-width forbidden strip at the bottom');
assert.equal(context.getPanelViewportBounds().top, 16, 'No navigation bar may reserve a full-width strip above the modules');
for (const [width, height, scale] of [[300, 1000, 1.8], [1800, 1000, 1.8]]) {
  const panel = new Panel('search', width, height, scale);
  context.setPanelPositionWithinViewport(panel, 10000, 10000);
  fits(panel);
  assert(panel.scale < scale, 'Oversized panels must fit before their position is clamped');
  checks++;
}
visualViewport.width = 800; visualViewport.height = 420; visualViewport.offsetLeft = 80; visualViewport.offsetTop = 50;
const visiblePanel = new Panel('clock', 300, 180, 1.8);
context.setPanelPositionWithinViewport(visiblePanel, 10000, 10000);
fits(visiblePanel); checks++;
for (const scale of [.7, 1, 1.8]) {
  const panel = new Panel('collection', 900, 1000, scale);
  context.collectionGridEl = panel.grid;
  context.setPanelPositionWithinViewport(panel, 10000, 10000);
  fits(panel);
  assert(panel.gridHeight >= 96, 'A full shortcut row must remain reachable');
  checks++;
}

visualViewport.width = 1200; visualViewport.height = 800; visualViewport.offsetLeft = 0; visualViewport.offsetTop = 0;
const wholeCollection = new Panel('collection', 600);
wholeCollection.contentHeight = 220;
context.collectionGridEl = wholeCollection.grid;
context.setPanelPositionWithinViewport(wholeCollection, 0, 0);
const gridBefore = wholeCollection.gridHeight;
const moduleBefore = wholeCollection.getBoundingClientRect().height;
context.setPanelPositionWithinViewport(wholeCollection, 0, 10000, { preserveSize: true });
fits(wholeCollection);
assert.equal(wholeCollection.gridHeight, gridBefore, 'Dragging must not progressively collapse or clip shortcut rows');
assert.equal(wholeCollection.getBoundingClientRect().height, moduleBefore);
assert(Math.abs(context.getPanelRenderBounds(wholeCollection).bottom - 784) < .01, 'The full module must reach the real bottom boundary');
context.keepPanelInViewport(wholeCollection);
assert.equal(wholeCollection.gridHeight, gridBefore, 'Releasing a bottom-docked module must retain its contents');
checks++;

const resized = new Panel('clock', 300, 400);
const event = { button: 0, pointerId: 7, target: resized.resizeHandle, currentTarget: resized.resizeHandle, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} };
context.startPanelResize(event, resized);
context.handlePanelResizeMove({ pointerId: 8, clientX: 10000, clientY: 10000 });
assert.equal(resized.scale, 1, 'Other pointers must not resize the panel');
context.handlePanelResizeMove({ pointerId: 7, clientX: 10000, clientY: 10000 });
fits(resized);
context.endPanelResize({ pointerId: 8 });
assert.equal(saves, 0);
context.endPanelResize({ pointerId: 7 });
assert.equal(saves, 1);
assert.equal(context.state.settings.panelDesiredPositions.clock.y, parseFloat(resized.style.getPropertyValue('--drag-y')));
context.restorePanelTowardDesired(resized);
context.keepPanelInViewport(resized);
fits(resized);
assert.equal(context.state.links[0].id, 'retained');
checks++;
console.log(`PASS: ${checks} boundary cases covering real bottom-edge access, no forbidden strip, stable collection size while dragging, resize controls, visible viewport, and saved position.`);
