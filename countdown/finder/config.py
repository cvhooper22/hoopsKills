"""Load the config.json thresholds/weights file.

Config is intentionally kept separate from facts: facts are expensive to produce
(scrape + parse) and change on a scrape schedule; config is cheap to edit and
should change interactively without ever triggering a rescrape.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = REPO_ROOT / "config.json"


def load_config(path: str | Path | None = None) -> dict[str, Any]:
    cfg_path = Path(path) if path else DEFAULT_CONFIG_PATH
    with cfg_path.open(encoding="utf-8") as fh:
        return json.load(fh)
