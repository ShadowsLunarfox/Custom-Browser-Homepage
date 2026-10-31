$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('LunarStart-uninstall-status-' + [Guid]::NewGuid().ToString('N'))
$installRoot = Join-Path $testRoot 'LunarStart\MediaConnector'
$uninstaller = Join-Path $workspace 'native\windows-media\Uninstall.ps1'
# Explicit test directory: never point these invocations at the actual user's install.
$result = @(& $uninstaller -InstallDirectory $installRoot -Yes)
if ($LASTEXITCODE -ne 0 -or ($result -join "`n") -notlike '*No action is needed. This is not an error.*' -or (Test-Path -LiteralPath $installRoot)) { throw 'A missing installation was not treated as a normal no-op' }
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
$unrelated = Join-Path $installRoot 'user-file.txt'
[IO.File]::WriteAllText($unrelated, 'preserve unrelated data')
$result = @(& $uninstaller -InstallDirectory $installRoot -Yes)
if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $unrelated)) { throw 'An unrelated file changed the already-uninstalled result' }
$partialFile = Join-Path $installRoot 'LunarMediaHost-aaaaaaaaaaaa.exe'
[IO.File]::WriteAllText($partialFile, 'non-executable test placeholder')
$result = @(& $uninstaller -InstallDirectory $installRoot -Yes)
if ($LASTEXITCODE -ne 1 -or ($result -join "`n") -notlike '*UNINSTALL INCOMPLETE*' -or !(Test-Path -LiteralPath $partialFile) -or !(Test-Path -LiteralPath $unrelated)) { throw 'An incomplete installation was incorrectly reported as removed' }
Write-Output 'PASS: already-uninstalled and never-installed states succeed without changes; unrelated files are preserved; missing ownership records with connector leftovers report failure.'
