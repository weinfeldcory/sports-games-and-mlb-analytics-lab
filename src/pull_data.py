from pathlib import Path

import pandas as pd
from pybaseball import batting_stats, pitching_stats


RAW_DIR = Path("data/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

START_YEAR = 2023
END_YEAR = 2025

all_batting = []
all_pitching = []

for year in range(START_YEAR, END_YEAR + 1):
    print(f"Pulling batting stats for {year}...")
    bat = batting_stats(year)
    bat["season"] = year
    all_batting.append(bat)

    print(f"Pulling pitching stats for {year}...")
    pit = pitching_stats(year)
    pit["season"] = year
    all_pitching.append(pit)

batting_df = pd.concat(all_batting, ignore_index=True)
pitching_df = pd.concat(all_pitching, ignore_index=True)

batting_path = RAW_DIR / "batting_stats_2023_2025.csv"
pitching_path = RAW_DIR / "pitching_stats_2023_2025.csv"

batting_df.to_csv(batting_path, index=False)
pitching_df.to_csv(pitching_path, index=False)

print(f"Saved batting data to {batting_path}")
print(f"Saved pitching data to {pitching_path}")
