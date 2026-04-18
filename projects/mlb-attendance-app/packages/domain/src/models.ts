export type SportCode = "MLB";

export interface UserProfile {
  id: string;
  displayName: string;
  favoriteTeamId?: string;
  followingIds?: string[];
}

export interface FriendProfile {
  id: string;
  displayName: string;
  favoriteTeamId?: string;
  bio?: string;
  homeCity?: string;
}

export interface Team {
  id: string;
  sport: SportCode;
  city: string;
  name: string;
  abbreviation: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  state?: string;
}

export interface Game {
  id: string;
  sport: SportCode;
  startDate: string;
  venueId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeHits: number;
  awayHits: number;
  status: "final";
  innings?: number;
  walkOff?: boolean;
  featuredPlayerHomeRun?: string;
  pitchersUsed?: PitcherAppearance[];
  battersUsed?: BatterAppearance[];
}

export interface PitcherAppearance {
  teamId: string;
  pitcherName: string;
  role: "starter" | "reliever" | "closer";
  inningsPitched?: number;
  hitsAllowed?: number;
  runsAllowed?: number;
  strikeouts?: number;
  decision?: "win" | "loss" | "save" | "hold";
}

export interface BatterAppearance {
  teamId: string;
  playerName: string;
  atBats: number;
  hits: number;
  homeRuns: number;
  rbis: number;
  strikeouts: number;
  walks: number;
}

export interface SeatInfo {
  section: string;
  row?: string;
  seatNumber?: string;
}

export interface WitnessedEvent {
  id: string;
  attendanceLogId: string;
  type:
    | "team_win"
    | "team_loss"
    | "home_run"
    | "walk_off"
    | "extra_innings"
    | "shutout";
  label: string;
  playerName?: string;
  teamId?: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  gameId: string;
  venueId: string;
  attendedOn: string;
  seat: SeatInfo;
  witnessedEvents: WitnessedEvent[];
  memorableMoment?: string;
  companion?: string;
  giveaway?: string;
  weather?: string;
}

export interface FavoriteTeamSplit {
  teamId: string;
  teamName: string;
  gamesAttended: number;
  wins: number;
  losses: number;
}

export interface RecentMoment {
  attendanceLogId: string;
  title: string;
  subtitle: string;
}

export interface PitcherSeenSummary {
  pitcherName: string;
  appearances: number;
  teams: string[];
}

export interface PlayerBattingSummary {
  playerName: string;
  teams: string[];
  gamesSeen: number;
  atBatsSeen: number;
  hitsSeen: number;
  battingAverageSeen: number;
  homeRunsSeen: number;
  rbisSeen: number;
  strikeoutsSeenAtPlate: number;
  walksSeen: number;
}

export interface PlayerPitchingSummary {
  pitcherName: string;
  teams: string[];
  appearances: number;
  strikeoutsSeen: number;
  inningsSeen: number;
  hitsAllowedSeen: number;
  runsAllowedSeen: number;
  eraSeen: number;
}

export interface TeamSeenSummary {
  teamId: string;
  teamName: string;
  gamesSeen: number;
  winsSeen: number;
  lossesSeen: number;
  hitsSeen: number;
  runsSeen: number;
}

export interface PersonalStats {
  totalGamesAttended: number;
  wins: number;
  losses: number;
  uniqueStadiumsVisited: number;
  uniqueSectionsSatIn: number;
  favoriteTeamSplit?: FavoriteTeamSplit;
  witnessedHomeRuns: number;
  totalHitsSeen: number;
  totalRunsSeen: number;
  uniquePitchersSeen: number;
  averageHitsPerGame: number;
  topPitchersSeen: PitcherSeenSummary[];
  playerBattingSummaries: PlayerBattingSummary[];
  playerPitchingSummaries: PlayerPitchingSummary[];
  teamSeenSummaries: TeamSeenSummary[];
  recentMoments: RecentMoment[];
}

export interface CreateAttendanceInput {
  userId: string;
  gameId: string;
  seat: SeatInfo;
  memorableMoment?: string;
  companion?: string;
  giveaway?: string;
  weather?: string;
}
