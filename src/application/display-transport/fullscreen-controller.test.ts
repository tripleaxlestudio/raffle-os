import { describe, expect, it, vi } from 'vitest'
import { createFullscreenController, type FullscreenDocument } from './fullscreen-controller.ts'

function harness() {
  const target = document.createElement('main')
  let fullscreenElement: Element | null = null
  const listeners = new Set<() => void>()
  const fullscreenDocument: FullscreenDocument = {
    fullscreenEnabled: true,
    get fullscreenElement() { return fullscreenElement },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    exitFullscreen: vi.fn(async () => { fullscreenElement = null; listeners.forEach((listener) => listener()) }),
  }
  target.requestFullscreen = vi.fn(async () => { fullscreenElement = target; listeners.forEach((listener) => listener()) })
  return { target, fullscreenDocument, listeners }
}

describe('fullscreen controller', () => {
  it('starts windowed, enters only on explicit action, and observes external exit', async () => {
    const { target, fullscreenDocument } = harness()
    const controller = createFullscreenController({ document: fullscreenDocument, target })
    expect(controller.getState()).toBe('windowed')
    expect(target.requestFullscreen).not.toHaveBeenCalled()
    await controller.enter()
    expect(controller.getState()).toBe('fullscreen')
    await controller.exit()
    expect(controller.getState()).toBe('windowed')
    controller.close()
  })

  it('reports unsupported capability without throwing', async () => {
    const controller = createFullscreenController({ document: { addEventListener: () => undefined, removeEventListener: () => undefined }, target: document.createElement('main') })
    expect(controller.getState()).toBe('unsupported')
    expect(await controller.enter()).toBe('unsupported')
    expect(await controller.exit()).toBe('unsupported')
    controller.close()
  })

  it('isolates denial/failure and removes its listener on close', async () => {
    const { target, fullscreenDocument, listeners } = harness()
    target.requestFullscreen = vi.fn(async () => { throw new DOMException('Denied', 'NotAllowedError') })
    const controller = createFullscreenController({ document: fullscreenDocument, target })
    expect(listeners).toHaveLength(1)
    expect(await controller.enter()).toBe('denied')
    controller.close()
    expect(listeners).toHaveLength(0)
  })
})
