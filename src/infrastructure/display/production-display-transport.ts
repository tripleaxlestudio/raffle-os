import { createBroadcastChannelTransport, createCompositeDisplayTransport, type Transport } from '../../application/display-transport/transport.ts'
import type { ProtocolScope } from '../../application/display-transport/protocol.ts'
import { createWebSocketDisplayTransport, type DisplayClientRole } from '../../application/display-transport/websocket-transport.ts'
import { DexiePrizeImageAssetRepository } from '../persistence/repositories/prize-image-asset.repository.ts'

async function resolvePrizeAsset(assetId: string): Promise<Blob | null> {
  const repository = new DexiePrizeImageAssetRepository()
  try {
    return (await repository.findById(assetId))?.blob ?? null
  } finally {
    repository.close()
  }
}

export function createProductionDisplayTransport(role: DisplayClientRole, scope: ProtocolScope): Transport {
  const websocket = createWebSocketDisplayTransport({ role, scope, ...(role === 'operator' ? { resolvePrizeAsset } : {}) })
  const broadcast = createBroadcastChannelTransport('raffle-os-display', scope)
  return createCompositeDisplayTransport(websocket, broadcast)
}
