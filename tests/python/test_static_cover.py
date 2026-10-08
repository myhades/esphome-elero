"""Reject invalid RF identities and misleading time-based position configuration."""
import pytest
from esphome.config_validation import Invalid
from elero.cover import ACTION_SCHEMA, ADDRESS, DURATION, validate_timing

@pytest.mark.parametrize("address", [0, -1, 0x1000000])
def test_invalid_address(address):
    with pytest.raises(Invalid):
        ADDRESS(address)

@pytest.mark.parametrize("address", [1, 0xFFFFFF, "0x300001"])
def test_valid_address(address):
    assert ADDRESS(address) > 0

@pytest.mark.parametrize("frame_type", [0x44, 0x69, 0x6A])
def test_explicit_framing(frame_type):
    config = ACTION_SCHEMA({"command": 0x21, "type": frame_type})
    assert config["type"] == frame_type
    assert config["type2"] == (0x10 if frame_type == 0x44 else 0)
    assert config["hop"] == (0 if frame_type == 0x44 else 0x0A)
    assert config["payload_2"] == 4
    assert config["destination"] == "command"

@pytest.mark.parametrize("config", [
    {"command": 256}, {"command": -1}, {"command": 0x10, "type": 0xCA},
    {"command": 0, "destination": "broadcast"}, {"command": 0, "hop": 256},
])
def test_invalid_action(config):
    with pytest.raises(Invalid):
        ACTION_SCHEMA({"type": 0x69, **config})

@pytest.mark.parametrize("opening,closing,strategy,valid", [
    (0, 0, "feedback", True), (0, 0, "timed", False),
    (10, 0, "feedback", False), (0, 10, "timed", False),
    (10, 12, "timed", True), (10, 12, "feedback", True),
])
def test_timing(opening, closing, strategy, valid):
    config = {"open_duration": DURATION(f"{opening}s"),
              "close_duration": DURATION(f"{closing}s"), "state_strategy": strategy}
    if valid:
        assert validate_timing(config) is config
    else:
        with pytest.raises(Invalid):
            validate_timing(config)


def test_duplicate_status_identity_is_rejected(monkeypatch):
    from unittest.mock import Mock
    from esphome import final_validate as fv
    from elero.cover import final_validate
    full = Mock()
    full.get.return_value = {"cover": [
        {"platform": "elero", "status_address": 0x300001},
        {"platform": "elero", "status_address": 0x300001},
    ]}
    monkeypatch.setattr(fv, "full_config", full)
    with pytest.raises(Invalid, match="unique status_address"):
        final_validate({})


def test_registry_capacity_is_validated(monkeypatch):
    from unittest.mock import Mock
    from esphome import final_validate as fv
    from elero.cover import final_validate
    full = Mock()
    full.get.return_value = {"cover": [
        {"platform": "elero", "status_address": i + 1} for i in range(49)
    ]}
    monkeypatch.setattr(fv, "full_config", full)
    with pytest.raises(Invalid, match="48"):
        final_validate({})


def test_complete_native_codegen(tmp_path):
    """Exercise actual ESPHome loading, validation, entity registration and actions."""
    import subprocess
    import sys
    from pathlib import Path
    import yaml
    root = Path(__file__).resolve().parents[2]
    config = yaml.safe_load((root / "tests/test.esp32-s3-n16r8.yaml").read_text())
    config["external_components"][0]["source"]["path"] = str(root / "components")
    config["esphome"]["build_path"] = str(tmp_path / "build")
    device = config["cover"][0]
    device.update(state_strategy="timed", open_duration="27s", close_duration="29s")
    path = tmp_path / "test.yaml"
    path.write_text(yaml.safe_dump(config, sort_keys=False))
    result = subprocess.run([sys.executable, "-m", "esphome", "compile", "--only-generate", str(path)],
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    source = (tmp_path / "build/src/main.cpp").read_text()
    assert source.count("App.register_cover(") == 1
    assert "cfg.open_duration_ms = 27000" in source
    assert "cfg.close_duration_ms = 29000" in source
    assert "cfg.endpoint_margin_ms = 2000" in source
    assert "cfg.actions[0].command = 33" in source
    assert "cfg.actions[6].destination = 1" in source
    assert "set_yaml_mode(true)" in source
    assert "register_light" not in source
    assert "mongoose" not in source
    assert "elero_web" not in source
    assert "debug_send(command, frame_type, type2, hop" in source


def test_rf_type_must_be_explicit():
    with pytest.raises(Invalid):
        ACTION_SCHEMA({"command": 0x21})


def test_explicit_headers_are_preserved():
    config = ACTION_SCHEMA({"command": 0x21, "type": 0x44, "type2": 7, "hop": 8})
    assert config["type2"] == 7
    assert config["hop"] == 8
