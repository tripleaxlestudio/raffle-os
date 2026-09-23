import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const manifest: unknown = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
if (typeof manifest !== 'object' || manifest === null || !('version' in manifest) || typeof manifest.version !== 'string') throw new Error('Missing package version.')

export default defineConfig({
  define: {
    __KOCOKAN_RUNTIME_VERSION__: JSON.stringify(manifest.version),
    // Ship ws's supported pure-JS path. Optional native accelerators must not
    // become empty optional-peer shims in the portable bundle.
    'process.env.WS_NO_BUFFER_UTIL': JSON.stringify('1'),
    'process.env.WS_NO_UTF_8_VALIDATE': JSON.stringify('1'),
  },
  ssr: { noExternal: ['ws'] },
  build: {
    ssr: 'server/runtime-entry.ts',
    target: 'node22',
    outDir: 'dist-runtime',
    rolldownOptions: { output: { format: 'cjs', entryFileNames: 'kocokan-server.cjs' } },
  },
})
