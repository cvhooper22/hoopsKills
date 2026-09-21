#!/usr/bin/env python3
"""Manual scraper entrypoint.

Fetch player overview + game logs, parse any hand-saved splits HTML in
cache/{slug}/, run the derivation engine, and merge everything into
data/facts.json. The local HTML cache is durable -- a page already cached is
reused unless --force-refresh is passed.

    # one player
    python3 refresh.py --player richie-saunders-1
    python3 refresh.py --player richie-saunders-1 --season 2025
    python3 refresh.py --player richie-saunders-1 --all-seasons --force-refresh

    # several players by slug
    python3 refresh.py --players robert-wright-3 nate-pickens-1 --all-seasons

    # resolve BYU names off the team roster page, plus extra slugs
    python3 refresh.py --roster-season 2026 \\
        --names "Robert Wright" "Dawson Baker" --players tyler-betsey-1

    # the whole roster for a season
    python3 refresh.py --roster-season 2026 --all-seasons
"""

from __future__ import annotations

import argparse
import re
import sys

from finder.config import load_config
from finder.derive import derive_player_facts
from finder.extractor import extract_tables
from finder.fetcher import CACHE_ROOT, Fetcher
from finder.models import FactStore
from finder.normalizer import (
    normalize_gamelog,
    normalize_overview,
    normalize_splits,
    player_name_from_html,
    season_label,
)
from finder.roster import (
    normalize_team_totals,
    parse_roster,
    resolve_slugs,
    save_active_roster,
)


def discover_seasons(overview_html: str) -> list[int]:
    """End-years (2025 == 2024-25) from the overview per-game table's gamelog links."""
    per_game = extract_tables(overview_html).get("players_per_game")
    years: list[int] = []
    if per_game:
        for links in per_game.links:
            href = links.get("year_id", "")
            if "/gamelog/" in href:
                try:
                    years.append(int(href.rstrip("/").split("/")[-1]))
                except ValueError:
                    pass
    return sorted(set(years))


def load_cached_splits(slug: str, name: str, min_games: int = 1) -> list:
    """Parse any hand-saved splits HTML in cache/{slug}/.

    Recognised: splits_totals.html (career) and splits_totals_<YYYY>.html
    (that season). Files with 'per_game' in the name are skipped.
    """
    folder = CACHE_ROOT / slug
    if not folder.is_dir():
        return []
    facts: list = []
    for path in sorted(folder.glob("splits*.html")):
        if "per_game" in path.name:
            continue
        year_match = re.search(r"(\d{4})", path.name)
        season = season_label(year_match.group(1)) if year_match else None
        got = normalize_splits(path.read_text(encoding="utf-8"), slug, season, name, min_games)
        print(f"  splits [{path.name}] {season or 'career'}: {len(got)} facts")
        facts += got
    return facts


def build_player_facts(store: FactStore, fetcher: Fetcher, config: dict,
                       slug: str, seasons: list | None, force: bool,
                       derive: bool = True) -> None:
    overview_html = fetcher.fetch(
        f"/cbb/players/{slug}.html", f"{slug}/overview.html", force=force
    )
    name = player_name_from_html(overview_html)
    print(f"player: {name} ({slug})")

    overview_facts = normalize_overview(overview_html, slug, name)
    store.merge(overview_facts)
    print(f"  overview: {len(overview_facts)} facts")

    all_seasons = discover_seasons(overview_html)
    if seasons is None:
        target = all_seasons[-1:] if all_seasons else []
    elif seasons == ["all"]:
        target = all_seasons
    else:
        target = [int(s) for s in seasons]
    if not target:
        print(f"  no seasons found to crawl for {slug}", file=sys.stderr)

    for year in target:
        html = fetcher.fetch(
            f"/cbb/players/{slug}/gamelog/{year}", f"{slug}/gamelog-{year}.html", force=force
        )
        gl_facts = normalize_gamelog(html, slug, year, name)
        store.merge(gl_facts)
        print(f"  gamelog {year} ({season_label(year)}): {len(gl_facts)} facts")

    split_facts = load_cached_splits(slug, name, config.get("splits", {}).get("min_games", 1))
    store.merge(split_facts)

    if derive:
        current_end = config.get("fetch", {}).get("current_season", 2026)
        dims = ["class_year"] if split_facts else None
        derived = derive_player_facts(store.facts, slug, config, current_end, derived_split_dims=dims)
        store.merge(derived)
        print(f"  derived: {len(derived)} facts")


