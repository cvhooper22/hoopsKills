"""ESPN player game logs, from ESPN's JSON API (no browser, no HTML).

The gamelog page (``espn.com/nba/player/gamelog/_/id/<id>/...``) is rendered from
``site.web.api.espn.com/apis/common/v3/sports/basketball/<league>/athletes/<id>/gamelog``,
which lists every game of a season (preseason, regular season, playoffs) with the box
line and the game's date / opponent / result. The gamelog only has total rebounds, so
each game kept for scoring also pulls the game's summary to get that player's OREB /
DREB split -- Hollinger's Game Score weighs them differently.

URL forms: ``/nba/player/gamelog/_/id/5175643/type/nba/year/2027`` (year = the season's
end year, so 2027 is 2026-27) or ``/nba/player/gamelog/_/id/5142718/aj-dybantsa`` (the
current season). The league comes from the first path segment (``nba`` or
``mens-college-basketball``).
"""

from __future__ import annotations

import re
import time
from datetime import datetime
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests

from .fetcher import Fetcher

API = "https://site.web.api.espn.com/apis"
_PATH = re.compile(r"^/(?P<league>[\w-]+)/player/gamelog/_/id/(?P<id>\d+)")
_LEAGUE_NAMES = {"nba": "NBA", "mens-college-basketball": "NCAA"}
_EASTERN = ZoneInfo("America/New_York")
SUMMARY_PAUSE = 0.4  # seconds between the per-game summary requests


def is_gamelog_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return (host == "espn.com" or host.endswith(".espn.com")) and bool(_PATH.match(parsed.path))


def parse_url(url: str) -> tuple[str, str, int | None]:
    """(league, athlete id, season end year or None for the current season)."""
    path = urlparse(url).path
    m = _PATH.match(path)
    if not m:
        raise ValueError(f"not an ESPN game log URL: {url}")
    year = re.search(r"/year/(\d{4})", path)
    return m["league"], m["id"], int(year[1]) if year else None


def _made_att(value: str | None) -> tuple[int, int]:
    m = re.match(r"^(\d+)-(\d+)$", (value or "").strip())
    return (int(m[1]), int(m[2])) if m else (0, 0)


def _int(value: str | None) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _eastern_date(iso: str) -> str:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(_EASTERN).date().isoformat()


def parse_gamelog(data: dict, league: str = "nba") -> list[dict]:
    """Every game the player appeared in -> a box dict (rebounds not yet split; ``eventId`` set).

    ``competition`` is e.g. "NBA Preseason" (the league plus the season-type name ESPN gives
    the group). Games the player didn't play have no minutes and are skipped.
    """
    labels = data.get("labels") or []
    events = data.get("events") or {}
    league_name = _LEAGUE_NAMES.get(league, league)
    out: list[dict] = []
    for season_type in data.get("seasonTypes") or []:
        for category in season_type.get("categories") or []:
            for row in category.get("events") or []:
                event = events.get(str(row.get("eventId")))
                stats = dict(zip(labels, row.get("stats") or []))
                if not event or _int(stats.get("MIN")) <= 0:
                    continue
                fgm, fga = _made_att(stats.get("FG"))
                tpm, tpa = _made_att(stats.get("3PT"))
                ftm, fta = _made_att(stats.get("FT"))
                home = event.get("atVs") != "@"
                mine = event.get("homeTeamScore" if home else "awayTeamScore")
                theirs = event.get("awayTeamScore" if home else "homeTeamScore")
                result = event.get("gameResult") or ""
                suffix = re.sub(r"^\d+-\d+\s*", "", event.get("score") or "")  # "OT", "2OT"
                out.append({
                    "eventId": str(event["id"]),
                    "date": _eastern_date(event["gameDate"]),
                    "team": (event.get("team") or {}).get("abbreviation"),
                    "opp": (event.get("opponent") or {}).get("abbreviation"),
                    "home": home,
                    "score": " ".join(p for p in (result, f"{mine}-{theirs}" if mine and theirs else "", suffix) if p),
                    "competition": " ".join(p for p in (
                        league_name, re.sub(r"^\d{4}-\d{2}\s*", "", season_type.get("displayName") or "")) if p),
                    "min": str(_int(stats.get("MIN"))),
                    "pts": _int(stats.get("PTS")),
                    "fgm": fgm, "fga": fga, "tpm": tpm, "tpa": tpa, "ftm": ftm, "fta": fta,
                    "trb": _int(stats.get("REB")), "orb": 0, "drb": _int(stats.get("REB")),
                    "ast": _int(stats.get("AST")), "stl": _int(stats.get("STL")),
                    "blk": _int(stats.get("BLK")), "tov": _int(stats.get("TO")), "pf": _int(stats.get("PF")),
                })
    return out


def rebound_split(summary: dict, athlete_id: str) -> tuple[int, int] | None:
    """(OREB, DREB) for the athlete from a game summary's boxscore, or None if not listed."""
    for team in (summary.get("boxscore") or {}).get("players") or []:
        for group in team.get("statistics") or []:
            labels = group.get("labels") or []
            if "OREB" not in labels or "DREB" not in labels:
                continue
            for a in group.get("athletes") or []:
                if str((a.get("athlete") or {}).get("id")) == str(athlete_id) and a.get("stats"):
                    stats = dict(zip(labels, a["stats"]))
                    return _int(stats.get("OREB")), _int(stats.get("DREB"))
    return None


def _get_json(fetcher: Fetcher, url: str) -> dict:
    resp = fetcher.session.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def game_log(fetcher: Fetcher, url: str, n: int, since: str | None) -> tuple[list[dict], str]:
    """(box dicts for the newest `n` games on/after `since`, message). Each has the real OREB/DREB;
    if a game's summary can't be read its rebounds count as defensive and the message says so."""
    league, athlete_id, year = parse_url(url)
    gamelog_url = f"{API}/common/v3/sports/basketball/{league}/athletes/{athlete_id}/gamelog"
    data = _get_json(fetcher, f"{gamelog_url}?season={year}" if year else gamelog_url)
    boxes = parse_gamelog(data, league)
    if since:
        boxes = [b for b in boxes if b["date"] >= since]
    boxes = sorted(boxes, key=lambda b: b["date"], reverse=True)[:n]

    unsplit: list[str] = []
    for i, box in enumerate(boxes):
        if i:
            time.sleep(SUMMARY_PAUSE)
        split = None
        try:
            summary = _get_json(fetcher, f"{API}/site/v2/sports/basketball/{league}/summary?event={box['eventId']}")
            split = rebound_split(summary, athlete_id)
        except (requests.RequestException, ValueError):
            pass
        if split:
            box["orb"], box["drb"] = split
        else:
            unsplit.append(f"{box['date']} vs {box['opp']}")
    message = f"no OREB/DREB split for {', '.join(unsplit)}; counted rebounds as defensive" if unsplit else ""
    return boxes, message
