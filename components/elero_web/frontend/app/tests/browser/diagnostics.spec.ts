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
