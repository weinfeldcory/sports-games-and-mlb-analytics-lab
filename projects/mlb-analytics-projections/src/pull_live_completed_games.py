from __future__ import annotations

import argparse
from datetime import date, datetime
from pathlib import Path

import duckdb
import pandas as pd
import requests

from paths import DB_PATH, RAW_DIR

SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule"
BOXSCORE_URL = "https://statsapi.mlb.com/api/v1/game/{game_pk}/boxscore"
TEAMS_URL = "https://statsapi.mlb.com/api/v1/teams"
TEAM_ROSTER_URL = "https://statsapi.mlb.com/api/v1/teams/{team_id}/roster"
FINAL_STATES = {"Final", "Game Over", "Completed Early", "Completed Early: Rain"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Pull MLB completed games and player boxscore lines from MLB StatsAPI."
    )
    parser.add_argument(
        "--start-date",
        help="Start date in YYYY-MM-DD. Defaults to the latest loaded game date or January 1 of the season.",
    )
    parser.add_argument(
        "--end-date",
        help="End date in YYYY-MM-DD. Defaults to today.",
    )
    parser.add_argument(
        "--season",
        type=int,
        help="Season year used when start-date is omitted. Defaults to the end-date year.",
    )
    parser.add_argument(
        "--game-type",
        default="R",
        help="MLB game type code. Defaults to R for regular season.",
    )
    return parser.parse_args()


