import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { PlayerBattingSummary, PlayerPitchingSummary } from "@mlb-attendance/domain";
import { Screen } from "../../components/common/Screen";
import { SectionCard } from "../../components/common/SectionCard";
import { useAppData } from "../../providers/AppDataProvider";
import { colors, spacing } from "../../styles/tokens";

type BatterSortKey =
  | "gamesSeen"
  | "atBatsSeen"
  | "hitsSeen"
  | "battingAverageSeen"
  | "homeRunsSeen"
  | "rbisSeen"
  | "walksSeen"
  | "strikeoutsSeenAtPlate";
type PitcherSortKey =
  | "appearances"
  | "strikeoutsSeen"
  | "inningsSeen"
  | "hitsAllowedSeen"
  | "runsAllowedSeen"
  | "eraSeen";
type SortDirection = "desc" | "asc";

const batterGameThresholds = [0, 2, 3, 5];
const batterAbThresholds = [0, 5, 10, 20];
const pitcherAppearanceThresholds = [0, 2, 3, 5];
const pitcherInningThresholds = [0, 3, 5, 10];

function formatWinPct(wins: number, losses: number) {
  const total = wins + losses;
  if (!total) {
    return ".000";
  }

  return `${(wins / total).toFixed(3).replace(/^0/, "")}`;
}

function formatAverage(value: number) {
  return value.toFixed(3).replace(/^0/, ".");
}

function formatEra(value: number) {
  return value.toFixed(2);
}

function sortNumeric<T>(
  rows: T[],
  key: keyof T & string,
  direction: SortDirection,
  fallback: keyof T & string,
  nameKey: keyof T & string
) {
  const factor = direction === "desc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const primary = ((right[key] as number) - (left[key] as number)) * factor;
    if (primary !== 0) {
      return primary;
    }

    const secondary = ((right[fallback] as number) - (left[fallback] as number)) * factor;
    if (secondary !== 0) {
      return secondary;
    }

    return String(left[nameKey]).localeCompare(String(right[nameKey]));
  });
}

function toggleSort<T extends string>(
  activeKey: T,
  nextKey: T,
  direction: SortDirection,
  setKey: (key: T) => void,
  setDirection: (value: SortDirection) => void
) {
  if (activeKey === nextKey) {
    setDirection(direction === "desc" ? "asc" : "desc");
    return;
  }

  setKey(nextKey);
  setDirection("desc");
}

function HeaderCell(props: {
  label: string;
  width?: number;
  align?: "left" | "right";
  active?: boolean;
  direction?: SortDirection;
  onPress?: () => void;
}) {
  const { label, width = 52, align = "right", active = false, direction = "desc", onPress } = props;

  if (!onPress) {
    return (
      <View style={[styles.headerCell, { width }, align === "left" ? styles.nameCol : null]}>
        <Text style={[styles.headerText, { textAlign: align }]}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.headerCell, { width }, align === "left" ? styles.nameCol : null]}>
      <Text style={[styles.headerText, active ? styles.headerTextActive : null, { textAlign: align }]}>
        {label} {active ? (direction === "desc" ? "↓" : "↑") : ""}
      </Text>
    </Pressable>
  );
}

