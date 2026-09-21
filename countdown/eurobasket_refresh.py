#!/usr/bin/env python3
"""Manual eurobasket.com / usbasket.com scraper entrypoint.

Second source alongside refresh.py (Sports-Reference). For players with no SR
college page -- overseas pros, national-team youth events. Parses the player
profile page shape saved in countdown/buikaEurobasket.html and merges the
resulting Facts into data/facts.json (source "eurobasket").

    # fetch two players by profile URL
    python3 eurobasket_refresh.py \\
        --url "https://www.eurobasket.com/player/Dovydas-Buika/660337" \\
        --url "https://www.eurobasket.com/player/Some-Other/123456"

    # parse a hand-saved page (site gating / an AJAX-only older season)
    python3 eurobasket_refresh.py --html countdown/buikaEurobasket.html \\
        --url "https://www.eurobasket.com/player/Dovydas-Buika/660337"

    # align the slug with an existing SR slug so facts merge under one player
    python3 eurobasket_refresh.py --url "<profile url>" --slug dovydas-buika-1

Only the seasons rendered in the page are read (older seasons lazy-load over
AJAX). Save those pages by hand and pass them with --html, same as SR splits.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from finder.eurobasket import fetch_player_html, parse_player, player_identity
from finder.fetcher import Fetcher
from finder.models import FactStore


def _load(fetcher: Fetcher, url: str | None, html_path: str | None, force: bool) -> str:
    if html_path:
        return Path(html_path).read_text(encoding="utf-8")
    return fetch_player_html(fetcher, url, force=force)


def run(urls: list[str], html_paths: list[str], *, slug: str | None = None,
        name: str | None = None, force: bool = False) -> int:
    targets: list[tuple[str | None, str | None]] = [(u, None) for u in urls]
    targets += [(None, h) for h in html_paths]
    if not targets:
        print("nothing to do: pass --url and/or --html", file=sys.stderr)
        return 0
    if (slug or name) and len(targets) != 1:
        print("--slug / --name only make sense with a single target", file=sys.stderr)
        return 2

    store = FactStore()
    fetcher = Fetcher()
    total = 0
    for url, html_path in targets:
        html = _load(fetcher, url, html_path, force)
        ref = url or html_path or ""
        who, auto_slug, player_id = player_identity(html, ref)
        use_slug = slug or auto_slug
        facts = parse_player(html, ref, slug=use_slug, name=name or who)
        store.merge(facts)
        total += len(facts)
        print(f"{who or ref} ({use_slug}"
              + (f", id {player_id}" if player_id else "")
              + f"): {len(facts)} facts")

    store.save()
    print(f"\nsaved {len(store.facts)} total facts -> {store.path}")
    return total


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--url", action="append", default=[], metavar="URL",
                   help="player profile URL (repeatable)")
    p.add_argument("--html", action="append", default=[], metavar="PATH",
                   help="parse a saved profile page instead of fetching (repeatable)")
    p.add_argument("--slug", help="override the player slug (single target only)")
    p.add_argument("--name", help="override the player name (single target only)")
    p.add_argument("--force-refresh", "--force", dest="force", action="store_true",
                   help="re-download even if the page is cached")
    args = p.parse_args(argv)

    if not (args.url or args.html):
        p.error("give at least one --url or --html")
    run(args.url, args.html, slug=args.slug, name=args.name, force=args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
