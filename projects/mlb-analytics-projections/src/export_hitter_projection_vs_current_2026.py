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
        age_bucket,
        archetype,
        position_bucket,
        is_catcher_profile,
        projected_age,
        weighted_pa_sample,
        playing_time_reliability,
        discipline_reliability,
        contact_reliability,
        power_reliability,
        speed_reliability,
        defense_reliability,
        durability_age_factor,
        power_age_factor,
        contact_age_factor,
        speed_age_factor,
        defense_age_factor,
        projected_games_base,
        projected_pa_per_game_base,
        projected_bb_rate_base,
        projected_k_rate_base,
        projected_hr_rate_base,
        projected_sb_rate_base,
        projected_babip_base,
        projected_def_per_pa_base,
        projected_pos_per_pa_base,
        projected_barrel_rate_base,
        projected_hard_hit_rate_base,
        projected_xwoba_base,
        elite_power_uplift,
        projected_games,
        projected_pa,
        projected_value_war_proxy,
        projected_woba_plus,
        projected_walks,
        projected_strikeouts,
        projected_hits,
        projected_singles,
        projected_doubles,
        projected_triples,
        projected_home_runs,
        projected_stolen_bases,
        projected_avg,
        projected_obp,
        projected_slg,
        projected_ops,
        prior_talent_score,
        prior_power_score,
        prior_plate_discipline_score,
        prior_speed_score,
        prior_position_value_score,
        prior_playing_time_score,
        projected_woba,
        projected_xwoba,
        projected_bb_rate,
        projected_k_rate,
        projected_defense_runs
    FROM hitter_projection_engine_2026
),
projection_baselines AS (
    SELECT
        AVG(projected_woba) AS league_projected_woba,
        AVG(projected_bb_rate) AS league_projected_bb_rate,
        AVG(projected_k_rate) AS league_projected_k_rate,
        AVG(projected_hr_rate_base * power_age_factor * elite_power_uplift) AS league_projected_hr_rate,
        AVG(projected_sb_rate_base * speed_age_factor) AS league_projected_sb_rate
    FROM projection
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
            WHEN cs.current_pa > 0 THEN cs.current_walks::DOUBLE / cs.current_pa
            ELSE NULL
        END AS current_bb_rate,
        CASE
            WHEN cs.current_pa > 0 THEN cs.current_strikeouts::DOUBLE / cs.current_pa
            ELSE NULL
        END AS current_k_rate,
        CASE
            WHEN cs.current_pa > 0 THEN cs.current_home_runs::DOUBLE / cs.current_pa
            ELSE NULL
        END AS current_hr_rate,
        CASE
            WHEN cs.current_pa > 0 THEN cs.current_stolen_bases::DOUBLE / cs.current_pa
            ELSE NULL
        END AS current_sb_rate,
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
        p.age_bucket,
        p.archetype,
        p.position_bucket,
        p.is_catcher_profile,
        p.projected_age,
        p.weighted_pa_sample,
        p.playing_time_reliability,
        p.discipline_reliability,
        p.contact_reliability,
        p.power_reliability,
        p.speed_reliability,
        p.defense_reliability,
        p.durability_age_factor,
        p.power_age_factor,
        p.contact_age_factor,
        p.speed_age_factor,
        p.defense_age_factor,
        p.projected_games_base,
        p.projected_pa_per_game_base,
        p.projected_bb_rate_base,
        p.projected_k_rate_base,
        p.projected_hr_rate_base,
        p.projected_sb_rate_base,
        p.projected_babip_base,
        p.projected_def_per_pa_base,
        p.projected_pos_per_pa_base,
        p.projected_barrel_rate_base,
        p.projected_hard_hit_rate_base,
        p.projected_xwoba_base,
        p.elite_power_uplift,
        p.projected_games,
        p.projected_pa,
        p.projected_value_war_proxy,
        p.projected_walks,
        p.projected_strikeouts,
        p.projected_hits,
        p.projected_singles,
        p.projected_doubles,
        p.projected_triples,
        p.projected_home_runs,
        p.projected_stolen_bases,
        p.projected_avg,
        p.projected_obp,
        p.projected_slg,
        p.projected_ops,
        p.prior_talent_score,
        p.prior_power_score,
        p.prior_plate_discipline_score,
        p.prior_speed_score,
        p.prior_position_value_score,
        p.prior_playing_time_score,
        p.projected_woba,
        p.projected_xwoba,
        p.projected_woba_plus,
        p.projected_bb_rate,
        p.projected_k_rate,
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
        csr.current_bb_rate,
        csr.current_k_rate,
        csr.current_hr_rate,
        csr.current_sb_rate,
        csr.pace_factor,
        r.roster_position
    FROM projection AS p
    FULL OUTER JOIN current_stats_with_rates AS csr
        ON p.normalized_name = csr.normalized_name
    FULL OUTER JOIN rosters AS r
        ON COALESCE(p.normalized_name, csr.normalized_name) = r.normalized_name
),
scored AS (
    SELECT
        j.*,
        pb.league_projected_woba,
        pb.league_projected_bb_rate,
        pb.league_projected_k_rate,
        pb.league_projected_hr_rate,
        pb.league_projected_sb_rate,
        LEAST(COALESCE(j.current_pa, 0) / 250.0, 0.80) AS current_sample_weight,
        LEAST(COALESCE(j.current_pa, 0) / NULLIF(GREATEST(j.projected_pa, 250.0), 0), 0.70) AS current_playing_time_weight,
        CASE
            WHEN j.current_woba IS NOT NULL THEN
                LEAST(
                    165.0,
                    GREATEST(
                        45.0,
                        100 * (
                            0.55 * j.current_woba / NULLIF(pb.league_projected_woba, 0)
                            + 0.25 * COALESCE(j.current_bb_rate, pb.league_projected_bb_rate) / NULLIF(pb.league_projected_bb_rate, 0)
                            + 0.20 * pb.league_projected_k_rate / NULLIF(COALESCE(j.current_k_rate, pb.league_projected_k_rate), 0)
                        )
                    )
                )
            ELSE NULL
        END AS current_talent_signal_score,
        CASE
            WHEN j.current_pa IS NOT NULL AND j.current_pa > 0 THEN
                LEAST(
                    170.0,
                    GREATEST(
                        40.0,
                        100 * (
                            0.65 * COALESCE(j.current_hr_rate, pb.league_projected_hr_rate) / NULLIF(pb.league_projected_hr_rate, 0)
                            + 0.35 * COALESCE(j.current_woba, pb.league_projected_woba) / NULLIF(pb.league_projected_woba, 0)
                        )
                    )
                )
            ELSE NULL
        END AS current_power_signal_score,
        CASE
            WHEN j.current_pa IS NOT NULL AND j.current_pa > 0 THEN
                LEAST(
                    170.0,
                    GREATEST(
                        40.0,
                        100 * (
                            0.60 * COALESCE(j.current_sb_rate, pb.league_projected_sb_rate) / NULLIF(pb.league_projected_sb_rate, 0)
                            + 0.40 * COALESCE(j.current_woba, pb.league_projected_woba) / NULLIF(pb.league_projected_woba, 0)
                        )
                    )
                )
            ELSE NULL
        END AS current_speed_signal_score,
        CASE
            WHEN j.current_pa IS NOT NULL AND j.current_pa > 0 THEN
                LEAST(
                    165.0,
                    GREATEST(
                        45.0,
                        100 * (
                            0.55 * COALESCE(j.current_bb_rate, pb.league_projected_bb_rate) / NULLIF(pb.league_projected_bb_rate, 0)
                            + 0.45 * pb.league_projected_k_rate / NULLIF(COALESCE(j.current_k_rate, pb.league_projected_k_rate), 0)
                        )
                    )
                )
            ELSE NULL
        END AS current_plate_discipline_score,
        CASE
            WHEN j.team_games_played > 0 THEN LEAST(145.0, GREATEST(40.0, 100 * (j.current_pa * j.pace_factor) / 600.0))
            ELSE NULL
        END AS current_playing_time_score,
        CASE
            WHEN j.current_woba IS NOT NULL THEN ROUND(j.current_woba - j.projected_woba, 3)
            ELSE NULL
        END AS current_vs_projection_woba_diff
    FROM joined AS j
    CROSS JOIN projection_baselines AS pb
),
blended_scores AS (
    SELECT
        *,
        ROUND(
            (1 - current_sample_weight) * prior_talent_score
            + current_sample_weight * COALESCE(current_talent_signal_score, prior_talent_score),
            1
        ) AS blended_talent_score,
        ROUND(
            (1 - current_sample_weight) * prior_power_score
            + current_sample_weight * COALESCE(current_power_signal_score, prior_power_score),
            1
        ) AS blended_power_score,
        ROUND(
            (1 - current_sample_weight) * prior_speed_score
            + current_sample_weight * COALESCE(current_speed_signal_score, prior_speed_score),
            1
        ) AS blended_speed_score,
        ROUND(
            (1 - current_sample_weight) * prior_plate_discipline_score
            + current_sample_weight * COALESCE(current_plate_discipline_score, prior_plate_discipline_score),
            1
        ) AS blended_plate_discipline_score,
        ROUND(
            (1 - current_playing_time_weight) * prior_playing_time_score
            + current_playing_time_weight * COALESCE(current_playing_time_score, prior_playing_time_score),
            1
        ) AS blended_playing_time_score,
        ROUND(
            prior_position_value_score,
            1
        ) AS blended_position_value_score,
        ROUND(
            LEAST(
                140.0,
                GREATEST(
                    40.0,
                    100
                    + 18 * COALESCE(playing_time_reliability, 0)
                    + 16 * COALESCE(contact_reliability, 0)
                    + 14 * COALESCE(defense_reliability, 0)
                    - 25 * GREATEST(1 - COALESCE(durability_age_factor, 1), 0)
                    - 60 * ABS(COALESCE(current_vs_projection_woba_diff, 0))
                )
            ),
            1
        ) AS stability_score
    FROM scored
),
role_outputs AS (
    SELECT
        *,
        ROUND(
            LEAST(
                150.0,
                GREATEST(
                    35.0,
                    0.34 * blended_talent_score
                    + 0.22 * blended_playing_time_score
                    + 0.14 * blended_power_score
                    + 0.10 * blended_speed_score
                    + 0.10 * blended_plate_discipline_score
                    + 0.10 * blended_position_value_score
                    - 0.10 * (100 - stability_score)
                )
            ),
            1
        ) AS team_building_value_score,
        ROUND(
            LEAST(
                150.0,
                GREATEST(
                    35.0,
                    0.45 * blended_power_score
                    + 0.20 * blended_speed_score
                    + 0.20 * blended_playing_time_score
                    + 0.15 * COALESCE(100 + current_vs_projection_woba_diff * 250, blended_talent_score)
                )
            ),
            1
        ) AS upside_score,
        ROUND(
            LEAST(
                150.0,
                GREATEST(
                    35.0,
                    0.35 * blended_talent_score
                    + 0.25 * blended_plate_discipline_score
                    + 0.20 * blended_position_value_score
                    + 0.20 * stability_score
                )
            ),
            1
        ) AS floor_score,
        ROUND(
            LEAST(
                150.0,
                GREATEST(
                    25.0,
                    0.45 * blended_playing_time_score
                    + 0.25 * stability_score
                    + 0.15 * blended_position_value_score
                    + 0.15 * blended_talent_score
                )
            ),
            1
        ) AS starter_probability_score,
        ROUND(
            LEAST(
                150.0,
                GREATEST(
                    25.0,
                    100
                    + 18 * GREATEST(100 - blended_playing_time_score, 0) / 100
                    + 10 * CASE WHEN position_bucket = 'bat_first' THEN 1 ELSE 0 END
                    + 8 * CASE WHEN archetype = 'power' AND blended_plate_discipline_score < 95 THEN 1 ELSE 0 END
                    - 10 * CASE WHEN roster_position = 'C' THEN 1 ELSE 0 END
                )
            ),
            1
        ) AS platoon_risk_score,
        CASE
            WHEN roster_position = 'C' AND blended_playing_time_score >= 92 THEN 'Everyday catcher'
            WHEN blended_playing_time_score >= 108 AND blended_talent_score >= 108 THEN 'Core lineup bat'
            WHEN blended_playing_time_score >= 100 AND blended_power_score >= 112 THEN 'Middle-order power bat'
            WHEN blended_playing_time_score >= 96 AND blended_talent_score >= 100 THEN 'Everyday regular'
            WHEN blended_position_value_score >= 110 AND blended_playing_time_score >= 92 THEN 'Defense-first regular'
            WHEN blended_power_score >= 112 AND blended_playing_time_score < 96 THEN 'Platoon power bat'
            WHEN blended_speed_score >= 112 AND blended_playing_time_score < 92 THEN 'Bench speed specialist'
            ELSE 'Bench/platoon depth'
        END AS roster_role
    FROM blended_scores
),
final AS (
    SELECT
        player_name,
        fg_player_id,
        team_2026,
        team_2025,
        roster_position,
        age_bucket,
        archetype,
        position_bucket,
        is_catcher_profile,
        roster_role,
        projected_age,
        weighted_pa_sample,
        ROUND(playing_time_reliability, 3) AS playing_time_reliability,
        ROUND(discipline_reliability, 3) AS discipline_reliability,
        ROUND(contact_reliability, 3) AS contact_reliability,
        ROUND(power_reliability, 3) AS power_reliability,
        ROUND(speed_reliability, 3) AS speed_reliability,
        ROUND(defense_reliability, 3) AS defense_reliability,
        ROUND(durability_age_factor, 3) AS durability_age_factor,
        ROUND(power_age_factor, 3) AS power_age_factor,
        ROUND(contact_age_factor, 3) AS contact_age_factor,
        ROUND(speed_age_factor, 3) AS speed_age_factor,
        ROUND(defense_age_factor, 3) AS defense_age_factor,
        ROUND(projected_games_base, 1) AS projected_games_base,
        ROUND(projected_pa_per_game_base, 2) AS projected_pa_per_game_base,
        ROUND(projected_bb_rate_base, 3) AS projected_bb_rate_base,
        ROUND(projected_k_rate_base, 3) AS projected_k_rate_base,
        ROUND(projected_hr_rate_base, 3) AS projected_hr_rate_base,
        ROUND(projected_sb_rate_base, 3) AS projected_sb_rate_base,
        ROUND(projected_babip_base, 3) AS projected_babip_base,
        ROUND(projected_def_per_pa_base * 600, 1) AS projected_defense_runs_base_600,
        ROUND(projected_pos_per_pa_base * 600, 1) AS projected_position_runs_base_600,
        ROUND(projected_barrel_rate_base, 3) AS projected_barrel_rate_base,
        ROUND(projected_hard_hit_rate_base, 3) AS projected_hard_hit_rate_base,
        ROUND(projected_xwoba_base, 3) AS projected_xwoba_base,
        ROUND(elite_power_uplift, 3) AS elite_power_uplift,
        ROUND(projected_games, 1) AS projected_games,
        ROUND(projected_pa, 1) AS projected_pa,
        ROUND(projected_value_war_proxy, 2) AS projected_value_war_proxy,
        ROUND(projected_walks, 1) AS projected_walks,
        ROUND(projected_strikeouts, 1) AS projected_strikeouts,
        ROUND(projected_hits, 1) AS projected_hits,
        ROUND(projected_singles, 1) AS projected_singles,
        ROUND(projected_doubles, 1) AS projected_doubles,
        ROUND(projected_triples, 1) AS projected_triples,
        ROUND(projected_home_runs, 1) AS projected_home_runs,
        ROUND(projected_stolen_bases, 1) AS projected_stolen_bases,
        ROUND(projected_avg, 3) AS projected_avg,
        ROUND(projected_obp, 3) AS projected_obp,
        ROUND(projected_slg, 3) AS projected_slg,
        ROUND(projected_ops, 3) AS projected_ops,
        ROUND(prior_talent_score, 1) AS prior_talent_score,
        ROUND(prior_power_score, 1) AS prior_power_score,
        ROUND(prior_plate_discipline_score, 1) AS prior_plate_discipline_score,
        ROUND(prior_speed_score, 1) AS prior_speed_score,
        ROUND(prior_position_value_score, 1) AS prior_position_value_score,
        ROUND(prior_playing_time_score, 1) AS prior_playing_time_score,
        ROUND(projected_woba, 3) AS projected_woba,
        ROUND(projected_xwoba, 3) AS projected_xwoba,
        ROUND(projected_woba_plus, 0) AS projected_woba_plus,
        ROUND(projected_bb_rate, 3) AS projected_bb_rate,
        ROUND(projected_k_rate, 3) AS projected_k_rate,
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
        ROUND(current_bb_rate, 3) AS current_bb_rate,
        ROUND(current_k_rate, 3) AS current_k_rate,
        ROUND(current_hr_rate, 3) AS current_hr_rate,
        ROUND(current_sb_rate, 3) AS current_sb_rate,
        ROUND(current_sample_weight, 3) AS current_sample_weight,
        ROUND(current_playing_time_weight, 3) AS current_playing_time_weight,
        ROUND(current_talent_signal_score, 1) AS current_talent_signal_score,
        ROUND(current_power_signal_score, 1) AS current_power_signal_score,
        ROUND(current_speed_signal_score, 1) AS current_speed_signal_score,
        ROUND(current_plate_discipline_score, 1) AS current_plate_discipline_score,
        ROUND(current_playing_time_score, 1) AS current_playing_time_score,
        ROUND(blended_talent_score, 1) AS blended_talent_score,
        ROUND(blended_power_score, 1) AS blended_power_score,
        ROUND(blended_speed_score, 1) AS blended_speed_score,
        ROUND(blended_plate_discipline_score, 1) AS blended_plate_discipline_score,
        ROUND(blended_playing_time_score, 1) AS blended_playing_time_score,
        ROUND(blended_position_value_score, 1) AS blended_position_value_score,
        ROUND(team_building_value_score, 1) AS team_building_value_score,
        ROUND(upside_score, 1) AS upside_score,
        ROUND(floor_score, 1) AS floor_score,
        ROUND(starter_probability_score, 1) AS starter_probability_score,
        ROUND(stability_score, 1) AS stability_score,
        ROUND(platoon_risk_score, 1) AS platoon_risk_score,
        ROUND(current_games * pace_factor, 1) AS pace_games_162,
        ROUND(current_pa * pace_factor, 1) AS pace_pa_162,
        ROUND(current_hits * pace_factor, 1) AS pace_hits_162,
        ROUND(current_home_runs * pace_factor, 1) AS pace_home_runs_162,
        ROUND(current_rbi * pace_factor, 1) AS pace_rbi_162,
        ROUND(current_stolen_bases * pace_factor, 1) AS pace_stolen_bases_162,
        ROUND((current_pa * pace_factor) - projected_pa, 1) AS pace_pa_diff,
        ROUND((current_home_runs * pace_factor) - projected_home_runs, 1) AS pace_home_runs_diff,
        ROUND((current_stolen_bases * pace_factor) - projected_stolen_bases, 1) AS pace_stolen_bases_diff,
        ROUND(current_vs_projection_woba_diff, 3) AS current_woba_diff
    FROM role_outputs
)
SELECT *
FROM final
ORDER BY COALESCE(team_building_value_score, 0) DESC, COALESCE(projected_value_war_proxy, 0) DESC, COALESCE(current_pa, 0) DESC, player_name
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
