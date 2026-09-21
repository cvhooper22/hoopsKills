"""Number Matcher + Ranker.

Given a target countdown number N, find the facts that equal it (percentages
match within config.scoring.pct_match_tolerance), then rank them.

    find_matches(facts, n, scope="all", player_slug=None) -> list[Fact]
    rank_candidates(facts, n, config, ...)                 -> RankResult

Every tuning number lives in config.json -- nothing here is hardcoded:
    ranking_weights.*                     the bonus/penalty amounts + low_number_cutoff
    scoring.pct_match_tolerance           how close a percentage must be to N
    scoring.*_stat_types                  which stat_types each bonus applies to
    scoring.opponent_context_split_prefixes
    sample_size_minimums.*                attempt floors for percentage facts
    max_suggestions_per_number            default result limit
(_tiebreak / _SOURCE_RANK only order equal-scored candidates for display.)

Scope controls which facts are *eligible* to match (no cross-player aggregation,
no forced dedup -- one player can legitimately own the whole shortlist):
    player  -- one player (player_slug required)
    roster  -- every player, individually
    team    -- team-scope facts only
    all     -- roster + team, ranked together   (default)

Result count is caller-controlled: `limit` defaults to
config.max_suggestions_per_number; pass limit=None for the full ranked list.
The RankResult always carries a "N candidates found, showing top K" summary so
truncation is never silent.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .models import Fact

_DEFAULT_LIMIT = object()  # sentinel: "use config", distinct from None ("all")
DEFAULT_PCT_TOLERANCE = 0.5  # config.scoring.pct_match_tolerance overrides


def is_percentage(fact: Fact) -> bool:
    return fact.stat_name.endswith("%") or fact.stat_type == "window_pct"


def match_kind(fact: Fact, n: int, pct_tolerance: float = DEFAULT_PCT_TOLERANCE) -> str | None:
    """'exact', 'rounded', or None. Percentages match when within `pct_tolerance`."""
    v = fact.stat_value
    if is_percentage(fact):
        if v == n:
            return "exact"
        return "rounded" if abs(v - n) <= pct_tolerance else None
    return "exact" if v == n else None


def _pct_tolerance(config: dict) -> float:
    return config.get("scoring", {}).get("pct_match_tolerance", DEFAULT_PCT_TOLERANCE)


# -- scope -------------------------------------------------------------------


def in_scope(facts: list[Fact], scope: str, player_slug: str | None = None,
            player_slugs: set[str] | list[str] | None = None) -> list[Fact]:
    if scope == "player":
        if not player_slug:
            raise ValueError("scope='player' needs player_slug")
        scoped = [f for f in facts if f.player_slug == player_slug]
    elif scope == "roster":
        scoped = [f for f in facts if f.scope == "player"]
    elif scope == "team":
        scoped = [f for f in facts if f.scope == "team"]
    elif scope == "all":
        scoped = list(facts)
    else:
        raise ValueError(f"unknown scope: {scope!r}")
    if player_slugs:
        wanted = set(player_slugs)
        scoped = [f for f in scoped if f.player_slug in wanted]
    return scoped


def find_matches(facts: list[Fact], target_number: int, scope: str = "all",
                 player_slug: str | None = None,
                 pct_tolerance: float = DEFAULT_PCT_TOLERANCE,
                 player_slugs: set[str] | list[str] | None = None) -> list[Fact]:
    return [f for f in in_scope(facts, scope, player_slug, player_slugs)
            if match_kind(f, target_number, pct_tolerance) is not None]


# -- active roster ---------------------------------------------------------


def current_season_label(config: dict) -> str | None:
    current = config.get("fetch", {}).get("current_season")
    return None if current is None else f"{current - 1}-{str(current)[-2:]}"


def active_player_slugs(facts: list[Fact], config: dict) -> set[str]:
    """The active roster for `active_roster_bonus`.

    Uses data/roster.json when refresh.py has recorded one (via --roster-season);
    otherwise falls back to "has any fact in the current season"."""
    from .roster import load_active_roster

    recorded = load_active_roster()
    if recorded:
        return recorded
    label = current_season_label(config)
    if label is None:
        return set()
    return {f.player_slug for f in facts if f.season == label and f.player_slug}


# -- ranking -------------------------------------------------------------------


@dataclass
class Candidate:
    fact: Fact
    score: float
    kind: str  # "exact" | "rounded"
    reasons: list[tuple[str, float]] = field(default_factory=list)


@dataclass
class RankResult:
    target: int
    total: int
    shown: list[Candidate]

    @property
    def summary(self) -> str:
        if self.total == len(self.shown):
            return f"{self.total} candidate{'s' * (self.total != 1)} found"
        return f"{self.total} candidates found, showing top {len(self.shown)}"


def _sample_ok(fact: Fact, config: dict) -> bool:
    """False when a percentage fact is below its configured attempt minimum."""
    if not is_percentage(fact):
        return True
    mins = config.get("sample_size_minimums", {})
    rule = mins.get(fact.stat_name) or mins.get("default")
    if not rule:
        return True
    if fact.sample_size is None:
        return False
    return fact.sample_size >= rule.get("min_attempts", 0)


def _has_opponent_context(fact: Fact, prefixes: list[str]) -> bool:
    if fact.opponent:
        return True
    cat = str(fact.context.get("split_category", ""))
    return any(cat.startswith(p) for p in prefixes)


def score_fact(fact: Fact, target: int, config: dict, active: set[str]) -> Candidate:
    w = config.get("ranking_weights", {})
    s = config.get("scoring", {})
    kind = match_kind(fact, target, _pct_tolerance(config)) or "none"
    score = 0.0
    reasons: list[tuple[str, float]] = []

    def add(name: str, amount: float) -> None:
        nonlocal score
        if amount:
            score += amount
            reasons.append((name, amount))

    if fact.player_slug and fact.player_slug in active:
        add("active_roster_bonus", w.get("active_roster_bonus", 0))
    if fact.stat_type in s.get("career_total_stat_types", ["career_total", "window_total"]):
        add("career_total_bonus", w.get("career_total_bonus", 0))
    if fact.stat_type in s.get("single_game_stat_types", ["single_game"]):
        add("single_game_bonus", w.get("single_game_bonus", 0))
    if _has_opponent_context(fact, s.get("opponent_context_split_prefixes", ["vs_team"])):
        add("has_opponent_context_bonus", w.get("has_opponent_context_bonus", 0))
    if not _sample_ok(fact, config):
        add("pct_below_min_sample_penalty", w.get("pct_below_min_sample_penalty", 0))

    # low/high number framing: a small N is more striking as a single moment
    # (game / streak / threshold); a large N naturally reads as a cumulative total
    if target <= w.get("low_number_cutoff", 30):
        if fact.stat_type in s.get("low_number_stat_types",
                                   ["single_game", "streak", "threshold_count"]):
            add("low_number_bonus", w.get("low_number_bonus", 0))
    elif fact.stat_type in s.get("high_number_stat_types",
                                 ["career_total", "season_total", "window_total"]):
        add("high_number_bonus", w.get("high_number_bonus", 0))

    return Candidate(fact=fact, score=score, kind=kind, reasons=reasons)


_WINDOW_TO_SEASON = {"career": "CAREER", "last_2_seasons": "LAST2"}


def _resolved_period(fact: Fact, current_label: str | None) -> str | None:
    if fact.stat_type == "career_total":
        return "CAREER"
    if fact.season:
        return fact.season
    window = fact.context.get("window")
    if window == "current_season":
        return current_label
    return _WINDOW_TO_SEASON.get(window, window)


def _semantic_key(fact: Fact, current_label: str | None = None) -> tuple:
    """Collapse facts that would draft to the same sentence -- e.g. a career total
    from the overview and the identical career window_total from the derivation
    engine, or a current-season window total and that season's overview total.
    Same-number facts from different players are NOT collapsed."""
    ctx = fact.context
    st = fact.stat_type
    period = _resolved_period(fact, current_label)
    if st in ("career_total", "season_total", "window_total"):
        bucket: tuple = ("total", period)
    elif st == "window_pct":
        bucket = ("pct", period)
    elif st == "single_game":
        bucket = ("game", fact.game_date, fact.opponent)
    elif st == "career_split":
        bucket = ("split", ctx.get("split_category"), fact.season)
    elif st == "threshold_count":
        bucket = ("thr", ctx.get("threshold"), ctx.get("window"))
    elif st == "streak":
        bucket = ("streak", ctx.get("condition"), ctx.get("window"))
    else:
        bucket = (st,)
    return (fact.scope, fact.player_slug, fact.stat_name, float(fact.stat_value), bucket)


# Ordering only -- breaks display ties between candidates of equal score. Not a
# scoring input and deliberately not a config surface: exact before rounded,
# scraped data before derived, larger sample first, then stable string keys.
_SOURCE_RANK = {"overview": 0, "gamelog": 0, "team_page": 0, "eurobasket": 0,
                "splits": 1, "derived": 2}


def _tiebreak(c: Candidate) -> tuple:
    return (
        -c.score,
        0 if c.kind == "exact" else 1,
        _SOURCE_RANK.get(c.fact.source, 3),  # prefer scraped data over derived
        -(c.fact.sample_size or 0),
        c.fact.player_slug or "",
        c.fact.stat_name,
        c.fact.season or "",
        str(c.fact.context.get("split_category") or ""),
        c.fact.game_date or "",
    )


def rank_candidates(facts: list[Fact], target_number: int, config: dict,
                    scope: str = "all", player_slug: str | None = None,
                    active: set[str] | None = None, limit=_DEFAULT_LIMIT,
                    player_slugs: set[str] | list[str] | None = None) -> RankResult:
    if active is None:
        active = active_player_slugs(facts, config)

    matched = find_matches(facts, target_number, scope, player_slug,
                           _pct_tolerance(config), player_slugs)
    candidates = [score_fact(f, target_number, config, active) for f in matched]
    candidates.sort(key=_tiebreak)

    current_label = current_season_label(config)
    seen: set[tuple] = set()
    deduped: list[Candidate] = []
    for c in candidates:  # already best-first, so the first of each key wins
        key = _semantic_key(c.fact, current_label)
        if key not in seen:
            seen.add(key)
            deduped.append(c)
    candidates = deduped

    if limit is _DEFAULT_LIMIT:
        limit = config.get("max_suggestions_per_number", 5)
    shown = candidates if limit is None else candidates[:limit]
    return RankResult(target=target_number, total=len(candidates), shown=shown)


def rank_range(facts: list[Fact], start: int, end: int, config: dict,
              scope: str = "all", player_slug: str | None = None,
              player_slugs: set[str] | list[str] | None = None,
              active: set[str] | None = None, limit=_DEFAULT_LIMIT) -> list[RankResult]:
    """rank_candidates for every number in [start, end], filtered to the same
    scope/player subset -- lets a "which upcoming countdown numbers have good
    material for these players" search run as one pass over the facts."""
    if end < start:
        start, end = end, start
    if active is None:
        active = active_player_slugs(facts, config)
    return [
        rank_candidates(facts, n, config, scope=scope, player_slug=player_slug,
                        player_slugs=player_slugs, active=active, limit=limit)
        for n in range(start, end + 1)
    ]


