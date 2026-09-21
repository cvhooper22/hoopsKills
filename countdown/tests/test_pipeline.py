"""Offline tests for extractor / normalizer / derive.

Run:  python3 -m unittest discover -s tests
No network -- everything works off small inline HTML fixtures.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from finder.config import load_config
from finder.derive import derive_player_facts
from finder.extractor import extract_tables
from finder.draft import draft_text, _body
from finder.match import (
    Candidate,
    find_matches,
    in_scope,
    match_kind,
    rank_candidates,
    rank_range,
)
from finder.models import Fact, FactStore
from finder.roster import (
    load_active_roster,
    normalize_team_totals,
    parse_roster,
    resolve_slugs,
    save_active_roster,
)
from finder.normalizer import normalize_gamelog, normalize_overview, normalize_splits

# A live table + a table hidden in an HTML comment (SR's documented gotcha),
# the hidden one also carrying a <tfoot> career row.
OVERVIEW_HTML = """
<html><body>
<h1>Test Player</h1>
<table id="players_per_game"><tbody>
  <tr><th data-stat="year_id"><a href="/cbb/players/tp-1/gamelog/2024">2023-24</a></th>
      <td data-stat="class">FR</td><td data-stat="pts">10</td></tr>
  <tr><th data-stat="year_id"><a href="/cbb/players/tp-1/gamelog/2025">2024-25</a></th>
      <td data-stat="class">SO</td><td data-stat="pts">15</td></tr>
</tbody></table>
<!--
<table id="players_totals"><tbody>
  <tr><th data-stat="year_id">2023-24</th><td data-stat="class">FR</td>
      <td data-stat="pts">100</td><td data-stat="fg3">20</td>
      <td data-stat="fg3a">50</td><td data-stat="fg3_pct">.400</td></tr>
  <tr><th data-stat="year_id">2024-25</th><td data-stat="class">SO</td>
      <td data-stat="pts">150</td><td data-stat="fg3">30</td>
      <td data-stat="fg3a">60</td><td data-stat="fg3_pct">.500</td></tr>
</tbody>
<tfoot>
  <tr><th data-stat="year_id">Career</th><td data-stat="pts">250</td>
      <td data-stat="fg3">50</td><td data-stat="fg3a">110</td>
      <td data-stat="fg3_pct">.455</td></tr>
</tfoot></table>
-->
</body></html>
"""

GAMELOG_HTML = """
<html><body><h1>Test Player</h1>
<table id="player_game_log"><tbody>
  <tr><th data-stat="ranker">1</th><td data-stat="date">2024-11-01</td>
      <td data-stat="game_location"></td><td data-stat="opp_name_abbr">Alpha</td>
      <td data-stat="game_type">REG (Non-Conf)</td><td data-stat="game_result">W 80-70</td>
      <td data-stat="is_starter">*</td><td data-stat="pts">12</td><td data-stat="stl">4</td>
      <td data-stat="fg3">3</td></tr>
  <tr><th data-stat="ranker">2</th><td data-stat="date">2024-11-05</td>
      <td data-stat="game_location">@</td><td data-stat="opp_name_abbr">Beta</td>
      <td data-stat="game_type">REG (Non-Conf)</td><td data-stat="game_result">L 60-75</td>
      <td data-stat="is_starter"></td><td data-stat="pts">11</td><td data-stat="stl">2</td>
      <td data-stat="fg3">1</td></tr>
  <tr><th data-stat="ranker">3</th><td data-stat="date">2024-11-05</td>
      <td data-stat="game_location">N</td><td data-stat="opp_name_abbr">Gamma</td>
      <td data-stat="game_type">REG (Non-Conf)</td><td data-stat="game_result">W 90-88</td>
      <td data-stat="is_starter">*</td><td data-stat="pts">20</td><td data-stat="stl">1</td>
      <td data-stat="fg3">5</td></tr>
