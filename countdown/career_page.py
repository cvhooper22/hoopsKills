#!/usr/bin/env python3
"""Render a single eurobasket player's full career to a standalone HTML page.

The live eurobasket profile only shows the current season; this stitches every
season fragment `eurobasket_refresh.py` cached under `cache/_eurobasket/` into
one page: bio, career totals, a season-by-season table (totals + per-game), and
per-game highs.

    python3 career_page.py --slug jakub-urbaniak --out ../jakub-urbaniak-career.html

Needs the player already fetched (so the fragments are on disk):

    python3 eurobasket_refresh.py --url "<profile url>"
"""

from __future__ import annotations

import argparse
import glob
import html as html_mod
import json
import re
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

from finder.fetcher import CACHE_ROOT

SUMMARY_COLS = ["Team", "G", "MIN", "PTS", "2FGP", "3FGP", "FT",
                "RO", "RD", "RT", "AS", "PF", "BS", "ST", "TO", "RNK"]
DETAIL_COLS = ["Date", "Team", "Against Team", "Result", "MIN", "PTS", "2FGP",
               "3FGP", "FT", "RO", "RD", "RT", "AS", "PF", "BS", "ST", "TO", "RNK"]


def _text(node) -> str:
    return node.get_text(" ", strip=True)


def _made_att(cell: str) -> tuple[int, int]:
    m = re.match(r"\s*(\d+)\s*-\s*(\d+)\s*$", cell or "")
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)


def _int(cell: str) -> int:
    try:
        return int(round(float(str(cell).replace(",", "").strip())))
    except (TypeError, ValueError):
        return 0


def _year_label(raw: str) -> str:
    m = re.match(r"(\d{4})-(\d{4})$", raw.strip())
    return f"{m.group(1)}-{m.group(2)[2:]}" if m else raw.strip()


def _sort_year(raw: str) -> int:
    m = re.match(r"(\d{4})", raw)
    return int(m.group(1)) if m else 0


# -- load the cached fragments ------------------------------------------


def _blobs(slug: str) -> str:
    folder = CACHE_ROOT / "_eurobasket"
    parts: list[str] = []
    for p in sorted(folder.glob(f"{slug}-*.html")):
        parts.append(p.read_text(encoding="utf-8"))
    for p in sorted(folder.glob(f"{slug}-*.json")):
        try:
            parts.append(json.loads(p.read_text(encoding="utf-8")).get("d", ""))
        except ValueError:
            pass
    if not parts:
        raise SystemExit(f"no cached fragments for {slug!r} in {folder} "
                         f"-- run eurobasket_refresh.py first")
    return "\n".join(parts)


def _bio(soup: BeautifulSoup) -> dict:
    out: dict = {"name": "", "blurb": "", "born": "", "height": "", "position": "",
                 "nationality": ""}
    if soup.title and soup.title.string:
        out["name"] = re.split(r",| - ", soup.title.string.strip())[0].strip()
    seo = soup.select_one(".newseotxt")
    if seo:
        text = _text(seo)
        out["blurb"] = text.replace("''", '"').replace("  ", " ")
        m = re.search(r"born on ([A-Z][a-z]+ \d{1,2} \d{4})", text)
        if m:
            out["born"] = m.group(1)
        m = re.search(r"(\d+'\d+)''?\s+([a-z ]+?) who", text)
        if m:
            out["height"], out["position"] = m.group(1) + '"', m.group(2).strip()
        m = re.search(r"is (\w+) basketball player", text)
        if m:
            out["nationality"] = m.group(1)
    return out


