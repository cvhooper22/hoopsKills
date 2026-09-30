"""Last-N games for an alum, ranked by Hollinger Game Score.

Nothing here is stored: `recent_games()` is called on demand with a player's
stats-page URL (the `playerUrl` in the alumni data in S3, ``data/alum.json``) and
returns the newest N games, each carrying ``gameScore`` and a ``rank`` (1 = best
of the N). Sources, picked by URL host:

* **eurobasket / asia-basket / usbasket ...** -- reuses `finder.eurobasket`
  (initial page = current season; older seasons only fetched via the AJAX
  endpoint when the current one has fewer than N games).
* **basketball-reference** -- NBA (``/players/x/id.html`` -> ``/gamelog/<season>``)
  and international (``/international/players/slug.html`` -> the per-league
  game-log links on the page). BBR publishes ``game_score`` itself.
* **fiba3x3** -- a World Tour *team* page for an event (see `finder.fiba3x3`): the
  event's schedule, plus each in-window game's boxscore for the player's line. Game
  Score is Hollinger on that line times `gamescore.SCALE_3X3` (3x3 goes to 21).
* **realgm** -- Cloudflare 403s plain HTTP and headless browsers, so the page is
  loaded in a headed Chrome via Playwright (optional dependency; a window
  flashes) and saved to ``<cache>/_recent/realgm/<id>.html``. If that fails, a
  hand-saved copy at that path is used; otherwise the result says which URL to save.

Every fetch is forced fresh (this is an on-demand view, not the durable
scrape cache the rest of the package uses); the fetcher's rate limit applies.
"""

from __future__ import annotations

import re
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from . import eurobasket, fiba3x3
from .fetcher import Fetcher
from .gamescore import game_score, game_score_3x3

DEFAULT_N = 7
DEFAULT_DAYS = 7  # only games from the last week (0/None = no window)

_EUROBASKET_SUFFIXES = ("eurobasket.com", "asia-basket.com", "usbasket.com",
                        "latinbasket.com", "afrobasket.com", "australiabasket.com")
_BBR = "www.basketball-reference.com"


# -- box lines -> output records -----------------------------------------


def _record(box: dict, *, game_score_value: float, home: bool | None = None,
            result: str | None = None) -> dict:
    return {
        "date": box["date"],
        "team": box.get("team"),
        "opp": box.get("opp"),
        "home": home,
        "result": result if result is not None else box.get("score"),
        "competition": box.get("competition"),
        "min": box.get("min"),
        "pts": box["pts"],
        "reb": box["trb"],
        "ast": box["ast"],
        "stl": box["stl"],
        "blk": box["blk"],
        "tov": box["tov"],
        "fg": f'{box["fgm"]}-{box["fga"]}',
        "threes": f'{box["tpm"]}-{box["tpa"]}',
        "ft": f'{box["ftm"]}-{box["fta"]}',
        "gameScore": game_score_value,
    }


def window_start(days: int | None, today: date | None = None) -> str | None:
    """ISO date `days` before today (None/0 = no window)."""
    return (( today or date.today()) - timedelta(days=days)).isoformat() if days else None


def _enough(games: list[dict], n: int, since: str | None) -> bool:
    """Stop paging back through seasons: have `n` games, or reached a game older than the window."""
    return len(games) >= n or bool(since and any(g["date"] < since for g in games))


def rank_games(games: list[dict], n: int = DEFAULT_N, since: str | None = None) -> list[dict]:
    """Newest `n` games on/after `since` (newest first), each given a `rank` by gameScore (1 = best)."""
    if since:
        games = [g for g in games if g["date"] >= since]
    recent = sorted(games, key=lambda g: g["date"], reverse=True)[:n]
    order = sorted(recent, key=lambda g: (-g["gameScore"], -g["pts"], g["date"]))
    for i, g in enumerate(order, 1):
        g["rank"] = i
    return recent


# -- eurobasket family --------------------------------------------------


def _eurobasket_games(fetcher: Fetcher, url: str, n: int, since: str | None) -> list[dict]:
    html = fetcher.fetch(url, eurobasket.cache_key_for_url(url).replace("_eurobasket/", "_recent/"), force=True)
    _name, slug, player_id = eurobasket.player_identity(html, url)
    boxes = eurobasket.game_log(html)

    if not _enough(boxes, n, since) and player_id:
        covered = eurobasket.season_end_years(html)
        parsed = urlparse(url)
        endpoint = f"{parsed.scheme}://{parsed.netloc}{eurobasket.SEASON_AJAX_PATH}"
        for year in sorted(eurobasket._season_years(html), reverse=True):
            if _enough(boxes, n, since):
                break
            if int(year) in covered:
                continue
            frag = fetcher.fetch_post(endpoint, f"_recent/{slug}-{year}.json",
                                      {"PlayerId": player_id, "Season": year}, force=True)
            boxes += eurobasket.game_log(eurobasket._unwrap_fragment(frag))
    return [_record(b, game_score_value=game_score(b)) for b in boxes]


