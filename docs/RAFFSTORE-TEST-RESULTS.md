# Raffstore engineering validation — 2026-10-08

No firmware was flashed and no physical RF was transmitted. Tests use synthetic
addresses and mocks. The supplied observations do not prove that terminal feedback
is absent, and no physical compatibility claim is made.

## Automated checks

| Gate | Result | Evidence / limit |
| --- | --- | --- |
| Native protocol, queue, state, persistence, merge and snapshot tests | PASS | 477 tests under WSL, CMake/CTest |
| Python validation and UI asset failures | PASS | 39 pytest tests; Ruff clean |
| Frontend exports, identity, bounded capture | PASS | 11 Node tests, including 3,000 discovered sources |
| Browser clipboard and JSON/JSONL/CSV exports | PASS | Mock WebSocket, actual downloaded bytes, simulated insecure HTTP and denied clipboard |
| Browser saved-device lifecycle | PASS | Save failure, Cancel, successful save, reload, delete, reload; distinct tilt commands |
| Browser backup round trip | PASS | Version-3 JSON download re-uploaded unchanged to a mock endpoint |
| Sanitized bundle | PASS | Pseudonymous correlation; raw frames, names, arbitrary logs and extra fields excluded |
| Browser total | PASS | Five Chromium tests |
| Frontend lint/typecheck/build | PASS | Zero typecheck warnings/errors; pinned pnpm 10.32.1 |
| Clean checkout and UI reproducibility | PASS | Fork CI installs frozen lockfile, builds twice and checks header SHA-256 |
| Seven ESPHome compile targets | PASS at preceding checkpoints | CI for PRs 1–3; latest PR checks are authoritative for final source |
| ESP32-S3 N16R8 local compile | PASS before final integration | Final branch additionally requires CI compile; no upload/flash command |
| Alternate targeted 0x69/0x6a vectors | PASS, synthetic only | Frozen synthetic long-UP bytes and decode round trip; not measured motor acceptance |
| V3 to V4 migration, reboot, tombstone | PASS, native mock preferences | Original V3 bytes retained; V4 saved identities/profile restored |
| STOP priority and tilt isolation | PASS, software only | Queue preemption; tilt feedback does not initiate height travel |
| Fallback, stale motion, zero calibration, timer wrap | PASS, deterministic | Estimated endpoint kept distinct from received terminal feedback |
| Firmware bit-for-bit reproducibility | NOT TESTED | Tooling pinned and binaries packaged with checksums; build metadata can differ |
| Multi-hour gateway/browser soak | NOT TESTED | Bounded-buffer stress is not a duration/heap stability certification |
| Interrupted NVS power / flash wear | NOT TESTED | Save-failure tests do not model power loss or a multi-record transaction |
| Older unknown NVS schemas | NOT TESTED | Only the known V3 layout is migrated; no guessed reinterpretation |
| Real HTTP device/mobile browser | NEEDS USER HARDWARE | Chromium mocks validate UI behavior, not the user's network/browser |
| Real HA registration, unknown rendering and controls | NEEDS USER HARDWARE | Native and MQTT compile; HA/motor execution not tested |
| Physical STOP both ways, tilt, endpoint feedback, calibration | NEEDS USER HARDWARE | Explicit approval required before any motor command |
| Physical backup, OTA and rollback | NEEDS USER HARDWARE | Need original YAML, known-working binary and NVS backup first |

## Reproduction

From the repository root (use `npx --yes pnpm@10.32.1` if the installed pnpm differs):

```text
uv sync --locked
uv run ruff check components/
uv run pytest -q
pnpm --dir components/elero_web/frontend/app install --frozen-lockfile
pnpm --dir components/elero_web/frontend/app test
pnpm --dir components/elero_web/frontend/app lint
pnpm --dir components/elero_web/frontend/app typecheck
pnpm --dir components/elero_web/frontend/app exec playwright install chromium
pnpm --dir components/elero_web/frontend/app test:browser
pnpm --dir components/elero_web/frontend/app build
cmake -S tests/unit -B build/native
cmake --build build/native -j 8
ctest --test-dir build/native --output-on-failure
uv run esphome compile tests/test.esp32-s3-n16r8.yaml
```

C++ tests were run in WSL Ubuntu; frontend and Python checks also ran on Windows.
CI uses the pinned versions in `.mise.toml`, `uv.lock`, and `pnpm-lock.yaml`.
CI firmware artifacts contain test YAML, source SHA, lockfiles and SHA256SUMS.
They are compile-test artifacts, not the owner's ready-to-flash configuration.

## Checkpoints and rollback

| Slice | Commit / review | Main changed areas | Source rollback |
| --- | --- | --- | --- |
| Build + initial diagnostics | [0449ca3](https://github.com/myhades/esphome-elero/commit/0449ca3), [PR 1](https://github.com/myhades/esphome-elero/pull/1) | `ui_assets.py`, frontend diagnostics/export, backend debug TX, CI, N16R8 fixture | `baseline/manuschillerdev-dev` |
| Identity + profiles + V4 | [b2ce521](https://github.com/myhades/esphome-elero/commit/b2ce521), [PR 2](https://github.com/myhades/esphome-elero/pull/2) | `nvs_config.h`, `command_sender.h`, `device_registry.cpp`, Web schema/store/settings, tests | `0449ca3` |
| Estimated state + tilt | [b5d7252](https://github.com/myhades/esphome-elero/commit/b5d7252), [PR 3](https://github.com/myhades/esphome-elero/pull/3) | `cover_sm.*`, `state_snapshot.*`, native/MQTT adapters, controls, snapshot tests | `b2ce521` |
| Diagnostics + end-to-end integration | `feat/raffstore-diagnostic-bundles` | `elero.*` TX telemetry, Manage table, log/bundle export, explicit alias merge, CI artifacts, browser tests | `b5d7252` |

The complete candidate is the last stacked branch. Earlier drafts are engineering
slices and include integration gaps fixed by the final slice. All branches and PRs
are inside `myhades/esphome-elero`; original `main` remains at `eaedf52`.
Use a separate worktree or a clean checkout when comparing rollback revisions.
Do not reset a worktree with uncommitted changes.

No hardware rollback has been performed. V3 records remain intact; downgrading to
V3 restores their pre-migration settings, not later V4 edits. Preserve compatible
JSON backups and the original firmware before a user-approved deployment.