def _season_rows(soup: BeautifulSoup) -> list[dict]:
    """One dict per (season, competition) with total + per-game rows, de-duped.

    Eurobasket sometimes repeats an identical stat line under several competition
    labels for the early youth years -- those collapse to one entry here.
    """
    seen_block: set[tuple] = set()
    seen_line: set[tuple] = set()
    seasons: list[dict] = []
    for h4 in soup.find_all("h4"):
        head = _text(h4)
        if not head.startswith("Season:"):
            continue
        m = re.search(r"Season:\s*([0-9-]+)\s*(?:\(([^)]*)\))?", head)
        if not m:
            continue
        raw_year, competition = m.group(1), (m.group(2) or "").strip()
        div = h4.find_next_sibling("div", class_="dvgamesstats")
        if not div or not div.find("table"):
            continue
        table = div.find("table")
        b = table.find("b")
        if not b or not _text(b).lower().startswith("summary"):
            continue
        block_key = (raw_year, competition)
        if block_key in seen_block:
            continue
        seen_block.add(block_key)

        totals: list[list[str]] = []
        pergame: list[list[str]] = []
        for tr in table.find_all("tr"):
            if "my_Headers" in tr.get("class", []):
                continue
            cells = [_text(td) for td in tr.find_all("td")]
            if len(cells) < len(SUMMARY_COLS) or not cells[0] or cells[0] == "Team":
                continue
            (pergame if "%" in cells[4] else totals).append(cells)
        if not totals:
            continue

        line_key = tuple(tuple(r[1:]) for r in totals)  # ignore team name
        if line_key in seen_line:
            continue
        seen_line.add(line_key)

        seasons.append({
            "year": _year_label(raw_year),
            "sort": _sort_year(raw_year),
            "competition": competition,
            "teams": sorted({r[0] for r in totals}),
            "totals": [dict(zip(SUMMARY_COLS, r)) for r in totals],
            "pergame": [dict(zip(SUMMARY_COLS, r)) for r in pergame],
        })
    seasons.sort(key=lambda s: (-s["sort"], s["competition"]))
    return seasons


def _detail_games(soup: BeautifulSoup) -> list[dict]:
    seen_block: set[tuple] = set()
    games: list[dict] = []
    for h4 in soup.find_all("h4"):
        head = _text(h4)
        if not head.startswith("Season:"):
            continue
        m = re.search(r"Season:\s*([0-9-]+)\s*(?:\(([^)]*)\))?", head)
        div = h4.find_next_sibling("div", class_="dvgamesstats")
        if not m or not div or not div.find("table"):
            continue
        table = div.find("table")
        b = table.find("b")
        if not b or _text(b).lower() != "details":
            continue
        key = (m.group(1), (m.group(2) or "").strip())
        if key in seen_block:
            continue
        seen_block.add(key)
        for tr in table.find_all("tr"):
            if "my_Headers" in tr.get("class", []):
                continue
            cells = [_text(td) for td in tr.find_all("td")]
            if len(cells) < len(DETAIL_COLS) or not re.match(r"\d+/\d+/\d+", cells[0]):
                continue
            row = dict(zip(DETAIL_COLS, cells))
            mm, dd, yy = row["Date"].split("/")
            two_m, two_a = _made_att(row["2FGP"])
            three_m, three_a = _made_att(row["3FGP"])
            ft_m, ft_a = _made_att(row["FT"])
            games.append({
                "date": f"{int(yy):04d}-{int(mm):02d}-{int(dd):02d}",
                "season": _year_label(key[0]),
                "sort": _sort_year(key[0]),
                "competition": key[1],
                "team": row["Team"],
                "opp": row["Against Team"],
                "score": row["Result"],
                "MIN": _int(row["MIN"]), "PTS": _int(row["PTS"]),
                "FGM": two_m + three_m, "FGA": two_a + three_a,
                "3PM": three_m, "3PA": three_a,
                "FTM": ft_m, "FTA": ft_a,
                "ORB": _int(row["RO"]), "DRB": _int(row["RD"]), "TRB": _int(row["RT"]),
                "AST": _int(row["AS"]), "STL": _int(row["ST"]), "BLK": _int(row["BS"]),
                "TOV": _int(row["TO"]), "PF": _int(row["PF"]), "RNK": _int(row["RNK"]),
            })
    games.sort(key=lambda g: g["date"])
    return games


# -- aggregate ---------------------------------------------------------


