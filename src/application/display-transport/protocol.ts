export const PROTOCOL_VERSION = 1 as const;

export type ProtocolScope = {
  readonly eventId: string;
  readonly displayId: string;
};

export type ProtocolSender = {
  readonly kind: 'operator' | 'display';
  readonly id: string;
};

export type DisplayCapability = {
  readonly broadcastChannel: 'available' | 'unavailable';
  readonly fullscreen: 'available' | 'unavailable';
};

export type PublicDisplayStage =
  | 'standby'
  | 'countdown'
  | 'rolling'
  | 'reveal'
  | 'pending-handoff'
  | 'confirmed'
  | 'blackout'
  | 'disconnected-safe';

export type PublicMessage =
  | {
      readonly type: 'display-ready';
      readonly capability: DisplayCapability;
    }
  | {
      readonly type: 'display-state';
      readonly stage: PublicDisplayStage;
      readonly drawSessionId?: string;
      readonly stageStartedAt?: string;
      readonly blackoutRequested?: boolean;
      readonly mode?: 'practice' | 'live';
      readonly ticketNumbers?: readonly string[];
      readonly restore?: boolean;
    }
  | {
      readonly type: 'display-restore-request';
      readonly requestedEpoch?: number;
      readonly requestedSequence?: number;
    }
  | {
      readonly type: 'display-close';
    };

export type ProtocolEnvelope = {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly messageId: string;
  readonly sender: ProtocolSender;
  readonly scope: ProtocolScope;
  readonly drawSessionId?: string;
  readonly epoch: number;
  readonly sequence: number;
  readonly emittedAt: string;
  readonly message: PublicMessage;
};

export type ProtocolEnvelopeFactory = (input: {
  readonly sender: ProtocolSender;
  readonly scope: ProtocolScope;
  readonly drawSessionId?: string;
  readonly epoch: number;
  readonly sequence: number;
  readonly emittedAt: string;
  readonly message: PublicMessage;
}) => ProtocolEnvelope;

export const createProtocolEnvelope: ProtocolEnvelopeFactory = (input) => ({
  protocolVersion: PROTOCOL_VERSION,
  messageId: `${input.sender.kind}:${input.sender.id}:${input.epoch}:${input.sequence}`,
  sender: { ...input.sender },
  scope: { ...input.scope },
  ...(input.drawSessionId === undefined ? {} : { drawSessionId: input.drawSessionId }),
  epoch: input.epoch,
  sequence: input.sequence,
  emittedAt: input.emittedAt,
  message: input.message,
});

export type ParseEnvelopeResult =
  | { readonly ok: true; readonly envelope: ProtocolEnvelope }
  | { readonly ok: false; readonly error: ProtocolError };