def resolve_targets(fetcher: Fetcher, store: FactStore, force: bool, *,
                    player: str | None = None, players: list[str] | None = None,
                    names: list[str] | None = None, roster_season: int | None = None,
                    school: str = "brigham-young") -> list[str]:
    """Turn player/players/names/roster_season into an ordered slug list."""
    slugs: list[str] = list(players or [])
    if player:
        slugs.append(player)

    if roster_season:
        roster_html = fetcher.fetch(
            f"/cbb/schools/{school}/men/{roster_season}.html",
            f"_teams/{school}-{roster_season}.html",
            force=force,
        )
        team_facts = normalize_team_totals(roster_html, roster_season, school)
        store.merge(team_facts)
        print(f"team: {school} {roster_season} — {len(team_facts)} team facts")

        if names:
            resolved, missing = resolve_slugs(roster_html, names)
            for name, slug in resolved.items():
                print(f"  resolved {name!r} -> {slug}")
                slugs.append(slug)
            for name in missing:
                print(f"  !! could not resolve {name!r} on the {school} {roster_season} roster",
                      file=sys.stderr)
        elif not slugs:
            slugs = [e.slug for e in parse_roster(roster_html)]
            print(f"  full roster: {len(slugs)} players")

    seen: set[str] = set()
    return [s for s in slugs if not (s in seen or seen.add(s))]


def run_refresh(*, player=None, players=None, names=None, roster_season=None,
                school="brigham-young", seasons=None, force=False, derive=True) -> int:
    """Shared entry point for the CLI and the Phase 7 UI. Returns a facts count."""
    config = load_config()
    store = FactStore()
    fetcher = Fetcher()

    slugs = resolve_targets(fetcher, store, force, player=player, players=players,
                            names=names, roster_season=roster_season, school=school)
    if not slugs and not roster_season:
        print("no players to refresh", file=sys.stderr)
        return 0

    if roster_season:
        save_active_roster(slugs, school, roster_season)
        print(f"recorded {len(slugs)} slug(s) as active roster -> data/roster.json")

    for slug in slugs:
        build_player_facts(store, fetcher, config, slug, seasons, force, derive=derive)

    store.save()
    print(f"\nsaved {len(store.facts)} total facts across {len(slugs)} player(s) -> {store.path}")
    return len(store.facts)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--player", help="a single Sports-Reference slug")
    parser.add_argument("--players", nargs="+", metavar="SLUG", help="several slugs")
    parser.add_argument("--names", nargs="+", metavar="NAME",
                        help="display names to resolve via --roster-season's roster page")
    parser.add_argument("--roster-season", type=int, metavar="YEAR",
                        help="team season page (end-year) for name resolution / full crawl")
    parser.add_argument("--school", default="brigham-young", help="school slug (default brigham-young)")

    group = parser.add_mutually_exclusive_group()
    group.add_argument("--season", type=int, action="append",
                       help="end-year, e.g. 2025 for 2024-25 (repeatable)")
    group.add_argument("--all-seasons", action="store_true",
                       help="crawl every season on each overview page")

    parser.add_argument("--force-refresh", "--force", dest="force", action="store_true",
                        help="re-download even if a page is cached")
    parser.add_argument("--no-derive", action="store_true", help="skip the derivation engine")
    args = parser.parse_args(argv)

    if not (args.player or args.players or args.roster_season):
        parser.error("give --player, --players, and/or --roster-season")
    if args.names and not args.roster_season:
        parser.error("--names needs --roster-season to resolve against")

    seasons: list | None = ["all"] if args.all_seasons else (args.season or None)
    run_refresh(player=args.player, players=args.players, names=args.names,
                roster_season=args.roster_season, school=args.school,
                seasons=seasons, force=args.force, derive=not args.no_derive)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
