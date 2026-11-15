export type GameMode = '1v1' | '2v2' | '3v3' | '4v4' | '5v5';
export type PitchSize = 'normal' | 'large' | 'ellipse';
export type Team = 'red' | 'blue' | 'spec';
export type ActiveTeam = 'red' | 'blue';
export type PlayerRole = 'kaleci' | 'defans' | 'ortasaha' | 'forvet';
export type FormationPreset = 'defansif' | 'dengeli' | 'ofansif';
export type BotDifficulty = 'kolay' | 'normal' | 'zor' | 'efsanevi';
export type MatchPhase = 'lobby' | 'countdown' | 'playing' | 'goal' | 'overtime' | 'finished';
export type RoomGameType = 'single' | 'tournament' | 'league';
export type TournamentSize = 4 | 8 | 32;

export type TeamColorId =
  | 'red'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'purple'
  | 'orange'
  | 'cyan'
  | 'pink'
  | 'slate'
  | 'white';

export const PITCH_SIZE_LABELS: Record<PitchSize, { label: string; desc: string }> = {
  normal: { label: 'Normal', desc: 'Klasik dengeli saha ölçüsü' },
  large: { label: 'Geniş', desc: 'Açık oyun için büyük saha' },
  ellipse: { label: 'Elips', desc: 'Köşesiz hızlı top sekmesi' },
};

export interface TeamColorTheme {
  id: TeamColorId;
  label: string;
  hex: string;
  lightHex: string;
  darkHex: string;
  borderHex: string;
  ring: string;
  rgba: string;
  isLight?: boolean;
}

export const TEAM_COLOR_PALETTE: Record<TeamColorId, TeamColorTheme> = {
  red: {
    id: 'red',
    label: 'Kırmızı',
    hex: '#DC2626',
    lightHex: '#F87171',
    darkHex: '#991B1B',
    borderHex: '#FEE2E2',
    ring: '#FCA5A5',
    rgba: 'rgba(220, 38, 38, 0.28)',
  },
  blue: {
    id: 'blue',
    label: 'Mavi',
    hex: '#2563EB',
    lightHex: '#60A5FA',
    darkHex: '#1E3A8A',
    borderHex: '#DBEAFE',
    ring: '#93C5FD',
    rgba: 'rgba(37, 99, 235, 0.28)',
  },
  emerald: {
    id: 'emerald',
    label: 'Yeşil',
    hex: '#059669',
    lightHex: '#34D399',
    darkHex: '#065F46',
    borderHex: '#D1FAE5',
    ring: '#6EE7B7',
    rgba: 'rgba(5, 150, 105, 0.28)',
  },
  amber: {
    id: 'amber',
    label: 'Sarı',
    hex: '#D97706',
    lightHex: '#FBBF24',
    darkHex: '#92400E',
    borderHex: '#FEF3C7',
    ring: '#FDE68A',
    rgba: 'rgba(217, 119, 6, 0.28)',
  },
  purple: {
    id: 'purple',
    label: 'Mor',
    hex: '#7C3AED',
    lightHex: '#A78BFA',
    darkHex: '#5B21B6',
    borderHex: '#EDE9FE',
    ring: '#C4B5FD',
    rgba: 'rgba(124, 58, 237, 0.28)',
  },
  orange: {
    id: 'orange',
    label: 'Turuncu',
    hex: '#EA580C',
    lightHex: '#FB923C',
    darkHex: '#9A3412',
    borderHex: '#FFEDD5',
    ring: '#FDBA74',
    rgba: 'rgba(234, 88, 12, 0.28)',
  },
  cyan: {
    id: 'cyan',
    label: 'Turkuaz',
    hex: '#0891B2',
    lightHex: '#22D3EE',
    darkHex: '#155E75',
    borderHex: '#CFFAFE',
    ring: '#67E8F9',
    rgba: 'rgba(8, 145, 178, 0.28)',
  },
  pink: {
    id: 'pink',
    label: 'Pembe',
    hex: '#DB2777',
    lightHex: '#F472B6',
    darkHex: '#9D174D',
    borderHex: '#FCE7F3',
    ring: '#F9A8D4',
    rgba: 'rgba(219, 39, 119, 0.28)',
  },
  slate: {
    id: 'slate',
    label: 'Siyah',
    hex: '#334155',
    lightHex: '#64748B',
    darkHex: '#0F172A',
    borderHex: '#CBD5E1',
    ring: '#94A3B8',
    rgba: 'rgba(51, 65, 85, 0.34)',
  },
  white: {
    id: 'white',
    label: 'Beyaz',
    hex: '#E2E8F0',
    lightHex: '#FFFFFF',
    darkHex: '#94A3B8',
    borderHex: '#475569',
    ring: '#CBD5E1',
    rgba: 'rgba(226, 232, 240, 0.28)',
    isLight: true,
  },
};

