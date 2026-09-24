import { expect, it } from 'vitest'
import { createInMemoryTransportPair } from './transport.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createAudienceController } from './audience-controller.ts'

it('delivers only an image reference through the existing publisher and receiver', () => {
  const [operator, display] = createInMemoryTransportPair('prize-image')
  const scope = { eventId: 'event-image', displayId: 'display-image' }
  const receiver = createAudienceController({ transport: display, scope })
  const publisher = createOperatorPublisher({ transport: operator, scope, senderId: 'operator-image', clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
  publisher.start({ drawSessionId: '00000000-0000-4000-8000-000000000001' as never, stage: 'ready', blackoutRequested: false, prizeImageAssetId: 'persisted-asset' })
  expect(receiver.getState()).toMatchObject({ snapshot: { stage: 'standby', prizeImageAssetId: 'persisted-asset' } })
  publisher.publish({ drawSessionId: '00000000-0000-4000-8000-000000000001' as never, stage: 'countdown', stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false, prizeImageAssetId: 'persisted-asset' })
  expect(receiver.getState()).toMatchObject({ snapshot: { stage: 'countdown' } })
  expect(receiver.getState()).not.toMatchObject({ snapshot: { prizeImageAssetId: expect.any(String) } })
  expect(JSON.stringify(receiver.getState())).not.toMatch(/blob|base64|filesystem/)
  publisher.close()
  receiver.close()
})
