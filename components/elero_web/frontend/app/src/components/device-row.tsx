import { useSignal } from '@preact/signals'
import { Button } from './ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { InlineEdit } from './ui/inline-edit'
import { SignalIndicator } from './signal-indicator'
import { formatTime } from './packet-table'
import { ChevronUp, Square, ChevronDown, Shrink, Lightbulb, LightbulbOff, Settings, RotateCcw, Save, Info, Trash2 } from './icons'
import { cn } from '@/lib/utils'
import {
  updateDevice, cancelDeviceDraft, dismissDiscovery, getStateLabel, getCommandLabel, isCommandPacket, isButtonPacket,
  rfPackets, hub, displayNames, devices,
  type Device, type RfPacketWithTimestamp,
} from '@/store'
import { sendDeviceCommand, sendMergeAlias, sendRawCommand, sendUpsertDevice, sendRemoveDevice } from '@/ws'

// ─── Shared cell renderers (used by DataTable column definitions) ───────────

export function StatusDot({ device }: { device: Device }) {
  const unsaved = device.updated_at === null || !!device.save_state
  const label = device.save_state ?? (device.updated_at === null ? 'Discovered (not saved)' : hub.value.mode === 'native' ? 'Saved; HA changes require reboot' : 'Saved')
  const dot = unsaved ? (
    <span className="relative flex size-2 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-orange-400" />
    </span>
  ) : (
    <span className={cn('inline-flex size-2 shrink-0 rounded-full', device.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
  )
  return (
    <Tooltip>
      <TooltipTrigger>{dot}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function DeviceCell({ device }: { device: Device }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <StatusDot device={device} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          <InlineEdit
            value={device.name || `Unnamed cover (${device.address})`}
            onSave={(name) => updateDevice(device.address, { name })}
          />
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-mono">{device.address}</span>
          <span>CH {device.channel}</span>
        </div>
      </div>
    </div>
  )
}

export function LightDeviceCell({ device }: { device: Device }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <StatusDot device={device} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          <InlineEdit
            value={device.name || `Unnamed light (${device.address})`}
            onSave={(name) => updateDevice(device.address, { name })}
          />
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-mono">{device.address}</span>
          <span>CH {device.channel}</span>
        </div>
      </div>
    </div>
  )
}

export function HaStateCell({ device }: { device: Device }) {
  const status = device.lastStatus as Record<string, unknown> | null
  const haState = (status?.ha_state as string | undefined)?.toUpperCase() ?? '—'
  return (
    <span className="text-[10px] text-muted-foreground" title={`${typeof status?.transition_reason === 'string' ? status.transition_reason : ''}; response age at snapshot: ${typeof status?.response_age_ms === 'number' ? status.response_age_ms + ' ms' : 'unknown'}`}>
        {haState}<br />{status?.position_source === 'time_estimated' ? 'Estimated' : status?.position_source === 'motor_confirmed' ? 'Motor confirmed' : 'Position unknown'}
      </span>
  )
}

export function RfStateCell({ device }: { device: Device }) {
  const status = device.lastStatus as Record<string, unknown> | null
  const rfState = getStateLabel(status?.state as string | undefined)
  return (
    <span className="text-[10px] text-muted-foreground">{rfState}</span>
  )
}

export function SignalCell({ device }: { device: Device }) {
  if (!device.lastStatus) return null
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <SignalIndicator rssi={device.lastStatus.rssi} />
      {device.lastStatus.rssi ? <span>{device.lastStatus.rssi.toFixed(0)} dBm</span> : null}
    </div>
  )
}


export function BlindControls({ device }: { device: Device }) {
  return (
    <div className="flex items-center gap-1 text-primary">
      {device.command_profile === 1 && <>
        <Button variant="ghost" size="sm" disabled={!device.supports_tilt} onClick={() => sendDeviceCommand(device, 'tilt_up')}>Tilt ↑</Button>
        <Button variant="ghost" size="sm" disabled={!device.supports_tilt} onClick={() => sendDeviceCommand(device, 'tilt_down')}>Tilt ↓</Button>
      </>}
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" className="size-7 text-primary hover:text-primary disabled:text-muted-foreground/40 disabled:pointer-events-none" disabled={!device.supports_tilt} onClick={() => sendDeviceCommand(device, 'tilt')}>
            <Shrink className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{device.supports_tilt ? 'Tilt' : 'Tilt (disabled)'}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" className="size-7 text-primary hover:text-primary" onClick={() => sendDeviceCommand(device, 'up')}>
            <ChevronUp className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" className="size-7 text-primary hover:text-primary" onClick={() => sendDeviceCommand(device, 'stop')}>
            <Square className="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Stop</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" className="size-7 text-primary hover:text-primary" onClick={() => sendDeviceCommand(device, 'down')}>
            <ChevronDown className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function LightControls({ device }: { device: Device }) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" className="size-7 text-primary hover:text-primary" onClick={() => sendDeviceCommand(device, 'up')}>
            <Lightbulb className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>On</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" className="size-7 text-primary hover:text-primary" onClick={() => sendDeviceCommand(device, 'down')}>
            <LightbulbOff className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Off</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function DeviceActions({ device, expanded, onToggleExpand }: {
  device: Device
  expanded?: boolean
  onToggleExpand?: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      {device.save_state && <span className="text-xs">{device.save_state}</span>}
      {device.save_state && <Button variant="ghost" disabled={device.save_state === 'saving'} onClick={() => cancelDeviceDraft(device.address)}>Cancel</Button>}
      {device.updated_at === null && <Button variant="ghost" onClick={() => dismissDiscovery(device.address)}>Dismiss</Button>}
      {hub.value.crud && (
        <Tooltip>
          <TooltipTrigger>
            <Button variant="ghost" size="icon" className="size-7 text-primary hover:text-primary"
              aria-label="Save device" disabled={device.save_state === 'saving'} onClick={() => sendUpsertDevice(device)}>
              <Save className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save to NVS</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-7 text-primary hover:text-primary', expanded && 'bg-muted')}
            aria-label="Device settings" onClick={onToggleExpand}
          >
            <Settings className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent align="end">Settings</TooltipContent>
      </Tooltip>
    </div>
  )
}

// ─── Expanded Settings Panel ────────────────────────────────────────────────

function replayPacket(pkt: RfPacketWithTimestamp, device: Device) {
  sendRawCommand({
    dst_address: pkt.dst || device.command_address || device.address,
    src_address: pkt.src || device.remote,
    channel: pkt.channel ?? device.channel,
    command: pkt.command ?? '0x00',
    msg_type: pkt.type,
    type2: pkt.type2,
    hop: pkt.hop,
  })
}

/** Deduplicate consecutive packets with the same command (Elero sends each command twice) */
function deduplicatePackets(pkts: RfPacketWithTimestamp[]): RfPacketWithTimestamp[] {
  const result: RfPacketWithTimestamp[] = []
  for (const pkt of pkts) {
    const prev = result[result.length - 1]
    if (prev && prev.command === pkt.command && prev.src === pkt.src && prev.type === pkt.type) continue
    result.push(pkt)
  }
  return result
}

const inputClass = 'h-7 w-20 rounded-md border border-input bg-background px-2 text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span className={cn(
          'pointer-events-none block size-3 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-3' : 'translate-x-0',
        )} />
      </button>
      <span className="text-muted-foreground">{label}</span>
    </label>
  )
}

export function DeviceExpandedPanel({ device }: { device: Device }) {
  const crudEnabled = hub.value.crud
  const actionError = useSignal('')
  const mergeAddress = useSignal('')
  const packets = rfPackets.value

  const commandPackets = deduplicatePackets(
    packets.filter((pkt) =>
      (isCommandPacket(pkt) || isButtonPacket(pkt)) &&
      pkt.src === device.remote &&
      (pkt.dst === device.address || pkt.channel === device.channel)
    )
  ).slice(-10).reverse()

  return (
    <div className="border-t border-border bg-muted/20">
      {device.type === 'cover' && <div className="grid gap-3 border-b p-5 text-xs sm:grid-cols-2">
        <label>Motor status source (canonical)
          <input className="block w-full rounded border p-2" aria-label="Motor status source" value={device.status_address || device.address}
            disabled={device.updated_at !== null}
            onInput={e => updateDevice(device.address, { status_address: e.currentTarget.value })} />
        </label>
        <label>Command destination alias
          <input className="block w-full rounded border p-2" aria-label="Command destination alias" value={device.command_address || device.address}
            onInput={e => updateDevice(device.address, { command_address: e.currentTarget.value })} />
        </label>
        <label>Command profile
          <select className="block rounded border p-2" value={device.command_profile} onChange={e => updateDevice(device.address, { command_profile: Number(e.currentTarget.value) })}>
            <option value={0}>Standard roller shutter</option><option value={1}>Raffstore (hardware validation required)</option>
          </select>
        </label>
        <label>Endpoint estimate margin (ms; 0 disables)
          <input className="block rounded border p-2" type="number" min={0} max={30000} value={device.endpoint_margin_ms} onInput={e => updateDevice(device.address, { endpoint_margin_ms: Number(e.currentTarget.value) })} />
        </label>
        <label>Paired remote source
          <input className="block rounded border p-2" value={device.remote} onInput={e => updateDevice(device.address, { remote: e.currentTarget.value })} />
        </label>
        <label>Control channel
          <input className="block rounded border p-2" type="number" min={0} max={255} value={device.channel} onInput={e => updateDevice(device.address, { channel: Number(e.currentTarget.value) })} />
        </label>
        <details className="sm:col-span-2"><summary>Advanced per-action encoding (UP, DOWN, STOP, tilt up, tilt down, preset, CHECK)</summary>
          <p>Numeric bytes. Enable only captured, validated overrides. Destination 0 selects command alias; 1 selects motor status source. 0x44 uses channel broadcasts without a motor destination or targeted payload prefix. 0x69 acceptance is unverified.</p>
          <textarea aria-label="Per-action encoding JSON" key={`${device.address}-${device.updated_at}-${device.save_state ? 'draft' : 'saved'}`} className="h-40 w-full rounded border p-2 font-mono" defaultValue={JSON.stringify(device.actions, null, 2)} onChange={e => {
            try {
              const value = JSON.parse(e.currentTarget.value)
              if (!Array.isArray(value) || value.length !== 7) throw new Error('Expected seven actions')
              updateDevice(device.address, { actions: value }); actionError.value = ''
            } catch (error) { actionError.value = String(error) }
          }} /><p role="alert">{actionError.value}</p>
        </details>
        {device.updated_at !== null && <div className="sm:col-span-2">
          <label>Saved duplicate to merge into this motor
            <select value={mergeAddress.value} onChange={e => { mergeAddress.value = e.currentTarget.value }}>
              <option value="">Select explicitly…</option>
              {[...devices.value.values()].filter(d => d.type === 'cover' && d.updated_at !== null && d.address !== device.address).map(d => <option key={d.address} value={d.address}>{d.name || d.address} ({d.address})</option>)}
            </select>
          </label>
          <Button variant="outline" size="sm" disabled={!mergeAddress.value || !!device.save_state} onClick={() => sendMergeAlias(device.address, mergeAddress.value)}>Merge saved alias</Button>
        </div>}
        <p className="sm:col-span-2">Save explicitly. A linked alias suppresses provisional duplicates. Native Home Assistant registration requires reboot after saving. Editing the canonical address is only available for provisional devices.</p>
      </div>}
      {/* Config row */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        {/* Left: config inputs */}
        <div className="flex items-center gap-4">
          {device.type === 'cover' && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>&#x25B3;</span>
                <input
                  type="number"
                  value={+(device.open_ms / 1000).toFixed(1)}
                  onInput={(e) => {
                    const raw = (e.target as HTMLInputElement).value
                    const v = raw === '' ? 0 : parseFloat(raw)
                    if (!isNaN(v)) updateDevice(device.address, { open_ms: Math.round(Math.max(0, v) * 1000) })
                  }}
                  min={0} max={300} step={0.1}
                  className={inputClass}
                />
                <span>s</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>&#x25BD;</span>
                <input
                  type="number"
                  value={+(device.close_ms / 1000).toFixed(1)}
                  onInput={(e) => {
                    const raw = (e.target as HTMLInputElement).value
                    const v = raw === '' ? 0 : parseFloat(raw)
                    if (!isNaN(v)) updateDevice(device.address, { close_ms: Math.round(Math.max(0, v) * 1000) })
                  }}
                  min={0} max={300} step={0.1}
                  className={inputClass}
                />
                <span>s</span>
              </label>
              <Toggle checked={device.supports_tilt} onChange={(v) => updateDevice(device.address, { supports_tilt: v })} label="Tilt" />
            </>
          )}
        </div>

        {/* Right: active toggle + delete (subtle) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Toggle checked={device.enabled} onChange={(v) => updateDevice(device.address, { enabled: v })} label="Active" />
            <Tooltip>
              <TooltipTrigger>
                <Info className="size-3 text-muted-foreground/60" />
              </TooltipTrigger>
              <TooltipContent>Inactive devices are hidden from the default view and unpublished from Home Assistant</TooltipContent>
            </Tooltip>
          </div>
          {crudEnabled && device.updated_at !== null && (
            <>
              <div className="mx-0.5 h-4 w-px bg-border" />
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground/50 hover:text-destructive"
                    aria-label="Delete saved device" onClick={() => sendRemoveDevice(device.address, device.type === 'light' ? 'light' : 'cover')}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="end">Permanently delete from NVS (device will be re-discovered if still active on RF)</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Sniffed commands */}
      <div className="px-5 py-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Sniffed commands from {displayNames.value[device.remote] ?? device.remote}
        </span>
        {commandPackets.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No command packets captured yet — press buttons on the physical remote.
          </p>
        ) : (
          <div className="mt-2 max-h-[180px] overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-muted/20">
                <tr className="text-left text-[10px] text-muted-foreground">
                  <th className="pb-1 pr-3 font-medium">Time</th>
                  <th className="pb-1 pr-3 font-medium">Command</th>
                  <th className="pb-1 pr-3 font-medium">Type</th>
                  <th className="pb-1 pr-3 font-medium">RSSI</th>
                  <th className="pb-1 font-medium text-right">Re-send</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {commandPackets.map((pkt, i) => (
                  <tr key={`${pkt.t}-${i}`} className="group">
                    <td className="py-1.5 pr-3 text-muted-foreground">{formatTime(pkt.received_at)}</td>
                    <td className="py-1.5 pr-3">{getCommandLabel(pkt.command)}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{pkt.type}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{pkt.rssi?.toFixed(0) ?? '-'}</td>
                    <td className="py-1.5 text-right">
                      <Tooltip>
                        <TooltipTrigger>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-primary"
                            onClick={() => replayPacket(pkt, device)}
                          >
                            <RotateCcw className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Re-send decoded command (new counter; default payload bytes)</TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
