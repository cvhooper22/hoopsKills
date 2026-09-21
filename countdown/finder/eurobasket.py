"""Eurobasket.com / USBasket.com player scraper -> Fact records.

A second source for players who have no Sports-Reference college page -- overseas
pros, national-team youth events (Eurobasket U20, etc.). The page shape is the
one saved in ``countdown/buikaEurobasket.html``: a ``#divStatsData`` block with,
per season, a "Summary"/"AVERAGES" table (season totals + per-game) and a
"Details" table (the game log).

What we emit (all ``source="eurobasket"``):

* ``season_total``  -- one row per season *per competition*, summed across any
  clubs the player suited up for that season. The competition is folded into the
  ``season`` label (``"2025-26 (Lithuania-LKL)"``) because the Fact identity has
  no competition field and two leagues can share a year.
* ``career_total``  -- summed across every season block on the page. Labelled in
  ``context`` as covering only eurobasket-tracked competitions.
* ``window_pct``    -- FG% / 2P% / 3P% / FT% / eFG% for each season and career,
  recomputed from the summed makes/attempts, ``sample_size`` = attempts.
* ``single_game``   -- one row per stat per game in the Details tables, with the
  opponent and date.

The initial page only carries the most recent season; ``fetch_player_html``
also pulls every past season the page lists, one call each to eurobasket's
``PlayerStatsAjax`` endpoint, and concatenates them (``parse_player`` de-dupes
the overlap). ``eurobasket_refresh.py --html`` still takes a hand-saved page or
fragment if the site starts gating.

Public API::

    fetch_player_html(fetcher, url, force=False)   -> str   (all seasons)
    parse_player(html, url, slug=None, name=None)  -> list[Fact]
    player_identity(html, url)                     -> (name, slug, player_id)
    cache_key_for_url(url)                         -> "_eurobasket/<key>.html"
"""

from __future__ import annotations

import json
import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .models import Fact

SOURCE = "eurobasket"

# Per-season stats endpoint the page calls via loadStatsData(id, year); the
# initial HTML only carries the most recent season.
SEASON_AJAX_PATH = "/PlayerDetailsAjax.aspx/PlayerStatsAjax"

# Details/Summary column header -> plain counting stat_name. Deliberately the
# same vocabulary the Sports-Reference path emits, so eurobasket facts rank and
# draft interchangeably with SR ones. MIN (minutes) and RNK (eurobasket's
# efficiency index) are skipped -- a per-game minutes fact exists for nearly
# every number and just crowds the shortlist, same reason the SR game-log
# normalizer omits it.
_COUNTING = {
    "PTS": "PTS",
    "RO": "ORB",
    "RD": "DRB",
    "RT": "TRB",
    "AS": "AST",
    "PF": "PF",
    "BS": "BLK",
    "ST": "STL",
    "TO": "TOV",
}
# header -> (made stat_name, attempt stat_name); cell looks like "5-10".
_PAIRS = {
    "2FGP": ("2P", "2PA"),
    "3FGP": ("3P", "3PA"),
    "FT": ("FT", "FTA"),
}
# made/attempt totals -> percentage stat_name.
_PCTS = {
    "FG%": ("FG", "FGA"),
    "2P%": ("2P", "2PA"),
    "3P%": ("3P", "3PA"),
    "FT%": ("FT", "FTA"),
}


# -- small parsers ----------------------------------------------------------


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _iso_date(mdy: str) -> str | None:
    """'7/11/2026' -> '2026-07-11'."""
    m = re.match(r"\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$", mdy or "")
    if not m:
        return None
    mm, dd, yyyy = m.groups()
    return f"{yyyy}-{int(mm):02d}-{int(dd):02d}"


def _year_label(raw: str) -> str:
    """'2025-2026' -> '2025-26'; '2026' -> '2026'."""
    raw = raw.strip()
    m = re.match(r"(\d{4})-(\d{4})$", raw)
    if m:
        return f"{m.group(1)}-{m.group(2)[2:]}"
    return raw


