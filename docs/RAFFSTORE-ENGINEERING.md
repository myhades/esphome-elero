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
