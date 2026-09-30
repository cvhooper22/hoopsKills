import unittest
from pathlib import Path

from finder import eurobasket
from finder.gamescore import game_score
from datetime import date
from finder.recent_games import (window_start, _enough, _bbr_games, _bbr_soup, parse_realgm_gamelog, rank_games,
                                 realgm_gamelog_url, realgm_saved_path)

BBR_ROW = ('<table id="pgl_basic"><tbody><tr>'
           '<td data-stat="date_game">2023-05-07</td><td data-stat="team_name">Real Madrid</td>'
           '<td data-stat="game_location">@</td><td data-stat="opp_name">Unicaja</td>'
           '<td data-stat="game_result">W</td><td data-stat="mp">10:00</td>'
           '<td data-stat="fg">7</td><td data-stat="fga">14</td><td data-stat="fg3">4</td><td data-stat="fg3a">9</td>'
           '<td data-stat="ft">6</td><td data-stat="fta">8</td><td data-stat="orb">0</td><td data-stat="drb">0</td>'
           '<td data-stat="trb">0</td><td data-stat="ast">3</td><td data-stat="stl">0</td><td data-stat="blk">0</td>'
           '<td data-stat="tov">0</td><td data-stat="pf">0</td><td data-stat="pts">24</td>'
           '<td data-stat="game_score">%s</td></tr>'
           '<tr><td data-stat="date_game">2023-05-09</td><td data-stat="reason">Inactive</td></tr>'
           '</tbody></table>')

REALGM = """<table><thead><tr>%s</tr></thead><tbody>
<tr><td>7/17/2026</td><td>Cavaliers</td><td>Bulls</td><td>W</td><td>Starter</td><td>PF</td><td>13:16</td><td>6</td><td>2</td><td>4</td><td>.500</td><td>2</td><td>4</td><td>.500</td><td>0</td><td>0</td><td>.000</td><td>0</td><td>0</td><td>0</td><td>1</td><td>0</td><td>1</td><td>0</td><td>1</td><td>4.5</td></tr>
<tr><td>7/12/2026</td><td>Cavaliers</td><td>Pistons</td><td>L</td><td>Bench</td><td>PF</td><td>21:15</td><td>6</td><td>2</td><td>5</td><td>.400</td><td>2</td><td>5</td><td>.400</td><td>0</td><td>0</td><td>.000</td><td>0</td><td>3</td><td>3</td><td>2</td><td>2</td><td>1</td><td>2</td><td>4</td><td>5.5</td></tr>
<tr><td>7/1/2026</td><td>Cavaliers</td><td>Suns</td><td>W</td><td>DNP</td><td></td><td></td><td></td></tr>
</tbody></table>""" % "".join(f"<th>{h}</th>" for h in
    "Date Team Opponent W/L Status Pos MIN PTS FGM FGA FG% 3PM 3PA 3P% FTM FTA FT% ORB DRB REB AST STL BLK TOV PF FIC".split())

EB = """<h4>Season: 2026-27 (Japan-B.Premier League)</h4><div class="dvgamesstats"><table>
<tr class="my_Headers"><td><b>Details</b></td></tr>
<tr class="my_Headers"><td>Date</td><td>Team</td><td>Against Team</td><td>Result</td><td>MIN</td><td>PTS</td><td>2FGP</td><td>3FGP</td><td>FT</td><td>RO</td><td>RD</td><td>RT</td><td>AS</td><td>PF</td><td>BS</td><td>ST</td><td>TO</td><td>RNK</td></tr>
<tr><td>9/27/2026</td><td>Kobe</td><td>Osaka</td><td>84-78</td><td>38</td><td>20</td><td>2-11</td><td>1-2</td><td>13-15</td><td>4</td><td>8</td><td>12</td><td>5</td><td>3</td><td>0</td><td>2</td><td>4</td><td>28</td></tr>
<tr><td>9/28/2026</td><td>Kobe</td><td>Nagoya</td><td>0-0</td><td>0</td><td>0</td><td>-</td><td>-</td><td>-</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
</table></div>"""


