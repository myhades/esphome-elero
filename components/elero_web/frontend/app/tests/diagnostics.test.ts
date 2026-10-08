import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendBounded, CAPTURE_LIMIT, copyText, serializeCapture } from '../src/lib/diagnostics'

// Synthetic decoded observations, deliberately not encrypted frame fixtures.
const packets = [
  { t: 1000, received_at: 1700000000000, src: '0x100001', dst: '0x200001', channel: 17, type: '0x69', command: '0x21' },
  { t: 3000, received_at: 1700000002000, src: '0x300001', dst: '0x100001', channel: 60, type: '0xca', state: '0x0a' },
]

test('capture is bounded and retains newest packets in order', () => {
  let rows: number[] = []
  for (let n = 0; n < 2500; n++) rows = appendBounded(rows, n)
  assert.equal(rows.length, CAPTURE_LIMIT)
  assert.equal(rows[0], 1500)
  assert.equal(rows.at(-1), 2499)
})
test('JSON and JSONL preserve timestamps and distinct command/status identities', () => {
  const json = JSON.parse(serializeCapture(packets, 'json'))
  const jsonl = serializeCapture(packets, 'jsonl').trim().split('\n').map(line => JSON.parse(line))
  assert.deepEqual(json.packets, jsonl)
  assert.equal(json.packets[1].channel, 60)
  assert.equal(json.packets[0].received_at, packets[0].received_at)
  assert.equal(json.packets[1].raw, null)
})
test('empty exports valid; arbitrary fields and secrets excluded', () => {
  assert.deepEqual(JSON.parse(serializeCapture([], 'json')).packets, [])
  assert.equal(serializeCapture([], 'jsonl'), '')
  assert.ok(!serializeCapture([{ ...packets[0], password: 'SECRET' }], 'json').includes('SECRET'))
  assert.ok(serializeCapture([{ src: '=formula,"quoted"' }], 'csv').includes('"\'=formula,""quoted"""'))
})
test('HTTP clipboard fails explicitly rather than reporting success', async () => {
  Object.defineProperty(globalThis, 'isSecureContext', { value: false, configurable: true })
  await assert.rejects(copyText('packet'), /HTTP/)
})
test('clipboard rejection propagates for manual fallback', async () => {
  Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => { throw new Error('denied') } } }, configurable: true })
  await assert.rejects(copyText('packet'), /denied/)
})
