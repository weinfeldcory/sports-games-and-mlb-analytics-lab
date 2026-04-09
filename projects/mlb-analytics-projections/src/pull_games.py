from pathlib import Path

import duckdb
import pandas as pd
import requests

from paths import DB_PATH, RAW_DIR

OUT_PATH = RAW_DIR / "games_2023_2025.csv"
START_YEAR = 2023
END_YEAR = 2025
SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule"


def fetch_schedule(season):
    response = requests.get(
        SCHEDULE_URL,
        params={
            "sportId": 1,
            "season": season,
            "gameType": "R",
            "hydrate": "linescore",
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def game_rows(schedule_data):
    rows = []

    for game_date in schedule_data["dates"]:
        for game in game_date["games"]:
            away = game["teams"]["away"]
            home = game["teams"]["home"]
            away_score = away.get("score")
            home_score = home.get("score")

            if away_score is None or home_score is None:
                continue

            away_team = away["team"]
            home_team = home["team"]
            home_win = home_score > away_score
            winner = home_team["name"] if home_win else away_team["name"]
            loser = away_team["name"] if home_win else home_team["name"]

            rows.append(
                {
                    "game_pk": game["gamePk"],
                    "season": int(game["season"]),
                    "game_date": game["officialDate"],
                    "game_type": game["gameType"],
                    "status": game["status"]["detailedState"],
                    "away_team_id": away_team["id"],
                    "away_team": away_team["name"],
                    "away_runs": away_score,
                    "home_team_id": home_team["id"],
                    "home_team": home_team["name"],
                    "home_runs": home_score,
                    "total_runs": away_score + home_score,
                    "home_win": home_win,
                    "winner": winner,
                    "loser": loser,
                    "game_result": (
                        f"{away_team['name']} {away_score}, "
                        f"{home_team['name']} {home_score}"
                    ),
                }
            )

    return rows


def main():
    rows = []

    for season in range(START_YEAR, END_YEAR + 1):
        print(f"Pulling MLB game schedule for {season}...")
        rows.extend(game_rows(fetch_schedule(season)))

    games = pd.DataFrame(rows)
    games = games.sort_values(["season", "game_date", "game_pk"])

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    games.to_csv(OUT_PATH, index=False)

    con = duckdb.connect(str(DB_PATH))
    con.execute("DROP TABLE IF EXISTS games")
    con.execute(
        f"""
        CREATE TABLE games AS
        SELECT *
        FROM read_csv_auto('{OUT_PATH}')
        """
    )

    print(f"Saved game data to {OUT_PATH}")
    print("Created DuckDB table: games")
    print("Game row count:", con.execute("SELECT COUNT(*) FROM games").fetchone()[0])
    print(con.execute("SELECT * FROM games ORDER BY game_date LIMIT 10").df())
    con.close()


if __name__ == "__main__":
    main()
