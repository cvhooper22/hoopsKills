"""Team page parsing: roster -> player slugs, plus team-level totals.

Phase 5 builds the roster-wide crawl on top of this: parse a school's season
page into player links, then run the per-player pipeline across them.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .config import REPO_ROOT
from .extractor import extract_tables
from .models import Fact
from .normalizer import COUNTING_STATS, PCT_STATS, _int, _pct, season_label

ROSTER_PATH = REPO_ROOT / "data" / "roster.json"

SLUG_RE = re.compile(r"/cbb/players/([^/.]+)\.html")


@dataclass
class RosterEntry:
    name: str
    slug: str
    number: str | None = None
    pos: str | None = None
    klass: str | None = None


def _norm(name: str) -> str:
    """Loose key for matching a requested name to a roster row."""
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", n.lower()).strip()


def parse_roster(html: str) -> list[RosterEntry]:
    table = extract_tables(html).get("roster")
    if table is None:
        return []
    entries: list[RosterEntry] = []
    for row, links in zip(table.rows, table.links):
        href = links.get("player", "")
        m = SLUG_RE.search(href)
        if not m:
            continue
        entries.append(RosterEntry(
            name=row.get("player", "").strip(),
            slug=m.group(1),
            number=row.get("number") or None,
            pos=row.get("pos") or None,
            klass=row.get("class") or None,
        ))
    return entries


def resolve_slugs(html: str, names: list[str]) -> tuple[dict[str, str], list[str]]:
    """Map requested display names -> slugs using the roster table.

    Returns (resolved {name: slug}, unresolved [name, ...])."""
    by_key = {_norm(e.name): e.slug for e in parse_roster(html)}
    resolved: dict[str, str] = {}
    missing: list[str] = []
    for name in names:
        slug = by_key.get(_norm(name))
        (resolved.__setitem__(name, slug) if slug else missing.append(name))
    return resolved, missing


def save_active_roster(slugs: list[str], school: str, season: int,
                       path: Path = ROSTER_PATH) -> None:
    """Record who counts as 'active' for ranking (active_roster_bonus).

    Merges into any existing file so refreshing a subset of players doesn't drop
    the rest of a previously-recorded roster.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    existing: dict = {}
    if path.exists():
        existing = json.loads(path.read_text(encoding="utf-8"))
    known = set(existing.get("slugs", [])) | set(slugs)
    path.write_text(json.dumps({
        "school": school, "season": season,
        "as_of": date.today().isoformat(),
        "slugs": sorted(known),
    }, indent=2) + "\n", encoding="utf-8")


def load_active_roster(path: Path = ROSTER_PATH) -> set[str]:
    if not path.exists():
        return set()
    return set(json.loads(path.read_text(encoding="utf-8")).get("slugs", []))


# -- team-level facts --------------------------------------------------------


def normalize_team_totals(html: str, end_year: int | str, school: str) -> list[Fact]:
    """Team season totals from the 'Team' row of season-total_totals."""
    table = extract_tables(html).get("season-total_totals")
    if table is None:
        return []
    team_row = next((r for r in table.rows if r.get("entity") == "Team"), None)
    if not team_row:
        return []

    season = season_label(end_year)
    base = dict(
        stat_type="season_total", scope="team", source="team_page",
        player=None, player_slug=None, season=season,
        context={"school": school},
    )
    facts: list[Fact] = []
    for key, label in COUNTING_STATS.items():
        val = _int(team_row.get(key))
        if val is not None:
            facts.append(Fact(stat_name=label, stat_value=val, **base))
    for label, (pct_key, att_key) in PCT_STATS.items():
        pct = _pct(team_row.get(pct_key))
        if pct is not None:
            facts.append(Fact(stat_name=label, stat_value=pct,
                              sample_size=_int(team_row.get(att_key)), **base))
    return facts
