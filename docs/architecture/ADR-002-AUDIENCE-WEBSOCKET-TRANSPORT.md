# ADR-002: Authoritative local WebSocket transport for Audience Display

Status: Approved by the 2026-09-08 Audience transport amendment.

## Context

`BroadcastChannel` only connects compatible same-origin browser contexts. A
vMix Web Browser input can run in a separate embedded browser process and may
therefore load `/display` without receiving the Operator's public presentation
state.

## Decision

- The local Kocokan runtime exposes `/ws/display` on its existing loopback HTTP
  server. WebSocket is the authoritative production transport between Operator
  and Audience clients across browser engines and processes.
- Rooms are scoped by `eventId` and `displayConfigurationId`. One Operator and
  multiple Audience clients are supported per room.
- The hub retains only the latest validated public `display-state` wire payload
  and sends it immediately to a newly connected or reconnected Audience.
- `BroadcastChannel` remains available as a same-browser optimization and
  compatibility fallback. A composite adapter deduplicates envelopes before
  application controllers receive them.
- The existing public projection, protocol scope/session checks, ordering,
  acknowledgement, restore, liveness, and disconnected-safe behavior remain
  application authorities.
- Public binary assets use an explicit bounded wire representation or a
  loopback public-asset endpoint. Participant records, notes, check-in data,
  Operator controls, private history metadata, and domain commands are never
  accepted by the hub.
- Actual WebSocket Audience peer count is the primary production connection
  status. BroadcastChannel heartbeat remains diagnostic/fallback evidence only.

## Runtime boundary

The realtime hub is a presentation relay. It is not a draw engine, random
source, eligibility evaluator, persistence authority, history store, recovery
arbiter, or presentation state machine. It must never initiate or replay a draw,
redraw, confirmation, or other domain action.

The development and preview servers attach the hub to their loopback listener.
A future packaged Host may reuse the same hub module; packaging and installer
work are outside this decision.

## Consequences

- `/display` works across Chrome, vMix, and other browser processes served from
  the same local runtime.
- A runtime restart clears the hub's in-memory retained snapshot. The Operator
  remains responsible for republishing its authoritative recovery or Standby
  projection after reconnect.
- The loopback server must enforce role, scope, protocol, payload-size, and
  public-message validation before retaining or relaying data.