export const TEAM_COLOR_LIST: TeamColorTheme[] = Object.values(TEAM_COLOR_PALETTE);

export interface TeamIdentity {
  name: string;
  colorId: TeamColorId;
}

export type TeamMetaMap = Record<ActiveTeam, TeamIdentity>;

export const DEFAULT_TEAM_META: TeamMetaMap = {
  red: { name: '1. Takım', colorId: 'red' },
  blue: { name: '2. Takım', colorId: 'blue' },
};

export const BOT_DIFFICULTY_LABELS: Record<
  BotDifficulty,
  { label: string; short: string; desc: string }
> = {
  kolay: { label: 'Kolay', short: 'K', desc: 'Yavaş tepki, temel pozisyon' },
  normal: { label: 'Normal', short: 'N', desc: 'Dengeli pas ve şut oyunu' },
  zor: { label: 'Zor', short: 'Z', desc: 'Hızlı pres, öngörülü paslaşma' },
  efsanevi: { label: 'Efsanevi', short: 'E', desc: 'Gelişmiş yapay zeka & taktik' },
};

export interface FormationSpot {
  playerId: string;
  normDepth: number; // 0 = near own goal, 1 = midfield outside center circle
  normY: number;     // -0.88..+0.88 top-to-bottom pitch fraction
}

export const ROLE_LABELS: Record<PlayerRole, { short: string; label: string }> = {
  kaleci: { short: 'KL', label: 'Kaleci' },
  defans: { short: 'DF', label: 'Defans' },
  ortasaha: { short: 'OS', label: 'Orta Saha' },
  forvet: { short: 'FV', label: 'Forvet' },
};

export interface PitchConfig {
  mode: GameMode;
  teamSize: number;
  width: number;
  height: number;
  goalHalfHeight: number;
  goalDepth: number;
  playerRadius: number;
  ballRadius: number;
  cornerRadius: number;
}

export const MODE_CONFIGS: Record<GameMode, PitchConfig> = {
  '1v1': {
    mode: '1v1',
    teamSize: 1,
    width: 820,
    height: 440,
    goalHalfHeight: 89,
    goalDepth: 50,
    playerRadius: 16,
    ballRadius: 8,
    cornerRadius: 0,
  },
  '2v2': {
    mode: '2v2',
    teamSize: 2,
    width: 960,
    height: 500,
    goalHalfHeight: 98,
    goalDepth: 53,
    playerRadius: 16,
    ballRadius: 8,
    cornerRadius: 0,
  },
  '3v3': {
    mode: '3v3',
    teamSize: 3,
    width: 1120,
    height: 560,
    goalHalfHeight: 108,
    goalDepth: 55,
    playerRadius: 16,
    ballRadius: 8,
    cornerRadius: 0,
  },
  '4v4': {
    mode: '4v4',
    teamSize: 4,
    width: 1260,
    height: 620,
    goalHalfHeight: 118,
    goalDepth: 58,
    playerRadius: 16,
    ballRadius: 8,
    cornerRadius: 0,
  },
  '5v5': {
    mode: '5v5',
    teamSize: 5,
    width: 1420,
    height: 680,
    goalHalfHeight: 127,
    goalDepth: 60,
    playerRadius: 16,
    ballRadius: 8,
    cornerRadius: 0,
  },
};

export function getPitchConfig(mode: GameMode, pitchSize: PitchSize = 'normal'): PitchConfig {
  const base = MODE_CONFIGS[mode];
  if (pitchSize === 'large') {
    return {
      ...base,
      width: Math.round(base.width * 1.28),
      height: Math.round(base.height * 1.28),
      goalHalfHeight: Math.round(base.goalHalfHeight * 1.12),
      goalDepth: base.goalDepth + 6,
      cornerRadius: 0,
    };
  }
  if (pitchSize === 'ellipse') {
    const width = Math.round(base.width * 1.16);
    const height = Math.round(base.height * 1.16);
    const goalHalfHeight = Math.round(base.goalHalfHeight * 1.08);
    const cornerRadius = Math.max(
      90,
      Math.round(Math.min(width * 0.22, height / 2 - goalHalfHeight - 10))
    );
    return {
      ...base,
      width,
      height,
      goalHalfHeight,
      goalDepth: base.goalDepth + 4,
      cornerRadius,
    };
  }
  return base;
}

