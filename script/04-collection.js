function renderCollection() {
  collectionGridEl.innerHTML = "";
  collectionGridEl.classList.toggle("list-mode", state.layout === "list");
  collectionShellEl.classList.toggle("list-mode", state.layout === "list");
  applyGridSettings();
  schedulePanelNormalization();

  const filteredLinks = getFilteredLinks();
  syncWorkspaceCollectionCount(filteredLinks.length);
  if (!filteredLinks.length) {
    collectionGridEl.appendChild(createEmptyStateElement());
    return;
  }

  const linkTemplate = document.getElementById("link-card-template");
  const collectionFragment = document.createDocumentFragment();
  filteredLinks.forEach((link) => {
    const fragment = linkTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".shortcut-card");
    const mainLink = fragment.querySelector(".shortcut-main");
    const pinButton = fragment.querySelector('[data-action="pin"]');

    card.dataset.id = link.id;
    card.classList.toggle("is-pinned", Boolean(link.pinned));
    mainLink.href = normalizeUrl(link.url);
    mainLink.title = link.name;
    mainLink.innerHTML = `
      <span class="shortcut-icon" aria-hidden="true">
        <img src="${escapeAttribute(link.icon || faviconForUrl(link.url))}" alt="">
        <span class="shortcut-fallback">${escapeHtml((link.name[0] || "?").toUpperCase())}</span>
      </span>
      <div class="shortcut-text">
        <span class="shortcut-title">${escapeHtml(link.name)}</span>
        <span class="shortcut-url">${escapeHtml(stripProtocol(link.url))}</span>
      </div>
    `;

    const iconImage = mainLink.querySelector("img");
    const iconWrap = mainLink.querySelector(".shortcut-icon");
    iconImage.addEventListener("error", () => {
      iconWrap.classList.add("is-fallback");
    });
    iconImage.addEventListener("load", () => {
      iconWrap.classList.remove("is-fallback");
    });

    pinButton.classList.toggle("is-active", Boolean(link.pinned));
    pinButton.innerHTML = link.pinned ? "&#9733;" : "&#9734;";

    collectionFragment.appendChild(fragment);
  });

  collectionFragment.appendChild(createAddShortcutCard());
  collectionGridEl.appendChild(collectionFragment);
}

// Empty-state card shown when nothing matches the current filter.
function createEmptyStateElement() {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state-card";
  if (bookmarkFilter && state.links.length) {
    wrapper.innerHTML = `
      <p class="empty-state-title">${escapeHtml(t("workspace.filter_empty_title"))}</p>
      <p class="empty-state">${escapeHtml(t("workspace.filter_empty_desc"))}</p>
      <button class="secondary-button" type="button" data-action="clear-filter">${escapeHtml(t("workspace.clear_filter"))}</button>
    `;
    return wrapper;
  }
  wrapper.innerHTML = `
    <p class="empty-state-title" data-i18n="empty.no_matching_title">${escapeHtml(t("empty.no_matching_title"))}</p>
    <p class="empty-state" data-i18n="empty.no_matching_desc">${escapeHtml(t("empty.no_matching_desc"))}</p>
    <button id="empty-state-add" class="accent-button" type="button" data-i18n="actions.add_first_site">${escapeHtml(t("actions.add_first_site"))}</button>
  `;
  return wrapper;
}

function createAddShortcutCard() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shortcut-card add-shortcut-card";
  button.setAttribute("aria-label", t("actions.add_site"));
  button.dataset.i18nAriaLabel = "actions.add_site";
  button.innerHTML = `
    <span class="add-shortcut-window" aria-hidden="true">
      <span class="add-shortcut-window-bar"></span>
      <span class="add-shortcut-plus">+</span>
    </span>
    <span data-i18n="actions.add_site">${escapeHtml(t("actions.add_site"))}</span>
  `;
  return button;
}

function getFilteredLinks() {
  if (!bookmarkFilter) return [...state.links];
  return state.links.filter((link) => {
    const haystack = `${link.name} ${link.url}`.toLowerCase();
    return haystack.includes(bookmarkFilter);
  });
}

