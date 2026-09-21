"""Derivation Engine: compute facts that aren't printed on any single SR table.

Everything here is driven by config.json (windows, threshold_game_levels,
streak_conditions, sample_size_minimums) so a future UI can retune it without a
rescrape. Input is the flat Fact list already produced by the normalizer; output
is more Facts, all tagged source="derived".

Derived fact types:
  window_total     -- counting-stat sums over current_season / last_2_seasons / career
  window_pct       -- shooting %s over those same windows, with sample_size + a
                      below_min_sample flag from sample_size_minimums
  threshold_count  -- games in a window with STAT >= level (per threshold_game_levels)
  streak           -- longest run of consecutive games meeting a streak_condition
  career_split     -- class-year / home-away / win-loss breakdowns, rebuilt from
                      the game log (the scraped /splits/ page sits behind a
                      Cloudflare challenge; see README)
"""

from __future__ import annotations

from collections import defaultdict

from .models import Fact
from .normalizer import season_label

# derived percentage label -> (makes stat, attempts stat)
PCT_COMPONENTS = {
    "FG%": ("FG", "FGA"),
    "3P%": ("3P", "3PA"),
    "2P%": ("2P", "2PA"),
    "FT%": ("FT", "FTA"),
}
COUNTING_LABELS = ["PTS", "TRB", "ORB", "DRB", "AST", "STL", "BLK", "TOV", "PF",
                   "FG", "FGA", "3P", "3PA", "2P", "2PA", "FT", "FTA"]


class _Game:
    __slots__ = ("date", "season", "opponent", "class_year", "result", "location", "stats")

    def __init__(self, date, season, opponent, class_year, result, location):
        self.date = date
        self.season = season
        self.opponent = opponent
        self.class_year = class_year
        self.result = result
        self.location = location
        self.stats: dict[str, float] = {}


def _year_of(label: str | None) -> int:
    """'2022-23' -> 2022; None sorts last."""
    if not label:
        return -1
    try:
        return int(label.split("-")[0])
    except ValueError:
        return -1


def _collect_games(facts: list[Fact]) -> list[_Game]:
    season_class: dict[str, str | None] = {}
    for f in facts:
        if f.stat_type == "season_total" and f.season:
            season_class.setdefault(f.season, f.context.get("class_year"))

    games: dict[tuple, _Game] = {}
    for f in facts:
        if f.stat_type != "single_game" or f.scope != "player":
            continue
        gkey = (f.game_date, f.opponent)  # date alone collides on doubleheaders
        g = games.get(gkey)
        if g is None:
            g = _Game(
                date=f.game_date,
                season=f.season,
                opponent=f.opponent,
                class_year=season_class.get(f.season),
                result=f.context.get("result"),
                location=f.context.get("location"),
            )
            games[gkey] = g
        g.stats[f.stat_name] = f.stat_value
    return sorted(games.values(), key=lambda g: (g.date, g.opponent or ""))


def _sum_stats(games: list[_Game]) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for g in games:
        for k, v in g.stats.items():
            totals[k] += v
    return totals


def _pct_facts(totals: dict[str, float], base: dict, config: dict, n_games: int) -> list[Fact]:
    mins = config.get("sample_size_minimums", {})
    out: list[Fact] = []
    for label, (make_k, att_k) in PCT_COMPONENTS.items():
        att = totals.get(att_k, 0)
        if att <= 0:
            continue
        made = totals.get(make_k, 0)
        rule = mins.get(label)
        below_min = bool(rule and att < rule.get("min_attempts", 0))
        out.append(Fact(
            stat_name=label,
            stat_value=round(made / att * 100, 1),
            stat_type="window_pct",
            source="derived",
            sample_size=int(att),
            context={**base.get("context", {}), "below_min_sample": below_min, "n_games": n_games},
            **{k: v for k, v in base.items() if k != "context"},
        ))
    # eFG%
    fga = totals.get("FGA", 0)
    if fga > 0:
        efg = (totals.get("FG", 0) + 0.5 * totals.get("3P", 0)) / fga * 100
        out.append(Fact(
            stat_name="eFG%", stat_value=round(efg, 1), stat_type="window_pct", source="derived",
            sample_size=int(fga),
            context={**base.get("context", {}), "n_games": n_games},
            **{k: v for k, v in base.items() if k != "context"},
        ))
    return out


def _window_facts(games: list[_Game], window: str, season: str | None,
                  player: str | None, slug: str | None, config: dict) -> list[Fact]:
    if not games:
        return []
    base = dict(scope="player", player=player, player_slug=slug, season=season,
                context={"window": window})
    totals = _sum_stats(games)
    facts: list[Fact] = []

    for label in COUNTING_LABELS:
        if label in totals:
            facts.append(Fact(
                stat_name=label, stat_value=int(totals[label]), stat_type="window_total",
                source="derived",
                context={"window": window, "n_games": len(games)},
                **{k: v for k, v in base.items() if k != "context"},
            ))

    facts += _pct_facts(totals, base, config, len(games))

    for stat, levels in config.get("threshold_game_levels", {}).items():
        for level in levels:
            count = sum(1 for g in games if g.stats.get(stat, 0) >= level)
            if count:
                facts.append(Fact(
                    stat_name=stat, stat_value=count, stat_type="threshold_count",
                    source="derived",
                    context={"window": window, "threshold": level, "op": ">=",
                             "n_games": len(games)},
                    **{k: v for k, v in base.items() if k != "context"},
                ))
    return facts


