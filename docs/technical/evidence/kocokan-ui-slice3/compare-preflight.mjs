// Exact accepted identities/signatures; no message normalization or test edits.
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const dir = 'docs/technical/evidence/kocokan-ui-slice3'
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'))
const rows = report => report.testResults.flatMap(file => file.assertionResults.map(test => ({
  id: `${file.name.replaceAll('\\', '/').split('/raffle-os/')[1]}::${test.fullName}`,
  status: test.status, signature: test.failureMessages[0]?.split('\n')[0] ?? null,
})))
const beforePath = 'node_modules/.tmp/kocokan-slice3-before.json'
const afterPath = 'node_modules/.tmp/kocokan-slice3-after.json'
const before = rows(read(beforePath)), after = rows(read(afterPath))
const byId = new Map(after.map(row => [row.id, row]))
const changed = before.filter(row => JSON.stringify(row) !== JSON.stringify(byId.get(row.id)))
const previous = read('docs/technical/evidence/kocokan-ui-slice2/full-comparison.json')
const current = read(`${dir}/full-comparison.json`)
const previousFailures = new Map(previous.currentFailures.map(row => [`${row.file}::${row.test}`, row.message]))
const regression = current.currentFailures.filter(row => previousFailures.get(`${row.file}::${row.test}`) !== row.message)
const output = {
  beforePath, afterPath,
  beforeSha256: createHash('sha256').update(fs.readFileSync(beforePath)).digest('hex'),
  afterSha256: createHash('sha256').update(fs.readFileSync(afterPath)).digest('hex'),
  focused: { tests: before.length, passed: before.filter(row => row.status === 'passed').length, failed: before.filter(row => row.status === 'failed').length, exactStatusAndSignatureChanges: changed, rows: before },
  fullVersusSlice2: { previousTotals: previous.totals, currentTotals: current.totals, newOrChangedFailures: regression, recoveredBaselineStillPassing: current.resolved },
}
fs.writeFileSync(`${dir}/preflight-comparison.json`, JSON.stringify(output, null, 2) + '\n')
console.log(JSON.stringify({focusedIdentities:before.length,changed:changed.length,regressionsVsSlice2:regression.length}))
if (changed.length || regression.length) process.exitCode = 1