function handleCollectionClick(event) {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-action="clear-filter"]')) {
    clearBookmarkFilter();
    return;
  }

  const addButton = event.target.closest(".add-shortcut-card, #empty-state-add");
  if (addButton && collectionGridEl.contains(addButton)) {
    openLinkDialog();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  const card = actionButton?.closest(".shortcut-card[data-id]");
  if (!actionButton || !card || !collectionGridEl.contains(card)) return;

  const linkId = card.dataset.id || "";
  if (actionButton.dataset.action === "pin") {
    togglePin(linkId);
    return;
  }

  if (actionButton.dataset.action === "edit") {
    const link = findLinkById(linkId);
    if (link) {
      openLinkDialog(link);
    }
    return;
  }

  if (actionButton.dataset.action === "delete") {
    state.links = state.links.filter((item) => item.id !== linkId);
    persistAndRender();
  }
}

function handleCollectionCardDragStart(event) {
  // In layout editing, card backgrounds move their module. Native card sorting stays in normal mode.
  if (document.body.classList.contains("layout-editing")) {
    event.preventDefault();
    return;
  }
  const card = getEventShortcutCard(event);
  if (!card) return;
  handleCardDragStart(event, card.dataset.id, card);
}

function handleCollectionCardDragOver(event) {
  const card = getEventShortcutCard(event);
  if (!card) return;
  handleCardDragOver(event, card);
}

function handleCollectionCardDragLeave(event) {
  const card = getEventShortcutCard(event);
  if (!card) return;
  if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return;
  card.classList.remove("drag-over-card");
}

function handleCollectionCardDrop(event) {
  const card = getEventShortcutCard(event);
  if (!card) return;
  handleCardDrop(event, card.dataset.id, card);
}

function handleCollectionCardDragEnd(event) {
  const card = getEventShortcutCard(event);
  handleCardDragEnd(event, card);
}

function getEventShortcutCard(event) {
  if (!(event.target instanceof Element)) return null;
  return event.target.closest(".shortcut-card[data-id]");
}


// Panel dragging support for clock, search, and collection blocks.
function bindPanelDragging() {
  draggablePanelEls.forEach((panel) => {
    panel.addEventListener("pointerdown", (event) => startPanelDrag(event, panel));
    panel.addEventListener("lostpointercapture", endPanelDrag);

    const resizeHandle = panel.querySelector("[data-resize-handle]");
    if (resizeHandle) {
      resizeHandle.addEventListener("pointerdown", (event) => startPanelResize(event, panel));
      resizeHandle.addEventListener("lostpointercapture", endPanelResize);
    }
  });

  window.addEventListener("pointermove", handlePanelDragMove);
  window.addEventListener("pointerup", endPanelDrag);
  window.addEventListener("pointercancel", endPanelDrag);
  window.addEventListener("blur", () => endPanelDrag());
  window.addEventListener("resize", handleViewportResize);
  window.visualViewport?.addEventListener("resize", handleViewportResize);
  window.visualViewport?.addEventListener("scroll", handleViewportResize);
}

function canStartPanelDrag(event, panel) {
  if (event.button !== 0 || event.isPrimary === false || activePanelDrag || activePanelResize) return false;
  if (!document.body.classList.contains("layout-editing")) return false;
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target || target.closest("[data-draggable-id]") !== panel) return false;
  if (target.closest("[data-drag-handle]")) return true;
  return !target.closest('a, button, input, textarea, select, label, summary, [role="button"], [role="link"], [role="slider"], [contenteditable]:not([contenteditable="false"]), [data-no-panel-drag]');
}

function startPanelDrag(event, panel) {
  if (!canStartPanelDrag(event, panel)) return;
  event.preventDefault();
  keepPanelInViewport(panel);
  const id = panel.dataset.draggableId;
  const currentX = parseFloat(panel.style.getPropertyValue("--drag-x"));
  const currentY = parseFloat(panel.style.getPropertyValue("--drag-y"));
  activePanelDrag = {
    id,
    panel,
    handle: panel,
    moved: false,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: Number.isFinite(currentX) ? currentX : 0,
    originY: Number.isFinite(currentY) ? currentY : 0,
    desiredX: Number.isFinite(currentX) ? currentX : 0,
    desiredY: Number.isFinite(currentY) ? currentY : 0
  };
  if (event.isTrusted) panel.setPointerCapture?.(event.pointerId);
}

