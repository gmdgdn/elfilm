#!/usr/bin/env python3
"""
Deploy the clean ElFilm public dataset to Cloudflare.

This script intentionally expects CLOUDFLARE_API_TOKEN in the environment.
It never reads or writes private source mapping files.
"""

from __future__ import annotations

import argparse
import mimetypes
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PREPARED_DIR = ROOT / "prepared_cloudflare"
DEFAULT_ASSETS_DIR = ROOT / "public" / "assets" / "elfilm"
DEFAULT_PROGRESS = ROOT / "prepared_cloudflare" / "r2_uploaded_keys.txt"


def run(cmd: list[str], cwd: Path, dry_run: bool = False) -> None:
    printable = " ".join(cmd)
    print(printable)
    if dry_run:
        return
    completed = subprocess.run(cmd, cwd=str(cwd), shell=os.name == "nt")
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def require_cloudflare_token() -> None:
    if not os.environ.get("CLOUDFLARE_API_TOKEN"):
        raise SystemExit(
            "CLOUDFLARE_API_TOKEN is not set. Set it in this shell, then rerun the deploy script."
        )


def deploy_d1(args: argparse.Namespace) -> None:
    schema_path = args.prepared_dir / "schema.sql"
    if not schema_path.exists():
        raise SystemExit(f"Missing schema file: {schema_path}")

    run(
        ["npx", "wrangler", "d1", "execute", args.database, "--remote", "--yes", f"--file={schema_path}"],
        ROOT,
        args.dry_run,
    )

    for seed_path in sorted(args.prepared_dir.glob("seed_*.sql")):
        run(
            ["npx", "wrangler", "d1", "execute", args.database, "--remote", "--yes", f"--file={seed_path}"],
            ROOT,
            args.dry_run,
        )


def load_progress(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def append_progress(path: Path, key: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"{key}\n")


def iter_asset_files(assets_dir: Path):
    for path in sorted(assets_dir.rglob("*")):
        if path.is_file():
            yield path


def should_force_upload(key: str, force_prefixes: list[str], force_all: bool) -> bool:
    if force_all:
        return True
    return any(key.startswith(prefix) for prefix in force_prefixes)


def build_r2_key(relative: str) -> str:
    normalized = relative.replace("\\", "/")
    if normalized.startswith("assets/"):
        return normalized
    return f"assets/{normalized}"


def upload_r2(args: argparse.Namespace) -> None:
    uploaded = load_progress(args.progress_file)
    count = 0
    skipped = 0

    for path in iter_asset_files(args.assets_dir):
        relative = path.relative_to(args.assets_root).as_posix()
        key = build_r2_key(relative)
        if key in uploaded and not should_force_upload(key, args.force_prefix, args.force_r2):
            skipped += 1
            continue

        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        run(
            [
                "npx",
                "wrangler",
                "r2",
                "object",
                "put",
                f"{args.bucket}/{key}",
                f"--file={path}",
                f"--content-type={content_type}",
                "--cache-control=public, max-age=31536000, immutable",
            ],
            ROOT,
            args.dry_run,
        )
        if not args.dry_run:
            append_progress(args.progress_file, key)
        count += 1

        if args.limit and count >= args.limit:
            break

    print(f"R2 upload complete for this run: uploaded={count}, skipped={skipped}")


def deploy_worker(args: argparse.Namespace) -> None:
    cmd = ["npx", "wrangler", "deploy"]
    if args.worker_assets:
        cmd.extend(["--assets", str(args.worker_assets)])
    run(cmd, ROOT, args.dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy clean ElFilm data/assets to Cloudflare.")
    parser.add_argument("--prepared-dir", type=Path, default=DEFAULT_PREPARED_DIR)
    parser.add_argument("--assets-dir", type=Path, default=DEFAULT_ASSETS_DIR)
    parser.add_argument("--assets-root", type=Path, default=ROOT / "public")
    parser.add_argument("--database", default="elfilm_db")
    parser.add_argument("--bucket", default="elfilm-assets")
    parser.add_argument("--progress-file", type=Path, default=DEFAULT_PROGRESS)
    parser.add_argument("--worker-assets", type=Path, default=ROOT / "public")
    parser.add_argument("--skip-d1", action="store_true")
    parser.add_argument("--skip-r2", action="store_true")
    parser.add_argument("--skip-worker", action="store_true")
    parser.add_argument("--limit", type=int, help="Limit R2 uploads for test runs.")
    parser.add_argument(
        "--force-prefix",
        action="append",
        default=[],
        help="R2 key prefix to re-upload even if the progress file says it was already uploaded.",
    )
    parser.add_argument(
        "--force-r2",
        action="store_true",
        help="Re-upload all assets to R2 regardless of the progress file.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    args.prepared_dir = args.prepared_dir.resolve()
    args.assets_dir = args.assets_dir.resolve()
    args.assets_root = args.assets_root.resolve()
    args.progress_file = args.progress_file.resolve()

    if not args.dry_run:
        require_cloudflare_token()

    if not args.skip_d1:
        deploy_d1(args)
    if not args.skip_r2:
        upload_r2(args)
    if not args.skip_worker:
        deploy_worker(args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)