export interface PlayerInput {
  seq: number;
  dx: number;
  dy: number;
  kick: boolean;
  sprint: boolean;
}

export interface PlayerStats {
  goals: number;
  assists: number;
  passes: number;
  shots: number;
  shotsOnTarget: number;
  touches: number;
  saves: number;
  sprintTicks: number;
  distancePx: number;
}

export interface PlayerEntity {
  id: string;
  name: string;
  team: ActiveTeam;
  role?: PlayerRole;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  stamina: number; // 0..100
  isSprinting: boolean;
  kickAnim: number; // 0..1 decaying visual pulse
  kickCooldown: number; // ticks remaining
  facingX: number;
  facingY: number;
  stats: PlayerStats;
}

export interface BallEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  lastTouchId: string | null;
  lastTouchTeam: ActiveTeam | null;
  prevTouchId: string | null;
  prevTouchTeam: ActiveTeam | null;
  isShotOnTargetFor: ActiveTeam | null;
}

export interface GoalEvent {
  scoringTeam: ActiveTeam;
  scorerName: string;
  assistName: string | null;
  isOwnGoal: boolean;
  matchTimeRemaining: number;
  isOvertime: boolean;
}

export interface MatchSummaryStats {
  redScore: number;
  blueScore: number;
  winner: ActiveTeam | 'draw';
  durationPlayedSec: number;
  redPossessionPct: number;
  bluePossessionPct: number;
  redShots: number;
  blueShots: number;
  redShotsOnTarget: number;
  blueShotsOnTarget: number;
  redPasses: number;
  bluePasses: number;
  redTouches: number;
  blueTouches: number;
  redSaves: number;
  blueSaves: number;
  goals: GoalEvent[];
  playerRows: Array<{
    id: string;
    name: string;
    team: ActiveTeam;
    isBot: boolean;
    goals: number;
    assists: number;
    passes: number;
    shots: number;
    shotsOnTarget: number;
    touches: number;
    saves: number;
    sprintSec: number;
    distanceMeters: number;
  }>;
}

export type PhysicsSoundEvent = 'kick' | 'post' | 'wall' | 'goal' | 'whistle' | 'countdown_tick';

export interface GameSnapshot {
  tick: number;
  phase: MatchPhase;
  mode: GameMode;
  pitchSize?: PitchSize;
  teamFormations?: Record<ActiveTeam, FormationPreset>;
  teamMeta?: TeamMetaMap;
  durationSec: number;
  timeLeftSec: number;
  phaseTimerSec: number;
  redScore: number;
  blueScore: number;
  kickoffTeam?: ActiveTeam;
  kickoffWaitingTouch?: boolean;
  goalBanner: {
    scoringTeam: ActiveTeam;
    scorerName: string;
    assistName: string | null;
    isOwnGoal: boolean;
  } | null;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
  };
  players: Array<{
    id: string;
    name: string;
    team: ActiveTeam;
    role?: PlayerRole;
    isBot: boolean;
    botDifficulty?: BotDifficulty;
    x: number;
    y: number;
    vx: number;
    vy: number;
    stamina: number;
    isSprinting: boolean;
    kickAnim: number;
    facingX: number;
    facingY: number;
    emoji?: string;
  }>;
  events: PhysicsSoundEvent[];
  summary: MatchSummaryStats | null;
  tutorialTarget?: {
    x: number;
    y: number;
    radius: number;
    kind: 'dribble' | 'sprint' | 'goal';
  } | null;
}

export interface RoomMemberInfo {
  id: string;
  name: string;
  team: Team;
  role: PlayerRole;
  tournamentSlot: number;
  isHost: boolean;
  isReady: boolean;
  isWatchingAd: boolean;
  coins: number;
}

export interface LobbyChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface TournamentTeamInfo {
  slotIndex: number;
  name: string;
  eliminated: boolean;
}

export interface TournamentMatchInfo {
  id: string;
  roundIndex: number;
  roundLabel: string;
  matchIndex: number;
  teamAIndex: number | null;
  teamBIndex: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerSlotIndex: number | null;
  status: 'pending' | 'playing' | 'finished';
}

export interface TournamentStateInfo {
  size: TournamentSize;
  teams: TournamentTeamInfo[];
  matches: TournamentMatchInfo[];
  currentMatchId: string | null;
  championSlotIndex: number | null;
  runnerUpSlotIndex?: number | null;
  lastCompletedRoundIndex?: number | null;
  phase: 'bracket' | 'playing' | 'champion';
}

