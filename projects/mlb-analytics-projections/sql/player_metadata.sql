CREATE OR REPLACE TABLE player_metadata AS
WITH player_seasons AS (
    SELECT
        "IDfg" AS player_id,
        "Name" AS player_name,
        "Season" AS season,
        "Age" AS age,
        'batting' AS source_table
    FROM batting_stats
    UNION ALL
    SELECT
        "IDfg" AS player_id,
        "Name" AS player_name,
        "Season" AS season,
        "Age" AS age,
        'pitching' AS source_table
    FROM pitching_stats
),
ranked_players AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY player_id
            ORDER BY season DESC, source_table
        ) AS recency_rank,
        BOOL_OR(source_table = 'batting') OVER (PARTITION BY player_id) AS has_batting,
        BOOL_OR(source_table = 'pitching') OVER (PARTITION BY player_id) AS has_pitching
    FROM player_seasons
)
SELECT
    player_id,
    player_name,
    age,
    CAST(NULL AS VARCHAR) AS batting_handedness,
    CAST(NULL AS VARCHAR) AS throwing_handedness,
    CASE
        WHEN has_pitching AND NOT has_batting THEN 'P'
        ELSE CAST(NULL AS VARCHAR)
    END AS primary_position,
    has_batting,
    has_pitching
FROM ranked_players
WHERE recency_rank = 1;

CREATE OR REPLACE TABLE batting_stats_enriched AS
SELECT
    b.*,
    pm.batting_handedness,
    pm.throwing_handedness,
    pm.primary_position
FROM batting_stats AS b
LEFT JOIN player_metadata AS pm
    ON b."IDfg" = pm.player_id;

CREATE OR REPLACE TABLE pitching_stats_enriched AS
SELECT
    p.*,
    pm.batting_handedness,
    pm.throwing_handedness,
    pm.primary_position
FROM pitching_stats AS p
LEFT JOIN player_metadata AS pm
    ON p."IDfg" = pm.player_id;
