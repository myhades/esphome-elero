# Elero Raffstore for ESPHome

ESP32-S3 N16R8 + CC1101, ESPHome 2026.9.1. Native Home Assistant integration without Web UI, Node or pnpm.

## Setup

```yaml
external_components:
  - source: github://myhades/esphome-elero@main
    components: [elero]
    refresh: 0s
```

`main` tracks the current code. Recompile and upload via OTA to apply updates.

For local experiments, keep one private YAML using `external_components` with
`source: {type: local, path: /path/to/this/repo/components}` and one fixed
`esphome.build_path`. The ignored `config.dev.local.json` can store `python`
(existing ESPHome interpreter), `config` (that YAML), and `device` (ESP address).
Run `python scripts/dev.py deploy` to compile incrementally and upload directly;
no Git push, remote pull or HA-side build is involved. `upload` skips compilation,
and `--dry-run` previews commands. An optional `baseline` object with `config`,
`file` (saved OTA binary), and `sha256` enables `python scripts/dev.py rollback`
without recompiling. Keep credentials in the private YAML/secrets files.

The native diagnostic mode action accepts `0` (normal), `1` (listen-only),
or `2` (explicit debug bursts only). Wait for `DIAG ... ready=1` in the
ESPHome/HA log before measuring. Switching modes cancels pending work and
lets any on-air frame finish; mode 1 blocks every TX path, and mode 2 suppresses
polling and follow-up CHECKs. The debug action then sends exactly the requested
burst using the existing wire format. Return to mode 0 after testing. Modes and
counters live in RAM and reset on reboot. `DIAG_RX` reports FIFO fragments,
parser rejections and queue drops; `RX_META`/`RX_ROUTE` preserve raw frames,
destinations and ESP timestamps through the native API log subscription.

Start with the [example configuration](configs/raffstore.yaml). Set your Wi-Fi and API/OTA credentials, motor and remote addresses, and channel.

- `state_strategy: timed`: estimates remaining travel from position, direction and full travel duration, then adds `endpoint_margin`. Unknown positions use full travel time. RF endpoint feedback takes precedence.
- `state_strategy: feedback`: waits for motor feedback, with a movement timeout if none arrives.
- HA uses 100% for fully open and 0% for fully closed. Intermediate positions are time estimates. Unknown startup position displays a 50% placeholder.
- Omit `tilt` and both tilt commands when unused. To enable it, set `tilt: true`, configure `commands.tilt_up/tilt_down`, and add buttons with `action: tilt_up/tilt_down`.
- Configure RSSI under `sensor` and the status-query button under `button`, using `platform: elero` and `cover_id` to select the cover.
- Up, down and STOP use three-frame `0x44` bursts (commands `0x21`, `0x41` and `0x10`, type2 `0x10`, hop `0x00`). An isolated UP followed by this STOP after eight seconds stopped the blind at the expected time. The earlier CHECK-as-STOP trial failed to stop reliably; CHECK's effect on motion remains unresolved. Automatic queries stay disabled, including startup, idle, movement and command follow-ups. The explicit query button and receive logging remain available.
- Under `text_sensor`, expose `rf_state`, `position_source` and `transition_reason` separately. Use the [HA template](configs/ha-rssi-attributes.yaml) to combine them as RSSI attributes.

YAML is authoritative; legacy NVS data is preserved. Movement and the isolated STOP have worked on the user's motor. Repeated control and long-term reliability still need validation; tilt remains unverified.
