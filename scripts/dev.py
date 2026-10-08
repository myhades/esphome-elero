"""Thin ESPHome CLI shortcuts. No tests, environment resets or cache cleaning."""
import argparse
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("action", choices=["check", "build", "upload", "logs", "deploy"])
parser.add_argument("config", help="Use the same local YAML path across builds")
parser.add_argument("--device", help="Existing device IP/hostname for upload or logs")
args = parser.parse_args()
commands = {
    "check": ["compile", "--only-generate"],
    "build": ["compile"],
    "upload": ["upload"],
    "logs": ["logs"],
    "deploy": ["run", "--no-logs"],
}
command = [sys.executable, "-m", "esphome", *commands[args.action], args.config]
if args.device:
    if args.action in ("check", "build"):
        parser.error("--device is for upload, deploy and logs")
    command += ["--device", args.device]
raise SystemExit(subprocess.call(command))