function handlePanelDragMove(event) {
  if (!activePanelDrag) return;
  if (event.pointerId !== undefined && event.pointerId !== activePanelDrag.pointerId) return;
  const deltaX = event.clientX - activePanelDrag.startX;
  const deltaY = event.clientY - activePanelDrag.startY;
  if (!activePanelDrag.moved) {
    if (Math.hypot(deltaX, deltaY) < 5) return;
    activePanelDrag.moved = true;
    activePanelDrag.panel.classList.add("is-dragging-panel");
  }
  event.preventDefault?.();
  activePanelDrag.desiredX = activePanelDrag.originX + (event.clientX - activePanelDrag.startX);
  activePanelDrag.desiredY = activePanelDrag.originY + (event.clientY - activePanelDrag.startY);
  const constrainedPosition = setPanelPositionWithinViewport(
    activePanelDrag.panel,
    activePanelDrag.desiredX,
    activePanelDrag.desiredY,
    { preserveSize: true }
  );
  activePanelDrag.desiredX = constrainedPosition.x;
  activePanelDrag.desiredY = constrainedPosition.y;
}

function endPanelDrag(event) {
  if (!activePanelDrag) return;
  if (event?.pointerId !== undefined && event.pointerId !== activePanelDrag.pointerId) return;
  const drag = activePanelDrag;
  activePanelDrag = null;
  const panel = drag.panel;
  if (drag.handle?.hasPointerCapture?.(drag.pointerId)) {
    drag.handle.releasePointerCapture(drag.pointerId);
  }
  panel.classList.remove("is-dragging-panel");
  if (!drag.moved) return;
  keepPanelInViewport(panel, { preserveSize: true });
  const x = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const y = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
  state.settings = sanitizeSettings({
    ...state.settings,
    panelPositions: {
      ...state.settings.panelPositions,
      [drag.id]: { x, y }
    },
    panelDesiredPositions: {
      ...state.settings.panelDesiredPositions,
      [drag.id]: {
        x,
        y
      }
    }
  });
  saveState();
}

function renderPanelPositions() {
  syncWorkspacePanelLayout();
  draggablePanelEls.forEach((panel) => {
    const id = panel.dataset.draggableId;
    const desiredPosition = state.settings.panelDesiredPositions?.[id]
      || state.settings.panelPositions?.[id]
      || { x: 0, y: 0 };
    const scale = state.settings.panelScales?.[id] || 1;
    panel.style.setProperty("--panel-scale", String(scale));
    setPanelPosition(panel, desiredPosition.x || 0, desiredPosition.y || 0);
  });
  schedulePanelNormalization();
}

let activePanelResize = null;

function startPanelResize(event, panel) {
  if (event.button !== 0 || event.isPrimary === false || activePanelDrag || activePanelResize || !document.body.classList.contains("layout-editing")) return;
  event.preventDefault();
  event.stopPropagation();
  const id = panel.dataset.draggableId;
  const currentScale = state.settings.panelScales?.[id] || 1;
  activePanelResize = {
    id,
    panel,
    handle: event.currentTarget,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startScale: currentScale
  };
  panel.classList.add("is-resizing-panel");
  if (event.isTrusted) event.currentTarget.setPointerCapture?.(event.pointerId);
}

window.addEventListener("pointermove", handlePanelResizeMove);
window.addEventListener("pointerup", endPanelResize);
window.addEventListener("pointercancel", endPanelResize);
window.addEventListener("blur", () => endPanelResize());

function handlePanelResizeMove(event) {
  if (!activePanelResize) return;
  if (event.pointerId !== undefined && event.pointerId !== activePanelResize.pointerId) return;
  const deltaX = event.clientX - activePanelResize.startX;
  const deltaY = event.clientY - activePanelResize.startY;
  const delta = Math.max(deltaX, deltaY);
  const nextScale = clampValue(activePanelResize.startScale + (delta / 520), 0.7, 1.8, activePanelResize.startScale);
  activePanelResize.panel.style.setProperty("--panel-scale", String(nextScale));
  restorePanelTowardDesired(activePanelResize.panel);
  keepPanelInViewport(activePanelResize.panel);
}

