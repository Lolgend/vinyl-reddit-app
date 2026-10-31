export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'NEVER'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'UNKNOWN'

  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 0) return 'JUST NOW'
  if (diffSec < 60) return `${diffSec}S AGO`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}M AGO`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}H AGO`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}D AGO`
}
