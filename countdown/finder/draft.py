"""Sentence Drafter: turn a ranked Candidate into draft post text.

One template per stat_type (further split by counting-stat vs percentage). Output
is a draft for a human to review/edit -- no auto-posting, no NLP generation.

    draft_text(candidate, target, config) -> str
    draft_result(rank_result, config)     -> list[(Candidate, str)]
"""

from __future__ import annotations

from .match import Candidate, RankResult, is_percentage
from .models import Fact

STAT_WORDS = {
    "PTS": "points", "TRB": "rebounds", "ORB": "offensive rebounds",
    "DRB": "defensive rebounds", "AST": "assists", "STL": "steals",
    "BLK": "blocks", "TOV": "turnovers", "PF": "fouls",
    "FG": "field goals", "FGA": "field goal attempts",
    "3P": "threes", "3PA": "three-point attempts",
    "2P": "two-pointers", "2PA": "two-point attempts",
    "FT": "free throws", "FTA": "free throw attempts",
}
PCT_PHRASE = {
    "FG%": "from the field", "3P%": "from three", "2P%": "on twos",
    "FT%": "from the line", "eFG%": "on effective field-goal percentage",
}
CLASS_WORDS = {"FR": "freshman", "SO": "sophomore", "JR": "junior", "SR": "senior"}
WINDOW_WORDS = {
    "current_season": "this season",
    "last_2_seasons": "over the last two seasons",
    "career": "in his career",
}


def _stat_word(name: str) -> str:
    return STAT_WORDS.get(name, name)


def _num(value) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def _split_phrase(category: str) -> str:
    kind, _, value = category.partition(":")
    if kind == "vs_team":
        return f"against {value}"
    if kind == "vs_conf":
        return f"against {value} opponents"
    if kind == "location":
        return {"Home": "at home", "Away": "on the road",
                "Neutral": "at neutral sites"}.get(value, value)
    if kind == "month":
        return f"in {value}"
    if kind == "result":
        return {"Win": "in wins", "Loss": "in losses"}.get(value, value)
    if kind == "role":
        return {"Starter": "as a starter", "Reserve": "off the bench"}.get(value, value)
    if kind == "game_type":
        return f"in {value} games"
    if kind == "class_year":
        return f"as a {CLASS_WORDS.get(value, value)}"
    if kind == "conference":
        return f"in {value} play"
    return value


def _who(fact: Fact, config: dict) -> str:
    if fact.scope == "team":
        return config.get("draft", {}).get("team_name", "the team")
    return fact.player or fact.player_slug or "the player"


def _body(fact: Fact, config: dict) -> str:
    who = _who(fact, config)
    val = _num(fact.stat_value)
    pct = is_percentage(fact)

    if fact.stat_type == "single_game":
        where = f" vs {fact.opponent}" if fact.opponent else ""
        when = f" ({fact.game_date})" if fact.game_date else ""
        return f"{who} put up {val} {_stat_word(fact.stat_name)}{where}{when}."

    if fact.stat_type == "season_total":
        return f"{who} had {val} {_stat_word(fact.stat_name)} in {fact.season}."

    if fact.stat_type == "career_total":
        return f"{who} has {val} career {_stat_word(fact.stat_name)}."

    if fact.stat_type == "window_total":
        window = WINDOW_WORDS.get(fact.context.get("window"), "")
        return f"{who} has {val} {_stat_word(fact.stat_name)} {window}.".replace("  ", " ")

    if fact.stat_type == "window_pct":
        window = WINDOW_WORDS.get(fact.context.get("window"), "")
        samp = f" on {fact.sample_size} attempts" if fact.sample_size else ""
        if fact.stat_name == "eFG%":
            return f"{who} has a {val}% effective field-goal percentage {window}{samp}.".replace("  ", " ")
        phrase = PCT_PHRASE.get(fact.stat_name, f"on {fact.stat_name}")
        return f"{who} is shooting {val}% {phrase} {window}{samp}.".replace("  ", " ")

    if fact.stat_type == "career_split":
        phrase = _split_phrase(str(fact.context.get("split_category", "")))
        when = f" in {fact.season}" if fact.season else ""
        if pct:
            samp = f" ({fact.sample_size} attempts)" if fact.sample_size else ""
            if fact.stat_name == "eFG%":
                return f"{who} has a {val}% effective field-goal percentage {phrase}{when}{samp}."
            shoot = PCT_PHRASE.get(fact.stat_name, f"on {fact.stat_name}")
            return f"{who} shoots {val}% {shoot} {phrase}{when}{samp}."
        return f"{who} has {val} {_stat_word(fact.stat_name)} {phrase}{when}."

    if fact.stat_type == "threshold_count":
        window = WINDOW_WORDS.get(fact.context.get("window"), "")
        lvl = fact.context.get("threshold")
        return (f"{who} has {val} games with {lvl}+ {_stat_word(fact.stat_name)} "
                f"{window}.").replace("  ", " ")

    if fact.stat_type == "streak":
        cond = str(fact.context.get("condition", "")).replace(">=", "at least").strip()
        cond = cond.replace("PTS", "points").replace("3P", "threes").replace("STL", "steals")
        window = WINDOW_WORDS.get(fact.context.get("window"), "")
        return f"{who} had a {val}-game streak with {cond} {window}.".replace("  ", " ")

    return f"{who}: {val} {fact.stat_name} ({fact.stat_type})."


def draft_text(candidate: Candidate, target: int, config: dict) -> str:
    lead = config.get("draft", {}).get("lead", "{n} days — ").replace("{n}", str(target))
    return lead + _body(candidate.fact, config)


def draft_result(result: RankResult, config: dict) -> list[tuple[Candidate, str]]:
    return [(c, draft_text(c, result.target, config)) for c in result.shown]
