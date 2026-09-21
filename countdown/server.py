#!/usr/bin/env python3
"""Phase 7 — tiny local web UI.

Stdlib only (http.server), 127.0.0.1 only, no auth. Serves ui/index.html plus a
handful of JSON endpoints:

    GET  /api/config           current config.json
    PUT  /api/config           validate + save config.json
    POST /api/suggest          {number, scope, player, limit, all, config?}
                               -> ranked, template-drafted suggestions
                               (config in the body = live preview without saving)
    POST /api/suggest_range    {start, end, players, scope, limit, all, config?}
                               -> per-number ranked suggestions, filtered to a
                               subset of player slugs (`players`, omit for everyone
                               in scope)
    GET  /api/roster           recorded roster + per-player fact counts
    POST /api/refresh          {mode: player|roster|team, slug?, season?,
                                all_seasons?, force?} -> scrape log

Run:  python3 server.py   (then open http://127.0.0.1:8765)
"""

from __future__ import annotations

import io
import json
import contextlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from finder.config import DEFAULT_CONFIG_PATH, load_config
from finder.draft import draft_result
from finder.fetcher import Fetcher
from finder.match import _DEFAULT_LIMIT, rank_candidates, rank_range
from finder.models import FactStore
from finder.roster import ROSTER_PATH, load_active_roster, normalize_team_totals
from refresh import run_refresh

HERE = Path(__file__).resolve().parent
INDEX = HERE / "ui" / "index.html"
HOST, PORT = "127.0.0.1", 8765


def _result_json(result, config: dict) -> dict:
    return {
        "summary": result.summary,
        "total": result.total,
        "results": [
            {
                "text": text,
                "score": cand.score,
                "kind": cand.kind,
                "reasons": dict(cand.reasons),
                "player": cand.fact.player or cand.fact.player_slug or "TEAM",
                "stat": f"{cand.fact.stat_value} {cand.fact.stat_name}",
                "stat_type": cand.fact.stat_type,
                "source": cand.fact.source,
            }
            for cand, text in draft_result(result, config)
        ],
    }


def _suggest(body: dict) -> dict:
    config = body.get("config") or load_config()
    facts = FactStore().facts
    limit = None if body.get("all") else (body.get("limit") or _DEFAULT_LIMIT)
    result = rank_candidates(
        facts, int(body["number"]), config,
        scope=body.get("scope", "all"),
        player_slug=body.get("player") or None,
        limit=limit,
    )
    return _result_json(result, config)


_MAX_RANGE_SPAN = 500


def _suggest_range(body: dict) -> dict:
    config = body.get("config") or load_config()
    facts = FactStore().facts
    start, end = int(body["start"]), int(body["end"])
    if abs(end - start) + 1 > _MAX_RANGE_SPAN:
        raise ValueError(f"range too large (max {_MAX_RANGE_SPAN} numbers)")
    limit = None if body.get("all") else (body.get("limit") or _DEFAULT_LIMIT)
    players = body.get("players") or None
    results = rank_range(
        facts, start, end, config,
        scope=body.get("scope", "all"),
        player_slugs=players,
        limit=limit,
    )
    return {
        "numbers": [
            {"number": result.target, **_result_json(result, config)}
            for result in results
            if result.total or not body.get("hide_empty")
        ],
    }


def _roster() -> dict:
    active = load_active_roster()
    facts = FactStore().facts
    names: dict[str, str] = {}
    counts: dict[str, int] = {}
    for f in facts:
        if not f.player_slug:
            continue
        counts[f.player_slug] = counts.get(f.player_slug, 0) + 1
        if f.player and f.player_slug not in names:
            names[f.player_slug] = f.player

    meta = {}
    if ROSTER_PATH.exists():
        meta = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))

    slugs = sorted(set(active) | set(counts))
    return {
        "school": meta.get("school", "brigham-young"),
        "season": meta.get("season"),
        "as_of": meta.get("as_of"),
        "players": [
            {"slug": s, "name": names.get(s, s), "facts": counts.get(s, 0),
             "active": s in active}
            for s in slugs
        ],
    }


def _school_and_season(body: dict) -> tuple[str, int]:
    meta = json.loads(ROSTER_PATH.read_text(encoding="utf-8")) if ROSTER_PATH.exists() else {}
    school = meta.get("school", "brigham-young")
    season = int(body.get("season") or meta.get("season")
                 or load_config()["fetch"]["current_season"])
    return school, season


def _refresh_team_only(school: str, season: int, force: bool) -> str:
    fetcher = Fetcher()
    store = FactStore()
    html = fetcher.fetch(
        f"/cbb/schools/{school}/men/{season}.html",
        f"_teams/{school}-{season}.html", force=force,
    )
    facts = normalize_team_totals(html, season, school)
    store.merge(facts)
    store.save()
    return f"team: {school} {season} — refreshed {len(facts)} team facts\n"


def _refresh(body: dict) -> dict:
    mode = body.get("mode", "player")
    force = bool(body.get("force"))
    seasons = ["all"] if body.get("all_seasons") else None
    if body.get("season") and not body.get("all_seasons"):
        seasons = [int(body["season"])]

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        if mode == "player":
            run_refresh(player=body["slug"], seasons=seasons, force=force)
        elif mode == "team":
            school, season = _school_and_season(body)
            buf.write(_refresh_team_only(school, season, force))
        elif mode == "roster":
            school, season = _school_and_season(body)
            tracked = sorted(load_active_roster())
            # refresh exactly the tracked players (+ team page); full parse only
            # if nothing has been recorded yet
            run_refresh(players=tracked or None, roster_season=season,
                        school=school, seasons=seasons, force=force)
        else:
            raise ValueError(f"unknown refresh mode {mode!r}")

    total = len(FactStore().facts)
    return {"log": buf.getvalue().strip() or "(done)", "facts": total}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # quiet
        pass

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code: int = 200) -> None:
        self._send(code, json.dumps(obj).encode("utf-8"), "application/json")

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self) -> None:
        try:
            if self.path == "/" or self.path.startswith("/index"):
                self._send(200, INDEX.read_bytes(), "text/html; charset=utf-8")
            elif self.path == "/api/config":
                self._send(200, DEFAULT_CONFIG_PATH.read_bytes(), "application/json")
            elif self.path == "/api/roster":
                self._json(_roster())
            else:
                self._json({"error": "not found"}, 404)
        except Exception as exc:  # noqa: BLE001 - surface everything to the UI
            self._json({"error": repr(exc)}, 500)

    def do_PUT(self) -> None:
        try:
            if self.path == "/api/config":
                raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                parsed = json.loads(raw)  # validate
                DEFAULT_CONFIG_PATH.write_text(
                    json.dumps(parsed, indent=2) + "\n", encoding="utf-8"
                )
                self._json({"ok": True})
            else:
                self._json({"error": "not found"}, 404)
        except Exception as exc:  # noqa: BLE001
            self._json({"error": repr(exc)}, 400)

    def do_POST(self) -> None:
        try:
            body = self._read_body()
            if self.path == "/api/suggest":
                self._json(_suggest(body))
            elif self.path == "/api/suggest_range":
                self._json(_suggest_range(body))
            elif self.path == "/api/refresh":
                self._json(_refresh(body))
            else:
                self._json({"error": "not found"}, 404)
        except Exception as exc:  # noqa: BLE001
            self._json({"error": repr(exc)}, 500)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"countdown UI  ->  http://{HOST}:{PORT}   (Ctrl-C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
