// Run from repository root. Read-only comparison against the Slice 1 checkpoint.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import postcss from 'postcss'

const base = '6dce8f2'
const file = 'src/styles/operator.css'
const before = postcss.parse(execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' }))
const after = postcss.parse(fs.readFileSync(file, 'utf8'))
const frozen = /settings-display-preview|settings-safe-area-preview|audience-preview-surface/
const geometry = /^(display|position|inset|top|right|bottom|left|z-index|grid.*|flex.*|align.*|justify.*|place.*|gap|row-gap|column-gap|padding.*|margin.*|width|height|min-width|max-width|min-height|max-height|overflow.*|aspect-ratio|transform)$/
function preview(root) {
  const result = []
  root.walkRules(rule => { if (frozen.test(rule.selector)) result.push(rule.toString().replaceAll('\r\n', '\n')) })
  return result
}
function layout(root) {
  const result = []
  root.walkRules(rule => result.push(rule.nodes.filter(node => node.type === 'decl' && geometry.test(node.prop)).map(node => `${node.prop}:${node.value}`)))
  return result
}
const previewBefore = preview(before), previewAfter = preview(after)
const result = {
  base, file,
  frozenPreviewRules: previewBefore.length,
  frozenPreviewRulesUnchanged: JSON.stringify(previewBefore) === JSON.stringify(previewAfter),
  existingLayoutDeclarationValuesUnchanged: JSON.stringify(layout(before)) === JSON.stringify(layout(after)),
  note: 'Compares preview rules verbatim apart from line endings, and ordered existing layout declarations. Visual colors, borders, radii and theme class aliases are intentional changes. Browser isolation is recorded separately.',
}
fs.writeFileSync('docs/technical/evidence/kocokan-ui-slice1-refinement/source-scope.json', JSON.stringify(result, null, 2) + '\n')
console.log(result)
if (!result.frozenPreviewRulesUnchanged || !result.existingLayoutDeclarationValuesUnchanged) process.exitCode = 1
