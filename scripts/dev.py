"""Build local sources and upload directly, reusing the existing ESPHome cache."""

import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["check", "build", "upload", "logs", "deploy", "rollback"])
    parser.add_argument("config", nargs="?", help="Existing local YAML; defaults to the private profile")
    parser.add_argument("--device", help="Existing device IP/hostname for upload or logs")
    parser.add_argument("--file", help="Previously compiled OTA binary, for upload only")
    parser.add_argument("--profile", type=Path, default=Path(__file__).resolve().parents[1] / "config.dev.local.json")
    parser.add_argument("--dry-run", action="store_true", help="Show commands without compiling or connecting")
    args = parser.parse_args()

    profile = {}
    if args.profile.exists():
        try:
            profile = json.loads(args.profile.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError):
            parser.error("Cannot read the local profile JSON")
        if not isinstance(profile, dict):
            parser.error("The local profile must be a JSON object")

    config = args.config or profile.get("config")
    device = args.device or profile.get("device")
    python = profile.get("python", sys.executable)
    binary = args.file
    if args.file and args.action != "upload":
        parser.error("--file is for upload only")
    if args.device and args.action in ("check", "build"):
        parser.error("--device is for upload, deploy and logs")

    if args.action == "rollback":
        if args.config or args.device:
            parser.error("rollback uses the saved baseline config and profile device")
        baseline = profile.get("baseline", {})
        if not isinstance(baseline, dict) or not all(baseline.get(k) for k in ("config", "file", "sha256")):
            parser.error("Save a baseline config, OTA file and sha256 in the private profile first")
        config, binary = baseline["config"], baseline["file"]
        if not Path(binary).is_file():
            parser.error("The saved baseline binary is missing")
        if hashlib.sha256(Path(binary).read_bytes()).hexdigest() != baseline["sha256"]:
            parser.error("The saved baseline binary checksum has changed")

    if not config or not Path(config).is_file():
        parser.error("Provide an existing YAML config, or set config in config.dev.local.json")
    if binary and not Path(binary).is_file():
        parser.error("The specified OTA binary is missing")

    actions = {
        "check": [["compile", "--only-generate"]],
        "build": [["compile"]],
        "upload": [["upload"]],
        "logs": [["logs"]],
        "deploy": [["compile"], ["upload"]],
        "rollback": [["upload"]],
    }
    config = str(Path(config).resolve())
    for action in actions[args.action]:
        command = [str(python), "-m", "esphome", *action, config]
        if action[0] in ("upload", "logs") and device:
            command += ["--device", str(device)]
        if action[0] == "upload" and binary:
            command += ["--file", str(Path(binary).resolve())]
        if args.dry_run:
            print(subprocess.list2cmdline(command), flush=True)
            continue
        started = time.monotonic()
        result = subprocess.run(command, check=False)
        print(f"{action[0]}: {time.monotonic() - started:.1f}s (exit {result.returncode})", flush=True)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
