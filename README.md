# ESPHome Elero Raffstore

Personal ESP32-S3 N16R8 + CC1101 external component. Requires ESPHome 2026.9.1.
Native ESPHome covers and diagnostic entities; no web server, JavaScript tooling,
Mongoose, MQTT adapter, dynamic discovery or runtime device editor.

Start with `configs/raffstore.yaml`, set the three RF addresses and provide
`wifi_ssid`, `wifi_password`, `api_encryption_key`, `ota_password` in `secrets.yaml`.
Compile with `esphome compile configs/raffstore.yaml`. Upload only when ready.
All seven RF actions accept command, type, type2, hop, payload_1, payload_2 and
`destination: command|status`. Frame type is required; 0x44 defaults to type2=0x10/hop=0, while
0x69/0x6A default to type2=0/hop=0x0A. Payload defaults are 0, 4. CHECK uses the status address in the example. Motor compatibility has not
been physically verified.

YAML is authoritative. Legacy V3/V4 NVS keys are neither loaded nor written by
this firmware. Existing migration routines and tests remain for rollback to
`cc57e88`; preserve the NVS partition and do not erase flash. Changing/removing a
YAML entity takes effect after compilation and OTA, without reviving old devices.

Travel durations of 0s disable position control. After measuring both full travel
times, set `state_strategy: timed` with `endpoint_margin` to settle missing terminal
feedback as an estimate. `feedback` only trusts reported endpoints. RF Status and
Position Source exposes provenance; tilt is a directional step, not a measured
angle. `tilt: true` automatically creates two native Tilt Up/Down Step buttons.
There is no native tilt slider because the motor does not report a measured angle.
The native cover API requires finite position floats: before height is known it
uses a 50% transport placeholder, explicitly labeled in the status diagnostic and
startup log. This is neither measured nor estimated height. The registry stays
unknown and rejects intermediate targets until referenced; real feedback replaces
the placeholder. No NaN is sent in native cover position/tilt fields.

Development: `uv sync --locked`, `uv run pytest`, and
`cmake -S tests/unit -B build/native && cmake --build build/native && ctest --test-dir build/native`.
The sole compile fixture is `tests/test.esp32-s3-n16r8.yaml`; CI deliberately blocks
Node/npm/pnpm/yarn executables during firmware compilation.

The example `api.actions` exposes `elero_rf_debug` in Home Assistant for manual
parameter probes without recompilation. It uses the configured remote/channel
and the existing sender counter, validates integer ranges, and accepts 1–3 packets
per burst (normal bounded transport retries still apply). It does not modify
YAML/NVS or infer movement from a debug transmission. Type 0x44 uses channel-based
addressing on the wire: `destination` only affects addressed 0x69/0x6A frames.
DEBUG logs show TX_REQUEST/TX_RESULT and RX; success means radio completion, not
motor acknowledgment. A busy sender rejects further probes except STOP (0x10),
which cancels pending logical work; already-posted RF work cannot be retracted.
