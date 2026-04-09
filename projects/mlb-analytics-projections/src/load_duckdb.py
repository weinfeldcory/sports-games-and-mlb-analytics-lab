from pathlib import Path

import duckdb

from paths import DB_PATH, RAW_DIR

con = duckdb.connect(str(DB_PATH))

con.execute("DROP TABLE IF EXISTS batting_stats")
con.execute("DROP TABLE IF EXISTS pitching_stats")

con.execute(
    f"""
    CREATE TABLE batting_stats AS
    SELECT *
    FROM read_csv_auto('{RAW_DIR / "batting_stats_2023_2025.csv"}')
"""
)

con.execute(
    f"""
    CREATE TABLE pitching_stats AS
    SELECT *
    FROM read_csv_auto('{RAW_DIR / "pitching_stats_2023_2025.csv"}')
"""
)

print("Created tables:")
print(con.execute("SHOW TABLES").fetchall())

print("Batting row count:", con.execute("SELECT COUNT(*) FROM batting_stats").fetchone()[0])
print("Pitching row count:", con.execute("SELECT COUNT(*) FROM pitching_stats").fetchone()[0])

con.close()
