export interface PrototypeNavigationItem {
  readonly label: string
  readonly to: string
}

export const prototypeNavigationItems = Object.freeze([
  Object.freeze({
    label: 'Draw Setup — Practice Ready',
    to: '/dev/prototypes/draw/setup?mode=practice&scenario=ready',
  }),
  Object.freeze({
    label: 'Draw Setup — Live Ready',
    to: '/dev/prototypes/draw/setup?mode=live&scenario=ready',
  }),
  Object.freeze({
    label: 'Draw Setup — Insufficient Pool',
    to: '/dev/prototypes/draw/setup?mode=practice&scenario=insufficient',
  }),
  Object.freeze({
    label: 'Live Draw — Practice Ready',
    to: '/dev/prototypes/draw/live?state=ready&mode=practice',
  }),
  Object.freeze({
    label: 'Live Draw — Live Ready',
    to: '/dev/prototypes/draw/live?state=ready&mode=live',
  }),
  Object.freeze({
    label: 'Live Draw — Countdown',
    to: '/dev/prototypes/draw/live?state=running&mode=practice&stage=countdown',
  }),
  Object.freeze({
    label: 'Live Draw — Rolling',
    to: '/dev/prototypes/draw/live?state=running&mode=practice&stage=rolling',
  }),
  Object.freeze({
    label: 'Pending Results - Pending',
    to: '/dev/prototypes/draw/results?scenario=pending',
  }),
  Object.freeze({
    label: 'Pending Results - Partial confirmation',
    to: '/dev/prototypes/draw/results?scenario=partial',
  }),
  Object.freeze({
    label: 'Pending Results - Confirmed',
    to: '/dev/prototypes/draw/results?scenario=confirmed',
  }),
  Object.freeze({
    label: 'Redraw - Single winner',
    to: '/dev/prototypes/draw/results?panel=redraw&selection=single',
  }),
  Object.freeze({
    label: 'Redraw - Multiple winners',
    to: '/dev/prototypes/draw/results?panel=redraw&selection=multiple',
  }),
  Object.freeze({
    label: 'Redraw - Replacement preview',
    to: '/dev/prototypes/draw/results?panel=replacement',
  }),
  Object.freeze({
    label: 'History - Draw Sessions',
    to: '/dev/prototypes/history?view=sessions',
  }),
  Object.freeze({
    label: 'History - All Winners',
    to: '/dev/prototypes/history?view=winners',
  }),
  Object.freeze({
    label: 'History - Audit Log',
    to: '/dev/prototypes/history?view=audit',
  }),
  Object.freeze({
    label: 'History - Session detail',
    to: '/dev/prototypes/history?view=session-detail',
  }),
  Object.freeze({
    label: 'Settings - Branding',
    to: '/dev/prototypes/settings?section=branding',
  }),
  Object.freeze({
    label: 'Settings - Presentation',
    to: '/dev/prototypes/settings?section=presentation',
  }),
  Object.freeze({
    label: 'Settings - Audio',
    to: '/dev/prototypes/settings?section=audio',
  }),
  Object.freeze({
    label: 'Settings - Display',
    to: '/dev/prototypes/settings?section=display',
  }),
  Object.freeze({
    label: 'Audience Standby',
    to: '/dev/prototypes/display?state=standby',
  }),
  Object.freeze({
    label: 'Audience Countdown',
    to: '/dev/prototypes/display?state=countdown',
  }),
  Object.freeze({
    label: 'Audience Rolling',
    to: '/dev/prototypes/display?state=rolling',
  }),
  Object.freeze({
    label: 'Reveal 1',
    to: '/dev/prototypes/display?state=reveal&count=1',
  }),
  Object.freeze({
    label: 'Reveal 6',
    to: '/dev/prototypes/display?state=reveal&count=6',
  }),
  Object.freeze({
    label: 'Reveal 10',
    to: '/dev/prototypes/display?state=reveal&count=10',
  }),
  Object.freeze({
    label: 'Reveal 20',
    to: '/dev/prototypes/display?state=reveal&count=20',
  }),
  Object.freeze({
    label: 'Confirmed 1',
    to: '/dev/prototypes/display?state=confirmed&count=1',
  }),
  Object.freeze({
    label: 'Confirmed 6',
    to: '/dev/prototypes/display?state=confirmed&count=6',
  }),
  Object.freeze({
    label: 'Confirmed 10',
    to: '/dev/prototypes/display?state=confirmed&count=10',
  }),
  Object.freeze({
    label: 'Confirmed 20',
    to: '/dev/prototypes/display?state=confirmed&count=20',
  }),
  Object.freeze({
    label: 'Blackout',
    to: '/dev/prototypes/display?state=blackout',
  }),
  Object.freeze({
    label: 'Disconnected',
    to: '/dev/prototypes/display?state=disconnected',
  }),
]) satisfies readonly PrototypeNavigationItem[]
