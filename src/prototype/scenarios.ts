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
]) satisfies readonly PrototypeNavigationItem[]
