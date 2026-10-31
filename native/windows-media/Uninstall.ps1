param([switch]$Yes, [string]$InstallDirectory, [switch]$Pause)
$ErrorActionPreference = 'Stop'
try {
$launcherRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
if (!$InstallDirectory) {
    if ((Split-Path -Leaf $launcherRoot) -eq 'MediaConnector' -and (Split-Path -Leaf (Split-Path -Parent $launcherRoot)) -eq 'LunarStart') {
        $InstallDirectory = $launcherRoot
    } else {
        # Project and extracted-package launchers point to the installed copy;
        # their own folders must never be treated as uninstall targets.
        $InstallDirectory = Join-Path $env:LOCALAPPDATA 'LunarStart\MediaConnector'
    }
}
$installRoot = [IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
if ((Split-Path -Leaf $installRoot) -ne 'MediaConnector' -or (Split-Path -Leaf (Split-Path -Parent $installRoot)) -ne 'LunarStart') { throw 'Invalid connector installation directory. No files removed.' }
$hostName = 'com.lunarfox.lunar_media'
$manifestPath = Join-Path $installRoot ($hostName + '.json')
$registryPaths = @(('Software\Google\Chrome\NativeMessagingHosts\' + $hostName), ('Software\Microsoft\Edge\NativeMessagingHosts\' + $hostName))
$markerPath = Join-Path $installRoot 'installation.json'
if (!(Test-Path -LiteralPath $markerPath)) {
    $hasRegistration = $false
    foreach ($registryPath in $registryPaths) {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registryPath)
        if ($null -ne $key) { try { if ($key.GetValue('') -eq $manifestPath) { $hasRegistration = $true } } finally { $key.Close() } }
    }
    $connectorFiles = @()
    if (Test-Path -LiteralPath $installRoot -PathType Container) {
        $connectorFiles = @(Get-ChildItem -LiteralPath $installRoot -File -Force | Where-Object { $_.Name -match '^(?:LunarMediaHost-[a-f0-9]{12}\.exe|com\.lunarfox\.lunar_media\.json|Uninstall\.ps1|Uninstall\.cmd)$' })
    }
    if ($hasRegistration -or $connectorFiles.Count) {
        Write-Output ('UNINSTALL INCOMPLETE: the installation record is missing, but connector files or registration remain at: ' + $installRoot)
        Write-Output 'Reinstall the connector to restore its ownership record, then uninstall again. No files were removed.'
        exit 1
    }
    Write-Output 'The Windows media connector is already uninstalled or has not been installed.'
    Write-Output 'No action is needed. This is not an error.'
    Write-Output ('Checked installation directory: ' + $installRoot)
    Write-Output 'Project source and bin build-cache files are separate and are not uninstall targets.'
    exit 0
}
$marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
if ($marker.kind -ne 'LunarStart.WindowsMediaConnector' -or $marker.installDirectory -ne $installRoot -or !$marker.files) { throw 'Installation marker is invalid. No files removed.' }
$allowedNames = '^(?:LunarMediaHost-[a-f0-9]{12}\.exe|com\.lunarfox\.lunar_media\.json|Uninstall\.ps1|Uninstall\.cmd|installation\.json)$'
foreach ($name in $marker.files) {
    $target = [IO.Path]::GetFullPath((Join-Path $installRoot $name))
    if ($name -notmatch $allowedNames -or (Split-Path -Parent $target) -ne $installRoot) { throw 'Unsafe owned-file entry. No files removed.' }
}
Write-Output ('Remove this connector registration and its owned files from: ' + $installRoot)
Write-Output 'This closes only connector processes owned by this installation. Browsers and music apps stay open.'
Write-Output 'Project files, bookmarks and homepage settings are retained.'
if (!$Yes) {
    $answer = [string](Read-Host 'Uninstall? Type Y or YES, then press Enter. Enter alone cancels')
    $answer = $answer.Trim()
    if ($answer -notin @('Y', 'YES', ([string][char]0x662f))) { Write-Output 'Canceled. No files or registration were removed.'; exit 2 }
}
foreach ($registryPath in $registryPaths) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registryPath)
    if ($null -eq $key) { continue }
    $registered = $key.GetValue(''); $key.Close()
    if ($registered -eq $manifestPath) { [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($registryPath, $false) }
}
$ownedExecutables = @($marker.files | Where-Object { $_ -match '^LunarMediaHost-[a-f0-9]{12}\.exe$' } | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $installRoot $_)) })
foreach ($process in Get-Process -Name 'LunarMediaHost*' -ErrorAction SilentlyContinue) {
    try {
        # Match the full executable path, never just its name. Other installations
        # and test/build programs are outside this uninstall's ownership boundary.
        $processPath = $process.Path
        if ($processPath -and $ownedExecutables -contains [IO.Path]::GetFullPath($processPath)) {
            Stop-Process -InputObject $process -ErrorAction Stop
            if (!$process.WaitForExit(5000)) { Write-Output ('Connector process did not exit: ' + $process.Id) }
        }
    } catch { Write-Output ('Could not close a connector process; file deletion will verify whether it is still in use. ' + $_.Exception.Message) }
}
$leftovers = @()
foreach ($name in $marker.files | Where-Object { $_ -notin @('installation.json', 'Uninstall.ps1', 'Uninstall.cmd') }) {
    $target = Join-Path $installRoot $name
    for ($attempt = 0; $attempt -lt 10 -and (Test-Path -LiteralPath $target); $attempt++) {
        try { Remove-Item -LiteralPath $target -Force } catch { if ($attempt -lt 9) { Start-Sleep -Milliseconds 100 } }
    }
    if (Test-Path -LiteralPath $target) { $leftovers += $target }
}
if ($leftovers.Count) { Write-Output ('UNINSTALL INCOMPLETE. Registration was removed, but these files remain: ' + ($leftovers -join ', ')); Write-Output 'The ownership record and uninstall tools were retained for retry.'; exit 1 }
foreach ($name in @('Uninstall.ps1', 'Uninstall.cmd')) { Remove-Item -LiteralPath (Join-Path $installRoot $name) -Force }
Remove-Item -LiteralPath $markerPath -Force
if (!(Get-ChildItem -LiteralPath $installRoot -Force | Select-Object -First 1)) { try { Remove-Item -LiteralPath $installRoot -Force } catch { } }
$remaining = @($marker.files | Where-Object { Test-Path -LiteralPath (Join-Path $installRoot $_) })
if ($remaining.Count) { Write-Output ('UNINSTALL INCOMPLETE. These owned files remain: ' + ($remaining -join ', ')); exit 1 }
foreach ($registryPath in $registryPaths) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registryPath)
    if ($null -ne $key) { try { if ($key.GetValue('') -eq $manifestPath) { throw 'UNINSTALL INCOMPLETE. Connector registration still exists.' } } finally { $key.Close() } }
}
Write-Output 'VERIFIED: installed connector files and matching Chrome/Edge registrations were removed.'
Write-Output 'Project source/build files and homepage user data were retained.'
exit 0
} catch {
    if ($Pause) { Write-Host ('UNINSTALL FAILED: ' + $_.Exception.Message); exit 1 }
    throw
} finally {
    if ($Pause -and !$Yes) { [void](Read-Host 'Press Enter to close this result window') }
}
