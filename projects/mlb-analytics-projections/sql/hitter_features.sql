CREATE OR REPLACE TABLE hitter_features AS
WITH base AS (
    SELECT
        "IDfg" AS player_id,
        "Name" AS player_name,
        "Team" AS team,
        "Season" AS season,
        "Age" AS age,
        "G" AS games,
        "PA" AS plate_appearances,
        "AB" AS at_bats,
        "H" AS hits,
        "2B" AS doubles,
        "3B" AS triples,
        "HR" AS home_runs,
        "R" AS runs,
        "RBI" AS rbi,
        "BB" AS walks,
        "SO" AS strikeouts,
        "AVG" AS avg,
        "OBP" AS obp,
        "SLG" AS slg,
        "OPS" AS ops,
        "ISO" AS iso,
        "wOBA" AS woba,
        "xwOBA" AS xwoba,
        "WAR" AS war,
        "wRC+" AS wrc_plus,
        CASE WHEN "PA" > 0 THEN "SO"::DOUBLE / "PA" ELSE NULL END AS k_rate,
        CASE WHEN "PA" > 0 THEN "BB"::DOUBLE / "PA" ELSE NULL END AS bb_rate,
        "OBP" + "SLG" AS ops_calc,
        "SLG" - "AVG" AS iso_calc
    FROM batting_stats
),
features AS (
    SELECT
        *,
        AVG(ops) OVER rolling_3yr AS rolling_3yr_ops,
        AVG(iso) OVER rolling_3yr AS rolling_3yr_iso,
        AVG(k_rate) OVER rolling_3yr AS rolling_3yr_k_rate,
        AVG(bb_rate) OVER rolling_3yr AS rolling_3yr_bb_rate,
        AVG(woba) OVER rolling_3yr AS rolling_3yr_woba,
        AVG(xwoba) OVER rolling_3yr AS rolling_3yr_xwoba,
        AVG(war) OVER rolling_3yr AS rolling_3yr_war,
        AVG(plate_appearances) OVER rolling_3yr AS rolling_3yr_pa
    FROM base
    WINDOW rolling_3yr AS (
        PARTITION BY player_id
        ORDER BY season
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    )
)
SELECT
    *
FROM features;
