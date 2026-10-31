// Presentation-only interactions. Search, bookmarks, storage, and wallpaper keep their existing handlers.
function initializeWorkspaceInterface() {
  const tabs = [...document.querySelectorAll("[data-settings-target]")];
  const tabList = document.querySelector(".settings-nav");
  const compactNavigation = window.matchMedia("(max-width: 640px)");
  const syncNavigationOrientation = () => tabList?.setAttribute("aria-orientation", compactNavigation.matches ? "horizontal" : "vertical");
  syncNavigationOrientation();
  compactNavigation.addEventListener("change", syncNavigationOrientation);

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateSettingsPage(tab.dataset.settingsTarget));
    tab.addEventListener("keydown", (event) => {
      const previous = compactNavigation.matches ? "ArrowLeft" : "ArrowUp";
      const next = compactNavigation.matches ? "ArrowRight" : "ArrowDown";
      let target = index;
      if (event.key === previous) target = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === next) target = (index + 1) % tabs.length;
      else if (event.key === "Home") target = 0;
      else if (event.key === "End") target = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[target].focus();
      activateSettingsPage(tabs[target].dataset.settingsTarget);
    });
  });

  document.querySelectorAll("[data-workspace-layout]").forEach((button) => {
    button.addEventListener("click", () => setLayout(button.dataset.workspaceLayout));
  });
  document.getElementById("workspace-add-link")?.addEventListener("click", () => openLinkDialog());
  document.querySelectorAll("[data-layout-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.layoutAction;
      if (action === "reset") resetPanelLayout();
      else if (action === "done") setLayoutEditing(false);
      else {
        if (action === "edit-from-settings") closeDialog("settings-dialog");
        setLayoutEditing(action === "edit-from-settings" || !document.body.classList.contains("layout-editing"));
      }
    });
  });
  const filter = document.getElementById("bookmark-filter");
  filter?.addEventListener("input", () => setBookmarkFilter(filter.value));
  filter?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !filter.value) return;
    event.preventDefault();
    clearBookmarkFilter();
  });
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.key !== "Escape" || document.querySelector("dialog[open]")) return;
    if (document.body.classList.contains("layout-editing")) {
      event.preventDefault();
      setLayoutEditing(false);
    }
  });
}

function setLayoutEditing(editing) {
  if (!editing) {
    endPanelDrag();
    endPanelResize();
  }
  document.body.classList.toggle("layout-editing", Boolean(editing));
  const toolbar = document.querySelector("[data-layout-toolbar]");
  if (toolbar) toolbar.hidden = !editing;
  document.querySelectorAll('[data-layout-action="toggle"]').forEach((button) => {
    button.setAttribute("aria-pressed", String(Boolean(editing)));
  });
  renderPanelPositions();
}

function resetPanelLayout() {
  state.settings = sanitizeSettings({
    ...state.settings,
    panelPositions: structuredClone(DEFAULT_SETTINGS.panelPositions),
    panelDesiredPositions: structuredClone(DEFAULT_SETTINGS.panelPositions),
    panelScales: structuredClone(DEFAULT_SETTINGS.panelScales)
  });
  renderPanelPositions();
  saveState();
}

function syncWorkspacePanelLayout() {
  const sharedPanels = ["clock", "search", "collection"];
  const positions = state.settings.panelDesiredPositions || state.settings.panelPositions;
  const moved = sharedPanels.some(key => (positions[key]?.x || 0) !== 0 || (positions[key]?.y || 0) !== 0);
  const resized = sharedPanels.some(key => (state.settings.panelScales[key] || 1) !== 1);
  document.body.classList.toggle("has-custom-panel-layout", moved || resized);
}

function setBookmarkFilter(value) {
  bookmarkFilter = String(value || "").trim().toLowerCase();
  renderCollection();
  collectionGridEl.scrollTop = 0;
}

function clearBookmarkFilter() {
  const filter = document.getElementById("bookmark-filter");
  if (filter) filter.value = "";
  setBookmarkFilter("");
  filter?.focus();
}

function activateSettingsPage(key) {
  if (!document.querySelector(`[data-settings-page="${key}"]`)) return;
  if (activeCustomSelect) closeCustomSelect(activeCustomSelect);
  document.querySelectorAll("[data-settings-target]").forEach((tab) => {
    const selected = tab.dataset.settingsTarget === key;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll("[data-settings-page]").forEach((page) => {
    page.hidden = page.dataset.settingsPage !== key;
  });
  const content = document.querySelector(".settings-content");
  if (content) content.scrollTop = 0;
  // Lazy controls can be initialized while hidden; refresh after the panel is visible.
  syncCustomRanges();
}

function syncWorkspaceLayout() {
  document.querySelectorAll("[data-workspace-layout]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.workspaceLayout === state.layout));
  });
}

function syncWorkspaceCollectionCount(count) {
  const counter = document.getElementById("collection-count");
  if (!counter) return;
  const total = Array.isArray(state.links) ? state.links.length : count;
  counter.textContent = count === total ? String(count) : `${count}/${total}`;
  counter.setAttribute("aria-label", t(count === total ? "workspace.shortcut_count" : "workspace.filtered_shortcut_count", { count, total }));
}