function endPanelResize(event) {
  if (!activePanelResize) return;
  if (event?.pointerId !== undefined && event.pointerId !== activePanelResize.pointerId) return;
  const resize = activePanelResize;
  activePanelResize = null;
  const panel = resize.panel;
  if (resize.handle?.hasPointerCapture?.(resize.pointerId)) resize.handle.releasePointerCapture(resize.pointerId);
  keepPanelInViewport(panel);
  const scale = parseFloat(panel.style.getPropertyValue("--panel-scale")) || 1;
  const x = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const y = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
  state.settings = sanitizeSettings({
    ...state.settings,
    panelPositions: {
      ...state.settings.panelPositions,
      [resize.id]: { x, y }
    },
    panelDesiredPositions: {
      ...state.settings.panelDesiredPositions,
      [resize.id]: { x, y }
    },
    panelScales: {
      ...state.settings.panelScales,
      [resize.id]: scale
    }
  });
  panel.classList.remove("is-resizing-panel");
  saveState();
}

function handleViewportResize() {
  schedulePanelNormalization(true);
}

let panelNormalizationFrame = 0;
let shouldPersistPanelNormalization = false;

function schedulePanelNormalization(shouldPersist = false) {
  shouldPersistPanelNormalization ||= shouldPersist;
  if (panelNormalizationFrame) return;
  panelNormalizationFrame = window.requestAnimationFrame(() => {
    panelNormalizationFrame = 0;
    const persist = shouldPersistPanelNormalization;
    shouldPersistPanelNormalization = false;
    normalizePanelsToViewport(persist);
  });
}

