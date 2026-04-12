from pathlib import Path

import duckdb

from paths import DB_PATH, PROCESSED_DIR, VIEWER_DATA_DIR

CSV_OUT_PATH = PROCESSED_DIR / "pitcher_projection_vs_current_2026.csv"
JSON_OUT_PATH = PROCESSED_DIR / "pitcher_projection_vs_current_2026.json"
VIEWER_JSON_OUT_PATH = VIEWER_DATA_DIR / "pitcher_projection_vs_current_2026.json"

for out_path in (CSV_OUT_PATH, JSON_OUT_PATH, VIEWER_JSON_OUT_PATH):
    out_path.parent.mkdir(parents=True, exist_ok=True)

QUERY = """
WITH historical AS (
    SELECT
        "IDfg" AS player_id,
        lower(regexp_replace("Name", '[^a-z0-9]', '', 'g')) AS normalized_name,
        "Name" AS player_name,
        "Team" AS team_name,
        "Season" AS season,
        "Age" AS age,
        COALESCE("WAR", 0) AS war,
        COALESCE("W", 0) AS wins,
        COALESCE("L", 0) AS losses,
        COALESCE("G", 0) AS games,
        COALESCE("GS", 0) AS starts,
        COALESCE("SV", 0) AS saves,
        COALESCE("IP", 0) AS innings_pitched,
        COALESCE("TBF", 0) AS batters_faced,
        COALESCE("H", 0) AS hits_allowed,
        COALESCE("R", 0) AS runs_allowed,
        COALESCE("ER", 0) AS earned_runs,
        COALESCE("HR", 0) AS home_runs_allowed,
        COALESCE("BB", 0) AS walks,
        COALESCE("SO", 0) AS strikeouts,
        COALESCE("ERA", 0) AS era,
        COALESCE("WHIP", 0) AS whip,
        COALESCE("FIP", 0) AS fip,
        COALESCE("xFIP", 0) AS xfip,
        COALESCE("xERA", 0) AS xera,
        COALESCE("K%", 0) AS strikeout_rate,
        COALESCE("BB%", 0) AS walk_rate,
        COALESCE("AVG", 0) AS avg_allowed,
        COALESCE("HardHit%", 0) AS hard_hit_rate,
        COALESCE("Barrel%", 0) AS barrel_rate,
        COALESCE("EV", 0) AS exit_velocity,
        COALESCE("LA", 0) AS launch_angle,
        COALESCE("Stuff+", 100) AS stuff_plus,
        COALESCE("Location+", 100) AS location_plus,
        COALESCE("Pitching+", 100) AS pitching_plus,
        CASE
            WHEN COALESCE("Season", 0) = 2025 THEN 0.62
            WHEN COALESCE("Season", 0) = 2024 THEN 0.38
            ELSE 0.0
        END AS season_weight,
        CASE
            WHEN COALESCE("IP", 0) > 0 THEN COALESCE("SO", 0)::DOUBLE / "IP"
            ELSE NULL
        END AS strikeouts_per_inning,
        CASE
            WHEN COALESCE("IP", 0) > 0 THEN COALESCE("BB", 0)::DOUBLE / "IP"
            ELSE NULL
        END AS walks_per_inning,
        CASE
            WHEN COALESCE("IP", 0) > 0 THEN COALESCE("H", 0)::DOUBLE / "IP"
            ELSE NULL
        END AS hits_per_inning,
        CASE
            WHEN COALESCE("IP", 0) > 0 THEN COALESCE("HR", 0)::DOUBLE / "IP"
            ELSE NULL
        END AS home_runs_per_inning,
        CASE
            WHEN COALESCE("G", 0) > 0 THEN COALESCE("GS", 0)::DOUBLE / "G"
            ELSE 0
        END AS start_share,
        CASE
            WHEN COALESCE("G", 0) > 0 THEN COALESCE("SV", 0)::DOUBLE / "G"
            ELSE 0
        END AS save_share
    FROM pitching_stats_enriched
    WHERE "Season" IN (2024, 2025)
),
projection AS (
    SELECT
        player_id,
        normalized_name,
        max_by(player_name, season) AS player_name,
        max_by(team_name, season) AS team_2025,
        max_by(age + (2026 - season), season) AS projected_age,
        ROUND(SUM(innings_pitched * season_weight), 1) AS weighted_ip_sample,
        ROUND(SUM(war * season_weight) / NULLIF(SUM(season_weight), 0), 2) AS projected_war,
        ROUND(SUM(wins * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_wins,
        ROUND(SUM(losses * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_losses,
        ROUND(SUM(games * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_games_base,
        ROUND(SUM(starts * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_starts_base,
        ROUND(SUM(saves * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_saves_base,
        ROUND(SUM(innings_pitched * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_ip_base,
        ROUND(SUM(era * season_weight) / NULLIF(SUM(season_weight), 0), 2) AS projected_era_base,
        ROUND(SUM(whip * season_weight) / NULLIF(SUM(season_weight), 0), 2) AS projected_whip_base,
        ROUND(SUM(fip * season_weight) / NULLIF(SUM(season_weight), 0), 2) AS projected_fip_base,
        ROUND(SUM(xfip * season_weight) / NULLIF(SUM(season_weight), 0), 2) AS projected_xfip_base,
        ROUND(SUM(xera * season_weight) / NULLIF(SUM(season_weight), 0), 2) AS projected_xera_base,
        ROUND(SUM(strikeout_rate * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_k_rate_base,
        ROUND(SUM(walk_rate * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_bb_rate_base,
        ROUND(SUM(avg_allowed * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_avg_allowed_base,
        ROUND(SUM(strikeouts_per_inning * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_strikeouts_per_inning_base,
        ROUND(SUM(walks_per_inning * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_walks_per_inning_base,
        ROUND(SUM(hits_per_inning * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_hits_per_inning_base,
        ROUND(SUM(home_runs_per_inning * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_home_runs_per_inning_base,
        ROUND(SUM(hard_hit_rate * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_hard_hit_rate_base,
        ROUND(SUM(barrel_rate * season_weight) / NULLIF(SUM(season_weight), 0), 3) AS projected_barrel_rate_base,
        ROUND(SUM(exit_velocity * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_exit_velocity_base,
        ROUND(SUM(launch_angle * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_launch_angle_base,
        ROUND(SUM(stuff_plus * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_stuff_plus_base,
        ROUND(SUM(location_plus * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_location_plus_base,
        ROUND(SUM(pitching_plus * season_weight) / NULLIF(SUM(season_weight), 0), 1) AS projected_pitching_plus_base,
        ROUND(SUM(start_share * innings_pitched * season_weight) / NULLIF(SUM(innings_pitched * season_weight), 0), 3) AS projected_start_share,
        ROUND(SUM(save_share * games * season_weight) / NULLIF(SUM(games * season_weight), 0), 3) AS projected_save_share,
        ROUND(LEAST(SUM(innings_pitched * season_weight) / 160.0, 1.0), 3) AS workload_reliability,
        ROUND(LEAST(SUM(innings_pitched * season_weight) / 120.0, 1.0), 3) AS run_prevention_reliability,
        ROUND(LEAST(SUM(innings_pitched * season_weight) / 100.0, 1.0), 3) AS quality_reliability
    FROM historical
    GROUP BY 1, 2
),
projection_with_roles AS (
    SELECT
        *,
        ROUND(
            CASE
                WHEN projected_age <= 27 THEN LEAST(1.04, 1.00 + (28 - projected_age) * 0.008)
                WHEN projected_age BETWEEN 28 AND 31 THEN 1.00
                ELSE GREATEST(0.88, 1.00 - (projected_age - 31) * 0.02)
            END,
            3
        ) AS durability_age_factor,
        ROUND(
            CASE
                WHEN projected_age <= 27 THEN LEAST(1.03, 1.00 + (28 - projected_age) * 0.006)
                WHEN projected_age BETWEEN 28 AND 31 THEN 1.00
                ELSE GREATEST(0.90, 1.00 - (projected_age - 31) * 0.015)
            END,
            3
        ) AS skill_age_factor,
        CASE
            WHEN projected_start_share >= 0.45 THEN 'starter'
            WHEN projected_save_share >= 0.28 THEN 'closer'
            WHEN projected_save_share >= 0.08 THEN 'high_leverage_reliever'
            WHEN projected_start_share >= 0.15 OR projected_ip_base >= 85 THEN 'swingman'
            ELSE 'reliever'
        END AS projected_role_bucket
    FROM projection
),
projection_outputs AS (
    SELECT
        *,
        ROUND(
            CASE projected_role_bucket
                WHEN 'starter' THEN LEAST(210.0, GREATEST(90.0, projected_ip_base * durability_age_factor * 1.03))
                WHEN 'closer' THEN LEAST(78.0, GREATEST(45.0, projected_ip_base * durability_age_factor * 0.95))
                WHEN 'high_leverage_reliever' THEN LEAST(88.0, GREATEST(48.0, projected_ip_base * durability_age_factor * 0.98))
                WHEN 'swingman' THEN LEAST(120.0, GREATEST(55.0, projected_ip_base * durability_age_factor))
                ELSE LEAST(92.0, GREATEST(40.0, projected_ip_base * durability_age_factor))
            END,
            1
        ) AS projected_ip,
        ROUND(projected_era_base / NULLIF(skill_age_factor, 0), 2) AS projected_era,
        ROUND(projected_whip_base / NULLIF(skill_age_factor, 0), 2) AS projected_whip,
        ROUND(projected_xera_base / NULLIF(skill_age_factor, 0), 2) AS projected_xera,
        ROUND(projected_fip_base / NULLIF(skill_age_factor, 0), 2) AS projected_fip,
        ROUND(projected_xfip_base / NULLIF(skill_age_factor, 0), 2) AS projected_xfip
    FROM projection_with_roles
),
projection_counts AS (
    SELECT
        *,
        ROUND(projected_ip * projected_strikeouts_per_inning_base * skill_age_factor, 0) AS projected_strikeouts,
        ROUND(projected_ip * projected_walks_per_inning_base / NULLIF(skill_age_factor, 0), 0) AS projected_walks,
        ROUND(projected_ip * projected_hits_per_inning_base / NULLIF(skill_age_factor, 0), 0) AS projected_hits_allowed,
        ROUND(projected_ip * projected_home_runs_per_inning_base / NULLIF(skill_age_factor, 0), 0) AS projected_home_runs_allowed,
        ROUND(projected_ip * projected_era / 9.0, 1) AS projected_earned_runs,
        ROUND(projected_ip * projected_era / 9.0 * 1.08, 1) AS projected_runs_allowed,
        ROUND(
            CASE
                WHEN projected_role_bucket = 'starter' THEN projected_ip / 5.8
                WHEN projected_role_bucket = 'swingman' THEN projected_ip / 4.2
                ELSE 0
            END,
            1
        ) AS projected_starts,
        ROUND(
            CASE
                WHEN projected_role_bucket = 'closer' THEN LEAST(projected_games_base, projected_ip / 1.0) * 0.62
                WHEN projected_role_bucket = 'high_leverage_reliever' THEN LEAST(projected_games_base, projected_ip / 1.0) * 0.18
                ELSE 0
            END,
            1
        ) AS projected_saves
    FROM projection_outputs
),
projection_baselines AS (
    SELECT
        AVG(projected_ip) AS league_projected_ip,
        AVG(projected_era) AS league_projected_era,
        AVG(projected_whip) AS league_projected_whip,
        AVG(projected_strikeouts_per_inning_base) AS league_projected_strikeouts_per_inning,
        AVG(projected_walks_per_inning_base) AS league_projected_walks_per_inning,
        AVG(projected_hits_per_inning_base) AS league_projected_hits_per_inning,
        AVG(projected_home_runs_per_inning_base) AS league_projected_home_runs_per_inning,
        AVG(projected_xera) AS league_projected_xera,
        AVG(projected_hard_hit_rate_base) AS league_projected_hard_hit_rate,
        AVG(projected_barrel_rate_base) AS league_projected_barrel_rate,
        AVG(projected_exit_velocity_base) AS league_projected_exit_velocity,
        AVG(projected_stuff_plus_base) AS league_projected_stuff_plus,
        AVG(projected_location_plus_base) AS league_projected_location_plus,
        AVG(projected_pitching_plus_base) AS league_projected_pitching_plus
    FROM projection_counts
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
        SUM(CASE WHEN is_starter THEN 1 ELSE 0 END) AS current_starts,
        SUM(CASE WHEN decision LIKE '%SV%' THEN 1 ELSE 0 END) AS current_saves,
        SUM(COALESCE(outs, 0)) / 3.0 AS current_ip,
        SUM(COALESCE(hits_allowed, 0)) AS current_hits_allowed,
        SUM(COALESCE(runs_allowed, 0)) AS current_runs_allowed,
        SUM(COALESCE(earned_runs, 0)) AS current_earned_runs,
        SUM(COALESCE(walks, 0)) AS current_walks,
        SUM(COALESCE(strikeouts, 0)) AS current_strikeouts,
        SUM(COALESCE(home_runs_allowed, 0)) AS current_home_runs_allowed,
        SUM(COALESCE(batters_faced, 0)) AS current_batters_faced
    FROM live_pitching_lines
    GROUP BY 1
),
current_stats_with_rates AS (
    SELECT
        cs.*,
        tg.team_games_played,
        CASE
            WHEN cs.current_ip > 0 THEN 9.0 * cs.current_earned_runs / cs.current_ip
            ELSE NULL
        END AS current_era,
        CASE
            WHEN cs.current_ip > 0 THEN (cs.current_hits_allowed + cs.current_walks) / cs.current_ip
            ELSE NULL
        END AS current_whip,
        CASE
            WHEN cs.current_batters_faced > 0 THEN cs.current_strikeouts::DOUBLE / cs.current_batters_faced
            ELSE NULL
        END AS current_k_rate,
        CASE
            WHEN cs.current_batters_faced > 0 THEN cs.current_walks::DOUBLE / cs.current_batters_faced
            ELSE NULL
        END AS current_bb_rate,
        CASE
            WHEN cs.current_ip > 0 THEN cs.current_strikeouts::DOUBLE / cs.current_ip
            ELSE NULL
        END AS current_strikeouts_per_inning,
        CASE
            WHEN cs.current_ip > 0 THEN cs.current_walks::DOUBLE / cs.current_ip
            ELSE NULL
        END AS current_walks_per_inning,
        CASE
            WHEN cs.current_ip > 0 THEN cs.current_hits_allowed::DOUBLE / cs.current_ip
            ELSE NULL
        END AS current_hits_per_inning,
        CASE
            WHEN cs.current_ip > 0 THEN cs.current_home_runs_allowed::DOUBLE / cs.current_ip
            ELSE NULL
        END AS current_home_runs_per_inning,
        CASE
            WHEN tg.team_games_played > 0 THEN 162.0 / tg.team_games_played
            ELSE NULL
        END AS pace_factor
    FROM current_stats AS cs
    LEFT JOIN team_games AS tg
        ON cs.current_team_2026 = tg.team_name
),
joined AS (
    SELECT
        COALESCE(p.player_name, csr.player_name) AS player_name,
        p.player_id AS fg_player_id,
        COALESCE(csr.current_team_2026, p.team_2025) AS team_2026,
        p.team_2025,
        'P' AS roster_position,
        p.projected_role_bucket,
        p.projected_age,
        p.weighted_ip_sample,
        p.workload_reliability,
        p.run_prevention_reliability,
        p.quality_reliability,
        p.durability_age_factor,
        p.skill_age_factor,
        p.projected_war,
        p.projected_wins,
        p.projected_losses,
        p.projected_games_base,
        p.projected_starts_base,
        p.projected_saves_base,
        p.projected_ip_base,
        p.projected_era_base,
        p.projected_whip_base,
        p.projected_fip_base,
        p.projected_xfip_base,
        p.projected_xera_base,
        p.projected_k_rate_base,
        p.projected_bb_rate_base,
        p.projected_avg_allowed_base,
        p.projected_strikeouts_per_inning_base,
        p.projected_walks_per_inning_base,
        p.projected_hits_per_inning_base,
        p.projected_home_runs_per_inning_base,
        p.projected_hard_hit_rate_base,
        p.projected_barrel_rate_base,
        p.projected_exit_velocity_base,
        p.projected_launch_angle_base,
        p.projected_stuff_plus_base,
        p.projected_location_plus_base,
        p.projected_pitching_plus_base,
        p.projected_start_share,
        p.projected_save_share,
        p.projected_ip,
        p.projected_era,
        p.projected_whip,
        p.projected_xera,
        p.projected_fip,
        p.projected_xfip,
        p.projected_strikeouts,
        p.projected_walks,
        p.projected_hits_allowed,
        p.projected_home_runs_allowed,
        p.projected_earned_runs,
        p.projected_runs_allowed,
        p.projected_starts,
        p.projected_saves,
        csr.team_games_played,
        csr.current_games,
        csr.current_starts,
        csr.current_saves,
        csr.current_ip,
        csr.current_hits_allowed,
        csr.current_runs_allowed,
        csr.current_earned_runs,
        csr.current_walks,
        csr.current_strikeouts,
        csr.current_home_runs_allowed,
        csr.current_batters_faced,
        csr.current_era,
        csr.current_whip,
        csr.current_k_rate,
        csr.current_bb_rate,
        csr.current_strikeouts_per_inning,
        csr.current_walks_per_inning,
        csr.current_hits_per_inning,
        csr.current_home_runs_per_inning,
        csr.pace_factor
    FROM projection_counts AS p
    LEFT JOIN current_stats_with_rates AS csr
        ON p.normalized_name = csr.normalized_name
),
scored AS (
    SELECT
        j.*,
        pb.league_projected_ip,
        pb.league_projected_era,
        pb.league_projected_whip,
        pb.league_projected_strikeouts_per_inning,
        pb.league_projected_walks_per_inning,
        pb.league_projected_hits_per_inning,
        pb.league_projected_home_runs_per_inning,
        pb.league_projected_xera,
        pb.league_projected_hard_hit_rate,
        pb.league_projected_barrel_rate,
        pb.league_projected_exit_velocity,
        pb.league_projected_stuff_plus,
        pb.league_projected_location_plus,
        pb.league_projected_pitching_plus,
        LEAST(COALESCE(j.current_ip, 0) / 70.0, 0.78) AS current_sample_weight,
        LEAST(COALESCE(j.current_ip, 0) / NULLIF(GREATEST(j.projected_ip, 40.0), 0), 0.72) AS current_playing_time_weight,
        ROUND(
            LEAST(
                165.0,
                GREATEST(
                    40.0,
                    100 * (
                        0.22 * pb.league_projected_era / NULLIF(j.projected_era, 0)
                        + 0.20 * j.projected_strikeouts_per_inning_base / NULLIF(pb.league_projected_strikeouts_per_inning, 0)
                        + 0.15 * pb.league_projected_walks_per_inning / NULLIF(j.projected_walks_per_inning_base, 0)
                        + 0.15 * pb.league_projected_hits_per_inning / NULLIF(j.projected_hits_per_inning_base, 0)
                        + 0.12 * pb.league_projected_home_runs_per_inning / NULLIF(j.projected_home_runs_per_inning_base, 0)
                        + 0.16 * j.projected_ip / NULLIF(pb.league_projected_ip, 0)
                    )
                )
            ),
            1
        ) AS prior_counting_stats_score,
        ROUND(
            LEAST(
                165.0,
                GREATEST(
                    40.0,
                    100 * (
                        0.20 * pb.league_projected_xera / NULLIF(j.projected_xera, 0)
                        + 0.14 * pb.league_projected_hard_hit_rate / NULLIF(j.projected_hard_hit_rate_base, 0)
                        + 0.14 * pb.league_projected_barrel_rate / NULLIF(j.projected_barrel_rate_base, 0)
                        + 0.10 * pb.league_projected_exit_velocity / NULLIF(j.projected_exit_velocity_base, 0)
                        + 0.14 * j.projected_stuff_plus_base / NULLIF(pb.league_projected_stuff_plus, 0)
                        + 0.12 * j.projected_location_plus_base / NULLIF(pb.league_projected_location_plus, 0)
                        + 0.16 * j.projected_pitching_plus_base / NULLIF(pb.league_projected_pitching_plus, 0)
                    )
                )
            ),
            1
        ) AS prior_statcast_stats_score,
        ROUND(
            LEAST(
                145.0,
                GREATEST(
                    40.0,
                    CASE j.projected_role_bucket
                        WHEN 'starter' THEN 100 * j.projected_ip / 165.0
                        WHEN 'closer' THEN 100 * j.projected_ip / 60.0
                        WHEN 'high_leverage_reliever' THEN 100 * j.projected_ip / 70.0
                        WHEN 'swingman' THEN 100 * j.projected_ip / 90.0
                        ELSE 100 * j.projected_ip / 68.0
                    END
                )
            ),
            1
        ) AS prior_playing_time_score,
        CASE
            WHEN j.current_ip > 0 THEN
                ROUND(
                    LEAST(
                        175.0,
                        GREATEST(
                            35.0,
                            100 * (
                                0.26 * pb.league_projected_era / NULLIF(j.current_era, 0)
                                + 0.22 * COALESCE(j.current_strikeouts_per_inning, pb.league_projected_strikeouts_per_inning) / NULLIF(pb.league_projected_strikeouts_per_inning, 0)
                                + 0.16 * pb.league_projected_walks_per_inning / NULLIF(COALESCE(j.current_walks_per_inning, pb.league_projected_walks_per_inning), 0)
                                + 0.16 * pb.league_projected_hits_per_inning / NULLIF(COALESCE(j.current_hits_per_inning, pb.league_projected_hits_per_inning), 0)
                                + 0.10 * pb.league_projected_home_runs_per_inning / NULLIF(COALESCE(j.current_home_runs_per_inning, pb.league_projected_home_runs_per_inning), 0)
                                + 0.10 * COALESCE(j.current_ip * j.pace_factor, j.projected_ip) / NULLIF(j.projected_ip, 0)
                            )
                        )
                    ),
                    1
                )
            ELSE NULL
        END AS current_counting_stats_score,
        CASE
            WHEN j.team_games_played > 0 THEN
                ROUND(
                    LEAST(
                        150.0,
                        GREATEST(
                            35.0,
                            CASE j.projected_role_bucket
                                WHEN 'starter' THEN 100 * (j.current_ip * j.pace_factor) / 165.0
                                WHEN 'closer' THEN 100 * (j.current_ip * j.pace_factor) / 60.0
                                WHEN 'high_leverage_reliever' THEN 100 * (j.current_ip * j.pace_factor) / 70.0
                                WHEN 'swingman' THEN 100 * (j.current_ip * j.pace_factor) / 90.0
                                ELSE 100 * (j.current_ip * j.pace_factor) / 68.0
                            END
                        )
                    ),
                    1
                )
            ELSE NULL
        END AS current_playing_time_score,
        CASE
            WHEN j.current_era IS NOT NULL THEN ROUND(j.current_era - j.projected_era, 2)
            ELSE NULL
        END AS current_vs_projection_era_diff
    FROM joined AS j
    CROSS JOIN projection_baselines AS pb
),
blended_scores AS (
    SELECT
        *,
        ROUND(
            (1 - current_sample_weight) * prior_counting_stats_score
            + current_sample_weight * COALESCE(current_counting_stats_score, prior_counting_stats_score),
            1
        ) AS blended_run_prevention_score,
        ROUND(prior_statcast_stats_score, 1) AS blended_pitch_quality_score,
        ROUND(
            (1 - current_playing_time_weight) * prior_playing_time_score
            + current_playing_time_weight * COALESCE(current_playing_time_score, prior_playing_time_score),
            1
        ) AS blended_playing_time_score,
        ROUND(
            LEAST(
                145.0,
                GREATEST(
                    38.0,
                    100
                    + 18 * COALESCE(workload_reliability, 0)
                    + 15 * COALESCE(run_prevention_reliability, 0)
                    + 12 * COALESCE(quality_reliability, 0)
                    - 28 * ABS(COALESCE(current_vs_projection_era_diff, 0))
                )
            ),
            1
        ) AS stability_score,
        CASE projected_role_bucket
            WHEN 'starter' THEN 110.0
            WHEN 'closer' THEN 108.0
            WHEN 'high_leverage_reliever' THEN 102.0
            WHEN 'swingman' THEN 96.0
            ELSE 92.0
        END AS role_scarcity_score
    FROM scored
),
role_outputs AS (
    SELECT
        *,
        ROUND(
            LEAST(
                155.0,
                GREATEST(
                    35.0,
                    0.34 * blended_run_prevention_score
                    + 0.24 * blended_pitch_quality_score
                    + 0.20 * blended_playing_time_score
                    + 0.12 * stability_score
                    + 0.10 * role_scarcity_score
                )
            ),
            1
        ) AS team_building_value_score,
        ROUND(
            LEAST(
                155.0,
                GREATEST(
                    35.0,
                    0.40 * blended_pitch_quality_score
                    + 0.22 * blended_run_prevention_score
                    + 0.20 * projected_stuff_plus_base
                    + 0.18 * blended_playing_time_score
                )
            ),
            1
        ) AS upside_score,
        ROUND(
            LEAST(
                155.0,
                GREATEST(
                    35.0,
                    0.38 * blended_run_prevention_score
                    + 0.22 * projected_location_plus_base
                    + 0.20 * blended_playing_time_score
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
                    CASE
                        WHEN projected_role_bucket = 'starter' THEN
                            0.46 * blended_playing_time_score + 0.28 * stability_score + 0.26 * blended_run_prevention_score
                        ELSE
                            0.22 * blended_playing_time_score + 0.24 * stability_score + 0.18 * blended_run_prevention_score
                    END
                )
            ),
            1
        ) AS starter_probability_score,
        ROUND(
            LEAST(
                150.0,
                GREATEST(
                    25.0,
                    CASE
                        WHEN projected_role_bucket IN ('closer', 'high_leverage_reliever') THEN
                            0.40 * blended_pitch_quality_score + 0.28 * blended_run_prevention_score + 0.18 * stability_score + 0.14 * blended_playing_time_score
                        ELSE
                            0.16 * blended_pitch_quality_score + 0.22 * blended_run_prevention_score + 0.26 * blended_playing_time_score + 0.16 * stability_score
                    END
                )
            ),
            1
        ) AS leverage_probability_score,
        CASE
            WHEN projected_role_bucket = 'starter' AND blended_playing_time_score >= 105 THEN 'Front-line starter'
            WHEN projected_role_bucket = 'starter' THEN 'Rotation starter'
            WHEN projected_role_bucket = 'closer' THEN 'Closer'
            WHEN projected_role_bucket = 'high_leverage_reliever' THEN 'Late-inning reliever'
            WHEN projected_role_bucket = 'swingman' THEN 'Swingman / bulk arm'
            ELSE 'Middle relief'
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
        projected_role_bucket,
        roster_role,
        projected_age,
        weighted_ip_sample,
        workload_reliability,
        run_prevention_reliability,
        quality_reliability,
        durability_age_factor,
        skill_age_factor,
        projected_war,
        projected_wins,
        projected_losses,
        projected_games_base,
        projected_starts_base,
        projected_saves_base,
        projected_ip_base,
        projected_era_base,
        projected_whip_base,
        projected_fip_base,
        projected_xfip_base,
        projected_xera_base,
        projected_k_rate_base,
        projected_bb_rate_base,
        projected_avg_allowed_base,
        projected_strikeouts_per_inning_base,
        projected_walks_per_inning_base,
        projected_hits_per_inning_base,
        projected_home_runs_per_inning_base,
        projected_hard_hit_rate_base,
        projected_barrel_rate_base,
        projected_exit_velocity_base,
        projected_launch_angle_base,
        projected_stuff_plus_base,
        projected_location_plus_base,
        projected_pitching_plus_base,
        projected_start_share,
        projected_save_share,
        projected_ip,
        projected_era,
        projected_whip,
        projected_xera,
        projected_fip,
        projected_xfip,
        projected_strikeouts,
        projected_walks,
        projected_hits_allowed,
        projected_home_runs_allowed,
        projected_earned_runs,
        projected_runs_allowed,
        projected_starts,
        projected_saves,
        team_games_played,
        current_games,
        current_starts,
        current_saves,
        ROUND(current_ip, 1) AS current_ip,
        current_hits_allowed,
        current_runs_allowed,
        current_earned_runs,
        current_walks,
        current_strikeouts,
        current_home_runs_allowed,
        current_batters_faced,
        ROUND(current_era, 2) AS current_era,
        ROUND(current_whip, 2) AS current_whip,
        ROUND(current_k_rate, 3) AS current_k_rate,
        ROUND(current_bb_rate, 3) AS current_bb_rate,
        ROUND(current_strikeouts_per_inning, 3) AS current_strikeouts_per_inning,
        ROUND(current_walks_per_inning, 3) AS current_walks_per_inning,
        ROUND(current_hits_per_inning, 3) AS current_hits_per_inning,
        ROUND(current_home_runs_per_inning, 3) AS current_home_runs_per_inning,
        ROUND(current_sample_weight, 3) AS current_sample_weight,
        ROUND(current_playing_time_weight, 3) AS current_playing_time_weight,
        ROUND(prior_counting_stats_score, 1) AS prior_counting_stats_score,
        ROUND(prior_statcast_stats_score, 1) AS prior_statcast_stats_score,
        ROUND(prior_playing_time_score, 1) AS prior_playing_time_score,
        ROUND(current_counting_stats_score, 1) AS current_counting_stats_score,
        ROUND(current_playing_time_score, 1) AS current_playing_time_score,
        ROUND(blended_run_prevention_score, 1) AS blended_run_prevention_score,
        ROUND(blended_pitch_quality_score, 1) AS blended_pitch_quality_score,
        ROUND(blended_playing_time_score, 1) AS blended_playing_time_score,
        ROUND(role_scarcity_score, 1) AS role_scarcity_score,
        ROUND(team_building_value_score, 1) AS team_building_value_score,
        ROUND(upside_score, 1) AS upside_score,
        ROUND(floor_score, 1) AS floor_score,
        ROUND(starter_probability_score, 1) AS starter_probability_score,
        ROUND(leverage_probability_score, 1) AS leverage_probability_score,
        ROUND(stability_score, 1) AS stability_score,
        ROUND(current_ip * pace_factor, 1) AS pace_ip_162,
        ROUND(current_strikeouts * pace_factor, 1) AS pace_strikeouts_162,
        ROUND(current_walks * pace_factor, 1) AS pace_walks_162,
        ROUND(current_runs_allowed * pace_factor, 1) AS pace_runs_allowed_162,
        ROUND((current_ip * pace_factor) - projected_ip, 1) AS pace_ip_diff,
        ROUND((current_runs_allowed * pace_factor) - projected_runs_allowed, 1) AS pace_runs_allowed_diff,
        ROUND(current_vs_projection_era_diff, 2) AS current_era_diff
    FROM role_outputs
)
SELECT *
FROM final
ORDER BY COALESCE(team_building_value_score, 0) DESC, COALESCE(projected_war, 0) DESC, COALESCE(projected_ip, 0) DESC, player_name
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
