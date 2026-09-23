param([switch]$Zip)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo
$nodeVersion = '22.23.2'
$nodeHash = '1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97'
$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
$cache = Join-Path $repo '.packaging-cache'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$archive = Join-Path $cache "node-v$nodeVersion-win-x64.zip"
if (!(Test-Path -LiteralPath $archive)) {
    & curl.exe --fail --location --silent --show-error $nodeUrl --output $archive
    if ($LASTEXITCODE -ne 0) { throw 'Node download failed.' }
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $nodeHash) { throw 'Node archive checksum mismatch. Remove the invalid cached archive and retry.' }
Expand-Archive -LiteralPath $archive -DestinationPath $cache -Force
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
& npm.cmd run build:runtime
if ($LASTEXITCODE -ne 0) { throw 'Runtime build failed.' }
# Unique output avoids stale assets and never deletes an existing delivery.
$output = Join-Path $repo ('artifacts\Kocokan-Pilot-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $output | Out-Null
& dotnet publish packaging/launcher/Kocokan.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o $output
if ($LASTEXITCODE -ne 0) { throw 'Launcher publish failed.' }
foreach ($directory in @('runtime', 'server', 'web', 'notices')) { New-Item -ItemType Directory -Path (Join-Path $output $directory) | Out-Null }
Copy-Item -LiteralPath (Join-Path $cache "node-v$nodeVersion-win-x64\node.exe") -Destination (Join-Path $output 'runtime\node.exe')
Copy-Item -LiteralPath 'dist-runtime\kocokan-server.cjs' -Destination (Join-Path $output 'server')
Copy-Item -Path 'dist\*' -Destination (Join-Path $output 'web') -Recurse
Copy-Item -LiteralPath (Join-Path $cache "node-v$nodeVersion-win-x64\LICENSE") -Destination (Join-Path $output 'notices\NODE-LICENSE.txt')
# Runtime pack licenses are not automatically copied by dotnet publish.
$nugetRoot = $env:NUGET_PACKAGES
if (!$nugetRoot) { $nugetRoot = Join-Path $env:USERPROFILE '.nuget\packages' }
[xml]$launcherProject = Get-Content -LiteralPath 'packaging\launcher\Kocokan.csproj'
$dotnetVersion = $launcherProject.Project.PropertyGroup.RuntimeFrameworkVersion
foreach ($pack in @('microsoft.netcore.app.runtime.win-x64', 'microsoft.windowsdesktop.app.runtime.win-x64')) {
    $packPath = Join-Path $nugetRoot "$pack\$dotnetVersion"
    $licenses = @(Get-ChildItem -LiteralPath $packPath -File | Where-Object { $_.Name -match '^(LICENSE|THIRD-PARTY-NOTICES)' })
    if ($licenses.Count -eq 0) { throw "Missing .NET runtime license: $pack" }
    foreach ($license in $licenses) { Copy-Item -LiteralPath $license.FullName -Destination (Join-Path $output "notices\$pack-$($license.Name)") }
}
# Include installed production dependency notices, including transitive packages.
# Windows PowerShell 5.1 cannot deserialize npm's empty root-package key.
# Root metadata is not a dependency and is skipped by the prefix filter below.
$lock = ((Get-Content -LiteralPath package-lock.json -Raw) -replace '""\s*:', '"__root":') | ConvertFrom-Json
$noticeIndex = @()
foreach ($entry in $lock.packages.PSObject.Properties) {
    if (!$entry.Name.StartsWith('node_modules/')) { continue }
    $isDev = $entry.Value.PSObject.Properties['dev']
    if ($null -ne $isDev -and $isDev.Value) { continue }
    $dependency = Join-Path $repo $entry.Name
    $name = $entry.Name.Replace('node_modules/', '').Replace('/', '_')
    $files = @(Get-ChildItem -LiteralPath $dependency -File | Where-Object { $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE)' })
    if ($files.Count -eq 0) { throw "Missing production license: $($entry.Name)" }
    foreach ($file in $files) { Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $output "notices\$name-$($file.Name)") }
    $noticeIndex += "$($entry.Name) $($entry.Value.version)"
}
$noticeIndex | Set-Content -LiteralPath (Join-Path $output 'notices\DEPENDENCIES.txt') -Encoding utf8
$commit = (& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve build commit.' }
$dirty = [bool](& git status --porcelain --untracked-files=normal)
$package = Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json
$runtimeConfig = Get-Content -LiteralPath (Join-Path $output 'Kocokan.runtimeconfig.json') -Raw | ConvertFrom-Json
$manifest = [ordered]@{
    application = 'Kocokan'; version = 'packaging-pilot-p2'; origin = 'http://127.0.0.1:47882'
    runtimeVersion = "$($package.version)-packaging-pilot-p2"; nodeVersion = $nodeVersion
    nodeSource = $nodeUrl; nodeArchiveSha256 = $nodeHash
    nodeBinarySha256 = (Get-FileHash -LiteralPath (Join-Path $output 'runtime\node.exe')).Hash.ToLowerInvariant()
    launcherRuntime = $runtimeConfig.runtimeOptions.includedFrameworks
    targetFramework = 'net8.0-windows'; runtimeIdentifier = 'win-x64'; selfContained = $true
    buildCommit = $commit; sourceDirty = $dirty; builtAtUtc = [DateTime]::UtcNow.ToString('o')
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $output 'manifest.json') -Encoding utf8
Copy-Item -LiteralPath 'packaging\README-PORTABLE.txt' -Destination (Join-Path $output 'README.txt')
# Hash all shipped files so an uncommitted pilot build is still identifiable.
$hashes = @(Get-ChildItem -LiteralPath $output -Recurse -File | Sort-Object FullName | ForEach-Object {
    [ordered]@{ path = $_.FullName.Substring($output.Length + 1).Replace('\', '/'); sha256 = (Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant() }
})
$hashes | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'checksums.json') -Encoding utf8
if ($Zip) { Compress-Archive -LiteralPath $output -DestinationPath "$output.zip" }
Write-Output "Portable artifact: $output"
