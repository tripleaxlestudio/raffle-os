import fs from 'node:fs'
import { createHash } from 'node:crypto'
const directory = 'docs/technical/evidence/kocokan-ui-slice3'
function jpegSize(bytes) {
  for(let offset = 2; offset < bytes.length;) {
    if(bytes[offset] !== 255) throw new Error('Invalid JPEG marker')
    const marker = bytes[offset + 1], length = bytes.readUInt16BE(offset + 2)
    if([192,193,194].includes(marker)) return {width:bytes.readUInt16BE(offset+7),height:bytes.readUInt16BE(offset+5)}
    offset += 2 + length
  }
  throw new Error('No JPEG size marker')
}
const images = fs.readdirSync(directory).filter(name=>name.endsWith('.jpg')).sort().map(name=>{
  const bytes=fs.readFileSync(`${directory}/${name}`)
  return {name,...jpegSize(bytes),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
})
fs.writeFileSync(`${directory}/images.json`,JSON.stringify(images,null,2)+'\n')
console.log(images)
