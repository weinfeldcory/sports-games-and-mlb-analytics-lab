from pathlib import Path

import duckdb

from paths import DB_PATH, SQL_DIR

SQL_FILES = [
    SQL_DIR / "player_metadata.sql",
    SQL_DIR / "hitter_features.sql",
    SQL_DIR / "woba_xwoba_diff.sql",
    SQL_DIR / "aging_curves.sql",
    SQL_DIR / "hitter_model_2025.sql",
    SQL_DIR / "hitter_projection_engine_2025.sql",
    SQL_DIR / "hitter_projection_engine_2026.sql",
]


def main():
    con = duckdb.connect(str(DB_PATH))

    for sql_file in SQL_FILES:
        print(f"Running {sql_file}...")
        con.execute(sql_file.read_text())

    tables = [
        "player_metadata",
        "batting_stats_enriched",
        "pitching_stats_enriched",
        "hitter_features",
        "player_woba_xwoba",
        "player_age_performance",
        "age_group_performance",
        "aging_curve_by_age",
        "hitter_model_2025",
        "hitter_projection_engine_2025",
        "hitter_projection_engine_2026",
    ]

    print("Created modeling tables:")
    for table in tables:
        row_count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"- {table}: {row_count} rows")

    con.close()


if __name__ == "__main__":
    main()
