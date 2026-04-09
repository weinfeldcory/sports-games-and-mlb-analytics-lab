CREATE OR REPLACE TABLE player_woba_xwoba AS
SELECT
    "IDfg" AS player_id,
    "Name" AS player_name,
    "Team" AS team,
    "Season" AS season,
    "Age" AS age,
    "PA" AS plate_appearances,
    "wOBA" AS actual_woba,
    "xwOBA" AS expected_woba,
    "wOBA" - "xwOBA" AS woba_minus_xwoba
FROM batting_stats
WHERE "wOBA" IS NOT NULL
  AND "xwOBA" IS NOT NULL;
