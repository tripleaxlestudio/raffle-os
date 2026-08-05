import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  acceptSequence,
  parseEnvelope,
  validateEnvelopeContext,
  type ProtocolEnvelope,
} from './protocol';

const envelope = (overrides: Partial<ProtocolEnvelope> = {}): ProtocolEnvelope => ({
  protocolVersion: PROTOCOL_VERSION,
  messageId: 'message-1',
  sender: { kind: 'operator', id: 'operator-1' },
  scope: { eventId: 'event-1', displayId: 'display-1' },
  drawSessionId: 'session-1',
  epoch: 1,
  sequence: 1,
  emittedAt: '2026-08-05T00:00:00.000Z',
  message: { type: 'display-state', stage: 'standby' },
  ...overrides,
});

describe('display protocol envelope', () => {
  it('accepts a valid envelope and clones nested input values', () => {
    const input = envelope({ message: { type: 'display-ready', capability: { broadcastChannel: 'available', fullscreen: 'unavailable' } } });
    const parsed = parseEnvelope(input);
    expect(parsed).toEqual({ ok: true, envelope: input });
    if (parsed.ok) {
      expect(parsed.envelope).not.toBe(input);
      expect(parsed.envelope.sender).not.toBe(input.sender);
      expect(parsed.envelope.message).not.toBe(input.message);
    }
  });

  it('rejects malformed envelopes and unsupported protocol versions', () => {
    expect(parseEnvelope({})).toMatchObject({ ok: false, error: { kind: 'invalid-envelope' } });
    expect(parseEnvelope({ ...envelope(), protocolVersion: 999 })).toMatchObject({ ok: false, error: { kind: 'unsupported-version', received: 999 } });
  });

  it('rejects invalid message stage and session/scope mismatches', () => {
    expect(parseEnvelope({ ...envelope(), message: { type: 'display-state', stage: 'secret' } })).toMatchObject({ ok: false, error: { kind: 'invalid-envelope', path: 'message.stage' } });
    const valid = parseEnvelope(envelope());
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(validateEnvelopeContext(valid.envelope, { eventId: 'event-2', displayId: 'display-1' })).toMatchObject({ kind: 'scope-mismatch' });
    expect(validateEnvelopeContext(valid.envelope, { eventId: 'event-1', displayId: 'display-1' }, 'session-2')).toMatchObject({ kind: 'session-mismatch' });
  });

  it('handles duplicate, stale, and out-of-order sequences deterministically', () => {
    expect(acceptSequence(undefined, { epoch: 1, sequence: 1 })).toBeUndefined();
    expect(acceptSequence({ epoch: 1, sequence: 1 }, { epoch: 1, sequence: 1 })).toMatchObject({ kind: 'sequence-duplicate' });
    expect(acceptSequence({ epoch: 1, sequence: 2 }, { epoch: 1, sequence: 1 })).toMatchObject({ kind: 'sequence-stale' });
    expect(acceptSequence({ epoch: 1, sequence: 1 }, { epoch: 1, sequence: 3 })).toMatchObject({ kind: 'sequence-out-of-order', expected: 2 });
    expect(acceptSequence({ epoch: 1, sequence: 1 }, { epoch: 2, sequence: 0 })).toBeUndefined();
  });

  it('does not mutate the input envelope', () => {
    const input = envelope({ message: { type: 'display-ready', capability: { broadcastChannel: 'available', fullscreen: 'available' } } });
    const before = structuredClone(input);
    parseEnvelope(input);
    expect(input).toEqual(before);
  });
});
