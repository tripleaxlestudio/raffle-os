// Run from the repository root. This supplements, not replaces, behavioral tests.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const baseline = 'b5c8775'
const paths = [
  'src/pages/operator/ProductionDashboardPage.tsx',
  'src/pages/operator/EventsPage.tsx',
  'src/pages/operator/PrizeCategoriesPage.tsx',
  'src/ui/operator/participant-import/ProductionParticipantImportPreview.tsx',
  'src/shared/components/ProductionSetupContinuation.tsx',
]
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
function contracts(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const attributes = []
  function visit(node) {
    if (ts.isJsxAttribute(node) && /^(on[A-Z]|to$|href$|disabled$|required$|min$|max$|maxLength$|step$|checked$|value$|confirmDisabled$|confirmLoading$|isLoading$)/.test(node.name.text)) {
      attributes.push(printer.printNode(ts.EmitHint.Unspecified, node, source))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return attributes.sort()
}
const results = paths.map(path => {
  const before = contracts(path, execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' }))
  const after = contracts(path, fs.readFileSync(path, 'utf8'))
  return { path, comparedAttributes: before.length, unchanged: JSON.stringify(before) === JSON.stringify(after) }
})
const excluded = [
  'src/domain', 'src/application', 'src/infrastructure', 'src/ui/audience',
  'src/pages/display', 'src/styles/audience.css', 'src/styles/operator.css',
  'src/styles/kocokan/primitives.css', 'src/styles/kocokan/shell.css',
  'src/styles/kocokan/tokens.css', 'src/app', 'package.json', 'package-lock.json',
]
const frozenChanges = execFileSync('git', ['diff', '--name-only', baseline, '--', ...excluded], { encoding: 'utf8' }).trim()
const testChanges = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src/**/*.test.*'], { encoding: 'utf8' }).trim()
const result = { baseline, purpose: 'Compare JSX behavior attributes and unchanged frozen paths. Does not prove runtime correctness.', results, frozenChanges, testChanges }
fs.writeFileSync('docs/technical/evidence/kocokan-ui-slice2/source-scope.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
if (results.some(row => !row.unchanged) || frozenChanges || testChanges) process.exitCode = 1