def _streak_facts(games: list[_Game], window: str, season: str | None,
                  player: str | None, slug: str | None, config: dict) -> list[Fact]:
    facts: list[Fact] = []
    min_length = config.get("streak_min_length", 2)
    for cond in config.get("streak_conditions", []):
        stat, op, value = cond["stat"], cond.get("op", ">="), cond["value"]
        best = run = 0
        for g in games:
            v = g.stats.get(stat, 0)
            ok = v >= value if op == ">=" else (v > value if op == ">" else v == value)
            run = run + 1 if ok else 0
            best = max(best, run)
        if best >= min_length:
            facts.append(Fact(
                stat_name=stat, stat_value=best, stat_type="streak", source="derived",
                scope="player", player=player, player_slug=slug, season=season,
                context={"window": window, "condition": f"{stat} {op} {value}"},
            ))
    return facts


def _split_facts(games: list[_Game], player: str | None, slug: str | None,
                 config: dict, dims: list[str] | None = None) -> list[Fact]:
    # values are normalised to match the vocabulary of the scraped splits page
    # (Home/Away/Neutral, Win/Loss) so derived and scraped splits read alike
    _loc = {"home": "Home", "away": "Away", "neutral": "Neutral"}
    _res = {"W": "Win", "L": "Loss"}
    dimensions = {
        "class_year": lambda g: g.class_year,
        "location": lambda g: _loc.get(g.location, g.location),
        "result": lambda g: _res.get(g.result, g.result),
    }
    if dims is not None:
        dimensions = {k: v for k, v in dimensions.items() if k in dims}
    want = config.get("derived_split_stats", {})
    counting_labels = want.get("counting", ["PTS", "TRB", "AST", "STL", "BLK", "3P"])
    pct_labels = [lbl for lbl in want.get("pct", ["FG%", "3P%", "FT%"]) if lbl in PCT_COMPONENTS]

    facts: list[Fact] = []
    for dim, key in dimensions.items():
        buckets: dict[str, list[_Game]] = defaultdict(list)
        for g in games:
            k = key(g)
            if k:
                buckets[str(k)].append(g)
        for value, bucket in buckets.items():
            totals = _sum_stats(bucket)
            base = dict(scope="player", player=player, player_slug=slug, season=None,
                        context={"split_category": f"{dim}:{value}"})
            for label in counting_labels:
                if label in totals:
                    facts.append(Fact(
                        stat_name=label, stat_value=int(totals[label]),
                        stat_type="career_split", source="derived",
                        context={"split_category": f"{dim}:{value}", "n_games": len(bucket)},
                        **{k2: v for k2, v in base.items() if k2 != "context"},
                    ))
            for label in pct_labels:
                make_k, att_k = PCT_COMPONENTS[label]
                att = totals.get(att_k, 0)
                if att > 0:
                    rule = config.get("sample_size_minimums", {}).get(label)
                    below = bool(rule and att < rule.get("min_attempts", 0))
                    facts.append(Fact(
                        stat_name=label, stat_value=round(totals.get(make_k, 0) / att * 100, 1),
                        stat_type="career_split", source="derived", sample_size=int(att),
                        context={"split_category": f"{dim}:{value}", "below_min_sample": below,
                                 "n_games": len(bucket)},
                        **{k2: v for k2, v in base.items() if k2 != "context"},
                    ))
    return facts


def derive_player_facts(facts: list[Fact], slug: str, config: dict,
                        current_season_end: int,
                        derived_split_dims: list[str] | None = None) -> list[Fact]:
    """`derived_split_dims`: which class_year/location/result splits to rebuild
    from the game log. None = all three; pass a subset (e.g. ["class_year"]) when
    a saved SR splits page already covers location/result."""
    games = _collect_games([f for f in facts if f.player_slug == slug])
    if not games:
        return []
    player = next((f.player for f in facts if f.player_slug == slug and f.player), None)

    current_label = season_label(current_season_end)
    seasons_desc = sorted({g.season for g in games if g.season}, key=_year_of, reverse=True)
    last_2 = set(seasons_desc[:2])

    windows = {
        "current_season": ([g for g in games if g.season == current_label], current_label),
        "last_2_seasons": ([g for g in games if g.season in last_2], None),
        "career": (games, None),
    }
    configured = set(config.get("windows", ["current_season", "last_2_seasons", "career"]))

    out: list[Fact] = []
    for name, (subset, season) in windows.items():
        if name not in configured or not subset:
            continue
        out += _window_facts(subset, name, season, player, slug, config)
        out += _streak_facts(subset, name, season, player, slug, config)

    out += _split_facts(games, player, slug, config, dims=derived_split_dims)
    return out
