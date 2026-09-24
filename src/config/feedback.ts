declare const __KOCOKAN_APP_VERSION__: string

export const KOCOKAN_APP_VERSION = typeof __KOCOKAN_APP_VERSION__ === 'string' ? __KOCOKAN_APP_VERSION__ : 'Tidak tersedia'
export const GOOGLE_FORM_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSckueKJdrR111voEETSbQoE9zKRnAvLdtM6gUMXlE1845mYFg/viewform'
export const GOOGLE_FORM_ENTRIES = {
  reportType: 'entry.2126261945',
  title: 'entry.1812280332',
  category: 'entry.393791348',
  severity: 'entry.415338700',
  happened: 'entry.313987746',
  expected: 'entry.1710802415',
  reproduction: 'entry.1492394220',
  appVersion: 'entry.1278727189',
  userAgent: 'entry.548231307',
  origin: 'entry.1284846782',
} as const
export const GOOGLE_FORM_MAX_URL_LENGTH = 8_000
