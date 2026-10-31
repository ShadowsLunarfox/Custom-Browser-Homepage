# Windows media connector

The modern-only widget automatically follows the exact current media session selected by Windows, including sessions within the same browser. There is no manual source selector or remembered source. It reads the current title, artist, artwork, playback state, and timeline. Playback, pause, track changes, and seeking are enabled only when the source advertises support. Live streams and some applications cannot seek.

The widget is disabled by default. Its setup explains the data used before the user chooses **Agree and enable** and grants the optional `nativeMessaging` permission. Canceling or denying access leaves the homepage usable and does not start a native connection. Disabling the feature revokes the permission across extension tabs and clears temporary media data.

The browser extension never installs this program automatically. Download the separate Windows connector ZIP from the official release, extract it, and run `Install.cmd`. Review the displayed directory, extension IDs and current-user registration changes, type `Y` or `YES` and press Enter to install; an empty answer cancels. The result window stays open so cancellation cannot be mistaken for installation. Official packages use the configured store IDs; development packages ask for the ID displayed in player setup. The installer never reads Chrome/Edge profile files. No administrator account, network download, Windows startup entry, or listening network service is needed.

For a development extension, you can supply the ID explicitly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1 -ExtensionId YOUR_EXTENSION_ID
```

Installation copies the executable and uninstaller into `%LOCALAPPDATA%\LunarStart\MediaConnector`, independently of the extension's installation/update folder. Release packages contain a prebuilt executable; running the installer from source builds it using Windows' inbox .NET Framework compiler. Choose **Agree and enable** in player setup, then reconnect. The player lives only on the modern homepage. The broker checks native-messaging permission before each forwarded request, rejects legacy-page clients, and shares one host among authorized clients. The host exits when the last client disconnects. Hiding the widget or leaving the homepage disconnects that client and clears its temporary media display; no playback command is sent automatically.

Permission granted is separate from connector connected. Player setup shows both, offers **Check connection**, and distinguishes a missing connector, an extension-ID rejection, a startup failure and a timeout. A valid Windows response is required before reporting connected; a connected host with no current media is shown as connected and idle. Returning focus to an enabled visible offline widget checks the connection again, useful after completing the installer. No detection starts before consent or while the widget is hidden.

To unregister this connector:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\LunarStart\MediaConnector\Uninstall.ps1"
```

Run `Uninstall.cmd` from the project, an extracted connector package, or the installed directory. Type `Y` or `YES` and press Enter; a blank answer cancels. The result window stays open. Project/package launchers automatically target `%LOCALAPPDATA%\LunarStart\MediaConnector`; they never remove their own source folder or its `bin` build cache. An installed launcher targets its own installation. For a custom install location, pass `-InstallDirectory` with that exact path. The uninstaller validates ownership, removes matching registrations, and stops only connector processes whose full executable path belongs to that installation before removing its recorded files. It preserves browsers, music apps, other installations, unrelated files and homepage data. Success is reported only after files and matching registrations are verified absent; any remaining owned file produces an incomplete result and failure exit code. Running it after removal reports that nothing is installed. Uninstalling the browser extension alone does not uninstall the connector.

Running the project uninstaller after removal is normal: it says **already uninstalled or not installed**, **no action needed**, and returns success. This is distinct from an incomplete installation: if connector files or a matching registration remain but the ownership record is missing, it reports **UNINSTALL INCOMPLETE**, returns failure, and preserves files until the installation is repaired. The final Enter prompt only closes the result window.

The installer changes only `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.lunarfox.lunar_media` and the corresponding `Microsoft\Edge` key. It registers only explicitly supplied IDs or IDs in the package's `connector-config.json`; wildcards are never used.

Source builds live under `bin/<source-hash>/`. Installed executables use content-hashed names, so updating does not overwrite a program used by an open homepage. Re-run the installer after changing the connector, then reconnect to use the new build. `node scripts/package-release.mjs --draft` creates separate extension and connector review ZIPs; configure `release/store-config.json` before creating a public release.

The executable accepts length-prefixed UTF-8 JSON through stdin/stdout. Commands are restricted to status and Windows media actions; it never executes arbitrary commands or scripts. Native responses remain below Chrome's 1 MB limit, and unchanged artwork is omitted from subsequent polls. `LunarMediaHost.exe --probe` reads a snapshot without changing playback; its output includes artwork and should not be logged wholesale.

For read-only protocol verification, run `node scripts/verify-native-media.mjs` from the project root after building. To test real Windows controls without touching existing media, build with `powershell -NoProfile -ExecutionPolicy Bypass -File native/windows-media/Build.ps1 -IncludeTestFixture`, then run `node scripts/verify-native-media.mjs --fixture`. The fixture publishes its own hidden-window SMTC session with a silent timeline; only that session receives playback and seek commands. The test process is removed when checks finish.

The host keeps Windows operations and their results on one thread. It listens for Windows current-session changes and reads `GetCurrentSession()` directly, without approximating by app name or picking another session from a list. Status requests cannot pin an older source. Actions must match the displayed current-session ID; if Windows changes the selection before a click reaches the host, the stale action is rejected and the widget refreshes immediately. A seek begun on a previous source is canceled when the source changes.

References: [Windows media sessions](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager), [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging).
