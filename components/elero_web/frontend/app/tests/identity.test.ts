import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addRfPacket, onStateChanged, devices, onDeviceUpserted, updateDevice, cancelDeviceDraft, rfPackets, clearRfPackets, type RfPacketWithTimestamp } from '../src/store'

test('saved alias suppresses repeated provisional discovery and preserves control channel', () => {
  devices.value = new Map()
  const command = { t: 100, src: '0x100001', dst: '0x200001', channel: 17, type: '0x69', command: '0x21' } as RfPacketWithTimestamp
  addRfPacket(command)
  assert.ok(devices.value.has('0x200001'))
  onDeviceUpserted({ address: '0x300001', device_type: 'cover', command_address: '0x200001', remote: '0x100001', channel: 17, updated_at: 1 })
  for (let i = 0; i < 10; i++) addRfPacket(command)
  assert.equal(devices.value.has('0x200001'), false)
  addRfPacket({ ...command, src: '0x300001', dst: '0x100001', channel: 91, type: '0xca', state: '0x0d' })
  assert.equal(devices.value.get('0x300001')?.channel, 17)
  assert.equal(devices.value.get('0x300001')?.lastStatus?.state, '0x0d')
  clearRfPackets()
  assert.equal(rfPackets.value.length, 0)
  assert.equal(devices.value.get('0x300001')?.lastStatus?.state, '0x0d')
})

test('draft edits retain persisted identity and cancel restores server-confirmed fields', () => {
  devices.value = new Map()
  onDeviceUpserted({ address: '0x300001', device_type: 'cover', name: 'Saved', updated_at: 123 })
  updateDevice('0x300001', { name: 'Draft' })
  assert.equal(devices.value.get('0x300001')?.updated_at, 123)
  assert.equal(devices.value.get('0x300001')?.save_state, 'dirty')
  cancelDeviceDraft('0x300001')
  assert.equal(devices.value.get('0x300001')?.name, 'Saved')
  assert.equal(devices.value.get('0x300001')?.save_state, undefined)
})

test('BOTTOM_TILT preserves saved cover type and RF updates preserve projected state', () => {
  devices.value = new Map()
  onDeviceUpserted({ address: '0x300001', device_type: 'cover', updated_at: 1 })
  onStateChanged({ address: '0x300001', device_type: 'cover', position: 0, position_source: 'time_estimated', ha_state: 'closed' })
  addRfPacket({ src: '0x300001', dst: '0x100001', channel: 91, type: '0xca', state: '0x0f' } as RfPacketWithTimestamp)
  const dev = devices.value.get('0x300001')!
  assert.equal(dev.type, 'cover')
  assert.equal((dev.lastStatus as unknown as { ha_state: string }).ha_state, 'closed')
})
