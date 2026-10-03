// Read-only inspection of built bundles; generates local documentation and Help data.
// Run after web/runtime builds with --sourcemap. Does not build installers or change dependencies.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'))
const metadata = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const observed = new Map()
const maps = []
for (const [directory, scope] of [['dist/assets', 'web'], ['dist-runtime', 'runtime']]) {
  const paths = readdirSync(resolve(root, directory)).filter((name) => name.endsWith('.map'))
  if (paths.length === 0) throw new Error(`Missing sourcemaps: ${directory}`)
  for (const name of paths) {
    const map = JSON.parse(readFileSync(resolve(root, directory, name), 'utf8'))
    maps.push({ file: `${directory}/${name}`, sha256: createHash('sha256').update(readFileSync(resolve(root, directory, name))).digest('hex') })
    for (const source of map.sources) {
      const index = source.lastIndexOf('node_modules/')
      if (index < 0) continue
      const tail = source.slice(index + 'node_modules/'.length)
      const packageName = tail.startsWith('@') ? tail.split('/').slice(0, 2).join('/') : tail.split('/')[0]
      const key = source.slice(source.indexOf('node_modules/'), index) + `node_modules/${packageName}`
      const scopes = observed.get(key) ?? new Set()
      scopes.add(scope)
      observed.set(key, scopes)
    }
  }
}

const target = resolve(root, 'docs/legal/licenses/help')
mkdirSync(target, { recursive: true })
const components = []
for (const [key, scopes] of [...observed].sort(([a], [b]) => a.localeCompare(b))) {
  const entry = lock.packages[key]
  if (!entry) throw new Error(`Lockfile entry missing: ${key}`)
  const packageDirectory = resolve(root, key)
  const packageJson = JSON.parse(readFileSync(resolve(packageDirectory, 'package.json'), 'utf8'))
  if (packageJson.version !== entry.version) throw new Error(`Installed version mismatch: ${key}`)
  const files = readdirSync(packageDirectory).filter((name) => /^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(name))
  if (files.length === 0) throw new Error(`License missing: ${key}`)
  const notices = files.map((name) => {
    const filename = `${key.replaceAll('/', '_')}-${name}.txt`
    copyFileSync(resolve(packageDirectory, name), resolve(target, filename))
    const text = readFileSync(resolve(target, filename), 'utf8')
    return { filename, text, sha256: createHash('sha256').update(readFileSync(resolve(target, filename))).digest('hex') }
  })
  components.push({ name: packageJson.name, version: entry.version, license: entry.license ?? packageJson.license ?? 'See license text', scope: [...scopes].join(', '), source: key, notices })
}

const releaseDirectory = resolve(root, 'artifacts/release/Kocokan-0.1.3')
const manifest = JSON.parse(readFileSync(resolve(releaseDirectory, 'portable/manifest.json'), 'utf8').replace(/^\uFEFF/, ''))
const runtimeGroups = [
  { name: 'Node.js', version: manifest.nodeVersion, license: 'See Node.js license and included third-party notices', files: ['NODE-LICENSE.txt'] },
  ...manifest.launcherRuntime.map((runtime) => ({ name: runtime.name, version: runtime.version, license: 'See runtime license and included notices', files: readdirSync(resolve(releaseDirectory, 'notices')).filter((name) => name.startsWith(`${runtime.name.toLowerCase()}.runtime.win-x64-`)) })),
]
for (const group of runtimeGroups) {
  if (group.files.length === 0) throw new Error(`Missing Windows runtime notices: ${group.name}`)
  components.push({ name: group.name, version: group.version, license: group.license, scope: 'Windows distribution v0.1.3 snapshot', source: 'artifacts/release/Kocokan-0.1.3/notices', notices: group.files.map((name) => {
    copyFileSync(resolve(releaseDirectory, 'notices', name), resolve(target, name))
    const bytes = readFileSync(resolve(target, name))
    return { filename: name, text: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex') }
  }) })
}

const data = { components }
writeFileSync(resolve(root, 'src/pages/operator/help/third-party-notices.json'), JSON.stringify(data, null, 2) + '\n')
const audit = {
  applicationVersion: metadata.version, maps, windowsSnapshot: { version: manifest.version, buildCommit: manifest.buildCommit, nodeVersion: manifest.nodeVersion, launcherRuntime: manifest.launcherRuntime },
  components: components.map(({ notices, ...component }) => ({ ...component, notices: notices.map(({ text: _text, ...notice }) => notice) })),
  productionNotObserved: Object.entries(lock.packages).filter(([key, value]) => key.startsWith('node_modules/') && !value.dev && !observed.has(key)).map(([key, value]) => ({ path: key, version: value.version, license: value.license ?? null })),
  developmentPackageCount: Object.values(lock.packages).filter((entry) => entry.dev).length,
}
const auditPath = resolve(root, 'docs/technical/evidence/help-slice2/notices-audit.json')
mkdirSync(dirname(auditPath), { recursive: true })
writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n')
const rows = components.map((component) => `| ${component.name} | ${component.version} | ${component.license} | ${component.scope} | ${component.notices.map((notice) => `[${basename(notice.filename)}](licenses/help/${notice.filename})`).join(', ')} |`)
writeFileSync(resolve(root, 'docs/legal/THIRD-PARTY-NOTICES.md'), `# Third-party notices\n\nNotices for packages observed in the audited web/runtime bundles and the existing Windows v0.1.3 distribution snapshot. Product terms are not set by these notices.\n\nExact versions come from the lockfile and installed package metadata; copied license/notice text is unchanged. Full text is also available locally in Help.\n\n| Component | Version | License metadata | Scope | License and notice files |\n|---|---|---|---|---|\n${rows.join('\n')}\n\n## Audit boundary\n\nSee [audit evidence](../technical/evidence/help-slice2/notices-audit.json). Development dependencies and production-marked packages not observed in the bundles are distinguished in that evidence. This is not a claim of legal completeness or certification. The Windows runtime snapshot is an existing artifact, not a newly built installer. Node and .NET texts include their own upstream third-party notices; they are not replaced by a single umbrella license label. User-supplied fonts, images, and audio are outside this package audit. Re-audit if dependencies or distribution assets change.\n\nThe existing [SheetJS CE 0.20.3 license](licenses/SheetJS-CE-0.20.3-LICENSE.txt) remains preserved.\n`)
console.log(`Generated ${components.length} components from ${observed.size} observed npm packages plus Windows runtime snapshots.`)
