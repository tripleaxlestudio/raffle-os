import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { createDisplayRealtimeHubPlugin } from './server/display-realtime-vite-plugin.ts'

const packageMetadata: unknown = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
if (typeof packageMetadata !== 'object' || packageMetadata === null || !('version' in packageMetadata) || typeof packageMetadata.version !== 'string') throw new Error('Missing package version.')

// https://vite.dev/config/
export default defineConfig({
  define: {
    __KOCOKAN_APP_VERSION__: JSON.stringify(packageMetadata.version),
  },
  plugins: [createDisplayRealtimeHubPlugin(), react(), tailwindcss()],
})
