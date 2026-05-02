export type SportCode = "MLB";

export interface UserProfile {
  id: string;
  displayName: string;
  username?: string;
  favoriteTeamId?: string;
  followingIds?: string[];
  avatarUrl?: string;
  profileVisibility?: ProfileVisibility;
  hasCompletedOnboarding?: boolean;
}

export type ProfileVisibility = "public" | "followers_only" | "private";
export type FollowStatus = "pending" | "accepted" | "rejected" | "blocked";

export interface FriendProfile {
  id: string;
  username?: string;
  displayName: string;
  favoriteTeamId?: string;
  avatarUrl?: string;
  profileVisibility?: ProfileVisibility;
  sharedGamesLogged?: number | null;
  sharedStadiumsVisited?: number | null;
  relationshipStatus?: FollowStatus | "not_following";
  bio?: string;
  homeCity?: string;
}

export interface FollowRequest {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: string;
  updatedAt: string;
  direction: "incoming" | "outgoing";
  profile: FriendProfile;
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
  startDateTime?: string;
  venueId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeHits: number;
  awayHits: number;
  homeErrors?: number;
  awayErrors?: number;
  status: "final";
  innings?: number;
  lineScore?: InningLineScore[];
  walkOff?: boolean;
  featuredPlayerHomeRun?: string;
  pitchersUsed?: PitcherAppearance[];
  battersUsed?: BatterAppearance[];
}

export interface InningLineScore {
  inning: number;
  homeRuns: number;
  awayRuns: number;
}

export interface PitcherAppearance {
  teamId: string;
  playerId?: string | number;
  pitcherName: string;
  role: "starter" | "reliever" | "closer";
  inningsPitched?: number;
  hitsAllowed?: number;
  runsAllowed?: number;
  earnedRunsAllowed?: number;
  strikeouts?: number;
  walksAllowed?: number;
  homeRunsAllowed?: number;
  pitchesThrown?: number;
  strikes?: number;
  decision?: "win" | "loss" | "save" | "hold";
  gameScore?: number;
}

export interface BatterAppearance {
  teamId: string;
  playerId?: string | number;
  playerName: string;
  position?: string;
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
  positions: string[];
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
  roles: string[];
  appearances: number;
  starts: number;
  outsRecordedSeen: number;
  strikeoutsSeen: number;
  inningsSeen: number;
  hitsAllowedSeen: number;
  runsAllowedSeen: number;
  earnedRunsAllowedSeen?: number;
  walksAllowedSeen: number;
  homeRunsAllowedSeen: number;
  eraSeen: number;
  bestGameScoreSeen?: number;
}

export interface PitchingGamePerformance {
  gameId: string;
  pitcherName: string;
  teamId: string;
  teamName: string;
  opponentTeamId: string;
  opponentTeamName: string;
  startDate: string;
  venueId: string;
  gameScore: number;
  inningsPitched?: number;
  hitsAllowed?: number;
  strikeouts?: number;
  runsAllowed?: number;
  earnedRunsAllowed?: number;
  walksAllowed?: number;
  homeRunsAllowed?: number;
  pitchesThrown?: number;
  strikes?: number;
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
  topPitchingGamePerformances: PitchingGamePerformance[];
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