</tbody></table></body></html>
"""


# SR splits table: split_id only on the first row of each group; a "Total" row.
SPLITS_HTML = """
<html><body><h1>Test Player</h1>
<table id="splits"><tbody>
  <tr><th data-stat="split_id">Total</th><td data-stat="split_value"></td>
      <td data-stat="g">50</td><td data-stat="pts">500</td>
      <td data-stat="fg3">60</td><td data-stat="fg3a">150</td><td data-stat="fg3_pct">.400</td></tr>
  <tr><th data-stat="split_id">Location</th><td data-stat="split_value">Home</td>
      <td data-stat="g">28</td><td data-stat="pts">300</td>
      <td data-stat="fg3">40</td><td data-stat="fg3a">90</td><td data-stat="fg3_pct">.444</td></tr>
  <tr><th data-stat="split_id"></th><td data-stat="split_value">Away</td>
      <td data-stat="g">22</td><td data-stat="pts">200</td>
      <td data-stat="fg3">20</td><td data-stat="fg3a">60</td><td data-stat="fg3_pct">.333</td></tr>
  <tr><th data-stat="split_id">vs. Team</th><td data-stat="split_value">Gonzaga</td>
      <td data-stat="g">1</td><td data-stat="pts">4</td>
      <td data-stat="fg3">1</td><td data-stat="fg3a">3</td><td data-stat="fg3_pct">.333</td></tr>
  <tr><th data-stat="split_id"></th><td data-stat="split_value">Baylor</td>
      <td data-stat="g">4</td><td data-stat="pts">55</td>
      <td data-stat="fg3">9</td><td data-stat="fg3a">18</td><td data-stat="fg3_pct">.500</td></tr>
