"""Build the embedded UI from this checkout, never from an unrelated release."""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


def digest(path: Path) -> str:
    # Git may check text out with CRLF on Windows.
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def input_paths(app: Path) -> list[Path]:
    roots = [p for p in app.iterdir() if p.is_file() and p.suffix in {".json", ".yaml", ".ts", ".html"}]
    for directory in ("src", "scripts"):
        roots.extend(p for p in (app / directory).rglob("*")
                     if p.is_file() and "generated" not in p.relative_to(app).parts)
    return sorted(roots)


def assets_valid(component: Path) -> bool:
    try:
        manifest = json.loads((component / "elero_web_ui.manifest.json").read_text())
        app = component / "frontend/app"
        inputs = {p.relative_to(app).as_posix(): digest(p) for p in input_paths(app)}
        return (manifest["schema"] == 1 and manifest["inputs"] == inputs
                and manifest["header_sha256"] == digest(component / "elero_web_ui.h"))
    except (OSError, ValueError, KeyError, TypeError):
        return False


def ensure_ui_assets(component: Path) -> None:
    if assets_valid(component):
        return
    pnpm = shutil.which("pnpm")
    if not pnpm:
        raise RuntimeError("Missing or stale Elero UI assets. Install Node and pnpm 10.32.1, then run pnpm build in components/elero_web/frontend/app.")
    version = subprocess.run([pnpm, "--version"], capture_output=True, text=True, check=True).stdout.strip()
    if version != "10.32.1":
        raise RuntimeError(f"Elero UI requires pnpm 10.32.1 (found {version}). Build with npx --yes pnpm@10.32.1 build in components/elero_web/frontend/app.")
    try:
        for args in (["install", "--frozen-lockfile"], ["run", "build"]):
            subprocess.run([pnpm, *args], cwd=component / "frontend/app", check=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeError("Elero UI source build failed; firmware compilation stopped. Run pnpm build in components/elero_web/frontend/app.") from exc
    if not assets_valid(component):
        raise RuntimeError("Elero UI build produced missing or mismatched assets; firmware compilation stopped.")
