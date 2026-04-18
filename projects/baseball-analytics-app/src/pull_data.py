import argparse
from pathlib import Path

import pandas as pd
from pybaseball import batting_stats, pitching_stats

from paths import RAW_DIR

RAW_DIR.mkdir(parents=True, exist_ok=True)

START_YEAR = 2023
END_YEAR = 2025

all_batting = []
all_pitching = []

batting_path = RAW_DIR / "batting_stats_2023_2025.csv"
pitching_path = RAW_DIR / "pitching_stats_2023_2025.csv"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batting-only", action="store_true")
    parser.add_argument("--pitching-only", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    pull_batting = not args.pitching_only
    pull_pitching = not args.batting_only

    if args.batting_only and args.pitching_only:
      raise SystemExit("Choose only one of --batting-only or --pitching-only.")

    for year in range(START_YEAR, END_YEAR + 1):
        if pull_batting:
            print(f"Pulling batting stats for {year}...")
            bat = batting_stats(year)
            bat["season"] = year
            all_batting.append(bat)

        if pull_pitching:
            print(f"Pulling pitching stats for {year}...")
            # FanGraphs defaults to qualified pitchers unless `qual=0` is supplied.
            # The viewer needs the full role mix, including closers and middle relief arms.
            pit = pitching_stats(year, qual=0)
            pit["season"] = year
            all_pitching.append(pit)

    if pull_batting:
        batting_df = pd.concat(all_batting, ignore_index=True)
        batting_df.to_csv(batting_path, index=False)
        print(f"Saved batting data to {batting_path}")

    if pull_pitching:
        pitching_df = pd.concat(all_pitching, ignore_index=True)
        pitching_df.to_csv(pitching_path, index=False)
        print(f"Saved pitching data to {pitching_path}")


if __name__ == "__main__":
    main()