</tbody></table></body></html>
"""


class ExtractorTests(unittest.TestCase):
    def test_pulls_table_from_html_comment(self):
        tables = extract_tables(OVERVIEW_HTML)
        self.assertIn("players_totals", tables)  # hidden in a comment
        self.assertIn("players_per_game", tables)  # live in the DOM

    def test_reads_tfoot_career_row(self):
        totals = extract_tables(OVERVIEW_HTML)["players_totals"]
        years = [r["year_id"] for r in totals.rows]
        self.assertEqual(years, ["2023-24", "2024-25", "Career"])

    def test_captures_cell_links(self):
        per_game = extract_tables(OVERVIEW_HTML)["players_per_game"]
        self.assertEqual(per_game.links[0]["year_id"], "/cbb/players/tp-1/gamelog/2024")


class NormalizerTests(unittest.TestCase):
    def test_overview_season_and_career_totals(self):
        facts = normalize_overview(OVERVIEW_HTML, "tp-1")
        career_pts = [f for f in facts if f.stat_type == "career_total" and f.stat_name == "PTS"]
        self.assertEqual(career_pts[0].stat_value, 250)
        season_pts = {f.season: f.stat_value for f in facts
                      if f.stat_type == "season_total" and f.stat_name == "PTS"}
        self.assertEqual(season_pts, {"2023-24": 100, "2024-25": 150})

    def test_overview_pct_carries_sample_size(self):
        facts = normalize_overview(OVERVIEW_HTML, "tp-1")
        career_3p = [f for f in facts if f.stat_type == "window_pct"
                     and f.stat_name == "3P%" and f.season is None][0]
        self.assertEqual(career_3p.stat_value, 45.5)
        self.assertEqual(career_3p.sample_size, 110)

    def test_gamelog_context(self):
        facts = normalize_gamelog(GAMELOG_HTML, "tp-1", 2025)
        g1 = [f for f in facts if f.game_date == "2024-11-01" and f.stat_name == "PTS"][0]
        self.assertEqual(g1.stat_value, 12)
        self.assertEqual(g1.opponent, "Alpha")
        self.assertEqual(g1.context["result"], "W")
        self.assertEqual(g1.context["location"], "home")
        self.assertTrue(g1.context["started"])


class SplitsTests(unittest.TestCase):
    def test_forward_fills_group_and_skips_total(self):
        facts = normalize_splits(SPLITS_HTML, "tp-1", season=None)
        cats = {f.context["split_category"] for f in facts}
        self.assertIn("location:Home", cats)
        self.assertIn("location:Away", cats)  # split_id was blank on this row
        self.assertNotIn("Total:", " ".join(cats))

    def test_pct_carries_sample_size(self):
        facts = normalize_splits(SPLITS_HTML, "tp-1")
        home_3p = [f for f in facts if f.context["split_category"] == "location:Home"
                   and f.stat_name == "3P%"][0]
        self.assertEqual(home_3p.stat_value, 44.4)
        self.assertEqual(home_3p.sample_size, 90)
        self.assertEqual(home_3p.stat_type, "career_split")
        self.assertEqual(home_3p.source, "splits")

    def test_min_games_drops_thin_rows(self):
        facts = normalize_splits(SPLITS_HTML, "tp-1", min_games=2)
        teams = {f.context["split_category"] for f in facts
                 if f.context["split_category"].startswith("vs_team:")}
        self.assertEqual(teams, {"vs_team:Baylor"})  # Gonzaga (1 game) dropped

    def test_season_scoped_split_tags_season(self):
        facts = normalize_splits(SPLITS_HTML, "tp-1", season="2025-26")
        self.assertTrue(all(f.season == "2025-26" for f in facts))


class DeriveTests(unittest.TestCase):
    def setUp(self):
        self.config = load_config()
        self.facts = (normalize_overview(OVERVIEW_HTML, "tp-1")
                      + normalize_gamelog(GAMELOG_HTML, "tp-1", 2025))

    def test_doubleheader_not_collapsed(self):
        derived = derive_player_facts(self.facts, "tp-1", self.config, 2025)
        career_pts = [f for f in derived if f.stat_type == "window_total"
                      and f.stat_name == "PTS" and f.context["window"] == "career"][0]
        self.assertEqual(career_pts.context["n_games"], 3)  # two games share 2024-11-05
        self.assertEqual(career_pts.stat_value, 43)  # 12 + 11 + 20

    def test_threshold_count(self):
        derived = derive_player_facts(self.facts, "tp-1", self.config, 2025)
        stl4 = [f for f in derived if f.stat_type == "threshold_count"
                and f.stat_name == "STL" and f.context["threshold"] == 4]
        self.assertEqual(stl4[0].stat_value, 1)

    def test_streak_longest_run(self):
        derived = derive_player_facts(self.facts, "tp-1", self.config, 2025)
        pts_streak = [f for f in derived if f.stat_type == "streak"
                      and f.stat_name == "PTS" and f.context["window"] == "career"][0]
        self.assertEqual(pts_streak.stat_value, 3)  # 12, 11, 20 all >= 10

    def test_class_year_split(self):
        derived = derive_player_facts(self.facts, "tp-1", self.config, 2025)
        so_pts = [f for f in derived if f.stat_type == "career_split"
                  and f.stat_name == "PTS" and f.context["split_category"] == "class_year:SO"]
        self.assertEqual(so_pts[0].stat_value, 43)  # all 3 games are 2024-25 = SO


class MatchTests(unittest.TestCase):
    def setUp(self):
        self.config = load_config()
        self.facts = [
            Fact("PTS", 62, "single_game", player_slug="a", player="A", season="2025-26",
                 game_date="2026-01-01", opponent="Zed", source="gamelog"),
            Fact("PTS", 62, "career_total", player_slug="b", player="B", source="overview"),
            Fact("3P%", 61.7, "window_pct", player_slug="b", player="B", season=None,
                 sample_size=400, source="derived", context={"window": "career"}),
            Fact("3P%", 62.0, "career_split", player_slug="c", player="C", sample_size=3,
                 source="splits", context={"split_category": "vs_team:Zed"}),
            Fact("STL", 500, "season_total", scope="team",
                 player_slug=None, season="2025-26", source="overview"),
        ]

    def test_match_kind(self):
        self.assertEqual(match_kind(self.facts[0], 62), "exact")
        self.assertEqual(match_kind(self.facts[2], 62), "rounded")  # 61.7 -> 62
        self.assertIsNone(match_kind(self.facts[0], 61))

    def test_scope_filtering(self):
        self.assertEqual(len(in_scope(self.facts, "player", "a")), 1)
        self.assertEqual(len(in_scope(self.facts, "team")), 1)
        self.assertEqual(len(in_scope(self.facts, "roster")), 4)
        self.assertEqual(len(in_scope(self.facts, "all")), 5)
        with self.assertRaises(ValueError):
            in_scope(self.facts, "player")

    def test_find_matches_rounds_percentages(self):
        matched = find_matches(self.facts, 62, scope="roster")
        names = sorted((f.stat_name, f.stat_type) for f in matched)
        self.assertIn(("3P%", "window_pct"), names)
        self.assertIn(("PTS", "single_game"), names)

    def test_low_number_favours_single_game_over_career_total(self):
        low = [
            Fact("STL", 5, "single_game", player_slug="a", player="A", season="2025-26",
                 game_date="2026-01-01", opponent="Zed", source="gamelog"),
            Fact("BLK", 5, "career_total", player_slug="a", player="A", source="overview"),
        ]
        res = rank_candidates(low, 5, self.config, scope="roster", active={"a"}, limit=None)
        top = res.shown[0].fact
        self.assertEqual(top.stat_type, "single_game")  # low_number_bonus + single_game_bonus

    def test_high_number_favours_career_total(self):
        res = rank_candidates(self.facts, 62, self.config, scope="roster",
                              active={"a", "b"}, limit=None)
        top = res.shown[0].fact
        self.assertEqual(top.stat_type, "career_total")  # high_number_bonus

    def test_small_sample_pct_is_penalised(self):
        res = rank_candidates(self.facts, 62, self.config, scope="roster", limit=None)
        vs_zed = [c for c in res.shown if c.fact.source == "splits"][0]
        self.assertLess(vs_zed.score, 0)
        self.assertIn("pct_below_min_sample_penalty", dict(vs_zed.reasons))

    def test_limit_and_summary(self):
        full = rank_candidates(self.facts, 62, self.config, scope="roster", limit=None)
        self.assertEqual(full.summary, f"{full.total} candidates found")
        capped = rank_candidates(self.facts, 62, self.config, scope="roster", limit=2)
        self.assertEqual(len(capped.shown), 2)
        self.assertEqual(capped.summary, f"{full.total} candidates found, showing top 2")

    def test_default_limit_reads_config(self):
        res = rank_candidates(self.facts, 62, self.config, scope="roster")
        self.assertLessEqual(len(res.shown), self.config["max_suggestions_per_number"])

    def test_player_slugs_filters_a_subset(self):
        matched = find_matches(self.facts, 62, scope="roster", player_slugs={"b"})
        self.assertTrue(all(f.player_slug == "b" for f in matched))
        self.assertEqual(len(in_scope(self.facts, "roster", player_slugs={"a", "c"})), 2)

    def test_rank_range_covers_every_number_and_respects_subset(self):
        results = rank_range(self.facts, 61, 63, self.config, scope="roster",
                             player_slugs={"b"}, limit=None)
        self.assertEqual([r.target for r in results], [61, 62, 63])
        totals = {r.target: r.total for r in results}
        self.assertEqual(totals[61], 0)
        self.assertEqual(totals[62], 2)  # b's career_total PTS + b's rounded 3P%
        self.assertEqual(totals[63], 0)

    def test_rank_range_swaps_reversed_bounds(self):
        results = rank_range(self.facts, 63, 61, self.config, scope="roster", limit=None)
        self.assertEqual([r.target for r in results], [61, 62, 63])


class DraftTests(unittest.TestCase):
    def setUp(self):
        self.config = load_config()

    def _body(self, fact):
        return _body(fact, self.config)

    def test_single_game_template(self):
        f = Fact("PTS", 30, "single_game", player="Richie Saunders", player_slug="r",
                 season="2024-25", game_date="2024-12-31", opponent="Arizona State",
                 source="gamelog")
        self.assertEqual(
            self._body(f),
            "Richie Saunders put up 30 points vs Arizona State (2024-12-31).",
        )

    def test_career_total_template(self):
        f = Fact("STL", 133, "career_total", player="Richie Saunders", player_slug="r",
                 source="overview")
        self.assertEqual(self._body(f), "Richie Saunders has 133 career steals.")

    def test_split_pct_template_with_season_and_sample(self):
        f = Fact("3P%", 43.2, "career_split", player="R", player_slug="r", season="2025-26",
                 sample_size=74, source="splits",
                 context={"split_category": "location:Home"})
        self.assertEqual(
            self._body(f),
            "R shoots 43.2% from three at home in 2025-26 (74 attempts).",
        )

    def test_threshold_and_streak_templates(self):
        thr = Fact("STL", 5, "threshold_count", player="R", player_slug="r", source="derived",
                   context={"window": "career", "threshold": 4, "op": ">="})
        self.assertEqual(self._body(thr), "R has 5 games with 4+ steals in his career.")
        streak = Fact("PTS", 17, "streak", player="R", player_slug="r", source="derived",
                      context={"window": "career", "condition": "PTS >= 10"})
        self.assertIn("17-game streak", self._body(streak))

    def test_team_scope_uses_team_name(self):
        f = Fact("PTS", 90, "season_total", scope="team", player_slug=None, season="2025-26",
                 source="overview")
        self.assertTrue(self._body(f).startswith("BYU "))

    def test_lead_prefixes_number(self):
        c = Candidate(fact=Fact("STL", 133, "career_total", player="R", player_slug="r",
                                source="overview"), score=1.0, kind="exact")
        self.assertTrue(draft_text(c, 133, self.config).startswith("133 days to #BYUHoops"))


TEAM_HTML = """
<html><body><h1>BYU 2026</h1>
<table id="roster"><tbody>
  <tr><th data-stat="player"><a href="/cbb/players/robert-wright-3.html">Robert Wright</a></th>
      <td data-stat="number">0</td><td data-stat="pos">G</td><td data-stat="class">SO</td></tr>
  <tr><th data-stat="player"><a href="/cbb/players/aleksej-kostic-1.html">Aleksej Kosti&#263;</a></th>
      <td data-stat="number">5</td><td data-stat="pos">G</td><td data-stat="class">FR</td></tr>
