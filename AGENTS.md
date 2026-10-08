# Personal Raffstore fork

The current product is YAML-only ESPHome 2026.9.1, ESP32-S3 N16R8 and CC1101.
Native cover and diagnostic entities replace the former Web UI / MQTT / NVS UI.
Do not reintroduce Node, pnpm, Mongoose, dynamic entity discovery or web assets.
Device configuration is authoritative in YAML; preserve old NVS records for rollback.
Keep RF transport and cover state in the existing registry/state-machine path.
Never flash, erase NVS, transmit to real hardware, or push upstream without explicit
user permission. Use deterministic host tests and compile-only validation.

Before C++/RF changes read `.pi/skills/modern-cpp/SKILL.md`,
`.pi/skills/esp32-development/SKILL.md`, `.pi/skills/elero-protocol/SKILL.md`;
review with `.pi/skills/review-quality-gates/SKILL.md`. Historical UI/product
instructions in those skills and docs are superseded by this scope.

Checks: `uv run pytest`, `uv run ruff check components/elero`, native CMake/CTest,
and `uv run esphome compile tests/test.esp32-s3-n16r8.yaml`.
Physical motor compatibility must not be claimed from compilation or mock tests.