export interface LeagueStandingRow {
  slotIndex: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export interface LeagueMatchInfo {
  id: string;
  weekIndex: number;
  teamAIndex: number;
  teamBIndex: number;
  scoreA: number | null;
  scoreB: number | null;
  status: 'pending' | 'playing' | 'finished';
}

export interface LeagueStateInfo {
  size: 18;
  teams: string[];
  standings: LeagueStandingRow[];
  matches: LeagueMatchInfo[];
  currentWeekIndex: number;
  currentMatchId: string | null;
  championSlotIndex: number | null;
  lastCompletedWeekIndex?: number | null;
  phase: 'fixtures' | 'playing' | 'finished';
}

export interface RoomStateInfo {
  roomCode: string;
  hostId: string;
  mode: GameMode;
  pitchSize: PitchSize;
  durationSec: number;
  fillBots: boolean;
  redBotCount?: number;
  blueBotCount?: number;
  gameType: RoomGameType;
  tournamentSize: TournamentSize;
  tournament: TournamentStateInfo | null;
  league: LeagueStateInfo | null;
  defaultBotDifficulty: BotDifficulty;
  botDifficulties: Record<string, BotDifficulty>;
  teamMeta: TeamMetaMap;
  chatMessages: LobbyChatMessage[];
  phase: MatchPhase;
  members: RoomMemberInfo[];
}

export interface PublicRoomSummary {
  roomCode: string;
  mode: GameMode;
  pitchSize?: PitchSize;
  playerCount: number;
  maxPlayers: number;
  phase: MatchPhase;
  hostName: string;
}

// Client -> Server WebSocket messages
export type ClientWsMessage =
  | {
      type: 'create_room';
      playerName: string;
      mode: GameMode;
      pitchSize?: PitchSize;
      durationSec: number;
      fillBots: boolean;
      redBotCount?: number;
      blueBotCount?: number;
      gameType?: RoomGameType;
      tournamentSize?: TournamentSize;
      defaultBotDifficulty?: BotDifficulty;
      botDifficulties?: Record<string, BotDifficulty>;
      teamMeta?: TeamMetaMap;
      coins?: number;
    }
  | {
      type: 'join_room';
      roomCode: string;
      playerName: string;
      coins?: number;
    }
  | {
      type: 'leave_room';
    }
  | {
      type: 'switch_team';
      team: Team;
    }
  | {
      type: 'switch_tournament_slot';
      slotIndex: number;
    }
  | {
      type: 'set_role';
      role: PlayerRole;
    }
  | {
      type: 'set_ready';
      ready: boolean;
    }
  | {
      type: 'set_watching_ad';
      watching: boolean;
    }
  | {
      type: 'update_coins';
      coins: number;
    }
  | {
      type: 'kick_member';
      targetId: string;
    }
  | {
      type: 'chat_message';
      text: string;
    }
  | {
      type: 'update_settings';
      mode: GameMode;
      pitchSize?: PitchSize;
      durationSec: number;
      fillBots: boolean;
      redBotCount?: number;
      blueBotCount?: number;
      gameType?: RoomGameType;
      tournamentSize?: TournamentSize;
      defaultBotDifficulty?: BotDifficulty;
      botDifficulties?: Record<string, BotDifficulty>;
      teamMeta?: TeamMetaMap;
    }
  | {
      type: 'start_match';
    }
  | {
      type: 'start_next_tournament_match';
    }
  | {
      type: 'advance_tournament';
    }
  | {
      type: 'reset_tournament';
    }
  | {
      type: 'start_next_league_match';
    }
  | {
      type: 'advance_league';
    }
  | {
      type: 'reset_league';
    }
  | {
      type: 'rematch';
    }
  | {
      type: 'input';
      input: PlayerInput;
    }
  | {
      type: 'send_emoji';
      emoji: string;
    }
  | {
      type: 'set_tactic';
      preset: FormationPreset;
    }
  | {
      type: 'ping';
      t: number;
    };

// Server -> Client WebSocket messages
export type ServerWsMessage =
  | {
      type: 'welcome';
      clientId: string;
    }
  | {
      type: 'room_state';
      room: RoomStateInfo;
    }
  | {
      type: 'snapshot';
      snapshot: GameSnapshot;
    }
  | {
      type: 'chat_message';
      message: LobbyChatMessage;
    }
  | {
      type: 'match_entry_fee';
      amount: number;
    }
  | {
      type: 'kicked';
      reason: string;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'pong';
      t: number;
    };
