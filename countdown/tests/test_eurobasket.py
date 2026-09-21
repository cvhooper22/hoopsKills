"""Offline tests for the eurobasket.com player scraper.

Run:  python3 -m unittest discover -s tests
No network -- everything works off the small inline HTML fixture below.
"""

from __future__ import annotations

import unittest

from finder.eurobasket import (
    _season_years,
    _unwrap_fragment,
    cache_key_for_url,
    parse_player,
    player_identity,
)

# A trimmed eurobasket profile page: one national-team single-year event and one
# two-club league season, each with a Summary/AVERAGES block and a Details block.
PROFILE_HTML = """
<html><head><title>Test Player, Basketball Player, News, Stats - Eurobasket</title></head>
<body>
<script> var strPlayerID = '999001'; </script>
<h1 class="player-title">TEST PLAYER basketball player profile</h1>

<div id="divStatsData">
<h4 class="main-head plstats-head">Season: 2026 (European Championships U20) </h4>
<div class="dvgamesstats"><table class="my_Title">
  <tr class="my_Headers"><td colspan=16><b>Summary</b></td></tr>
  <tr class="my_Headers"><td class="headcol">Team</td><td>G</td><td>MIN</td><td>PTS</td>
    <td>2FGP</td><td>3FGP</td><td>FT</td><td>RO</td><td>RD</td><td>RT</td><td>AS</td>
    <td>PF</td><td>BS</td><td>ST</td><td>TO</td><td>RNK</td></tr>
  <tr class="my_pStats2"><td class="headcol">Lithuania</td><td>3</td><td>44</td><td>16</td>
    <td>5-10</td><td>1-10</td><td>3-4</td><td>2</td><td>4</td><td>6</td><td>5</td>
    <td>3</td><td>1</td><td>2</td><td>3</td><td>9</td></tr>
  <tr class="my_Headers"><td colspan=16><b>AVERAGES</b></td></tr>
  <tr class="my_Headers"><td class="headcol">Team</td><td>G</td><td>MIN</td><td>PTS</td>
    <td>2FGP</td><td>3FGP</td><td>FT</td><td>RO</td><td>RD</td><td>RT</td><td>AS</td>
    <td>PF</td><td>BS</td><td>ST</td><td>TO</td><td>RNK</td></tr>
  <tr class="my_pStats1"><td class="headcol">Lithuania</td><td>3</td><td>14.7</td><td>5.3</td>
    <td>50.0%</td><td>10.0%</td><td>75.0%</td><td>0.7</td><td>1.3</td><td>2.0</td><td>1.7</td>
    <td>1.0</td><td>0.3</td><td>0.7</td><td>1.0</td><td>3.0</td></tr>
</table></div>

<h4 class="main-head plstats-head">Season: 2025-2026 (Lithuania-LKL) </h4>
<div class="dvgamesstats"><table class="my_Title">
  <tr class="my_Headers"><td colspan=16><b>Summary</b></td></tr>
  <tr class="my_Headers"><td class="headcol">Team</td><td>G</td><td>MIN</td><td>PTS</td>
    <td>2FGP</td><td>3FGP</td><td>FT</td><td>RO</td><td>RD</td><td>RT</td><td>AS</td>
    <td>PF</td><td>BS</td><td>ST</td><td>TO</td><td>RNK</td></tr>
  <tr class="my_pStats2"><td class="headcol">Jonava</td><td>21</td><td>316</td><td>74</td>
    <td>21-38</td><td>3-20</td><td>23-30</td><td>15</td><td>24</td><td>39</td><td>32</td>
    <td>1</td><td>0</td><td>14</td><td>13</td><td>104</td></tr>
  <tr class="my_pStats1"><td class="headcol">Zalgiris</td><td>1</td><td>5</td><td>0</td>
    <td>0-0</td><td>0-1</td><td>0-0</td><td>0</td><td>0</td><td>0</td><td>0</td>
    <td>0</td><td>0</td><td>0</td><td>2</td><td>-3</td></tr>
</table></div>

<h4 class="main-head plstats-head">Season: 2026 (European Championships U20) </h4>
<div class="dvgamesstats"><table class="my_Title">
  <tr class="my_Headers"><td colspan=18><b>Details</b></td></tr>
  <tr class="my_Headers"><td class="headcol">Date</td><td>Team</td><td>Against Team</td>
    <td>Result</td><td>MIN</td><td>PTS</td><td>2FGP</td><td>3FGP</td><td>FT</td><td>RO</td>
    <td>RD</td><td>RT</td><td>AS</td><td>PF</td><td>BS</td><td>ST</td><td>TO</td><td>RNK</td></tr>
  <tr class="my_pStats2"><td class="headcol">7/11/2026</td>
    <td><img src="x.gif"> Lithuania</td><td><img src="y.gif"> Latvia</td>
    <td><a href="/boxScores/x.aspx">105-78</a> </td>
    <td>14</td><td>7</td><td>2-3</td><td>1-4</td><td>0-0</td><td>1</td><td>0</td><td>1</td>
    <td>2</td><td>1</td><td>0</td><td>1</td><td>2</td><td>4</td></tr>
</table></div>
</div>
</body></html>
"""

