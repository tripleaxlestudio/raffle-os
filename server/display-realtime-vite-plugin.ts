import { Server as HttpServer } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import { attachDisplayRealtimeHub } from './display-realtime-hub.ts'

function install(server: Pick<ViteDevServer, 'httpServer' | 'middlewares' | 'close'>): void {
  if (!(server.httpServer instanceof HttpServer)) return
  const hub = attachDisplayRealtimeHub(server.httpServer)
  server.middlewares.use(hub.middleware)
  const close = server.close.bind(server)
  server.close = async () => {
    await hub.dispose()
    await close()
  }
}

export function createDisplayRealtimeHubPlugin(): Plugin {
  return {
    name: 'raffle-os-display-realtime-hub',
    configureServer: install,
    configurePreviewServer: install,
  }
}
