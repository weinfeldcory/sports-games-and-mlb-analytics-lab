SELECT
    "Name",
    "Team",
    season,
    "PA",
    "HR",
    "R",
    "RBI",
    "BB%",
    "K%",
    "AVG",
    "OBP",
    "SLG",
    "OPS",
    "WAR"
FROM batting_stats
WHERE season = 2025
  AND "PA" >= 300
ORDER BY "OPS" DESC
LIMIT 25;