function getPanelViewportBounds() {
  const viewport = window.visualViewport;
  const offsetLeft = viewport?.offsetLeft || 0;
  const offsetTop = viewport?.offsetTop || 0;
  const left = offsetLeft + 16;
  let top = offsetTop + 16;
  const right = Math.max(left + 1, offsetLeft + (viewport?.width || window.innerWidth) - 16);
  let bottom = offsetTop + (viewport?.height || window.innerHeight) - 16;
  bottom = Math.max(top + 1, bottom);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function getPanelRenderBounds(panel) {
  const rect = panel.getBoundingClientRect();
  let { left, top, right, bottom } = rect;
  const scale = parseFloat(panel.style.getPropertyValue("--panel-scale")) || 1;
  // Unclipped child controls may extend beyond a panel that was scaled in a narrow window.
  right = Math.max(right, left + (panel.scrollWidth || 0) * scale);
  if (document.body.classList.contains("layout-editing")) {
    const style = getComputedStyle(panel);
    const outline = style.outlineStyle === "none" ? 0 : Math.max(0, (parseFloat(style.outlineOffset) || 0) + (parseFloat(style.outlineWidth) || 0)) * scale;
    left -= outline;
    top -= outline;
    right += outline;
    bottom += outline;
    for (const handle of panel.querySelectorAll?.("[data-drag-handle], [data-resize-handle]") || []) {
      if (!handle.getClientRects().length) continue;
      const bounds = handle.getBoundingClientRect();
      left = Math.min(left, bounds.left);
      top = Math.min(top, bounds.top);
      right = Math.max(right, bounds.right);
      bottom = Math.max(bottom, bounds.bottom);
    }
  }
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function normalizePanelsToViewport(shouldPersist = false) {
  let didChange = false;
  draggablePanelEls.forEach((panel) => {
    const moving = activePanelDrag?.panel === panel || activePanelResize?.panel === panel;
    if (!moving) restorePanelTowardDesired(panel);
    didChange = keepPanelInViewport(panel, { preserveSize: moving }) || didChange;
  });

  if (!shouldPersist || !didChange) return;

  const panelPositions = { ...state.settings.panelPositions };
  draggablePanelEls.forEach((panel) => {
    panelPositions[panel.dataset.draggableId] = {
      x: parseFloat(panel.style.getPropertyValue("--drag-x")) || 0,
      y: parseFloat(panel.style.getPropertyValue("--drag-y")) || 0
    };
  });

  state.settings = sanitizeSettings({
    ...state.settings,
    panelPositions
  });
  saveState();
}

function keepPanelInViewport(panel, options) {
  const x = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const y = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
  return setPanelPositionWithinViewport(panel, x, y, options).didChange;
}

function setPanelPositionWithinViewport(panel, proposedX, proposedY, options = {}) {
  const viewport = getPanelViewportBounds();
  const originalX = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const originalY = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;

  setPanelPosition(panel, proposedX, proposedY);
  if (!options.preserveSize) fitCollectionToViewport(panel, viewport);
  if (!panel.getClientRects().length) {
    return { x: proposedX, y: proposedY, didChange: proposedX !== originalX || proposedY !== originalY };
  }

  // Moving an oversized box cannot bring both edges back on screen; fit its scale first.
  for (let attempt = 0; attempt < 4; attempt++) {
    const bounds = getPanelRenderBounds(panel);
    const ratio = Math.min(1, viewport.width / Math.max(1, bounds.width), viewport.height / Math.max(1, bounds.height));
    if (ratio >= 1 - 0.000001) break;
    const scale = parseFloat(panel.style.getPropertyValue("--panel-scale")) || 1;
    panel.style.setProperty("--panel-scale", String(Math.max(0.001, scale * ratio)));
    fitCollectionToViewport(panel, viewport);
  }

  const rect = getPanelRenderBounds(panel);
  const correctionX = rect.left < viewport.left ? viewport.left - rect.left : Math.min(0, viewport.right - rect.right);
  const correctionY = rect.top < viewport.top ? viewport.top - rect.top : Math.min(0, viewport.bottom - rect.bottom);

  if (Math.abs(correctionX) < 0.01 && Math.abs(correctionY) < 0.01) {
    return { x: proposedX, y: proposedY, didChange: proposedX !== originalX || proposedY !== originalY };
  }

  const dragRatio = measurePanelDragRatio(panel, proposedX, proposedY);
  const clampedX = proposedX + (correctionX / dragRatio.x);
  const clampedY = proposedY + (correctionY / dragRatio.y);
  const didChange = clampedX !== originalX || clampedY !== originalY;

  setPanelPosition(panel, clampedX, clampedY);
  return { x: clampedX, y: clampedY, didChange };
}

function fitCollectionToViewport(panel, viewport = getPanelViewportBounds()) {
  if (panel.dataset.draggableId !== "collection" || !panel.getClientRects().length) return;
  const scale = parseFloat(panel.style.getPropertyValue("--panel-scale")) || 1;
  let panelRect = panel.getBoundingClientRect();
  let bounds = getPanelRenderBounds(panel);
  const horizontalOutset = (panelRect.left - bounds.left) + (bounds.right - panelRect.right);
  panel.style.setProperty("--collection-max-width", `${Math.max(1, (viewport.width - horizontalOutset) / scale)}px`);
  panelRect = panel.getBoundingClientRect();
  bounds = getPanelRenderBounds(panel);
  const panelTop = panelRect.top;
  const flowTop = panelTop - (parseFloat(panel.style.getPropertyValue("--drag-y")) || 0);
  const topOutset = panelTop - bounds.top;
  const bottomOutset = bounds.bottom - panelRect.bottom;
  const gridTop = collectionGridEl.getBoundingClientRect().top;
  const headingHeight = (gridTop - panelTop) / scale;
  const rowHeight = parseFloat(getComputedStyle(collectionGridEl).gridAutoRows) || state.settings.cardHeight;
  const windowHeight = (viewport.height - topOutset - bottomOutset) / scale;
  const minimumGridHeight = Math.min(rowHeight + 6, Math.max(0, windowHeight - headingHeight));
  // Capacity follows the normal layout slot, never the proposed drag position.
  // Otherwise dragging down progressively collapses the list and looks like clipping.
  const availableBelow = (viewport.bottom - bottomOutset - Math.max(viewport.top + topOutset, flowTop)) / scale;
  const maxHeight = Math.max(minimumGridHeight, availableBelow - headingHeight);
  collectionGridEl.style.setProperty("--collection-viewport-height", `${Math.max(0, Math.floor(maxHeight))}px`);
}

function setPanelPosition(panel, x, y) {
  const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
  const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
  panel.style.setProperty("--drag-x", `${safeX}px`);
  panel.style.setProperty("--drag-y", `${safeY}px`);

}

function measurePanelDragRatio(panel, x, y) {
  const rect = panel.getBoundingClientRect();
  const nudge = 1;
  setPanelPosition(panel, x + nudge, y);
  const xRatio = panel.getBoundingClientRect().left - rect.left;
  setPanelPosition(panel, x, y + nudge);
  const yRatio = panel.getBoundingClientRect().top - rect.top;
  setPanelPosition(panel, x, y);

  return {
    x: Math.abs(xRatio) > 0.001 ? xRatio / nudge : 1,
    y: Math.abs(yRatio) > 0.001 ? yRatio / nudge : 1
  };
}

function restorePanelTowardDesired(panel) {
  const id = panel.dataset.draggableId;
  const desired = state.settings.panelDesiredPositions?.[id] || state.settings.panelPositions?.[id];
  if (!desired) return;
  setPanelPosition(panel, desired.x || 0, desired.y || 0);
}

// Bookmark item actions.
function togglePin(linkId) {
  state.links = state.links.map((link) => (
    link.id === linkId ? { ...link, pinned: !link.pinned } : link
  ));
  state.links = reorderPinnedLinks(state.links);
  persistAndRender();
}

function reorderPinnedLinks(links) {
  const pinned = links.filter((link) => link.pinned);
  const others = links.filter((link) => !link.pinned);
  return [...pinned, ...others];
}

function handleCardDragStart(event, linkId, card = event.currentTarget) {
  if (!linkId) return;
  draggedLinkId = linkId;
  card?.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", linkId);
}

function handleCardDragOver(event, card = event.currentTarget) {
  if (!draggedLinkId) return;
  event.preventDefault();
  card?.classList.add("drag-over-card");
}

function handleCardDrop(event, targetId, card = event.currentTarget) {
  if (!draggedLinkId || draggedLinkId === targetId) return;
  event.preventDefault();
  card?.classList.remove("drag-over-card");
  reorderLink(draggedLinkId, targetId);
}

function handleCardDragEnd(event, card = event.currentTarget) {
  draggedLinkId = null;
  card?.classList.remove("dragging");
  document.querySelectorAll(".drag-over-card").forEach((node) => node.classList.remove("drag-over-card"));
}

function handleCollectionDragOver(event) {
  if (!draggedLinkId) return;
  event.preventDefault();
}

function handleCollectionDrop(event) {
  if (!draggedLinkId) return;
  const card = event.target.closest(".shortcut-card");
  if (card) return;
  event.preventDefault();
  draggedLinkId = null;
  document.querySelectorAll(".drag-over-card").forEach((node) => node.classList.remove("drag-over-card"));
}

function reorderLink(dragId, targetId) {
  const dragIndex = state.links.findIndex((link) => link.id === dragId);
  const targetIndex = state.links.findIndex((link) => link.id === targetId);
  if (dragIndex === -1 || targetIndex === -1) return;

  const [moved] = state.links.splice(dragIndex, 1);
  const nextTargetIndex = state.links.findIndex((link) => link.id === targetId);
  state.links.splice(nextTargetIndex, 0, moved);
  persistAndRender();
}

// Background preset button generation.

// Link dialog create/edit flow.
function openLinkDialog(link = null) {
  document.getElementById("link-dialog-title").textContent = link ? t("dialogs.edit_site") : t("dialogs.add_site");
  document.getElementById("link-id").value = link?.id || "";
  document.getElementById("link-name").value = link?.name || "";
  document.getElementById("link-url").value = link?.url || "";
  openDialog("link-dialog");
}

function saveLink(event) {
  event.preventDefault();
  const id = document.getElementById("link-id").value;
  const name = document.getElementById("link-name").value.trim();
  const url = document.getElementById("link-url").value.trim();
  const link = sanitizeLink({
    id: id || crypto.randomUUID(),
    name,
    url,
    pinned: findLinkById(id)?.pinned || false
  });

  if (!link) return;

  if (id) {
    state.links = state.links.map((item) => (item.id === id ? link : item));
  } else {
    state.links.push(link);
  }

  state.links = reorderPinnedLinks(state.links);
  closeDialog("link-dialog");
  persistAndRender();
}