# -- basketball-reference -----------------------------------------------


def _bbr_soup(html: str) -> BeautifulSoup:
    # BBR ships most tables inside HTML comments.
    return BeautifulSoup(re.sub(r"<!--|-->", "", html), "html.parser")


def _bbr_num(row: dict, key: str) -> int:
    try:
        return int(float(row.get(key) or 0))
    except ValueError:
        return 0


def _bbr_games(soup: BeautifulSoup, table_ids: tuple[str, ...], competition: str | None) -> list[dict]:
    out: list[dict] = []
    for table_id in table_ids:
        table = soup.find("table", id=table_id)
        if not table or not table.find("tbody"):
            continue
        for tr in table.find("tbody").find_all("tr"):
            if "thead" in tr.get("class", []):
                continue
            row = {c.get("data-stat"): c.get_text(strip=True) for c in tr.find_all(["th", "td"])}
            day = row.get("date") or row.get("date_game")
            if not day or not row.get("pts"):  # DNP / inactive rows have no box line
                continue
            box = {
                "date": day,
                "team": row.get("team_name_abbr") or row.get("team_name") or None,
                "opp": row.get("opp_name_abbr") or row.get("opp_name") or None,
                "competition": competition,
                "min": row.get("mp") or None,
                "pts": _bbr_num(row, "pts"),
                "fgm": _bbr_num(row, "fg"), "fga": _bbr_num(row, "fga"),
                "tpm": _bbr_num(row, "fg3"), "tpa": _bbr_num(row, "fg3a"),
                "ftm": _bbr_num(row, "ft"), "fta": _bbr_num(row, "fta"),
                "orb": _bbr_num(row, "orb"), "drb": _bbr_num(row, "drb"), "trb": _bbr_num(row, "trb"),
                "ast": _bbr_num(row, "ast"), "stl": _bbr_num(row, "stl"),
                "blk": _bbr_num(row, "blk"), "tov": _bbr_num(row, "tov"), "pf": _bbr_num(row, "pf"),
            }
            try:
                gmsc = float(row["game_score"])
            except (KeyError, ValueError):
                gmsc = game_score(box)
            home = (row["game_location"].strip() != "@") if "game_location" in row else None
            out.append(_record(box, game_score_value=gmsc, home=home, result=row.get("game_result") or None))
    return out


def _current_season_end_year(today: date | None = None) -> int:
    today = today or date.today()
    return today.year + (1 if today.month >= 9 else 0)


def _get(fetcher: Fetcher, url: str, key: str) -> str | None:
    try:
        return fetcher.fetch(url, key, force=True)
    except requests.HTTPError:
        return None


def _bbr_nba_games(fetcher: Fetcher, path: str, n: int, since: str | None) -> list[dict]:
    m = re.match(r"/players/(\w)/(\w+)\.html$", path)
    if not m:
        return []
    letter, pid = m.groups()
    games: list[dict] = []
    year = _current_season_end_year()
    for y in (year, year - 1, year - 2):
        if _enough(games, n, since):
            break
        html = _get(fetcher, f"https://{_BBR}/players/{letter}/{pid}/gamelog/{y}",
                    f"_recent/bbr-{pid}-{y}.html")
        if html:
            games += _bbr_games(_bbr_soup(html), ("player_game_log_reg", "player_game_log_post"), "NBA")
    return games


def _bbr_international_games(fetcher: Fetcher, path: str, n: int, since: str | None) -> list[dict]:
    slug = path.rsplit("/", 1)[-1].removesuffix(".html")
    page = _get(fetcher, f"https://{_BBR}{path}", f"_recent/bbr-intl-{slug}.html")
    if not page:
        return []
    links = {a["href"] for a in _bbr_soup(page).find_all("a", href=True)
             if re.search(rf"/international/players/{re.escape(slug)}/gamelog/\d{{4}}/", a["href"])}
    games: list[dict] = []
    for href in sorted(links, key=lambda h: re.search(r"/gamelog/(\d{4})/", h).group(1), reverse=True):
        if _enough(games, n, since):
            break
        year, league = re.search(r"/gamelog/(\d{4})/([^/]*)", href).groups()
        html = _get(fetcher, f"https://{_BBR}{href}", f"_recent/bbr-intl-{slug}-{year}-{league}.html")
        if html:
            games += _bbr_games(_bbr_soup(html), ("pgl_basic", "pgl_basic_playoffs"), league or None)
    return games