def _made_att(cell: str) -> tuple[int | None, int | None]:
    m = re.match(r"\s*(\d+)\s*-\s*(\d+)\s*$", cell or "")
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2))


def _int(cell: str) -> int | None:
    try:
        return int(round(float(str(cell).replace(",", "").strip())))
    except (TypeError, ValueError):
        return None


def _clean(td) -> str:
    return td.get_text(" ", strip=True)


# -- player identity ------------------------------------------------------


def player_identity(html: str, url: str) -> tuple[str, str, str | None]:
    soup = BeautifulSoup(html, "html.parser")

    name = ""
    if soup.title and soup.title.string:
        # "Dovydas Buika, Basketball Player, News, Stats - Eurobasket"
        name = re.split(r",| - ", soup.title.string.strip())[0].strip()
    if not name:
        h1 = soup.find("h1")
        if h1:
            name = re.sub(r"\s*basketball player profile\s*$", "", _clean(h1), flags=re.I).title()

    m = re.search(r"strPlayerID\s*=\s*['\"](\d+)['\"]", html)
    player_id = m.group(1) if m else None
    if player_id is None:
        digits = re.findall(r"/(\d+)(?:/|$)", urlparse(url).path)
        player_id = digits[-1] if digits else None

    slug = _slugify(name) or _url_key(url)
    return name, slug, player_id


def _url_key(url: str) -> str:
    segs = [s for s in urlparse(url).path.split("/") if s]
    return _slugify("-".join(segs[-2:])) or "player"


def cache_key_for_url(url: str) -> str:
    return f"_eurobasket/{_url_key(url)}.html"


# -- fetching (initial page + one AJAX call per past season) -------------


def _season_years(html: str) -> list[str]:
    """The years the page offers via loadStatsData(id, 'YYYY')."""
    return sorted(set(re.findall(r"loadStatsData\('\d+','(\d+)'\)", html)))


def _unwrap_fragment(text: str) -> str:
    """ASP.NET returns {"d": "<html>"}; a hand-saved fragment is already HTML."""
    stripped = text.lstrip()
    if stripped.startswith("{"):
        try:
            return json.loads(text).get("d", "") or ""
        except ValueError:
            pass
    return text


def fetch_player_html(fetcher, url: str, force: bool = False) -> str:
    """Initial profile page + every past season's AJAX fragment, concatenated.

    `parse_player` de-dupes overlapping season blocks, so the join is safe.
    """
    main = fetcher.fetch(url, cache_key_for_url(url), force=force)
    _name, slug, player_id = player_identity(main, url)
    parts = [main]
    if player_id:
        parsed = urlparse(url)
        endpoint = f"{parsed.scheme}://{parsed.netloc}{SEASON_AJAX_PATH}"
        key_base = slug or player_id
        for year in _season_years(main):
            frag = fetcher.fetch_post(
                endpoint, f"_eurobasket/{key_base}-{year}.json",
                {"PlayerId": player_id, "Season": year}, force=force,
            )
            parts.append(_unwrap_fragment(frag))
    return "\n".join(parts)


# -- season block walk --------------------------------------------------


def _season_tables(soup: BeautifulSoup):
    """Yield (year_label, competition, title, <table>) for each stats block.

    `title` is "Summary" (season/career totals + averages) or "Details" (game log).
    Matches both the initial page (``<h4 class="plstats-head">``) and the
    per-season AJAX fragments (a bare ``<h4>``).
    """
    for h4 in soup.find_all("h4"):
        head = _clean(h4)
        if not head.startswith("Season:"):
            continue
        m = re.search(r"Season:\s*([0-9-]+)\s*(?:\(([^)]*)\))?", head)
        if not m:
            continue
        year_label = _year_label(m.group(1))
        competition = (m.group(2) or "").strip()
        div = h4.find_next_sibling("div", class_="dvgamesstats")
        if not div:
            continue
        table = div.find("table")
        if not table:
            continue
        b = table.find("b")
        title = _clean(b) if b else ""
        yield year_label, competition, title, table


