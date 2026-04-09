from pathlib import Path

import duckdb

from paths import DB_PATH, PROCESSED_DIR

OUT_PATH = PROCESSED_DIR / "hitter_model_2025.csv"
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

QUERY = """
SELECT
    sheet_model_rank,
    player_name,
    team,
    age,
    plate_appearances,
    war,
    wrc_plus,
    woba,
    xwoba,
    xwoba_minus_woba,
    rolling_3yr_woba,
    production_score,
    power_score,
    discipline_score,
    contact_score,
    speed_score,
    track_record_score,
    sheet_model_score
FROM hitter_model_2025
ORDER BY sheet_model_rank
"""


def main():
    con = duckdb.connect(str(DB_PATH), read_only=True)
    df = con.execute(QUERY).df()
    con.close()

    df.to_csv(OUT_PATH, index=False)
    print(f"Saved analysis to {OUT_PATH}")
    print(df.head(15).to_string(index=False))


if __name__ == "__main__":
    main()
