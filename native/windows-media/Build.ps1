param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'bin'), [switch]$IncludeTestFixture)
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$framework = Split-Path -Parent $compiler
$metadata = Join-Path $env:WINDIR 'System32\WinMetadata'
$references = @(
    (Join-Path $metadata 'Windows.Media.winmd'),
    (Join-Path $metadata 'Windows.Foundation.winmd'),
    (Join-Path $metadata 'Windows.Storage.winmd'),
    (Join-Path $metadata 'Windows.ApplicationModel.winmd'),
    (Join-Path $framework 'System.Runtime.WindowsRuntime.dll'),
    (Join-Path $framework 'System.Runtime.InteropServices.WindowsRuntime.dll'),
    (Join-Path $framework 'System.Runtime.dll'),
    (Join-Path $framework 'System.Web.Extensions.dll')
)
foreach ($reference in @($compiler) + $references) { if (!(Test-Path -LiteralPath $reference)) { throw "Required Windows component not found: $reference" } }
$source = Join-Path $PSScriptRoot 'Host.cs'
$version = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.Substring(0, 12).ToLowerInvariant()
# Side-by-side builds let connected pages finish without locking a connector update.
$buildDirectory = Join-Path $OutputDirectory $version
New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null
$executable = Join-Path $buildDirectory 'LunarMediaHost.exe'
if (!(Test-Path -LiteralPath $executable)) {
    $temporary = Join-Path $buildDirectory 'LunarMediaHost.build.exe'
    $arguments = @('/nologo', '/optimize+', '/target:winexe', ('/out:' + $temporary))
    $arguments += $references | ForEach-Object { '/reference:' + $_ }
    & $compiler @arguments $source
    if ($LASTEXITCODE -ne 0) { throw 'Windows media bridge build failed.' }
    Move-Item -LiteralPath $temporary -Destination $executable
}
if ($IncludeTestFixture) {
    $fixtureArguments = @('/nologo', '/optimize+', '/target:winexe', ('/out:' + (Join-Path $buildDirectory 'LunarMediaFixture.exe')))
    $fixtureArguments += $references | ForEach-Object { '/reference:' + $_ }
    $fixtureArguments += @('/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll')
    & $compiler @fixtureArguments (Join-Path $PSScriptRoot 'tests\Fixture.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Silent media fixture build failed.' }
}
Write-Output $executable
