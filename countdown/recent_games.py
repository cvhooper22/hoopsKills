"""Last-N games (within the last week by default) for each alum, ranked by Hollinger Game Score. Nothing is stored
unless --out is given.

    python3 recent_games.py                       # every alum with a playerUrl
    python3 recent_games.py --name "Yoeli Childs" --name "Zac Seljaas"
    python3 recent_games.py --url https://basketball.asia-basket.com/player/Yoeli-Childs/402255
    python3 recent_games.py --out recentGames.json   # JSON for the alum bucket

RealGM is Cloudflare-protected: it is fetched through a headed Chrome window via
Playwright (pip install playwright; needs Google Chrome installed). If that
fails, save the player's Game Logs page to the path the output names and re-run.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from finder.fetcher import Fetcher
from finder.recent_games import DEFAULT_DAYS, DEFAULT_N, recent_games

# The alumni list lives in S3 (edited via the /admin/alumni page) and is served publicly through
# CloudFront. Override with ALUM_JSON_URL, or pass --alum-file to use a local JSON copy.
ALUM_JSON_URL = os.environ.get("ALUM_JSON_URL", "https://dd0v7fgd2sjsh.cloudfront.net/data/alum.json")


def load_alumni(path: Path | None = None) -> list[dict]:
    if path:
        return json.loads(path.read_text(encoding="utf-8"))
    with urllib.request.urlopen(ALUM_JSON_URL, timeout=20) as res:
        return json.load(res)


def print_player(entry: dict) -> None:
    print(f'\n{entry["name"]}  [{entry["source"]}]  {entry["status"]}')
    if entry["message"]:
        print(f'  {entry["message"]}')
    if entry.get("kind") == "schedule":  # FIBA 3x3: no box lines, each game links to its boxscore
        for g in sorted(entry["games"], key=lambda g: g["rank"] or 99):
            if g["gameScore"] is None:
                score = "   unscored"
            else:
                score = f'#{g["rank"]} GmSc {g["gameScore"]:>5} ({g["gameScoreRaw"]} x{g["gameScoreScale"]:g})'
            line = "" if g["gameScore"] is None else f' {g["pts"]:>2}p {g["reb"]:>2}r {g["ast"]:>2}a fg {g["fg"]:<5} 2p {g["threes"]:<4} ft {g["ft"]:<5}'
            print(f'  {score:<32} {g["date"]}  {g["result"]:<8} vs {g["opp"]:<14}{line} {g["url"]}')
        return
    games = sorted(entry["games"], key=lambda g: g["rank"])
    for g in games:
        where = "" if g["home"] is None else ("vs" if g["home"] else "@")
        print(f'  #{g["rank"]} GmSc {g["gameScore"]:>5}  {g["date"]}  {where} {g["opp"] or "?":<14}'
              f' {g["pts"]:>2}p {g["reb"]:>2}r {g["ast"]:>2}a  fg {g["fg"]:<5} 3p {g["threes"]:<4} ft {g["ft"]:<5}'
              f' {g["result"] or ""}')


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", action="append", help="only this alum (repeatable, case-insensitive)")
    ap.add_argument("--url", help="score one stats-page URL directly (skips the alumni list)")
    ap.add_argument("--alum-file", type=Path, help="read alumni from this local JSON file instead of the public alum.json")
    ap.add_argument("-n", type=int, default=DEFAULT_N, help=f"games to keep (default {DEFAULT_N})")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS,
                    help=f"only games from the last N days (default {DEFAULT_DAYS}; 0 = no limit)")
    ap.add_argument("--include-inactive", action="store_true", help="also run alumni flagged inactive/retired")
    ap.add_argument("--json", action="store_true", help="print only the JSON payload to stdout (for the admin page)")
    ap.add_argument("--out", type=Path, help="write JSON here")
    args = ap.parse_args()

    if args.url:
        targets = [{"name": (args.name or [args.url])[0], "playerUrl": args.url}]
    else:
        wanted = {n.lower() for n in args.name or []}
        targets = [a for a in load_alumni(args.alum_file) if not wanted or a["name"].lower() in wanted]
        if not (wanted or args.include_inactive):
            targets = [a for a in targets if not a.get("inactive")]

    fetcher = Fetcher()
    players = []
    for alum in targets:
        url = alum.get("recentGamesUrl") or alum.get("playerUrl")
        if not url:
            continue
        entry = {"name": alum["name"], "playerUrl": url, **recent_games(url, fetcher, args.n, args.days, alum["name"])}
        players.append(entry)
        if not args.json:
            print_player(entry)

    payload = {"generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "gamesPerPlayer": args.n, "days": args.days, "players": players}
    if args.json:
        print(json.dumps(payload))
    if args.out:
        args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"\nwrote {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
