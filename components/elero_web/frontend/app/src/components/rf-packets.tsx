import { useSignal } from '@preact/signals'
import { Card } from './ui/card'
import { buildFullColumns } from './packet-table'
import { rfPackets, displayNames, deviceTypeMap, clearRfPackets, capturePaused, captureDropped, diagnosticLogs, websocketErrors, resetDismissedDiscoveries } from '@/store'
import { CAPTURE_LIMIT, copyText, downloadText, serializeCapture } from '@/lib/diagnostics'
import { DataTable } from './ui/data-table'

export function RfPackets() {
  const query = useSignal('')
  const feedback = useSignal('')
  const fallback = useSignal('')
  const selected = useSignal<Set<object>>(new Set())
  const data = rfPackets.value.filter(pkt => JSON.stringify(pkt).toLowerCase().includes(query.value.toLowerCase())).slice().reverse()
  const columns = buildFullColumns(displayNames.value, deviceTypeMap.value)
  columns.unshift({ key: 'selected', label: 'Select', render: pkt => <input type="checkbox" aria-label={`Select packet ${pkt.t}`} checked={selected.value.has(pkt)} onChange={e => {
    const next = new Set([...selected.value].filter(row => rfPackets.value.includes(row as typeof pkt)))
    if (e.currentTarget.checked) next.add(pkt); else next.delete(pkt)
    selected.value = next
  }} /> })
  const selectedRows = data.filter(pkt => selected.value.has(pkt))
  const copy = async (rows: object[]) => {
    const text = serializeCapture(rows, 'json')
    try { await copyText(text); feedback.value = 'Copied'; fallback.value = '' }
    catch (error) { feedback.value = String(error); fallback.value = text }
  }
  const download = (format: 'json' | 'jsonl' | 'csv') => {
    const text = serializeCapture(data, format)
    try {
      downloadText(text, `elero-rf-${Date.now()}.${format}`, format === 'csv' ? 'text/csv' : format === 'jsonl' ? 'application/x-ndjson' : 'application/json')
      feedback.value = 'Download requested. Check your browser downloads.'
    } catch (error) { feedback.value = String(error); fallback.value = text }
  }
  return <Card className="gap-0 overflow-hidden p-0">
    <div className="space-y-2 border-b border-border px-5 py-4">
      <h2 className="text-sm font-semibold">RF Diagnostics</h2>
      <p className="text-xs">{rfPackets.value.length}/{CAPTURE_LIMIT} retained; {captureDropped.value} overwritten. Capture {capturePaused.value ? 'paused' : 'running'}.</p>
      <p className="text-xs">Header CH in STATUS is not the configured control channel. Missing fields mean unavailable. Decoded captures are not proof of motor acknowledgement.</p>
      <div className="flex flex-wrap items-center gap-2 text-xs [&_button]:rounded-md [&_button]:border [&_button]:px-3 [&_button]:py-2 [&_button]:hover:bg-accent [&_button]:disabled:opacity-40">
        <input className="h-8 rounded-md border bg-background px-2" aria-label="Filter capture" placeholder="Address, type, state or timestamp" value={query.value} onInput={e => { query.value = e.currentTarget.value }} />
        <button onClick={() => { capturePaused.value = !capturePaused.value }}>{capturePaused.value ? 'Resume capture' : 'Pause capture'}</button>
        <button onClick={resetDismissedDiscoveries}>Reset dismissed discoveries</button>
        <button onClick={() => { clearRfPackets(); selected.value = new Set() }}>Clear capture</button>
        <button disabled={!data.length} onClick={() => copy(data)}>Copy filtered</button>
        <button disabled={!selectedRows.length} onClick={() => copy(selectedRows)}>Copy selected ({selectedRows.length})</button>
        {(['json', 'jsonl', 'csv'] as const).map(format => <button key={format} onClick={() => download(format)}>Download {format.toUpperCase()}</button>)}
      </div>
      <p role="status">{feedback.value}</p>
      {fallback.value && <textarea aria-label="Capture manual copy" className="w-full h-40 rounded-md border p-2 font-mono text-xs" readOnly value={fallback.value} onFocus={e => e.currentTarget.select()} />}
    </div>
    <p className="px-5">WebSocket parse errors: {websocketErrors.value}</p>
    <DataTable columns={columns} data={data} rowKey={(pkt, i) => `${pkt.t}-${i}`}
      defaultSort={{ key: 'time', direction: 'desc' }} maxHeight="500px" tableClass="font-mono" filterable={false}
      emptyMessage="No packets in this capture. Reception requires a connected gateway; pause and export before clearing." />
    <details className="p-5"><summary>Gateway logs (latest 300)</summary>
      <button onClick={() => { diagnosticLogs.value = [] }}>Clear logs</button>
      <button onClick={() => {
        try { downloadText(JSON.stringify(diagnosticLogs.value, null, 2), 'elero-logs.json', 'application/json'); feedback.value = 'Log download requested' }
        catch (error) { feedback.value = String(error); fallback.value = JSON.stringify(diagnosticLogs.value, null, 2) }
      }}>Download logs</button>
      <pre className="max-h-64 overflow-auto">{diagnosticLogs.value.map(log => `${log.t} [${log.level}] ${log.tag}: ${log.msg}`).join('\n')}</pre>
    </details>
  </Card>
}