# -- fiba 3x3 (team page -> boxscores) ------------------------------------


def _score_fiba_games(games: list[dict], fetcher: Fetcher, player_name: str | None) -> tuple[list[dict], str]:
    """Fetch each game's boxscore, attach the player's line and scaled Game Score,
    and rank the scored games (1 = best). Returns (games, message)."""
    missing: list[str] = []
    for i, g in enumerate(games):
        g.update(gameScore=None, gameScoreRaw=None, gameScoreScale=None, rank=None)
        if not player_name:
            continue
        if i:
            time.sleep(fetcher.min_interval)
        try:
            box = fiba3x3.parse_boxscore(fiba3x3.fetch_page(g["url"]), player_name)
        except requests.RequestException:
            box = None
        if not box:
            missing.append(f'{g["date"]} vs {g["opp"]}')
            continue
        gs = game_score_3x3(box)
        g.update(
            gameScore=gs["scaled"], gameScoreRaw=gs["raw"], gameScoreScale=gs["scale"],
            pts=box["pts"], reb=box["trb"], ast=box["ast"], blk=box["blk"], tov=box["tov"],
            fg=f'{box["fgm"]}-{box["fga"]}', threes=f'{box["tpm"]}-{box["tpa"]}', ft=f'{box["ftm"]}-{box["fta"]}',
            drives=box["drives"], dunks=box["dunks"], pval=box["pval"],
        )
    scored = sorted((g for g in games if g["gameScore"] is not None),
                    key=lambda g: (-g["gameScore"], -g["pts"], g["date"]))
    for i, g in enumerate(scored, 1):
        g["rank"] = i
    return games, (f"no boxscore line found for {', '.join(missing)}" if missing else "")


# -- realgm (saved page only) -------------------------------------------


def _realgm_ids(url: str) -> tuple[str, str] | None:
    m = re.search(r"/player/([^/]+)/(?:[^/]+/)?(\d+)", urlparse(url).path)
    return (m.group(1), m.group(2)) if m else None


def realgm_gamelog_url(url: str) -> str | None:
    ids = _realgm_ids(url)
    return f"https://basketball.realgm.com/player/{ids[0]}/GameLogs/{ids[1]}" if ids else None


def realgm_saved_path(cache_root: Path, url: str) -> Path | None:
    ids = _realgm_ids(url)
    return Path(cache_root) / "_recent" / "realgm" / f"{ids[1]}.html" if ids else None


def fetch_realgm_html(url: str, n: int = DEFAULT_N, since: str | None = None, timeout_ms: int = 30000) -> str | None:
    """All-leagues Game Logs pages via headed Chrome, newest season first, going
    back a season at a time until `n` games; concatenated. None if
    Playwright/Chrome is unavailable or the Cloudflare challenge isn't passed."""
    try:
        from playwright.sync_api import Error as PlaywrightError, sync_playwright
    except ImportError:
        return None
    ids = _realgm_ids(url)
    base = f"https://basketball.realgm.com/player/{ids[0]}/GameLogs/{ids[1]}/All"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False,
                                        args=["--disable-blink-features=AutomationControlled"])
            try:
                page = browser.new_page()
                pages, games, seasons = [], [], [None]
                while seasons and not _enough(games, n, since) and len(pages) < 4:
                    season = seasons.pop(0)
                    page.goto(f"{base}/{season}" if season else base, wait_until="domcontentloaded")
                    page.wait_for_selector("table thead th", timeout=timeout_ms)
                    html = page.content()
                    pages.append(html)
                    games += parse_realgm_gamelog(html)
                    if season is None:  # the season dropdown lists every year, newest first
                        seasons = re.findall(rf"/GameLogs/{ids[1]}/All/(\d{{4}})\"", html)
                        seasons = [y for y in dict.fromkeys(seasons)][1:]
                return "\n".join(pages)
            finally:
                browser.close()
    except PlaywrightError:
        return None


def _to_int(cell: str) -> int:
    try:
        return int(float(cell))
    except ValueError:
        return 0


