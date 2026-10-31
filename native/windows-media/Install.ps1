param(
    [string[]]$ExtensionId,
    [switch]$Yes,
    [switch]$PrepareOnly,
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'LunarStart\MediaConnector'),
    [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
if ($Uninstall) { & (Join-Path $PSScriptRoot 'Uninstall.ps1') -InstallDirectory $InstallDirectory -Yes:$Yes; exit $LASTEXITCODE }
if ([Environment]::OSVersion.Version.Build -lt 17763) { throw 'Windows 10 version 1809 or later is required.' }
$hostName = 'com.lunarfox.lunar_media'
$installRoot = [IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
if ((Split-Path -Leaf $installRoot) -ne 'MediaConnector' -or (Split-Path -Leaf (Split-Path -Parent $installRoot)) -ne 'LunarStart') { throw 'Choose an install directory ending in LunarStart\MediaConnector.' }
$manifestPath = Join-Path $installRoot ($hostName + '.json')
$markerPath = Join-Path $installRoot 'installation.json'
$previous = $null
if (Test-Path -LiteralPath $markerPath) {
    $previous = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
    if ($previous.kind -ne 'LunarStart.WindowsMediaConnector' -or $previous.installDirectory -ne $installRoot) { throw 'Existing installation marker does not belong to this connector.' }
}
$registryPaths = @(('Software\Google\Chrome\NativeMessagingHosts\' + $hostName), ('Software\Microsoft\Edge\NativeMessagingHosts\' + $hostName))
$ids = New-Object 'System.Collections.Generic.HashSet[string]'
$configPath = Join-Path $PSScriptRoot 'connector-config.json'
if (Test-Path -LiteralPath $configPath) {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if ($config.draft) { Write-Output 'DRAFT DEVELOPMENT PACKAGE - not configured as a public store release.' }
    foreach ($id in $config.extensionIds) { if ($id -notmatch '^[a-p]{32}$') { throw 'The connector package has an invalid extension ID.' }; [void]$ids.Add($id) }
}
foreach ($id in $ExtensionId) { if ($id -notmatch '^[a-p]{32}$') { throw "Invalid extension ID: $id" }; [void]$ids.Add($id) }
if ($ids.Count -eq 0) {
    if ($Yes -or $PrepareOnly) { throw 'Pass -ExtensionId with the ID displayed by the extension. Browser profiles are not inspected.' }
    $entered = Read-Host 'Paste the extension ID from player setup (32 lowercase letters, a-p)'
    foreach ($id in ($entered -split '[,;\s]+' | Where-Object { $_ })) { if ($id -notmatch '^[a-p]{32}$') { throw "Invalid extension ID: $id" }; [void]$ids.Add($id) }
}
if ($ids.Count -eq 0) { throw 'No extension ID supplied. No changes made.' }
$payload = Join-Path $PSScriptRoot 'payload\LunarMediaHost.exe'
if (!(Test-Path -LiteralPath $payload)) { $payload = & (Join-Path $PSScriptRoot 'Build.ps1') }
$payload = [IO.Path]::GetFullPath($payload)
$digest = (Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant()
$exeName = 'LunarMediaHost-' + $digest.Substring(0, 12) + '.exe'
$executable = Join-Path $installRoot $exeName
if ((Test-Path -LiteralPath $executable) -and (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant() -ne $digest) { throw 'Existing connector executable does not match this package. No registration changed.' }
Write-Output 'Lunar Start Windows media connector - optional, current-user installation'
Write-Output ('Install directory: ' + $installRoot)
Write-Output ('Allowed extension IDs: ' + (($ids | Sort-Object) -join ', '))
Write-Output ('Executable SHA-256: ' + $digest)
Write-Output 'Changes: copy connector/uninstaller files and register Chrome/Edge native messaging under HKCU.'
Write-Output 'No browser profile access, admin permission, startup entry, network listener, or unrelated software.'
if (!$Yes -and !$PrepareOnly) {
    $answer = [string](Read-Host 'Install this connector? Type Y or YES, then press Enter. Enter alone cancels')
    if ($answer.Trim() -notin @('Y', 'YES', ([string][char]0x662f))) { Write-Output 'Canceled. No installation changes made.'; exit 2 }
}
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
if (!(Test-Path -LiteralPath $executable)) { Copy-Item -LiteralPath $payload -Destination $executable }
foreach ($name in @('Uninstall.ps1', 'Uninstall.cmd')) {
    $sourcePath = Join-Path $PSScriptRoot $name
    $destinationPath = Join-Path $installRoot $name
    if ([IO.Path]::GetFullPath($sourcePath) -ne $destinationPath) { Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force }
}
$manifest = @{name=$hostName; description='Lunar Start Windows media session connector'; path=$executable; type='stdio'; allowed_origins=@($ids | Sort-Object | ForEach-Object { 'chrome-extension://' + $_ + '/' })}
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), $utf8)
$ownedFiles = @($exeName, ($hostName + '.json'), 'Uninstall.ps1', 'Uninstall.cmd', 'installation.json')
if ($null -ne $previous) {
    $ownedFiles += @($previous.files | Where-Object { $_ -match '^LunarMediaHost-[a-f0-9]{12}\.exe$' })
}
$marker = @{kind='LunarStart.WindowsMediaConnector'; installDirectory=$installRoot; extensionIds=@($ids); files=@($ownedFiles | Sort-Object -Unique); sha256=$digest}
[IO.File]::WriteAllText($markerPath, ($marker | ConvertTo-Json -Depth 4), $utf8)
if ($PrepareOnly) { Write-Output 'Prepared files only. No registry entries changed.'; exit }
foreach ($registryPath in $registryPaths) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($registryPath)
    try { $key.SetValue('', $manifestPath, [Microsoft.Win32.RegistryValueKind]::String) } finally { $key.Close() }
}
Write-Output 'Installed. Open player setup, read the disclosure, and choose Agree and enable.'
Write-Output ('To remove: run ' + (Join-Path $installRoot 'Uninstall.cmd'))
