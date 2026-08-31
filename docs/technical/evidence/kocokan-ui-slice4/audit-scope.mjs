import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const directory = 'docs/technical/evidence/kocokan-ui-slice4'
const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
const changed = [...new Set([...tracked, ...untracked])]
const allowedSource = new Set([
  'src/pages/operator/ProductionPendingResultsLandingPage.tsx',
  'src/pages/operator/ProductionPendingResultsPage.tsx',
  'src/pages/operator/KocokanPendingResults.test.tsx',
  'src/ui/operator/draw/ProductionDrawPresentation.tsx',
  'src/styles/app.css',
  'src/styles/kocokan/pending.css',
])
const source = changed.filter((path) => path.startsWith('src/'))
const unexpectedSource = source.filter((path) => !allowedSource.has(path))
const patch = execFileSync('git', ['diff', '--unified=0', 'HEAD', '--', ...tracked.filter((path) => path.startsWith('src/'))], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
const presentationPatch = execFileSync('git', ['diff', '--unified=0', 'HEAD', '--', 'src/ui/operator/draw/ProductionDrawPresentation.tsx'], { encoding: 'utf8' })
const pendingPatch = execFileSync('git', ['diff', '--unified=0', 'HEAD', '--', 'src/pages/operator/ProductionPendingResultsPage.tsx'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
const pendingCss = fs.readFileSync('src/styles/kocokan/pending.css', 'utf8')
const presentationHunks = [...presentationPatch.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)].map((match) => ({ start: Number(match[1]), length: Number(match[2] ?? 1) }))
const forbiddenPendingControlChanges = pendingPatch.split(/\r?\n/).filter((line) => /^[+-](?![+-])/.test(line) && /(pendingDecisions|operation:|expectedStatus|commandRef|audience\.publish|projectCommittedAudienceState|calculateReplacementCapacity)/.test(line))
const output = {
  base: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  changed,
  source,
  allowedSource: [...allowedSource],
  unexpectedSource,
  productionDrawPresentationHunks: presentationHunks,
  productionDrawPresentationOnlyQuickSelection: presentationPatch.includes('redrawSelectionDialog') && !/(ProductionDrawRunHeader|PresentationSupport|AudiencePresentation|controller\.|publisher\.)/.test(presentationPatch),
  pendingControlFlowChanges: forbiddenPendingControlChanges,
  css: {
    hasAudienceSelector: /\.audience[-_]/.test(pendingCss),
    hasHistorySelector: /\.history[-_]/.test(pendingCss),
    hasImportant: /!important/.test(pendingCss),
    hasLegacyDarkHex: /#(?:0b0d12|1d212b|2b3140|3a4150)/i.test(pendingCss),
    hasPersistentSelectedRule: /data-selected="true"[\s\S]*?:hover[\s\S]*?:focus-within/.test(pendingCss),
  },
  patchMentionsForbiddenProductionAreas: /src\/(?:domain|application|infrastructure|pages\/display|styles\/audience|pages\/operator\/ProductionHistory)/.test(patch),
}

fs.writeFileSync(`${directory}/source-scope.json`, `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify({
  sourceFiles: source.length,
  unexpectedSource: unexpectedSource.length,
  presentationHunks,
  presentationQuickOnly: output.productionDrawPresentationOnlyQuickSelection,
  pendingControlFlowChanges: forbiddenPendingControlChanges.length,
  css: output.css,
  forbiddenProductionAreas: output.patchMentionsForbiddenProductionAreas,
}))

if (
  unexpectedSource.length > 0
  || presentationHunks.some((hunk) => hunk.start < 200 || hunk.start > 220)
  || !output.productionDrawPresentationOnlyQuickSelection
  || forbiddenPendingControlChanges.length > 0
  || Object.entries(output.css).some(([key, value]) => key !== 'hasPersistentSelectedRule' && value)
  || !output.css.hasPersistentSelectedRule
  || output.patchMentionsForbiddenProductionAreas
) process.exitCode = 1
