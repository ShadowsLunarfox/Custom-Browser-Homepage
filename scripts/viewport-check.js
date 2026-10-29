// This isolated local test page never changes the installed extension's storage.
(async () => {
  const options = new URLSearchParams(location.search);
  const debugOnly = options.has('debug-only') || options.has('debug-preview');
  const debugPreview = options.has('debug-preview');
  const saved = localStorage.getItem("customHomeState");
  const restoreStorage = () => {
    if (saved === null) localStorage.removeItem("customHomeState");
    else localStorage.setItem("customHomeState", saved);
  };
  window.addEventListener('pagehide', restoreStorage, { once: true });
  const results = document.getElementById("results");
  const scenarios = debugPreview ? [{ width: Number(options.get('width')) || 1280, height: Number(options.get('height')) || 720, fontScale: Number(options.get('font')) || 100, language: options.get('language') || 'en' }] : [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 786, height: 880 },
    { width: 1024, height: 500 },
    { width: 640, height: 520 },
    { width: 390, height: 700 },
    { width: 1280, height: 720, layout: "list" },
    { width: 1280, height: 720, scale: 1.8 },
    { width: 1280, height: 1200, count: 12 },
    { width: 1280, height: 720, fontScale: 120 },
    { width: 390, height: 700, clockStyle: "analog" },
    { width: 1024, height: 500, clockVisible: false },
    { width: 390, height: 520, clockVisible: false, searchUiVisible: false },
    { width: 390, height: 520, fontScale: 120, language: "zh-CN" },
    { width: 390, height: 700, language: "ms" },
    { width: 1024, height: 500, language: "th" }
  ];
  let passed = 0;
  const report = [];
  const loadRetries = new Map();
  let frame;
  try {
    for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex++) {
      const scenario = scenarios[scenarioIndex];
      const { width, height, layout = "grid", scale = 1, count = 36, fontScale = 100, clockStyle = "classic", clockVisible = true, searchUiVisible = true, language = "en" } = scenario;
      const label = `${width} × ${height}, ${layout}, ${count} shortcuts, font ${fontScale}%, ${language}${scale !== 1 ? `, scale ${scale}` : ""}`;
      const result = document.createElement("li");
      result.textContent = `Running: ${label}`;
      results.append(result);
      const sample = {
        version: 3, language, layout, searchEngine: "google",
        links: Array.from({ length: count }, (_, index) => ({ id: `test-${index}`, name: `Saved website ${index + 1}`, url: `https://example.com/site-${index}`, pinned: false, icon: "resource/icons/lunar-32.png" })),
        background: { type: "theme", value: "", name: "" },
        settings: { interfaceLayoutVersion: scale === 1 ? 1 : 2, cardHeight: scale === 1 ? 280 : 96, cardGap: 16, columns: 4, rows: 5, fontScale, clockVisible, searchUiVisible, clockStyle, panelScales: { clock: 1, search: 1, collection: scale } }
      };
      localStorage.setItem("customHomeState", JSON.stringify(sample));
      frame = document.createElement("iframe");
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      frame.src = `../home.html?viewport-test=${width}-${height}-${layout}-${scale}`;
      const loaded = new Promise((resolve, reject) => {
        frame.onload = resolve;
        frame.onerror = () => reject(new Error("Preview did not load"));
      });
      document.body.append(frame);
      try {
        await loaded;
        const page = frame.contentDocument;
        const win = frame.contentWindow;
        await new Promise((resolve, reject) => {
          const deadline = Date.now() + 10000;
          const check = () => {
            if (page.body.classList.contains("app-ready")) win.requestAnimationFrame(() => win.requestAnimationFrame(resolve));
            else if (Date.now() > deadline) reject(new Error("Application did not initialize"));
            else setTimeout(check, 30);
          };
          check();
        });
        const grid = page.getElementById("collection-grid");
        const panel = page.querySelector('[data-draggable-id="collection"]');
        const card = grid.querySelector(".shortcut-card");
        const root = page.scrollingElement;
        const assert = (condition, message) => { if (!condition) throw new Error(message); };
        const settle = () => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
        if (!debugOnly) {
        assert(root.scrollHeight <= root.clientHeight + 1, `Page overflows vertically: ${root.scrollHeight} > ${root.clientHeight}`);
        assert(root.scrollWidth <= root.clientWidth + 1, "Page overflows horizontally");
        win.scrollTo(0, 1000);
        assert(win.scrollY === 0, "Main page can scroll");
        assert(grid.clientHeight >= 48, `Shortcut area collapsed to ${grid.clientHeight}px`);
        if (count > 12) assert(grid.scrollHeight > grid.clientHeight + 1, "Excess shortcuts are not contained in the shortcut scroller");
        if (grid.scrollHeight > grid.clientHeight + 1) {
          grid.scrollTop = grid.scrollHeight;
          assert(grid.scrollTop > 0, "Shortcut area cannot scroll");
          const last = grid.lastElementChild.getBoundingClientRect();
          assert(last.bottom <= grid.getBoundingClientRect().bottom + 1 && last.top >= grid.getBoundingClientRect().top - 1, "Last shortcut is blocked below the scroll area");
          grid.scrollTop = 0;
        }
        const cardHeight = Math.round(card.getBoundingClientRect().height);
        assert(cardHeight <= (scale === 1 ? 112 : 174), `Cards are too tall: ${cardHeight}px`);
        assert(grid.getBoundingClientRect().bottom <= height, "Scaled shortcut area extends below the window");
        assert(Math.abs(panel.getBoundingClientRect().bottom - grid.getBoundingClientRect().bottom) <= 1, "Invisible space inflates the panel's drag bounds");
        const titleSize = parseFloat(win.getComputedStyle(card.querySelector('.shortcut-title')).fontSize);
        const urlSize = parseFloat(win.getComputedStyle(card.querySelector('.shortcut-url')).fontSize);
        assert(titleSize >= 16 * fontScale / 100 - .1, `Website names are too small: ${titleSize}px`);
        assert(urlSize >= 12 * fontScale / 100 - .1, `Website addresses are too small: ${urlSize}px`);
        const beforeDrag = panel.getBoundingClientRect();
        const gridHeightBeforeDrag = grid.clientHeight;
        const room = win.getPanelViewportBounds().bottom - win.getPanelRenderBounds(panel).bottom;
        const move = Math.min(60, Math.max(0, room - 2));
        const originalY = parseFloat(panel.style.getPropertyValue('--drag-y')) || 0;
        const originalX = parseFloat(panel.style.getPropertyValue('--drag-x')) || 0;
        win.setPanelPositionWithinViewport(panel, originalX, originalY + move, { preserveSize: true });
        assert(panel.getBoundingClientRect().top >= beforeDrag.top + move - 1, "An invisible region blocks dragging down");
        assert(panel.getBoundingClientRect().bottom <= height - 15, "Dragged panel extends below the window");
        assert(grid.clientHeight === gridHeightBeforeDrag, 'Dragging down shrank and clipped the shortcut area');

        // The unified start region must give hidden modules' space back to shortcuts.
        if (!clockVisible && !searchUiVisible) assert(win.getComputedStyle(page.querySelector('.start-area')).display === 'none', 'Hidden start modules still occupy space');
        assert(page.querySelectorAll('[data-settings-target]').length === 4, 'Settings have not been consolidated');
        page.getElementById('open-settings').click();
        assert(page.getElementById('settings-dialog').open, 'Settings did not open');
        for (const tab of page.querySelectorAll('[data-settings-target]')) {
          tab.click();
          assert(page.querySelectorAll('[data-settings-page]:not([hidden])').length === 1, 'Settings pages overlap');
          assert(!page.querySelector(`[data-settings-page="${tab.dataset.settingsTarget}"]`).hidden, 'Selected settings category is hidden');
        }
        page.querySelector('[data-settings-target="appearance"]').click();
        assert(page.getElementById('background-upload-trigger').getClientRects().length > 0, 'Wallpaper controls are missing from appearance');
        page.querySelector('[data-settings-target="search"]').click();
        const firstEngineGroup = page.getElementById('search-suggestion-engine-list').firstElementChild;
        win.updateSetting('accentColor', '#a5ceb6');
        win.updateSetting('columns', 5);
        win.updateSetting('columns', 4);
        await settle();
        assert(page.getElementById('search-suggestion-engine-list').firstElementChild === firstEngineGroup, 'Unrelated settings rebuild the engine list');
        assert(grid.style.getPropertyValue('--column-count') === '4', 'Batched settings lost the final input');
        page.getElementById('settings-dialog').close();
        }

        // Open through the actual settings entry, then exercise the bounded debug dialog.
        page.getElementById('open-settings').click();
        page.querySelector('[data-settings-target="library"]').click();
        page.getElementById('open-debug-tools').click();
        const debug = page.getElementById('debug-dialog');
        const debugContent = debug.querySelector('.debug-content');
        if (debugPreview) {
          frame.style.opacity = '1';
          frame.style.pointerEvents = 'auto';
          frame.style.zIndex = '10';
          if (options.has('tab')) win.activateDebugPage(options.get('tab'));
          await new Promise(() => {});
        }
        assert(debug.open && !page.getElementById('settings-dialog').open, 'Debug tools did not replace the settings dialog');
        assert(debug.querySelectorAll('[data-debug-target]').length === 3, 'Debug categories are missing');
        const debugHead = debug.querySelector('.dialog-head').getBoundingClientRect();
        const debugFooter = debug.querySelector('.dialog-actions').getBoundingClientRect();
        assert(debugHead.top >= 0 && debugFooter.bottom <= height, `Debug close controls extend outside the viewport: ${JSON.stringify({ head: debugHead.toJSON(), footer: debugFooter.toJSON(), height })}`);
        assert(debugContent.clientHeight > 80, 'Debug content is squeezed out of the window');
        assert(parseFloat(win.getComputedStyle(page.querySelector('#debug-status-list dd')).fontSize) >= 14 * fontScale / 100 - .1, 'Debug status text is too small');
        page.getElementById('debug-refresh-status').click();
        assert(debug.open && page.getElementById('debug-feature-list').children.length === 11, 'Refreshing debug status closes or empties the menu');
        win.showInlineNotice('Diagnostic action completed', 'info');
        const debugNotice = debug.querySelector('[data-debug-notice]');
        assert(!debugNotice.hidden && debugNotice.textContent === 'Diagnostic action completed', 'Debug action feedback is hidden behind the modal');
        assert(debugNotice.getBoundingClientRect().bottom <= debug.getBoundingClientRect().bottom, 'Debug feedback is clipped');
        for (const tab of debug.querySelectorAll('[data-debug-target]')) {
          tab.click();
          await settle();
          const debugPage = debug.querySelector(`[data-debug-page="${tab.dataset.debugTarget}"]`);
          assert(!debugPage.hidden && debug.querySelectorAll('[data-debug-page]:not([hidden])').length === 1, 'Debug tabs overlap or show the wrong category');
          assert(debugContent.scrollTop === 0, 'Debug category starts scrolled past its heading');
          assert(debug.scrollHeight <= debug.clientHeight + 1 && debug.scrollWidth <= debug.clientWidth + 1, `Debug shell scrolls or overflows: ${debug.scrollHeight}/${debug.clientHeight}, ${debug.scrollWidth}/${debug.clientWidth}`);
          assert(debugContent.scrollWidth <= debugContent.clientWidth + 1, 'Debug content overflows horizontally');
          debugContent.scrollTop = debugContent.scrollHeight;
          const finalBlock = debugPage.lastElementChild.getBoundingClientRect();
          const contentBox = debugContent.getBoundingClientRect();
          assert(finalBlock.bottom <= contentBox.bottom + 1, 'Bottom debug actions are clipped');
          assert(Math.abs(debug.querySelector('.dialog-actions').getBoundingClientRect().bottom - debugFooter.bottom) <= 1, 'Debug close control scrolls away');
        }
        // Keyboard tab navigation must agree with pointer navigation and reset the scroll position.
        page.getElementById('debug-tab-testing').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        assert(!page.getElementById('debug-page-overview').hidden && debugContent.scrollTop === 0, 'Debug keyboard navigation failed');
        page.getElementById('debug-tab-testing').click();
        const simulation = page.getElementById('debug-simulation-select');
        const simulationShell = simulation.nextElementSibling;
        simulationShell.scrollIntoView({ block: 'center' });
        simulationShell.querySelector('button').click();
        await settle();
        const optionList = simulationShell.querySelector('[role="listbox"]');
        const optionBounds = optionList.getBoundingClientRect();
        const scrollBounds = debugContent.getBoundingClientRect();
        assert(!optionList.hidden && optionBounds.height > 0, 'Debug simulation dropdown did not open');
        assert(optionBounds.top >= scrollBounds.top - 1 && optionBounds.bottom <= scrollBounds.bottom + 1, 'Debug simulation dropdown is clipped by its scroll container');
        optionList.querySelectorAll('button')[1].click();
        assert(simulation.value === 'firefox' && optionList.hidden, 'Debug simulation selection did not apply');
        debug.querySelector('.dialog-actions button').click();
        assert(!debug.open, 'Debug close action failed');
        page.getElementById('open-settings').click();
        page.getElementById('open-debug-tools').click();
        assert(!page.getElementById('debug-page-overview').hidden && debugContent.scrollTop === 0, `Reopening debug tools did not return to its overview: open=${debug.open}, hidden=${page.getElementById('debug-page-overview').hidden}, scroll=${debugContent.scrollTop}`);
        debug.querySelector('.dialog-head [data-close-dialog]').click();
        assert(!debug.open, 'Debug header close action failed');
        if (debugOnly) {
          passed++;
          result.textContent = `PASS: ${label}. Debug tabs, refresh, dropdowns, keyboard navigation, bottom actions, and close controls.`;
          report.push({ scenario: label, passed: true });
          continue;
        }

        const filter = page.getElementById('bookmark-filter');
        filter.value = 'Saved website 1';
        filter.dispatchEvent(new win.Event('input', { bubbles: true }));
        const expectedMatches = sample.links.filter(link => link.name.toLowerCase().includes('saved website 1')).length;
        assert(grid.querySelectorAll('.shortcut-card[data-id]').length === expectedMatches, 'Local bookmark filtering returned the wrong results');
        assert(page.getElementById('collection-count').textContent === `${expectedMatches}/${count}`, 'Filtered result count is incorrect');
        filter.value = 'no-such-saved-site';
        filter.dispatchEvent(new win.Event('input', { bubbles: true }));
        assert(grid.querySelector('[data-action="clear-filter"]'), 'No-results view does not offer a clear-filter action');
        grid.querySelector('[data-action="clear-filter"]').click();
        assert(filter.value === '' && grid.querySelectorAll('.shortcut-card[data-id]').length === count, 'Clearing the filter did not restore shortcuts');

        const event = { button: 0, target: panel, currentTarget: panel, clientX: 10, clientY: 10, pointerId: 1, preventDefault() {} };
        win.startPanelDrag(event, panel);
        assert(!panel.classList.contains('is-dragging-panel'), 'Modules can be moved outside layout-editing mode');
        page.querySelector('[data-layout-action="toggle"]').click();
        await settle();
        assert(page.body.classList.contains('layout-editing') && !page.querySelector('[data-layout-toolbar]').hidden, 'Layout editing controls did not appear');
        assert(!page.querySelector('.app-header'), 'The removed navigation bar is still present');
        assert(page.querySelector('.workspace-controls').contains(page.querySelector('[data-layout-toolbar]')), 'Layout actions must remain in the corner controls');
        win.startPanelDrag(event, panel);
        assert(!panel.classList.contains('is-dragging-panel'), 'A click should not move the module');
        win.handlePanelDragMove({ clientX: 10, clientY: 22 });
        assert(panel.classList.contains('is-dragging-panel'), 'Dragging the module background did not move it');
        win.endPanelDrag();
        page.querySelector('[data-layout-action="reset"]').click();
        await settle();
        const resetState = JSON.parse(win.localStorage.getItem('customHomeState'));
        assert(resetState.settings.panelDesiredPositions.collection.x === 0, 'Layout reset did not clear the saved horizontal position');
        assert(panel.style.getPropertyValue('--panel-scale') === '1', 'Layout reset did not restore scale');
        assert(win.getFilteredLinks().length === count, 'Layout reset changed saved shortcuts');
        page.querySelector('[data-layout-action="done"]').click();
        await settle();
        assert(!page.body.classList.contains('layout-editing'), 'Done did not leave layout editing');
        assert(root.scrollHeight <= root.clientHeight + 1, 'Workspace actions introduced page scrolling');
        page.querySelector('[data-layout-action="toggle"]').click();
        await settle();
        const screen = win.getPanelViewportBounds();
        for (const module of page.querySelectorAll('[data-draggable-id]')) {
          if (!module.getClientRects().length) continue;
          win.keepPanelInViewport(module);
          const heightBefore = module.getBoundingClientRect().height;
          win.setPanelPositionWithinViewport(module, 10000, 10000, { preserveSize: true });
          const edge = win.getPanelRenderBounds(module);
          assert(edge.bottom <= screen.bottom + 1, `${module.dataset.draggableId} or its resize control crossed the bottom boundary`);
          assert(edge.top >= screen.top - 1 && edge.left >= screen.left - 1 && edge.right <= screen.right + 1, 'Module controls extend outside the visible screen');
          assert(Math.abs(module.getBoundingClientRect().height - heightBefore) <= 1, 'Moving to the bottom changes the module height');
          assert(Math.abs(edge.bottom - screen.bottom) <= 1, 'An invisible strip still blocks the bottom edge');
        }
        page.querySelector('[data-layout-action="reset"]').click();
        page.querySelector('[data-layout-action="done"]').click();
        await settle();
        passed++;
        result.textContent = `PASS: ${label}. Filter, four settings groups, edit/reset, text, and scrolling.`;
        report.push({ scenario: label, passed: true });
      } catch (error) {
        let styles;
        try { styles = [...frame.contentDocument.styleSheets[0].cssRules].map(rule => ({ href: rule.href, rules: rule.styleSheet?.cssRules.length })); } catch {}
        // The local Windows test browser can deny a loopback asset request. Retry loading,
        // while keeping layout and interaction assertion failures visible.
        const incompleteLoad = error.message === 'Application did not initialize' || !styles || styles.some(style => !style.rules);
        const attempts = loadRetries.get(scenarioIndex) || 0;
        if (incompleteLoad && attempts < 2) {
          loadRetries.set(scenarioIndex, attempts + 1);
          result.textContent = `Retrying preview resource load: ${label}`;
          scenarioIndex--;
          continue;
        }
        result.className = "fail";
        result.textContent = `FAIL: ${label}. ${error.message}`;
        report.push({ scenario: label, passed: false, error: error.message, styles });
      } finally {
        frame.remove();
        frame = null;
      }
    }
  } finally {
    frame?.remove();
    restoreStorage();
    document.getElementById("summary").textContent = `${passed}/${scenarios.length} passed — unified workspace, settings groups, bookmark filtering, intentional editing, and saved-data preservation.`;
    document.title = `${passed === scenarios.length ? "PASS" : "FAIL"}: Lunar viewport checks`;
    await fetch('/__viewport-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passed, total: scenarios.length, results: report }) }).catch(() => {});
  }
})();
