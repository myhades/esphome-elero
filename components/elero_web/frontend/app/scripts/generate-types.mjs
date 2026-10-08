import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

rmSync('src/generated', { recursive: true, force: true })
const result = spawnSync(process.execPath, ['node_modules/@asyncapi/cli/bin/run', 'generate', 'models', 'typescript', 'asyncapi.yaml', '-o', 'src/generated', '--tsModelType', 'interface', '--tsEnumType', 'union', '--tsExportType', 'named', '--tsIncludeComments', '--tsRawPropertyNames'], { stdio: 'inherit' })
if (result.error || result.status !== 0) process.exit(result.status || 1)
writeFileSync('src/generated/index.ts', readdirSync('src/generated').filter(f => f.endsWith('.ts') && f !== 'index.ts').sort().map(f => `export type { ${f.slice(0, -3)} } from './${f.slice(0, -3)}'`).join('\n') + '\n')
