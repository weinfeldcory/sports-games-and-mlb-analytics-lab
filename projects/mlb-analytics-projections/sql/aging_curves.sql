CREATE OR REPLACE TABLE player_age_performance AS
SELECT
    player_id,
    player_name,
    team,
    season,
    age,
    CASE
        WHEN age <= 24 THEN '24 and under'
        WHEN age BETWEEN 25 AND 27 THEN '25-27'
        WHEN age BETWEEN 28 AND 30 THEN '28-30'
        WHEN age BETWEEN 31 AND 33 THEN '31-33'
        ELSE '34 and older'
    END AS age_group,
    plate_appearances,
    ops,
    war,
    woba,
    xwoba,
    rolling_3yr_ops,
    rolling_3yr_war
FROM hitter_features
WHERE age IS NOT NULL;

CREATE OR REPLACE TABLE age_group_performance AS
SELECT
    age_group,
    COUNT(*) AS player_seasons,
    SUM(plate_appearances) AS total_plate_appearances,
    AVG(age) AS avg_age,
    AVG(ops) AS avg_ops,
    AVG(war) AS avg_war,
    AVG(woba) AS avg_woba,
    AVG(xwoba) AS avg_xwoba,
    AVG(rolling_3yr_ops) AS avg_rolling_3yr_ops,
    AVG(rolling_3yr_war) AS avg_rolling_3yr_war
FROM player_age_performance
GROUP BY age_group
ORDER BY
    CASE age_group
        WHEN '24 and under' THEN 1
        WHEN '25-27' THEN 2
        WHEN '28-30' THEN 3
        WHEN '31-33' THEN 4
        ELSE 5
    END;

CREATE OR REPLACE TABLE aging_curve_by_age AS
SELECT
    age,
    COUNT(*) AS player_seasons,
    SUM(plate_appearances) AS total_plate_appearances,
    AVG(ops) AS avg_ops,
    AVG(war) AS avg_war,
    AVG(woba) AS avg_woba,
    AVG(xwoba) AS avg_xwoba
FROM player_age_performance
GROUP BY age
ORDER BY age;
