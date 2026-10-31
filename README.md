<div align="center">
  <img src="resource/icons/lunar-v2-128.png" alt="Lunar Start Page logo" width="128" />

  <h1>🌙 Lunar Start Page</h1>

  <p><strong>A customizable new tab page for a more personal start to every browsing session.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Manifest-V3-7c3aed?style=for-the-badge" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/License-GPL--3.0-22c55e?style=for-the-badge" alt="GPL-3.0 license" />
    <img src="https://img.shields.io/badge/Version-1.2.0-ec4899?style=for-the-badge" alt="Version 1.2.0" />
  </p>

  <p>
    <a href="#-installation">Get started</a> ·
    <a href="#-features">Explore features</a> ·
    <a href="https://github.com/ShadowsLunarfox/Lunar-Start-Page">View repository</a>
  </p>
</div>

---

On first opening, both interfaces show a required agreement dialog with links to the published Terms of Service and Privacy Policy. Check the agreement box and choose **Accept and continue** to start the homepage; declining leaves the page. The document versions, agreement time and dialog language stay in the current browser profile and are shared between modern and legacy mode. They are excluded from homepage backups. Clearing extension data requires agreement again. Windows media access remains a separate optional permission.

## ✨ Features

| Feature | What you can do |
| --- | --- |
| **System monitor (modern only)** | View whole-computer CPU usage and physical memory used/total GiB. Click the chip icon to enable optional permissions. A single background sampler serves every page. Select background updates to keep reading while homepages are closed and show the latest session-memory cache immediately when reopening. Uncheck it for visible-widget-only sampling. No connector, history, backup or upload. |
| **Windows media player (modern only)** | Automatically follow Windows' current media with play/pause, forward/back 10 seconds, a seek bar, track controls, and cover artwork. Requires the local Windows connector. |
| 🔎 **Flexible search** | Choose from a wide range of search engines, use search suggestions, or try voice and image search. |
| 🔖 **Shortcuts & bookmarks** | Add, edit, pin, and arrange your favorite links. Import or export your bookmark list for backup. |
| 🎨 **Modern interface** | A unified interface with light and dark display modes, adjustable colors, typography, spacing, transparency, and blur. |
| ⚙️ **Organized settings** | Four categories bring related controls together: Home, Appearance & wallpaper, Search, and Backup & tools. |
| 🔎 **Find saved sites** | Filter shortcuts by name or address, see the matching count, and clear the filter without changing saved data. |
| 🖼️ **Custom wallpapers** | Pick a built-in background or use your own JPG, PNG, WebP, GIF, or MP4 file. |
| 🕒 **Clocks & layout** | Choose from digital and analog clock styles. Move and resize page panels to suit your layout. |
| 🌏 **Multiple languages** | Use Lunar Start Page in a range of supported languages. |
| 🖱️ **Quick save** | Right-click a webpage and save it to your Lunar Start shortcuts. |
| 🧰 **Backup & diagnostics** | Use the built-in tools to back up or restore data and check browser compatibility. |

## 🚀 Installation

Lunar Start Page is a Manifest V3 extension. You can load it in Chrome or Microsoft Edge from a downloaded ZIP file.

### 1. Download the project

