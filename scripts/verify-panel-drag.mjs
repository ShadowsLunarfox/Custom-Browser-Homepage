import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const classes = new Set();
const properties = new Map([['--drag-x', '20px'], ['--drag-y', '30px']]);
let editing = false;
let saves = 0;
let captured = null;
class MockElement {
  constructor(owner, interactive = '', handle = false) { this.owner = owner; this.interactive = interactive; this.handle = handle; this.events = {}; }
  closest(selector) {
    if (selector === '[data-draggable-id]') return this.owner || this;
    if (selector === '[data-drag-handle]') return this.handle ? this : null;
    return this.interactive && selector.split(',').map(part => part.trim()).includes(this.interactive) ? this : null;
  }
  addEventListener(name, handler) { this.events[name] = handler; }
}
const panel = new MockElement();
panel.dataset = { draggableId: 'clock' };
panel.style = { getPropertyValue: key => properties.get(key) || '', setProperty: (key, value) => properties.set(key, value) };
panel.classList = { add: name => classes.add(name), remove: name => classes.delete(name) };
panel.querySelector = () => null;
panel.setPointerCapture = id => { captured = id; };
panel.hasPointerCapture = id => captured === id;
panel.releasePointerCapture = id => {
  captured = null;
  panel.events.lostpointercapture({ pointerId: id });
};
const context = vm.createContext({
  Element: MockElement,
  window: { addEventListener() {} },
  document: { body: { classList: { contains: () => editing } } },
  draggablePanelEls: [panel],
  activePanelDrag: null,
  state: { settings: { panelPositions: {}, panelDesiredPositions: {}, panelScales: { clock: 1 } } },
  saveState: () => { saves++; },
  sanitizeSettings: settings => settings
});
vm.runInContext(fs.readFileSync(new URL('../script/04-collection.js', import.meta.url), 'utf8'), context);
context.keepPanelInViewport = () => {};
context.setPanelPositionWithinViewport = (target, x, y) => {
  target.style.setProperty('--drag-x', `${x}px`);
  target.style.setProperty('--drag-y', `${y}px`);
  return { x, y };
};
context.bindPanelDragging();
assert.equal(typeof panel.events.pointerdown, 'function', 'The whole panel must receive pointerdown');

const event = (target = panel, extra = {}) => ({ button: 0, isPrimary: true, isTrusted: true, pointerId: 1, clientX: 10, clientY: 10, target, currentTarget: panel, prevented: false, preventDefault() { this.prevented = true; }, ...extra });
const ordinaryText = new MockElement(panel);
panel.events.pointerdown(event(ordinaryText));
assert.equal(context.activePanelDrag, null, 'Normal mode must not move modules');
editing = true;
for (const selector of ['a', 'button', 'input', 'textarea', 'select', 'label', 'summary', '[role="button"]', '[role="link"]', '[role="slider"]', '[contenteditable]:not([contenteditable="false"])', '[data-no-panel-drag]']) {
  const interaction = event(new MockElement(panel, selector));
  panel.events.pointerdown(interaction);
  assert.equal(context.activePanelDrag, null, `Interactive content was captured: ${selector}`);
  assert.equal(interaction.prevented, false);
}
for (const extra of [{ button: 2 }, { isPrimary: false }]) {
  panel.events.pointerdown(event(panel, extra));
  assert.equal(context.activePanelDrag, null);
}
const foreign = new MockElement(new MockElement());
assert.equal(context.canStartPanelDrag(event(foreign), panel), false, 'A nested or foreign module must keep its own drag');

panel.events.pointerdown(event(ordinaryText));
assert.equal(captured, 1);
assert(!classes.has('is-dragging-panel'), 'Pressing the module is not yet a drag');
context.handlePanelDragMove({ pointerId: 1, clientX: 13, clientY: 12 });
assert(!classes.has('is-dragging-panel'), 'Small pointer jitter must remain a click');
context.endPanelDrag({ pointerId: 1 });
assert.equal(saves, 0, 'A click must not save a new position');
assert.equal(captured, null);

panel.events.pointerdown(event(panel));
context.handlePanelDragMove({ pointerId: 2, clientX: 100, clientY: 100 });
assert(!classes.has('is-dragging-panel'), 'A second pointer must not move the panel');
context.handlePanelDragMove({ pointerId: 1, clientX: 22, clientY: 28 });
assert(classes.has('is-dragging-panel'));
assert.equal(properties.get('--drag-x'), '32px');
assert.equal(properties.get('--drag-y'), '48px');
context.endPanelDrag({ pointerId: 2 });
assert(context.activePanelDrag, 'A second pointer must not end the active drag');
context.endPanelDrag({ pointerId: 1 });
assert.equal(context.activePanelDrag, null);
assert.equal(saves, 1, 'Releasing pointer capture must not save the drag twice');
assert.equal(context.state.settings.panelDesiredPositions.clock.y, 48);
assert(!classes.has('is-dragging-panel'));

const handle = new MockElement(panel, 'button', true);
assert.equal(context.canStartPanelDrag(event(handle), panel), true, 'The optional handle should remain usable');
vm.runInContext('activePanelResize = {}', context);
assert.equal(context.canStartPanelDrag(event(panel), panel), false, 'Resize and module drag must not start together');
vm.runInContext('activePanelResize = null', context);

let cardSorts = 0;
context.getEventShortcutCard = () => ({ dataset: { id: 'saved-link' } });
context.handleCardDragStart = () => { cardSorts++; };
const nativeCardDrag = event();
context.handleCollectionCardDragStart(nativeCardDrag);
assert.equal(nativeCardDrag.prevented, true);
assert.equal(cardSorts, 0);
editing = false;
context.handleCollectionCardDragStart(event());
assert.equal(cardSorts, 1, 'Normal mode must keep native bookmark sorting');

console.log('PASS: whole-panel drag, interactive controls, click threshold, pointer capture, multi-pointer isolation, resize priority, saved positions, and normal bookmark sorting.');
