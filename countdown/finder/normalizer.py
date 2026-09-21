"""Fact Normalizer: raw SR table rows -> flat, tagged Fact records.

Source pages:
  * the player overview  -> season_total / career_total counting stats,
                            plus season/career shooting percentages (window_pct,
                            tagged with the attempt count as sample_size)
  * one season game log  -> single_game counting stats, with opponent + W/L /
                            home-away / starter context
  * a saved splits page  -> career_split rows (Location / Month / vs. Conf /
                            vs. Team / Game Result / Role ...). SR gates the
                            splits URL behind a Cloudflare human check, so these
                            HTML files are dropped into cache/{slug}/ by hand
                            (see README) rather than fetched.
"""

from __future__ import annotations

from bs4 import BeautifulSoup

from .extractor import extract_tables
from .models import Fact

# SR data-stat key -> the label we store on the Fact
COUNTING_STATS = {
    "pts": "PTS",
    "trb": "TRB",
    "orb": "ORB",
    "drb": "DRB",
    "ast": "AST",
    "stl": "STL",
    "blk": "BLK",
    "tov": "TOV",
    "pf": "PF",
    "fg": "FG",
    "fga": "FGA",
    "fg3": "3P",
    "fg3a": "3PA",
    "fg2": "2P",
    "fg2a": "2PA",
    "ft": "FT",
    "fta": "FTA",
}

# label -> (percentage data-stat, attempts data-stat)
PCT_STATS = {
    "FG%": ("fg_pct", "fga"),
    "3P%": ("fg3_pct", "fg3a"),
    "2P%": ("fg2_pct", "fg2a"),
    "FT%": ("ft_pct", "fta"),
    "eFG%": ("efg_pct", "fga"),
}


def _int(value: str | None) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value.replace(",", ""))
    except ValueError:
        return None


def _pct(value: str | None) -> float | None:
    """'.432' -> 43.2 (a percentage in 0-100 space)."""
    if value is None or value == "":
        return None
    try:
        return round(float(value) * 100, 1)
    except ValueError:
        return None


def season_label(end_year: int | str) -> str:
    end = int(end_year)
    return f"{end - 1}-{str(end)[-2:]}"


def player_name_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    return h1.get_text(strip=True) if h1 else ""


# -- overview ------------------------------------------------------------------


def normalize_overview(html: str, player_slug: str, player_name: str | None = None) -> list[Fact]:
    player_name = player_name or player_name_from_html(html)
    tables = extract_tables(html)
    totals = tables.get("players_totals")
    if totals is None:
        return []

    facts: list[Fact] = []
    for row in totals.rows:
        year = row.get("year_id", "")
        is_career = year.lower().startswith("career") or year == ""
        season = None if is_career else year
        stat_type = "career_total" if is_career else "season_total"
        source = "overview"
        klass = row.get("class") or None

        for key, label in COUNTING_STATS.items():
            val = _int(row.get(key))
            if val is None:
                continue
            facts.append(
                Fact(
                    stat_name=label,
                    stat_value=val,
                    stat_type=stat_type,
                    scope="player",
                    source=source,
                    player=player_name,
                    player_slug=player_slug,
                    season=season,
                    context={"class_year": klass},
                )
            )

        for label, (pct_key, att_key) in PCT_STATS.items():
            pct = _pct(row.get(pct_key))
            attempts = _int(row.get(att_key))
            if pct is None:
                continue
            facts.append(
                Fact(
                    stat_name=label,
                    stat_value=pct,
                    stat_type="window_pct",
                    scope="player",
                    source=source,
                    player=player_name,
                    player_slug=player_slug,
                    season=season,
                    context={"class_year": klass, "window": "career" if is_career else "season"},
                    sample_size=attempts,
                )
            )

    return facts


# -- game log ----------------------------------------------------------------


# -- splits (hand-saved HTML) ------------------------------------------------

# SR split-group label -> our split_category prefix
SPLIT_CATEGORY_MAP = {
    "Location": "location",
    "Month": "month",
    "Day": "day",
    "Game Type": "game_type",
    "vs. Conf": "vs_conf",
    "Conference": "conference",
    "Game Result": "result",
    "vs. Team": "vs_team",
    "Overtimes": "overtimes",
    "Role": "role",
}


def normalize_splits(
    html: str, player_slug: str, season: str | None = None,
    player_name: str | None = None, min_games: int = 1,
) -> list[Fact]:
    """Parse a saved SR splits page. `season=None` == the career splits page.

    `min_games` drops thin split rows (default keep all) -- one-off opponents in
    the vs. Team group mostly.
    """
    player_name = player_name or player_name_from_html(html)
    table = extract_tables(html).get("splits")
    if table is None:
        return []

    facts: list[Fact] = []
    current_group: str | None = None
    for row in table.rows:
        group = row.get("split_id", "").strip() or current_group
        current_group = group
        value = row.get("split_value", "").strip()
        if not group or group == "Total" or not value:
            continue

        n_games = _int(row.get("g"))
        if n_games is not None and n_games < min_games:
            continue

        prefix = SPLIT_CATEGORY_MAP.get(group, group.lower().replace(" ", "_").replace(".", ""))
        split_category = f"{prefix}:{value}"
        base = dict(
            stat_type="career_split", scope="player", source="splits",
            player=player_name, player_slug=player_slug, season=season,
        )

        for key, label in COUNTING_STATS.items():
            val = _int(row.get(key))
            if val is None:
                continue
            facts.append(Fact(
                stat_name=label, stat_value=val,
                context={"split_category": split_category, "n_games": n_games}, **base,
            ))
        for label, (pct_key, att_key) in PCT_STATS.items():
            pct = _pct(row.get(pct_key))
            attempts = _int(row.get(att_key))
            if pct is None:
                continue
            facts.append(Fact(
                stat_name=label, stat_value=pct, sample_size=attempts,
                context={"split_category": split_category, "n_games": n_games}, **base,
            ))

    return facts


def _location(code: str) -> str:
    return {"": "home", "@": "away", "N": "neutral"}.get(code.strip(), code.strip())


def normalize_gamelog(
    html: str, player_slug: str, end_year: int | str, player_name: str | None = None
) -> list[Fact]:
    player_name = player_name or player_name_from_html(html)
    tables = extract_tables(html)
    log = tables.get("player_game_log")
    if log is None:
        return []

    season = season_label(end_year)
    facts: list[Fact] = []
    for row in log.rows:
        date = row.get("date")
        if not date:
            continue  # DNP / skipped row
        opponent = row.get("opp_name_abbr") or None
        result_raw = row.get("game_result", "")  # e.g. "W 88-50"
        context = {
            "result": result_raw[:1] if result_raw[:1] in ("W", "L") else None,
            "score": result_raw[2:] or None,
            "location": _location(row.get("game_location", "")),
            "started": row.get("is_starter") == "*",
            "game_type": row.get("game_type") or None,
            "class_year": None,
        }

        for key, label in COUNTING_STATS.items():
            val = _int(row.get(key))
            if val is None:
                continue
            facts.append(
                Fact(
                    stat_name=label,
                    stat_value=val,
                    stat_type="single_game",
                    scope="player",
                    source="gamelog",
                    player=player_name,
                    player_slug=player_slug,
                    season=season,
                    game_date=date,
                    opponent=opponent,
                    context=context,
                )
            )

    return facts