def _season_str(year_label: str, competition: str) -> str:
    return f"{year_label} ({competition})" if competition else year_label


def _rows_by_section(table):
    """Walk a Summary table -> {section: (headers, [row_cells, ...])}.

    Sections are "Summary" and "AVERAGES" (their bold sub-headers). A header row
    is the one whose first cell is "Team".
    """
    out: dict[str, tuple[list[str], list[list[str]]]] = {}
    section = None
    headers: list[str] = []
    for tr in table.find_all("tr"):
        classes = tr.get("class", [])
        cells = [_clean(td) for td in tr.find_all("td")]
        if "my_Headers" in classes:
            b = tr.find("b")
            if b and len(tr.find_all("td")) == 1:
                section = _clean(b)
                out.setdefault(section, ([], []))
            elif cells[:1] == ["Team"]:
                headers = cells
                if section is not None:
                    out[section] = (headers, out[section][1])
            continue
        if section and cells:
            out[section][1].append(cells)
    return out


# -- accumulation -------------------------------------------------------


class _Totals:
    """Sum counting stats + made/attempts across a set of Summary rows."""

    def __init__(self) -> None:
        self.count: dict[str, int] = {}
        self.made: dict[str, int] = {}
        self.att: dict[str, int] = {}
        self.games = 0
        self.teams: list[str] = []

    def add_row(self, headers: list[str], cells: list[str]) -> None:
        row = dict(zip(headers, cells))
        team = row.get("Team", "").strip()
        if team:
            self.teams.append(team)
        self.games += _int(row.get("G")) or 0
        for header, name in _COUNTING.items():
            v = _int(row.get(header))
            if v is not None:
                self.count[name] = self.count.get(name, 0) + v
        for header, (made_name, att_name) in _PAIRS.items():
            made, att = _made_att(row.get(header, ""))
            if made is None:
                continue
            self.made[made_name] = self.made.get(made_name, 0) + made
            self.att[att_name] = self.att.get(att_name, 0) + att
        # FG = 2P + 3P
        if "2P" in self.made or "3P" in self.made:
            self.made["FG"] = self.made.get("2P", 0) + self.made.get("3P", 0)
            self.att["FGA"] = self.att.get("2PA", 0) + self.att.get("3PA", 0)

    def counting_items(self):
        """stat_name -> value for every counting + makes/attempts total."""
        merged = dict(self.count)
        merged.update(self.made)
        merged.update(self.att)
        return merged

    def pct_items(self):
        """(pct_name, value, attempts) for each shooting split with attempts > 0."""
        for pct_name, (made_key, att_key) in _PCTS.items():
            att = self.att.get(att_key, 0)
            made = self.made.get(made_key, 0)
            if att > 0:
                yield pct_name, round(made / att * 100, 1), att
        fga = self.att.get("FGA", 0)
        if fga > 0:
            efg = (self.made.get("FG", 0) + 0.5 * self.made.get("3P", 0)) / fga
            yield "eFG%", round(efg * 100, 1), fga


# -- fact builders -----------------------------------------------------


def _total_facts(totals: _Totals, *, name, slug, season, stat_type, context):
    ctx = dict(context, n_games=totals.games)
    facts = [
        Fact(stat_name=n, stat_value=v, stat_type=stat_type, scope="player",
             source=SOURCE, player=name, player_slug=slug, season=season, context=dict(ctx))
        for n, v in sorted(totals.counting_items().items())
    ]
    window = "career" if stat_type == "career_total" else "season"
    for pct_name, value, att in totals.pct_items():
        facts.append(Fact(
            stat_name=pct_name, stat_value=value, stat_type="window_pct", scope="player",
            source=SOURCE, player=name, player_slug=slug, season=season,
            context=dict(ctx, window=window), sample_size=att,
        ))
    return facts