export type ProtocolError =
  | { readonly kind: 'invalid-envelope'; readonly path: string; readonly message: string }
  | { readonly kind: 'unsupported-version'; readonly received: unknown }
  | { readonly kind: 'scope-mismatch'; readonly expected: ProtocolScope; readonly received: ProtocolScope }
  | { readonly kind: 'session-mismatch'; readonly expected: string; readonly received?: string }
  | { readonly kind: 'sequence-duplicate'; readonly epoch: number; readonly sequence: number }
  | { readonly kind: 'sequence-stale'; readonly epoch: number; readonly sequence: number }
  | { readonly kind: 'sequence-out-of-order'; readonly expected: number; readonly received: number }
  | { readonly kind: 'sequence-gap'; readonly expected: number; readonly received: number }
  | { readonly kind: 'duplicate-message'; readonly messageId: string }
  | { readonly kind: 'restore-rejected'; readonly reason: 'session-mismatch' | 'scope-mismatch' | 'invalid-request' }
  | { readonly kind: 'transport-unavailable'; readonly reason: string }
  | { readonly kind: 'transport-closed' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isCapability = (value: unknown): value is DisplayCapability =>
  isRecord(value) &&
  (value.broadcastChannel === 'available' || value.broadcastChannel === 'unavailable') &&
  (value.fullscreen === 'available' || value.fullscreen === 'unavailable');

const isStage = (value: unknown): value is PublicDisplayStage =>
  value === 'standby' ||
  value === 'countdown' ||
  value === 'rolling' ||
  value === 'reveal' ||
  value === 'pending-handoff' ||
  value === 'confirmed' ||
  value === 'blackout' ||
  value === 'disconnected-safe';

const invalid = (path: string, message: string): ParseEnvelopeResult => ({
  ok: false,
  error: { kind: 'invalid-envelope', path, message },
});

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

export const parseEnvelope = (value: unknown): ParseEnvelopeResult => {
  if (!isRecord(value)) return invalid('$', 'Envelope must be an object.');
  if (!hasOnlyKeys(value, ['protocolVersion', 'messageId', 'sender', 'scope', 'drawSessionId', 'epoch', 'sequence', 'emittedAt', 'message'])) return invalid('$', 'Envelope contains unsupported fields.');
  if (value.protocolVersion === undefined) return invalid('protocolVersion', 'Protocol version is required.');
  if (value.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, error: { kind: 'unsupported-version', received: value.protocolVersion } };
  }
  if (!isNonEmptyString(value.messageId)) return invalid('messageId', 'Message ID is required.');
  if (!isRecord(value.sender) || !isNonEmptyString(value.sender.id) || (value.sender.kind !== 'operator' && value.sender.kind !== 'display')) {
    return invalid('sender', 'Sender must have a valid kind and ID.');
  }
  if (!isRecord(value.scope) || !isNonEmptyString(value.scope.eventId) || !isNonEmptyString(value.scope.displayId)) {
    return invalid('scope', 'Scope must have eventId and displayId.');
  }
  if (value.drawSessionId !== undefined && !isNonEmptyString(value.drawSessionId)) return invalid('drawSessionId', 'Session ID must be a non-empty string.');
  const epoch = value.epoch;
  const sequence = value.sequence;
  if (typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 0) return invalid('epoch', 'Epoch must be a non-negative safe integer.');
  if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 0) return invalid('sequence', 'Sequence must be a non-negative safe integer.');
  if (!isNonEmptyString(value.emittedAt) || Number.isNaN(Date.parse(value.emittedAt))) return invalid('emittedAt', 'Timestamp must be a valid string.');
  if (!isRecord(value.message) || !isNonEmptyString(value.message.type)) return invalid('message', 'Message type is required.');

  const message = value.message;
  const messageType = message.type;
  const capability = message.capability;
  const stage = message.stage;
  const validCapability = isCapability(capability) ? capability : undefined;
  const validStage = isStage(stage) ? stage : undefined;
  if (messageType === 'display-ready' && (!hasOnlyKeys(message, ['type', 'capability']) || validCapability === undefined)) return invalid('message', 'Display-ready message contains unsupported or invalid fields.');
  if (messageType === 'display-state' && validStage === undefined) return invalid('message.stage', 'Display stage is invalid.');
  if (messageType === 'display-state' && !hasOnlyKeys(message, ['type', 'stage', 'drawSessionId', 'stageStartedAt', 'blackoutRequested', 'mode', 'ticketNumbers', 'restore'])) return invalid('message', 'Display-state message contains unsupported fields.');
  if (messageType === 'display-restore-request' && !hasOnlyKeys(message, ['type', 'requestedEpoch', 'requestedSequence'])) return invalid('message', 'Restore request contains unsupported fields.');
  if (messageType === 'display-close' && !hasOnlyKeys(message, ['type'])) return invalid('message', 'Close message contains unsupported fields.');
  if (messageType !== 'display-ready' && messageType !== 'display-state' && messageType !== 'display-restore-request' && messageType !== 'display-close') {
    return invalid('message.type', 'Message type is unsupported.');
  }

  let parsedMessage: PublicMessage;
  if (messageType === 'display-ready') {
    if (validCapability === undefined) return invalid('message.capability', 'Capability is invalid.');
    parsedMessage = { type: messageType, capability: { ...validCapability } };
  } else if (messageType === 'display-state') {
    if (validStage === undefined) return invalid('message.stage', 'Display stage is invalid.');
    const ticketNumbers = message.ticketNumbers;
    if (message.drawSessionId !== undefined && !isNonEmptyString(message.drawSessionId)) return invalid('message.drawSessionId', 'Projection session ID must be a non-empty string.');
    if (message.stageStartedAt !== undefined && (!isNonEmptyString(message.stageStartedAt) || Number.isNaN(Date.parse(message.stageStartedAt)))) return invalid('message.stageStartedAt', 'Stage timestamp must be valid.');
    if (message.blackoutRequested !== undefined && typeof message.blackoutRequested !== 'boolean') return invalid('message.blackoutRequested', 'Blackout state must be boolean.');
    if (message.mode !== undefined && message.mode !== 'practice' && message.mode !== 'live') return invalid('message.mode', 'Display mode is invalid.');
    if (message.restore !== undefined && typeof message.restore !== 'boolean') return invalid('message.restore', 'Restore marker must be boolean.');
    if (ticketNumbers !== undefined && (!Array.isArray(ticketNumbers) || ticketNumbers.some((ticket) => !isNonEmptyString(ticket)))) return invalid('message.ticketNumbers', 'Ticket numbers must be non-empty strings.');
    parsedMessage = {
      type: messageType,
      stage: validStage,
      ...(message.drawSessionId === undefined ? {} : { drawSessionId: message.drawSessionId }),
      ...(message.stageStartedAt === undefined ? {} : { stageStartedAt: message.stageStartedAt }),
      ...(message.blackoutRequested === undefined ? {} : { blackoutRequested: message.blackoutRequested }),
      ...(message.mode === undefined ? {} : { mode: message.mode }),
      ...(ticketNumbers === undefined ? {} : { ticketNumbers: [...ticketNumbers] }),
      ...(message.restore === undefined ? {} : { restore: message.restore }),
    };
  } else if (messageType === 'display-restore-request') {
    if (message.requestedEpoch !== undefined && (typeof message.requestedEpoch !== 'number' || !Number.isSafeInteger(message.requestedEpoch) || message.requestedEpoch < 0)) return invalid('message.requestedEpoch', 'Requested epoch is invalid.');
    if (message.requestedSequence !== undefined && (typeof message.requestedSequence !== 'number' || !Number.isSafeInteger(message.requestedSequence) || message.requestedSequence < 0)) return invalid('message.requestedSequence', 'Requested sequence is invalid.');
    parsedMessage = {
      type: messageType,
      ...(typeof message.requestedEpoch !== 'number' ? {} : { requestedEpoch: message.requestedEpoch }),
      ...(typeof message.requestedSequence !== 'number' ? {} : { requestedSequence: message.requestedSequence }),
    };
  } else {
    parsedMessage = { type: messageType };
  }

  const envelope: ProtocolEnvelope = {
    protocolVersion: PROTOCOL_VERSION,
    messageId: value.messageId,
    sender: { kind: value.sender.kind, id: value.sender.id },
    scope: { eventId: value.scope.eventId, displayId: value.scope.displayId },
    ...(value.drawSessionId === undefined ? {} : { drawSessionId: value.drawSessionId }),
    epoch,
    sequence,
    emittedAt: value.emittedAt,
    message: parsedMessage,
  };
  return { ok: true, envelope };
};

