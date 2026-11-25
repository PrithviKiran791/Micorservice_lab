import { describe, expect, it } from 'vitest'
import { formatDateTime, formatRemaining, timeAgo } from './format'

describe('timeAgo', () => {
  const now = new Date('2026-11-25T12:00:00Z').getTime()
  it.each([
    ['2026-11-25T11:59:50Z', 'just now'],
    ['2026-11-25T11:55:00Z', '5 min ago'],
    ['2026-11-25T09:00:00Z', '3 h ago'],
    ['2026-11-23T12:00:00Z', '2 d ago'],
  ])('%s -> %s', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected)
  })
  it('never shows a negative time for a timestamp slightly in the future', () => {
    expect(timeAgo('2026-11-25T12:00:30Z', now)).toBe('just now')
  })
  it('shows a dash for missing or invalid input', () => {
    expect(timeAgo(null)).toBe('-')
    expect(timeAgo('garbage')).toBe('-')
  })
})

describe('formatDateTime', () => {
  it('shows a dash for missing or invalid input and text for a real date', () => {
    expect(formatDateTime(undefined)).toBe('-')
    expect(formatDateTime('nope')).toBe('-')
    expect(formatDateTime('2026-11-25T14:30:00Z')).toMatch(/2026/)
  })
})

describe('formatRemaining', () => {
  const now = 1_000_000
  it('formats minutes and hours and never goes negative', () => {
    expect(formatRemaining(now + 90 * 60_000, now)).toBe('1 h 30 min')
    expect(formatRemaining(now + 125_000, now)).toBe('2 min 5 s')
    expect(formatRemaining(now - 5_000, now)).toBe('0 min 0 s')
  })
})
