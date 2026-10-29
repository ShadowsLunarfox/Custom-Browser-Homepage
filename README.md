<div align="center">
  <img src="resource/icons/lunar-128.png" alt="Lunar Start Page logo" width="128" />

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
    <a href="https://github.com/ShadowsLunarfox/Custom-Browser-Homepage">View repository</a>
  </p>
</div>

---

## ✨ Features

| Feature | What you can do |
| --- | --- |
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

1. Open the [project repository](https://github.com/ShadowsLunarfox/Custom-Browser-Homepage).
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
- The shared start area brings the clock, search engine, voice search, and image search together.
- Select **Customize** to change the search engine, display mode, language, clock, layout, and wallpaper.
- The top navigation bar is removed. Compact corner buttons provide settings and layout editing; hover or focus a button to see its label.
- Select **Adjust layout**, then drag a module's background or ordinary text to move it. Inputs, links, and buttons remain interactive; drag a corner to resize. Select **Done** to return to normal browsing and bookmark sorting, or **Reset layout** to restore default positions and sizes while retaining bookmarks, wallpaper, and other preferences.
- Use **Find a saved site** to filter shortcuts locally by name or address.
- To add a shortcut, use the add card in the shortcuts panel. To save a page while browsing, right-click the page and choose **Save This Page to Lunar Start**.
- Use the bookmark import/export controls in settings to move or back up your shortcut list.
- Debug tools under **Backup & tools** group diagnostics, storage, and compatibility tests into three tabs. The content scrolls within the window while the heading and close controls stay visible.

## 🛠️ Built with

- HTML, CSS, and JavaScript
- Chrome Extensions Manifest V3
- Browser storage for preferences and saved shortcuts

For a local interface preview, run `node scripts/preview-ui.cjs` and open `http://127.0.0.1:4173/home.html`. Run `node scripts/verify-ui.mjs` for interface and saved-data compatibility checks. Browser-only previews do not include extension permissions or context menu actions.

Run `node scripts/verify-panel-drag.mjs` to check whole-module dragging, input and link exclusions, pointer handling, and bookmark sorting.

Run `node scripts/verify-panel-bounds.mjs` to check real bottom-edge access, stable module dimensions during dragging, resize controls, and fitting enlarged modules into the visible window. Compact corner buttons provide layout actions. Modules stop at the true window edge without a navigation bar reserving a full-width strip; extra shortcuts scroll inside the collection.

Run `node scripts/check-browser-ui.mjs --debug-only` for debug-menu checks in an isolated headless Chrome profile, including small windows, enlarged text, scrolling, dropdowns, keyboard navigation, action feedback, and reopening. Set `LUNAR_CHROME_PATH` if Chrome is installed elsewhere. Omit `--debug-only` to include workspace checks.

The unified interface replaces the former Cartoon, Windows 98, Windows XP, and Terminal skins. Existing bookmark and wallpaper data is retained. Panel positions and scales migrate once to the new layout; dragging and resizing remain available.

The homepage fits the browser window. Extra shortcuts scroll inside their own area in both grid and list layouts. Cards default to 96px high; legacy card sizes migrate to 80–112px. Open `http://127.0.0.1:4173/scripts/viewport-check.html` while the preview server runs to check window sizing and scrolling in a browser.

Layout calculations share a single animation-frame queue. Continuous settings input also renders and saves once per animation frame, with a final flush when the page closes. Unrelated appearance changes retain the existing suggestion-engine controls.

## 📄 License

This project is distributed under the [GNU General Public License v3.0](LICENSE).

<div align="center">
  <sub>Made for a brighter new tab ✨</sub>
</div>
