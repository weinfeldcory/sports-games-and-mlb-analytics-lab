from __future__ import annotations

import json
import sys
import ssl
import urllib.parse
import urllib.request
from dataclasses import dataclass

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


TEAM_NAME_TO_CODE = {
    "mets": "NYM",
    "marlins": "MIA",
    "yankees": "NYY",
    "twins": "MIN",
    "guardians": "CLE",
    "phillies": "PHI",
    "philles": "PHI",
    "red sox": "BOS",
    "mariners": "SEA",
    "cubs": "CHC",
    "rangers": "TEX",
    "tigers": "DET",
    "nationals": "WSH",
    "pirates": "PIT",
    "diamondbacks": "ARI",
    "cardinals": "STL",
    "giants": "SF",
    "braves": "ATL",
    "reds": "CIN",
    "orioles": "BAL",
    "dodgers": "LAD",
    "rays": "TB",
    "brewers": "MIL",
}

TEAM_NAME_TO_API_NAME = {
    "mets": "New York Mets",
    "marlins": "Miami Marlins",
    "yankees": "New York Yankees",
    "twins": "Minnesota Twins",
    "guardians": "Cleveland Guardians",
    "phillies": "Philadelphia Phillies",
    "philles": "Philadelphia Phillies",
    "red sox": "Boston Red Sox",
    "mariners": "Seattle Mariners",
    "cubs": "Chicago Cubs",
    "rangers": "Texas Rangers",
    "tigers": "Detroit Tigers",
    "nationals": "Washington Nationals",
    "pirates": "Pittsburgh Pirates",
    "diamondbacks": "Arizona Diamondbacks",
    "cardinals": "St. Louis Cardinals",
    "giants": "San Francisco Giants",
    "braves": "Atlanta Braves",
    "reds": "Cincinnati Reds",
    "orioles": "Baltimore Orioles",
    "dodgers": "Los Angeles Dodgers",
    "rays": "Tampa Bay Rays",
    "brewers": "Milwaukee Brewers",
}


@dataclass(frozen=True)
class SeenGame:
    date: str
    team_a: str
    team_b: str


SEEN_GAMES = [
    SeenGame("2023-04-07", "mets", "marlins"),
    SeenGame("2023-04-13", "yankees", "twins"),
    SeenGame("2023-05-01", "yankees", "guardians"),
    SeenGame("2023-05-21", "mets", "guardians"),
    SeenGame("2023-05-30", "mets", "phillies"),
    SeenGame("2023-06-09", "yankees", "red sox"),
    SeenGame("2023-06-14", "mets", "yankees"),
    SeenGame("2023-06-20", "yankees", "mariners"),
    SeenGame("2023-08-09", "mets", "cubs"),
    SeenGame("2023-08-29", "mets", "rangers"),
    SeenGame("2023-09-02", "mets", "mariners"),
    SeenGame("2024-04-01", "mets", "tigers"),
    SeenGame("2024-04-03", "nationals", "pirates"),
    SeenGame("2024-05-13", "mets", "phillies"),
    SeenGame("2024-06-01", "mets", "diamondbacks"),
    SeenGame("2024-06-04", "yankees", "twins"),
    SeenGame("2024-06-13", "mets", "marlins"),
    SeenGame("2024-06-20", "cardinals", "giants"),
    SeenGame("2024-06-21", "yankees", "braves"),
    SeenGame("2024-06-25", "mets", "yankees"),
    SeenGame("2024-09-07", "mets", "reds"),
    SeenGame("2024-09-26", "yankees", "orioles"),
    SeenGame("2024-10-08", "mets", "phillies"),
    SeenGame("2024-10-09", "mets", "phillies"),
    SeenGame("2024-10-16", "mets", "dodgers"),
    SeenGame("2025-04-13", "yankees", "giants"),
    SeenGame("2025-04-20", "mets", "cardinals"),
    SeenGame("2025-04-30", "mets", "diamondbacks"),
    SeenGame("2025-05-13", "mets", "pirates"),
    SeenGame("2025-05-18", "mets", "yankees"),
    SeenGame("2025-05-21", "yankees", "rangers"),
    SeenGame("2025-05-22", "yankees", "rangers"),
    SeenGame("2025-06-15", "mets", "rays"),
    SeenGame("2025-06-26", "mets", "braves"),
    SeenGame("2025-07-03", "mets", "brewers"),
    SeenGame("2025-07-31", "yankees", "rays"),
    SeenGame("2025-08-03", "mets", "giants"),
    SeenGame("2025-08-25", "mets", "phillies"),
    SeenGame("2026-03-28", "mets", "pirates"),
]


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, context=SSL_CONTEXT) as response:
        return json.load(response)


