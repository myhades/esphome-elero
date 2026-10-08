# Raffstore engineering checkpoints

## Baseline (2026-10-08)

The owner's original `main` is `eaedf52`, based on andyboeh's implementation.
The engineering branch starts at manuschillerdev's `dev` revision
`951d6fbc70c840b8fcbdadc209d4b338a2336772`. This baseline is a substantial
architecture change; it is not a drop-in update to the old YAML cover platform.
Original user screenshots and RF identifiers are retained outside the public
repository. Test observations use synthetic addresses and are not raw frames.

Confirmed source defects:

- `elero_web/__init__.py`: release asset failure was swallowed, leaving a required
  C++ include missing; an existing header was accepted without checking its source.
- `packet-table.tsx`: copy success appeared before the clipboard promise resolved.
- `store.ts`: RF history was unbounded; clearing it erased last reported status.
- `ws.ts`: gateway log events were discarded and disconnected sends were silent.
- `elero_web_server.cpp`: explicit raw framing was ignored for known destinations.
- Registry matches status source and command destination against one address.
- `NvsDeviceConfig` is version 3, 64 bytes. Save/delete failures are not propagated.
- Calibrated position reaches an endpoint without leaving Opening/Closing until
  terminal feedback or the separate movement timeout.

## Build and diagnostics slice

`pnpm@10.32.1 install --frozen-lockfile` then `pnpm build` generates the header
and a SHA-256 manifest from local frontend sources. ESPHome validates both;
missing/stale assets trigger a local source build, and build failures stop code
generation. An old manually injected header is insufficient. Node and pnpm must
be installed on the build host (including an ESPHome container if used there).

The Diagnostics tab retains 1,000 RF records and 300 gateway log entries, supports
pause, clear, textual filtering, selected/filtered copy and JSON/JSONL/CSV exports.
Exports retain host reception time and firmware uptime. Missing RF fields remain
unknown. Copy offers a selectable textarea on HTTP or clipboard denial.
Download feedback means the browser was asked to save, not proof it saved a file.
RF exports use an allowlist; review gateway logs before sharing them publicly.

Debug TX preserves chosen fields, asks for confirmation, and reports queue
acceptance separately from motor acknowledgement. Re-send is decoded-command
re-encoding with a new counter and default payload bytes, not ciphertext replay.
Alternate `0x69` motor acceptance remains unverified.

## Remaining stages

1. Versioned identity/profile persistence, explicit alias linking, validation,
   migration, save/delete failure propagation and honest discovery lifecycle.
2. Per-action command profiles, bidirectional tilt, STOP prioritization and
   time-estimated fallback with provenance and stale-status suppression.
3. Complete diagnostic TX/queue/error telemetry and sanitized bundles.
4. User-assisted physical gates, fork-only PR review and release packaging.

## Rollback and physical gates

No firmware has been flashed and no RF has been transmitted by this work.
Before any later deployment, export the existing NVS JSON using the running
firmware, preserve its YAML/secrets and firmware binary, and verify that the
original remote still works. Never erase NVS to troubleshoot.

Source rollback: switch to `main` to return to `eaedf52`, or create a separate
worktree at `951d6fbc70c840b8fcbdadc209d4b338a2336772` for the development baseline.
Do not reset a working tree containing uncommitted changes. Hardware rollback
requires the owner's known-working binary and compatible configuration backup;
none has been exported from the physical device during autonomous development.

Physical compatibility, endpoint feedback, STOP in both directions, tilt and
NVS behavior on the real gateway are **NEEDS USER HARDWARE**. Compilation and
mock tests cannot satisfy those gates.

## 用户操作说明

目前仅进行本地构建和模拟测试，没有刷机或控制真实窗帘。网页 Diagnostics
可暂停抓包、筛选地址、复制记录、下载 JSON/JSONL/CSV。HTTP 环境不能自动复制时，
请在显示的文本框内全选复制。发送按钮仅说明命令进入队列，不代表电机已执行。
更新前请备份现有固件、配置和 NVS；实际 STOP、倾斜和终点反馈仍需之后人工验证。

## Identity/profile slice

V4 stores 132-byte records under `elero_device_v4` preference keys. On first
boot it reads the unchanged 64-byte V3 records under `elero_device`, fills default
standard profiles, and writes V4. Old keys remain intact. A V4 tombstone prevents
deleted records being migrated again. Rolling back to V3 restores the pre-migration
configuration; later edits require restoring a compatible backup. Export JSON
snapshot version 3 includes aliases and seven per-action encoding overrides.

`dst_address` remains the canonical motor status source and HA identity.
`command_address` defaults to that address. Explicitly linked remote source,
control channel and destination match incoming commands without merging unrelated
motors. STATUS header CH never edits the configured control channel.

Profile 0 keeps standard travel bytes. Profile 1 uses long travel 0x21/0x41;
STOP remains 0x10, tilt step bytes are 0x20/0x40, preset 0x24, CHECK 0x00.
Framing defaults remain 0x44 for motion and 0x6a for STOP/CHECK. No automatic
0x69 switch is made. Enabled per-action overrides can select framing, payload,
hop and canonical/alias destination. CHECK defaults to the canonical status source.
Mixed-profile groups dispatch through individual device profiles.

Save failures now return errors before publishing config changes. Delete writes
its tombstone before removing the live device. Browser drafts retain their saved
identity, expose saving/failed/dirty status and can be cancelled. Dismissed
provisional discoveries are remembered in browser storage (per gateway), with an
explicit reset; they are not synchronized to other browsers or NVS.

Hardware migration, STOP acceptance and all alternate framing remain unverified.

## State/tilt slice

`endpoint_margin_ms = 0` disables calibrated settling. With both travel durations
set and a positive margin, a full directional travel duration plus margin settles
the endpoint as `time_estimated`. It does not send STOP or fabricate TOP/BOTTOM.
Steady MOVING reports cannot restart it; a new local/observed command or fresh
START_MOVING report can. Real terminal feedback replaces the estimate. The legacy
120-second watchdog still applies when calibrated settling is disabled.

Unknown startup position is published as null/unknown (native API uses NaN), not
50%. Intermediate percentage targets need a known origin. MQTT attributes, web
state and the native status text explain position provenance and transition reason.
Raw RF state remains separate. Native and MQTT Raffstore tilt endpoint controls
send directional steps; intermediate tilt percentages are unsupported and ignored.
The web UI exposes both directions and a separate preset. Tilt angles are not
invented. Physical angle/STOP behavior still requires validation.

Snapshot tests previously excluded by upstream now run through the registry test
harness. Source rollback for this slice is `b2ce521`; the V4 schema is unchanged.
