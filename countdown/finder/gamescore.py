"""John Hollinger's Game Score.

GmSc = PTS + 0.4*FGM - 0.7*FGA - 0.4*(FTA - FTM) + 0.7*ORB + 0.3*DRB
       + STL + 0.7*AST + 0.7*BLK - 0.4*PF - TOV

Basketball-Reference publishes it directly (`game_score`); Eurobasket/Asia-Basket
only publish their own efficiency index (RNK), and RealGM its FIC, so those
sources are scored from the box line with this formula. Same numbers as BBR's.
"""

from __future__ import annotations


def game_score(box: dict) -> float:
    return round(
        box["pts"] + 0.4 * box["fgm"] - 0.7 * box["fga"]
        - 0.4 * (box["fta"] - box["ftm"])
        + 0.7 * box["orb"] + 0.3 * box["drb"]
        + box["stl"] + 0.7 * box["ast"] + 0.7 * box["blk"]
        - 0.4 * box["pf"] - box["tov"],
        1,
    )


# FIBA 3x3 goes to 21 (~10 minutes, ~21 points a side), so a Hollinger score on a
# 3x3 box line is compressed relative to a full 40-minute game: 12 points is about
# half the team's scoring, a 30-50 point game in a full one. This scales the 3x3 raw
# score onto that scale. Tune here -- it is applied to Game Score, not to points, so
# it needs to be larger than the points ratio (the -0.7/FGA charge eats most of a
# 3x3 shooter's raw score).
SCALE_3X3 = 3.0


def game_score_3x3(box: dict, scale: float | None = None) -> dict:
    """{"raw", "scale", "scaled"} for a 3x3 box line (STL and PF are not published, so 0)."""
    scale = SCALE_3X3 if scale is None else scale
    raw = game_score(box)
    return {"raw": raw, "scale": scale, "scaled": round(raw * scale, 1)}