class GameScoreTests(unittest.TestCase):
    def test_formula(self):
        box = dict(pts=24, fgm=7, fga=14, ftm=6, fta=8, orb=0, drb=0, stl=0, ast=3, blk=0, pf=0, tov=0)
        self.assertEqual(game_score(box), 24 + 2.8 - 9.8 - 0.8 + 2.1)

    def test_matches_bbr_published_value(self):
        # 24 + 2.8 - 9.8 - 0.8 + 2.1 = 18.3
        g = _bbr_games(_bbr_soup(BBR_ROW % "18.3"), ("pgl_basic",), None)
        self.assertEqual(len(g), 1)  # inactive row skipped
        self.assertEqual(g[0]["gameScore"], 18.3)
        self.assertIs(g[0]["home"], False)

    def test_bbr_falls_back_to_computed(self):
        g = _bbr_games(_bbr_soup(BBR_ROW % ""), ("pgl_basic",), None)
        self.assertEqual(g[0]["gameScore"], 18.3)


class EurobasketTests(unittest.TestCase):
    def test_game_log_computes_box_and_skips_dnp(self):
        games = eurobasket.game_log(EB)
        self.assertEqual(len(games), 1)
        g = games[0]
        self.assertEqual((g["fgm"], g["fga"], g["tpm"], g["ftm"], g["fta"]), (3, 13, 1, 13, 15))
        self.assertEqual(game_score(g), 16.8)  # matches the live Childs 9/27 row (RNK 28 is eurobasket's own index)
        self.assertEqual(eurobasket.season_end_years(EB), {2027})

    def test_fixture_file_has_games(self):
        html = (Path(__file__).resolve().parent.parent / "buikaEurobasket.html").read_text(encoding="utf-8")
        games = eurobasket.game_log(html)
        self.assertTrue(games)
        self.assertEqual(games, sorted(games, key=lambda g: g["date"], reverse=True))


class RealgmTests(unittest.TestCase):
    def test_parse_and_skip_dnp(self):
        games = parse_realgm_gamelog(REALGM)
        self.assertEqual([g["date"] for g in games], ["2026-07-17", "2026-07-12"])
        self.assertEqual(games[1]["reb"], 3)
        self.assertEqual(games[1]["result"], "L")

    def test_urls(self):
        u = "https://basketball.realgm.com/player/Jax-Robinson/GameLogs/151236"
        self.assertEqual(realgm_gamelog_url(u), u)
        self.assertEqual(realgm_gamelog_url("https://basketball.realgm.com/player/Keba-Keita/NBA/176341/Career/By_Split"),
                         "https://basketball.realgm.com/player/Keba-Keita/GameLogs/176341")
        self.assertTrue(str(realgm_saved_path(Path("/c"), u)).endswith("_recent/realgm/151236.html"))


class RankTests(unittest.TestCase):
    def test_newest_n_then_rank_by_game_score(self):
        games = [{"date": f"2026-01-{d:02d}", "gameScore": s, "pts": 0} for d, s in
                 [(1, 99.0), (2, 5.0), (3, 9.0), (4, 1.0)]]
        recent = rank_games(games, 3)
        self.assertEqual([g["date"] for g in recent], ["2026-01-04", "2026-01-03", "2026-01-02"])
        self.assertEqual({g["date"]: g["rank"] for g in recent},
                         {"2026-01-03": 1, "2026-01-02": 2, "2026-01-04": 3})


class WindowTests(unittest.TestCase):
    def test_window_start(self):
        self.assertEqual(window_start(7, date(2026, 9, 29)), "2026-09-22")
        self.assertIsNone(window_start(0))

    def test_rank_drops_games_before_window(self):
        games = [{"date": d, "gameScore": s, "pts": 0} for d, s in
                 [("2026-09-20", 50.0), ("2026-09-23", 5.0), ("2026-09-28", 9.0)]]
        kept = rank_games(games, 7, "2026-09-22")
        self.assertEqual([g["date"] for g in kept], ["2026-09-28", "2026-09-23"])
        self.assertEqual(kept[0]["rank"], 1)

    def test_stop_paging_once_window_passed(self):
        self.assertTrue(_enough([{"date": "2026-05-01"}], 7, "2026-09-22"))
        self.assertFalse(_enough([{"date": "2026-09-25"}], 7, "2026-09-22"))


if __name__ == "__main__":
    unittest.main()


