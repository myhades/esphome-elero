# Personal Elero Raffstore component

ESPHome **2026.9.1**, ESP32-S3 N16R8, CC1101. Native HA cover, diagnostics and
API RF debugging. Start from `configs/raffstore.yaml`; keep your own device name,
Wi-Fi/API/OTA credentials and RF addresses. The example contains synthetic addresses.

## Fast iteration

- Change RF command/type/type2/hop/destination in HA's native API debug action:
  **no compile and no OTA**. This affects only that call, not normal cover controls.
- Change firmware or permanent YAML: build once from the same YAML path.
- Upload the already-built firmware separately if needed; upload does not compile.
- No automatic test/build pipeline on push. GitHub firmware builds are manual.

```sh
uv sync --locked
uv run python scripts/dev.py check path/to/device.yaml
uv run python scripts/dev.py build path/to/device.yaml
uv run python scripts/dev.py upload path/to/device.yaml --device DEVICE_IP
uv run python scripts/dev.py logs path/to/device.yaml --device DEVICE_IP
# Or build + upload in one explicit command:
uv run python scripts/dev.py deploy path/to/device.yaml --device DEVICE_IP
```

`check` only generates C++; `build` never uploads. Keep caches and the same config
path. ESPHome may still rebuild when framework/core options or component sets
change; this wrapper does not bypass required rebuilds. Two optional smoke checks:
`uv run pytest -q`. No CMake/GoogleTest/WSL or per-commit firmware builds.

## Behavior

YAML is authoritative; old V3/V4 device NVS records stay untouched for rollback.
0x44 uses channel addressing and defaults to type2=0x10/hop=0; 0x69/0x6A use the
explicit destination and default to type2=0/hop=0x0A. Physical acceptance remains
unverified. TX success means radio completion, not motor acknowledgment.

Both travel durations at 0s disable position control. `state_strategy: timed`
uses measured travel durations plus margin; `feedback` waits for RF endpoints.
`tilt` defaults to false; omit both tilt commands when unused. `preset` is removed
from YAML (its old NVS slot is preserved for rollback). For tilt, enable `tilt: true`,
configure both tilt commands and add `button: platform: elero` entries with
`cover_id` and `action: tilt_up` / `tilt_down`. At unknown boot
height the native cover displays a labeled 50% API placeholder; the registry and
status diagnostic remain unknown until referenced. This is not measured height.

Debug bursts use the existing sender/counter, accept 1–3 packets with bounded
transport retries, reject invalid arguments, and preserve YAML/NVS. STOP can
cancel pending logical work; already-posted RF work cannot be retracted.

RSSI is configured under `sensor` with `platform: elero`, `cover_id` and `name`;
its default icon is `mdi:wifi`. A diagnostic query button uses `platform: elero`,
`cover_id` and `name` under `button`, with no lambda. Diagnostics under `text_sensor`
use `cover_id` and the optional `rf_state`, `position_source`, `transition_reason`
fields. Native ESPHome sensor messages cannot carry custom HA attributes; use the
HA template in `configs/ha-rssi-attributes.yaml` to combine these into one display
entity. Adjust its source entity IDs to those actually assigned by HA.