def _career(seasons: list[dict]) -> dict:
    acc = {k: 0 for k in ["G", "MIN", "PTS", "RO", "RD", "RT", "AS", "PF", "BS", "ST", "TO"]}
    shot = {k: [0, 0] for k in ["2FGP", "3FGP", "FT"]}
    for s in seasons:
        for row in s["totals"]:
            for k in acc:
                acc[k] += _int(row[k])
            for k in shot:
                m, a = _made_att(row[k])
                shot[k][0] += m
                shot[k][1] += a
    fg_m = shot["2FGP"][0] + shot["3FGP"][0]
    fg_a = shot["2FGP"][1] + shot["3FGP"][1]
    g = acc["G"] or 1
    return {
        "totals": acc,
        "fg": (fg_m, fg_a),
        "two": tuple(shot["2FGP"]),
        "three": tuple(shot["3FGP"]),
        "ft": tuple(shot["FT"]),
        "seasons": len({s["year"] for s in seasons}),
        "competitions": len({s["competition"] for s in seasons if s["competition"]}),
        "lines": len(seasons),
        "per_game": {
            "PTS": acc["PTS"] / g, "TRB": acc["RT"] / g, "AST": acc["AS"] / g,
            "STL": acc["ST"] / g, "BLK": acc["BS"] / g, "MIN": acc["MIN"] / g,
        },
    }


def _pct(made: int, att: int) -> str:
    return f"{made / att * 100:.1f}%" if att else "—"


def _highs(games: list[dict]) -> list[tuple]:
    out = []
    for stat, label in [("PTS", "Points"), ("TRB", "Rebounds"), ("AST", "Assists"),
                        ("3PM", "Three-pointers"), ("BLK", "Blocks"), ("STL", "Steals")]:
        best = max(games, key=lambda x: x[stat], default=None)
        if best and best[stat] > 0:
            out.append((label, best[stat], best["opp"], best["date"], best["competition"]))
    return out


# -- render ----------------------------------------------------------


def _e(x) -> str:
    return html_mod.escape(str(x))


def _f1(x: float) -> str:
    return f"{x:.1f}"


def render(slug: str, games_file: str) -> str:
    soup = BeautifulSoup(_blobs(slug), "html.parser")
    bio = _bio(soup)
    seasons = _season_rows(soup)
    games = _detail_games(soup)
    car = _career(seasons)
    t = car["totals"]

    tiles = [
        ("Seasons", f"{car['seasons']}", f"{car['competitions']} competitions · {car['lines']} lines"),
        ("Games", f"{t['G']}", f"{_f1(car['per_game']['MIN'])} min/g"),
        ("Points", f"{t['PTS']:,}", f"{_f1(car['per_game']['PTS'])} per game"),
        ("Rebounds", f"{t['RT']:,}", f"{_f1(car['per_game']['TRB'])} per game"),
        ("Assists", f"{t['AS']:,}", f"{_f1(car['per_game']['AST'])} per game"),
        ("FG%", _pct(*car["fg"]), f"{car['fg'][0]}/{car['fg'][1]}"),
        ("3P%", _pct(*car["three"]), f"{car['three'][0]}/{car['three'][1]}"),
        ("FT%", _pct(*car["ft"]), f"{car['ft'][0]}/{car['ft'][1]}"),
    ]
    tile_html = "\n".join(
        f'<div class="tile"><span class="k">{_e(k)}</span>'
        f'<span class="v">{_e(v)}</span><span class="s">{_e(s)}</span></div>'
        for k, v, s in tiles
    )

    def season_table_rows() -> str:
        out = []
        for s in seasons:
            tot = s["totals"][0] if len(s["totals"]) == 1 else _merge_totals(s["totals"])
            pg = s["pergame"][0] if s["pergame"] else _derive_pg(tot)
            two_m, two_a = _made_att(tot["2FGP"])
            three_m, three_a = _made_att(tot["3FGP"])
            ft_m, ft_a = _made_att(tot["FT"])
            fg = _pct(two_m + three_m, two_a + three_a)
            team = " / ".join(s["teams"])
            out.append(
                "<tr>"
                f'<td class="yr">{_e(s["year"])}</td>'
                f'<td class="cmp">{_e(s["competition"])}</td>'
                f'<td class="tm">{_e(team)}</td>'
                f'<td class="n">{_e(tot["G"])}</td>'
                f'<td class="n">{_e(tot["PTS"])}</td>'
                f'<td class="n">{_e(tot["RT"])}</td>'
                f'<td class="n">{_e(tot["AS"])}</td>'
                f'<td class="n">{_e(tot["ST"])}</td>'
                f'<td class="n">{_e(tot["BS"])}</td>'
                f'<td class="n">{_e(f"{two_m + three_m}-{two_a + three_a}")}</td>'
                f'<td class="n">{_e(f"{three_m}-{three_a}")}</td>'
                f'<td class="n">{_e(fg)}</td>'
                f'<td class="n">{_e(_pct(three_m, three_a))}</td>'
                f'<td class="n">{_e(_pct(ft_m, ft_a))}</td>'
                f'<td class="n em">{_e(pg["PTS"])}</td>'
                f'<td class="n em">{_e(pg["RT"])}</td>'
                f'<td class="n em">{_e(pg["AS"])}</td>'
                "</tr>"
            )
        return "\n".join(out)

    highs_html = "\n".join(
        f'<div class="hi"><span class="k">{_e(label)}</span>'
        f'<span class="v">{_e(val)}</span>'
        f'<span class="s">vs {_e(opp)} · {_e(d)}<br>{_e(comp)}</span></div>'
        for label, val, opp, d, comp in _highs(games)
    )

    recent = games[::-1][:15]
    recent_html = "\n".join(
        "<tr>"
        f'<td>{_e(g["date"])}</td><td>{_e(g["competition"])}</td>'
        f'<td>{_e(g["team"])}</td><td>{_e(g["opp"])}</td><td class="n">{_e(g["score"])}</td>'
        f'<td class="n">{_e(g["MIN"])}</td><td class="n em">{_e(g["PTS"])}</td>'
        f'<td class="n">{_e(g["TRB"])}</td><td class="n">{_e(g["AST"])}</td>'
        f'<td class="n">{_e(g["STL"])}</td><td class="n">{_e(g["BLK"])}</td>'
        "</tr>"
        for g in recent
    )

    meta = " · ".join(x for x in [bio["nationality"], bio["position"], bio["height"],
                                  f"born {bio['born']}" if bio["born"] else ""] if x)
    generated = date.today().isoformat()

    return _PAGE.format(
        name=_e(bio["name"] or slug),
        meta=_e(meta),
        blurb=_e(bio["blurb"]),
        tiles=tile_html,
        season_rows=season_table_rows(),
        highs=highs_html,
        recent_rows=recent_html,
        n_games=len(games),
        games_file=_e(games_file),
        generated=generated,
        slug=_e(slug),
    )


