from pathlib import Path

import duckdb

from paths import DB_PATH, PROCESSED_DIR, VIEWER_DATA_DIR

CSV_OUT_PATH = PROCESSED_DIR / "hitter_projection_engine_2025.csv"
JSON_OUT_PATH = PROCESSED_DIR / "hitter_projection_engine_2025.json"
VIEWER_JSON_OUT_PATH = VIEWER_DATA_DIR / "hitter_projection_engine_2025.json"

for out_path in (CSV_OUT_PATH, JSON_OUT_PATH, VIEWER_JSON_OUT_PATH):
    out_path.parent.mkdir(parents=True, exist_ok=True)

QUERY = """
SELECT
    player_name,
    team_2024,
    actual_team_2025,
    projected_age,
    ROUND(projected_games, 1) AS projected_games,
    ROUND(projected_pa, 1) AS projected_pa,
    ROUND(projected_value_war_proxy, 2) AS projected_value_war_proxy,
    ROUND(projected_woba, 3) AS projected_woba,
    ROUND(projected_xwoba, 3) AS projected_xwoba,
    ROUND(projected_woba_plus, 0) AS projected_woba_plus,
    ROUND(projected_bb_rate, 3) AS projected_bb_rate,
    ROUND(projected_k_rate, 3) AS projected_k_rate,
    ROUND(projected_home_runs, 1) AS projected_home_runs,
    ROUND(projected_stolen_bases, 1) AS projected_stolen_bases,
    ROUND(projected_defense_runs, 1) AS projected_defense_runs,
    actual_pa_2025,
    actual_war_2025,
    actual_wrc_plus_2025,
    ROUND(actual_woba_2025, 3) AS actual_woba_2025,
    ROUND(pa_error, 1) AS pa_error,
    ROUND(hr_error, 1) AS hr_error,
    ROUND(sb_error, 1) AS sb_error,
    ROUND(woba_error, 3) AS woba_error,
    ROUND(value_war_proxy_error, 2) AS value_war_proxy_error
FROM hitter_projection_engine_2025
ORDER BY projected_value_war_proxy DESC, projected_woba DESC
"""


def main():
    con = duckdb.connect(str(DB_PATH), read_only=True)
    df = con.execute(QUERY).df()
    con.close()

    records = df.where(df.notna(), None).to_dict(orient="records")

    df.to_csv(CSV_OUT_PATH, index=False)
    df.to_json(JSON_OUT_PATH, orient="records", indent=2)
    VIEWER_JSON_OUT_PATH.write_text(JSON_OUT_PATH.read_text())

    print(f"Saved analysis to {CSV_OUT_PATH}")
    print(f"Saved JSON to {JSON_OUT_PATH}")
    print(f"Updated viewer data at {VIEWER_JSON_OUT_PATH}")
    print(df.head(20).to_string(index=False))


if __name__ == "__main__":
    main()