export const createScopeMismatchError = (expected: ProtocolScope, received: ProtocolScope): ProtocolError => ({
  kind: 'scope-mismatch', expected, received,
});

export const validateEnvelopeContext = (
  envelope: ProtocolEnvelope,
  expectedScope: ProtocolScope,
  expectedSession?: string,
): ProtocolError | undefined => {
  if (envelope.scope.eventId !== expectedScope.eventId || envelope.scope.displayId !== expectedScope.displayId) {
    return createScopeMismatchError(expectedScope, envelope.scope);
  }
  if (expectedSession !== undefined && envelope.drawSessionId !== expectedSession) {
    return { kind: 'session-mismatch', expected: expectedSession, received: envelope.drawSessionId };
  }
  return undefined;
};

export type SequenceTracker = { readonly epoch: number; readonly sequence: number };

export const acceptSequence = (previous: SequenceTracker | undefined, incoming: SequenceTracker): ProtocolError | undefined => {
  if (previous === undefined) return undefined;
  if (incoming.epoch < previous.epoch || (incoming.epoch === previous.epoch && incoming.sequence < previous.sequence)) {
    return { kind: 'sequence-stale', epoch: incoming.epoch, sequence: incoming.sequence };
  }
  if (incoming.epoch === previous.epoch && incoming.sequence === previous.sequence) {
    return { kind: 'sequence-duplicate', epoch: incoming.epoch, sequence: incoming.sequence };
  }
  if (incoming.epoch === previous.epoch && incoming.sequence > previous.sequence + 1) {
    return { kind: 'sequence-out-of-order', expected: previous.sequence + 1, received: incoming.sequence };
  }
  return undefined;
};