# -- all-games page ---------------------------------------------------

_GAME_COLS = [
    ("date", "Date", "text"), ("season", "Season", "text"),
    ("competition", "Comp", "text"), ("team", "Team", "text"),
    ("opp", "Opp", "text"), ("score", "Score", "text"),
    ("MIN", "MIN", "num"), ("PTS", "PTS", "em"),
    ("FG", "FG", "ma:FGM:FGA"), ("3P", "3P", "ma:3PM:3PA"), ("FT", "FT", "ma:FTM:FTA"),
    ("ORB", "OR", "num"), ("DRB", "DR", "num"), ("TRB", "REB", "num"),
    ("AST", "AST", "num"), ("STL", "STL", "num"), ("BLK", "BLK", "num"),
    ("TOV", "TOV", "num"), ("PF", "PF", "num"), ("RNK", "RNK", "num"),
]


def render_games(slug: str, career_file: str) -> str:
    soup = BeautifulSoup(_blobs(slug), "html.parser")
    bio = _bio(soup)
    games = _detail_games(soup)
    for i, g in enumerate(games):
        g["i"] = i
    meta = " · ".join(x for x in [bio["nationality"], bio["position"], bio["height"],
                                  f"born {bio['born']}" if bio["born"] else ""] if x)
    return (_GAMES_PAGE
            .replace("__NAME__", _e(bio["name"] or slug))
            .replace("__META__", _e(meta))
            .replace("__CAREER_FILE__", _e(career_file))
            .replace("__N__", str(len(games)))
            .replace("__GENERATED__", date.today().isoformat())
            .replace("__SLUG__", _e(slug))
            .replace("__COLS_JSON__", json.dumps(_GAME_COLS))
            .replace("__GAMES_JSON__", json.dumps(games, separators=(",", ":"))))


