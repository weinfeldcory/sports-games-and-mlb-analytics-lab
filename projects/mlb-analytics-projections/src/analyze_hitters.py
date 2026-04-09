from pathlib import Path

import duckdb

from paths import DB_PATH, PROCESSED_DIR

OUT_PATH = PROCESSED_DIR / "top_hitters_2025.csv"
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

query = """
SELECT
    "Name",
    "Team",
    season,
    "PA",
    "HR",
    "AVG",
    "OBP",
    "SLG",
    "OPS",
    "WAR"
FROM batting_stats
WHERE season = 2025
  AND "PA" >= 300
ORDER BY "WAR" DESC, "OPS" DESC
LIMIT 50
"""

con = duckdb.connect(str(DB_PATH))
df = con.execute(query).df()
con.close()

df.to_csv(OUT_PATH, index=False)
print(f"Saved analysis to {OUT_PATH}")
print(df.head(10))
