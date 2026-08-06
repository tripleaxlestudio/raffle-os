import { acceptSequence, parseEnvelope, type DisplayCapability, type ProtocolEnvelope, type ProtocolError, type ProtocolScope, type SequenceTracker } from './protocol';

export type TransportCapability = DisplayCapability & { readonly transport: 'available' | 'unavailable' };
export type TransportResult = { readonly ok: true } | { readonly ok: false; readonly error: ProtocolError };
export type TransportListener = (envelope: ProtocolEnvelope) => void;
export type Transport = {
  readonly capability: TransportCapability;
  publish(envelope: ProtocolEnvelope): TransportResult;
  subscribe(listener: TransportListener): () => void;
  onClose?: (listener: () => void) => () => void;
  close(): void;
};

type ChannelHub = { readonly listeners: Set<(value: unknown) => void> };
const hubs = new Map<string, ChannelHub>();

const unavailable = (reason: string): TransportResult => ({ ok: false, error: { kind: 'transport-unavailable', reason } });

const createChannelTransport = (channel: { postMessage(value: unknown): void; addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void; removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void; close(): void }, capability: TransportCapability): Transport => {
  let closed = false;
  const subscriptions = new Set<TransportListener>();
  const closeListeners = new Set<() => void>();
  const onMessage = (event: MessageEvent<unknown>): void => {
    const parsed = parseEnvelope(event.data);
    if (!parsed.ok) return;
    subscriptions.forEach((listener) => {
      try {
        listener(parsed.envelope);
      } catch {
        // A presentation listener is isolated so one broken surface cannot stop others.
      }
    });
  };
  channel.addEventListener('message', onMessage);
  return {
    capability,
    publish(envelope) {
      if (closed) return { ok: false, error: { kind: 'transport-closed' } };
      channel.postMessage(envelope);
      return { ok: true };
    },
    subscribe(listener) {
      if (closed) return () => undefined;
      subscriptions.add(listener);
      return () => subscriptions.delete(listener);
    },
    close() {
      if (closed) return;
      closed = true;
      subscriptions.clear();
      channel.removeEventListener('message', onMessage);
      channel.close();
      closeListeners.forEach((listener) => { try { listener() } catch { /* close observers are isolated */ } });
      closeListeners.clear();
    },
    onClose(listener) { if (closed) { listener(); return () => undefined } closeListeners.add(listener); return () => closeListeners.delete(listener) },
  };
};

export const createBroadcastChannelTransport = (channelName: string, scope: ProtocolScope): Transport => {
  const Constructor = globalThis.BroadcastChannel;
  if (typeof Constructor !== 'function') {
    return { capability: { transport: 'unavailable', broadcastChannel: 'unavailable', fullscreen: 'unavailable' }, publish: () => unavailable('BroadcastChannel is unavailable.'), subscribe: () => () => undefined, close: () => undefined };
  }
  try {
    const channel = new Constructor(`${channelName}:${scope.eventId}:${scope.displayId}`);
    return createChannelTransport(channel, { transport: 'available', broadcastChannel: 'available', fullscreen: typeof document !== 'undefined' && 'fullscreenEnabled' in document ? 'available' : 'unavailable' });
  } catch {
    return { capability: { transport: 'unavailable', broadcastChannel: 'unavailable', fullscreen: 'unavailable' }, publish: () => unavailable('BroadcastChannel could not be created.'), subscribe: () => () => undefined, close: () => undefined };
  }
};

export const createAudienceTransport = createBroadcastChannelTransport;

export const createInMemoryTransportPair = (channelName: string, capability: TransportCapability = { transport: 'available', broadcastChannel: 'available', fullscreen: 'unavailable' }): [Transport, Transport] => {
  const hub = hubs.get(channelName) ?? { listeners: new Set<(value: unknown) => void>() };
  hubs.set(channelName, hub);
  const make = (): Transport => {
    let closed = false;
    const subscriptions = new Set<TransportListener>();
    const closeListeners = new Set<() => void>();
    const lastBySender = new Map<string, SequenceTracker>();
    const forward = (value: unknown): void => {
      const parsed = parseEnvelope(value);
      if (!parsed.ok) return;
      const senderKey = `${parsed.envelope.sender.kind}:${parsed.envelope.sender.id}`;
      if (parsed.envelope.message.type !== 'display-heartbeat' && !(parsed.envelope.message.type === 'display-state' && parsed.envelope.message.restore === true)) {
        const orderingError = acceptSequence(lastBySender.get(senderKey), parsed.envelope);
        if (orderingError !== undefined) {
          if (orderingError.kind === 'sequence-out-of-order') return;
          return;
        }
        lastBySender.set(senderKey, parsed.envelope);
      }
      subscriptions.forEach((listener) => {
        try {
          listener(parsed.envelope);
        } catch {
          // A presentation listener is isolated so one broken surface cannot stop others.
        }
      });
    };
    return {
      capability,
      publish(envelope) {
        if (closed) return { ok: false, error: { kind: 'transport-closed' } };
        hub.listeners.forEach((listener) => listener(structuredClone(envelope)));
        return { ok: true };
      },
      subscribe(listener) {
        if (closed) return () => undefined;
        subscriptions.add(listener);
        hub.listeners.add(forward);
        return () => { subscriptions.delete(listener); if (subscriptions.size === 0) hub.listeners.delete(forward); };
      },
      onClose(listener) { if (closed) { listener(); return () => undefined } closeListeners.add(listener); return () => closeListeners.delete(listener) },
      close() { if (closed) return; closed = true; subscriptions.clear(); hub.listeners.delete(forward); closeListeners.forEach((listener) => { try { listener() } catch { /* close observers are isolated */ } }); closeListeners.clear(); },
    };
  };
  return [make(), make()];
};
