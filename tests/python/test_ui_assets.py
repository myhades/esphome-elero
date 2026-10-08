"""Build failures must be detected before ESPHome starts compiling C++."""
import importlib.util
import json
from pathlib import Path

import pytest

MODULE = Path(__file__).parents[2] / "components/elero_web/ui_assets.py"


def load_assets():
    spec = importlib.util.spec_from_file_location("ui_assets", MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_missing_header_is_not_accepted(tmp_path):
    assert not load_assets().assets_valid(tmp_path)


def test_stale_or_modified_artifact_is_rejected(tmp_path):
    assets = load_assets()
    app = tmp_path / "frontend/app"
    app.mkdir(parents=True)
    source = app / "package.json"
    source.write_text('{}\n')
    header = tmp_path / "elero_web_ui.h"
    header.write_text("generated")
    manifest = {"schema": 1, "inputs": {"package.json": assets.digest(source)},
                "header_sha256": assets.digest(header)}
    (tmp_path / "elero_web_ui.manifest.json").write_text(json.dumps(manifest))
    assert assets.assets_valid(tmp_path)
    source.write_text('{"changed":true}')
    assert not assets.assets_valid(tmp_path)
    source.write_text('{}\n')
    header.write_text("wrong release")
    assert not assets.assets_valid(tmp_path)


def test_missing_build_tool_fails_with_actionable_error(tmp_path, monkeypatch):
    assets = load_assets()
    monkeypatch.setattr(assets.shutil, "which", lambda _: None)
    with pytest.raises(RuntimeError, match="pnpm"):
        assets.ensure_ui_assets(tmp_path)
