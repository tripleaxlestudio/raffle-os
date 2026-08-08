function pad(value: number): string { return String(value).padStart(2, '0') }

export function toDatetimeLocal(value: string | undefined): string {
  if (value === undefined) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toCanonicalTimestamp(value: string): string | undefined {
  if (value.trim() === '') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

export function formatEventTimestamp(value: string | undefined): string {
  if (value === undefined) return 'Not scheduled'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
