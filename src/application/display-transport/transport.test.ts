import { describe, expect, it, vi } from 'vitest';
import { createBroadcastChannelTransport, createInMemoryTransportPair } from './transport';
import { PROTOCOL_VERSION, type ProtocolEnvelope } from './protocol';

const message = (sequence: number): ProtocolEnvelope => ({
  protocolVersion: PROTOCOL_VERSION,
  messageId: `message-${sequence}`,
  sender: { kind: 'operator', id: 'operator-1' },
  scope: { eventId: 'event-1', displayId: 'display-1' },
  epoch: 1,
  sequence,
  emittedAt: '2026-08-05T00:00:00.000Z',
  message: { type: 'display-state', stage: 'standby' },
});

describe('display transports', () => {
  it('delivers equivalent messages to multiple listeners and cleans up subscriptions', () => {
    const [publisher, display] = createInMemoryTransportPair('test-multiple');
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = display.subscribe(first);
    display.subscribe(second);
    expect(publisher.publish(message(1))).toEqual({ ok: true });
    expect(first).toHaveBeenCalledWith(message(1));
    expect(second).toHaveBeenCalledWith(message(1));
    unsubscribeFirst();
    expect(publisher.publish(message(2))).toEqual({ ok: true });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    publisher.close();
    display.close();
  });

  it('drops duplicate and out-of-order messages consistently', () => {
    const [publisher, display] = createInMemoryTransportPair('test-ordering');
    const listener = vi.fn();
    display.subscribe(listener);
    publisher.publish(message(1));
    publisher.publish(message(1));
    publisher.publish(message(3));
    publisher.publish(message(2));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(message(1));
    expect(listener).toHaveBeenCalledWith(message(2));
  });

  it('isolates a failing listener from other listeners', () => {
    const [publisher, display] = createInMemoryTransportPair('test-listener-errors');
    const good = vi.fn();
    display.subscribe(() => { throw new Error('listener failed'); });
    display.subscribe(good);
    expect(() => publisher.publish(message(1))).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('closes safely and rejects publish after close without side effects', () => {
    const [publisher, display] = createInMemoryTransportPair('test-close');
    const listener = vi.fn();
    display.subscribe(listener);
    publisher.close();
    publisher.close();
    expect(publisher.publish(message(1))).toEqual({ ok: false, error: { kind: 'transport-closed' } });
    expect(listener).not.toHaveBeenCalled();
    display.close();
  });

  it('is lifecycle-safe when a subscription is mounted and immediately cleaned up', () => {
    const [publisher, display] = createInMemoryTransportPair('test-remount');
    const listener = vi.fn();
    const cleanup = display.subscribe(listener);
    cleanup();
    display.subscribe(listener);
    publisher.publish(message(1));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports a typed unavailable capability when BroadcastChannel is missing', () => {
    const original = globalThis.BroadcastChannel;
    vi.stubGlobal('BroadcastChannel', undefined);
    const transport = createBroadcastChannelTransport('test-unavailable', { eventId: 'event-1', displayId: 'display-1' });
    expect(transport.capability).toEqual({ transport: 'unavailable', broadcastChannel: 'unavailable', fullscreen: 'unavailable' });
    expect(transport.publish(message(1))).toMatchObject({ ok: false, error: { kind: 'transport-unavailable' } });
    transport.close();
    vi.stubGlobal('BroadcastChannel', original);
  });

  it('uses BroadcastChannel when available and cleans its native listener on close', () => {
    class FakeBroadcastChannel {
      static channels = new Map<string, Set<FakeBroadcastChannel>>();
      readonly name: string;
      readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
      readonly peers: Set<FakeBroadcastChannel>;
      constructor(name: string) {
        this.name = name;
        this.peers = FakeBroadcastChannel.channels.get(name) ?? new Set();
        this.peers.add(this);
        FakeBroadcastChannel.channels.set(name, this.peers);
      }
      postMessage(value: unknown): void { this.peers.forEach((peer) => { if (peer !== this) peer.listeners.forEach((listener) => listener(new MessageEvent('message', { data: structuredClone(value) }))); }); }
      addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void { this.listeners.add(listener); }
      removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void { this.listeners.delete(listener); }
      close(): void { this.peers.delete(this); this.listeners.clear(); }
    }
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    const scope = { eventId: 'event-1', displayId: 'display-1' };
    const sender = createBroadcastChannelTransport('test-native', scope);
    const receiver = createBroadcastChannelTransport('test-native', scope);
    const listener = vi.fn();
    receiver.subscribe(listener);
    expect(sender.publish(message(1))).toEqual({ ok: true });
    expect(listener).toHaveBeenCalledTimes(1);
    receiver.close();
    expect(sender.publish(message(2))).toEqual({ ok: true });
    expect(listener).toHaveBeenCalledTimes(1);
    sender.close();
    vi.unstubAllGlobals();
  });
});
