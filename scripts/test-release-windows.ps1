param([Parameter(Mandatory = $true)][string]$ReleaseDirectory)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$release = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
$portable = Join-Path $release 'portable'
$manifest = Get-Content -LiteralPath (Join-Path $portable 'manifest.json') -Raw | ConvertFrom-Json
$version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\package.json') -Raw | ConvertFrom-Json).version
if ($manifest.version -ne $version -or $manifest.runtimeVersion -ne $version -or $manifest.origin -ne 'http://127.0.0.1:47882') { throw 'Version/origin mismatch' }
$launcher = (Get-Item -LiteralPath (Join-Path $portable 'Kocokan.exe')).VersionInfo
if ($launcher.FileVersion -ne "$version.0" -or $launcher.ProductName -ne 'Kocokan' -or $launcher.CompanyName -ne 'Tripleaxle Studio') { throw 'Launcher metadata mismatch' }
$installer = Get-Item -LiteralPath (Join-Path $release "Kocokan-Setup-$version.exe")
if ($installer.VersionInfo.ProductVersion.Trim() -ne $version -or $installer.VersionInfo.ProductName.Trim() -ne 'Kocokan') { throw 'Installer metadata mismatch' }
$hashes = @(Get-Content -LiteralPath (Join-Path $portable 'checksums.json') -Raw | ConvertFrom-Json)
$files = @(Get-ChildItem -LiteralPath $portable -Recurse -File)
if ($files.Count -ne $hashes.Count + 1) { throw 'Portable manifest file coverage mismatch' }
foreach ($entry in $hashes) {
    $path = [IO.Path]::GetFullPath((Join-Path $portable $entry.path))
    if (!$path.StartsWith($portable + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Hash path escapes portable root' }
    if ((Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Portable hash mismatch: $($entry.path)" }
}
foreach ($line in (Get-Content -LiteralPath (Join-Path $release 'checksums.txt'))) {
    if ($line -notmatch '^([0-9a-f]{64})  (.+)$') { throw 'Malformed release checksum line' }
    $expected = $Matches[1]
    $path = [IO.Path]::GetFullPath((Join-Path $release $Matches[2]))
    if (!$path.StartsWith($release + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Hash path escapes release root' }
    if ((Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $expected) { throw 'Release hash mismatch' }
}
Write-Output "PASS: $($hashes.Count) portable file hashes, release SHA256, version $version, launcher/installer metadata and canonical origin"
Write-Output "Build commit: $($manifest.buildCommit); source dirty: $($manifest.sourceDirty)"