</tbody></table>
<table id="season-total_totals"><tbody>
  <tr><td data-stat="entity">Team</td><td data-stat="g">35</td>
      <td data-stat="pts">2924</td><td data-stat="stl">251</td>
      <td data-stat="fg3">298</td><td data-stat="fg3a">864</td><td data-stat="fg3_pct">.345</td></tr>
  <tr><td data-stat="entity">Opponent</td><td data-stat="g">35</td>
      <td data-stat="pts">2600</td></tr>
</tbody></table>
</body></html>
"""


class RosterTests(unittest.TestCase):
    def test_parse_roster_pulls_slugs_from_links(self):
        entries = parse_roster(TEAM_HTML)
        self.assertEqual([e.slug for e in entries],
                         ["robert-wright-3", "aleksej-kostic-1"])

    def test_resolve_slugs_is_accent_and_case_insensitive(self):
        resolved, missing = resolve_slugs(TEAM_HTML, ["robert wright", "Aleksej Kostic", "Nobody"])
        self.assertEqual(resolved["robert wright"], "robert-wright-3")
        self.assertEqual(resolved["Aleksej Kostic"], "aleksej-kostic-1")  # matched despite the ć
        self.assertEqual(missing, ["Nobody"])

    def test_team_totals_are_team_scoped(self):
        facts = normalize_team_totals(TEAM_HTML, 2026, "brigham-young")
        pts = [f for f in facts if f.stat_name == "PTS"][0]
        self.assertEqual(pts.stat_value, 2924)
        self.assertEqual(pts.scope, "team")
        self.assertIsNone(pts.player_slug)
        self.assertEqual(pts.season, "2025-26")
        self.assertFalse(any(f.stat_value == 2600 for f in facts))  # Opponent row ignored

    def test_active_roster_round_trips_and_merges(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "roster.json"
            save_active_roster(["a", "b"], "byu", 2026, path=path)
            save_active_roster(["b", "c"], "byu", 2026, path=path)  # merge, don't drop 'a'
            self.assertEqual(load_active_roster(path), {"a", "b", "c"})


class ConfigDrivenTests(unittest.TestCase):
    """Phase 6: the matcher/ranker has no hardcoded tuning numbers."""

    def _fact(self, **kw):
        base = dict(stat_name="3P%", stat_value=61.4, stat_type="window_pct",
                    player_slug="a", player="A", sample_size=400, source="derived",
                    context={"window": "career"})
        base.update(kw)
        return Fact(**base)

    def test_pct_tolerance_comes_from_config(self):
        fact = self._fact()  # 61.4
        loose = {"scoring": {"pct_match_tolerance": 0.5}, "ranking_weights": {}}
        wide = {"scoring": {"pct_match_tolerance": 2.0}, "ranking_weights": {}}
        self.assertEqual(rank_candidates([fact], 62, loose, scope="roster").total, 0)
        self.assertEqual(rank_candidates([fact], 62, wide, scope="roster").total, 1)

    def test_bonus_stat_types_come_from_config(self):
        g = Fact("PTS", 5, "single_game", player_slug="a", player="A", source="gamelog",
                 game_date="2026-01-01", opponent="Z")
        cfg = load_config()
        fired = dict(rank_candidates([g], 5, cfg, scope="roster").shown[0].reasons)
        self.assertIn("single_game_bonus", fired)

        cfg2 = load_config()
        cfg2["scoring"] = dict(cfg2["scoring"], single_game_stat_types=[])
        fired2 = dict(rank_candidates([g], 5, cfg2, scope="roster").shown[0].reasons)
        self.assertNotIn("single_game_bonus", fired2)

    def test_streak_min_length_comes_from_config(self):
        from finder.derive import _streak_facts, _Game

        games = []
        for i in range(3):
            gm = _Game(f"2026-01-0{i}", "2025-26", "Z", "SR", "W", "home")
            gm.stats = {"PTS": 20}
            games.append(gm)
        cfg = {"streak_conditions": [{"stat": "PTS", "op": ">=", "value": 10}]}
        self.assertEqual(len(_streak_facts(games, "career", None, "A", "a", {**cfg, "streak_min_length": 2})), 1)
        self.assertEqual(len(_streak_facts(games, "career", None, "A", "a", {**cfg, "streak_min_length": 5})), 0)


class DedupTests(unittest.TestCase):
    def test_career_total_and_derived_window_total_collapse(self):
        facts = [
            Fact("STL", 133, "career_total", player="R", player_slug="r", source="overview"),
            Fact("STL", 133, "window_total", player="R", player_slug="r", source="derived",
                 context={"window": "career"}),
        ]
        res = rank_candidates(facts, 133, load_config(), scope="roster", limit=None)
        self.assertEqual(res.total, 1)
        self.assertEqual(res.shown[0].fact.source, "overview")  # scraped beats derived

    def test_current_season_window_collapses_into_season_total(self):
        cfg = load_config()
        label = f"{cfg['fetch']['current_season'] - 1}-{str(cfg['fetch']['current_season'])[-2:]}"
        facts = [
            Fact("ORB", 47, "season_total", player="R", player_slug="r", season=label,
                 source="overview"),
            Fact("ORB", 47, "window_total", player="R", player_slug="r", source="derived",
                 context={"window": "current_season"}),
        ]
        res = rank_candidates(facts, 47, cfg, scope="roster", limit=None)
        self.assertEqual(res.total, 1)


class FactStoreTests(unittest.TestCase):
    def test_merge_overwrites_by_identity_and_round_trips(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "facts.json"
            store = FactStore(path=path)
            f1 = Fact("PTS", 10, "single_game", player_slug="x", game_date="2024-01-01", source="gamelog")
            f2 = Fact("PTS", 12, "single_game", player_slug="x", game_date="2024-01-01", source="gamelog")
            store.merge([f1, f2])
            self.assertEqual(len(store.facts), 1)
            store.save()
            self.assertEqual(FactStore(path=path).facts[0].stat_value, 12)


if __name__ == "__main__":
    unittest.main()
