import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'

const digest = p => createHash('sha256').update(readFileSync(p, 'utf8').replaceAll('\r\n', '\n')).digest('hex')
const inputs = readdirSync('.').filter(p => ['.json', '.yaml', '.ts', '.html'].includes(extname(p)))
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'generated') continue
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) walk(path)
    else inputs.push(path)
  }
}
walk('src')
walk('scripts')
writeFileSync('../../elero_web_ui.manifest.json', JSON.stringify({ schema: 1, inputs: Object.fromEntries(inputs.sort().map(p => [p, digest(p)])), header_sha256: digest('../../elero_web_ui.h') }, null, 2) + '\n')
