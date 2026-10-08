// Export only RF fields, never arbitrary config or credential-bearing messages.
export const RF_FIELDS = ['received_at', 't', 'dir', 'src', 'dst', 'channel', 'type', 'type2', 'hop', 'command', 'state', 'cnt', 'rssi', 'lqi', 'crc', 'raw'] as const
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
