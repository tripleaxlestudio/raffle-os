import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'

export type ProductionAsset = Readonly<{ bytes: Buffer; contentType: string }>

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.avif': 'image/avif', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.webmanifest': 'application/manifest+json',
}
const MAX_WEB_BYTES = 256 * 1024 * 1024

// Load an immutable, bounded allow-list before binding. Requests never resolve
// filesystem paths; dotfiles, source maps and symlinks are not web assets.
export async function loadProductionAssets(webRoot: string): Promise<ReadonlyMap<string, ProductionAsset>> {
  const root = await realpath(resolve(webRoot))
  const assets = new Map<string, ProductionAsset>()
  let totalBytes = 0
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
      const file = join(directory, entry.name)
      const canonical = await realpath(file)
      if (!canonical.startsWith(`${root}${sep}`)) throw new Error('Web assets must remain inside the production asset directory.')
      if (entry.isDirectory()) { await visit(file); continue }
      const contentType = MIME[extname(entry.name).toLowerCase()]
      if (!entry.isFile() || contentType === undefined) continue
      const size = (await stat(file)).size
      if (totalBytes + size > MAX_WEB_BYTES) throw new Error('Production web assets exceed the 256 MB runtime limit.')
      const bytes = await readFile(file)
      totalBytes += bytes.byteLength
      if (totalBytes > MAX_WEB_BYTES) throw new Error('Production web assets exceed the 256 MB runtime limit.')
      assets.set(`/${relative(root, file).split(sep).join('/')}`, { bytes, contentType })
    }
  }
  await visit(root)
  const index = assets.get('/index.html')
  if (index === undefined || index.bytes.length === 0) throw new Error('Production index.html is missing or empty. Run npm run build first.')
  // Validate Vite's local entry scripts/styles before declaring readiness.
  for (const match of index.bytes.toString('utf8').matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)) {
    const reference = match[1]
    if (reference === undefined || /^(?:[a-z]+:|\/\/)/i.test(reference)) continue
    const path = new URL(reference, 'http://127.0.0.1/').pathname
    if (!assets.has(decodeURIComponent(path))) throw new Error(`Production entry asset is missing: ${path}`)
  }
  return assets
}
