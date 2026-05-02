import type { Game, Team, Venue } from "@mlb-attendance/domain";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "2-digit",
  year: "numeric",
  timeZone: "America/New_York"
});

export function formatBaseballInnings(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return "0.0";
  }

  const wholeInnings = Math.trunc(value);
  const outs = Math.round((value - wholeInnings) * 3);

  if (outs >= 3) {
    return `${wholeInnings + 1}.0`;
  }

  return `${wholeInnings}.${outs}`;
}

export function formatDisplayDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
}

export function formatGameLabel(game: Game, teamsById: Map<string, Team>, venuesById: Map<string, Venue>) {
  const awayTeam = teamsById.get(game.awayTeamId);
  const homeTeam = teamsById.get(game.homeTeamId);
  const venue = venuesById.get(game.venueId);

  return {
    title: `${awayTeam?.abbreviation ?? "AWAY"} at ${homeTeam?.abbreviation ?? "HOME"}`,
    subtitle: `${formatDisplayDate(game.startDate)} • ${venue?.name ?? "Unknown venue"}`,
    score: `${game.awayScore}-${game.homeScore}`
  };
}
