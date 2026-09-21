#!/usr/bin/env python3
"""Countdown suggestion CLI (Phase 4).

Match a number against cached facts, rank, and print template-drafted post text
for a human to review/edit. Nothing is posted anywhere.

    python3 suggest.py --number 62
    python3 suggest.py --number 62 --scope player --player richie-saunders-1
    python3 suggest.py --number 62 --scope roster
    python3 suggest.py --number 62 --scope team
    python3 suggest.py --number 62 --limit 10
    python3 suggest.py --number 62 --all          # every candidate, no truncation
    python3 suggest.py --number 62 --explain      # show which ranking weights fired
"""

from __future__ import annotations

import argparse
import json
import sys

from finder.config import load_config
from finder.draft import draft_result
from finder.match import _DEFAULT_LIMIT, rank_candidates
from finder.models import FactStore


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--number", type=int, required=True, help="the countdown number")
    p.add_argument("--scope", default="all", choices=["player", "roster", "team", "all"])
    p.add_argument("--player", help="Sports-Reference slug; required for --scope player")
    p.add_argument("--limit", type=int, help="override config.max_suggestions_per_number")
    p.add_argument("--all", action="store_true", help="show every candidate (no truncation)")
    p.add_argument("--explain", action="store_true", help="show which ranking weights fired")
    p.add_argument("--facts", help="path to a facts.json (default: data/facts.json)")
    args = p.parse_args(argv)

    if args.scope == "player" and not args.player:
        p.error("--scope player needs --player <slug>")

    config = load_config()
    store = FactStore(path=args.facts) if args.facts else FactStore()
    if not store.facts:
        print("no facts cached yet — run refresh.py first", file=sys.stderr)
        return 1

    limit = None if args.all else (args.limit if args.limit is not None else _DEFAULT_LIMIT)
    result = rank_candidates(
        store.facts, args.number, config, scope=args.scope,
        player_slug=args.player, limit=limit,
    )

    print(result.summary)
    print()
    for i, (cand, text) in enumerate(draft_result(result, config), 1):
        print(f"{i}. {text}")
        meta = f"   score {cand.score:.1f}"
        if cand.kind == "rounded":
            meta += "  (rounded)"
        print(meta)
        if args.explain and cand.reasons:
            print(f"   weights: {json.dumps(dict(cand.reasons))}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
