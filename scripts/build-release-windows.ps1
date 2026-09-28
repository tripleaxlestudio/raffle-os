param(
    [string]$IsccPath = (Join-Path $PSScriptRoot '..\.packaging-cache\inno-6.7.3\ISCC.exe'),
    [switch]$Zip,
    [string]$SignCommand
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo
$version = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Product version must be major.minor.patch.' }
if (!(Test-Path -LiteralPath $IsccPath)) { throw 'Install Inno Setup 6.7.3 and pass -IsccPath to its ISCC.exe.' }
$IsccPath = (Resolve-Path -LiteralPath $IsccPath).Path
$compilerVersion = '6.7.3'
# Official 6.7.3 binaries report FileVersion 0.0.0.0; pin verified binary hashes.
$compilerPins = @{
    'ISCC.exe' = '0a8757031b33777e4c9cbffee40f11a5062b36d25cbe144c1db73b6102b80ad7'
    'ISCmplr.dll' = '85a1e3090d3a5b85319f001b7c8f9ecfad45f37eff030a67bbe29ef58b7aa2c3'
}
foreach ($name in $compilerPins.Keys) {
    if ((Get-FileHash -LiteralPath (Join-Path (Split-Path $IsccPath -Parent) $name)).Hash.ToLowerInvariant() -ne $compilerPins[$name]) { throw "Expected official Inno Setup 6.7.3 binary: $name" }
}
$release = Join-Path $repo "artifacts\release\Kocokan-$version"
if (Test-Path -LiteralPath $release) { $release += '-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') }
New-Item -ItemType Directory -Path $release | Out-Null
$portable = Join-Path $release 'portable'
& (Join-Path $PSScriptRoot 'package-windows.ps1') -OutputDirectory $portable
$manifest = Get-Content -LiteralPath (Join-Path $portable 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.version -ne $version -or $manifest.runtimeVersion -ne $version) { throw 'Inconsistent portable version.' }
# Verify the complete staging tree immediately before wrapping it.
$hashes = Get-Content -LiteralPath (Join-Path $portable 'checksums.json') -Raw | ConvertFrom-Json
foreach ($entry in $hashes) {
    if ((Get-FileHash -LiteralPath (Join-Path $portable $entry.path)).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Portable checksum mismatch: $($entry.path)" }
}
$compilerArgs = @("/DProductVersion=$version", "/DPortableRoot=$portable", "/DReleaseRoot=$release")
if ($SignCommand) { $compilerArgs += @('/DEnableSigning', "/Srelease=$SignCommand") }
& $IsccPath @compilerArgs (Join-Path $repo 'packaging\installer\Kocokan.iss')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
$installer = Join-Path $release "Kocokan-Setup-$version.exe"
if (!(Test-Path -LiteralPath $installer)) { throw 'Installer missing.' }
Copy-Item -LiteralPath (Join-Path $portable 'notices') -Destination (Join-Path $release 'notices') -Recurse
$checksumFiles = @($installer, (Join-Path $portable 'runtime\node.exe'), (Join-Path $portable 'server\kocokan-server.cjs'), (Join-Path $portable 'Kocokan.exe'), (Join-Path $portable 'checksums.json'))
if ($Zip) {
    $zipPath = Join-Path $release "Kocokan-Portable-$version.zip"
    Compress-Archive -LiteralPath $portable -DestinationPath $zipPath
    $checksumFiles += $zipPath
}
@"
Kocokan v$version

Changes:

- Sidebar footer now displays the current Kocokan version dynamically.

This release is also used to validate the v0.1.1 → v0.1.2 auto-update flow.
"@ | Set-Content -LiteralPath (Join-Path $release 'RELEASE-NOTES.txt') -Encoding utf8
$checksumFiles | ForEach-Object {
    (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $_.Substring($release.Length + 1).Replace('\', '/')
} | Set-Content -LiteralPath (Join-Path $release 'checksums.txt') -Encoding ascii
Write-Output "Release artifact: $release"
