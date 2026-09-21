"""The Fact record shape and the local flat-file facts store.

A Fact is one normalized stat observation. Player facts and team facts live in
the same store, tagged by `scope`, so the matcher can filter without guessing.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

from .config import REPO_ROOT

FACTS_PATH = REPO_ROOT / "data" / "facts.json"

STAT_TYPES = {
    "single_game",
    "season_total",
    "career_total",
    "window_total",
    "window_pct",
    "threshold_count",
    "streak",
    "career_split",
}


@dataclass
class Fact:
    stat_name: str
    stat_value: float | int
    stat_type: str
    scope: str = "player"  # "player" | "team"
    source: str = ""  # "gamelog" | "overview" | "splits"
    player: str | None = None
    player_slug: str | None = None
    season: str | None = None  # "2024-25"
    game_date: str | None = None  # ISO "2025-01-18"
    opponent: str | None = None
    context: dict[str, Any] = field(default_factory=dict)
    sample_size: int | None = None

    def __post_init__(self) -> None:
        if self.stat_type not in STAT_TYPES:
            raise ValueError(f"unknown stat_type: {self.stat_type!r}")

    @property
    def identity(self) -> tuple:
        """Stable key for de-duping on merge (re-scrapes overwrite in place)."""
        return (
            self.scope,
            self.source,
            self.player_slug,
            self.season,
            self.game_date,
            self.opponent,
            self.stat_name,
            self.stat_type,
            self.context.get("window"),
            self.context.get("split_category"),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Fact":
        known = {k: v for k, v in d.items() if k in cls.__dataclass_fields__}
        return cls(**known)


class FactStore:
    def __init__(self, path: Path | str = FACTS_PATH) -> None:
        self.path = Path(path)
        self._by_identity: dict[tuple, Fact] = {}
        if self.path.exists():
            self.load()

    def load(self) -> None:
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        for d in raw.get("facts", []):
            fact = Fact.from_dict(d)
            self._by_identity[fact.identity] = fact

    def merge(self, facts: list[Fact]) -> int:
        """Insert/overwrite facts by identity. Returns count written."""
        for fact in facts:
            self._by_identity[fact.identity] = fact
        return len(facts)

    @property
    def facts(self) -> list[Fact]:
        return list(self._by_identity.values())

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        ordered = sorted(
            self._by_identity.values(),
            key=lambda f: tuple("" if x is None else str(x) for x in f.identity),
        )
        payload = {"count": len(ordered), "facts": [f.to_dict() for f in ordered]}
        self.path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