function FilterGroup(props: {
  label: string;
  values: number[];
  activeValue: number;
  onSelect: (value: number) => void;
  formatter?: (value: number) => string;
}) {
  const { label, values, activeValue, onSelect, formatter = (value) => `${value}+` } = props;

  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterRow}>
        {values.map((value) => {
          const active = value === activeValue;
          return (
            <Pressable key={`${label}-${value}`} onPress={() => onSelect(value)} style={[styles.filterChip, active ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {formatter(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BatterRow({ player }: { player: PlayerBattingSummary }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.nameCol}>
        <Text style={styles.nameText}>{player.playerName}</Text>
        <Text style={styles.subText}>{player.teams.join(", ")}</Text>
      </View>
      <Text style={styles.cellText}>{player.gamesSeen}</Text>
      <Text style={styles.cellText}>{player.atBatsSeen}</Text>
      <Text style={styles.cellText}>{player.hitsSeen}</Text>
      <Text style={styles.cellText}>{formatAverage(player.battingAverageSeen)}</Text>
      <Text style={styles.cellText}>{player.homeRunsSeen}</Text>
      <Text style={styles.cellText}>{player.rbisSeen}</Text>
      <Text style={styles.cellText}>{player.walksSeen}</Text>
      <Text style={styles.cellText}>{player.strikeoutsSeenAtPlate}</Text>
    </View>
  );
}

function PitcherRow({ pitcher }: { pitcher: PlayerPitchingSummary }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.nameCol}>
        <Text style={styles.nameText}>{pitcher.pitcherName}</Text>
        <Text style={styles.subText}>{pitcher.teams.join(", ")}</Text>
      </View>
      <Text style={styles.cellText}>{pitcher.appearances}</Text>
      <Text style={styles.cellText}>{pitcher.strikeoutsSeen}</Text>
      <Text style={styles.cellText}>{pitcher.inningsSeen.toFixed(1)}</Text>
      <Text style={styles.cellText}>{pitcher.hitsAllowedSeen}</Text>
      <Text style={styles.cellText}>{pitcher.runsAllowedSeen}</Text>
      <Text style={styles.cellText}>{formatEra(pitcher.eraSeen)}</Text>
    </View>
  );
}

export function StatsScreen() {
  const { width } = useWindowDimensions();
  const { stats } = useAppData();
  const isWide = width >= 1080;
  const [batterSortKey, setBatterSortKey] = useState<BatterSortKey>("homeRunsSeen");
  const [batterSortDirection, setBatterSortDirection] = useState<SortDirection>("desc");
  const [pitcherSortKey, setPitcherSortKey] = useState<PitcherSortKey>("strikeoutsSeen");
  const [pitcherSortDirection, setPitcherSortDirection] = useState<SortDirection>("desc");
  const [minBatterGames, setMinBatterGames] = useState(0);
  const [minBatterAtBats, setMinBatterAtBats] = useState(0);
  const [minPitcherAppearances, setMinPitcherAppearances] = useState(0);
  const [minPitcherInnings, setMinPitcherInnings] = useState(0);

  const filteredBatters = useMemo(() => {
    return stats.playerBattingSummaries.filter(
      (player) => player.gamesSeen >= minBatterGames && player.atBatsSeen >= minBatterAtBats
    );
  }, [minBatterAtBats, minBatterGames, stats.playerBattingSummaries]);

  const filteredPitchers = useMemo(() => {
    return stats.playerPitchingSummaries.filter(
      (pitcher) => pitcher.appearances >= minPitcherAppearances && pitcher.inningsSeen >= minPitcherInnings
    );
  }, [minPitcherAppearances, minPitcherInnings, stats.playerPitchingSummaries]);

  const sortedBatters = useMemo(() => {
    return sortNumeric(filteredBatters, batterSortKey, batterSortDirection, "hitsSeen", "playerName");
  }, [batterSortDirection, batterSortKey, filteredBatters]);

  const sortedPitchers = useMemo(() => {
    return sortNumeric(filteredPitchers, pitcherSortKey, pitcherSortDirection, "strikeoutsSeen", "pitcherName");
  }, [filteredPitchers, pitcherSortDirection, pitcherSortKey]);

  const topHitsBatter = useMemo(() => {
    return sortNumeric(stats.playerBattingSummaries, "hitsSeen", "desc", "homeRunsSeen", "playerName")[0];
  }, [stats.playerBattingSummaries]);

  const favoriteTeamLabel = stats.favoriteTeamSplit?.teamName ?? "Favorite Team";
  const topBatter = sortedBatters[0];
  const topPitcher = sortedPitchers[0];

  return (
    <Screen
      title="Deep Stats"
      subtitle="Every hitter, pitcher, and team you’ve seen, with header sorting, minimum filters, and rate stats for faster scanning."
    >
      <View style={styles.topBar}>
        <View style={styles.topStat}>
          <Text style={styles.topStatLabel}>{favoriteTeamLabel} Record</Text>
          <Text style={styles.topStatValue}>
            {stats.favoriteTeamSplit?.wins ?? stats.wins}-{stats.favoriteTeamSplit?.losses ?? stats.losses}
          </Text>
        </View>
        <View style={styles.topStat}>
          <Text style={styles.topStatLabel}>Hits Seen</Text>
          <Text style={styles.topStatValue}>{stats.totalHitsSeen}</Text>
        </View>
        <View style={styles.topStat}>
          <Text style={styles.topStatLabel}>Filtered Hitters</Text>
          <Text style={styles.topStatValue}>{sortedBatters.length}</Text>
        </View>
        <View style={styles.topStat}>
          <Text style={styles.topStatLabel}>Filtered Pitchers</Text>
          <Text style={styles.topStatValue}>{sortedPitchers.length}</Text>
        </View>
      </View>

      <View style={[styles.layout, isWide ? styles.layoutWide : null]}>
        <View style={styles.mainColumn}>
          <SectionCard title="Quick Read">
            <View style={styles.compactList}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Favorite team games</Text>
                <Text style={styles.metricValue}>{stats.favoriteTeamSplit?.gamesAttended ?? 0}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Favorite team win pct</Text>
                <Text style={styles.metricValue}>
                  {formatWinPct(stats.favoriteTeamSplit?.wins ?? 0, stats.favoriteTeamSplit?.losses ?? 0)}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Average hits per game</Text>
                <Text style={styles.metricValue}>{stats.averageHitsPerGame.toFixed(1)}</Text>
              </View>
              {topBatter ? (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Filtered HR leader</Text>
                  <Text style={styles.metricValue}>
                    {topBatter.playerName} ({topBatter.homeRunsSeen})
                  </Text>
                </View>
              ) : null}
              {topPitcher ? (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Filtered K leader</Text>
                  <Text style={styles.metricValue}>
                    {topPitcher.pitcherName} ({topPitcher.strikeoutsSeen})
                  </Text>
                </View>
              ) : null}
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Teams seen</Text>
                <Text style={styles.metricValue}>{stats.teamSeenSummaries.length}</Text>
              </View>
            </View>
          </SectionCard>

          <SectionCard title="Hitters Seen">
            <View style={styles.filtersBlock}>
              <FilterGroup
                label="Min games"
                values={batterGameThresholds}
                activeValue={minBatterGames}
                onSelect={setMinBatterGames}
                formatter={(value) => (value === 0 ? "All" : `${value}+`)}
              />
              <FilterGroup
                label="Min AB"
                values={batterAbThresholds}
                activeValue={minBatterAtBats}
                onSelect={setMinBatterAtBats}
                formatter={(value) => (value === 0 ? "All" : `${value}+`)}
              />
            </View>
            <View style={styles.tableHeader}>
              <HeaderCell label="Player" align="left" />
              <HeaderCell
                label="G"
                active={batterSortKey === "gamesSeen"}
                direction={batterSortDirection}
                onPress={() => toggleSort(batterSortKey, "gamesSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
              />
              <HeaderCell
                label="AB"
                active={batterSortKey === "atBatsSeen"}
                direction={batterSortDirection}
                onPress={() => toggleSort(batterSortKey, "atBatsSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
              />
              <HeaderCell
                label="H"
                active={batterSortKey === "hitsSeen"}
                direction={batterSortDirection}
                onPress={() => toggleSort(batterSortKey, "hitsSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
              />
              <HeaderCell
                label="AVG"
                active={batterSortKey === "battingAverageSeen"}
                direction={batterSortDirection}
                onPress={() => toggleSort(batterSortKey, "battingAverageSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
              />
              <HeaderCell
                label="HR"
                active={batterSortKey === "homeRunsSeen"}
                direction={batterSortDirection}
                onPress={() => toggleSort(batterSortKey, "homeRunsSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
              />
              <HeaderCell
                label="RBI"
                active={batterSortKey === "rbisSeen"}
                direction={batterSortDirection}
                onPress={() => toggleSort(batterSortKey, "rbisSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
              />
              <HeaderCell
                label="BB"
                active={batterSortKey === "walksSeen"}
                direction={batterSortDirection}
                onPress={() => toggleSort(batterSortKey, "walksSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
              />
              <HeaderCell
                label="K"
                active={batterSortKey === "strikeoutsSeenAtPlate"}
                direction={batterSortDirection}
                onPress={() =>
                  toggleSort(
                    batterSortKey,
                    "strikeoutsSeenAtPlate",
                    batterSortDirection,
                    setBatterSortKey,
                    setBatterSortDirection
                  )
                }
              />
            </View>
            {sortedBatters.map((player) => (
              <BatterRow key={player.playerName} player={player} />
            ))}
          </SectionCard>

          <SectionCard title="Pitchers Seen">
            <View style={styles.filtersBlock}>
              <FilterGroup
                label="Min apps"
                values={pitcherAppearanceThresholds}
                activeValue={minPitcherAppearances}
                onSelect={setMinPitcherAppearances}
                formatter={(value) => (value === 0 ? "All" : `${value}+`)}
              />
              <FilterGroup
                label="Min IP"
                values={pitcherInningThresholds}
                activeValue={minPitcherInnings}
                onSelect={setMinPitcherInnings}
                formatter={(value) => (value === 0 ? "All" : `${value}+`)}
              />
            </View>
            <View style={styles.tableHeader}>
              <HeaderCell label="Pitcher" align="left" />
              <HeaderCell
                label="Apps"
                active={pitcherSortKey === "appearances"}
                direction={pitcherSortDirection}
                onPress={() =>
                  toggleSort(pitcherSortKey, "appearances", pitcherSortDirection, setPitcherSortKey, setPitcherSortDirection)
                }
              />
              <HeaderCell
                label="K"
                active={pitcherSortKey === "strikeoutsSeen"}
                direction={pitcherSortDirection}
                onPress={() =>
                  toggleSort(
                    pitcherSortKey,
                    "strikeoutsSeen",
                    pitcherSortDirection,
                    setPitcherSortKey,
                    setPitcherSortDirection
                  )
                }
              />
              <HeaderCell
                label="IP"
                active={pitcherSortKey === "inningsSeen"}
                direction={pitcherSortDirection}
                onPress={() =>
                  toggleSort(pitcherSortKey, "inningsSeen", pitcherSortDirection, setPitcherSortKey, setPitcherSortDirection)
                }
              />
              <HeaderCell
                label="H"
                active={pitcherSortKey === "hitsAllowedSeen"}
                direction={pitcherSortDirection}
                onPress={() =>
                  toggleSort(
                    pitcherSortKey,
                    "hitsAllowedSeen",
                    pitcherSortDirection,
                    setPitcherSortKey,
                    setPitcherSortDirection
                  )
                }
              />
              <HeaderCell
                label="R"
                active={pitcherSortKey === "runsAllowedSeen"}
                direction={pitcherSortDirection}
                onPress={() =>
                  toggleSort(
                    pitcherSortKey,
                    "runsAllowedSeen",
                    pitcherSortDirection,
                    setPitcherSortKey,
                    setPitcherSortDirection
                  )
                }
              />
              <HeaderCell
                label="ERA"
                active={pitcherSortKey === "eraSeen"}
                direction={pitcherSortDirection}
                onPress={() => toggleSort(pitcherSortKey, "eraSeen", pitcherSortDirection, setPitcherSortKey, setPitcherSortDirection)}
              />
            </View>
            {sortedPitchers.map((pitcher) => (
              <PitcherRow key={pitcher.pitcherName} pitcher={pitcher} />
            ))}
          </SectionCard>
        </View>

        <View style={styles.sideColumn}>
          <SectionCard title="Quick Answers">
            <View style={styles.compactList}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Juan Soto HR seen</Text>
                <Text style={styles.metricValue}>
                  {stats.playerBattingSummaries.find((player) => player.playerName === "Juan Soto")?.homeRunsSeen ?? 0}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>David Peterson K seen</Text>
                <Text style={styles.metricValue}>
                  {stats.playerPitchingSummaries.find((pitcher) => pitcher.pitcherName === "David Peterson")?.strikeoutsSeen ?? 0}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Top hitter by hits</Text>
                <Text style={styles.metricValue}>{topHitsBatter?.playerName ?? "N/A"}</Text>
              </View>
            </View>
          </SectionCard>

          <SectionCard title="Teams Seen">
            <View style={styles.tableHeader}>
              <HeaderCell label="Team" align="left" />
              <HeaderCell label="G" />
              <HeaderCell label="W" />
              <HeaderCell label="L" />
              <HeaderCell label="H" />
              <HeaderCell label="R" />
            </View>
            {stats.teamSeenSummaries.map((team) => (
              <View key={team.teamId} style={styles.tableRow}>
                <View style={styles.nameCol}>
                  <Text style={styles.nameText}>{team.teamName}</Text>
                </View>
                <Text style={styles.cellText}>{team.gamesSeen}</Text>
                <Text style={styles.cellText}>{team.winsSeen}</Text>
                <Text style={styles.cellText}>{team.lossesSeen}</Text>
                <Text style={styles.cellText}>{team.hitsSeen}</Text>
                <Text style={styles.cellText}>{team.runsSeen}</Text>
              </View>
            ))}
          </SectionCard>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  topStat: {
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2
  },
  topStatLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  topStatValue: {
    fontSize: 24,
    color: colors.navy,
    fontWeight: "800"
  },
  layout: {
    gap: spacing.md
  },
  layoutWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  mainColumn: {
    flex: 1.2,
    gap: spacing.md
  },
  sideColumn: {
    flex: 0.8,
    gap: spacing.md
  },
  compactList: {
    gap: spacing.xs
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  metricLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.slate700
  },
  metricValue: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: "700"
  },
  filtersBlock: {
    gap: spacing.sm
  },
  filterGroup: {
    gap: spacing.xs
  },
  filterLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white
  },
  filterChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.slate700
  },
  filterChipTextActive: {
    color: colors.white
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200
  },
  headerCell: {
    justifyContent: "center"
  },
  headerText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  headerTextActive: {
    color: colors.navy
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100
  },
  nameCol: {
    flex: 1
  },
  nameText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.slate900
  },
  subText: {
    fontSize: 11,
    color: colors.slate500
  },
  cellText: {
    width: 52,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy
  }
});
