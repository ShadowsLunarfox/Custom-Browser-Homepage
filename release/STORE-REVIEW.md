# Chrome Web Store preparation

Status: unpublished. The generated `-draft.zip` files are review artifacts, not a claim of Google approval. This work does not publish to the store or upload releases.

## Package and identity

1. Run `node scripts/package-release.mjs --draft` on Windows. Upload only the **extension** ZIP to a developer-dashboard draft to obtain the stable Chrome extension ID. Keep the same listing for future updates; do not replace it with the locally generated unpacked ID.
2. Set `chromeExtensionId` in `store-config.json`. Set `edgeExtensionId` only if distributing the corresponding Edge listing. Native host `allowed_origins` must contain the actual store IDs.
3. Publish the English primary documents `PRIVACY.md` and `TERMS.md`, plus their `docs/legal/` translations, as publicly readable Markdown, for example in the project's GitHub repository. Set the policy URL to the readable English primary document; no HTML legal-document version is needed. Put the full-policy URL into the dashboard and `privacyPolicyUrl` in the configuration; `termsOfServiceUrl` can record a separate published terms URL. The bundled policy is also accessible from both interfaces' settings and player setup.
4. Provide the separate Windows connector ZIP and SHA-256 checksum through the project's official Releases page. Set `connectorDownloadUrl` to that public HTTPS release/download URL. Test a clean installation with the store draft ID.
5. Run `node scripts/package-release.mjs` for final artifacts. It refuses missing Chrome IDs or public policy/download URLs. The extension ZIP excludes all native executables, installers, source-control files, test harnesses and developer scripts. The connector ZIP contains its executable, installer, uninstaller, source, license and exact configured IDs. `bin/` and `dist/` are ignored by Git; release ZIPs are published deliberately as assets.

The signed extension store package and the native companion are distinct installations. Native setup does not scan browser profiles, bypass browser permission prompts, silently install software, change default search settings, create startup entries or bundle unrelated programs. Consider signing the native executable/installer for a public Windows release; do not tell users to disable security software.

## Single purpose and listing copy

Primary purpose: a customizable new tab page with search, saved shortcuts, wallpaper, clock/layout controls and an optional integrated Windows media widget.

Suggested disclosure for the description:

> Optional Windows media widget: display and control the media currently selected by Windows. Requires Windows 10 version 1809 or later and a separately installed Lunar Start media connector. It is off by default and asks for native-messaging permission only after you read the disclosure and select Agree and enable. The homepage remains usable without it. Current media metadata is processed temporarily on your computer and is not uploaded or stored as playback history.

Do not describe this as Google/Microsoft-endorsed, universally controlling every application, or working without the separate connector. The widget's position, visibility and consent belong only to the modern interface. Features common to modern and legacy retain their existing sharing rules.

## Permissions to justify

| Permission | Current use |
| --- | --- |
| `storage` | Local settings, wallpaper fallback data and durable right-click save queues. No Chrome Storage Sync. |
| `contextMenus` | Explicit “Save This Page to Lunar Start” context-menu action. |
| `activeTab` | Temporary title/address access only when that context menu is invoked; replaces broad `tabs` access. No browsing-history scan or background tab monitoring. |
| optional `nativeMessaging` | User-enabled Windows media widget talks to the separately installed local connector. Denial leaves core functions working; removal stops active connections. |
| exact suggestion-provider host origins | HTTPS query suggestions from the implemented DuckDuckGo, Google, Bing, Yahoo, Baidu, Sogou and 360 endpoints. No unused suggestion host permission. |

No remote JavaScript/eval or remotely downloaded extension logic is required. Suggestion responses are parsed as data. Font/image/video resources are data resources. Do not add arbitrary command execution to the native protocol.

## Privacy fields and user data

Use `PRIVACY.md` as the behavior inventory. Accurately disclose locally stored shortcuts/URLs, homepage search history, preferences and wallpapers; third-party query suggestion requests, favicon hostnames, remote image/font requests, image-search uploads and browser speech recognition; and opt-in temporary media metadata. Do not claim that no data is handled simply because the developer operates no collection server. Complete the current dashboard's categories and certifications according to their definitions and the actual release; do not invent certifications or a contact email. Privacy/support contact is the project's public Issues page; users should not post sensitive data there.

Current media values are held in memory only and cleared when that client disconnects. Consent is not implied by an earlier version's “widget visible” preference. The first use of this disclosure requires explicit opt-in even for existing users. Clearing performance caches does not erase all saved data; the policy explains full removal and separate connector removal.

## Reviewer test instructions

1. Install the extension ZIP into a clean Windows Chrome test profile. Open a modern new tab: no player appears and no native connection is created. Search, clock, bookmarks and wallpaper work without the companion.
2. Click the music-note button. Read the data/use and separate-install disclosures and open the privacy policy. Close the dialog: no permission request or native access. Repeat and deny the browser permission: the homepage still works.
3. Install the separate connector ZIP using the draft/store ID. The installer shows the IDs, destination, SHA-256 and current-user registry changes before explicit confirmation. Files go under `%LOCALAPPDATA%\LunarStart\MediaConnector`.
4. Select Agree and enable; approve the optional permission. Play a YouTube video or use a music app that exposes Windows SMTC. Confirm metadata/cover/progress and supported play/pause/seek controls. Changing the Windows current source is followed without a selector. Seeking may be disabled if the source does not support it.
5. Hide the widget or leave the new tab: that client's connection stops and temporary media is cleared. Other visible authorized pages can remain connected. Use the widget information button → Disable and revoke permission: all of this extension's media connections stop. Remove the permission through Chrome as well and confirm cleanup.
6. Switch to legacy mode: it loads no player code or native bridge. Verify saved bookmarks and non-theme preferences still synchronize. Visit privacy policy from legacy settings.
7. Run the installed Uninstall.cmd, confirm removal, and verify the matching HKCU native-host registrations and owned files are removed. Bookmarks and unrelated files remain. No startup tasks or network listeners should exist.

Automated checks: `verify-ui.mjs`, `verify-quick-save.mjs`, `verify-shared-state.mjs`, `verify-interface-version.mjs`, `verify-media-broker.mjs`, and browser `check-browser-ui.mjs --player-only` / `--versions-only`. Native `verify-native-media.mjs --fixture` controls only an isolated no-audio test session.

Before submission, also confirm rights/licenses for all bundled wallpapers, video, fonts and icon artwork; verify screenshots, description, contact details and platform limitations. Technical preparation cannot certify third-party asset rights or guarantee review approval.

## Official references

- [Native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Optional permissions and user gestures](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [activeTab and context menu invocation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [User data FAQ, including local processing](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
