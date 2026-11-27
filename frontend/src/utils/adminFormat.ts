import type { LoopName } from '../types/admin'

export interface LoopDisplayMeta {
  title: string
  shortLabel: string
  tag: string
  description: string
}

export const LOOP_DISPLAY_META: Record<LoopName, LoopDisplayMeta> = {
  discovery_poll: {
    title: 'Discovery Poll',
    shortLabel: 'Discovery Poll',
    tag: '/new',
    description: 'Fetches newly posted community announcements',
  },
  tracking_poll: {
    title: 'Tracking Poll',
    shortLabel: 'Tracking Poll',
    tag: '/hot',
    description: 'Refreshes engagement on active threads',
  },
  extraction_worker: {
    title: 'Extraction Queue',
    shortLabel: 'Extraction',
    tag: 'worker',
    description: 'Parses release-eligible posts into catalog records',
  },
  enrichment_worker: {
    title: 'Enrichment Queue',
    shortLabel: 'Enrichment',
    tag: 'worker',
    description: 'Reconciles external discography metadata',
  },
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatIntervalSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remSeconds = seconds % 60
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`
}

export function formatDurationMs(durationMs?: number | null): string {
  if (durationMs === null || durationMs === undefined) return '—'
  if (durationMs < 1000) return `${durationMs}ms`
  const totalSeconds = durationMs / 1000
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const remSeconds = Math.floor(totalSeconds % 60)
  return `${minutes}m ${pad2(remSeconds)}s`
}

export function formatCountdownSeconds(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return 'Due now'
  if (remainingSeconds < 60) return `${remainingSeconds}s`
  const hours = Math.floor(remainingSeconds / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60
  if (hours > 0) {
    return `${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`
  }
  return `${minutes}m ${pad2(seconds)}s`
}

export function formatWaitingDuration(isoTimestamp: string, nowMs: number): string {
  const parsed = Date.parse(isoTimestamp)
  if (Number.isNaN(parsed)) return '—'
  const diffSec = Math.max(0, Math.floor((nowMs - parsed) / 1000))
  if (diffSec < 60) return `${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ${diffHours % 24}h`
}

export function formatRelativeToNow(isoTimestamp: string | null | undefined, nowMs: number): string {
  if (!isoTimestamp) return 'Never'
  const parsed = Date.parse(isoTimestamp)
  if (Number.isNaN(parsed)) return 'Unknown'
  const diffSec = Math.floor((nowMs - parsed) / 1000)
  if (diffSec <= 0) return 'Just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function formatThroughputStats(stats?: Record<string, number> | null): string {
  if (!stats) return 'No runs yet'
  const keys = Object.keys(stats)
  if (keys.length === 0) return 'No runs yet'

  if ('inserted' in stats || 'updated' in stats || 'skipped' in stats) {
    const parts: string[] = []
    if (typeof stats.inserted === 'number') parts.push(`${stats.inserted} inserted`)
    if (typeof stats.updated === 'number') parts.push(`${stats.updated} updated`)
    if (typeof stats.skipped === 'number') parts.push(`${stats.skipped} skipped`)
    return parts.join(' · ')
  }
  if (typeof stats.extracted === 'number') {
    return `${stats.extracted} extracted`
  }
  if (typeof stats.enriched === 'number') {
    return `${stats.enriched} enriched`
  }
  return keys.map((k) => `${stats[k]} ${k}`).join(' · ')
}

export function formatClockTimestamp(timestampMs?: number | null): string {
  if (!timestampMs) return '—'
  const date = new Date(timestampMs)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