1. Open the [project repository](https://github.com/ShadowsLunarfox/Lunar-Start-Page).
2. Select **Code → Download ZIP**.
3. Extract the ZIP file to a folder on your computer. Keep the extracted folder in a place where it will not be moved or deleted.

### 2. Load it in your browser

1. Open the extensions page:
   - **Chrome:** enter `chrome://extensions/` in the address bar.
   - **Microsoft Edge:** enter `edge://extensions/` in the address bar.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose the extracted project folder—the folder that contains `manifest.json`.
5. Open a new tab to see Lunar Start Page.

> **Updating:** Download and extract the latest version, then use **Reload** on the extension card. If you choose a new folder, load that folder as an unpacked extension.

## 🧭 Getting started

- Open a new tab and use the search bar or your shortcut cards.
- The Windows media widget is optional and off by default. Click the music-note corner button, read the data/use disclosure, and select **Agree and enable** to request its optional permission. Install the separate Windows connector only if you choose to use it; the extension never installs it automatically. See [connector instructions](native/windows-media/README.md). Use the widget's information button to disable it and revoke permission. Canceling or denying permission leaves the homepage available. The widget shares the refresh fade and automatically follows the exact Windows current media session, including a change between videos in the same browser; supported controls depend on that source. No playback starts automatically.
- The shared start area brings the clock, search engine, voice search, and image search together.
- Select **Customize** to change the search engine, display mode, language, clock, layout, and wallpaper.
- Under **Appearance & wallpaper → Interface version**, choose **New version** or **Old version**. The choice applies immediately and to every new tab, including after restarting the browser. In the old interface, the same selector is in **Settings → Appearance**. Collections, language, search, wallpaper, clock, and layout preferences synchronize between both interfaces. Theme skins, light/dark mode, and theme colors stay independent.
- The top navigation bar is removed. Compact corner buttons provide settings and layout editing; hover or focus a button to see its label.
- Select **Adjust layout**, then drag a module's background or ordinary text to move it. Inputs, links, and buttons remain interactive; drag a corner to resize. Select **Done** to return to normal browsing and bookmark sorting, or **Reset layout** to restore default positions and sizes while retaining bookmarks, wallpaper, and other preferences.
- Use **Find a saved site** to filter shortcuts locally by name or address.
- To add a shortcut, use the add card in the shortcuts panel. To save a page while browsing, right-click the page and choose **Save This Page to Lunar Start**. Right-click saves are delivered to both interface versions; an unopened version receives them when opened. Repeated saves of the same address are deduplicated.
- Use the bookmark import/export controls in settings to move or back up your shortcut list.
- Debug tools under **Backup & tools** group diagnostics, storage, and compatibility tests into three tabs. The content scrolls within the window while the heading and close controls stay visible.

## 🛠️ Built with

- HTML, CSS, and JavaScript
- Chrome Extensions Manifest V3
- Browser storage for preferences and saved shortcuts

For a local interface preview, run `node scripts/preview-ui.cjs` and open `http://127.0.0.1:4173/newtab.html` to use the saved interface choice, or `http://127.0.0.1:4173/home.html` to inspect the modern interface directly. Run `node scripts/verify-ui.mjs` for interface and saved-data compatibility checks. Browser-only previews do not include extension permissions or context menu actions.

The actual New Tab entry stays at `newtab.html` and hosts only the selected modern or legacy interface. It does not redirect the browser tab to `home.html` or `legacy/home.html`, preserving the browser's normal New Tab address display. Switching versions navigates only the selected interface; searches and image-search submissions leave the New Tab host normally. Directly opening an extension page still shows its address and browser-controlled source indicator. Run `node scripts/verify-newtab-shell.mjs` for an isolated unpacked Edge check of the real New Tab override, switching, permissions and full-tab search navigation.

Use the palette button in the modern toolbar, or **Browser theme colors** in the legacy settings footer, to open the browser's own color controls in a new tab. Chrome opens its built-in Customize Chrome appearance panel; Edge opens its native Appearance settings. The Lunar page stays open, and colors change only when you choose them in the browser's UI. No additional extension permission is required.

Run `node scripts/verify-panel-drag.mjs` to check whole-module dragging, input and link exclusions, pointer handling, and bookmark sorting.

Run `node scripts/verify-panel-bounds.mjs` to check real bottom-edge access, stable module dimensions during dragging, resize controls, and fitting enlarged modules into the visible window. Compact corner buttons provide layout actions. Modules stop at the true window edge without a navigation bar reserving a full-width strip; extra shortcuts scroll inside the collection.

Run `node scripts/check-browser-ui.mjs --debug-only` for debug-menu checks in an isolated headless Chrome profile, including small windows, enlarged text, scrolling, dropdowns, keyboard navigation, action feedback, and reopening. Set `LUNAR_CHROME_PATH` if Chrome is installed elsewhere. Omit `--debug-only` to include workspace checks.

The browser checks also measure text contrast in both display modes across the homepage, settings, and dialogs, and verify repeated theme switching. Use `node scripts/check-browser-ui.mjs --preview theme=light language=zh-CN` to capture a light-mode debug preview. Saved custom colors are retained; legacy default colors migrate together so light-mode text and panels stay readable.

The modern interface uses a unified layout. The original interface, including its Cartoon, Windows 98, Windows XP, and Terminal skins, is bundled independently under `legacy/`. Both versions use the current wallpaper and icon files from `themes/wallpaper/` and `resource/icons/`. The lightweight new-tab entry reads the saved version before loading a page, so legacy mode does not load modern interface HTML, scripts, styles, or translations. No files from the Downloads folder are required after installation.

User data and non-theme preferences synchronize live. Existing collections merge by address on first use, with the first opened interface supplying the initial preferences. Changes are stored per preference and per bookmark field, so concurrent edits to different items or fields cannot overwrite an entire older snapshot. Deletion markers prevent stale tabs and pending deliveries from restoring deleted bookmarks. Reordering, pinning, searching, language, wallpaper, clock, font scale, transparency, spacing, and desired module layout synchronize; card heights adapt to each interface's size range. Actual viewport-constrained panel positions stay local to avoid layout feedback between different designs or window sizes.

For features present in both interfaces, only theme skins, light/dark mode, and theme colors are private. The Windows media widget exists only in the modern interface; its visibility, expansion, position, and size are private modern preferences. The legacy interface loads no player resources and cannot connect to the native host. Language/compatibility caches and pending delivery acknowledgements remain separate implementation details. Each right-click save sends a durable copy to both queues; queued pages are acknowledged only after saving succeeds. Uploaded wallpapers use a common database and refresh in both interfaces, including replacement uploads with the same file name. Existing custom wallpaper migrates from the prior store when first needed. Backups include current shared data and the current interface's theme; importing data synchronizes it without changing the other theme. Local cache cleanup preserves shared user data.

Run `node scripts/verify-interface-version.mjs` for routing, local theme/cache boundaries, shared media paths, bookmark queues, and storage-failure checks. Run `node scripts/verify-shared-state.mjs` for collection migration, concurrent edits, deletions, history merging, layout adaptation, and independent themes. Run `node scripts/check-browser-ui.mjs --versions-only` for real-browser checks of version selection, live bookmark and preference updates, wallpaper uploads, safe backups/cache cleanup, repeated new tabs, and preserved theme controls.

Run `node scripts/verify-quick-save.mjs` for delivery to both versions, unopened-version retention, rapid saves, stale-index recovery, URL deduplication, and retry after local saving fails. The version browser checks also exercise shared right-click delivery through both interfaces' import and rendering code.

Run `node scripts/verify-media-broker.mjs` for client validation and native connection routing. Run `node scripts/check-browser-ui.mjs --player-only` for isolated player checks covering the arrival fade, controls, seeking, automatic Windows source changes, stale actions and seeks, private preferences, connection recovery, light/dark colors, narrow windows, and legacy isolation. These browser checks use simulated media and do not control real playback.

The player checks also verify that existing visibility preferences do not imply consent, and cover canceled/denied permission requests, explicit opt-in, permission removal and display cleanup. Media and system usage have independent background-update checkboxes in their setup dialogs. Enabling the new disclosure is required before background access; earlier visible-page consent does not enable it automatically. With background updates selected, hiding widgets or closing every homepage only disconnects those pages: one shared worker keeps reading and caches the latest state in `chrome.storage.session`. Disabling or revoking a feature stops its background work and clears its cache. No history, disk-persisted readings or backups are created; browser shutdown clears the session cache. If background updates are off, closing the last visible widget stops reading. Browser restart, sleep or a worker/connector failure may still require recovery before fresh readings are available.

Run `node scripts/verify-background-widgets.mjs` to check shared sampling, warm-cache responses, closed-page operation, foreground-only opt-out, startup recovery, session-only data and independent revocation. `node scripts/verify-system-monitor-extension.mjs` verifies real CPU/memory data and warm reopen behavior in a fresh hidden Edge profile. Context-menu saving uses `activeTab` rather than broad `tabs` access.

The installed connector lives under `%LOCALAPPDATA%\LunarStart\MediaConnector`. The project's `native/windows-media/bin/` is a separate build cache: uninstalling the installed connector preserves it. Once your installed registration points to the independent directory, that project cache can be deleted; building or packaging the connector creates it again.

Read the online [privacy policy](https://github.com/ShadowsLunarfox/Lunar-Start-Page/blob/main/PRIVACY.md) and [terms of service](https://github.com/ShadowsLunarfox/Lunar-Start-Page/blob/main/TERMS.md). English is the primary publication language, and the root documents are in English. Complete translations are available in 简体中文, 繁體粵語, 日本語, 한국어, ไทย and Bahasa Melayu. See the [language index and publication notes](docs/legal/README.md). Both interfaces' settings and player setup open the matching published GitHub Markdown page, with English as the fallback. Bundled Markdown copies remain available in the project. The policy covers local data, third-party requests, temporary media, retention and deletion; the general terms preserve mandatory consumer and GPL rights without selecting a particular jurisdiction. The published English URLs are recorded in the store configuration; no HTML legal-document version is needed.

For store preparation, see [review and publication instructions](release/STORE-REVIEW.md). On Windows, `node scripts/package-release.mjs --draft` generates separate extension and Windows connector ZIPs plus SHA-256 checksums in `dist/`. Both packages include the Markdown legal documents and translations. `--native-executable PATH` can reuse a prebuilt connector without rebuilding the project's bin cache. `node scripts/verify-release.mjs` verifies package contents, and `node scripts/verify-legal-docs.mjs` checks language navigation and legal links; `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-connector-install.ps1` tests prepared installation and owned-file removal without changing existing registrations. The Git-ignored `bin/` and `dist/` folders are not repository uploads. Configure the real store ID, public privacy-policy URL and connector download URL before a final build; `termsOfServiceUrl` can hold a published terms URL. The packager refuses incomplete required configuration. No build command publishes anything.

The homepage fits the browser window. Extra shortcuts scroll inside their own area in both grid and list layouts. Cards default to 96px high; legacy card sizes migrate to 80–112px. Open `http://127.0.0.1:4173/scripts/viewport-check.html` while the preview server runs to check window sizing and scrolling in a browser.

Layout calculations share a single animation-frame queue. Continuous settings input also renders and saves once per animation frame, with a final flush when the page closes. Unrelated appearance changes retain the existing suggestion-engine controls.

## 📄 License

This project is distributed under the [GNU General Public License v3.0](LICENSE).

<div align="center">
  <sub>Made for a brighter new tab ✨</sub>
</div>
