import fs from 'node:fs'
import { createHash } from 'node:crypto'

const directory = 'docs/technical/evidence/kocokan-ui-slice4'
const images = fs.readdirSync(directory).filter((name) => name.endsWith('.png')).sort().map((name) => {
  const bytes = fs.readFileSync(`${directory}/${name}`)
  const match = name.match(/(\d+)x(\d+)/)
  return {
    name,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    viewport: match === null ? null : { width: Number(match[1]), height: Number(match[2]) },
  }
})
fs.writeFileSync(`${directory}/images.json`, `${JSON.stringify(images, null, 2)}\n`)
console.log(JSON.stringify({ images: images.length }))
