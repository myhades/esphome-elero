import { createPortal } from 'preact/compat'
import { copyText } from '@/lib/diagnostics'
import { useSignal } from '@preact/signals'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { type Column } from './ui/data-table'
import { Blinds, Lightbulb, Copy, CheckCircle2, RemoteControl } from './icons'
import {
  isStatusPacket, isCommandPacket, isButtonPacket,
  getMsgTypeLabel, getCommandLabel, getStateLabel, devices,
  type RfPacketWithTimestamp, type AppDeviceType,
} from '@/store'
import { cn } from '@/lib/utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

export function formatTime(epochMs: number | undefined): string {
  if (!epochMs) return ''
  const d = new Date(epochMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

const deviceTypeIcons: Record<AppDeviceType, typeof Blinds | null> = {
  cover: Blinds,
  light: Lightbulb,
  remote: RemoteControl,
  unknown: null,
}

// ─── Copy Button ────────────────────────────────────────────────────────────

export function CopyPacketBtn({ pkt }: { pkt: RfPacketWithTimestamp }) {
  const copied = useSignal(false)

  const fallback = useSignal('')
  const onClick = async () => {
    copied.value = false
    try {
      await copyText(JSON.stringify(pkt, null, 2))
      copied.value = true
      fallback.value = ''
      setTimeout(() => { copied.value = false }, 1500)
    } catch (error) { fallback.value = String(error) }
  }

  return (
    <><Tooltip>
      <TooltipTrigger>
        <button
          className={cn(
            'flex size-6 items-center justify-center rounded transition-colors',
            copied.value ? 'text-success' : 'text-primary/60 hover:text-primary hover:bg-muted'
          )}
          aria-label="Copy packet JSON"
          onClick={onClick}
        >
          {copied.value ? <CheckCircle2 className="size-3" /> : <Copy className="size-3" />}
        </button>
      </TooltipTrigger>
      <TooltipContent className="right-0 left-auto translate-x-0">Copy packet JSON</TooltipContent>
    </Tooltip>
    {fallback.value && createPortal(<div role="dialog" aria-label="Copy packet manually" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-lg rounded-xl bg-background p-5 shadow-lg">
      <p>{fallback.value}</p>
      <textarea className="my-3 h-56 w-full rounded border p-2 font-mono text-xs" aria-label="Packet JSON manual copy" readOnly value={JSON.stringify(pkt, null, 2)} onFocus={e => e.currentTarget.select()} />
      <button onClick={() => { fallback.value = '' }}>Close</button>
    </div></div>, document.body)}</>
  )
}

// ─── Address Rendering ──────────────────────────────────────────────────────

export function AddressCell({ addr, name, deviceType }: { addr: string; name?: string; deviceType: AppDeviceType }) {
  const Icon = deviceTypeIcons[deviceType]
  return (
    <span className="flex items-center gap-2">
      <span className="flex flex-col">
        {name ? (
          <>
            <span className="text-foreground">{name}</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {Icon && <Icon className="size-2.5" />}
              {addr}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1">
            {Icon && <Icon className="size-3" />}
            {addr}
          </span>
        )}
      </span>
    </span>
  )
}

// ─── Full column set (used by Debug tab) ────────────────────────────────────

export function buildFullColumns(
  configNames: Record<string, string>,
  addressTypes: Record<string, AppDeviceType>,
): Column<RfPacketWithTimestamp>[] {
  return [
    {
      key: 'time', label: 'Time', sortable: true,
      value: (pkt) => pkt.received_at ?? pkt.t,
      render: (pkt) => <span className="text-muted-foreground">{formatTime(pkt.received_at)}</span>,
    },
    { key: 'dir', label: 'Direction', value: pkt => pkt.dir ?? 'unknown', render: pkt => <span>{pkt.dir ?? 'unknown'}</span> },
    { key: 'tx_success', label: 'Radio TX', render: pkt => <span>{pkt.dir !== 'tx' ? '—' : pkt.tx_success ? 'Completed (unacknowledged)' : 'Failed'}</span> },
    { key: 'quality', label: 'LQI / CRC', render: pkt => <span>{pkt.lqi ?? '-'} / {pkt.crc == null ? 'unknown' : pkt.crc ? 'valid' : 'invalid'}</span> },
    { key: 'control_channel', label: 'Control CH', render: pkt => {
      const linked = [...devices.value.values()].find(d => d.type === 'cover' && (d.address === pkt.src ||
        (d.remote === pkt.src && (d.command_address === pkt.dst || pkt.type === '0x44') && d.channel === pkt.channel)))
      return <span>{linked?.channel ?? '—'}</span>
    } },
    { key: 'cnt', label: 'Counter', render: pkt => <span>{pkt.cnt}</span> },
    {
      key: 'source', label: 'Source', sortable: true, filter: 'select',
      value: (pkt) => configNames[pkt.src] || pkt.src,
      render: (pkt) => <AddressCell addr={pkt.src} name={configNames[pkt.src]} deviceType={addressTypes[pkt.src] ?? 'unknown'} />,
    },
    {
      key: 'destination', label: 'Destination', sortable: true, filter: 'select',
      value: (pkt) => configNames[pkt.dst] || pkt.dst,
      render: (pkt) => <AddressCell addr={pkt.dst} name={configNames[pkt.dst]} deviceType={addressTypes[pkt.dst] ?? 'unknown'} />,
    },
    {
      key: 'channel', label: 'Header CH', sortable: true, filter: 'select',
      value: (pkt) => pkt.channel != null ? String(pkt.channel) : '',
      render: (pkt) => <span className="text-muted-foreground">{pkt.channel ?? '-'}</span>,
    },
    {
      key: 'type', label: 'Type', sortable: true, filter: 'select',
      value: (pkt) => getMsgTypeLabel(pkt.type),
      render: (pkt) => <span className="text-muted-foreground">{getMsgTypeLabel(pkt.type)} ({pkt.type})</span>,
    },
    {
      key: 'command', label: 'Command', sortable: true, filter: 'select',
      value: (pkt) => (isCommandPacket(pkt) || isButtonPacket(pkt)) ? getCommandLabel(pkt.command) : '',
      render: (pkt) => <span className="text-muted-foreground">{(isCommandPacket(pkt) || isButtonPacket(pkt)) ? getCommandLabel(pkt.command) : '-'}</span>,
    },
    {
      key: 'state', label: 'State', sortable: true, filter: 'select',
      value: (pkt) => isStatusPacket(pkt) ? getStateLabel(pkt.state) : '',
      render: (pkt) => <span className="text-muted-foreground">{isStatusPacket(pkt) ? getStateLabel(pkt.state) : '-'}</span>,
    },
    {
      key: 'rssi', label: 'RSSI', sortable: true,
      value: (pkt) => pkt.rssi ?? 0,
      render: (pkt) => <span className="text-muted-foreground">{pkt.rssi?.toFixed(1) ?? '-'}</span>,
    },
    {
      key: 'actions', label: '',
      render: (pkt) => <CopyPacketBtn pkt={pkt} />,
    },
  ]
}

// ─── Compact columns (used by per-remote collapsible section) ───────────────

export function buildCompactColumns(
  configNames: Record<string, string>,
  addressTypes: Record<string, AppDeviceType>,
): Column<RfPacketWithTimestamp>[] {
  return [
    {
      key: 'time', label: 'Time', sortable: true,
      value: (pkt) => pkt.received_at ?? pkt.t,
      render: (pkt) => <span className="text-muted-foreground">{formatTime(pkt.received_at)}</span>,
    },
    {
      key: 'source', label: 'From', sortable: true,
      value: (pkt) => configNames[pkt.src] || pkt.src,
      render: (pkt) => <AddressCell addr={pkt.src} name={configNames[pkt.src]} deviceType={addressTypes[pkt.src] ?? 'unknown'} />,
    },
    {
      key: 'type', label: 'Type', sortable: true,
      value: (pkt) => getMsgTypeLabel(pkt.type),
      render: (pkt) => <span className="text-muted-foreground">{getMsgTypeLabel(pkt.type)} ({pkt.type})</span>,
    },
    {
      key: 'detail', label: 'Detail', sortable: true,
      value: (pkt) => {
        if (isStatusPacket(pkt)) return getStateLabel(pkt.state)
        if (isCommandPacket(pkt) || isButtonPacket(pkt)) return getCommandLabel(pkt.command)
        return ''
      },
      render: (pkt) => {
        if (isStatusPacket(pkt)) return <span className="text-muted-foreground">{getStateLabel(pkt.state)}</span>
        if (isCommandPacket(pkt) || isButtonPacket(pkt)) return <span className="text-muted-foreground">{getCommandLabel(pkt.command)}</span>
        return <span className="text-muted-foreground">-</span>
      },
    },
    {
      key: 'rssi', label: 'RSSI', sortable: true,
      value: (pkt) => pkt.rssi ?? 0,
      render: (pkt) => <span className="text-muted-foreground">{pkt.rssi?.toFixed(1) ?? '-'}</span>,
    },
  ]
}
