import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createDisplayRealtimeHubPlugin } from './server/display-realtime-vite-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [createDisplayRealtimeHubPlugin(), react(), tailwindcss()],
})
