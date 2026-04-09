SELECT
    "Team",
    season,
    COUNT(*) AS hitters,
    AVG("OPS") AS avg_ops,
    SUM("HR") AS total_hr,
    SUM("R") AS total_runs,
    SUM("WAR") AS total_war
FROM batting_stats
WHERE "PA" >= 100
GROUP BY 1, 2
ORDER BY season DESC, avg_ops DESC;
