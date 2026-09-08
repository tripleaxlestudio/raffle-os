# Audience prize image — 2026-09-05

Implemented on redesign/kocokan-ui over an already dirty worktree; no commit or push.

## Data flow and scope

PrizeCategory.prizeImageAssetId is captured by makeConfigurationSnapshot at draw execution (Live and Practice). The optional DrawConfigurationSnapshot field keeps format version 1 and existing records valid. DrawRunPage passes the command snapshot reference (or persisted session snapshot on recovery) into ProductionDrawPresentation. The existing public whitelist, serializer, protocol v1 parser, and Audience receiver carry only the optional string reference. Committed confirmation/recovery and completed-result public projections use the session snapshot reference. Historical records are not backfilled or rewritten.

AudiencePresentation maps the reference into the shared AudienceDrawHeader. AudiencePrizeImage reads the existing RaffleOS_PrizeAssets IndexedDB repository on the receiver's origin/profile, creates a local object URL, and decodes before rendering. It revokes URLs on cleanup, failures, asset/prize changes and unmount, cancels late publication after unmount, and closes its repository connection. One contain image appears in the shared prize header for Countdown, Rolling (both renderers), Reveal, pending handoff and Confirmed. Standby remains unchanged. Blackout and disconnected-safe contain no prize image. Shared Operator preview inherits this renderer.

No image, missing asset, rejected lookup or decode failure produces no image element, placeholder or reserved image space. Styling applies only when a decoded image is present. Existing winner grid sizes and ticket styles are unchanged; image dimensions are bounded in the prize header.

No RNG, candidate pool, eligibility, selected winner count, confirmation, redraw or History mutation semantics were changed. The only draw-command change is copying presentation metadata into the existing snapshot. No dependency, image upload UI or image persistence mechanism was changed.

## Changed files for this task

- src/domain/draws/draw-session.types.ts
- src/application/draw/draw-command.ts and draw-command.test.ts
- src/application/draw/practice-result-storage.ts and practice-result-storage.test.ts
- src/application/display-transport/public-projection.ts and public-projection.test.ts
- src/application/display-transport/protocol.ts
- src/application/display-transport/audience-controller.ts
- src/application/display-transport/authoritative-projection.ts and authoritative-projection.test.ts
- src/application/display-transport/prize-image-transport.test.ts (new)
- src/application/history/completed-result-projection.ts and completed-result-projection.test.ts
- src/pages/operator/DrawRunPage.tsx
- src/ui/operator/draw/ProductionDrawPresentation.tsx
- src/ui/audience/AudiencePresentation.tsx
- src/ui/audience/AudienceDrawHeader.tsx
- src/ui/audience/audience-view.types.ts
- src/ui/audience/AudiencePrizeImage.tsx and AudiencePrizeImage.test.tsx (new)
- src/styles/audience.css
- this report

## Verification

Focused image rendering, public projection/privacy, image transport, committed projection and completed-result projection: 6 files / 50 tests PASS (including Practice storage compatibility). Image tests cover counts 1, 6, 10, 20, 37 and 100, all requested presentation stages, storage/decode failures, runtime image error, preview, remount persistence, blackout/disconnection, stale async decode and URL cleanup. Draw-command image snapshot tests PASS for Live and Practice.

Broader command: npm.cmd run test -- src/ui/audience src/pages/display src/application/display-transport src/application/draw src/application/eligibility src/infrastructure/persistence/repositories/prize-image-asset.repository.test.ts --reporter=json --outputFile=audience-prize-test-results.json

Result: 310 PASS / 22 FAIL. This run preceded the additional projection/transport assertions and Practice storage test. Failures remain FAIL; no acceptance claim. The draw-command configuration failure was reproduced using a temporary copy with the image-reference addition removed: same test name, assertion and expected/received configuration. Other failures primarily expect older Audience text; they were not individually baseline-reproduced or changed in this slice.

Chrome browser verification used a temporary fixture importing the production AudiencePresentation and actual IndexedDB repository on isolated origin 127.0.0.1:5175, with synthetic canvas-generated PNGs; no official draw/data was touched. Observed portrait/20-winner Reveal, landscape/6-winner Confirmed (uncropped border visible), refresh re-resolution, no-image/10 winners, missing and corrupt asset fallback with exact ticket retained, pure Blackout, and disconnected-safe suppression. Viewport was approximately 1902 x 935, not exact 1920 x 1080. Temporary fixture files were removed. Full two-window Operator start-to-confirm, exact target-resolution and Edge acceptance remain pending.

Final checks: `npm.cmd run lint` PASS; `npm.cmd run typecheck` PASS; `npm.cmd run build` PASS (existing >500 kB chunk warning); `git diff --check` PASS. Initial typecheck caught two test-only typing errors; both were corrected before these final checks. Temporary QA tab/server and fixture files were cleaned up. HEAD remains `0b42c35`; worktree remains dirty with prior user changes plus this slice.

## Known limitations