def _merge_totals(rows: list[dict]) -> dict:
    out = {"Team": " / ".join(r["Team"] for r in rows)}
    for k in ["G", "MIN", "PTS", "RO", "RD", "RT", "AS", "PF", "BS", "ST", "TO", "RNK"]:
        out[k] = str(sum(_int(r[k]) for r in rows))
    for k in ["2FGP", "3FGP", "FT"]:
        ma = [_made_att(r[k]) for r in rows]
        out[k] = f"{sum(m for m, _ in ma)}-{sum(a for _, a in ma)}"
    return out


def _derive_pg(tot: dict) -> dict:
    g = _int(tot["G"]) or 1
    return {k: _f1(_int(tot[k]) / g) for k in ["PTS", "RT", "AS"]}


_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{name} — career</title>
<style>
  :root {{
    --bg: #fbfaf8; --card: #ffffff; --ink: #1c1a17; --muted: #6b6560;
    --line: #e7e2db; --accent: #1f6feb; --em: #b03a2e;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --bg: #16181d; --card: #1e2128; --ink: #e9e6e1; --muted: #9a938b;
      --line: #2c313a; --accent: #4d8bff; --em: #e8836f;
    }}
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }}
  .wrap {{ max-width: 1040px; margin: 0 auto; padding: 32px 20px 64px; }}
  header h1 {{ margin: 0 0 4px; font-size: 2rem; letter-spacing: -0.02em; }}
  header .meta {{ color: var(--muted); font-size: 0.95rem; }}
  header .blurb {{ margin: 14px 0 0; max-width: 60ch; color: var(--ink); }}
  h2 {{
    font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.09em;
    color: var(--muted); margin: 40px 0 14px; font-weight: 700;
  }}
  h2 .more {{
    float: right; text-transform: none; letter-spacing: 0; font-weight: 600;
    font-size: 0.85rem; color: var(--accent); text-decoration: none;
  }}
  h2 .more:hover {{ text-decoration: underline; }}
  .tiles {{ display: grid; gap: 10px; grid-template-columns: repeat(4, 1fr); }}
  .tile {{
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px 16px; display: flex; flex-direction: column; gap: 2px;
  }}
  .tile .k {{ font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }}
  .tile .v {{ font-size: 1.55rem; font-weight: 700; letter-spacing: -0.02em; }}
  .tile .s {{ font-size: 0.8rem; color: var(--muted); }}
  .his {{ display: grid; gap: 10px; grid-template-columns: repeat(3, 1fr); }}
  .hi {{
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px 16px; display: flex; flex-direction: column; gap: 3px;
  }}
  .hi .k {{ font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }}
  .hi .v {{ font-size: 1.8rem; font-weight: 700; color: var(--em); line-height: 1; }}
  .hi .s {{ font-size: 0.8rem; color: var(--muted); }}
  .scroll {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }}
  table {{ border-collapse: collapse; width: 100%; font-size: 0.88rem; }}
  th, td {{ padding: 8px 10px; text-align: left; white-space: nowrap; }}
  thead th {{
    position: sticky; top: 0; background: var(--card); border-bottom: 2px solid var(--line);
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
  }}
  tbody tr + tr td {{ border-top: 1px solid var(--line); }}
  td.n {{ text-align: right; font-variant-numeric: tabular-nums; }}
  td.em {{ font-weight: 700; color: var(--em); }}
  td.yr {{ font-weight: 600; }}
  td.cmp {{ color: var(--ink); }}
  td.tm {{ color: var(--muted); }}
  .split {{ font-size: 0.72rem; color: var(--muted); padding: 6px 10px; }}
  footer {{ margin-top: 44px; color: var(--muted); font-size: 0.8rem; }}
  @media (max-width: 720px) {{
    .tiles {{ grid-template-columns: repeat(2, 1fr); }}
    .his {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>{name}</h1>
    <div class="meta">{meta}</div>
    <p class="blurb">{blurb}</p>
  </header>

  <h2>Career — all eurobasket-tracked competitions</h2>
  <div class="tiles">{tiles}</div>

  <h2>Per-game highs</h2>
  <div class="his">{highs}</div>

  <h2>Season by season</h2>
  <div class="scroll">
    <table>
      <thead><tr>
        <th>Season</th><th>Competition</th><th>Team</th>
        <th>G</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th>
        <th>FG M-A</th><th>3P M-A</th><th>FG%</th><th>3P%</th><th>FT%</th>
        <th>PPG</th><th>RPG</th><th>APG</th>
      </tr></thead>
      <tbody>
        {season_rows}
      </tbody>
    </table>
  </div>
  <div class="split">Totals per row (FG M-A folds 2- and 3-pointers together; 3P M-A is threes only); PPG/RPG/APG are that competition's per-game rate. Identical stat lines eurobasket repeats under several youth-event labels are shown once.</div>

  <h2>Recent games <a class="more" href="{games_file}">all {n_games} on record →</a></h2>
  <div class="scroll">
    <table>
      <thead><tr>
        <th>Date</th><th>Competition</th><th>Team</th><th>Opp</th><th>Score</th>
        <th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th>
      </tr></thead>
      <tbody>
        {recent_rows}
      </tbody>
    </table>
  </div>

  <footer>
    Generated {generated} from cached eurobasket.com season fragments
    (<code>cache/_eurobasket/{slug}-*</code>). Not an official record — eurobasket
    only tracks the competitions shown, and some early youth-team lines are
    duplicated at the source.
  </footer>
</div>
</body>
</html>
"""


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--slug", required=True, help="player slug, e.g. jakub-urbaniak")
    p.add_argument("--out", required=True, help="output .html path")
    args = p.parse_args(argv)

    career_out = Path(args.out)
    stem = re.sub(r"-career$", "", career_out.stem)
    games_out = career_out.with_name(f"{stem}-games{career_out.suffix}")

    career_out.write_text(render(args.slug, games_out.name), encoding="utf-8")
    print(f"wrote {career_out}")
    games_out.write_text(render_games(args.slug, career_out.name), encoding="utf-8")
    print(f"wrote {games_out}")
    return 0


_GAMES_PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__NAME__ — every game</title>
<style>
  :root {
    --bg:#fbfaf8; --card:#fff; --ink:#1c1a17; --muted:#6b6560; --line:#e7e2db;
    --accent:#1f6feb; --em:#b03a2e; --sel:#fdf3c9; --divider:#f1ede6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#16181d; --card:#1e2128; --ink:#e9e6e1; --muted:#9a938b; --line:#2c313a;
      --accent:#4d8bff; --em:#e8836f; --sel:#3a3520; --divider:#23262d;
    }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:1200px; margin:0 auto; padding:28px 18px 120px; }
  h1 { margin:0 0 3px; font-size:1.5rem; letter-spacing:-.02em; }
  .meta { color:var(--muted); font-size:.9rem; }
  .back { display:inline-block; margin:12px 0 0; color:var(--accent);
    text-decoration:none; font-size:.85rem; font-weight:600; }
  .back:hover { text-decoration:underline; }
  .controls { display:flex; flex-wrap:wrap; gap:14px; align-items:center;
    margin:22px 0 12px; font-size:.85rem; }
  .controls label { display:flex; gap:6px; align-items:center; cursor:pointer; color:var(--muted); }
  .controls button { font:inherit; font-size:.82rem; padding:4px 11px; border:1px solid var(--line);
    border-radius:7px; background:var(--card); color:var(--ink); cursor:pointer; }
  .controls button:hover { border-color:var(--accent); }
  .scroll { overflow-x:auto; border:1px solid var(--line); border-radius:12px; background:var(--card); }
  table { border-collapse:collapse; width:100%; font-size:.84rem; }
  th, td { padding:7px 9px; text-align:left; white-space:nowrap; }
  thead th { position:sticky; top:0; z-index:2; background:var(--card);
    border-bottom:2px solid var(--line); font-size:.68rem; text-transform:uppercase;
    letter-spacing:.04em; color:var(--muted); cursor:pointer; user-select:none; }
  thead th.nosort { cursor:default; }
  th .arw { opacity:.35; font-size:.75em; margin-left:3px; }
  th.sorted { color:var(--accent); }
  th.sorted .arw { opacity:1; }
  tbody tr.g + tr.g td { border-top:1px solid var(--line); }
  td.num { text-align:right; font-variant-numeric:tabular-nums; }
  td.em { font-weight:700; color:var(--em); }
  tr.sel td { background:var(--sel); }
  tr.divider td { background:var(--divider); border-top:2px solid var(--line);
    font-weight:700; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
  tr.divider label { display:flex; gap:7px; align-items:center; cursor:pointer; }
  .selc { width:26px; text-align:center; }
  .summary { position:fixed; left:0; right:0; bottom:0; background:var(--card);
    border-top:1px solid var(--line); box-shadow:0 -4px 18px rgba(0,0,0,.10);
    padding:11px 18px; font-size:.8rem; overflow-x:auto; white-space:nowrap; display:none; }
  .summary.on { display:block; }
  .summary .chip { display:inline-block; margin-right:14px; color:var(--muted); }
  .summary .chip b, .summary > b { color:var(--ink); font-variant-numeric:tabular-nums; }
  footer { margin-top:24px; color:var(--muted); font-size:.78rem; }
</style>
</head>
<body>
<div class="wrap">
  <h1>__NAME__ — every game</h1>
  <div class="meta">__META__ · __N__ games on record from eurobasket.com</div>
  <a class="back" href="__CAREER_FILE__">← career overview</a>

  <div class="controls">
    <label><input type="checkbox" id="grp" checked> Group by season</label>
    <button id="selAll">Select all</button>
    <button id="selNone">Clear</button>
    <span id="selCount" style="color:var(--muted)"></span>
  </div>

  <div class="scroll">
    <table>
      <thead><tr id="hrow"></tr></thead>
      <tbody id="body"></tbody>
    </table>
  </div>

  <footer>Generated __GENERATED__ from cached eurobasket.com game logs
    (<code>cache/_eurobasket/__SLUG__-*</code>). Click a column to sort; tick rows
    (or a whole season) to total them in the bar below. FG folds 2s and 3s together.</footer>
</div>

<div class="summary" id="sumbar"></div>

<script>
const COLS = __COLS_JSON__;
const GAMES = __GAMES_JSON__;
const MA = {};
COLS.forEach(c => { if (c[2].indexOf('ma:') === 0) { const p = c[2].split(':'); MA[c[0]] = [p[1], p[2]]; } });

let sortKey = 'date', sortDir = 'desc', grouped = true;
const selected = new Set();
let GROUPS = new Map();

function val(g, key) { return MA[key] ? (g[MA[key][0]] || 0) : g[key]; }
function cmp(a, b) {
  const va = val(a, sortKey), vb = val(b, sortKey);
  if (typeof va === 'number' || typeof vb === 'number') return (va || 0) - (vb || 0);
  return String(va).localeCompare(String(vb));
}
function sortRows(list) {
  return list.slice().sort((a, b) => sortDir === 'asc' ? cmp(a, b) : -cmp(a, b));
}
function groupKey(g) { return g.season + '  ·  ' + g.competition; }
function cellCls(c) {
  if (c[2] === 'em') return 'num em';
  if (c[2] === 'num' || MA[c[0]]) return 'num';
  return '';
}
function cellText(g, c) { return MA[c[0]] ? (g[MA[c[0]][0]] + '-' + g[MA[c[0]][1]]) : g[c[0]]; }

function rowHtml(g) {
  const cells = COLS.map(c => '<td class="' + cellCls(c) + '">' + cellText(g, c) + '</td>').join('');
  const on = selected.has(g.i);
  return '<tr class="g' + (on ? ' sel' : '') + '" data-i="' + g.i + '">'
    + '<td class="selc"><input type="checkbox" data-i="' + g.i + '"' + (on ? ' checked' : '') + '></td>'
    + cells + '</tr>';
}

function render() {
  const ncol = COLS.length + 1;

  document.getElementById('hrow').innerHTML =
    '<th class="nosort selc"><input type="checkbox" id="hchk"></th>' +
    COLS.map(c => {
      const on = c[0] === sortKey;
      const arw = on ? (sortDir === 'asc' ? '▲' : '▼') : '▾';
      return '<th data-k="' + c[0] + '"' + (on ? ' class="sorted"' : '') + '>' + c[1]
        + '<span class="arw">' + arw + '</span></th>';
    }).join('');

  document.querySelectorAll('#hrow th[data-k]').forEach(th => {
    th.onclick = () => {
      const k = th.dataset.k;
      if (k === sortKey) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortKey = k; sortDir = COLS.find(c => c[0] === k)[2] === 'text' ? 'asc' : 'desc'; }
      render();
    };
  });
  document.getElementById('hchk').onclick = e => {
    GAMES.forEach(g => e.target.checked ? selected.add(g.i) : selected.delete(g.i));
    render();
  };

  let html = '';
  GROUPS = new Map();
  if (grouped) {
    GAMES.forEach(g => { const k = groupKey(g); (GROUPS.get(k) || GROUPS.set(k, []).get(k)).push(g); });
    const order = [...GROUPS.keys()].sort((a, b) => {
      const A = GROUPS.get(a), B = GROUPS.get(b);
      if (A[0].sort !== B[0].sort) return B[0].sort - A[0].sort;
      const da = A.map(x => x.date).sort().pop(), db = B.map(x => x.date).sort().pop();
      return db.localeCompare(da);
    });
    order.forEach(k => {
      const gs = sortRows(GROUPS.get(k));
      GROUPS.set(k, gs);
      const allSel = gs.every(g => selected.has(g.i));
      html += '<tr class="divider"><td colspan="' + ncol + '"><label>'
        + '<input type="checkbox" class="grpchk" data-grp="' + encodeURIComponent(k) + '"'
        + (allSel ? ' checked' : '') + '> ' + k + ' — ' + gs.length + ' g</label></td></tr>';
      gs.forEach(g => html += rowHtml(g));
    });
  } else {
    sortRows(GAMES).forEach(g => html += rowHtml(g));
  }
  document.getElementById('body').innerHTML = html;

  document.querySelectorAll('#body input[data-i]').forEach(cb => {
    cb.onchange = () => { const i = +cb.dataset.i; cb.checked ? selected.add(i) : selected.delete(i); render(); };
  });
  document.querySelectorAll('#body .grpchk').forEach(cb => {
    cb.onchange = () => {
      const gs = GROUPS.get(decodeURIComponent(cb.dataset.grp)) || [];
      gs.forEach(g => cb.checked ? selected.add(g.i) : selected.delete(g.i));
      render();
    };
  });

  document.getElementById('selCount').textContent = selected.size ? selected.size + ' selected' : '';
  renderSummary();
}

function renderSummary() {
  const bar = document.getElementById('sumbar');
  const sel = GAMES.filter(g => selected.has(g.i));
  if (!sel.length) { bar.className = 'summary'; bar.innerHTML = ''; return; }
  const n = sel.length;
  const s = k => sel.reduce((t, g) => t + (g[k] || 0), 0);
  const chip = (l, v) => '<span class="chip">' + l + ' <b>' + v + '</b></span>';
  const ma = (l, m, a) => { const M = s(m), A = s(a); return chip(l, M + '-' + A + ' (' + (A ? (100 * M / A).toFixed(1) + '%' : '—') + ')'); };
  let h = '<b>' + n + (n > 1 ? ' games' : ' game') + '</b> &nbsp; ';
  h += chip('MIN', s('MIN')) + chip('PTS', s('PTS'));
  h += ma('FG', 'FGM', 'FGA') + ma('3P', '3PM', '3PA') + ma('FT', 'FTM', 'FTA');
  h += chip('OR', s('ORB')) + chip('DR', s('DRB')) + chip('REB', s('TRB'))
    + chip('AST', s('AST')) + chip('STL', s('STL')) + chip('BLK', s('BLK'))
    + chip('TOV', s('TOV')) + chip('PF', s('PF'));
  h += '&nbsp;|&nbsp; ' + chip('PTS/g', (s('PTS') / n).toFixed(1))
    + chip('REB/g', (s('TRB') / n).toFixed(1)) + chip('AST/g', (s('AST') / n).toFixed(1));
  bar.innerHTML = h;
  bar.className = 'summary on';
}

document.getElementById('grp').onchange = e => { grouped = e.target.checked; render(); };
document.getElementById('selAll').onclick = () => { GAMES.forEach(g => selected.add(g.i)); render(); };
document.getElementById('selNone').onclick = () => { selected.clear(); render(); };
render();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    raise SystemExit(main())
