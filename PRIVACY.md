# Lunar Start Page Privacy Policy

Status: general draft, not yet effective as a public-release policy. Last updated: 2026-10-31. The publisher will announce an effective date when publishing.

Languages: [English](PRIVACY.md) · [简体中文](docs/legal/PRIVACY.zh-CN.md) · [繁體粵語](docs/legal/PRIVACY.yue.md) · [日本語](docs/legal/PRIVACY.ja.md) · [한국어](docs/legal/PRIVACY.ko.md) · [ไทย](docs/legal/PRIVACY.th.md) · [Bahasa Melayu](docs/legal/PRIVACY.ms.md)

## 1. Scope and contact

This policy covers the modern and legacy Lunar Start Page interfaces and this project's optional Windows media connector. The project is maintained by Lunarfox, GitHub username ShadowsLunarfox. It does not govern browsers, stores, search engines or other third parties' own processing.

Contact [project support](https://github.com/ShadowsLunarfox/Lunar-Start-Page/issues) with privacy questions. Issues are public: do not post private URLs, media details, backups, passwords or sensitive information. Ask for an appropriate private channel before sharing such information.

## 2. Information on your device

The extension stores saved/imported shortcut names and URLs, icon information, ordering and pins, homepage search history, language, interface choice, appearance, layout, feature preferences and custom wallpapers in browser-local storage or IndexedDB. Right-click saving reads the title and URL of the page you choose to save; it does not scan your complete browsing history or continuously monitor all tabs.

Modern/legacy synchronization takes place within the same browser profile, not through a developer cloud. The extension does not upload these records through Chrome Storage Sync. Diagnostics are generated locally; their contents leave that local interface only if you choose to copy, export or submit them.

## 3. Search and third-party requests

- A submitted search sends the query to the selected provider. Online suggestions send typed text to the relevant configured suggestion providers and, when necessary, fallback providers. Multi-engine mode may contact several providers. You can turn suggestions off.
- Google's favicon service may receive a saved site's hostname. Remote icons, wallpapers and other addresses you supply contact their respective servers.
- Google image search receives the image you explicitly select or drop into that feature. After you start voice search and grant browser permission, the browser's speech-recognition provider may process audio. The extension does not retain recordings.
- The legacy Cartoon theme may load Google Fonts. Bundled wallpapers are local; choosing a local wallpaper does not upload it to the developer.

Providers ordinarily receive IP addresses, request times and normal network information, may use their own cookies, and may process data in other countries under their own policies. The extension does not send Windows media metadata to these services. Browsers, stores and GitHub also have independent policies.

## 4. Optional Windows media widget

The widget starts disabled. Connecting requires reading its disclosure, choosing Agree and enable, granting optional native-messaging permission, and separately installing the connector. The extension never installs it automatically.

While enabled and visible in a visible modern homepage, the connector reads Windows' current media session: app, title, artist, cover, playback state, duration, position and supported controls. This information is used only to display/control that media, held temporarily in local memory, and not uploaded to the developer, stored as playback history or included in backups. Playback commands follow your use of a control.

Hiding the widget or leaving the page disconnects that client and clears its temporary media display; other visible enabled pages may remain connected. Disable and revoke permission stops this extension's media connections across tabs. Legacy mode does not load the widget.

The installer registers only explicitly supplied IDs or official package IDs under the current Windows user's native-messaging keys. It does not inspect browser profiles, add startup entries, listen on a network port or install unrelated software.

## 5. Purposes, disclosure and Limited Use

Data is used for the homepage, search, shortcuts, appearance, diagnostics and media functions described here. The project operates no user-account backend, telemetry analytics, advertising profiles or data-selling service. Data is not used for personalized advertising, credit decisions or unrelated purposes.

Our use and transfer of browser/Google API information follows the Chrome Web Store User Data Policy and its Limited Use rules. Third-party transfers are confined to disclosed functionality and legally permitted necessary circumstances. Information you voluntarily submit for support is used to address your request, maintain security and meet applicable legal duties; public support content is retained by GitHub under its rules.

## 6. Retention and security

Local shortcuts, settings and wallpapers remain until changed or their storage is removed. Interface deletion may leave synchronization deletion markers or historical state; it is not a complete storage wipe. Current media is temporary. You control exported backup retention.

Built-in network services use HTTPS; user-supplied links/resources depend on their destinations. The extension does not separately encrypt local shortcuts or exported backups. Protect your device, browser profile and backup files. No software or third-party service can promise absolute security.

## 7. Choices and rights

You can edit/delete homepage items, manage local search history, turn suggestions off, revoke optional permissions and export data. Performance-cache cleanup does not erase all user data. For complete removal, uninstall the extension, clear its local data using browser facilities, and remove your own exported backups.

Uninstall the connector separately: removing the extension does not remove Windows connector files/registration. The project's bin folder is a separate build cache, not the installed connector.

Depending on applicable law, rights may include access, correction, deletion, restriction, objection, portability, consent withdrawal and complaints to a regulator. Most data exists only on your device; the developer cannot remotely access/delete it but can offer instructions. Contact the relevant provider about its records. Withdrawal does not undo earlier lawful processing.

## 8. Children, changes and languages

The project is not directed specifically to children and does not deliberately request children's personal information. Minors should obtain guardian assistance where local law requires it. Contact support about privacy concerns.

Material changes to purposes or permissions will be reflected here, with additional notice/consent where required. Translations aim to express the same policy. Differences must not reduce mandatory local rights; no language is automatically controlling in every jurisdiction.

See [Terms of Service](TERMS.md) and [source-code license](LICENSE).
