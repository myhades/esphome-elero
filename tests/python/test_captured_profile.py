"""Check the installed profile against recorded packets and the actual C++ codec."""
import json
from pathlib import Path
import shutil
import subprocess

import pytest

from elero.cover import ACTION_SCHEMA, monotel2_commands

ROOT = Path(__file__).resolve().parents[2]
CAPTURES = json.loads((ROOT / "tests/fixtures/monotel2_packets.json").read_text())


@pytest.fixture(scope="module")
def packet_checker(tmp_path_factory):
    compiler = shutil.which("cl") or shutil.which("c++") or shutil.which("g++") or shutil.which("clang++")
    if compiler is None:
        pytest.skip("Host C++ compiler needed for the captured-packet check")
    build = tmp_path_factory.mktemp("captured-packet")
    executable = build / "packet-check.exe"
    include = ROOT / "components/elero"
    sources = [ROOT / "tests/check_captured_packet.cpp", include / "elero_packet.cpp"]
    if Path(compiler).stem.lower() == "cl":
        args = [compiler, "/nologo", "/std:c++17", "/EHsc", f"/I{include}", f"/Fe:{executable}"]
    else:
        args = [compiler, "-std=c++17", f"-I{include}", "-o", str(executable)]
    subprocess.run(args + list(map(str, sources)), cwd=build, capture_output=True, check=True)
    return executable


@pytest.mark.parametrize("capture", CAPTURES, ids=lambda c: c["name"])
def test_captured_commands(packet_checker, capture):
    action = ACTION_SCHEMA(monotel2_commands()[capture["action"]])
    assert action["destination"] == "command"
    fields = ("command", "type", "type2", "hop", "payload_1", "payload_2")
    result = subprocess.run([str(packet_checker), capture["raw"], *(str(int(action[k])) for k in fields)],
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_check_keeps_existing_framing():
    assert monotel2_commands()["check"] == {
        "command": 0x00, "type": 0x6A, "type2": 0x00, "hop": 0x0A,
        "payload_1": 0x00, "payload_2": 0x04, "destination": "status",
    }
