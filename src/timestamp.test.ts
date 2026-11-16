import { expect, it } from 'vitest'
import { Timestamp } from './timestamp'

it('round-trips dates with millisecond precision', () => {
  const date = new Date('2026-11-16T13:27:46.123Z')
  const value = Timestamp.fromDate(date)
  expect(value.toDate().toISOString()).toBe(date.toISOString())
  expect(value.toMillis()).toBe(date.getTime())
  expect(value.seconds).toBe(Math.floor(date.getTime() / 1000))
})

it('compares and sorts like the Firestore Timestamp', () => {
  const earlier = Timestamp.fromDate(new Date('2026-01-01T00:00:00.500Z'))
  const later = Timestamp.fromDate(new Date('2026-01-01T00:00:01Z'))
  expect(earlier < later).toBe(true)
  expect(earlier.isEqual(Timestamp.fromMillis(earlier.toMillis()))).toBe(true)
  expect([later, earlier].sort((a, b) => (a < b ? -1 : 1))).toEqual([earlier, later])
})
