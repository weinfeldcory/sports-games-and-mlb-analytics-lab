CREATE OR REPLACE TABLE hitter_model_2025 AS
WITH base AS (
    SELECT
        b."IDfg" AS player_id,
        b."Name" AS player_name,
        b."Team" AS team,
        b."Season" AS season,
        b."Age" AS age,
        b."PA" AS plate_appearances,
        b."WAR" AS war,
        b."wRC+" AS wrc_plus,
        b."OPS" AS ops,
        b."OBP" AS obp,
        b."SLG" AS slg,
        b."ISO" AS iso,
        b."wOBA" AS woba,
        b."xwOBA" AS xwoba,
        b."BB%" AS bb_rate,
        b."K%" AS k_rate,
        b."BB/K" AS bb_to_k,
        b."Contact%" AS contact_rate,
        b."Z-Contact%" AS z_contact_rate,
        b."O-Swing%" AS o_swing_rate,
        b."SwStr%" AS swinging_strike_rate,
        b."Barrel%" AS barrel_rate,
        b."HardHit%" AS hard_hit_rate,
        b."EV" AS exit_velocity,
        b."xBA" AS xba,
        b."xSLG" AS xslg,
        b."BsR" AS baserunning_runs,
        b."Spd" AS speed_score_raw,
        b."SB" AS stolen_bases,
        b."Def" AS defense_runs,
        hf.rolling_3yr_ops,
        hf.rolling_3yr_woba,
        hf.rolling_3yr_war,
        hf.rolling_3yr_pa
    FROM batting_stats AS b
    LEFT JOIN hitter_features AS hf
        ON b."IDfg" = hf.player_id
       AND b."Season" = hf.season
    WHERE b."Season" = 2025
      AND b."PA" >= 300
),
percentiles AS (
    SELECT
        *,
        percent_rank() OVER (ORDER BY wrc_plus) AS wrc_plus_pct,
        percent_rank() OVER (ORDER BY obp) AS obp_pct,
        percent_rank() OVER (ORDER BY woba) AS woba_pct,
        percent_rank() OVER (ORDER BY xwoba) AS xwoba_pct,
        percent_rank() OVER (ORDER BY iso) AS iso_pct,
        percent_rank() OVER (ORDER BY xslg) AS xslg_pct,
        percent_rank() OVER (ORDER BY barrel_rate) AS barrel_pct,
        percent_rank() OVER (ORDER BY hard_hit_rate) AS hard_hit_pct,
        percent_rank() OVER (ORDER BY exit_velocity) AS ev_pct,
        percent_rank() OVER (ORDER BY bb_rate) AS bb_rate_pct,
        percent_rank() OVER (ORDER BY o_swing_rate DESC) AS o_swing_pct,
        percent_rank() OVER (ORDER BY contact_rate) AS contact_pct,
        percent_rank() OVER (ORDER BY z_contact_rate) AS z_contact_pct,
        percent_rank() OVER (ORDER BY k_rate DESC) AS k_rate_pct,
        percent_rank() OVER (ORDER BY swinging_strike_rate DESC) AS swstr_pct,
        percent_rank() OVER (ORDER BY baserunning_runs) AS baserunning_pct,
        percent_rank() OVER (ORDER BY speed_score_raw) AS speed_pct,
        percent_rank() OVER (ORDER BY stolen_bases) AS stolen_bases_pct,
        percent_rank() OVER (ORDER BY defense_runs) AS defense_pct,
        percent_rank() OVER (ORDER BY rolling_3yr_woba) AS rolling_woba_pct,
        percent_rank() OVER (ORDER BY rolling_3yr_war) AS rolling_war_pct
    FROM base
),
scored AS (
    SELECT
        *,
        (wrc_plus_pct + obp_pct + woba_pct + xwoba_pct) / 4.0 AS production_score,
        (iso_pct + xslg_pct + barrel_pct + hard_hit_pct + ev_pct) / 5.0 AS power_score,
        (bb_rate_pct + o_swing_pct) / 2.0 AS discipline_score,
        (contact_pct + z_contact_pct + k_rate_pct + swstr_pct) / 4.0 AS contact_score,
        (baserunning_pct + speed_pct + stolen_bases_pct) / 3.0 AS speed_score,
        (rolling_woba_pct + rolling_war_pct) / 2.0 AS track_record_score
    FROM percentiles
)
SELECT
    player_id,
    player_name,
    team,
    season,
    age,
    plate_appearances,
    war,
    wrc_plus,
    ops,
    obp,
    slg,
    iso,
    woba,
    xwoba,
    xwoba - woba AS xwoba_minus_woba,
    bb_rate,
    k_rate,
    bb_to_k,
    contact_rate,
    z_contact_rate,
    o_swing_rate,
    swinging_strike_rate,
    barrel_rate,
    hard_hit_rate,
    exit_velocity,
    xba,
    xslg,
    baserunning_runs,
    speed_score_raw,
    stolen_bases,
    defense_runs,
    rolling_3yr_ops,
    rolling_3yr_woba,
    rolling_3yr_war,
    rolling_3yr_pa,
    ops - rolling_3yr_ops AS ops_vs_rolling_3yr,
    woba - rolling_3yr_woba AS woba_vs_rolling_3yr,
    war - rolling_3yr_war AS war_vs_rolling_3yr,
    production_score,
    power_score,
    discipline_score,
    contact_score,
    speed_score,
    track_record_score,
    (
        production_score * 0.35 +
        power_score * 0.25 +
        discipline_score * 0.15 +
        contact_score * 0.10 +
        speed_score * 0.05 +
        track_record_score * 0.10
    ) AS sheet_model_score,
    ROW_NUMBER() OVER (
        ORDER BY
            (
                production_score * 0.35 +
                power_score * 0.25 +
                discipline_score * 0.15 +
                contact_score * 0.10 +
                speed_score * 0.05 +
                track_record_score * 0.10
            ) DESC,
            war DESC,
            wrc_plus DESC
    ) AS sheet_model_rank
FROM scored;
