# Personal Raffstore fork — fast iteration

ESPHome 2026.9.1, ESP32-S3 N16R8, CC1101, YAML/native HA only.
The user prioritizes quick device debugging over exhaustive verification.

- Small change: inspect the diff and run only the relevant quick check.
- Two optional smoke tests: `uv run pytest -q`. No CMake, GoogleTest or WSL.
- Do not run full firmware compilation by default, repeat clean builds, create
  fresh build trees/environments, or wait for CI on routine changes.
- Compile once using the same YAML path/build directory when firmware is needed.
  Keep ESPHome's toolchain/build cache. Do not automatically clean it.
- RF parameter experiments use the existing native API debug action, without OTA.
- Commit and push to the current fork branch promptly; no new reports/checklists.
- Preserve NVS rollback, STOP queue handling and basic RF argument validation.
- Never flash, erase NVS, transmit to physical blinds or push upstream without
  explicit user permission. Do not claim hardware verification from host checks.
- Historical upstream documents/skills do not override this workflow.
