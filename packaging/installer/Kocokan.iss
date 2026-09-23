; Compile only via scripts/build-release-windows.ps1.
#ifndef ProductVersion
  #error ProductVersion is required
#endif
#ifndef PortableRoot
  #error PortableRoot is required
#endif
#ifndef ReleaseRoot
  #error ReleaseRoot is required
#endif

[Setup]
; Stable across all versions. Never derive AppId from ProductVersion.
AppId={{5F39F696-B62A-49CA-A090-366BE7E49213}
AppName=Kocokan
AppVersion={#ProductVersion}
AppPublisher=Tripleaxle Studio
VersionInfoVersion={#ProductVersion}.0
VersionInfoProductName=Kocokan
VersionInfoProductVersion={#ProductVersion}
DefaultDirName={autopf}\Kocokan
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#ReleaseRoot}
OutputBaseFilename=Kocokan-Setup-{#ProductVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Kocokan
UninstallDisplayIcon={app}\Kocokan.exe
AppMutex=Local\Kocokan.Pilot.47882
SetupMutex=Global\Kocokan.Setup
CloseApplications=no
RestartApplications=no
RestartIfNeededByRun=no
; A future signer is supplied by ISCC /Srelease=... with /DEnableSigning.
#ifdef EnableSigning
SignTool=release
SignedUninstaller=yes
#endif

[Tasks]
Name: desktopicon; Description: "Create a Desktop shortcut"; Flags: unchecked

[Files]
Source: "{#PortableRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{commonprograms}\Kocokan"; Filename: "{app}\Kocokan.exe"; WorkingDir: "{app}"
Name: "{commondesktop}\Kocokan"; Filename: "{app}\Kocokan.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Code]
// Also detect launchers in other Windows sessions. Never terminate a process.
// WMI failure is fail-closed: do not risk replacing files we cannot inspect.
function RunningCheck: String;
var
  Locator, Service, Processes: Variant;
begin
  Result := '';
  try
    Locator := CreateOleObject('WbemScripting.SWbemLocator');
    Service := Locator.ConnectServer('', 'root\CIMV2');
    Processes := Service.ExecQuery('SELECT ProcessId FROM Win32_Process WHERE Name = ''Kocokan.exe''');
    if Processes.Count > 0 then
      Result := 'Kocokan is running. Quit Kocokan in every Windows session, then retry.';
  except
    Result := 'Cannot verify running applications. Close Kocokan and restore Windows Management Instrumentation before retrying.';
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := RunningCheck;
end;

function InitializeUninstall: Boolean;
var
  Reason: String;
begin
  Reason := RunningCheck;
  Result := Reason = '';
  if not Result then SuppressibleMsgBox(Reason, mbError, MB_OK, IDOK);
end;

// No browser access, data cleanup, reset, wildcard UninstallDelete, or migration.
