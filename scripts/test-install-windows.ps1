param(
    [Parameter(Mandatory = $true)][string]$ReleaseDirectory,
    [Parameter(Mandatory = $true)][ValidateSet('Install', 'Reinstall', 'BlockUpdate', 'Uninstall', 'Verify', 'Stopped')][string]$Action
)
# Run elevated for install/uninstall acceptance. Never deletes browser data.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$release = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
$manifest = Get-Content -LiteralPath (Join-Path $release 'portable\manifest.json') -Raw | ConvertFrom-Json
$installer = Join-Path $release "Kocokan-Setup-$($manifest.version).exe"
$target = Join-Path $env:ProgramW6432 'Kocokan'
$registry = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{5F39F696-B62A-49CA-A090-366BE7E49213}_is1'
$startMenu = Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'Kocokan.lnk'
$desktop = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'Kocokan.lnk'
$evidence = Join-Path $release 'acceptance'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
function Assert([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw "FAIL: $Message" }
    Write-Output "PASS: $Message"
}
function AssertStopped {
    $listeners = @(Get-NetTCPConnection -LocalPort 47882 -State Listen -ErrorAction SilentlyContinue)
    Assert ($listeners.Count -eq 0) 'Port 47882 free'
    $owned = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq (Join-Path $target 'runtime\node.exe') -or $_.ExecutablePath -eq (Join-Path $target 'Kocokan.exe') })
    Assert ($owned.Count -eq 0) 'No installed launcher or orphan runtime'
}
if ($Action -in @('Install', 'Reinstall', 'BlockUpdate')) {
    if ($Action -eq 'Install') {
        Assert (!(Test-Path -LiteralPath $target)) 'Fresh target absent'
        Assert (!(Test-Path -LiteralPath $registry)) 'Fresh uninstall entry absent'
    }
    if ($Action -ne 'BlockUpdate') { AssertStopped }
    $log = Join-Path $evidence ($Action + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
    $process = Start-Process -FilePath $installer -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/TASKS=desktopicon', "/LOG=`"$log`"") -WindowStyle Hidden -PassThru -Wait
    if ($Action -eq 'BlockUpdate') {
        Assert ($process.ExitCode -ne 0) 'Running launcher blocks update'
        $health = Invoke-RestMethod 'http://127.0.0.1:47882/health'
        Assert ($health.ready -and $health.version -eq $manifest.runtimeVersion) 'Blocked update leaves running server intact'
        exit 0
    }
    Assert ($process.ExitCode -eq 0) "$Action completed without reboot"
}
if ($Action -eq 'Uninstall') {
    AssertStopped
    Assert ((Get-Content -LiteralPath (Join-Path $target 'manifest.json') -Raw | ConvertFrom-Json).application -eq 'Kocokan') 'Target identity verified'
    $uninstaller = Join-Path $target 'unins000.exe'
    $log = Join-Path $evidence ('Uninstall-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
    $process = Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/LOG=`"$log`"") -WindowStyle Hidden -PassThru -Wait
    Assert ($process.ExitCode -eq 0) 'Uninstall exit 0'
    for ($i = 0; $i -lt 20 -and (Test-Path -LiteralPath $target); $i++) { Start-Sleep -Milliseconds 250 }
    Assert (!(Test-Path -LiteralPath $target)) 'Installed files removed'
    Assert (!(Test-Path -LiteralPath $registry)) 'Uninstall entry removed'
    Assert (!(Test-Path -LiteralPath $startMenu)) 'Start Menu shortcut removed'
    Assert (!(Test-Path -LiteralPath $desktop)) 'Desktop shortcut removed'
    AssertStopped
    exit 0
}
if ($Action -eq 'Stopped') { AssertStopped; exit 0 }
Assert (Test-Path -LiteralPath $registry) 'Standard Windows uninstall entry exists'
$entry = Get-ItemProperty -LiteralPath $registry
Assert ($entry.DisplayVersion -eq $manifest.version -and $entry.Publisher -eq 'Tripleaxle Studio') 'Installed product metadata matches'
$shell = New-Object -ComObject WScript.Shell
foreach ($shortcutPath in @($startMenu, $desktop)) {
    Assert (Test-Path -LiteralPath $shortcutPath) "Shortcut exists: $shortcutPath"
    $shortcut = $shell.CreateShortcut($shortcutPath)
    Assert ($shortcut.TargetPath -eq (Join-Path $target 'Kocokan.exe') -and $shortcut.WorkingDirectory -eq $target) 'Shortcut target and working directory correct'
}
$hashes = Get-Content -LiteralPath (Join-Path $release 'portable\checksums.json') -Raw | ConvertFrom-Json
foreach ($file in $hashes) {
    if ((Get-FileHash -LiteralPath (Join-Path $target $file.path)).Hash.ToLowerInvariant() -ne $file.sha256) { throw "Installed checksum mismatch: $($file.path)" }
}
Write-Output "PASS: All $($hashes.Count) installed payload files match release checksums"
