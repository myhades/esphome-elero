// Export only RF fields, never arbitrary config or credential-bearing messages.
export const RF_FIELDS = ['received_at', 't', 'dir', 'src', 'dst', 'channel', 'type', 'type2', 'hop', 'command', 'state', 'cnt', 'rssi', 'lqi', 'crc', 'tx_success', 'raw'] as const
export const CAPTURE_LIMIT = 1000
export function appendBounded<T>(rows: T[], row: T, limit = CAPTURE_LIMIT): T[] {
  return [...rows.slice(-(limit - 1)), row]
}

export function serializeCapture(rows: object[], format: 'json' | 'jsonl' | 'csv'): string {
  const records = rows.map(row => Object.fromEntries(RF_FIELDS.map(key => [key, (row as Record<string, unknown>)[key] ?? null])))
  if (format === 'json') return JSON.stringify({ schema_version: 1, kind: 'elero-decoded-rf', packets: records }, null, 2)
  if (format === 'jsonl') return records.map(row => JSON.stringify(row)).join('\n') + (records.length ? '\n' : '')
  const cell = (value: unknown) => {
    let text = value == null ? '' : (typeof value === 'string' ? value : JSON.stringify(value) ?? '')
    if (/^[=+@\t\r]/.test(text) || /^-[^\d]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return [RF_FIELDS.join(','), ...records.map(row => RF_FIELDS.map(key => cell(row[key])).join(','))].join('\r\n') + '\r\n'
}

export async function copyText(text: string): Promise<void> {
  if (!globalThis.isSecureContext || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard unavailable on this HTTP connection. Select the text below and copy it manually.')
  }
  await navigator.clipboard.writeText(text)
}

export function downloadText(text: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  try { anchor.click() } finally {
    anchor.remove()
    // Immediate revocation can race the browser download, especially on mobile.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

// Deliberately omit arbitrary text (logs/names), raw ciphertext and original addresses.
// Stable aliases within one bundle still let us correlate command/status identities.
export function sanitizedBundle(rows: object[], devices: object[], version: string, health: Record<string, number>): string {
  const addresses = new Map<string, string>()
  const address = (value: unknown) => {
    if (typeof value !== 'string' || !/^0x[0-9a-f]{6}$/i.test(value)) return null
    const key = value.toLowerCase()
    if (!addresses.has(key)) addresses.set(key, `address_${addresses.size + 1}`)
    return addresses.get(key)
  }
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
  const byte = (value: unknown) => typeof value === 'string' && /^0x[0-9a-f]{2}$/i.test(value) ? value : null
  const packets = rows.map(row => {
    const r = row as Record<string, unknown>
    return {
      src: address(r.src), dst: address(r.dst), dir: r.dir === 'tx' ? 'tx' : r.dir === 'rx' ? 'rx' : null,
      ...Object.fromEntries(['received_at', 't', 'channel', 'cnt', 'rssi', 'lqi'].map(key => [key, number(r[key])])),
      ...Object.fromEntries(['type', 'type2', 'hop', 'command', 'state'].map(key => [key, byte(r[key])])),
      crc: typeof r.crc === 'boolean' ? r.crc : null,
      tx_success: typeof r.tx_success === 'boolean' ? r.tx_success : null,
    }
  })
  const configuration = devices.map(device => {
    const d = device as Record<string, unknown>
    return {
      status_address: address(d.address), command_address: address(d.command_address), remote: address(d.remote),
      ...Object.fromEntries(['channel', 'command_profile', 'open_ms', 'close_ms', 'endpoint_margin_ms', 'queued', 'current_tx_retries', 'last_tx_ms', 'last_check_queued_ms', 'response_age_ms'].map(key => [key, number(d[key])])),
      actions: Array.isArray(d.actions) ? d.actions.slice(0, 7).map((action: Record<string, unknown>) => ({
        enabled: action.enabled === true,
        ...Object.fromEntries(['command', 'type', 'type2', 'hop', 'payload_1', 'payload_2', 'destination'].map(key => [key, number(action[key])])),
      })) : [],
    }
  })
  const counters = Object.fromEntries(['uptime_ms', 'tx_success', 'tx_fail', 'rx_packets', 'rx_drops', 'fifo_overflows', 'watchdog_recoveries', 'device_commands_queued'].map(key => [key, number(health[key])]))
  return JSON.stringify({ schema_version: 1, kind: 'elero-sanitized-diagnostic-bundle',
    firmware: /^[0-9]+\.[0-9]+\.[0-9]+(?:\+[a-f0-9]{12})?$/.test(version) ? version : 'unknown',
    omitted: ['raw_frames', 'logs', 'names', 'network_configuration', 'original_addresses'],
    counters, devices: configuration, packets,
  }, null, 2)
}
