"""Optional smoke checks: configuration and actual ESPHome code generation only."""
from elero.cover import ACTION_SCHEMA


def test_frame_headers():
    for frame, type2, hop in [(0x44, 0x10, 0), (0x69, 0, 10), (0x6A, 0, 10)]:
        action = ACTION_SCHEMA({"command": 0x21, "type": frame})
        assert (action["type2"], action["hop"]) == (type2, hop)


def test_complete_native_codegen(tmp_path):
    """Exercise actual ESPHome loading, validation, entity registration and actions."""
    import subprocess
    import sys
    from pathlib import Path
    import yaml
    root = Path(__file__).resolve().parents[2]
    config = yaml.safe_load((root / "tests/test.esp32-s3-n16r8.yaml").read_text(encoding="utf-8"))
    config["external_components"][0]["source"]["path"] = str(root / "components")
    config["esphome"]["build_path"] = str(tmp_path / "build")
    device = config["cover"][0]
    device.update(state_strategy="timed", open_duration="27s", close_duration="29s")
    path = tmp_path / "test.yaml"
    path.write_text(yaml.safe_dump(config, sort_keys=False))
    result = subprocess.run([sys.executable, "-m", "esphome", "compile", "--only-generate", str(path)],
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    source = (tmp_path / "build/src/main.cpp").read_text(encoding="utf-8")
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
    assert "TiltStepButton(" not in source
    assert source.count("App.register_button(") == 1
    assert "set_refresh_button(" in source
    assert "set_rssi_sensor(" in source
    assert "set_position_source_sensor(" in source
    assert "cfg.supports_tilt = 0" in source
    assert "cfg.actions[5].enabled = 1" not in source
    assert "debug_send(command, frame_type, type2, hop" in source