Existing category upload code deletes the previous image asset on replacement/removal. The draw reference stays locked and never follows the new category image, but an Audience reload/remount after deletion falls back without an image. Asset retention changes are outside this request's persistence scope. Same-origin and same browser profile are required. Older draws have no image reference. Practice retains the optional image reference in the existing tab-scoped result projection, including Operator reload; older Practice projections remain valid.

## Broader regression failures

- `application/display-transport/audience-liveness.test.tsx` — Audience liveness watchdog keeps DISPLAY TEST and standby rendered while the real publisher heartbeat continues
  TestingLibraryElementError: Unable to find an element with the text: /DISPLAY TEST/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `application/display-transport/audience-liveness.test.tsx` — Audience liveness watchdog keeps the public presentation stable for a 60-second heartbeat interval
  TestingLibraryElementError: Unable to find an element with the text: /DISPLAY TEST/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `application/display-transport/audience-liveness.test.tsx` — Audience liveness watchdog shows interrupted only after publisher activity expires, then restores the retained snapshot
  TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Display connection interrupted"
- `application/display-transport/audience-render-commit.integration.test.tsx` — Phase 8 Audience render-source acknowledgement boundary restores retained standby for a late Audience without a sequence or heartbeat storm
  TestingLibraryElementError: Unable to find an element with the text: Display ready. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `application/display-transport/audience-render-commit.integration.test.tsx` — Phase 8 Audience render-source acknowledgement boundary acknowledges standby and display-test only after the real route selects each presentation
  Error: Unable to find an element with the text: Display ready. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `application/display-transport/phase7-integration.test.tsx` — Phase 7 integration and automated acceptance runs the authoritative Operator → public projection → protocol → Audience → DOM flow
  TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Draw will begin shortly"
- `application/display-transport/settings-display-integration.test.ts` — production Settings display-test integration moves the real Audience controller from connecting to display test after acknowledgement
  TestingLibraryElementError: Unable to find an element with the text: /DISPLAY TEST/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `application/display-transport/settings-display-integration.test.ts` — production Settings display-test integration restores the same public test for late joiners, refreshes, and multiple windows
  TestingLibraryElementError: Unable to find an element with the text: /DISPLAY TEST/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `application/display-transport/settings-display-integration.test.ts` — production Settings display-test integration keeps one publisher alive across five realtime start/stop cycles
  TestingLibraryElementError: Unable to find an element with the text: Display ready. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `application/display-transport/settings-display-integration.test.ts` — production Settings display-test integration delivers the production snapshot through the BroadcastChannel adapter
  TestingLibraryElementError: Unable to find an element with the text: Display ready. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `application/draw/draw-authoring-service.test.ts` — draw authoring service persists a valid per-draw Random Number Roll configuration
  AssertionError: expected { …(5) } to deeply equal { …(5) }
- `application/draw/draw-command.test.ts` — executeDraw captures per-draw presentation configuration without changing selection semantics
  AssertionError: expected { …(5) } to deeply equal { …(5) }
- `pages/display/AudienceDisplayPage.test.tsx` — Audience Display static states renders a static accessible countdown numeral
  TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Bersiap"
- `pages/display/AudienceDisplayPage.test.tsx` — Audience Display static states renders a stable deterministic rolling arrangement with leading zeroes
  TestingLibraryElementError: Unable to find an accessible element with the role "list" and name "Presentational ticket stream"
- `pages/display/AudienceDisplayPage.test.tsx` — Audience winner grids renders confirmed count 1 with the same exact hero layout
  Error: expect(element).toHaveTextContent()
- `pages/display/AudienceDisplayPage.test.tsx` — Audience winner grids renders confirmed count 6 with the same exact 3x2 layout
  Error: expect(element).toHaveTextContent()
- `pages/display/AudienceDisplayPage.test.tsx` — Audience winner grids renders confirmed count 10 with the same exact 5x2 layout
  Error: expect(element).toHaveTextContent()
- `pages/display/AudienceDisplayPage.test.tsx` — Audience winner grids renders confirmed count 20 with the same exact 5x4 layout
  Error: expect(element).toHaveTextContent()
- `pages/display/AudienceDisplayPage.test.tsx` — Audience winner grids preserves exact leading-zero strings throughout winner layouts
  TestingLibraryElementError: Unable to find an accessible element with the role "list" and name "20 ticket results"
- `pages/display/AudienceDisplayPage.test.tsx` — Audience safety and privacy renders blackout as a non-interactive public surface with an assistive status
  Error: expect(element).toHaveAccessibleName()
- `ui/audience/RandomNumberRollStage.test.tsx` — Random Number Roll presentation continuity shows stable exact draw identity across rolling and reveal without remounting the stage
  TestingLibraryElementError: Unable to find an element with the text: CURRENT DRAW. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- `ui/audience/WinnerStage.test.tsx` — Audience sequential winner reveal keeps the rolling-stage entrance treatment before any winner lock
  TestingLibraryElementError: Unable to find an element with the text: CURRENT DRAW. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
