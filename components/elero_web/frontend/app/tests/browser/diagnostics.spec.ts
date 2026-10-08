import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('HTTP clipboard fallback, filtered downloads, pause and empty capture', async ({ page }) => {
  // A local mock WebSocket: never connect to a physical gateway.
  await page.routeWebSocket('**/elero/ws', socket => {
    socket.send(JSON.stringify({ event: 'config', data: {
      hub: { device: 'mock', version: 'test', mode: 'native', crud: true, name: 'Mock', default_src_address: '0x000001' },
      radio: { chipset: 'cc1101', freq: {} }, blinds: [], lights: [], remotes: [], groups: [],
    } }))
    for (const pkt of [
      { src: '0x100001', dst: '0x200001', channel: 17, type: '0x69', command: '0x21' },
      { src: '0x300001', dst: '0x100001', channel: 60, type: '0xca', state: '0x0a' },
    ]) socket.send(JSON.stringify({ event: 'rf', data: { t: 1234, dir: 'rx', rssi: -60, cnt: 1, ...pkt } }))
  })
  await page.addInitScript(() => Object.defineProperty(window, 'isSecureContext', { value: false }))
  await page.goto('/')
  await page.getByRole('tab', { name: 'Diagnostics' }).click()
  await expect(page.getByText('2/1000 retained', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Copy packet JSON' }).first().click()
  await expect(page.getByLabel('Packet JSON manual copy')).toHaveValue(/received_at/)
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await page.getByLabel('Filter capture').fill('0x300001')
  for (const format of ['JSON', 'JSONL', 'CSV']) {
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: `Download ${format}`, exact: true }).click()
    const download = await downloaded
    const text = await readFile((await download.path())!, 'utf8')
    expect(text).toContain('0x300001')
    expect(text).not.toContain('0x200001')
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`))
    if (format === 'JSON') expect(JSON.parse(text).packets).toHaveLength(1)
    if (format === 'JSONL') expect(JSON.parse(text.trim()).channel).toBe(60)
  }
  await page.getByRole('button', { name: 'Copy filtered' }).click()
  await expect(page.getByLabel('Capture manual copy')).toHaveValue(/0x300001/)
  await page.getByRole('button', { name: 'Pause capture' }).click()
  await expect(page.getByRole('button', { name: 'Resume capture' })).toBeVisible()
  await page.screenshot({ path: 'test-results/diagnostics.png', fullPage: true })
  await page.getByRole('button', { name: 'Clear capture' }).click()
  await expect(page.getByRole('button', { name: 'Copy filtered' })).toBeDisabled()
  await expect(page.getByText('No packets in this capture.', { exact: false })).toBeVisible()
})

test('clipboard rejection does not show copied success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Permission denied')) } })
  })
  await page.routeWebSocket('**/elero/ws', socket => {
    socket.send(JSON.stringify({ event: 'rf', data: { t: 10, src: '0x100001', dst: '0x200001', channel: 17, type: '0x69', command: '0x10' } }))
  })
  await page.goto('/')
  await page.getByRole('tab', { name: 'Diagnostics' }).click()
  await page.getByRole('button', { name: 'Copy filtered' }).click()
  await expect(page.getByRole('status')).toContainText('Permission denied')
  await expect(page.getByLabel('Capture manual copy')).toBeVisible()
})

test('sanitized bundle downloads bytes and log copy has HTTP fallback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'isSecureContext', { value: false }))
  await page.routeWebSocket('**/elero/ws', socket => {
    socket.send(JSON.stringify({ event: 'rf', data: { t: 42, src: '0x100001', dst: '0x200001', type: '0x69', command: '0x21', raw: 'sensitive frame', dir: 'tx', tx_success: true } }))
    socket.send(JSON.stringify({ event: 'log', data: { t: 42, tag: 'elero', level: 3, msg: 'mock diagnostic log' } }))
    socket.onMessage(message => {
      if (JSON.parse(String(message)).type === 'diagnostics') socket.send(JSON.stringify({ event: 'diagnostics', data: { tx_success: 1, tx_fail: 0 } }))
    })
  })
  await page.goto('/')
  await page.getByRole('tab', { name: 'Diagnostics' }).click()
  await page.getByRole('button', { name: 'Refresh gateway diagnostics' }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download sanitized bundle' }).click()
  const text = await readFile((await (await downloaded).path())!, 'utf8')
  const bundle = JSON.parse(text)
  expect(bundle.packets[0].tx_success).toBe(true)
  expect(text).not.toContain('0x100001')
  expect(text).not.toContain('sensitive frame')
  expect(text).not.toContain('mock diagnostic log')
  await page.getByText('Gateway logs (latest 300)', { exact: true }).click()
  await page.getByRole('button', { name: 'Copy logs', exact: true }).click()
  await expect(page.getByLabel('Capture manual copy')).toHaveValue(/mock diagnostic log/)
})

test('device save failure, cancel, acknowledged save, delete and reconnect use mock persistence', async ({ page }) => {
  let saved: Record<string, unknown> | null = { address: '0x300001', name: 'Mock blind', remote: '0x100001', channel: 17, command_address: '0x200001', command_profile: 1, open_ms: 10000, close_ms: 10000, poll_ms: 30000, supports_tilt: true, enabled: true, updated_at: 123 }
  let failSave = true
  const commands: string[] = []
  await page.routeWebSocket('**/elero/ws', socket => {
    socket.send(JSON.stringify({ event: 'config', data: {
      hub: { device: 'mock', version: '0.9.0', mode: 'native', crud: true, name: 'Mock', default_src_address: '0x100001' },
      radio: { chipset: 'cc1101', freq: {} }, blinds: saved ? [saved] : [], lights: [], remotes: [], groups: [],
    } }))
    socket.onMessage(message => {
      const data = JSON.parse(String(message))
      if (data.type === 'cmd') commands.push(data.action)
      if (data.type === 'upsert_device') {
        if (failSave) { socket.send(JSON.stringify({ event: 'error', data: { msg: 'Simulated NVS failure' } })); failSave = false; return }
        saved = { ...saved, channel: data.channel, updated_at: 124 }
        socket.send(JSON.stringify({ event: 'device_upserted', data: { ...saved, device_type: 'cover' } }))
      }
      if (data.type === 'remove_device') {
        saved = null
        socket.send(JSON.stringify({ event: 'device_removed', data: { address: data.address, device_type: 'cover' } }))
      }
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Tilt ↑', exact: true }).click()
  await page.getByRole('button', { name: 'Tilt ↓', exact: true }).click()
  await expect.poll(() => commands).toEqual(['tilt_up', 'tilt_down'])
  await page.getByRole('button', { name: 'Expand', exact: true }).first().click()
  await page.getByLabel('Control channel', { exact: true }).fill('18')
  await page.getByRole('button', { name: 'Save device' }).first().click()
  await expect(page.getByLabel('Device save state')).toHaveText('failed')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Control channel', { exact: true })).toHaveValue('17')
  await page.getByLabel('Control channel', { exact: true }).fill('19')
  await page.getByRole('button', { name: 'Save device' }).first().click()
  await expect.poll(() => saved?.channel).toBe(19)
  await page.reload()
  await page.getByRole('button', { name: 'Expand', exact: true }).first().click()
  await expect(page.getByLabel('Control channel', { exact: true })).toHaveValue('19')
  await page.getByRole('button', { name: 'Delete saved device' }).click()
  await expect.poll(() => saved).toBeNull()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Tilt ↑', exact: true })).toHaveCount(0)
})

test('configuration backup download and restore preserve the versioned snapshot', async ({ page }) => {
  const snapshot = { snapshot_version: 3, exported_at: 42, exporter: { version: '0.9.0', device: 'mock' }, hub: {}, devices: [{ device_type: 'cover', dst_address: '0x300001', command_address: '0x200001', src_address: '0x100001', channel: 17, command_profile: 1, endpoint_margin_ms: 2000, name: 'Mock' }], groups: [] }
  let imported: unknown
  await page.routeWebSocket('**/elero/ws', socket => {
    socket.send(JSON.stringify({ event: 'config', data: { hub: { device: 'mock', version: '0.9.0', mode: 'native', crud: true, name: 'Mock', default_src_address: '0x100001' }, radio: { chipset: 'cc1101', freq: {} }, blinds: [], lights: [], remotes: [], groups: [] } }))
    socket.onMessage(message => {
      const data = JSON.parse(String(message))
      if (data.type === 'export_config') socket.send(JSON.stringify({ event: 'config_snapshot', data: snapshot }))
      if (data.type === 'import_config') imported = data.snapshot
    })
  })
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/')
  await page.getByRole('tab', { name: 'Hub', exact: true }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup', exact: true }).click()
  const download = await downloaded
  const text = await readFile((await download.path())!, 'utf8')
  expect(JSON.parse(text)).toEqual(snapshot)
  await page.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) })
  await expect.poll(() => imported).toEqual(snapshot)
})