def parse_iso_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def table_exists(con: duckdb.DuckDBPyConnection, table_name: str) -> bool:
    return (
        con.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_name = ?
            """,
            [table_name],
        ).fetchone()[0]
        > 0
    )


def infer_start_date(args: argparse.Namespace, con: duckdb.DuckDBPyConnection, end_date: date) -> date:
    if args.start_date:
        return parse_iso_date(args.start_date)

    if table_exists(con, "live_completed_games"):
        max_loaded = con.execute(
            "SELECT MAX(CAST(game_date AS DATE)) FROM live_completed_games"
        ).fetchone()[0]
        if max_loaded is not None:
            return max_loaded

    season = args.season or end_date.year
    return date(season, 1, 1)


def fetch_json(session: requests.Session, url: str, params: dict | None = None) -> dict:
    response = session.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def fetch_schedule(session: requests.Session, start_date: date, end_date: date, game_type: str) -> dict:
    return fetch_json(
        session,
        SCHEDULE_URL,
        params={
            "sportId": 1,
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "gameType": game_type,
            "hydrate": "linescore,team",
        },
    )


def fetch_teams(session: requests.Session, season: int) -> dict:
    return fetch_json(
        session,
        TEAMS_URL,
        params={
            "sportId": 1,
            "season": season,
        },
    )


def fetch_team_roster(session: requests.Session, team_id: int, season: int) -> dict:
    return fetch_json(
        session,
        TEAM_ROSTER_URL.format(team_id=team_id),
        params={
            "rosterType": "40Man",
            "season": season,
        },
    )


def extract_completed_games(schedule_data: dict) -> list[dict]:
    rows: list[dict] = []

    for game_date in schedule_data.get("dates", []):
        for game in game_date.get("games", []):
            status = game["status"]["detailedState"]
            if status not in FINAL_STATES:
                continue

            away = game["teams"]["away"]
            home = game["teams"]["home"]
            away_score = away.get("score")
            home_score = home.get("score")

            if away_score is None or home_score is None:
                continue

            away_team = away["team"]
            home_team = home["team"]
            home_win = home_score > away_score

            rows.append(
                {
                    "game_pk": game["gamePk"],
                    "season": int(game["season"]),
                    "game_date": game["officialDate"],
                    "game_type": game["gameType"],
                    "status": status,
                    "doubleheader": game.get("doubleHeader"),
                    "game_number": game.get("gameNumber"),
                    "series_description": game.get("seriesDescription"),
                    "venue_name": game.get("venue", {}).get("name"),
                    "away_team_id": away_team["id"],
                    "away_team": away_team["name"],
                    "away_runs": away_score,
                    "home_team_id": home_team["id"],
                    "home_team": home_team["name"],
                    "home_runs": home_score,
                    "total_runs": away_score + home_score,
                    "home_win": home_win,
                    "winner": home_team["name"] if home_win else away_team["name"],
                    "loser": away_team["name"] if home_win else home_team["name"],
                    "game_result": f"{away_team['name']} {away_score}, {home_team['name']} {home_score}",
                }
            )

    return rows


def extract_roster_rows(session: requests.Session, teams_data: dict, season: int) -> list[dict]:
    rows: list[dict] = []

    for team in teams_data.get("teams", []):
        roster_data = fetch_team_roster(session, team["id"], season)

        for roster_entry in roster_data.get("roster", []):
            person = roster_entry.get("person", {})
            position = roster_entry.get("position", {})
            status = roster_entry.get("status", {})

            rows.append(
                {
                    "season": season,
                    "team_id": team["id"],
                    "team_name": team["name"],
                    "team_abbrev": team.get("abbreviation"),
                    "league_name": team.get("league", {}).get("name"),
                    "division_name": team.get("division", {}).get("name"),
                    "player_id": person.get("id"),
                    "player_name": person.get("fullName"),
                    "position_abbrev": position.get("abbreviation"),
                    "position_name": position.get("name"),
                    "jersey_number": roster_entry.get("jerseyNumber"),
                    "roster_status_code": status.get("code"),
                    "roster_status_description": status.get("description"),
                }
            )

    return rows


def safe_stat_line(stats: dict | None) -> dict:
    return stats or {}


def extract_player_lines(game_row: dict, boxscore: dict) -> tuple[list[dict], list[dict]]:
    batting_rows: list[dict] = []
    pitching_rows: list[dict] = []

    for side in ("away", "home"):
        team_data = boxscore["teams"][side]
        team = team_data["team"]
        opponent_side = "home" if side == "away" else "away"
        opponent_team = boxscore["teams"][opponent_side]["team"]
        home_away = "away" if side == "away" else "home"

        for player in team_data.get("players", {}).values():
            person = player.get("person", {})
            position = player.get("position", {})
            batting = safe_stat_line(player.get("stats", {}).get("batting"))
            pitching = safe_stat_line(player.get("stats", {}).get("pitching"))

            common = {
                "game_pk": game_row["game_pk"],
                "season": game_row["season"],
                "game_date": game_row["game_date"],
                "team_id": team["id"],
                "team_name": team["name"],
                "opponent_team_id": opponent_team["id"],
                "opponent_team_name": opponent_team["name"],
                "home_away": home_away,
                "player_id": person.get("id"),
                "player_name": person.get("fullName"),
                "position_abbrev": position.get("abbreviation"),
                "batting_order": player.get("battingOrder"),
                "is_starter": bool(player.get("battingOrder")) or not player.get("gameStatus", {}).get("isSubstitute", False),
            }

            if batting:
                batting_rows.append(
                    {
                        **common,
                        "at_bats": batting.get("atBats"),
                        "runs": batting.get("runs"),
                        "hits": batting.get("hits"),
                        "doubles": batting.get("doubles"),
                        "triples": batting.get("triples"),
                        "home_runs": batting.get("homeRuns"),
                        "rbi": batting.get("rbi"),
                        "walks": batting.get("baseOnBalls"),
                        "strikeouts": batting.get("strikeOuts"),
                        "stolen_bases": batting.get("stolenBases"),
                        "caught_stealing": batting.get("caughtStealing"),
                        "hit_by_pitch": batting.get("hitByPitch"),
                        "sac_bunts": batting.get("sacBunts"),
                        "sac_flies": batting.get("sacFlies"),
                        "left_on_base": batting.get("leftOnBase"),
                        "avg": batting.get("avg"),
                        "obp": batting.get("obp"),
                        "slg": batting.get("slg"),
                        "ops": batting.get("ops"),
                    }
                )

            if pitching:
                pitching_rows.append(
                    {
                        **common,
                        "innings_pitched": pitching.get("inningsPitched"),
                        "hits_allowed": pitching.get("hits"),
                        "runs_allowed": pitching.get("runs"),
                        "earned_runs": pitching.get("earnedRuns"),
                        "walks": pitching.get("baseOnBalls"),
                        "strikeouts": pitching.get("strikeOuts"),
                        "home_runs_allowed": pitching.get("homeRuns"),
                        "batters_faced": pitching.get("battersFaced"),
                        "era": pitching.get("era"),
                        "pitches_thrown": pitching.get("numberOfPitches"),
                        "strikes": pitching.get("strikes"),
                        "balls": pitching.get("balls"),
                        "outs": pitching.get("outs"),
                        "decision": pitching.get("note"),
                    }
                )

    return batting_rows, pitching_rows


def write_table(con: duckdb.DuckDBPyConnection, table_name: str, df: pd.DataFrame) -> None:
    con.register(f"{table_name}_df", df)
    con.execute(f"DROP TABLE IF EXISTS {table_name}")
    con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM {table_name}_df")
    con.unregister(f"{table_name}_df")


def build_dataframe(rows: list[dict], sort_columns: list[str]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()

    return pd.DataFrame(rows).sort_values(sort_columns)


def main() -> None:
    args = parse_args()
    end_date = parse_iso_date(args.end_date) if args.end_date else date.today()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))
    start_date = infer_start_date(args, con, end_date)

    if start_date > end_date:
        raise ValueError(f"start-date {start_date} cannot be after end-date {end_date}")

    print(f"Pulling completed MLB games from {start_date} through {end_date}...")

    session = requests.Session()
    teams_data = fetch_teams(session, end_date.year)
    roster_rows = extract_roster_rows(session, teams_data, end_date.year)
    schedule_data = fetch_schedule(session, start_date, end_date, args.game_type)
    game_rows = extract_completed_games(schedule_data)
    print(f"Found {len(game_rows)} completed games.")

    batting_rows: list[dict] = []
    pitching_rows: list[dict] = []

    for index, game_row in enumerate(game_rows, start=1):
        print(f"[{index}/{len(game_rows)}] Pulling boxscore for gamePk={game_row['game_pk']}...")
        boxscore = fetch_json(session, BOXSCORE_URL.format(game_pk=game_row["game_pk"]))
        game_batting_rows, game_pitching_rows = extract_player_lines(game_row, boxscore)
        batting_rows.extend(game_batting_rows)
        pitching_rows.extend(game_pitching_rows)

    games_df = build_dataframe(game_rows, ["game_date", "game_pk"])
    batting_df = build_dataframe(batting_rows, ["game_date", "game_pk", "team_name", "player_name"])
    pitching_df = build_dataframe(pitching_rows, ["game_date", "game_pk", "team_name", "player_name"])
    rosters_df = build_dataframe(roster_rows, ["team_name", "player_name"])

    suffix = f"{start_date.isoformat()}_{end_date.isoformat()}"
    games_path = RAW_DIR / f"live_completed_games_{suffix}.csv"
    batting_path = RAW_DIR / f"live_batting_lines_{suffix}.csv"
    pitching_path = RAW_DIR / f"live_pitching_lines_{suffix}.csv"
    rosters_path = RAW_DIR / f"live_rosters_{end_date.year}.csv"

    games_df.to_csv(games_path, index=False)
    batting_df.to_csv(batting_path, index=False)
    pitching_df.to_csv(pitching_path, index=False)
    rosters_df.to_csv(rosters_path, index=False)

    write_table(con, "live_completed_games", games_df)
    write_table(con, "live_batting_lines", batting_df)
    write_table(con, "live_pitching_lines", pitching_df)
    write_table(con, "live_rosters", rosters_df)

    print(f"Saved games to {games_path}")
    print(f"Saved batting lines to {batting_path}")
    print(f"Saved pitching lines to {pitching_path}")
    print(f"Saved rosters to {rosters_path}")
    print("Created DuckDB tables:")
    for table_name in ("live_completed_games", "live_batting_lines", "live_pitching_lines", "live_rosters"):
        row_count = con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        print(f"- {table_name}: {row_count} rows")

    con.close()


if __name__ == "__main__":
    main()