def fetch_schedule(date: str) -> list[dict]:
    query = urllib.parse.urlencode({"sportId": 1, "date": date})
    payload = get_json(f"https://statsapi.mlb.com/api/v1/schedule?{query}")
    return payload.get("dates", [{}])[0].get("games", [])


def names_for_game(game: dict) -> tuple[str, str]:
    teams = game["teams"]
    return teams["away"]["team"]["name"], teams["home"]["team"]["name"]


def fetch_boxscore(game_pk: int) -> dict:
    return get_json(f"https://statsapi.mlb.com/api/v1/game/{game_pk}/boxscore")


def build_batters(match: dict, boxscore: dict) -> list[dict]:
    batters = []

    for side in ("home", "away"):
        team_id = str(match["teams"][side]["team"]["id"])
        players = boxscore["teams"][side]["players"]
        for player in players.values():
            position = player.get("position", {}).get("abbreviation")
            if position == "P":
                continue
            batting = player.get("stats", {}).get("batting") or {}
            if not batting.get("atBats") and not batting.get("plateAppearances"):
                continue
            batters.append(
                {
                    "teamId": team_id,
                    "playerName": player["person"]["fullName"],
                    "atBats": batting.get("atBats", 0),
                    "hits": batting.get("hits", 0),
                    "homeRuns": batting.get("homeRuns", 0),
                    "rbis": batting.get("rbi", 0),
                    "strikeouts": batting.get("strikeOuts", 0),
                    "walks": batting.get("baseOnBalls", 0),
                }
            )

    return batters


def build_output() -> list[dict]:
    results: list[dict] = []

    for seen in SEEN_GAMES:
      team_a = TEAM_NAME_TO_API_NAME[seen.team_a]
      team_b = TEAM_NAME_TO_API_NAME[seen.team_b]
      candidates = fetch_schedule(seen.date)
      match = None

      for candidate in candidates:
        away_name, home_name = names_for_game(candidate)
        if {away_name, home_name} == {team_a, team_b}:
          match = candidate
          break

      if not match:
        raise RuntimeError(f"No game found for {seen.date} {seen.team_a} vs {seen.team_b}")

      boxscore = fetch_boxscore(match["gamePk"])
      home_team = match["teams"]["home"]["team"]
      away_team = match["teams"]["away"]["team"]
      home_stats = boxscore["teams"]["home"]["teamStats"]["batting"]
      away_stats = boxscore["teams"]["away"]["teamStats"]["batting"]

      pitchers = []
      for side in ("home", "away"):
        team_id = str(match["teams"][side]["team"]["id"])
        players = boxscore["teams"][side]["players"]
        for player in players.values():
          position = player.get("position", {}).get("abbreviation")
          if position != "P":
            continue
          pitching = player.get("stats", {}).get("pitching") or {}
          if not pitching.get("inningsPitched"):
            continue
          pitchers.append(
            {
              "teamId": team_id,
              "pitcherName": player["person"]["fullName"],
              "inningsPitched": pitching.get("inningsPitched"),
              "hitsAllowed": pitching.get("hits"),
              "runsAllowed": pitching.get("runs"),
              "strikeouts": pitching.get("strikeOuts"),
            }
          )

      results.append(
        {
          "date": seen.date,
          "gamePk": match["gamePk"],
          "homeTeam": home_team,
          "awayTeam": away_team,
          "homeScore": match["teams"]["home"]["score"],
          "awayScore": match["teams"]["away"]["score"],
          "homeHits": home_stats.get("hits"),
          "awayHits": away_stats.get("hits"),
          "venue": match["venue"],
          "pitchers": pitchers,
          "batters": build_batters(match, boxscore),
        }
      )

    return results


if __name__ == "__main__":
    output = json.dumps(build_output(), indent=2)
    if len(sys.argv) > 1:
        with open(sys.argv[1], "w", encoding="utf-8") as handle:
            handle.write(output)
    else:
        print(output)
