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

Start with the [example configuration](configs/raffstore.yaml). Set your Wi-Fi and API/OTA credentials, motor and remote addresses, and channel.

- `state_strategy: timed`: estimates remaining travel from position, direction and full travel duration, then adds `endpoint_margin`. Unknown positions use full travel time. RF endpoint feedback takes precedence.
- `state_strategy: feedback`: waits for motor feedback, with a movement timeout if none arrives.
- HA uses 100% for fully open and 0% for fully closed. Intermediate positions are time estimates. Unknown startup position displays a 50% placeholder.
- Omit `tilt` and both tilt commands when unused. To enable it, set `tilt: true`, configure `commands.tilt_up/tilt_down`, and add buttons with `action: tilt_up/tilt_down`.
- Configure RSSI under `sensor` and the status-query button under `button`, using `platform: elero` and `cover_id` to select the cover.
- Five diagnostic buttons use `action: short_up`, `long_up`, `short_down`, `long_down`, and `stop`. The four direction buttons send one three-packet burst through the current backend command profile without an immediate CHECK. Stop uses the cover's regular STOP + CHECK path and cancels pending movement. The example exposes all five in Home Assistant.
- Under `text_sensor`, expose `rf_state`, `position_source` and `transition_reason` separately. Use the [HA template](configs/ha-rssi-attributes.yaml) to combine them as RSSI attributes.

Omitting `commands` selects this fork's installed MonoTel 2 profile: UP `0x21`, DOWN `0x41` and STOP `0x10` use `0x69`, payload `00 01`, and `command_address`. CHECK keeps `0x6A`, payload `00 04`, and `status_address`. Explicit `commands` remain available for diagnostic overrides.

The profile comes from relayed packets captured during successful remote operation. Origin routing uses `type2: 0x10`, `hop: 0x0A` and the configured remote as source/backward/forward address. Counters and encoding seeds are generated, rather than replayed. Polling, timing and NVS behavior are unchanged. YAML is authoritative; legacy NVS data is preserved.

The installed blind responds to the long-command buttons. Standalone STOP was ineffective in the user's test, while the cover's STOP + CHECK sequence worked. Short commands now use `0x20/0x40` with the same `0x69` addressing as long commands; their physical behavior remains unverified.