def _game_facts(table, *, name, slug, season, competition):
    headers: list[str] = []
    facts: list[Fact] = []
    for tr in table.find_all("tr"):
        cells = [_clean(td) for td in tr.find_all("td")]
        if "my_Headers" in tr.get("class", []):
            if cells[:1] == ["Date"]:
                headers = cells
            continue
        if not headers or len(cells) < len(headers):
            continue
        row = dict(zip(headers, cells))
        date = _iso_date(row.get("Date", ""))
        if not date:
            continue
        opponent = row.get("Against Team", "").strip() or None
        context = {
            "competition": competition,
            "team": row.get("Team", "").strip() or None,
            "score": row.get("Result", "").strip() or None,
        }

        values: dict[str, int] = {}
        for header, stat in _COUNTING.items():
            v = _int(row.get(header))
            if v is not None:
                values[stat] = v
        for header, (made_name, att_name) in _PAIRS.items():
            made, att = _made_att(row.get(header, ""))
            if made is None:
                continue
            values[made_name] = made
            values[att_name] = att
        if "2P" in values or "3P" in values:
            values["FG"] = values.get("2P", 0) + values.get("3P", 0)
            values["FGA"] = values.get("2PA", 0) + values.get("3PA", 0)

        for stat, value in sorted(values.items()):
            facts.append(Fact(
                stat_name=stat, stat_value=value, stat_type="single_game", scope="player",
                source=SOURCE, player=name, player_slug=slug, season=season,
                game_date=date, opponent=opponent, context=dict(context),
            ))
    return facts


# -- top level --------------------------------------------------------


def parse_player(html: str, url: str, slug: str | None = None,
                 name: str | None = None) -> list[Fact]:
    parsed_name, parsed_slug, player_id = player_identity(html, url)
    name = name or parsed_name
    slug = slug or parsed_slug

    soup = BeautifulSoup(html, "html.parser")
    facts: list[Fact] = []
    career = _Totals()
    seen_summary: set[tuple[str, str]] = set()
    seen_lines: set[tuple] = set()
    competitions: list[str] = []

    for year_label, competition, title, table in _season_tables(soup):
        season = _season_str(year_label, competition)
        if title.lower().startswith("summary"):
            # The initial page and the AJAX fragment for the current season carry
            # the same block -- accumulate each (year, competition) once only.
            if (year_label, competition) in seen_summary:
                continue
            sections = _rows_by_section(table)
            headers, rows = sections.get("Summary", ([], []))
            if not headers or not rows:
                continue
            # Eurobasket repeats an identical stat line under several competition
            # labels for some early youth years (e.g. the same 5 games tagged
            # "Spain-EBA", "ANGT" and "EC U18"). Count a given line once.
            line_key = tuple(tuple(r[1:]) for r in rows)
            if line_key in seen_lines:
                continue
            seen_lines.add(line_key)
            seen_summary.add((year_label, competition))
            if competition:
                competitions.append(competition)
            season_totals = _Totals()
            for cells in rows:
                season_totals.add_row(headers, cells)
                career.add_row(headers, cells)
            facts += _total_facts(
                season_totals, name=name, slug=slug, season=season,
                stat_type="season_total",
                context={"competition": competition, "teams": season_totals.teams},
            )
        elif title.lower().startswith("details"):
            facts += _game_facts(table, name=name, slug=slug, season=season,
                                 competition=competition)

    # Only a genuine multi-season career earns a career_total; a single season is
    # already covered by its season_total and "career" would just mislead.
    if career.games and len(seen_summary) >= 2:
        facts += _total_facts(
            career, name=name, slug=slug, season=None, stat_type="career_total",
            context={
                "competitions": sorted(set(competitions)),
                "detail": "eurobasket-tracked competitions only",
            },
        )

    return facts
