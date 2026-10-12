import json
import unittest
from pathlib import Path

from finder import espn
from finder.gamescore import game_score
from finder.recent_games import _record, merge_extra, rank_games

FIX = Path(__file__).parent / "fixtures"
GAMELOG = json.loads((FIX / "espn_gamelog.json").read_text())
SUMMARY = json.loads((FIX / "espn_summary.json").read_text())
DYBANTSA = "5142718"


class UrlTests(unittest.TestCase):
    def test_recognises_both_url_forms(self):
        a = "https://www.espn.com/nba/player/gamelog/_/id/5175643/type/nba/year/2027"
        b = "https://www.espn.com/nba/player/gamelog/_/id/5142718/aj-dybantsa"
        self.assertTrue(espn.is_gamelog_url(a) and espn.is_gamelog_url(b))
        self.assertEqual(espn.parse_url(a), ("nba", "5175643", 2027))
        self.assertEqual(espn.parse_url(b), ("nba", "5142718", None))

    def test_ignores_other_espn_pages(self):
        self.assertFalse(espn.is_gamelog_url("https://www.espn.com/nba/player/_/id/5142718/aj-dybantsa"))
        self.assertFalse(espn.is_gamelog_url("https://example.com/nba/player/gamelog/_/id/5142718"))


class GamelogTests(unittest.TestCase):
    def setUp(self):
        self.boxes = {b["eventId"]: b for b in espn.parse_gamelog(GAMELOG)}

    def test_parses_box_line_and_game_info(self):
        b = self.boxes["401906510"]
        self.assertEqual((b["date"], b["opp"], b["home"]), ("2026-10-10", "DET", True))
        self.assertEqual(b["score"], "W 114-108 OT")
        self.assertEqual(b["competition"], "NBA Preseason")
        self.assertEqual((b["pts"], b["fgm"], b["fga"], b["tpm"], b["tpa"], b["ftm"], b["fta"]), (14, 4, 10, 0, 2, 6, 10))
        self.assertEqual((b["trb"], b["ast"], b["stl"], b["blk"], b["tov"], b["pf"], b["min"]), (7, 2, 1, 0, 0, 1, "23"))

    def test_away_game_is_scored_from_the_players_side(self):
        b = self.boxes["401906508"]
        self.assertEqual((b["opp"], b["home"], b["score"]), ("NY", False, "W 111-109"))

    def test_skips_games_without_minutes(self):
        data = json.loads(json.dumps(GAMELOG))
        data["seasonTypes"][0]["categories"][0]["events"][0]["stats"][0] = "0"
        self.assertEqual(len(espn.parse_gamelog(data)), 1)


class ReboundSplitTests(unittest.TestCase):
    def test_reads_oreb_dreb_for_the_player(self):
        self.assertEqual(espn.rebound_split(SUMMARY, DYBANTSA), (0, 7))

    def test_none_when_player_not_in_boxscore(self):
        self.assertIsNone(espn.rebound_split(SUMMARY, "1"))

    def test_game_score_uses_the_split(self):
        box = espn.parse_gamelog(GAMELOG)[0]
        box["orb"], box["drb"] = 0, 7
        self.assertEqual(game_score(box), 11.1)  # 14 + 1.6 - 7 - 1.6 + 2.1 + 1 + 1.4 - 0.4
        box["orb"], box["drb"] = 7, 0
        self.assertEqual(game_score(box), 13.9)  # 7 offensive boards weigh 0.7 not 0.3: +2.8


class MergeTests(unittest.TestCase):
    def entry(self, source, games, status="ok", message=""):
        return {"name": "x", "source": source, "status": status, "message": message, "games": games}

    def game(self, date, score):
        return {"date": date, "gameScore": score, "pts": 10}

    def test_tags_extra_games_and_reranks_the_union(self):
        main = self.entry("basketball-reference", [self.game("2026-10-12", 5.0)])
        extra = self.entry("espn", [self.game("2026-10-10", 11.1), self.game("2026-10-08", 3.0)])
        merged = merge_extra(main, extra, "NBA preseason", n=7, days=0)
        by_date = {g["date"]: g for g in merged["games"]}
        self.assertEqual([g["date"] for g in merged["games"]], ["2026-10-12", "2026-10-10", "2026-10-08"])
        self.assertEqual(by_date["2026-10-10"]["rank"], 1)
        self.assertEqual(by_date["2026-10-10"]["source"], "NBA preseason")
        self.assertNotIn("source", by_date["2026-10-12"])

    def test_cuts_the_union_to_the_newest_n(self):
        main = self.entry("bbr", [self.game("2026-10-12", 5.0)])
        extra = self.entry("espn", [self.game("2026-10-10", 11.1), self.game("2026-10-08", 3.0)])
        merged = merge_extra(main, extra, "NBA preseason", n=2, days=0)
        self.assertEqual([g["date"] for g in merged["games"]], ["2026-10-12", "2026-10-10"])

    def test_empty_main_takes_the_extras(self):
        main = self.entry("other", [], status="no-games")
        extra = self.entry("espn", [self.game("2026-10-10", 11.1)])
        self.assertEqual(merge_extra(main, extra, "NBA preseason", n=7, days=0)["status"], "ok")

    def test_failed_extra_adds_a_note_and_keeps_the_main_games(self):
        main = self.entry("bbr", [self.game("2026-10-12", 5.0)])
        extra = self.entry("espn", [], status="error", message="HTTP 404")
        merged = merge_extra(main, extra, "NBA preseason", n=7, days=0)
        self.assertEqual((len(merged["games"]), merged["message"]), (1, "NBA preseason: HTTP 404"))

    def test_fiba_entries_are_not_merged(self):
        main = {**self.entry("fiba3x3", []), "kind": "schedule"}
        extra = self.entry("espn", [self.game("2026-10-10", 11.1)])
        self.assertEqual(merge_extra(main, extra, "NBA preseason")["games"], [])


if __name__ == "__main__":
    unittest.main()
