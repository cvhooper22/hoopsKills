"""FIBA 3x3 World Tour team page -> that team's games at one event.

The player page (``play.fiba3x3.com``) is an app with no server-rendered stats, but
the World Tour *team* page for an event
(``https://worldtour.fiba3x3.com/2026/deqing/teams/<uuid>``) is server-rendered with
a Schedule table: one table per day (first header cell = the date), one row per
game -- time, this team then its opponent, their scores, round, and a link to the
game's boxscore. There are no per-player lines here, so these games carry no Game
Score; each links to its boxscore instead.

Each game's boxscore (``/games/<uuid>``) does carry per-player lines --
PTS, 1PT/2PT/FT makes-attempts, OREB/DREB, KAS (assists), BS (blocks), TO -- but
no steals, personal fouls or minutes. `parse_boxscore` turns the player's row into
the same box dict Game Score is computed from.

Blocks non-browser user agents (CloudFront 403), so `fetch_page` sends a
browser UA.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

_BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
               "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def is_team_page(url: str) -> bool:
    return bool(re.search(r"^https?://worldtour\.fiba3x3\.com/\d{4}/[^/]+/teams/[0-9a-f-]{36}", url))


def fetch_page(url: str) -> str:
    resp = requests.get(url, headers={"User-Agent": _BROWSER_UA}, timeout=30)
    resp.raise_for_status()
    return resp.text


def _iso(day: str) -> str | None:
    try:
        return datetime.strptime(day.strip(), "%b %d, %Y").date().isoformat()
    except ValueError:
        return None


def _clock(t: str) -> str:
    try:
        return datetime.strptime(t.strip(), "%I:%M %p").strftime("%H:%M")
    except ValueError:
        return ""


def parse_team_page(html: str, url: str) -> list[dict]:
    """Games newest first. Each: date, time, team, opp, teamScore, oppScore,
    result ("W 21-18"), round, competition (event), url (boxscore)."""
    soup = BeautifulSoup(html, "html.parser")
    event = (soup.title.string or "").split("|")[-1].strip() if soup.title and soup.title.string else None
    out: list[dict] = []
    day = None
    # One table holds every day: a date header row, a column header row, then that day's games.
    for row in soup.select("tr"):
        ths, cells = row.find_all("th"), row.find_all("td")
        if len(ths) == 1 and not cells and _iso(ths[0].get_text(strip=True)):
            day = _iso(ths[0].get_text(strip=True))
            continue
        if "ScheduleResultsGameRow" not in row.get("class", []):
            continue
        game_link = row.find("a", href=re.compile(r"/games/[0-9a-f-]{36}"))
        if not (day and game_link and len(cells) >= 3):
            continue
        names = [a.get_text(" ", strip=True) for a in cells[0].find_all("a")]
        scores = [d.get_text(strip=True) for d in cells[1].select("div.pb1, div.pt1")]
        if len(names) < 2 or len(scores) < 2 or not (scores[0].isdigit() and scores[1].isdigit()):
            continue  # not played yet
        mine, theirs = int(scores[0]), int(scores[1])
        out.append({
            "date": day,
            "time": ths[0].get_text(strip=True),
            "team": names[0], "opp": names[1],
            "teamScore": mine, "oppScore": theirs,
            "result": f'{"W" if mine > theirs else "L"} {mine}-{theirs}',
            "round": cells[2].get_text(" ", strip=True) or None,
            "competition": event,
            "url": urljoin(url, game_link["href"]),
        })
    out.sort(key=lambda g: (g["date"], _clock(g["time"])), reverse=True)
    return out


fetch_team_page = fetch_page  # the team page and boxscore pages are fetched the same way


def _norm_name(name: str) -> str:
    folded = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z ]", "", folded.lower()).strip()


def _made_att(cell: str) -> tuple[int, int]:
    m = re.match(r"\s*(\d+)\s*/\s*(\d+)\s*$", cell or "")
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)


def _num(cell: str) -> float:
    try:
        return float(cell)
    except (TypeError, ValueError):
        return 0.0


def parse_boxscore(html: str, player_name: str) -> dict | None:
    """The named player's line from a game boxscore, as the box dict Game Score
    takes, or None if they aren't in it.

    Mapping: 1PT (inside) + 2PT (arc) makes/attempts -> FG; 2PT -> 3P; KAS ->
    AST; BS -> BLK. STL and PF aren't published, so they are 0. Also carries
    `drives`, `dunks` and FIBA's own `pval` for reference.
    """
    soup = BeautifulSoup(html, "html.parser")
    want = _norm_name(player_name)
    rows: list[dict] = []
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True) for th in table.find_all("th")]
        if "Name" not in headers or "1PT" not in headers:
            continue
        for tr in table.find_all("tr"):
            cells = [td.get_text(strip=True) for td in tr.find_all("td")]
            if len(cells) == len(headers):
                rows.append(dict(zip(headers, cells)))

    match = [r for r in rows if _norm_name(r["Name"]) == want]
    if not match:  # fall back to a unique last-name hit ("J. Fredette" style names)
        last = want.split()[-1] if want else ""
        match = [r for r in rows if last and _norm_name(r["Name"]).split()[-1:] == [last]]
    if len(match) != 1:
        return None
    r = match[0]

    one_m, one_a = _made_att(r["1PT"])
    two_m, two_a = _made_att(r["2PT"])
    ft_m, ft_a = _made_att(r["FT"])
    orb, drb = int(_num(r.get("OREB"))), int(_num(r.get("DREB")))
    return {
        "pts": int(_num(r["PTS"])),
        "fgm": one_m + two_m, "fga": one_a + two_a,
        "tpm": two_m, "tpa": two_a,
        "ftm": ft_m, "fta": ft_a,
        "orb": orb, "drb": drb, "trb": orb + drb,
        "ast": int(_num(r.get("KAS"))), "stl": 0,
        "blk": int(_num(r.get("BS"))), "tov": int(_num(r.get("TO"))), "pf": 0,
        "drives": int(_num(r.get("DRV"))), "dunks": int(_num(r.get("DNK"))),
        "pval": _num(r.get("P-VAL")),
        "name": r["Name"],
    }
