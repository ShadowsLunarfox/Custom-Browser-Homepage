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

Primary purpose: a customizable new tab page with search, saved shortcuts, wallpaper, clock/layout controls and optional integrated Windows media and system-usage widgets.

Suggested disclosure for the description:

> Optional Windows media widget: display and control the media selected by Windows. Requires Windows 10 version 1809 or later and a separate Lunar Start media connector. It starts disabled and asks for permission after its disclosure. Select background updates to keep following Windows while homepages are closed; uncheck it for visible-widget-only access. Only the latest state is cached in browser-session memory, without playback history, backups or upload. Disable and revoke permission stops access and clears the cache.

> Optional system monitor (modern mode): display whole-computer CPU usage and physical memory used/total. It requests CPU/memory permissions only after you enable it and needs no companion program. Select background updates for continued shared sampling while homepages are closed; uncheck it to sample only for visible widgets. Only the latest reading is cached in browser-session memory. No history, backups or upload. Disable it to revoke its separate permissions and clear the cache without affecting media access.

Do not describe this as Google/Microsoft-endorsed, universally controlling every application, or working without the separate connector. The widget's position, visibility and consent belong only to the modern interface. Features common to modern and legacy retain their existing sharing rules.

## Permissions to justify

| Permission | Current use |
| --- | --- |
| `storage` | Local settings, wallpaper fallback data and durable right-click save queues. No Chrome Storage Sync. |
| `contextMenus` | Explicit “Save This Page to Lunar Start” context-menu action. |
| `activeTab` | Temporary title/address access only when that context menu is invoked; replaces broad `tabs` access. No browsing-history scan or background tab monitoring. |
| optional `nativeMessaging` | User-enabled Windows media widget talks to the separately installed local connector. Denial leaves core functions working; removal stops active connections. |
| optional `system.cpu`, `system.memory` | Explicitly enabled shared CPU/memory sampler. Background access is a separate checkbox; unchecking it limits sampling to visible widgets. No native connector, process list or memory-content access. The latest cache remains in browser-session memory; disabling revokes only these permissions and clears the cache. |
| `alarms` | Recover explicitly enabled background sampling after a worker restart. An alarm exists only for a feature with background updates selected; it is not used for unrelated activity. |
| exact suggestion-provider host origins | HTTPS query suggestions from the implemented DuckDuckGo, Google, Bing, Yahoo, Baidu, Sogou and 360 endpoints. No unused suggestion host permission. |

No remote JavaScript/eval or remotely downloaded extension logic is required. Suggestion responses are parsed as data. Font/image/video resources are data resources. Do not add arbitrary command execution to the native protocol.

## Privacy fields and user data

Use `PRIVACY.md` as the behavior inventory. Accurately disclose locally stored shortcuts/URLs, homepage search history, preferences and wallpapers; third-party query suggestion requests, favicon hostnames, remote image/font requests, image-search uploads and browser speech recognition; and opt-in temporary media metadata. Do not claim that no data is handled simply because the developer operates no collection server. Complete the current dashboard's categories and certifications according to their definitions and the actual release; do not invent certifications or a contact email. Privacy/support contact is the project's public Issues page; users should not post sensitive data there.

Current media and hardware readings are cached only as the latest state in browser-session memory. Page disconnection clears that page's display, while explicitly selected background work can continue. Disable/revocation clears the shared feature cache. Earlier visibility/foreground consent does not imply background consent; the updated disclosure requires opt-in. Clearing performance caches does not erase all saved data; the policy explains full removal and separate connector removal.

## Reviewer test instructions

1. Install the extension ZIP into a clean Windows Chrome test profile. Open a modern new tab: no player appears and no native connection is created. Search, clock, bookmarks and wallpaper work without the companion.
2. Click the music-note button. Read the data/use and separate-install disclosures and open the privacy policy. Close the dialog: no permission request or native access. Repeat and deny the browser permission: the homepage still works.
3. Install the separate connector ZIP using the draft/store ID. The installer shows the IDs, destination, SHA-256 and current-user registry changes before explicit confirmation. Files go under `%LOCALAPPDATA%\LunarStart\MediaConnector`.
4. Select Agree and enable; approve the optional permission. Play a YouTube video or use a music app that exposes Windows SMTC. Confirm metadata/cover/progress and supported play/pause/seek controls. Changing the Windows current source is followed without a selector. Seeking may be disabled if the source does not support it.
5. Enable background updates and close every homepage while leaving the browser running. Reopen and verify the latest media/CPU cache is shown without reconnecting the native host or collecting a fresh CPU interval. Uncheck background updates and close the last visible widget: reading should stop and its cache should clear. Use Disable and revoke permission to stop a feature across all tabs and clear its cache; removing its permission through the browser must do the same. No background poll may trigger playback controls.
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
