function renderCollection() {
  collectionGridEl.innerHTML = "";
  collectionGridEl.classList.toggle("list-mode", state.layout === "list");
  collectionShellEl.classList.toggle("list-mode", state.layout === "list");
  applyGridSettings();

  const filteredLinks = getFilteredLinks();
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
    const handle = panel.querySelector("[data-drag-handle]");
    if (!handle) return;
    handle.addEventListener("pointerdown", (event) => startPanelDrag(event, panel));

    const resizeHandle = panel.querySelector("[data-resize-handle]");
    if (resizeHandle) {
      resizeHandle.addEventListener("pointerdown", (event) => startPanelResize(event, panel));
    }
  });

  window.addEventListener("pointermove", handlePanelDragMove);
  window.addEventListener("pointerup", endPanelDrag);
  window.addEventListener("pointercancel", endPanelDrag);
  window.addEventListener("resize", handleViewportResize);
}

function startPanelDrag(event, panel) {
  if (event.button !== 0) return;
  event.preventDefault();
  const id = panel.dataset.draggableId;
  const currentX = parseFloat(panel.style.getPropertyValue("--drag-x"));
  const currentY = parseFloat(panel.style.getPropertyValue("--drag-y"));
  activePanelDrag = {
    id,
    panel,
    handle: event.currentTarget,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: Number.isFinite(currentX) ? currentX : 0,
    originY: Number.isFinite(currentY) ? currentY : 0,
    desiredX: Number.isFinite(currentX) ? currentX : 0,
    desiredY: Number.isFinite(currentY) ? currentY : 0
  };
  panel.classList.add("is-dragging-panel");
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function handlePanelDragMove(event) {
  if (!activePanelDrag) return;
  activePanelDrag.desiredX = activePanelDrag.originX + (event.clientX - activePanelDrag.startX);
  activePanelDrag.desiredY = activePanelDrag.originY + (event.clientY - activePanelDrag.startY);
  const constrainedPosition = setPanelPositionWithinViewport(
    activePanelDrag.panel,
    activePanelDrag.desiredX,
    activePanelDrag.desiredY
  );
  activePanelDrag.desiredX = constrainedPosition.x;
  activePanelDrag.desiredY = constrainedPosition.y;
}

function endPanelDrag() {
  if (!activePanelDrag) return;
  const panel = activePanelDrag.panel;
  keepPanelInViewport(panel);
  const x = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const y = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
  state.settings = sanitizeSettings({
    ...state.settings,
    panelPositions: {
      ...state.settings.panelPositions,
      [activePanelDrag.id]: { x, y }
    },
    panelDesiredPositions: {
      ...state.settings.panelDesiredPositions,
      [activePanelDrag.id]: {
        x,
        y
      }
    }
  });
  if (activePanelDrag.handle?.hasPointerCapture?.(activePanelDrag.pointerId)) {
    activePanelDrag.handle.releasePointerCapture(activePanelDrag.pointerId);
  }
  panel.classList.remove("is-dragging-panel");
  activePanelDrag = null;
  saveState();
}

function renderPanelPositions() {
  draggablePanelEls.forEach((panel) => {
    const id = panel.dataset.draggableId;
    const desiredPosition = state.settings.panelDesiredPositions?.[id]
      || state.settings.panelPositions?.[id]
      || { x: 0, y: 0 };
    const scale = state.settings.panelScales?.[id] || 1;
    panel.style.setProperty("--panel-scale", String(scale));
    setPanelPosition(panel, desiredPosition.x || 0, desiredPosition.y || 0);
  });
  requestAnimationFrame(() => normalizePanelsToViewport());
}

let activePanelResize = null;

function startPanelResize(event, panel) {
  event.preventDefault();
  event.stopPropagation();
  const id = panel.dataset.draggableId;
  const currentScale = state.settings.panelScales?.[id] || 1;
  activePanelResize = {
    id,
    panel,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startScale: currentScale
  };
  panel.classList.add("is-resizing-panel");
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

window.addEventListener("pointermove", handlePanelResizeMove);
window.addEventListener("pointerup", endPanelResize);
window.addEventListener("pointercancel", endPanelResize);

function handlePanelResizeMove(event) {
  if (!activePanelResize) return;
  const deltaX = event.clientX - activePanelResize.startX;
  const deltaY = event.clientY - activePanelResize.startY;
  const delta = Math.max(deltaX, deltaY);
  const nextScale = clampValue(activePanelResize.startScale + (delta / 520), 0.7, 1.8, activePanelResize.startScale);
  activePanelResize.panel.style.setProperty("--panel-scale", String(nextScale));
  restorePanelTowardDesired(activePanelResize.panel);
  keepPanelInViewport(activePanelResize.panel);
}

function endPanelResize() {
  if (!activePanelResize) return;
  const panel = activePanelResize.panel;
  keepPanelInViewport(panel);
  const scale = parseFloat(panel.style.getPropertyValue("--panel-scale")) || 1;
  const x = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const y = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
  state.settings = sanitizeSettings({
    ...state.settings,
    panelPositions: {
      ...state.settings.panelPositions,
      [activePanelResize.id]: { x, y }
    },
    panelScales: {
      ...state.settings.panelScales,
      [activePanelResize.id]: scale
    }
  });
  panel.classList.remove("is-resizing-panel");
  activePanelResize = null;
  saveState();
}

function handleViewportResize() {
  normalizePanelsToViewport(true);
}

function normalizePanelsToViewport(shouldPersist = false) {
  let didChange = false;
  draggablePanelEls.forEach((panel) => {
    restorePanelTowardDesired(panel);
    didChange = keepPanelInViewport(panel) || didChange;
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

function keepPanelInViewport(panel) {
  const x = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const y = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
  return setPanelPositionWithinViewport(panel, x, y).didChange;
}

function setPanelPositionWithinViewport(panel, proposedX, proposedY) {
  if (isClockPanel(panel)) {
    return setClockPositionWithinViewport(panel, proposedX, proposedY);
  }

  const margin = 16;
  const originalX = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const originalY = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;

  setPanelPosition(panel, proposedX, proposedY);
  if (!panel.getClientRects().length) {
    return { x: proposedX, y: proposedY, didChange: proposedX !== originalX || proposedY !== originalY };
  }

  const rect = panel.getBoundingClientRect();
  const availableWidth = window.innerWidth - (margin * 2);
  const availableHeight = window.innerHeight - (margin * 2);
  let correctionX = 0;
  let correctionY = 0;

  if (rect.width <= availableWidth) {
    if (rect.left < margin) {
      correctionX = margin - rect.left;
    } else if (rect.right > window.innerWidth - margin) {
      correctionX = (window.innerWidth - margin) - rect.right;
    }
  } else if (rect.left > margin) {
    correctionX = margin - rect.left;
  } else if (rect.right < window.innerWidth - margin) {
    correctionX = (window.innerWidth - margin) - rect.right;
  }

  if (rect.height <= availableHeight) {
    if (rect.top < margin) {
      correctionY = margin - rect.top;
    } else if (rect.bottom > window.innerHeight - margin) {
      correctionY = (window.innerHeight - margin) - rect.bottom;
    }
  } else if (rect.top > margin) {
    correctionY = margin - rect.top;
  } else if (rect.bottom < window.innerHeight - margin) {
    correctionY = (window.innerHeight - margin) - rect.bottom;
  }

  if (Math.abs(correctionX) < 0.01 && Math.abs(correctionY) < 0.01) {
    return { x: proposedX, y: proposedY, didChange: proposedX !== originalX || proposedY !== originalY };
  }

  const dragRatio = measurePanelDragRatio(panel, proposedX, proposedY, rect);
  const clampedX = proposedX + (correctionX / dragRatio.x);
  const clampedY = proposedY + (correctionY / dragRatio.y);
  const didChange = clampedX !== originalX || clampedY !== originalY;

  setPanelPosition(panel, clampedX, clampedY);
  return { x: clampedX, y: clampedY, didChange };
}

function setPanelPosition(panel, x, y) {
  const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
  const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
  panel.style.setProperty("--drag-x", `${safeX}px`);
  panel.style.setProperty("--drag-y", `${safeY}px`);

  if (isClockPanel(panel)) {
    const margin = getPanelViewportMargin(panel);
    panel.style.setProperty("--clock-left", `${margin + safeX}px`);
    panel.style.setProperty("--clock-top", `${margin + safeY}px`);
  }
}

function setClockPositionWithinViewport(panel, proposedX, proposedY) {
  const margin = getPanelViewportMargin(panel);
  const originalX = parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
  const originalY = parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
  const safeX = Number.isFinite(Number(proposedX)) ? Number(proposedX) : originalX;
  const safeY = Number.isFinite(Number(proposedY)) ? Number(proposedY) : originalY;

  setPanelPosition(panel, safeX, safeY);
  if (!panel.getClientRects().length) {
    return { x: safeX, y: safeY, didChange: safeX !== originalX || safeY !== originalY };
  }

  const rect = panel.getBoundingClientRect();
  const minLeft = margin;
  const minTop = margin;
  const maxLeft = Math.max(minLeft, window.innerWidth - margin - rect.width);
  const maxTop = Math.max(minTop, window.innerHeight - margin - rect.height);
  const clampedLeft = clampValue(margin + safeX, minLeft, maxLeft, minLeft);
  const clampedTop = clampValue(margin + safeY, minTop, maxTop, minTop);
  const clampedX = clampedLeft - margin;
  const clampedY = clampedTop - margin;
  const didChange = clampedX !== originalX || clampedY !== originalY;

  setPanelPosition(panel, clampedX, clampedY);
  return { x: clampedX, y: clampedY, didChange };
}

function isClockPanel(panel) {
  return panel?.dataset?.draggableId === "clock";
}

function getPanelViewportMargin(panel) {
  return isClockPanel(panel) && window.innerWidth <= 640 ? 10 : 16;
}

function measurePanelDragRatio(panel, x, y, rect) {
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


