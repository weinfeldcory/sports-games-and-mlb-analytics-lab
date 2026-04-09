from pathlib import Path

import duckdb

from paths import DB_PATH, PROCESSED_DIR, VIEWER_DATA_DIR

CSV_OUT_PATH = PROCESSED_DIR / "hitter_projection_vs_current_2026.csv"
JSON_OUT_PATH = PROCESSED_DIR / "hitter_projection_vs_current_2026.json"
VIEWER_JSON_OUT_PATH = VIEWER_DATA_DIR / "hitter_projection_vs_current_2026.json"

for out_path in (CSV_OUT_PATH, JSON_OUT_PATH, VIEWER_JSON_OUT_PATH):
    out_path.parent.mkdir(parents=True, exist_ok=True)

QUERY = """
WITH projection AS (
    SELECT
        player_id,
        player_name,
        lower(regexp_replace(player_name, '[^a-z0-9]', '', 'g')) AS normalized_name,
        team_2025,
        projected_age,
        projected_games,
        projected_pa,
        projected_value_war_proxy,
        projected_woba,
        projected_xwoba,
        projected_woba_plus,
        projected_bb_rate,
        projected_k_rate,
        projected_home_runs,
        projected_stolen_bases,
        projected_defense_runs
    FROM hitter_projection_engine_2026
),
team_games AS (
    SELECT team_name, COUNT(*) AS team_games_played
    FROM (
        SELECT away_team AS team_name, game_pk FROM live_completed_games
        UNION ALL
        SELECT home_team AS team_name, game_pk FROM live_completed_games
    )
    GROUP BY 1
),
current_stats AS (
    SELECT
        lower(regexp_replace(player_name, '[^a-z0-9]', '', 'g')) AS normalized_name,
        max_by(player_name, game_date) AS player_name,
        max_by(team_name, game_date) AS current_team_2026,
        COUNT(DISTINCT game_pk) AS current_games,
        SUM(COALESCE(at_bats, 0) + COALESCE(walks, 0) + COALESCE(hit_by_pitch, 0) + COALESCE(sac_flies, 0) + COALESCE(sac_bunts, 0)) AS current_pa,
        SUM(COALESCE(at_bats, 0)) AS current_at_bats,
        SUM(COALESCE(hits, 0)) AS current_hits,
        SUM(COALESCE(doubles, 0)) AS current_doubles,
        SUM(COALESCE(triples, 0)) AS current_triples,
        SUM(COALESCE(home_runs, 0)) AS current_home_runs,
        SUM(COALESCE(rbi, 0)) AS current_rbi,
        SUM(COALESCE(walks, 0)) AS current_walks,
        SUM(COALESCE(strikeouts, 0)) AS current_strikeouts,
        SUM(COALESCE(stolen_bases, 0)) AS current_stolen_bases,
        SUM(COALESCE(hit_by_pitch, 0)) AS current_hbp,
        SUM(COALESCE(sac_flies, 0)) AS current_sf,
        SUM(COALESCE(sac_bunts, 0)) AS current_sh
    FROM live_batting_lines
    GROUP BY 1
),
current_stats_with_rates AS (
    SELECT
        cs.*,
        tg.team_games_played,
        CASE
            WHEN cs.current_at_bats > 0 THEN cs.current_hits::DOUBLE / cs.current_at_bats
            ELSE NULL
        END AS current_avg,
        CASE
            WHEN cs.current_pa > 0 THEN (cs.current_hits + cs.current_walks + cs.current_hbp)::DOUBLE / cs.current_pa
            ELSE NULL
        END AS current_obp,
        CASE
            WHEN cs.current_at_bats > 0 THEN
                (
                    (cs.current_hits - cs.current_doubles - cs.current_triples - cs.current_home_runs)
                    + 2 * cs.current_doubles
                    + 3 * cs.current_triples
                    + 4 * cs.current_home_runs
                )::DOUBLE / cs.current_at_bats
            ELSE NULL
        END AS current_slg,
        CASE
            WHEN cs.current_pa > 0 THEN
                (
                    0.69 * cs.current_walks
                    + 0.72 * cs.current_hbp
                    + 0.88 * (cs.current_hits - cs.current_doubles - cs.current_triples - cs.current_home_runs)
                    + 1.247 * cs.current_doubles
                    + 1.578 * cs.current_triples
                    + 2.031 * cs.current_home_runs
                ) / cs.current_pa
            ELSE NULL
        END AS current_woba,
        CASE
            WHEN tg.team_games_played > 0 THEN 162.0 / tg.team_games_played
            ELSE NULL
        END AS pace_factor
    FROM current_stats AS cs
    LEFT JOIN team_games AS tg
        ON cs.current_team_2026 = tg.team_name
),
rosters AS (
    SELECT
        lower(regexp_replace(player_name, '[^a-z0-9]', '', 'g')) AS normalized_name,
        max_by(player_name, team_name) AS roster_player_name,
        max_by(team_name, team_name) AS roster_team_2026,
        max_by(position_abbrev, team_name) AS roster_position
    FROM live_rosters
    GROUP BY 1
),
joined AS (
    SELECT
        COALESCE(p.player_name, csr.player_name, r.roster_player_name) AS player_name,
        p.player_id AS fg_player_id,
        COALESCE(csr.current_team_2026, r.roster_team_2026, p.team_2025) AS team_2026,
        p.team_2025,
        p.projected_age,
        p.projected_games,
        p.projected_pa,
        p.projected_value_war_proxy,
        p.projected_woba,
        p.projected_xwoba,
        p.projected_woba_plus,
        p.projected_bb_rate,
        p.projected_k_rate,
        p.projected_home_runs,
        p.projected_stolen_bases,
        p.projected_defense_runs,
        csr.team_games_played,
        csr.current_games,
        csr.current_pa,
        csr.current_at_bats,
        csr.current_hits,
        csr.current_doubles,
        csr.current_triples,
        csr.current_home_runs,
        csr.current_rbi,
        csr.current_walks,
        csr.current_strikeouts,
        csr.current_stolen_bases,
        csr.current_avg,
        csr.current_obp,
        csr.current_slg,
        CASE
            WHEN csr.current_obp IS NOT NULL AND csr.current_slg IS NOT NULL THEN csr.current_obp + csr.current_slg
            ELSE NULL
        END AS current_ops,
        csr.current_woba,
        csr.pace_factor,
        r.roster_position
    FROM projection AS p
    FULL OUTER JOIN current_stats_with_rates AS csr
        ON p.normalized_name = csr.normalized_name
    FULL OUTER JOIN rosters AS r
        ON COALESCE(p.normalized_name, csr.normalized_name) = r.normalized_name
),
final AS (
    SELECT
        player_name,
        fg_player_id,
        team_2026,
        team_2025,
        roster_position,
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
        team_games_played,
        current_games,
        current_pa,
        current_at_bats,
        current_hits,
        current_doubles,
        current_triples,
        current_home_runs,
        current_rbi,
        current_walks,
        current_strikeouts,
        current_stolen_bases,
        ROUND(current_avg, 3) AS current_avg,
        ROUND(current_obp, 3) AS current_obp,
        ROUND(current_slg, 3) AS current_slg,
        ROUND(current_ops, 3) AS current_ops,
        ROUND(current_woba, 3) AS current_woba,
        ROUND(current_games * pace_factor, 1) AS pace_games_162,
        ROUND(current_pa * pace_factor, 1) AS pace_pa_162,
        ROUND(current_hits * pace_factor, 1) AS pace_hits_162,
        ROUND(current_home_runs * pace_factor, 1) AS pace_home_runs_162,
        ROUND(current_rbi * pace_factor, 1) AS pace_rbi_162,
        ROUND(current_stolen_bases * pace_factor, 1) AS pace_stolen_bases_162,
        ROUND((current_pa * pace_factor) - projected_pa, 1) AS pace_pa_diff,
        ROUND((current_home_runs * pace_factor) - projected_home_runs, 1) AS pace_home_runs_diff,
        ROUND((current_stolen_bases * pace_factor) - projected_stolen_bases, 1) AS pace_stolen_bases_diff,
        ROUND(current_woba - projected_woba, 3) AS current_woba_diff
    FROM joined
)
SELECT *
FROM final
ORDER BY COALESCE(projected_value_war_proxy, 0) DESC, COALESCE(current_pa, 0) DESC, player_name
"""


def main() -> None:
    con = duckdb.connect(str(DB_PATH), read_only=True)
    df = con.execute(QUERY).df()
    con.close()

    df.to_csv(CSV_OUT_PATH, index=False)
    df.to_json(JSON_OUT_PATH, orient="records", indent=2)
    VIEWER_JSON_OUT_PATH.write_text(JSON_OUT_PATH.read_text())

    print(f"Saved comparison to {CSV_OUT_PATH}")
    print(f"Saved JSON to {JSON_OUT_PATH}")
    print(f"Updated viewer data at {VIEWER_JSON_OUT_PATH}")
    print(df.head(20).to_string(index=False))


if __name__ == "__main__":
    main()
