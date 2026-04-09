CREATE OR REPLACE TABLE hitter_projection_engine_2026 AS
WITH training AS (
    SELECT
        "IDfg" AS player_id,
        "Name" AS player_name,
        "Team" AS team,
        "Season" AS season,
        "Age" AS age,
        "G" AS games,
        "PA" AS pa,
        "AB" AS ab,
        "H" AS hits,
        "2B" AS doubles,
        "3B" AS triples,
        "HR" AS home_runs,
        "BB" AS walks,
        "SO" AS strikeouts,
        "HBP" AS hit_by_pitch,
        "SF" AS sac_flies,
        "SH" AS sac_hits,
        "SB" AS stolen_bases,
        "AVG" AS avg,
        "OBP" AS obp,
        "SLG" AS slg,
        "OPS" AS ops,
        "ISO" AS iso,
        "BABIP" AS babip,
        "wOBA" AS woba,
        "xwOBA" AS xwoba,
        "WAR" AS war,
        "wRC+" AS wrc_plus,
        "Barrel%" AS barrel_rate,
        "HardHit%" AS hard_hit_rate,
        "BB%" AS bb_rate,
        "K%" AS k_rate,
        "BsR" AS baserunning_runs,
        "Def" AS defense_runs,
        "Pos" AS position_runs,
        CASE
            WHEN "PA" > 0 THEN "PA"::DOUBLE / NULLIF("G", 0) ELSE NULL
        END AS pa_per_game,
        CASE
            WHEN "PA" > 0 THEN "2B"::DOUBLE / "PA" ELSE NULL
        END AS double_rate,
        CASE
            WHEN "PA" > 0 THEN "3B"::DOUBLE / "PA" ELSE NULL
        END AS triple_rate,
        CASE
            WHEN "PA" > 0 THEN "HR"::DOUBLE / "PA" ELSE NULL
        END AS hr_rate,
        CASE
            WHEN "PA" > 0 THEN "HBP"::DOUBLE / "PA" ELSE NULL
        END AS hbp_rate,
        CASE
            WHEN "PA" > 0 THEN "SF"::DOUBLE / "PA" ELSE NULL
        END AS sf_rate,
        CASE
            WHEN "PA" > 0 THEN "SH"::DOUBLE / "PA" ELSE NULL
        END AS sh_rate,
        CASE
            WHEN "PA" > 0 THEN "SB"::DOUBLE / "PA" ELSE NULL
        END AS sb_rate,
        CASE
            WHEN "PA" > 0 THEN "BsR"::DOUBLE / "PA" ELSE NULL
        END AS bsr_per_pa,
        CASE
            WHEN "PA" > 0 THEN "Def"::DOUBLE / "PA" ELSE NULL
        END AS def_per_pa,
        CASE
            WHEN "PA" > 0 THEN "Pos"::DOUBLE / "PA" ELSE NULL
        END AS pos_per_pa,
        CASE
            WHEN "Season" = 2025 THEN 0.65
            WHEN "Season" = 2024 THEN 0.35
            ELSE 0.0
        END AS season_weight
    FROM batting_stats
    WHERE "Season" IN (2024, 2025)
      AND "PA" >= 50
),
player_history AS (
    SELECT
        player_id,
        MAX_BY(player_name, season) AS player_name,
        MAX_BY(team, season) AS recent_team,
        MAX_BY(age, season) + 1 AS target_age_2026,
        SUM(pa * season_weight) / NULLIF(SUM(season_weight), 0) AS recent_pa,
        SUM(games * season_weight) / NULLIF(SUM(season_weight), 0) AS recent_games,
        SUM(pa_per_game * season_weight) / NULLIF(SUM(season_weight), 0) AS recent_pa_per_game,
        SUM(bb_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_bb_rate,
        SUM(k_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_k_rate,
        SUM(hbp_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_hbp_rate,
        SUM(sf_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_sf_rate,
        SUM(sh_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_sh_rate,
        SUM(double_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_double_rate,
        SUM(triple_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_triple_rate,
        SUM(hr_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_hr_rate,
        SUM(sb_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_sb_rate,
        SUM(bsr_per_pa * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_bsr_per_pa,
        SUM(def_per_pa * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_def_per_pa,
        SUM(pos_per_pa * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_pos_per_pa,
        SUM(babip * ab * season_weight) / NULLIF(SUM(ab * season_weight), 0) AS recent_babip,
        SUM(woba * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_woba,
        SUM(xwoba * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_xwoba,
        SUM(barrel_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_barrel_rate,
        SUM(hard_hit_rate * pa * season_weight) / NULLIF(SUM(pa * season_weight), 0) AS recent_hard_hit_rate,
        SUM(pa * season_weight) AS weighted_pa_sample
    FROM training
    GROUP BY player_id
),
age_bucket_training AS (
    SELECT
        CASE
            WHEN age <= 24 THEN '24_and_under'
            WHEN age BETWEEN 25 AND 27 THEN '25_27'
            WHEN age BETWEEN 28 AND 30 THEN '28_30'
            WHEN age BETWEEN 31 AND 33 THEN '31_33'
            ELSE '34_plus'
        END AS age_bucket,
        AVG(pa) AS bucket_pa,
        AVG(games) AS bucket_games,
        AVG(pa_per_game) AS bucket_pa_per_game,
        AVG(bb_rate) AS bucket_bb_rate,
        AVG(k_rate) AS bucket_k_rate,
        AVG(hbp_rate) AS bucket_hbp_rate,
        AVG(sf_rate) AS bucket_sf_rate,
        AVG(sh_rate) AS bucket_sh_rate,
        AVG(double_rate) AS bucket_double_rate,
        AVG(triple_rate) AS bucket_triple_rate,
        AVG(hr_rate) AS bucket_hr_rate,
        AVG(sb_rate) AS bucket_sb_rate,
        AVG(bsr_per_pa) AS bucket_bsr_per_pa,
        AVG(def_per_pa) AS bucket_def_per_pa,
        AVG(pos_per_pa) AS bucket_pos_per_pa,
        AVG(babip) AS bucket_babip,
        AVG(woba) AS bucket_woba,
        AVG(xwoba) AS bucket_xwoba,
        AVG(barrel_rate) AS bucket_barrel_rate,
        AVG(hard_hit_rate) AS bucket_hard_hit_rate
    FROM training
    GROUP BY 1
),
archetype_training AS (
    SELECT
        CASE
            WHEN bb_rate >= 0.105 AND (iso >= 0.210 OR barrel_rate >= 0.120) THEN 'discipline_power'
            WHEN iso >= 0.210 OR barrel_rate >= 0.120 OR hard_hit_rate >= 0.470 THEN 'power'
            WHEN sb_rate >= 0.020 AND def_per_pa >= 0.003 THEN 'speed_defense'
            WHEN k_rate <= 0.180 AND bb_rate <= 0.095 AND iso < 0.185 THEN 'contact'
            ELSE 'balanced'
        END AS archetype,
        AVG(pa) AS archetype_pa,
        AVG(games) AS archetype_games,
        AVG(pa_per_game) AS archetype_pa_per_game,
        AVG(bb_rate) AS archetype_bb_rate,
        AVG(k_rate) AS archetype_k_rate,
        AVG(hbp_rate) AS archetype_hbp_rate,
        AVG(sf_rate) AS archetype_sf_rate,
        AVG(sh_rate) AS archetype_sh_rate,
        AVG(double_rate) AS archetype_double_rate,
        AVG(triple_rate) AS archetype_triple_rate,
        AVG(hr_rate) AS archetype_hr_rate,
        AVG(sb_rate) AS archetype_sb_rate,
        AVG(bsr_per_pa) AS archetype_bsr_per_pa,
        AVG(def_per_pa) AS archetype_def_per_pa,
        AVG(pos_per_pa) AS archetype_pos_per_pa,
        AVG(babip) AS archetype_babip,
        AVG(woba) AS archetype_woba,
        AVG(xwoba) AS archetype_xwoba,
        AVG(barrel_rate) AS archetype_barrel_rate,
        AVG(hard_hit_rate) AS archetype_hard_hit_rate
    FROM training
    GROUP BY 1
),
position_bucket_training AS (
    SELECT
        CASE
            WHEN pos_per_pa * 600 >= 6 THEN 'premium_up_the_middle'
            WHEN pos_per_pa * 600 >= 1 THEN 'up_the_middle'
            WHEN pos_per_pa * 600 >= -8 THEN 'corner'
            ELSE 'bat_first'
        END AS position_bucket,
        AVG(pa) AS position_pa,
        AVG(games) AS position_games,
        AVG(pa_per_game) AS position_pa_per_game,
        AVG(bb_rate) AS position_bb_rate,
        AVG(k_rate) AS position_k_rate,
        AVG(hbp_rate) AS position_hbp_rate,
        AVG(sf_rate) AS position_sf_rate,
        AVG(sh_rate) AS position_sh_rate,
        AVG(double_rate) AS position_double_rate,
        AVG(triple_rate) AS position_triple_rate,
        AVG(hr_rate) AS position_hr_rate,
        AVG(sb_rate) AS position_sb_rate,
        AVG(bsr_per_pa) AS position_bsr_per_pa,
        AVG(def_per_pa) AS position_def_per_pa,
        AVG(pos_per_pa) AS position_pos_per_pa,
        AVG(babip) AS position_babip,
        AVG(woba) AS position_woba,
        AVG(xwoba) AS position_xwoba,
        AVG(barrel_rate) AS position_barrel_rate,
        AVG(hard_hit_rate) AS position_hard_hit_rate
    FROM training
    GROUP BY 1
),
catcher_training AS (
    SELECT
        AVG(pa) AS catcher_pa,
        AVG(games) AS catcher_games,
        AVG(pa_per_game) AS catcher_pa_per_game,
        AVG(bb_rate) AS catcher_bb_rate,
        AVG(k_rate) AS catcher_k_rate,
        AVG(hbp_rate) AS catcher_hbp_rate,
        AVG(sf_rate) AS catcher_sf_rate,
        AVG(sh_rate) AS catcher_sh_rate,
        AVG(double_rate) AS catcher_double_rate,
        AVG(triple_rate) AS catcher_triple_rate,
        AVG(hr_rate) AS catcher_hr_rate,
        AVG(sb_rate) AS catcher_sb_rate,
        AVG(bsr_per_pa) AS catcher_bsr_per_pa,
        AVG(def_per_pa) AS catcher_def_per_pa,
        AVG(pos_per_pa) AS catcher_pos_per_pa,
        AVG(babip) AS catcher_babip,
        AVG(woba) AS catcher_woba,
        AVG(xwoba) AS catcher_xwoba,
        AVG(barrel_rate) AS catcher_barrel_rate,
        AVG(hard_hit_rate) AS catcher_hard_hit_rate
    FROM training
    WHERE pos_per_pa * 600 >= 7
),
player_priors AS (
    SELECT
        ph.*,
        CASE
            WHEN target_age_2026 <= 24 THEN '24_and_under'
            WHEN target_age_2026 BETWEEN 25 AND 27 THEN '25_27'
            WHEN target_age_2026 BETWEEN 28 AND 30 THEN '28_30'
            WHEN target_age_2026 BETWEEN 31 AND 33 THEN '31_33'
            ELSE '34_plus'
        END AS age_bucket,
        CASE
            WHEN ph.recent_bb_rate >= 0.105 AND (COALESCE(ph.recent_hr_rate, 0) >= 0.045 OR COALESCE(ph.recent_barrel_rate, 0) >= 0.120) THEN 'discipline_power'
            WHEN COALESCE(ph.recent_hr_rate, 0) >= 0.045 OR COALESCE(ph.recent_barrel_rate, 0) >= 0.120 OR COALESCE(ph.recent_hard_hit_rate, 0) >= 0.470 THEN 'power'
            WHEN COALESCE(ph.recent_sb_rate, 0) >= 0.020 AND COALESCE(ph.recent_def_per_pa, 0) >= 0.003 THEN 'speed_defense'
            WHEN ph.recent_k_rate <= 0.180 AND ph.recent_bb_rate <= 0.095 AND COALESCE(ph.recent_hr_rate, 0) < 0.035 THEN 'contact'
            ELSE 'balanced'
        END AS archetype,
        CASE
            WHEN COALESCE(ph.recent_pos_per_pa, 0) * 600 >= 6 THEN 'premium_up_the_middle'
            WHEN COALESCE(ph.recent_pos_per_pa, 0) * 600 >= 1 THEN 'up_the_middle'
            WHEN COALESCE(ph.recent_pos_per_pa, 0) * 600 >= -8 THEN 'corner'
            ELSE 'bat_first'
        END AS position_bucket,
        CASE
            WHEN COALESCE(ph.recent_pos_per_pa, 0) * 600 >= 7 THEN 1
            ELSE 0
        END AS is_catcher_profile
    FROM player_history AS ph
),
blended AS (
    SELECT
        pp.player_id,
        pp.player_name,
        pp.recent_team AS team_2025,
        pp.target_age_2026,
        pp.is_catcher_profile,
        pp.weighted_pa_sample,
        LEAST(pp.weighted_pa_sample / 900.0, 0.9) AS playing_time_reliability,
        LEAST(pp.weighted_pa_sample / 700.0, 0.9) AS discipline_reliability,
        LEAST(pp.weighted_pa_sample / 1000.0, 0.85) AS contact_reliability,
        LEAST(pp.weighted_pa_sample / 850.0, 0.85) AS power_reliability,
        LEAST(pp.weighted_pa_sample / 500.0, 0.8) AS speed_reliability,
        LEAST(pp.weighted_pa_sample / 1200.0, 0.75) AS defense_reliability,
        pp.recent_pa,
        pp.recent_games,
        pp.recent_pa_per_game,
        pp.recent_bb_rate,
        pp.recent_k_rate,
        pp.recent_hbp_rate,
        pp.recent_sf_rate,
        pp.recent_sh_rate,
        pp.recent_double_rate,
        pp.recent_triple_rate,
        pp.recent_hr_rate,
        pp.recent_sb_rate,
        pp.recent_bsr_per_pa,
        pp.recent_def_per_pa,
        pp.recent_pos_per_pa,
        pp.recent_babip,
        pp.recent_woba,
        pp.recent_xwoba,
        pp.recent_barrel_rate,
        pp.recent_hard_hit_rate,
        abt.bucket_pa,
        abt.bucket_games,
        abt.bucket_pa_per_game,
        abt.bucket_bb_rate,
        abt.bucket_k_rate,
        abt.bucket_hbp_rate,
        abt.bucket_sf_rate,
        abt.bucket_sh_rate,
        abt.bucket_double_rate,
        abt.bucket_triple_rate,
        abt.bucket_hr_rate,
        abt.bucket_sb_rate,
        abt.bucket_bsr_per_pa,
        abt.bucket_def_per_pa,
        abt.bucket_pos_per_pa,
        abt.bucket_babip,
        abt.bucket_woba,
        abt.bucket_xwoba,
        abt.bucket_barrel_rate,
        abt.bucket_hard_hit_rate,
        art.archetype_pa,
        art.archetype_games,
        art.archetype_pa_per_game,
        art.archetype_bb_rate,
        art.archetype_k_rate,
        art.archetype_hbp_rate,
        art.archetype_sf_rate,
        art.archetype_sh_rate,
        art.archetype_double_rate,
        art.archetype_triple_rate,
        art.archetype_hr_rate,
        art.archetype_sb_rate,
        art.archetype_bsr_per_pa,
        art.archetype_def_per_pa,
        art.archetype_pos_per_pa,
        art.archetype_babip,
        art.archetype_woba,
        art.archetype_xwoba,
        art.archetype_barrel_rate,
        art.archetype_hard_hit_rate,
        pbt.position_pa,
        pbt.position_games,
        pbt.position_pa_per_game,
        pbt.position_bb_rate,
        pbt.position_k_rate,
        pbt.position_hbp_rate,
        pbt.position_sf_rate,
        pbt.position_sh_rate,
        pbt.position_double_rate,
        pbt.position_triple_rate,
        pbt.position_hr_rate,
        pbt.position_sb_rate,
        pbt.position_bsr_per_pa,
        pbt.position_def_per_pa,
        pbt.position_pos_per_pa,
        pbt.position_babip,
        pbt.position_woba,
        pbt.position_xwoba,
        pbt.position_barrel_rate,
        pbt.position_hard_hit_rate,
        ct.catcher_pa,
        ct.catcher_games,
        ct.catcher_pa_per_game,
        ct.catcher_bb_rate,
        ct.catcher_k_rate,
        ct.catcher_hbp_rate,
        ct.catcher_sf_rate,
        ct.catcher_sh_rate,
        ct.catcher_double_rate,
        ct.catcher_triple_rate,
        ct.catcher_hr_rate,
        ct.catcher_sb_rate,
        ct.catcher_bsr_per_pa,
        ct.catcher_def_per_pa,
        ct.catcher_pos_per_pa,
        ct.catcher_babip,
        ct.catcher_woba,
        ct.catcher_xwoba,
        ct.catcher_barrel_rate,
        ct.catcher_hard_hit_rate
    FROM player_priors AS pp
    LEFT JOIN age_bucket_training AS abt
        ON pp.age_bucket = abt.age_bucket
    LEFT JOIN archetype_training AS art
        ON pp.archetype = art.archetype
    LEFT JOIN position_bucket_training AS pbt
        ON pp.position_bucket = pbt.position_bucket
    CROSS JOIN catcher_training AS ct
),
projected_skills AS (
    SELECT
        *,
        GREATEST(
            0.78,
            1.0
            - 0.012 * GREATEST(target_age_2026 - 31, 0)
            - 0.006 * GREATEST(23 - target_age_2026, 0)
        ) AS durability_age_factor,
        GREATEST(
            0.85,
            1.0
            - 0.010 * GREATEST(target_age_2026 - 30, 0)
            - 0.004 * GREATEST(26 - target_age_2026, 0)
        ) AS power_age_factor,
        GREATEST(
            0.88,
            1.0
            - 0.006 * GREATEST(target_age_2026 - 31, 0)
            - 0.003 * GREATEST(24 - target_age_2026, 0)
        ) AS contact_age_factor,
        GREATEST(
            0.70,
            1.0
            - 0.025 * GREATEST(target_age_2026 - 26, 0)
            - 0.008 * GREATEST(23 - target_age_2026, 0)
        ) AS speed_age_factor,
        GREATEST(
            0.72,
            1.0
            - 0.018 * GREATEST(target_age_2026 - 28, 0)
            - 0.006 * GREATEST(24 - target_age_2026, 0)
        ) AS defense_age_factor,
        (
            playing_time_reliability * recent_games
            + (1 - playing_time_reliability) * (
                CASE
                    WHEN is_catcher_profile = 1 THEN 0.20 * bucket_games + 0.20 * archetype_games + 0.20 * position_games + 0.40 * catcher_games
                    ELSE 0.40 * bucket_games + 0.30 * archetype_games + 0.30 * position_games
                END
            )
        ) AS projected_games_base,
        (
            playing_time_reliability * recent_pa_per_game
            + (1 - playing_time_reliability) * (
                CASE
                    WHEN is_catcher_profile = 1 THEN 0.20 * bucket_pa_per_game + 0.20 * archetype_pa_per_game + 0.20 * position_pa_per_game + 0.40 * catcher_pa_per_game
                    ELSE 0.40 * bucket_pa_per_game + 0.30 * archetype_pa_per_game + 0.30 * position_pa_per_game
                END
            )
        ) AS projected_pa_per_game_base,
        (
            discipline_reliability * recent_bb_rate
            + (1 - discipline_reliability) * (0.25 * bucket_bb_rate + 0.50 * archetype_bb_rate + 0.25 * position_bb_rate)
        ) AS projected_bb_rate_base,
        (
            discipline_reliability * recent_k_rate
            + (1 - discipline_reliability) * (0.25 * bucket_k_rate + 0.50 * archetype_k_rate + 0.25 * position_k_rate)
        ) AS projected_k_rate_base,
        (
            power_reliability * recent_hr_rate
            + (1 - power_reliability) * (
                CASE
                    WHEN is_catcher_profile = 1 THEN 0.10 * bucket_hr_rate + 0.35 * archetype_hr_rate + 0.15 * position_hr_rate + 0.40 * catcher_hr_rate
                    ELSE 0.20 * bucket_hr_rate + 0.55 * archetype_hr_rate + 0.25 * position_hr_rate
                END
            )
        ) AS projected_hr_rate_base,
        (
            power_reliability * recent_double_rate
            + (1 - power_reliability) * (0.30 * bucket_double_rate + 0.45 * archetype_double_rate + 0.25 * position_double_rate)
        ) AS projected_double_rate_base,
        (
            contact_reliability * recent_triple_rate
            + (1 - contact_reliability) * (0.30 * bucket_triple_rate + 0.40 * archetype_triple_rate + 0.30 * position_triple_rate)
        ) AS projected_triple_rate_base,
        (
            speed_reliability * recent_sb_rate
            + (1 - speed_reliability) * (0.20 * bucket_sb_rate + 0.50 * archetype_sb_rate + 0.30 * position_sb_rate)
        ) AS projected_sb_rate_base,
        (
            contact_reliability * recent_babip
            + (1 - contact_reliability) * (0.30 * bucket_babip + 0.40 * archetype_babip + 0.30 * position_babip)
        ) AS projected_babip_base,
        (
            defense_reliability * recent_bsr_per_pa
            + (1 - defense_reliability) * (0.20 * bucket_bsr_per_pa + 0.45 * archetype_bsr_per_pa + 0.35 * position_bsr_per_pa)
        ) AS projected_bsr_per_pa_base,
        (
            defense_reliability * recent_def_per_pa
            + (1 - defense_reliability) * (
                CASE
                    WHEN is_catcher_profile = 1 THEN 0.05 * bucket_def_per_pa + 0.10 * archetype_def_per_pa + 0.25 * position_def_per_pa + 0.60 * catcher_def_per_pa
                    ELSE 0.15 * bucket_def_per_pa + 0.25 * archetype_def_per_pa + 0.60 * position_def_per_pa
                END
            )
        ) AS projected_def_per_pa_base,
        (
            defense_reliability * recent_pos_per_pa
            + (1 - defense_reliability) * (
                CASE
                    WHEN is_catcher_profile = 1 THEN 0.05 * bucket_pos_per_pa + 0.10 * archetype_pos_per_pa + 0.20 * position_pos_per_pa + 0.65 * catcher_pos_per_pa
                    ELSE 0.10 * bucket_pos_per_pa + 0.20 * archetype_pos_per_pa + 0.70 * position_pos_per_pa
                END
            )
        ) AS projected_pos_per_pa_base,
        (
            power_reliability * recent_barrel_rate
            + (1 - power_reliability) * (0.20 * bucket_barrel_rate + 0.60 * archetype_barrel_rate + 0.20 * position_barrel_rate)
        ) AS projected_barrel_rate_base,
        (
            power_reliability * recent_hard_hit_rate
            + (1 - power_reliability) * (0.20 * bucket_hard_hit_rate + 0.60 * archetype_hard_hit_rate + 0.20 * position_hard_hit_rate)
        ) AS projected_hard_hit_rate_base,
        (
            contact_reliability * recent_xwoba
            + (1 - contact_reliability) * (
                CASE
                    WHEN is_catcher_profile = 1 THEN 0.15 * bucket_xwoba + 0.30 * archetype_xwoba + 0.15 * position_xwoba + 0.40 * catcher_xwoba
                    ELSE 0.20 * bucket_xwoba + 0.50 * archetype_xwoba + 0.30 * position_xwoba
                END
            )
        ) AS projected_xwoba_base,
        (
            contact_reliability * recent_hbp_rate
            + (1 - contact_reliability) * (0.30 * bucket_hbp_rate + 0.40 * archetype_hbp_rate + 0.30 * position_hbp_rate)
        ) AS projected_hbp_rate_base,
        (
            contact_reliability * recent_sf_rate
            + (1 - contact_reliability) * (0.30 * bucket_sf_rate + 0.40 * archetype_sf_rate + 0.30 * position_sf_rate)
        ) AS projected_sf_rate_base,
        (
            contact_reliability * recent_sh_rate
            + (1 - contact_reliability) * (0.30 * bucket_sh_rate + 0.40 * archetype_sh_rate + 0.30 * position_sh_rate)
        ) AS projected_sh_rate_base
    FROM blended
),
projected_components AS (
    SELECT
        player_id,
        player_name,
        team_2025,
        target_age_2026 AS projected_age,
        weighted_pa_sample,
        LEAST(
            1.20,
            1.0
            + GREATEST(projected_barrel_rate_base - 0.124, 0) * 1.20
            + GREATEST(projected_hard_hit_rate_base - 0.481, 0) * 0.35
            + GREATEST(projected_xwoba_base - 0.357, 0) * 1.40
        ) AS elite_power_uplift,
        LEAST(162.0, GREATEST(45.0, projected_games_base * durability_age_factor)) AS projected_games,
        LEAST(750.0, GREATEST(180.0, projected_games_base * durability_age_factor * projected_pa_per_game_base)) AS projected_pa,
        GREATEST(0.04, LEAST(0.20, projected_bb_rate_base * contact_age_factor)) AS projected_bb_rate,
        GREATEST(0.10, LEAST(0.36, projected_k_rate_base / contact_age_factor)) AS projected_k_rate,
        GREATEST(0.003, LEAST(0.03, projected_hbp_rate_base)) AS projected_hbp_rate,
        GREATEST(0.002, LEAST(0.025, projected_sf_rate_base)) AS projected_sf_rate,
        GREATEST(0.0, LEAST(0.01, projected_sh_rate_base)) AS projected_sh_rate,
        GREATEST(0.02, LEAST(0.09, projected_double_rate_base * power_age_factor)) AS projected_double_rate,
        GREATEST(0.001, LEAST(0.012, projected_triple_rate_base * speed_age_factor)) AS projected_triple_rate,
        GREATEST(0.01, LEAST(0.11, projected_hr_rate_base * power_age_factor * LEAST(
            1.20,
            1.0
            + GREATEST(projected_barrel_rate_base - 0.124, 0) * 1.20
            + GREATEST(projected_hard_hit_rate_base - 0.481, 0) * 0.35
            + GREATEST(projected_xwoba_base - 0.357, 0) * 1.40
        ))) AS projected_hr_rate,
        GREATEST(0.0, LEAST(0.05, projected_sb_rate_base * speed_age_factor)) AS projected_sb_rate,
        GREATEST(0.240, LEAST(0.360, projected_babip_base * (0.6 * contact_age_factor + 0.4 * speed_age_factor))) AS projected_babip,
        projected_bsr_per_pa_base * speed_age_factor AS projected_bsr_per_pa,
        projected_def_per_pa_base * defense_age_factor AS projected_def_per_pa,
        projected_pos_per_pa_base * defense_age_factor AS projected_pos_per_pa,
        projected_barrel_rate_base * power_age_factor AS projected_barrel_rate,
        projected_hard_hit_rate_base * power_age_factor AS projected_hard_hit_rate,
        GREATEST(0.260, LEAST(0.470, projected_xwoba_base * (0.5 * power_age_factor + 0.5 * contact_age_factor) * (1 + (LEAST(
            1.20,
            1.0
            + GREATEST(projected_barrel_rate_base - 0.124, 0) * 1.20
            + GREATEST(projected_hard_hit_rate_base - 0.481, 0) * 0.35
            + GREATEST(projected_xwoba_base - 0.357, 0) * 1.40
        ) - 1) * 0.35))) AS projected_xwoba
    FROM projected_skills
),
derived_counts AS (
    SELECT
        *,
        projected_pa * projected_bb_rate AS projected_walks,
        projected_pa * projected_k_rate AS projected_strikeouts,
        projected_pa * projected_hbp_rate AS projected_hbp,
        projected_pa * projected_sf_rate AS projected_sf,
        projected_pa * projected_sh_rate AS projected_sh,
        projected_pa * projected_hr_rate AS projected_home_runs,
        projected_pa * projected_double_rate AS projected_doubles,
        projected_pa * projected_triple_rate AS projected_triples,
        projected_pa * projected_sb_rate AS projected_stolen_bases,
        projected_pa
            - (projected_pa * projected_bb_rate)
            - (projected_pa * projected_hbp_rate)
            - (projected_pa * projected_sf_rate)
            - (projected_pa * projected_sh_rate) AS projected_at_bats
    FROM projected_components
),
derived_rates AS (
    SELECT
        *,
        projected_home_runs
            + projected_babip * GREATEST(projected_at_bats - projected_strikeouts - projected_home_runs + projected_sf, 0) AS projected_hits,
        projected_bsr_per_pa * projected_pa AS projected_baserunning_runs,
        projected_def_per_pa * projected_pa AS projected_defense_runs,
        projected_pos_per_pa * projected_pa AS projected_position_runs
    FROM derived_counts
),
final_projection AS (
    SELECT
        *,
        projected_hits - projected_doubles - projected_triples - projected_home_runs AS projected_singles,
        CASE
            WHEN projected_at_bats > 0 THEN projected_hits / projected_at_bats
            ELSE NULL
        END AS projected_avg,
        CASE
            WHEN projected_pa > 0 THEN (projected_hits + projected_walks + projected_hbp) / projected_pa
            ELSE NULL
        END AS projected_obp,
        CASE
            WHEN projected_at_bats > 0 THEN
                (
                    projected_hits
                    + projected_doubles
                    + 2 * projected_triples
                    + 3 * projected_home_runs
                ) / projected_at_bats
            ELSE NULL
        END AS projected_slg,
        CASE
            WHEN projected_pa > 0 THEN
                (
                    0.69 * projected_walks
                    + 0.72 * projected_hbp
                    + 0.88 * (projected_hits - projected_doubles - projected_triples - projected_home_runs)
                    + 1.247 * projected_doubles
                    + 1.578 * projected_triples
                    + 2.031 * projected_home_runs
                ) / projected_pa
            ELSE NULL
        END AS projected_woba
    FROM derived_rates
),
league_context AS (
    SELECT
        AVG(projected_woba) AS league_projected_woba,
        AVG(projected_xwoba) AS league_projected_xwoba
    FROM final_projection
),
scored AS (
    SELECT
        fp.player_id,
        fp.player_name,
        fp.team_2025,
        fp.projected_age,
        fp.weighted_pa_sample,
        fp.projected_games,
        fp.projected_pa,
        fp.projected_walks,
        fp.projected_strikeouts,
        fp.projected_hits,
        fp.projected_singles,
        fp.projected_doubles,
        fp.projected_triples,
        fp.projected_home_runs,
        fp.projected_stolen_bases,
        fp.projected_avg,
        fp.projected_obp,
        fp.projected_slg,
        fp.projected_obp + fp.projected_slg AS projected_ops,
        fp.projected_woba,
        fp.projected_xwoba,
        100 * fp.projected_woba / NULLIF(lc.league_projected_woba, 0) AS projected_woba_plus,
        100 * fp.projected_xwoba / NULLIF(lc.league_projected_xwoba, 0) AS projected_xwoba_plus,
        fp.projected_barrel_rate,
        fp.projected_hard_hit_rate,
        fp.projected_bb_rate,
        fp.projected_k_rate,
        fp.projected_baserunning_runs,
        fp.projected_defense_runs,
        fp.projected_position_runs,
        (18.35 / 600.0) * fp.projected_pa AS projected_replacement_runs,
        (
            0.65 * fp.projected_woba + 0.35 * fp.projected_xwoba
        ) AS projected_talent_woba,
        (
            (
                (
                    (0.65 * fp.projected_woba + 0.35 * fp.projected_xwoba)
                    - lc.league_projected_woba
                ) * fp.projected_pa / 1.15
            )
            + fp.projected_baserunning_runs
            + fp.projected_defense_runs
            + fp.projected_position_runs
            + (18.35 / 600.0) * fp.projected_pa
        ) AS projected_rar_proxy,
        (
            (
                (
                    (0.65 * fp.projected_woba + 0.35 * fp.projected_xwoba)
                    - lc.league_projected_woba
                ) * fp.projected_pa / 1.15
            )
            + fp.projected_baserunning_runs
            + fp.projected_defense_runs
            + fp.projected_position_runs
            + (18.35 / 600.0) * fp.projected_pa
        ) / 10.0 AS projected_value_war_proxy,
        NULL::VARCHAR AS current_team_2026,
        NULL::DOUBLE AS current_games_2026,
        NULL::DOUBLE AS current_pa_2026,
        NULL::DOUBLE AS current_woba_2026,
        NULL::DOUBLE AS current_home_runs_2026,
        NULL::DOUBLE AS current_stolen_bases_2026
    FROM final_projection AS fp
    CROSS JOIN league_context AS lc
)
SELECT
    *
FROM scored;
