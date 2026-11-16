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
- Under `text_sensor`, expose `rf_state`, `position_source` and `transition_reason` separately. Use the [HA template](configs/ha-rssi-attributes.yaml) to combine them as RSSI attributes.

YAML is authoritative; legacy NVS data is preserved. Up, down and STOP have been confirmed on the user's motor; tilt remains unverified.
