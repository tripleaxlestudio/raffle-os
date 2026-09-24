declare const __KOCOKAN_APP_VERSION__: string

export const KOCOKAN_APP_VERSION = typeof __KOCOKAN_APP_VERSION__ === 'string'
  ? __KOCOKAN_APP_VERSION__
  : 'Tidak tersedia'