def parse_realgm_gamelog(html: str) -> list[dict]:
    """RealGM's Game Logs table -> records. RealGM shows FIC, not Game Score, so
    it is computed from the box line."""
    soup = BeautifulSoup(html, "html.parser")
    out: list[dict] = []
    for table in soup.find_all("table"):
        head = table.find("thead")
        headers = [th.get_text(strip=True) for th in head.find_all("th")] if head else []
        if not {"Date", "Opponent", "PTS", "FGA"} <= set(headers):
            continue
        for tr in table.find("tbody").find_all("tr"):
            row = dict(zip(headers, (td.get_text(strip=True) for td in tr.find_all("td"))))
            m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})$", row.get("Date", ""))
            if not m or not row.get("MIN"):  # DNP rows have no minutes
                continue
            mm, dd, yyyy = m.groups()
            box = {
                "date": f"{yyyy}-{int(mm):02d}-{int(dd):02d}",
                "team": row.get("Team") or None, "opp": row.get("Opponent") or None,
                "competition": None, "min": row["MIN"],
                "pts": _to_int(row.get("PTS", "")),
                "fgm": _to_int(row.get("FGM", "")), "fga": _to_int(row.get("FGA", "")),
                "tpm": _to_int(row.get("3PM", "")), "tpa": _to_int(row.get("3PA", "")),
                "ftm": _to_int(row.get("FTM", "")), "fta": _to_int(row.get("FTA", "")),
                "orb": _to_int(row.get("ORB", "")), "drb": _to_int(row.get("DRB", "")),
                "trb": _to_int(row.get("REB", "")),
                "ast": _to_int(row.get("AST", "")), "stl": _to_int(row.get("STL", "")),
                "blk": _to_int(row.get("BLK", "")), "tov": _to_int(row.get("TOV", "")),
                "pf": _to_int(row.get("PF", "")),
            }
            out.append(_record(box, game_score_value=game_score(box), result=row.get("W/L") or None))
    return out


# -- dispatch ----------------------------------------------------------


def recent_games(url: str, fetcher: Fetcher | None = None, n: int = DEFAULT_N, days: int | None = DEFAULT_DAYS,
                 player_name: str | None = None) -> dict:
    """{source, status, message, games} for one stats-page URL.

    status: "ok" | "no-games" | "needs-saved-page" | "unsupported" | "error".
    """
    host = (urlparse(url).hostname or "").lower()
    path = urlparse(url).path
    fetcher = fetcher or Fetcher()
    since = window_start(days)

    def done(source: str, games: list[dict], message: str = "") -> dict:
        ranked = rank_games(games, n, since)
        return {"source": source, "status": "ok" if ranked else "no-games",
                "message": message or ("" if ranked else (f"no games since {since}" if since else "no games found")),
                "games": ranked}

    try:
        if host.endswith(_EUROBASKET_SUFFIXES):
            return done("eurobasket", _eurobasket_games(fetcher, url, n, since))
        if host == "basketball-reference.com" or host.endswith(".basketball-reference.com"):
            if path.startswith("/international/players/"):
                return done("basketball-reference", _bbr_international_games(fetcher, path, n, since))
            return done("basketball-reference", _bbr_nba_games(fetcher, path, n, since))
        if fiba3x3.is_team_page(url):
            games = [g for g in fiba3x3.parse_team_page(fiba3x3.fetch_team_page(url), url)
                     if not since or g["date"] >= since][:n]
            games, message = _score_fiba_games(games, fetcher, player_name)
            return {"source": "fiba3x3", "kind": "schedule", "games": games,
                    "status": "ok" if games else "no-games",
                    "message": message or ("" if games else (f"no games since {since}" if since else "no games found"))}
        if host.endswith("realgm.com"):
            saved = realgm_saved_path(fetcher.cache_root, url)
            if saved is None:
                return {"source": "realgm", "status": "error", "message": "unrecognised RealGM URL", "games": []}
            live = fetch_realgm_html(url, n, since)
            if live:
                saved.parent.mkdir(parents=True, exist_ok=True)
                saved.write_text(live, encoding="utf-8")
            if not saved.exists():
                return {"source": "realgm", "status": "needs-saved-page", "games": [],
                        "message": f"RealGM blocks scripts. Open {realgm_gamelog_url(url)} in a browser, "
                                   f"pick the league/season, save the page as {saved}"}
            return done("realgm", parse_realgm_gamelog(saved.read_text(encoding="utf-8")))
    except (requests.RequestException, ValueError) as exc:
        return {"source": host, "status": "error", "message": str(exc), "games": []}
    return {"source": host or "none", "status": "unsupported",
            "message": f"no game-log parser for {host or 'missing url'}", "games": []}
