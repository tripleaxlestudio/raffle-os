# Kocokan launcher UI Polish V1

2026-09-23. Branch: `codex/packaging-pilot`. Owner accepted UI Polish V1 for
pilot and authorized semantic commit closeout on 2026-09-23.

## Scope and result

WinForms presentation only. Fixed 468 × 426 logical-pixel client area, first-open
centering, Segoe UI, white/neutral surfaces, existing Kocokan purple, text status
badges, borderless selectable read-only URL, label-only port, dominant Launch,
outlined Hide/Retry, subtle red Quit and a small Kocokan Pilot footer.

No suitable launcher logo/icon file was found. The temporary K monogram uses
the existing brand color; an approved `.ico`/logo asset is still needed.
The generic window icon is hidden. No generated brand asset or dependency added.
The footer deliberately uses the approved static `Kocokan Pilot` option, without
adding manifest-reading behavior to the form.

Launch gating and Retry visibility retain the existing conditions. Hide and Quit
are visually disabled while Stopping, as requested. Click handlers, confirmations,
startup/readiness/shutdown/instance handling and RuntimeController are unchanged.
Long diagnostics remain intact in a scrollable message region; they do not push
Retry or other controls out of the fixed window.

## Files

- Modified `packaging/launcher/Program.cs`: replace inline layout with partial
  layout initialization and refresh status appearance after existing state updates.
- New `packaging/launcher/LauncherForm.Layout.cs`: all visual construction/styles.
- New `packaging/visual-harness/Kocokan.VisualHarness.csproj` and `Program.cs`:
  standalone QA executable, compiling the actual launcher source. Fixture state
  injection exists only in this harness; no production preview/test switches.
- This report and `docs/technical/evidence/launcher-ui-polish-v1/*.png`.

## Verification

| Check | Result |
| --- | --- |
| `dotnet build packaging/launcher/Kocokan.csproj -c Release --no-restore` | PASS, zero warnings/errors |
| `dotnet publish packaging/launcher/Kocokan.csproj -c Release --no-restore -o artifacts/Kocokan-UI-Polish-V1-review` | PASS, final launcher compiled/published |
| `dotnet run --project packaging/harness/Kocokan.Harness.csproj -c Release -- artifacts/Kocokan-UI-Polish-V1-review` | Final build: 18/18 PASS |
| `npm.cmd run test -- server src/application/display-transport/websocket-transport.test.ts src/application/display-transport/wire-codec.test.ts --maxWorkers=2` | 6 files, 19/19 tests PASS |
| `dotnet run --project packaging/visual-harness/Kocokan.VisualHarness.csproj -c Release -- docs/technical/evidence/launcher-ui-polish-v1` | 12 state/scale combinations and 3 long-error checks PASS |
| `dotnet build packaging/visual-harness/Kocokan.VisualHarness.csproj -c Release --no-restore` | PASS, zero warnings/errors |
| Protected packaged runtime/server/web files versus accepted P2 artifact | All 6 files SHA256-identical |
| Git diff of RuntimeController, ChildJob, server and src | Empty |
| `git diff --check` | PASS (Git reports normal LF-to-CRLF notices) |

The visual checks cover status text, Launch/Retry/Stopping gating, label/button
text fit, controls contained in parents, full read-only URL, and scrollable long
diagnostics with Retry visible. The initial check caught a 1-pixel header height
shortfall; the header row was corrected and all combinations rerun.

No TypeScript/application source changed. npm lint/build were not rerun because
the changed production source is C# (outside ESLint); .NET build/publish are the
applicable compilation checks. Full application regression suite was not run.

## Images and DPI limits

`launcher-running-live.png` is a DrawToBitmap capture of the actual LauncherForm
running against the review package's real bundled server at **96 DPI (100%)**.
The live QA mode uses the original Shown startup handler and waits for actual
Running before capture, then calls the unchanged StopAsync and disposes the form.
It is not a web mockup or an image-generated design.

Other images use the same WinForms controls with fixture states and explicit
layout/font scaling at 100%, 125%, 150%. No Windows display settings were changed.
The bitmap window frame is painted by WinForms and may differ from the desktop's
DWM frame. Actual Windows 125%/150% startup, monitor changes and physical title-bar
appearance remain **unverified**, so full DPI acceptance is not claimed.

Reviewed rendered images include live Running, Running 125%, Error 150%, Starting
150%, Stopping 150% and long Error 125%. All state/scale images are available in
the evidence directory. Native-window enumeration capture from the separate
packaged executable was unsuccessful in this tool session; the live form capture
above is supplied instead. A first hidden-form render was blank and was replaced
with renders of visible controls placed offscreen in the QA process.

To reproduce the live capture, build the visual harness, temporarily copy its
`Kocokan.VisualHarness.*` output files into the review package, then run:

```powershell
dotnet artifacts/Kocokan-UI-Polish-V1-review/Kocokan.VisualHarness.dll --live C:\laragon\www\raffle-os\docs\technical\evidence\launcher-ui-polish-v1\launcher-running-live.png
```

Use the installed `dotnet` host for this QA command: the framework-dependent QA
apphost cannot resolve its framework beside the self-contained launcher runtime.
The QA helper files were removed from the review package after capture. The
launcher itself remains self-contained and needs no installed .NET runtime.

## Review artifact and boundary

`artifacts/Kocokan-UI-Polish-V1-review/Kocokan.exe` is the review executable.
The folder copies the accepted P2 package and replaces only launcher build output;
its review manifest records `launcherUiReview: ui-polish-v1`, current base commit
and dirty source. Checksums were regenerated for that review folder. Accepted
`Kocokan-Pilot-20260923-111736` and its ZIP were not modified.

No installer, release ZIP, P3, web changes, bundled Node/server changes,
readiness change, port change or lifecycle change. Owner visual review is accepted
for pilot; actual Windows DPI verification remains limited as documented above.
Test-owned servers were stopped; the port was free after verification.

## Approved closeout

Final source review confirms the change is limited to WinForms presentation,
the separate visual QA harness, this report and captured evidence. No runtime,
lifecycle, readiness, server, fixed-port or Operator/Audience changes were added
during closeout. The accepted review artifact is preserved without rebuilding or
rewriting its pre-commit provenance. P3 requires separate approval and remains
unstarted. The closeout response records the resulting commit SHA and final
working-tree status.