# -- CLI (a stopgap until Phase 4's suggest.py) ------------------------------


def _fmt(c: Candidate) -> str:
    f = c.fact
    who = f.player or f.player_slug or "TEAM"
    bits = [f"{f.stat_value} {f.stat_name}", f.stat_type]
    if f.season:
        bits.append(f.season)
    if f.opponent:
        bits.append(f"vs {f.opponent}")
    if f.game_date:
        bits.append(f.game_date)
    if f.context.get("split_category"):
        bits.append(str(f.context["split_category"]))
    if f.context.get("window"):
        bits.append(str(f.context["window"]))
    tail = f"  [{c.kind}]" if c.kind == "rounded" else ""
    return f"  {c.score:6.1f}  {who} — {', '.join(bits)}{tail}"


def main(argv: list[str] | None = None) -> int:
    import argparse
    import json

    from .config import load_config
    from .models import FactStore

    p = argparse.ArgumentParser(description="match a countdown number against cached facts")
    p.add_argument("--number", type=int, required=True)
    p.add_argument("--scope", default="all", choices=["player", "roster", "team", "all"])
    p.add_argument("--player", help="slug, required for --scope player")
    p.add_argument("--limit", type=int, help="override config.max_suggestions_per_number")
    p.add_argument("--all", action="store_true", help="show every candidate (no truncation)")
    p.add_argument("--explain", action="store_true", help="show which weights fired")
    args = p.parse_args(argv)

    config = load_config()
    facts = FactStore().facts
    limit = None if args.all else (args.limit if args.limit is not None else _DEFAULT_LIMIT)
    result = rank_candidates(facts, args.number, config, scope=args.scope,
                             player_slug=args.player, limit=limit)

    print(result.summary)
    for c in result.shown:
        print(_fmt(c))
        if args.explain and c.reasons:
            print(f"         {json.dumps(dict(c.reasons))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