URL = "https://www.eurobasket.com/player/Test-Player/999001"


class IdentityTests(unittest.TestCase):
    def test_name_from_title_slug_and_id(self):
        name, slug, player_id = player_identity(PROFILE_HTML, URL)
        self.assertEqual(name, "Test Player")
        self.assertEqual(slug, "test-player")
        self.assertEqual(player_id, "999001")

    def test_cache_key_from_url(self):
        self.assertEqual(cache_key_for_url(URL), "_eurobasket/test-player-999001.html")

    def test_season_years_from_loadstatsdata_links(self):
        html = ("<a onclick=\"loadStatsData('999001','2026');\">2026</a>"
                "<a onclick=\"loadStatsData('999001','2024');\">2024</a>")
        self.assertEqual(_season_years(html), ["2024", "2026"])

    def test_unwrap_json_fragment_and_passthrough(self):
        self.assertEqual(_unwrap_fragment('{"d": "<h4>Season: 2024</h4>"}'),
                         "<h4>Season: 2024</h4>")
        self.assertEqual(_unwrap_fragment("<h4>Season: 2024</h4>"),
                         "<h4>Season: 2024</h4>")


class ParseTests(unittest.TestCase):
    def setUp(self):
        self.facts = parse_player(PROFILE_HTML, URL)

    def _one(self, **kw):
        hits = [f for f in self.facts
                if all(getattr(f, k) == v for k, v in kw.items())]
        self.assertEqual(len(hits), 1, f"{kw} -> {hits}")
        return hits[0]

    def test_competition_is_folded_into_season_label(self):
        f = self._one(stat_type="season_total", stat_name="PTS",
                      season="2026 (European Championships U20)")
        self.assertEqual(f.stat_value, 16)
        self.assertEqual(f.source, "eurobasket")

    def test_multi_club_season_is_summed(self):
        f = self._one(stat_type="season_total", stat_name="PTS",
                      season="2025-26 (Lithuania-LKL)")
        self.assertEqual(f.stat_value, 74)  # 74 (Jonava) + 0 (Zalgiris)
        self.assertEqual(f.context["teams"], ["Jonava", "Zalgiris"])
        self.assertEqual(f.context["n_games"], 22)

    def test_made_attempt_pairs_and_derived_fg(self):
        self.assertEqual(self._one(stat_type="season_total", stat_name="3PA",
                                   season="2025-26 (Lithuania-LKL)").stat_value, 21)
        self.assertEqual(self._one(stat_type="season_total", stat_name="FG",
                                   season="2025-26 (Lithuania-LKL)").stat_value, 24)  # 21 + 3

    def test_percentage_recomputed_with_sample_size(self):
        f = self._one(stat_type="window_pct", stat_name="3P%",
                      season="2025-26 (Lithuania-LKL)")
        self.assertEqual(f.stat_value, 14.3)  # 3 / 21, not the 15.0% average
        self.assertEqual(f.sample_size, 21)
        self.assertEqual(f.context["window"], "season")

    def test_career_total_sums_every_block(self):
        f = self._one(stat_type="career_total", stat_name="PTS")
        self.assertEqual(f.stat_value, 90)  # 16 + 74 + 0
        self.assertIsNone(f.season)
        self.assertEqual(f.context["n_games"], 25)

    def test_single_game_has_opponent_and_iso_date(self):
        f = self._one(stat_type="single_game", stat_name="PTS", game_date="2026-07-11")
        self.assertEqual(f.stat_value, 7)
        self.assertEqual(f.opponent, "Latvia")
        self.assertEqual(f.context["score"], "105-78")
        self.assertEqual(f.context["team"], "Lithuania")


class OverlapTests(unittest.TestCase):
    """The initial page and the current-season AJAX fragment carry the same
    block; fetch_player_html concatenates them, so parse must not double-count."""

    def test_repeated_summary_block_counted_once(self):
        doubled = PROFILE_HTML + "\n" + PROFILE_HTML
        once = {(f.stat_name, f.stat_value) for f in parse_player(PROFILE_HTML, URL)
                if f.stat_type == "career_total"}
        twice = {(f.stat_name, f.stat_value) for f in parse_player(doubled, URL)
                 if f.stat_type == "career_total"}
        self.assertEqual(once, twice)
        pts = [f for f in parse_player(doubled, URL)
               if f.stat_type == "career_total" and f.stat_name == "PTS"]
        self.assertEqual([f.stat_value for f in pts], [90])


if __name__ == "__main__":
    unittest.main()
