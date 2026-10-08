# ESPHome Elero Raffstore

Personal ESP32-S3 N16R8 + CC1101 external component. Requires ESPHome 2026.9.1.
Native ESPHome covers and diagnostic entities; no web server, JavaScript tooling,
Mongoose, MQTT adapter, dynamic discovery or runtime device editor.

Start with `configs/raffstore.yaml`, set the three RF addresses and provide
`wifi_ssid`, `wifi_password`, `api_encryption_key`, `ota_password` in `secrets.yaml`.
Compile with `esphome compile configs/raffstore.yaml`. Upload only when ready.
All seven RF actions accept command, type, type2, hop, payload_1, payload_2 and
`destination: command|status`. Defaults for explicit actions are 0x69, 0, 0x0A,
0, 4. CHECK uses the status address in the example. Motor compatibility has not
been physically verified.

YAML is authoritative. Legacy V3/V4 NVS keys are neither loaded nor written by
this firmware. Existing migration routines and tests remain for rollback to
`cc57e88`; preserve the NVS partition and do not erase flash. Changing/removing a
YAML entity takes effect after compilation and OTA, without reviving old devices.

Travel durations of 0s disable position control. After measuring both full travel
times, set `state_strategy: timed` with `endpoint_margin` to settle missing terminal
feedback as an estimate. `feedback` only trusts reported endpoints. RF Status and
Position Source exposes provenance; tilt is a directional step, not a measured
angle. Native tilt endpoints and the two template buttons send the same steps.

Development: `uv sync --locked`, `uv run pytest`, and
`cmake -S tests/unit -B build/native && cmake --build build/native && ctest --test-dir build/native`.
The sole compile fixture is `tests/test.esp32-s3-n16r8.yaml`; CI deliberately blocks
Node/npm/pnpm/yarn executables during firmware compilation.
