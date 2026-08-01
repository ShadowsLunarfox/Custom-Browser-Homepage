<div align="center">

# Lunar Start Page

A customizable browser new tab extension with search, shortcuts, themes, wallpapers, clocks, and draggable panels.

[GitHub Profile](https://github.com/ShadowsLunarfox) | [Project Repository](https://github.com/ShadowsLunarfox/Custom-Browser-Homepage)

Version 1.2.0

</div>

## Overview

Lunar Start Page replaces the default browser new tab page with a personal start page. It is built for users who want a cleaner, more flexible homepage with quick search, bookmark cards, visual themes, custom wallpapers, clocks, and layout controls.

The project is written with plain HTML, CSS, and JavaScript. No build step is required for normal development.

## Features

- Custom browser new tab homepage.
- Multiple search engines, including Google, Bing, DuckDuckGo, Baidu, Sogou, and 360 Search.
- Search suggestions with per-engine configuration.
- Shortcut and bookmark card management.
- Import and export for bookmarks and settings.
- Draggable clock, search, and shortcut panels.
- Resizable main panels.
- Multiple clock styles, including digital and analog clocks.
- Dark and light modes.
- Visual style presets, including Default, Cartoon, Win98, WinXP, and Terminal.
- Custom colors, font size, corner radius, transparency, blur, card spacing, and layout density.
- Image, GIF, and MP4 wallpaper support.
- Built-in languages: English, Simplified Chinese, Korean, Japanese, Thai, and Malay.
- Context menu action for saving the current page to Lunar Start Page.
- Debug tools for browser compatibility checks and local data inspection.

## Supported Browsers

This extension uses Manifest V3 and is primarily designed for Chromium-based browsers:

- Google Chrome
- Microsoft Edge
- Brave
- Other Chromium browsers with Manifest V3 support

Firefox support for Manifest V3 differs from Chromium. Some features may need additional adaptation.

## Installation

### Install In Developer Mode

1. Download or clone this repository.
2. Open the browser extension management page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the project folder.
6. Open a new tab to view Lunar Start Page.

### Install With A CRX File

If you already have a `.crx` file, enable Developer mode on the browser extension management page, then drag the `.crx` file into the browser window to install it.

Some browsers restrict `.crx` files that do not come from an official extension store. If installation fails, use the Load unpacked method instead.

## Basic Usage

### Search

Type a query into the search box and press Enter. The default search engine and search suggestion behavior can be changed in Settings.

### Shortcuts

Use the add button to create shortcut cards. Each shortcut can store a name and URL, making it useful as a quick entry point for frequently visited websites.

### Save The Current Page

After installing the extension, right-click a webpage and choose Save This Page to Lunar Start. The current page will be added to the pending shortcut list in Lunar Start Page.

### Appearance

Open Settings from the top-right area of the page to adjust:

- Language
- Dark or light mode
- UI style
- Button, text, panel, dropdown, and slider colors
- Font size, corner radius, transparency, and blur
- Clock visibility and clock style
- Search box and shortcut visibility
- Shortcut grid columns, visible rows, spacing, and card height

### Wallpaper

Settings includes built-in wallpaper presets and custom wallpaper upload. JPG, PNG, WebP, GIF, and MP4 files are supported.

Smaller files are recommended. Very large images or videos may fail to save because of browser local storage limits.

### Backup And Restore

Use the Backup section in Settings to export the current configuration or import a previously saved backup file.

## Packaging

### Create A ZIP For Store Upload

Chrome Web Store and Microsoft Edge Add-ons require a `.zip` package. The first level of the archive must contain `manifest.json` directly. Do not wrap the project inside an extra parent folder.

Main files and folders to include:

```text
manifest.json
home.html
unsupported.html
background.js
styles.css
script/
data/
resource/
themes/
```

PowerShell example:

```powershell
Compress-Archive -LiteralPath @('manifest.json','home.html','unsupported.html','background.js','styles.css','script','data','resource','themes') -DestinationPath 'Lunar-Start-Page.zip' -Force
```

### Create A CRX For Local Installation

In the Chrome or Edge extension management page, click Pack extension and select the project root directory. The browser will generate a `.crx` extension package and a `.pem` private key file.

The `.crx` file is the installable extension package. The `.pem` file is required if you want to update the same extension later. Keep the `.pem` file private and do not publish it.

## Project Structure

```text
.
|-- manifest.json
|-- home.html
|-- background.js
|-- styles.css
|-- script/
|-- data/language/
|-- resource/
`-- themes/
```

## Development

This project uses native HTML, CSS, and JavaScript. After editing files, refresh the extension on the browser extension management page, then open a new tab to test the result.

## License

If you plan to publish this project publicly, add a clear open-source license file, such as the MIT License.
