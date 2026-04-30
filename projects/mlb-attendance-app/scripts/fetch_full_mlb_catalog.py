from __future__ import annotations

import json
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE

GAME_TYPES = "R,D,L,W,F,C"
OUTPUT_PATH = (
    Path(__file__).resolve().parents[1]
    / "apps"
    / "mobile"
    / "src"
    / "lib"
    / "data"
    / "mlbGameCatalog.json"
)


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, context=SSL_CONTEXT) as response:
        return json.load(response)


def fetch_schedule_for_year(year: int) -> list[dict]:
    query = urllib.parse.urlencode(
        {
            "sportId": 1,
            "startDate": f"{year}-01-01",
            "endDate": f"{year}-12-31",
            "gameType": GAME_TYPES,
            "hydrate": "linescore",
        }
    )
    payload = get_json(f"https://statsapi.mlb.com/api/v1/schedule?{query}")
    return payload.get("dates", [])


def is_final_game(game: dict) -> bool:
    status = game.get("status", {})
    detailed_state = (status.get("detailedState") or "").lower()
    coded_state = status.get("codedGameState")
    abstract_state = (status.get("abstractGameState") or "").lower()
    return (
        abstract_state == "final"
        or coded_state in {"F", "O"}
        or detailed_state in {"final", "game over", "completed early"}
    )


def build_line_score(linescore: dict | None) -> list[dict]:
    if not linescore:
        return []

    innings = []
    for inning in linescore.get("innings", []):
        innings.append(
            {
                "inning": inning.get("num"),
                "homeRuns": inning.get("home", {}).get("runs", 0),
                "awayRuns": inning.get("away", {}).get("runs", 0),
            }
        )

    return innings


def build_catalog_game(game: dict, fallback_date: str) -> dict:
    linescore = game.get("linescore") or {}
    line_score = build_line_score(linescore)
    linescore_teams = linescore.get("teams", {})
    home_line = linescore_teams.get("home", {})
    away_line = linescore_teams.get("away", {})

    return {
        "date": fallback_date,
        "gameDate": game.get("gameDate"),
        "gamePk": game["gamePk"],
        "homeTeam": game["teams"]["home"]["team"],
        "awayTeam": game["teams"]["away"]["team"],
        "homeScore": game["teams"]["home"].get("score", home_line.get("runs", 0) or 0),
        "awayScore": game["teams"]["away"].get("score", away_line.get("runs", 0) or 0),
        "homeHits": home_line.get("hits", 0) or 0,
        "awayHits": away_line.get("hits", 0) or 0,
        "homeErrors": home_line.get("errors", 0) or 0,
        "awayErrors": away_line.get("errors", 0) or 0,
        "lineScore": line_score,
        "venue": game["venue"],
        "pitchers": [],
        "batters": [],
    }


def build_output(start_year: int, end_year: int) -> list[dict]:
    catalog: list[dict] = []

    for year in range(start_year, end_year + 1):
        for day in fetch_schedule_for_year(year):
            game_date = day.get("date")
            for game in day.get("games", []):
                if not is_final_game(game):
                    continue
                catalog.append(build_catalog_game(game, game_date))

    catalog.sort(key=lambda game: (game["date"], game["gamePk"]))
    return catalog


def main() -> int:
    start_year = int(sys.argv[1]) if len(sys.argv) > 1 else 2021
    end_year = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
    output = build_output(start_year, end_year)
    OUTPUT_PATH.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote {len(output)} final MLB games to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
