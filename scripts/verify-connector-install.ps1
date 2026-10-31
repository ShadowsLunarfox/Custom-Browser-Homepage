$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path $workspace ('dist\installer-check-' + [Guid]::NewGuid().ToString('N'))
if (![IO.Path]::GetFullPath($testRoot).StartsWith((Join-Path $workspace 'dist') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test directory' }
$manifest = Get-Content -LiteralPath (Join-Path $workspace 'manifest.json') -Raw | ConvertFrom-Json
$archive = Join-Path $workspace ('dist\LunarStart-WindowsConnector-' + $manifest.version + '-draft.zip')
$package = Join-Path $testRoot 'package'
Expand-Archive -LiteralPath $archive -DestinationPath $package
$installRoot = Join-Path $testRoot 'LunarStart\MediaConnector'
$hostName = 'com.lunarfox.lunar_media'
$registryPaths = @(('Software\Google\Chrome\NativeMessagingHosts\' + $hostName), ('Software\Microsoft\Edge\NativeMessagingHosts\' + $hostName))
function Read-Registration([string]$path) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($path)
    if ($null -eq $key) { return '' }
    try { return $key.GetValue('') } finally { $key.Close() }
}
$registrations = @($registryPaths | ForEach-Object { Read-Registration $_ })
& (Join-Path $package 'Install.ps1') -ExtensionId ('a' * 32) -PrepareOnly -InstallDirectory $installRoot
$hostConfig = Get-Content -LiteralPath (Join-Path $installRoot ($hostName + '.json')) -Raw | ConvertFrom-Json
if ($hostConfig.allowed_origins.Count -ne 1 -or $hostConfig.allowed_origins[0] -ne ('chrome-extension://' + ('a' * 32) + '/')) { throw 'Unexpected allowed origins' }
if (!(Test-Path -LiteralPath $hostConfig.path) -or (Split-Path -Parent $hostConfig.path) -ne $installRoot) { throw 'Host was not copied to an independent install directory' }
$preserved = Join-Path $installRoot 'unrelated-user-file.txt'
[IO.File]::WriteAllText($preserved, 'retain this file')
# Exercise a package/source launcher against its default per-user destination,
# using a private test LOCALAPPDATA instead of the actual user's installation.
$originalLocalAppData = $env:LOCALAPPDATA
$launcherUninstaller = Join-Path $package 'Uninstall.ps1'
$holder = New-Object System.Diagnostics.Process
$holder.StartInfo.FileName = $hostConfig.path
$holder.StartInfo.UseShellExecute = $false
$holder.StartInfo.CreateNoWindow = $true
$holder.StartInfo.RedirectStandardInput = $true
$holder.StartInfo.RedirectStandardOutput = $true
$holder.StartInfo.RedirectStandardError = $true
[void]$holder.Start()
Start-Sleep -Milliseconds 150
if ($holder.HasExited) { throw 'Test host did not remain alive to verify locked-file removal' }
try {
    $env:LOCALAPPDATA = $testRoot
    function global:Read-Host { param($Prompt) return '' }
    & $launcherUninstaller
    if ($LASTEXITCODE -ne 2 -or !(Test-Path -LiteralPath $hostConfig.path) -or $holder.HasExited) { throw 'Blank confirmation did not cancel without changes' }
    function global:Read-Host { param($Prompt) return 'y' }
    & $launcherUninstaller
    if ($LASTEXITCODE -ne 0 -or !$holder.WaitForExit(3000)) { throw 'Confirmed uninstall did not stop its own host and complete' }
    & $launcherUninstaller -Yes # A second run is harmless and reports not installed.
} finally {
    Remove-Item -LiteralPath 'Function:\Read-Host' -ErrorAction SilentlyContinue
    $env:LOCALAPPDATA = $originalLocalAppData
    if (!$holder.HasExited) { $holder.Kill(); [void]$holder.WaitForExit(3000) }
    $holder.Dispose()
}
if (!(Test-Path -LiteralPath $preserved) -or (Test-Path -LiteralPath $hostConfig.path)) { throw 'Uninstall did not preserve unrelated files or remove its executable' }
if (!(Test-Path -LiteralPath $launcherUninstaller) -or !(Test-Path -LiteralPath (Join-Path $package 'Install.ps1'))) { throw 'Uninstall removed the project/package source files' }
for ($i = 0; $i -lt $registryPaths.Count; $i++) { if ((Read-Registration $registryPaths[$i]) -ne $registrations[$i]) { throw 'Test changed an existing connector registration' } }
# A tampered ownership marker must fail before removing anything outside its directory.
Copy-Item -LiteralPath (Join-Path $package 'Uninstall.ps1') -Destination (Join-Path $installRoot 'Uninstall.ps1')
$outside = Join-Path (Split-Path -Parent $installRoot) 'do-not-delete.txt'
[IO.File]::WriteAllText($outside, 'must remain')
@{kind='LunarStart.WindowsMediaConnector'; installDirectory=$installRoot; files=@('..\do-not-delete.txt')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installRoot 'installation.json') -Encoding UTF8
$rejected = $false
try { & (Join-Path $installRoot 'Uninstall.ps1') -Yes } catch { $rejected = $_.Exception.Message -like 'Unsafe owned-file entry*' }
if (!$rejected -or !(Test-Path -LiteralPath $outside)) { throw 'Uninstall ownership boundary failed' }
# Source launcher must apply the same checks to an explicitly supplied location.
$rejected = $false
try { & $launcherUninstaller -InstallDirectory $installRoot -Yes } catch { $rejected = $_.Exception.Message -like 'Unsafe owned-file entry*' }
if (!$rejected -or !(Test-Path -LiteralPath $outside)) { throw 'Package launcher bypassed ownership checks' }
# Installed CMD must finish its buffered block even when PowerShell deletes it.
$cmdInstallRoot = Join-Path $testRoot 'cmd-check\LunarStart\MediaConnector'
& (Join-Path $package 'Install.ps1') -ExtensionId ('a' * 32) -PrepareOnly -InstallDirectory $cmdInstallRoot
$cmdRunner = New-Object System.Diagnostics.Process
$cmdRunner.StartInfo.FileName = $env:ComSpec
$cmdRunner.StartInfo.Arguments = '/d /c ""' + (Join-Path $cmdInstallRoot 'Uninstall.cmd') + '" -Yes"'
$cmdRunner.StartInfo.UseShellExecute = $false
$cmdRunner.StartInfo.CreateNoWindow = $true
$cmdRunner.StartInfo.RedirectStandardOutput = $true
$cmdRunner.StartInfo.RedirectStandardError = $true
[void]$cmdRunner.Start()
if (!$cmdRunner.WaitForExit(15000)) { $cmdRunner.Kill(); throw 'Installed CMD launcher did not finish' }
$cmdOutput = $cmdRunner.StandardOutput.ReadToEnd() + $cmdRunner.StandardError.ReadToEnd()
if ($cmdRunner.ExitCode -ne 0 -or (Test-Path -LiteralPath $cmdInstallRoot)) { throw ('Installed CMD uninstall failed: ' + $cmdOutput) }
$cmdRunner.Dispose()
Write-Output 'PASS: blank cancellation, lowercase confirmation, occupied-executable removal, installed self-deleting CMD, source/package entry points, repeat removal, registration/file preservation and traversal rejection. No user registration changed.'
