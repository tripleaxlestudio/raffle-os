export interface PrototypeNavigationItem {
  readonly label: string
  readonly to: string
}

export const prototypeNavigationItems = Object.freeze([
  Object.freeze({
    label: 'Draw Setup — Practice Ready',
    to: '/draw/setup?mode=practice&scenario=ready',
  }),
  Object.freeze({
    label: 'Draw Setup — Live Ready',
    to: '/draw/setup?mode=live&scenario=ready',
  }),
  Object.freeze({
    label: 'Draw Setup — Insufficient Pool',
    to: '/draw/setup?mode=practice&scenario=insufficient',
  }),
  Object.freeze({
    label: 'Live Draw — Practice Ready',
    to: '/draw/live?state=ready&mode=practice',
  }),
  Object.freeze({
    label: 'Live Draw — Live Ready',
    to: '/draw/live?state=ready&mode=live',
  }),
  Object.freeze({
    label: 'Live Draw — Countdown',
    to: '/draw/live?state=running&mode=practice&stage=countdown',
  }),
  Object.freeze({
    label: 'Live Draw — Rolling',
    to: '/draw/live?state=running&mode=practice&stage=rolling',
  }),
  Object.freeze({
    label: 'Pending Results - Pending',
    to: '/draw/results?scenario=pending',
  }),
  Object.freeze({
    label: 'Pending Results - Partial confirmation',
    to: '/draw/results?scenario=partial',
  }),
  Object.freeze({
    label: 'Pending Results - Confirmed',
    to: '/draw/results?scenario=confirmed',
  }),
  Object.freeze({
    label: 'Redraw - Single winner',
    to: '/draw/results?panel=redraw&selection=single',
  }),
  Object.freeze({
    label: 'Redraw - Multiple winners',
    to: '/draw/results?panel=redraw&selection=multiple',
  }),
  Object.freeze({
    label: 'Redraw - Replacement preview',
    to: '/draw/results?panel=replacement',
  }),
  Object.freeze({
    label: 'History - Draw Sessions',
    to: '/history?view=sessions',
  }),
  Object.freeze({
    label: 'History - All Winners',
    to: '/history?view=winners',
  }),
  Object.freeze({
    label: 'History - Audit Log',
    to: '/history?view=audit',
  }),
  Object.freeze({
    label: 'History - Session detail',
    to: '/history?view=session-detail',
  }),
  Object.freeze({
    label: 'Settings - Branding',
    to: '/settings?section=branding',
  }),
  Object.freeze({
    label: 'Settings - Presentation',
    to: '/settings?section=presentation',
  }),
  Object.freeze({
    label: 'Settings - Audio',
    to: '/settings?section=audio',
  }),
  Object.freeze({
    label: 'Settings - Display',
    to: '/settings?section=display',
  }),
  Object.freeze({
    label: 'Audience Standby',
    to: '/display?state=standby',
  }),
  Object.freeze({
    label: 'Audience Countdown',
    to: '/display?state=countdown',
  }),
  Object.freeze({
    label: 'Audience Rolling',
    to: '/display?state=rolling',
  }),
  Object.freeze({
    label: 'Reveal 1',
    to: '/display?state=reveal&count=1',
  }),
  Object.freeze({
    label: 'Reveal 6',
    to: '/display?state=reveal&count=6',
  }),
  Object.freeze({
    label: 'Reveal 10',
    to: '/display?state=reveal&count=10',
  }),
  Object.freeze({
    label: 'Reveal 20',
    to: '/display?state=reveal&count=20',
  }),
  Object.freeze({
    label: 'Confirmed 1',
    to: '/display?state=confirmed&count=1',
  }),
  Object.freeze({
    label: 'Confirmed 6',
    to: '/display?state=confirmed&count=6',
  }),
  Object.freeze({
    label: 'Confirmed 10',
    to: '/display?state=confirmed&count=10',
  }),
  Object.freeze({
    label: 'Confirmed 20',
    to: '/display?state=confirmed&count=20',
  }),
  Object.freeze({
    label: 'Blackout',
    to: '/display?state=blackout',
  }),
  Object.freeze({
    label: 'Disconnected',
    to: '/display?state=disconnected',
  }),
]) satisfies readonly PrototypeNavigationItem[]
