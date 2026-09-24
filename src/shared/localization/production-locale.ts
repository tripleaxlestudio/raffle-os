export const PRODUCTION_LOCALE = 'id-ID' as const

export const productionMessages = {
  appName: 'Raffle OS',
  audience: 'Tampilan Audiens',
  cancelled: 'Dibatalkan',
  confirmed: 'Dikonfirmasi',
  currentEvent: 'Acara aktif',
  dashboard: 'Dasbor',
  drawSetup: 'Pengaturan Undian',
  eligiblePool: 'Peserta memenuhi syarat',
  event: 'Acara',
  events: 'Acara',
  history: 'Riwayat',
  liveDraw: 'Undian',
  liveMode: 'Mode Live',
  loading: 'Memuat',
  operatorNavigation: 'Navigasi Operator',
  operatorSidebar: 'Bilah samping Operator',
  participants: 'Peserta',
  pending: 'Menunggu Konfirmasi',
  pendingResults: 'Hasil',
  practiceMode: 'Mode Latihan',
  prizeCategories: 'Kategori Hadiah',
  recovery: 'Pemulihan',
  redraw: 'Undi ulang',
  replacement: 'Pengganti',
  settings: 'Pengaturan',
  setupRequired: 'Perlu pengaturan',
  standby: 'Siaga',
  unavailable: 'Tidak tersedia',
} as const

export type ProductionMessageKey = keyof typeof productionMessages

export function productionMessage<Key extends ProductionMessageKey>(key: Key): (typeof productionMessages)[Key] {
  return productionMessages[key]
}

export function formatProductionNumber(value: number): string {
  return new Intl.NumberFormat(PRODUCTION_LOCALE).format(value)
}

export function formatProductionDate(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(PRODUCTION_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function formatProductionTime(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(PRODUCTION_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

export function formatProductionDateTime(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(PRODUCTION_LOCALE, { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(date)
}

export function productionDomainLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    active: 'Aktif',
    archived: 'Diarsipkan',
    cancelled: productionMessages.cancelled,
    confirmed: productionMessages.confirmed,
    disconnected: 'Terputus',
    draft: 'Draf',
    drawing: 'Sedang diundi',
    live: productionMessages.liveMode,
    pending: productionMessages.pending,
    'pending-confirmation': productionMessages.pending,
    practice: productionMessages.practiceMode,
    ready: 'Siap',
    standby: productionMessages.standby,
    waiting: 'Menunggu',
  }
  return labels[value] ?? value
}
