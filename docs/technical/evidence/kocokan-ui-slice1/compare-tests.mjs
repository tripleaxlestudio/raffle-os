// Run from the repository root after the JSON-reporter Vitest command.
import fs from 'node:fs'
import { createHash } from 'node:crypto'

const directory = 'docs/technical/evidence/kocokan-ui-slice1'
const reportPath = process.argv[2] ?? 'node_modules/.tmp/kocokan-slice1-tests.json'
const outputPath = process.argv[3] ?? `${directory}/full-suite-comparison.json`
const raw = fs.readFileSync(reportPath)
const report = JSON.parse(raw)
const baseline = JSON.parse(fs.readFileSync('docs/technical/evidence/kocokan-ui-baseline/test-failures.json', 'utf8'))
const identity = ({ file, test }) => `${file}::${test}`
const assertions = report.testResults.flatMap(file => file.assertionResults.map(test => ({
  file: file.name.replaceAll('\\', '/').split('/raffle-os/')[1],
  test: test.fullName,
  status: test.status,
  message: test.failureMessages[0]?.split('\n')[0],
})))
const current = new Map(assertions.map(test => [identity(test), test]))
const known = new Set(baseline.failures.map(identity))
const unchanged = [], resolved = [], changed = [], missingOrSkipped = []
for (const before of baseline.failures) {
  const after = current.get(identity(before))
  if (!after || after.status === 'pending' || after.status === 'skipped') missingOrSkipped.push(before.id)
  else if (after.status === 'passed') resolved.push(before.id)
  else if (after.message === before.message) unchanged.push(before.id)
  else changed.push({ ...before, currentMessage: after.message })
}
const failures = assertions.filter(test => test.status === 'failed')
const result = {
  baselineCommit: baseline.baselineCommit,
  baselineRegisterSha256: createHash('sha256').update(fs.readFileSync('docs/technical/evidence/kocokan-ui-baseline/test-failures.json')).digest('hex'),
  reportPath, rawReportSha256: createHash('sha256').update(raw).digest('hex'),
  overall: report.success ? 'PASS' : 'FAIL',
  totals: { files: report.testResults.length, passedFiles: report.testResults.filter(file => file.status === 'passed').length,
    failedFiles: report.testResults.filter(file => file.status === 'failed').length,
    tests: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests },
  comparisonKey: 'Exact relative file + full test name + first failure-message line, as recorded by the accepted register. No normalization of messages.',
  resolved, unchanged, changed, missingOrSkipped,
  newFailures: failures.filter(test => !known.has(identity(test))),
  currentFailures: failures,
}
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ overall: result.overall, totals: result.totals, resolved: resolved.length, unchanged: unchanged.length, changed: changed.length, missingOrSkipped: missingOrSkipped.length, newFailures: result.newFailures.length }))