class Fiba3x3Tests(unittest.TestCase):
    URL = "https://worldtour.fiba3x3.com/2026/deqing/teams/174bbdf1-b357-4b19-ab05-ac3c510ac38b"

    def test_team_page_games_carry_their_own_day(self):
        from finder import fiba3x3
        html = (Path(__file__).resolve().parent / "fixtures" / "fiba3x3_team_page.html").read_text(encoding="utf-8")
        games = fiba3x3.parse_team_page(html, self.URL)
        self.assertEqual([(g["date"], g["opp"], g["result"]) for g in games], [
            ("2026-09-27", "Antwerp", "L 18-21"),
            ("2026-09-26", "Toulouse", "W 21-19"),
            ("2026-09-26", "Taipei WanBao", "W 21-18"),
        ])
        self.assertEqual(games[0]["url"], "https://worldtour.fiba3x3.com/2026/deqing/games/0278e465-9eb7-4025-832d-9bcbcfcad621")
        self.assertEqual(games[0]["round"], "Quarter-Finals")

    def test_only_team_pages_match(self):
        from finder import fiba3x3
        self.assertTrue(fiba3x3.is_team_page(self.URL))
        self.assertFalse(fiba3x3.is_team_page("https://play.fiba3x3.com/players/13845922-6dbd-4257-a072-a27b34c4fe2f/activity"))


class Fiba3x3ScoreTests(unittest.TestCase):
    HTML = (Path(__file__).resolve().parent / "fixtures" / "fiba3x3_boxscore.html").read_text(encoding="utf-8")

    def test_parse_boxscore_maps_line(self):
        from finder import fiba3x3
        b = fiba3x3.parse_boxscore(self.HTML, "Jimmer Fredette")
        self.assertEqual((b["pts"], b["fgm"], b["fga"], b["tpm"], b["tpa"], b["ftm"], b["fta"]), (8, 3, 9, 3, 6, 2, 2))
        self.assertEqual((b["orb"], b["drb"], b["trb"], b["ast"], b["blk"], b["tov"], b["stl"], b["pf"]), (0, 1, 1, 1, 0, 2, 0, 0))
        self.assertEqual(b["pval"], 5.3)

    def test_name_match_ignores_accents_case_and_falls_back_to_last_name(self):
        from finder import fiba3x3
        self.assertEqual(fiba3x3.parse_boxscore(self.HTML, "JIMMER FREDETTÉ")["pts"], 8)
        self.assertEqual(fiba3x3.parse_boxscore(self.HTML, "J. Fredette")["pts"], 8)
        self.assertIsNone(fiba3x3.parse_boxscore(self.HTML, "Nobody Here"))

    def test_scaled_score_is_raw_times_constant(self):
        from finder import fiba3x3
        from finder.gamescore import game_score_3x3, SCALE_3X3
        gs = game_score_3x3(fiba3x3.parse_boxscore(self.HTML, "Jimmer Fredette"))
        self.assertEqual(gs["raw"], 1.9)
        self.assertEqual(gs["scaled"], round(1.9 * SCALE_3X3, 1))
        self.assertEqual(game_score_3x3(fiba3x3.parse_boxscore(self.HTML, "Riley Battin"), scale=4)["scaled"], 22.0)

    def test_score_games_ranks_scored_and_reports_missing(self):
        from unittest import mock
        from finder import recent_games as rg
        games = [{"date": "2026-09-26", "opp": "A", "url": "u1"}, {"date": "2026-09-27", "opp": "B", "url": "u2"}]
        fetcher = mock.Mock(min_interval=0)
        # game 1: Battin's real line (raw 5.5); game 2: Jimmer's line (raw 1.9) filed under Battin's name
        second = self.HTML.replace("Riley Battin", "Zed Zed").replace("Jimmer Fredette", "Riley Battin")
        with mock.patch.object(rg.fiba3x3, "fetch_page", side_effect=[self.HTML, second]):
            out, msg = rg._score_fiba_games(games, fetcher, "Riley Battin")
        self.assertEqual([(g["gameScoreRaw"], g["rank"]) for g in out], [(5.5, 1), (1.9, 2)])
        self.assertEqual(msg, "")
        with mock.patch.object(rg.fiba3x3, "fetch_page", return_value=self.HTML):
            out, msg = rg._score_fiba_games([{"date": "2026-09-27", "opp": "A", "url": "u1"}], fetcher, "Nobody Here")
        self.assertIsNone(out[0]["gameScore"])
        self.assertIn("no boxscore line", msg)
