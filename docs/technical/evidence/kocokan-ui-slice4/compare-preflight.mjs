import fs from 'node:fs'
import { createHash } from 'node:crypto'

const directory = 'docs/technical/evidence/kocokan-ui-slice4'
const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'))
const sha256 = (path) => createHash('sha256').update(fs.readFileSync(path)).digest('hex')
const rows = (report) => report.testResults.flatMap((file) => file.assertionResults.map((test) => ({
  id: `${file.name.replaceAll('\\', '/').split('/raffle-os/')[1]}::${test.fullName}`,
  status: test.status,
  signature: test.failureMessages[0]?.split('\n')[0] ?? null,
})))

const focusedBeforePath = 'node_modules/.tmp/kocokan-slice4-preflight-focused.json'
const focusedAfterPath = 'node_modules/.tmp/kocokan-slice4-after-focused.json'
const fullBeforePath = 'node_modules/.tmp/kocokan-slice4-preflight-full.json'
const fullAfterPath = 'node_modules/.tmp/kocokan-slice4-after-full.json'
const focusedBefore = rows(read(focusedBeforePath))
const focusedAfter = rows(read(focusedAfterPath))
const fullBefore = rows(read(fullBeforePath))
const fullAfter = rows(read(fullAfterPath))

function compare(before, after) {
  const beforeById = new Map(before.map((row) => [row.id, row]))
  const afterById = new Map(after.map((row) => [row.id, row]))
  return {
    exactStatusAndSignatureChanges: before.filter((row) => JSON.stringify(row) !== JSON.stringify(afterById.get(row.id))),
    removed: before.filter((row) => !afterById.has(row.id)),
    added: after.filter((row) => !beforeById.has(row.id)),
  }
}

const focusedComparison = compare(focusedBefore, focusedAfter)
const fullComparison = compare(fullBefore, fullAfter)
const baselineComparison = read('node_modules/.tmp/kocokan-slice4-after-full-comparison.json')
const output = {
  focused: {
    beforePath: focusedBeforePath,
    afterPath: focusedAfterPath,
    beforeSha256: sha256(focusedBeforePath),
    afterSha256: sha256(focusedAfterPath),
    before: { tests: focusedBefore.length, passed: focusedBefore.filter((row) => row.status === 'passed').length, failed: focusedBefore.filter((row) => row.status === 'failed').length },
    after: { tests: focusedAfter.length, passed: focusedAfter.filter((row) => row.status === 'passed').length, failed: focusedAfter.filter((row) => row.status === 'failed').length },
    ...focusedComparison,
  },
  full: {
    beforePath: fullBeforePath,
    afterPath: fullAfterPath,
    beforeSha256: sha256(fullBeforePath),
    afterSha256: sha256(fullAfterPath),
    before: { tests: fullBefore.length, passed: fullBefore.filter((row) => row.status === 'passed').length, failed: fullBefore.filter((row) => row.status === 'failed').length },
    after: { tests: fullAfter.length, passed: fullAfter.filter((row) => row.status === 'passed').length, failed: fullAfter.filter((row) => row.status === 'failed').length },
    ...fullComparison,
  },
  acceptedRegister: {
    overall: baselineComparison.overall,
    unchanged: baselineComparison.unchanged,
    changed: baselineComparison.changed,
    newFailures: baselineComparison.newFailures,
    resolved: baselineComparison.resolved,
  },
}

fs.writeFileSync(`${directory}/regression-comparison.json`, `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify({
  focusedBefore: output.focused.before,
  focusedAfter: output.focused.after,
  focusedChanged: output.focused.exactStatusAndSignatureChanges.length,
  focusedAdded: output.focused.added.length,
  fullBefore: output.full.before,
  fullAfter: output.full.after,
  fullChanged: output.full.exactStatusAndSignatureChanges.length,
  fullAdded: output.full.added.length,
  registerChanged: output.acceptedRegister.changed.length,
  newFailures: output.acceptedRegister.newFailures.length,
}))

if (
  output.focused.exactStatusAndSignatureChanges.length > 0
  || output.focused.removed.length > 0
  || output.focused.added.some((row) => row.status !== 'passed')
  || output.full.exactStatusAndSignatureChanges.length > 0
  || output.full.removed.length > 0
  || output.full.added.some((row) => row.status !== 'passed')
  || output.acceptedRegister.changed.length > 0
  || output.acceptedRegister.newFailures.length > 0
) process.exitCode = 1
