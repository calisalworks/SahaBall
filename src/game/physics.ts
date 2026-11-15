import { DEFAULT_TEAM_META, getPitchConfig, MODE_CONFIGS } from './types.ts';
import type {
  ActiveTeam,
  BallEntity,
  BotDifficulty,
  FormationPreset,
  FormationSpot,
  GameMode,
  GameSnapshot,
  GoalEvent,
  MatchPhase,
  MatchSummaryStats,
  PhysicsSoundEvent,
  PitchConfig,
  PitchSize,
  PlayerEntity,
  PlayerInput,
  PlayerRole,
  TeamMetaMap,
} from './types.ts';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
const SIM_SCALE = 0.35;
const SIM_DT = DT * SIM_SCALE;

const BOT_NAMES_RED = ['Emre', 'Kaan', 'Mert', 'Arda', 'Yusuf', 'Kerem'];
const BOT_NAMES_BLUE = ['Can', 'Burak', 'Deniz', 'Ege', 'Tuna', 'Bora'];

const POST_RADIUS = 7;
const PLAYER_MASS = 2.4;
const BALL_MASS = 1.0;
const PLAYER_DAMPING = Math.pow(0.865, SIM_SCALE);
const BALL_DAMPING = Math.pow(0.978, SIM_SCALE);
const SLOW_BALL_DAMPING = Math.pow(0.935, SIM_SCALE);
const NORMAL_ACCEL = 3450;
const SPRINT_ACCEL = 5100;
const KICK_REACH = 7.5;
const KICK_STRENGTH = 925;
const KICK_COOLDOWN_TICKS = 5;
const KICK_BUFFER_TICKS = 5;
const WALL_REBOUND_WINDOW_TICKS = 16;

interface BotDifficultyProfile {
  reactionTicks: number;
  pace: number;
  lookaheadSec: number;
  aimJitterRad: number;
  passTendency: number;
  sprintStaminaMin: number;
  formationLoyalty: number;
  useIntercept: boolean;
  useCornerAnalysis: boolean;
  gkPredictShot: boolean;
  smartDribble: boolean;
}

const BOT_PROFILES: Record<BotDifficulty, BotDifficultyProfile> = {
  kolay: {
    reactionTicks: 10,
    pace: 0.68,
    lookaheadSec: 0,
    aimJitterRad: 0.26,
    passTendency: 0.5,
    sprintStaminaMin: 74,
    formationLoyalty: 0.44,
    useIntercept: false,
    useCornerAnalysis: false,
    gkPredictShot: false,
    smartDribble: false,
  },
  normal: {
    reactionTicks: 5,
    pace: 0.85,
    lookaheadSec: 0.14,
    aimJitterRad: 0.1,
    passTendency: 0.82,
    sprintStaminaMin: 48,
    formationLoyalty: 0.56,
    useIntercept: false,
    useCornerAnalysis: true,
    gkPredictShot: false,
    smartDribble: false,
  },
  zor: {
    reactionTicks: 2,
    pace: 0.95,
    lookaheadSec: 0.28,
    aimJitterRad: 0.035,
    passTendency: 0.94,
    sprintStaminaMin: 32,
    formationLoyalty: 0.64,
    useIntercept: true,
    useCornerAnalysis: true,
    gkPredictShot: true,
    smartDribble: false,
  },
  efsanevi: {
    reactionTicks: 1,
    pace: 1.0,
    lookaheadSec: 0.52,
    aimJitterRad: 0,
    passTendency: 1.0,
    sprintStaminaMin: 22,
    formationLoyalty: 0.68,
    useIntercept: true,
    useCornerAnalysis: true,
    gkPredictShot: true,
    smartDribble: true,
  },
};

export interface MatchParticipantSpec {
  id: string;
  name: string;
  team: ActiveTeam;
  role?: PlayerRole;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
}

export interface TeamBotCounts {
  red: number;
  blue: number;
}

interface PlayerTendencyState {
  shotCount: number;
  passCount: number;
  preferredCornerYNorm: number; // EMA of shot target Y normalized by goalHalfHeight (-1..+1)
}

interface PredictedOpponentThreat {
  carrier: PlayerEntity;
  carrierDist: number;
  intent: 'shot' | 'pass' | 'dribble';
  confidence: number;
  predictedShotY: number;
  likelyPassTarget: PlayerEntity | null;
  likelyPassAimX: number;
  likelyPassAimY: number;
}

export class MatchEngine {
  public mode: GameMode;
  public pitchSize: PitchSize;
  public config: PitchConfig;
  public durationSec: number;
  public timeLeftSec: number;
  public phase: MatchPhase = 'countdown';
  public phaseTimerSec = 2.0;
  public tickCount = 0;
  public redScore = 0;
  public blueScore = 0;

  public players: PlayerEntity[] = [];
  public ball: BallEntity;
  public inputs: Map<string, PlayerInput> = new Map();
  private prevKickState: Map<string, boolean> = new Map();
  private kickBufferTicks: Map<string, number> = new Map();
  private sprintExhausted: Map<string, boolean> = new Map();
  private playerTendencies: Map<string, PlayerTendencyState> = new Map();
  private lastWallOrPostBounceTick = -1000;
  public allowDraw: boolean;

  public teamFormations: Record<ActiveTeam, FormationPreset> = {
    red: 'dengeli',
    blue: 'dengeli',
  };
  public teamMeta: TeamMetaMap;
  private customStartSpots: Map<string, { normDepth: number; normY: number }> = new Map();
  private activeEmojis: Map<string, { emoji: string; expiresAtTick: number }> = new Map();
  private events: PhysicsSoundEvent[] = [];
  private goalBanner: GameSnapshot['goalBanner'] = null;
  private goals: GoalEvent[] = [];
  private redPossessionTicks = 0;
  private bluePossessionTicks = 0;
  private lastTouchTimestampTick = 0;
  private totalPlayingTicks = 0;
  private summary: MatchSummaryStats | null = null;
  private kickoffTeam: ActiveTeam = 'red';
  private kickoffWaitingTouch = true;
  private kickoffSafetyTicks = 0;

  constructor(
    mode: GameMode,
    durationSec: number,
    participants: MatchParticipantSpec[],
    pitchSize: PitchSize = 'normal',
    allowDraw = false,
    teamMeta?: TeamMetaMap
  ) {
    this.mode = mode;
    this.pitchSize = pitchSize;
    this.allowDraw = allowDraw;
    this.teamMeta = teamMeta
      ? {
          red: { ...teamMeta.red },
          blue: { ...teamMeta.blue },
        }
      : {
          red: { ...DEFAULT_TEAM_META.red },
          blue: { ...DEFAULT_TEAM_META.blue },
        };
    this.config = getPitchConfig(mode, pitchSize);
    this.durationSec = durationSec;
    this.timeLeftSec = durationSec;

    this.ball = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: this.config.ballRadius,
      angle: 0,
      lastTouchId: null,
      lastTouchTeam: null,
      prevTouchId: null,
      prevTouchTeam: null,
      isShotOnTargetFor: null,
    };

    this.initPlayers(participants);
    this.resetPositions();
  }

  private initPlayers(participants: MatchParticipantSpec[]): void {
    this.players = participants.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role ?? 'ortasaha',
      isBot: p.isBot,
      botDifficulty: p.isBot ? (p.botDifficulty ?? 'normal') : undefined,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: this.config.playerRadius,
      stamina: 100,
      isSprinting: false,
      kickAnim: 0,
      kickCooldown: 0,
      facingX: p.team === 'red' ? 1 : -1,
      facingY: 0,
      stats: {
        goals: 0,
        assists: 0,
        passes: 0,
        shots: 0,
        shotsOnTarget: 0,
        touches: 0,
        saves: 0,
        sprintTicks: 0,
        distancePx: 0,
      },
    }));
  }

  public static buildParticipantsWithBots(
    mode: GameMode,
    humanPlayers: MatchParticipantSpec[],
    fillBots: boolean,
    defaultBotDifficulty: BotDifficulty = 'normal',
    botDifficulties: Record<string, BotDifficulty> = {},
    teamBotCounts?: TeamBotCounts | null
  ): MatchParticipantSpec[] {
    const teamSize = MODE_CONFIGS[mode].teamSize;
    const roleTemplates: Record<number, PlayerRole[]> = {
      1: ['forvet'],
      2: ['forvet', 'defans'],
      3: ['kaleci', 'defans', 'forvet'],
      4: ['kaleci', 'defans', 'ortasaha', 'forvet'],
      5: ['kaleci', 'defans', 'defans', 'ortasaha', 'forvet'],
    };

    const assignRemainingRoles = (humans: MatchParticipantSpec[], count: number): PlayerRole[] => {
      const pool = [...(roleTemplates[count] ?? roleTemplates[5])];
      for (const h of humans) {
        const chosen = h.role ?? 'ortasaha';
        const matchIdx = pool.indexOf(chosen);
        if (matchIdx >= 0) {
          pool.splice(matchIdx, 1);
        } else if (pool.length > 0) {
          pool.shift();
        }
      }
      return pool;
    };

    const redHumans = humanPlayers
      .filter((p) => p.team === 'red')
      .slice(0, teamSize)
      .map((p) => ({ ...p, role: p.role ?? 'forvet' }));
    const blueHumans = humanPlayers
      .filter((p) => p.team === 'blue')
      .slice(0, teamSize)
      .map((p) => ({ ...p, role: p.role ?? 'forvet' }));
    const result: MatchParticipantSpec[] = [...redHumans, ...blueHumans];

    const redSlotsFree = Math.max(0, teamSize - redHumans.length);
    const blueSlotsFree = Math.max(0, teamSize - blueHumans.length);
    const redBotsToAdd = teamBotCounts
      ? Math.max(0, Math.min(redSlotsFree, Math.floor(teamBotCounts.red)))
      : fillBots
        ? redSlotsFree
        : 0;
    const blueBotsToAdd = teamBotCounts
      ? Math.max(0, Math.min(blueSlotsFree, Math.floor(teamBotCounts.blue)))
      : fillBots
        ? blueSlotsFree
        : 0;

    if (redBotsToAdd > 0) {
      const redPool = assignRemainingRoles(redHumans, teamSize);
      for (let idx = 0; idx < redBotsToAdd; idx++) {
        const slotNum = redHumans.length + idx;
        const botId = `bot_red_${slotNum}`;
        const botName = `${BOT_NAMES_RED[idx % BOT_NAMES_RED.length]} (Bot)`;
        result.push({
          id: botId,
          name: botName,
          team: 'red',
          role: redPool.shift() ?? 'ortasaha',
          isBot: true,
          botDifficulty: botDifficulties[botId] ?? defaultBotDifficulty,
        });
      }
    }

    if (blueBotsToAdd > 0) {
      const bluePool = assignRemainingRoles(blueHumans, teamSize);
      for (let idx = 0; idx < blueBotsToAdd; idx++) {
        const slotNum = blueHumans.length + idx;
        const botId = `bot_blue_${slotNum}`;
        const botName = `${BOT_NAMES_BLUE[idx % BOT_NAMES_BLUE.length]} (Bot)`;
        result.push({
          id: botId,
          name: botName,
          team: 'blue',
          role: bluePool.shift() ?? 'ortasaha',
          isBot: true,
          botDifficulty: botDifficulties[botId] ?? defaultBotDifficulty,
        });
      }
    }
    return result;
  }

  public static getPresetSpots(
    teamPlayers: Array<{ id: string; role?: PlayerRole }>,
    preset: FormationPreset
  ): FormationSpot[] {
    const roleOrder: Record<PlayerRole, number> = {
      forvet: 0,
      ortasaha: 1,
      defans: 2,
      kaleci: 3,
    };
    const sorted = [...teamPlayers].sort(
      (a, b) => roleOrder[a.role ?? 'ortasaha'] - roleOrder[b.role ?? 'ortasaha']
    );
    const count = sorted.length;
    if (count === 0) return [];

    const depthByPresetAndRole: Record<FormationPreset, Record<PlayerRole, number>> = {
      defansif: { kaleci: 0.14, defans: 0.36, ortasaha: 0.56, forvet: 0.74 },
      dengeli: { kaleci: 0.22, defans: 0.52, ortasaha: 0.76, forvet: 0.94 },
      ofansif: { kaleci: 0.34, defans: 0.72, ortasaha: 0.88, forvet: 0.98 },
    };

    const ySpread = count === 1 ? 0 : Math.min(0.78, (count - 1) * 0.22);

    return sorted.map((p, idx) => {
      const role = p.role ?? 'ortasaha';
      const normDepth = depthByPresetAndRole[preset][role];
      const normY = count === 1 ? 0 : -ySpread + (2 * ySpread * idx) / (count - 1);
      return {
        playerId: p.id,
        normDepth,
        normY,
      };
    });
  }

  private spotToWorld(dir: 1 | -1, normDepth: number, normY: number): { x: number; y: number } {
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const centerR = Math.min(84, halfH * 0.34);
    const minOutsideCircleX = centerR + this.config.playerRadius + 14;
    const goalEdgeX = halfW - this.config.playerRadius - 24;

    const clampedDepth = Math.max(0.05, Math.min(1, normDepth));
    const clampedY = Math.max(-0.88, Math.min(0.88, normY));

    const distFromCenter =
      goalEdgeX - clampedDepth * Math.max(40, goalEdgeX - minOutsideCircleX);
    let wx = dir * distFromCenter;
    let wy = clampedY * (halfH - this.config.playerRadius - 14);

    // Strictly keep outside center circle
    if (Math.hypot(wx, wy) < minOutsideCircleX) {
      wx = dir * minOutsideCircleX;
    }
    return { x: wx, y: wy };
  }

  public setTeamFormation(
    team: ActiveTeam,
    preset: FormationPreset,
    spots?: FormationSpot[],
    applyNow = false
  ): void {
    this.teamFormations[team] = preset;
    if (spots) {
      for (const s of spots) {
        this.customStartSpots.set(s.playerId, {
          normDepth: Math.max(0.05, Math.min(1, s.normDepth)),
          normY: Math.max(-0.88, Math.min(0.88, s.normY)),
        });
      }
    } else {
      for (const p of this.players) {
        if (p.team === team) {
          this.customStartSpots.delete(p.id);
        }
      }
    }

    if (applyNow && this.phase !== 'finished' && this.phase !== 'goal') {
      const dir: 1 | -1 = team === 'red' ? -1 : 1;
      const teamPlayers = this.players.filter((p) => p.team === team);
      const fallbackSpots = MatchEngine.getPresetSpots(teamPlayers, preset);
      for (const p of teamPlayers) {
        const custom = this.customStartSpots.get(p.id);
        const fb = fallbackSpots.find((s) => s.playerId === p.id);
        const normDepth = custom?.normDepth ?? fb?.normDepth ?? 0.8;
        const normY = custom?.normY ?? fb?.normY ?? 0;
        const pos = this.spotToWorld(dir, normDepth, normY);
        p.x = pos.x;
        p.y = pos.y;
        p.vx = 0;
        p.vy = 0;
      }
    }
  }

  public getTeamFormationSpots(team: ActiveTeam): FormationSpot[] {
    const teamPlayers = this.players.filter((p) => p.team === team);
    const presetSpots = MatchEngine.getPresetSpots(teamPlayers, this.teamFormations[team]);
    return presetSpots.map((fb) => {
      const custom = this.customStartSpots.get(fb.playerId);
      return custom ? { playerId: fb.playerId, ...custom } : fb;
    });
  }

  private getCenterCircleRadius(): number {
    return Math.min(84, (this.config.height / 2) * 0.34);
  }

  private enforceKickoffZoneConstraint(p: PlayerEntity, centerR: number): void {
    const ownDir: 1 | -1 = p.team === 'red' ? -1 : 1;
    const halfWallX = ownDir * p.radius;

    if (p.team === 'red' && p.x > halfWallX) {
      p.x = halfWallX;
      if (p.vx > 0) p.vx = 0;
    } else if (p.team === 'blue' && p.x < halfWallX) {
      p.x = halfWallX;
      if (p.vx < 0) p.vx = 0;
    }

    const minCircleDist = centerR + p.radius;
    const dist = Math.hypot(p.x, p.y);
    if (dist < minCircleDist) {
      let nx: number;
      let ny: number;
      if (dist > 0.001) {
        nx = p.x / dist;
        ny = p.y / dist;
      } else {
        nx = ownDir;
        ny = 0;
      }
      p.x = nx * minCircleDist;
      p.y = ny * minCircleDist;
      const vn = p.vx * nx + p.vy * ny;
      if (vn < 0) {
        p.vx -= vn * nx;
        p.vy -= vn * ny;
      }

      // If radial push crossed the halfway wall near circle poles, clamp to own half while keeping outside circle
      if ((p.team === 'red' && p.x > halfWallX) || (p.team === 'blue' && p.x < halfWallX)) {
        p.x = halfWallX;
        if ((p.team === 'red' && p.vx > 0) || (p.team === 'blue' && p.vx < 0)) {
          p.vx = 0;
        }
        const minY = Math.sqrt(Math.max(0, minCircleDist * minCircleDist - p.x * p.x));
        const sy = p.y >= 0 ? 1 : -1;
        if (Math.abs(p.y) < minY) {
          p.y = sy * minY;
          if (p.vy * sy < 0) p.vy = 0;
        }
      }
    }
  }

  public resetPositions(): void {
    this.ball.x = 0;
    this.ball.y = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.lastTouchId = null;
    this.ball.lastTouchTeam = null;
    this.ball.prevTouchId = null;
    this.ball.prevTouchTeam = null;
    this.ball.isShotOnTargetFor = null;
    this.kickoffWaitingTouch = true;
    this.kickoffSafetyTicks = Math.round(TICK_RATE * 5.0);

    const centerR = this.getCenterCircleRadius();

    const placeTeam = (team: ActiveTeam, dir: 1 | -1) => {
      const teamPlayers = this.players.filter((p) => p.team === team);
      const preset = this.teamFormations[team];
      const presetSpots = MatchEngine.getPresetSpots(teamPlayers, preset);
      const halfH = this.config.height / 2;
      const isKickoffTeam = team === this.kickoffTeam;
      const minOutsideCircleX = centerR + this.config.playerRadius + (isKickoffTeam ? 10 : 24);
      const roleOffsetX: Record<PlayerRole, number> = {
        forvet: minOutsideCircleX,
        ortasaha: minOutsideCircleX + 14,
        defans: minOutsideCircleX + 28,
        kaleci: minOutsideCircleX + 42,
      };
      const spread = Math.min(halfH * 1.25, Math.max(0, teamPlayers.length - 1) * 76);

      teamPlayers.forEach((p, idx) => {
        const role = p.role ?? 'ortasaha';
        p.vx = 0;
        p.vy = 0;
        p.stamina = 100;
        p.isSprinting = false;
        p.kickAnim = 0;
        p.kickCooldown = 0;
        p.facingX = -dir;
        p.facingY = 0;

        const custom = this.customStartSpots.get(p.id);
        if (custom) {
          const pos = this.spotToWorld(dir, custom.normDepth, custom.normY);
          p.x = pos.x;
          p.y = pos.y;
        } else if (preset !== 'dengeli') {
          const fb = presetSpots.find((s) => s.playerId === p.id);
          const pos = this.spotToWorld(dir, fb?.normDepth ?? 0.85, fb?.normY ?? 0);
          p.x = pos.x;
          p.y = pos.y;
        } else {
          // Default balanced midfield band strictly OUTSIDE the center circle
          p.x = dir * roleOffsetX[role];
          p.y = teamPlayers.length === 1 ? 0 : -spread / 2 + (spread * idx) / (teamPlayers.length - 1);
        }

        this.enforceKickoffZoneConstraint(p, centerR);
      });
    };

    placeTeam('red', -1);
    placeTeam('blue', 1);
  }

  public setPlayerInput(playerId: string, input: PlayerInput): void {
    const mag = Math.hypot(input.dx, input.dy);
    const clampedDx = mag > 1 ? input.dx / mag : input.dx;
    const clampedDy = mag > 1 ? input.dy / mag : input.dy;
    this.inputs.set(playerId, {
      seq: input.seq,
      dx: Number.isFinite(clampedDx) ? clampedDx : 0,
      dy: Number.isFinite(clampedDy) ? clampedDy : 0,
      kick: Boolean(input.kick),
      sprint: Boolean(input.sprint),
    });
  }

  public triggerEmoji(playerId: string, emoji: string): void {
    const clean = emoji.trim().slice(0, 24);
    if (!clean) return;
    if (!this.players.some((p) => p.id === playerId)) return;
    const durationSec = clean.length > 2 ? 3.0 : 2.5;
    this.activeEmojis.set(playerId, {
      emoji: clean,
      expiresAtTick: this.tickCount + Math.round(TICK_RATE * durationSec),
    });
  }

  public step(): void {
    this.tickCount++;
    this.events = [];

    // Expire active player emojis cleanly after 2.5 seconds
    for (const [pid, entry] of this.activeEmojis.entries()) {
      if (this.tickCount >= entry.expiresAtTick) {
        this.activeEmojis.delete(pid);
      }
    }

    if (this.phase === 'finished') {
      return;
    }

    if (this.phase === 'countdown') {
      this.stepCountdownPhysics();
      this.phaseTimerSec -= DT;
      if (this.phaseTimerSec <= 0) {
        this.phase =
          this.timeLeftSec <= 0 && !this.allowDraw && this.redScore === this.blueScore
            ? 'overtime'
            : 'playing';
        this.phaseTimerSec = 0;
        this.kickoffWaitingTouch = true;
        this.kickoffSafetyTicks = Math.round(TICK_RATE * 5.0);
        this.events.push('whistle');
      }
      return;
    }

    if (this.phase === 'goal') {
      this.stepPhysics(false);
      this.phaseTimerSec -= DT;
      if (this.phaseTimerSec <= 0) {
        this.goalBanner = null;
        if (this.timeLeftSec <= 0 && (this.redScore !== this.blueScore || this.allowDraw)) {
          this.finishMatch();
        } else {
          this.resetPositions();
          this.phase = 'countdown';
          this.phaseTimerSec = 2.0;
        }
      }
      return;
    }

    // Active gameplay ('playing' or 'overtime')
    this.totalPlayingTicks++;
    if (this.kickoffWaitingTouch) {
      this.kickoffSafetyTicks--;
      if (
        this.kickoffSafetyTicks <= 0 ||
        Math.hypot(this.ball.x, this.ball.y) > this.getCenterCircleRadius() * 0.55
      ) {
        this.kickoffWaitingTouch = false;
      }
    }

    if (this.phase === 'playing') {
      const prevCeil = Math.ceil(this.timeLeftSec);
      this.timeLeftSec = Math.max(0, this.timeLeftSec - DT);
      const nextCeil = Math.ceil(this.timeLeftSec);
      if (nextCeil < prevCeil && nextCeil >= 1 && nextCeil <= 10) {
        this.events.push('countdown_tick');
      }
      if (this.timeLeftSec <= 0) {
        if (this.redScore === this.blueScore && !this.allowDraw) {
          this.phase = 'overtime';
          this.events.push('whistle');
        } else {
          this.finishMatch();
          return;
        }
      }
    }

    this.stepPhysics(true);
  }

  private finishMatch(): void {
    this.phase = 'finished';
    this.events.push('whistle');
    const totalPoss = Math.max(1, this.redPossessionTicks + this.bluePossessionTicks);
    const redPossPct = Math.round((this.redPossessionTicks / totalPoss) * 100);
    const bluePossPct = 100 - redPossPct;

    const sumTeam = (team: ActiveTeam, key: keyof PlayerEntity['stats']) =>
      this.players
        .filter((p) => p.team === team)
        .reduce((acc, p) => acc + p.stats[key], 0);

    this.summary = {
      redScore: this.redScore,
      blueScore: this.blueScore,
      winner: this.redScore > this.blueScore ? 'red' : this.blueScore > this.redScore ? 'blue' : 'draw',
      durationPlayedSec: Math.round(this.totalPlayingTicks / TICK_RATE),
      redPossessionPct: redPossPct,
      bluePossessionPct: bluePossPct,
      redShots: sumTeam('red', 'shots'),
      blueShots: sumTeam('blue', 'shots'),
      redShotsOnTarget: sumTeam('red', 'shotsOnTarget'),
      blueShotsOnTarget: sumTeam('blue', 'shotsOnTarget'),
      redPasses: sumTeam('red', 'passes'),
      bluePasses: sumTeam('blue', 'passes'),
      redTouches: sumTeam('red', 'touches'),
      blueTouches: sumTeam('blue', 'touches'),
      redSaves: sumTeam('red', 'saves'),
      blueSaves: sumTeam('blue', 'saves'),
      goals: [...this.goals],
      playerRows: this.players
        .map((p) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          isBot: p.isBot,
          goals: p.stats.goals,
          assists: p.stats.assists,
          passes: p.stats.passes,
          shots: p.stats.shots,
          shotsOnTarget: p.stats.shotsOnTarget,
          touches: p.stats.touches,
          saves: p.stats.saves,
          sprintSec: Math.round((p.stats.sprintTicks / TICK_RATE) * 10) / 10,
          distanceMeters: Math.round(p.stats.distancePx * 0.085),
        }))
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.passes - a.passes || b.touches - a.touches),
    };
  }

  private updateCountdownBots(): void {
    const centerR = this.getCenterCircleRadius();
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;

    const assignTeam = (team: ActiveTeam) => {
      const teamPlayers = this.players.filter((p) => p.team === team);
      const bots = teamPlayers.filter((p) => p.isBot);
      if (bots.length === 0) return;

      const ownDir: 1 | -1 = team === 'red' ? -1 : 1;
      const isKickoffTeam = team === this.kickoffTeam;
      const takerBot = isKickoffTeam
        ? bots.find((b) => b.role === 'forvet') ??
          bots.find((b) => b.role !== 'kaleci') ??
          bots[0]
        : null;

      const presetSpots = MatchEngine.getPresetSpots(teamPlayers, this.teamFormations[team]);
      const spotMap = new Map<string, { normDepth: number; normY: number }>();
      for (const s of presetSpots) {
        spotMap.set(s.playerId, this.customStartSpots.get(s.playerId) ?? s);
      }

      for (const bot of bots) {
        let tx = bot.x;
        let ty = bot.y;

        if (takerBot && bot.id === takerBot.id) {
          tx = ownDir * (centerR + bot.radius + 10);
          ty = 0;
        } else if (bot.role === 'kaleci') {
          tx = ownDir * (halfW - 56);
          ty = 0;
        } else {
          const sp = spotMap.get(bot.id);
          if (sp) {
            const world = this.spotToWorld(ownDir, Math.min(0.85, sp.normDepth), sp.normY);
            tx = world.x;
            ty = world.y;
          }
        }

        tx = Math.max(-halfW + 24, Math.min(halfW - 24, tx));
        ty = Math.max(-halfH + 22, Math.min(halfH - 22, ty));
        const dx = tx - bot.x;
        const dy = ty - bot.y;
        const d = Math.hypot(dx, dy);
        const speedScale = d > 16 ? (BOT_PROFILES[bot.botDifficulty ?? 'normal'].pace * 0.85) : 0;

        this.inputs.set(bot.id, {
          seq: this.tickCount,
          dx: d > 16 ? (dx / d) * speedScale : 0,
          dy: d > 16 ? (dy / d) * speedScale : 0,
          kick: false,
          sprint: false,
        });
      }
    };

    assignTeam('red');
    assignTeam('blue');
  }

  private stepCountdownPhysics(): void {
    const centerR = this.getCenterCircleRadius();

    // Update bots smoothly into pre-kickoff spots outside the center circle
    this.updateCountdownBots();

    // Allow players to move and position themselves before kickoff without draining stamina
    for (const p of this.players) {
      const inp = this.inputs.get(p.id) ?? { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
      const moveMag = Math.hypot(inp.dx, inp.dy);
      const isMoving = moveMag > 0.05;

      p.stamina = 100;
      this.sprintExhausted.set(p.id, false);
      p.isSprinting = inp.sprint && isMoving;
      const accel = p.isSprinting ? SPRINT_ACCEL : NORMAL_ACCEL;

      p.vx += inp.dx * accel * SIM_DT;
      p.vy += inp.dy * accel * SIM_DT;

      if (isMoving) {
        p.facingX = inp.dx / moveMag;
        p.facingY = inp.dy / moveMag;
      }

      p.vx *= PLAYER_DAMPING;
      p.vy *= PLAYER_DAMPING;

      p.x += p.vx * SIM_DT;
      p.y += p.vy * SIM_DT;

      p.kickAnim = 0;
      p.kickCooldown = 0;
      this.kickBufferTicks.set(p.id, 0);
      this.prevKickState.set(p.id, Boolean(inp.kick));
    }

    // Player-Player collisions
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        this.resolveCircleCollision(this.players[i], this.players[j], PLAYER_MASS, PLAYER_MASS, 0.45);
      }
    }

    this.resolveGoalposts();
    this.resolvePitchBounds();

    // Keep ALL players strictly in own half and outside center circle until kickoff whistle
    for (const p of this.players) {
      this.enforceKickoffZoneConstraint(p, centerR);
    }

    // Keep ball locked stationary at the center spot
    this.ball.x = 0;
    this.ball.y = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  private stepPhysics(allowScoring: boolean): void {
    const centerR = this.getCenterCircleRadius();

    // Track per-tick distance covered during active play
    const prevPositions = allowScoring
      ? this.players.map((p) => ({ x: p.x, y: p.y }))
      : null;

    // 1. Update Bot Inputs
    this.updateAllBots();

    // 2. Apply Player Inputs, Stamina & Movement
    for (const p of this.players) {
      const inp = this.inputs.get(p.id) ?? { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
      const moveMag = Math.hypot(inp.dx, inp.dy);
      const isMoving = moveMag > 0.05;

      const exhausted = this.sprintExhausted.get(p.id) ?? false;
      const canSprint = !exhausted && p.stamina > 0.5;
      const wantsSprint = inp.sprint && isMoving;

      if (wantsSprint && canSprint) {
        p.isSprinting = true;
        p.stamina = Math.max(0, p.stamina - 45 * DT);
        p.stats.sprintTicks++;
        if (p.stamina <= 0.1) {
          this.sprintExhausted.set(p.id, true);
          p.isSprinting = false;
        }
      } else {
        p.isSprinting = false;
        p.stamina = Math.min(100, p.stamina + 24 * DT);
        if (exhausted && p.stamina >= 15) {
          this.sprintExhausted.set(p.id, false);
        }
      }

      const accel = p.isSprinting ? SPRINT_ACCEL : NORMAL_ACCEL;
      p.vx += inp.dx * accel * SIM_DT;
      p.vy += inp.dy * accel * SIM_DT;

      if (isMoving) {
        p.facingX = inp.dx / moveMag;
        p.facingY = inp.dy / moveMag;
      }

      p.vx *= PLAYER_DAMPING;
      p.vy *= PLAYER_DAMPING;

      p.x += p.vx * SIM_DT;
      p.y += p.vy * SIM_DT;

      if (p.kickAnim > 0) {
        p.kickAnim = Math.max(0, p.kickAnim - DT * 4.5);
      }
      if (p.kickCooldown > 0) {
        p.kickCooldown--;
      }
    }

    // 3. Player-Player Collisions
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        this.resolveCircleCollision(this.players[i], this.players[j], PLAYER_MASS, PLAYER_MASS, 0.45);
      }
    }

    // Keep non-kickoff team outside center circle & in own half until kickoffTeam touches the ball
    if (allowScoring && this.kickoffWaitingTouch) {
      for (const p of this.players) {
        if (p.team !== this.kickoffTeam) {
          this.enforceKickoffZoneConstraint(p, centerR);
        }
      }
    }

    // 4. Buffered Kick Evaluation BEFORE Passive Dribble Collision (for crisp precision + wall-rebound volleys)
    const kickedThisTick = new Set<string>();
    const recentWallRebound =
      this.tickCount - this.lastWallOrPostBounceTick <= WALL_REBOUND_WINDOW_TICKS;

    for (const p of this.players) {
      const inp = this.inputs.get(p.id) ?? { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
      const wasKick = this.prevKickState.get(p.id) ?? false;
      const kickTriggered = inp.kick && !wasKick;
      this.prevKickState.set(p.id, inp.kick);

      let buf = this.kickBufferTicks.get(p.id) ?? 0;
      if (kickTriggered) {
        buf = KICK_BUFFER_TICKS;
        p.kickAnim = 1;
      } else if (inp.kick) {
        buf = Math.max(1, buf - 1);
      } else if (buf > 0) {
        buf--;
      }
      this.kickBufferTicks.set(p.id, buf);

      const canTouchAtKickoff = !this.kickoffWaitingTouch || p.team === this.kickoffTeam;
      const canRapidReboundKick = recentWallRebound && p.kickCooldown <= 3;
      if (buf > 0 && (p.kickCooldown === 0 || canRapidReboundKick) && allowScoring && canTouchAtKickoff) {
        const distToBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
        if (distToBall <= p.radius + this.ball.radius + KICK_REACH) {
          this.performKick(p);
          this.kickBufferTicks.set(p.id, 0);
          kickedThisTick.add(p.id);
        }
      }
    }

    // 4b. Passive Player-Ball Collisions (very low restitution so ball doesn't bounce away on touch)
    for (const p of this.players) {
      if (kickedThisTick.has(p.id)) continue;
      if (allowScoring && this.kickoffWaitingTouch && p.team !== this.kickoffTeam) continue;
      const hit = this.resolveCircleCollision(p, this.ball, PLAYER_MASS, BALL_MASS, 0.02);
      if (hit) {
        this.recordBallTouch(p, false);
      }
    }

    // 5. Move Ball (apply firmer rolling friction once the ball slows down)
    this.ball.x += this.ball.vx * SIM_DT;
    this.ball.y += this.ball.vy * SIM_DT;
    const preDampSpeed = Math.hypot(this.ball.vx, this.ball.vy);
    const activeBallDamping = preDampSpeed < 235 ? SLOW_BALL_DAMPING : BALL_DAMPING;
    this.ball.vx *= activeBallDamping;
    this.ball.vy *= activeBallDamping;

    const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy);
    if (ballSpeed < 12) {
      this.ball.vx = 0;
      this.ball.vy = 0;
    } else {
      this.ball.angle += (ballSpeed * SIM_DT) / this.ball.radius;
    }

    // Possession tracking
    if (allowScoring && this.ball.lastTouchTeam) {
      if (this.ball.lastTouchTeam === 'red') {
        this.redPossessionTicks++;
      } else {
        this.bluePossessionTicks++;
      }
    }

    // 6. Goalpost & Pitch Wall Collisions
    this.resolveGoalposts();
    this.resolvePitchBounds();

    if (allowScoring && this.kickoffWaitingTouch) {
      for (const p of this.players) {
        if (p.team !== this.kickoffTeam) {
          this.enforceKickoffZoneConstraint(p, centerR);
        }
      }
    }

    if (prevPositions) {
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        const prev = prevPositions[i];
        const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (dist < 60) {
          p.stats.distancePx += dist;
        }
      }
    }

    // 7. Check Goal Scored
    if (allowScoring) {
      this.checkGoals();
    }
  }

  private performKick(player: PlayerEntity): void {
    player.kickAnim = 1;
    player.kickCooldown = KICK_COOLDOWN_TICKS;

    let cnx = this.ball.x - player.x;
    let cny = this.ball.y - player.y;
    const dist = Math.hypot(cnx, cny);
    if (dist > 0.001) {
      cnx /= dist;
      cny /= dist;
    } else {
      cnx = player.facingX;
      cny = player.facingY;
    }

    let nx = cnx;
    let ny = cny;

    // Angled kick using player facing/aim direction and lateral ball offset
    const inp = this.inputs.get(player.id);
    const aimX = inp ? inp.dx : 0;
    const aimY = inp ? inp.dy : 0;
    const aimLen = Math.hypot(aimX, aimY);
    const fx = aimLen > 0.12 ? aimX / aimLen : player.facingX;
    const fy = aimLen > 0.12 ? aimY / aimLen : player.facingY;
    const dot = fx * cnx + fy * cny;
    if (dot > -0.25) {
      const bx = fx * 0.58 + cnx * 0.42;
      const by = fy * 0.58 + cny * 0.42;
      const bLen = Math.hypot(bx, by) || 1;
      const ubx = bx / bLen;
      const uby = by / bLen;
      const cross = fx * cny - fy * cnx;
      const angleBias = Math.max(-0.22, Math.min(0.22, cross * 0.28));
      const cosA = Math.cos(angleBias);
      const sinA = Math.sin(angleBias);
      nx = ubx * cosA - uby * sinA;
      ny = ubx * sinA + uby * cosA;
    }

    // Check if clearing a shot on target (save!)
    const defendingTeam: ActiveTeam = player.team;
    const attackingTeam: ActiveTeam = defendingTeam === 'red' ? 'blue' : 'red';
    if (this.ball.isShotOnTargetFor === attackingTeam) {
      const halfW = this.config.width / 2;
      const nearOwnGoal =
        (defendingTeam === 'red' && player.x < -halfW * 0.45) ||
        (defendingTeam === 'blue' && player.x > halfW * 0.45);
      if (nearOwnGoal) {
        player.stats.saves++;
      }
    }

    // Damp incoming rebound cross-velocity cleanly so wall-rebound follow-up shots stay accurate
    this.ball.vx = this.ball.vx * 0.18 + nx * KICK_STRENGTH + player.vx * 0.25;
    this.ball.vy = this.ball.vy * 0.18 + ny * KICK_STRENGTH + player.vy * 0.25;

    this.recordBallTouch(player, true);
    this.events.push('kick');

    // Track ONLY kicks aimed toward the opponent's goal as Shots;
    // otherwise check if kicked near a teammate to count as a Pass.
    const towardEnemyGoalHalf =
      (player.team === 'red' && this.ball.vx > 140) ||
      (player.team === 'blue' && this.ball.vx < -140);
    let countedAsShot = false;

    if (towardEnemyGoalHalf) {
      const targetX = player.team === 'red' ? this.config.width / 2 : -this.config.width / 2;
      const dx = targetX - this.ball.x;
      const t = dx / this.ball.vx;
      if (t > 0 && t < 4.0) {
        const projectedY = this.ball.y + this.ball.vy * t;
        if (Math.abs(projectedY) <= this.config.goalHalfHeight + 22) {
          countedAsShot = true;
          player.stats.shots++;
          const tend = this.playerTendencies.get(player.id) ?? {
            shotCount: 0,
            passCount: 0,
            preferredCornerYNorm: 0,
          };
          const normCorner = Math.max(
            -1,
            Math.min(1, projectedY / Math.max(1, this.config.goalHalfHeight))
          );
          tend.shotCount++;
          tend.preferredCornerYNorm = tend.preferredCornerYNorm * 0.65 + normCorner * 0.35;
          this.playerTendencies.set(player.id, tend);

          if (Math.abs(projectedY) <= this.config.goalHalfHeight + 4) {
            player.stats.shotsOnTarget++;
            this.ball.isShotOnTargetFor = player.team;
          } else {
            this.ball.isShotOnTargetFor = null;
          }
        }
      }
    }

    if (!countedAsShot) {
      this.ball.isShotOnTargetFor = null;
      const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy) || 1;
      const kx = this.ball.vx / ballSpeed;
      const ky = this.ball.vy / ballSpeed;
      const hasNearbyTeammate = this.players.some((tm) => {
        if (tm.team !== player.team || tm.id === player.id) return false;
        const tx = tm.x - this.ball.x;
        const ty = tm.y - this.ball.y;
        const distToMate = Math.hypot(tx, ty);
        const proj = tx * kx + ty * ky;
        const perp = Math.abs(tx * -ky + ty * kx);
        return (proj > 0 && proj < 520 && perp <= 120) || distToMate <= 135;
      });
      if (hasNearbyTeammate) {
        player.stats.passes++;
        const tend = this.playerTendencies.get(player.id) ?? {
          shotCount: 0,
          passCount: 0,
          preferredCornerYNorm: 0,
        };
        tend.passCount++;
        this.playerTendencies.set(player.id, tend);
      }
    }
  }

  private recordBallTouch(player: PlayerEntity, isKick: boolean): void {
    if (this.kickoffWaitingTouch && player.team === this.kickoffTeam) {
      this.kickoffWaitingTouch = false;
    }
    player.stats.touches++;
    if (this.ball.lastTouchId !== player.id) {
      if (this.ball.lastTouchId && this.tickCount - this.lastTouchTimestampTick < TICK_RATE * 6) {
        this.ball.prevTouchId = this.ball.lastTouchId;
        this.ball.prevTouchTeam = this.ball.lastTouchTeam;
      } else {
        this.ball.prevTouchId = null;
        this.ball.prevTouchTeam = null;
      }
      this.ball.lastTouchId = player.id;
      this.ball.lastTouchTeam = player.team;
    }
    this.lastTouchTimestampTick = this.tickCount;

    if (!isKick && this.ball.isShotOnTargetFor && this.ball.isShotOnTargetFor !== player.team) {
      const halfW = this.config.width / 2;
      const nearOwnGoal =
        (player.team === 'red' && player.x < -halfW * 0.55) ||
        (player.team === 'blue' && player.x > halfW * 0.55);
      if (nearOwnGoal && Math.hypot(this.ball.vx, this.ball.vy) > 150) {
        player.stats.saves++;
        this.ball.isShotOnTargetFor = null;
      }
    }
  }

  private resolveCircleCollision(
    a: { x: number; y: number; vx: number; vy: number; radius: number },
    b: { x: number; y: number; vx: number; vy: number; radius: number },
    massA: number,
    massB: number,
    restitution: number
  ): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minDist = a.radius + b.radius;
    const distSq = dx * dx + dy * dy;

    if (distSq >= minDist * minDist) {
      return false;
    }

    const dist = Math.sqrt(distSq) || 0.001;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    const totalMass = massA + massB;
    a.x -= nx * overlap * (massB / totalMass);
    a.y -= ny * overlap * (massB / totalMass);
    b.x += nx * overlap * (massA / totalMass);
    b.y += ny * overlap * (massA / totalMass);

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal > 0) {
      return true;
    }

    const impulse = (-(1 + restitution) * velAlongNormal) / (1 / massA + 1 / massB);
    a.vx -= (impulse / massA) * nx;
    a.vy -= (impulse / massA) * ny;
    b.vx += (impulse / massB) * nx;
    b.vy += (impulse / massB) * ny;
    return true;
  }

  private resolveGoalposts(): void {
    const halfW = this.config.width / 2;
    const gh = this.config.goalHalfHeight;
    const posts = [
      { x: -halfW, y: -gh },
      { x: -halfW, y: gh },
      { x: halfW, y: -gh },
      { x: halfW, y: gh },
    ];

    for (const post of posts) {
      // Ball vs post
      const dx = this.ball.x - post.x;
      const dy = this.ball.y - post.y;
      const minDist = this.ball.radius + POST_RADIUS;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        this.ball.x = post.x + nx * minDist;
        this.ball.y = post.y + ny * minDist;
        const vn = this.ball.vx * nx + this.ball.vy * ny;
        if (vn < 0) {
          this.ball.vx -= 1.85 * vn * nx;
          this.ball.vy -= 1.85 * vn * ny;
          this.lastWallOrPostBounceTick = this.tickCount;
          if (Math.abs(vn) > 90) {
            this.events.push('post');
          }
        }
      }

      // Players vs post
      for (const p of this.players) {
        const pdx = p.x - post.x;
        const pdy = p.y - post.y;
        const pMin = p.radius + POST_RADIUS;
        const pSq = pdx * pdx + pdy * pdy;
        if (pSq < pMin * pMin) {
          const d = Math.sqrt(pSq) || 0.001;
          const nx = pdx / d;
          const ny = pdy / d;
          p.x = post.x + nx * pMin;
          p.y = post.y + ny * pMin;
          const vn = p.vx * nx + p.vy * ny;
          if (vn < 0) {
            p.vx -= 1.2 * vn * nx;
            p.vy -= 1.2 * vn * ny;
          }
        }
      }
    }
  }

  private resolvePitchBounds(): void {
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const gh = this.config.goalHalfHeight;
    const gd = this.config.goalDepth;
    const cornerR = this.config.cornerRadius;

    // Players bounds: allow stepping 1 full character size (2*r) outside pitch lines and back in
    for (const p of this.players) {
      const r = p.radius;
      const playerApron = r * 3; // center moves up to halfH + 2*r (1 full character diameter outside line)
      const xApron = Math.max(gd, playerApron);
      if (p.y - r < -halfH - playerApron) {
        p.y = -halfH - playerApron + r;
        p.vy = Math.abs(p.vy) * 0.3;
      } else if (p.y + r > halfH + playerApron) {
        p.y = halfH + playerApron - r;
        p.vy = -Math.abs(p.vy) * 0.3;
      }

      if (p.x - r < -halfW - xApron) {
        p.x = -halfW - xApron + r;
        p.vx = Math.abs(p.vx) * 0.3;
      } else if (p.x + r > halfW + xApron) {
        p.x = halfW + xApron - r;
        p.vx = -Math.abs(p.vx) * 0.3;
      }

      if (cornerR > 0) {
        const cornerStartX = halfW - cornerR;
        const cornerStartY = halfH - cornerR;
        if (Math.abs(p.x) > cornerStartX && Math.abs(p.y) > cornerStartY && Math.abs(p.x) <= halfW + playerApron) {
          const cx = Math.sign(p.x) * cornerStartX;
          const cy = Math.sign(p.y) * cornerStartY;
          const dx = p.x - cx;
          const dy = p.y - cy;
          const maxDist = cornerR + playerApron - r;
          const d = Math.hypot(dx, dy);
          if (d > maxDist && d > 0.001) {
            const nx = dx / d;
            const ny = dy / d;
            p.x = cx + nx * maxDist;
            p.y = cy + ny * maxDist;
            const vn = p.vx * nx + p.vy * ny;
            if (vn > 0) {
              p.vx -= 1.2 * vn * nx;
              p.vy -= 1.2 * vn * ny;
            }
          }
        }
      }
    }

    // Ball bounds (inside pitch + goal nets)
    const br = this.ball.radius;
    const inGoalCorridor = Math.abs(this.ball.y) < gh - br * 0.25;

    // Top / bottom pitch walls (or goal net side walls if inside goal x-range)
    if (this.ball.x < -halfW || this.ball.x > halfW) {
      // Inside goal pocket
      if (this.ball.y - br < -gh) {
        this.ball.y = -gh + br;
        this.ball.vy = Math.abs(this.ball.vy) * 0.45;
      } else if (this.ball.y + br > gh) {
        this.ball.y = gh - br;
        this.ball.vy = -Math.abs(this.ball.vy) * 0.45;
      }
      // Back net
      if (this.ball.x - br < -halfW - gd) {
        this.ball.x = -halfW - gd + br;
        this.ball.vx = Math.abs(this.ball.vx) * 0.35;
      } else if (this.ball.x + br > halfW + gd) {
        this.ball.x = halfW + gd - br;
        this.ball.vx = -Math.abs(this.ball.vx) * 0.35;
      }
    } else {
      // Ellipse / rounded-corner arc collision when cornerRadius > 0
      const cornerStartX = cornerR > 0 ? halfW - cornerR : halfW;
      const cornerStartY = cornerR > 0 ? halfH - cornerR : halfH;

      if (cornerR > 0 && Math.abs(this.ball.x) > cornerStartX && Math.abs(this.ball.y) > cornerStartY) {
        const cx = Math.sign(this.ball.x) * cornerStartX;
        const cy = Math.sign(this.ball.y) * cornerStartY;
        const dx = this.ball.x - cx;
        const dy = this.ball.y - cy;
        const maxDist = cornerR - br;
        const d = Math.hypot(dx, dy);
        if (d > maxDist && d > 0.001) {
          const nx = dx / d;
          const ny = dy / d;
          this.ball.x = cx + nx * maxDist;
          this.ball.y = cy + ny * maxDist;
          const vn = this.ball.vx * nx + this.ball.vy * ny;
          if (vn > 0) {
            this.ball.vx -= 1.82 * vn * nx;
            this.ball.vy -= 1.82 * vn * ny;
            this.lastWallOrPostBounceTick = this.tickCount;
            if (Math.abs(vn) > 65) this.events.push('wall');
          }
        }
      } else {
        // Main pitch top & bottom
        if (this.ball.y - br < -halfH) {
          this.ball.y = -halfH + br;
          this.ball.vy = Math.abs(this.ball.vy) * 0.82;
          this.lastWallOrPostBounceTick = this.tickCount;
          if (Math.abs(this.ball.vy) > 65) this.events.push('wall');
        } else if (this.ball.y + br > halfH) {
          this.ball.y = halfH - br;
          this.ball.vy = -Math.abs(this.ball.vy) * 0.82;
          this.lastWallOrPostBounceTick = this.tickCount;
          if (Math.abs(this.ball.vy) > 65) this.events.push('wall');
        }

        // Main pitch left & right walls outside goal mouth
        if (!inGoalCorridor) {
          if (this.ball.x - br < -halfW) {
            this.ball.x = -halfW + br;
            this.ball.vx = Math.abs(this.ball.vx) * 0.82;
            this.lastWallOrPostBounceTick = this.tickCount;
            if (Math.abs(this.ball.vx) > 65) this.events.push('wall');
          } else if (this.ball.x + br > halfW) {
            this.ball.x = halfW - br;
            this.ball.vx = -Math.abs(this.ball.vx) * 0.82;
            this.lastWallOrPostBounceTick = this.tickCount;
            if (Math.abs(this.ball.vx) > 65) this.events.push('wall');
          }
        }
      }
    }
  }

  private checkGoals(): void {
    const halfW = this.config.width / 2;
    const gh = this.config.goalHalfHeight;
    const br = this.ball.radius;

    if (Math.abs(this.ball.y) > gh) {
      return;
    }

    let scoringTeam: ActiveTeam | null = null;
    if (this.ball.x < -halfW - br * 0.55) {
      scoringTeam = 'blue';
    } else if (this.ball.x > halfW + br * 0.55) {
      scoringTeam = 'red';
    }

    if (!scoringTeam) return;

    if (scoringTeam === 'red') {
      this.redScore++;
    } else {
      this.blueScore++;
    }

    const lastPlayer = this.players.find((p) => p.id === this.ball.lastTouchId);
    const prevPlayer = this.players.find((p) => p.id === this.ball.prevTouchId);

    const isOwnGoal = Boolean(lastPlayer && lastPlayer.team !== scoringTeam);
    let scorerName = this.teamMeta[scoringTeam].name;
    let assistName: string | null = null;

    if (lastPlayer) {
      if (!isOwnGoal) {
        lastPlayer.stats.goals++;
        scorerName = lastPlayer.name;
        if (prevPlayer && prevPlayer.team === scoringTeam && prevPlayer.id !== lastPlayer.id) {
          prevPlayer.stats.assists++;
          assistName = prevPlayer.name;
        }
      } else {
        scorerName = `${lastPlayer.name} (KK)`;
        if (prevPlayer && prevPlayer.team === scoringTeam) {
          prevPlayer.stats.goals++;
          scorerName = prevPlayer.name;
        }
      }
    }

    this.goals.push({
      scoringTeam,
      scorerName,
      assistName,
      isOwnGoal,
      matchTimeRemaining: Math.ceil(this.timeLeftSec),
      isOvertime: this.phase === 'overtime',
    });

    this.goalBanner = {
      scoringTeam,
      scorerName,
      assistName,
      isOwnGoal,
    };
    this.events.push('goal');

    // Conceding team starts the next kickoff (santra)
    this.kickoffTeam = scoringTeam === 'red' ? 'blue' : 'red';
    this.kickoffWaitingTouch = true;

    if (this.phase === 'overtime') {
      // Golden goal ends the match after brief celebration!
      this.phase = 'goal';
      this.phaseTimerSec = 2.1;
      this.timeLeftSec = 0;
    } else {
      this.phase = 'goal';
      this.phaseTimerSec = 2.0;
    }
  }

  private updateAllBots(): void {
    this.updateTeamBots('red');
    this.updateTeamBots('blue');
  }

  private predictBallAt(horizonSec: number): { x: number; y: number; vx: number; vy: number } {
    if (horizonSec <= 0) {
      return { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy };
    }
    const steps = Math.min(36, Math.max(1, Math.round(horizonSec * TICK_RATE)));
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const br = this.ball.radius;
    const gh = this.config.goalHalfHeight;

    let bx = this.ball.x;
    let by = this.ball.y;
    let bvx = this.ball.vx;
    let bvy = this.ball.vy;

    for (let i = 0; i < steps; i++) {
      bx += bvx * SIM_DT;
      by += bvy * SIM_DT;
      const spd = Math.hypot(bvx, bvy);
      const damp = spd < 235 ? SLOW_BALL_DAMPING : BALL_DAMPING;
      bvx *= damp;
      bvy *= damp;

      if (by - br < -halfH) {
        by = -halfH + br;
        bvy = Math.abs(bvy) * 0.82;
      } else if (by + br > halfH) {
        by = halfH - br;
        bvy = -Math.abs(bvy) * 0.82;
      }
      if (Math.abs(by) >= gh - br * 0.25) {
        if (bx - br < -halfW) {
          bx = -halfW + br;
          bvx = Math.abs(bvx) * 0.82;
        } else if (bx + br > halfW) {
          bx = halfW - br;
          bvx = -Math.abs(bvx) * 0.82;
        }
      }
    }
    return { x: bx, y: by, vx: bvx, vy: bvy };
  }

  private findBallIntercept(bot: PlayerEntity, maxHorizonSec: number): { x: number; y: number } {
    const sampleTimes = [0.08, 0.16, 0.26, 0.38, maxHorizonSec];
    const botMaxSpeed = 290;
    let bestPoint = { x: this.ball.x, y: this.ball.y };
    let bestScore = Infinity;

    for (const t of sampleTimes) {
      if (t > maxHorizonSec + 0.02) continue;
      const pred = this.predictBallAt(t);
      const dist = Math.hypot(pred.x - bot.x, pred.y - bot.y);
      const reachTime = dist / botMaxSpeed;
      if (reachTime <= t + 0.05) {
        return { x: pred.x, y: pred.y };
      }
      const gap = reachTime - t;
      if (gap < bestScore) {
        bestScore = gap;
        bestPoint = { x: pred.x, y: pred.y };
      }
    }
    return bestPoint;
  }

  private predictGoalLineCrossY(ownGoalX: number, attackDir: 1 | -1): number | null {
    // Only predict if ball has meaningful speed toward our goal
    if (this.ball.vx * attackDir >= -45) return null;
    const halfH = this.config.height / 2;
    const br = this.ball.radius;
    const targetX = ownGoalX + attackDir * 28;

    let bx = this.ball.x;
    let by = this.ball.y;
    let bvx = this.ball.vx;
    let bvy = this.ball.vy;

    for (let i = 0; i < 42; i++) {
      bx += bvx * SIM_DT;
      by += bvy * SIM_DT;
      const damp = Math.hypot(bvx, bvy) < 235 ? SLOW_BALL_DAMPING : BALL_DAMPING;
      bvx *= damp;
      bvy *= damp;

      if (by - br < -halfH) {
        by = -halfH + br;
        bvy = Math.abs(bvy) * 0.82;
      } else if (by + br > halfH) {
        by = halfH - br;
        bvy = -Math.abs(bvy) * 0.82;
      }

      if ((attackDir === 1 && bx <= targetX) || (attackDir === -1 && bx >= targetX)) {
        return Math.max(-this.config.goalHalfHeight * 0.92, Math.min(this.config.goalHalfHeight * 0.92, by));
      }
    }
    return null;
  }

  private minDistanceToSegment(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    opponents: PlayerEntity[]
  ): number {
    const abx = bx - ax;
    const aby = by - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq < 1) return Infinity;
    let minD = Infinity;
    for (const opp of opponents) {
      const t = Math.max(0, Math.min(1, ((opp.x - ax) * abx + (opp.y - ay) * aby) / abLenSq));
      const px = ax + abx * t;
      const py = ay + aby * t;
      const d = Math.hypot(opp.x - px, opp.y - py);
      if (d < minD) minD = d;
    }
    return minD;
  }

  private isSegmentBlockedByOpponent(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    opponents: PlayerEntity[],
    clearance = 34
  ): boolean {
    return this.minDistanceToSegment(ax, ay, bx, by, opponents) < clearance;
  }

  private getDynamicFormationAnchor(
    spot: { normDepth: number; normY: number },
    formation: FormationPreset,
    attackDir: 1 | -1,
    teammateAdvancing: boolean
  ): { x: number; y: number } {
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const ballNormX = Math.max(0, Math.min(1, (this.ball.x * attackDir + halfW) / (2 * halfW)));

    const presetProfile =
      formation === 'defansif'
        ? { defBase: -0.9, maxPush: 0.44, phaseGain: 0.44 }
        : formation === 'ofansif'
          ? { defBase: -0.78, maxPush: 0.88, phaseGain: 0.72 }
          : { defBase: -0.85, maxPush: 0.68, phaseGain: 0.58 };

    // Base formation depth spans from own box (-0.85*halfW) to midfield (-0.05*halfW)
    const homeNorm = presetProfile.defBase + spot.normDepth * 0.82;
    // Live match phase shifts the block smoothly without ever losing shape
    const advancePush =
      (teammateAdvancing ? 0.24 : 0.05) +
      ballNormX * presetProfile.phaseGain * (0.35 + 0.65 * spot.normDepth);

    const anchorFracX = Math.max(-0.92, Math.min(presetProfile.maxPush, homeNorm + advancePush));
    const anchorX = attackDir * anchorFracX * halfW;

    // Vertical lane preserves top/center/bottom order while sliding gently toward ball Y
    const laneY = spot.normY * (halfH * 0.86);
    const anchorY = Math.max(
      -halfH * 0.86,
      Math.min(halfH * 0.86, laneY * 0.72 + this.ball.y * 0.28)
    );

    return { x: anchorX, y: anchorY };
  }

  private predictOpponentIntent(
    defendingTeam: ActiveTeam,
    opponents: PlayerEntity[]
  ): PredictedOpponentThreat | null {
    if (opponents.length === 0) return null;

    let carrier: PlayerEntity | null = null;
    let carrierDist = Infinity;
    for (const opp of opponents) {
      const d = Math.hypot(opp.x - this.ball.x, opp.y - this.ball.y);
      if (d < carrierDist) {
        carrierDist = d;
        carrier = opp;
      }
    }
    if (!carrier || carrierDist > 125) return null;

    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const gh = this.config.goalHalfHeight;
    const attackDir: 1 | -1 = defendingTeam === 'red' ? 1 : -1;
    const ownGoalX = -attackDir * halfW;

    // Infer kick direction from carrier's exact angle behind the ball blended with facing
    const geomX = this.ball.x - carrier.x;
    const geomY = this.ball.y - carrier.y;
    const geomLen = Math.hypot(geomX, geomY) || 1;
    const closeWeight = carrierDist < 55 ? 0.78 : 0.45;
    const rawDirX = (geomX / geomLen) * closeWeight + carrier.facingX * (1 - closeWeight);
    const rawDirY = (geomY / geomLen) * closeWeight + carrier.facingY * (1 - closeWeight);
    const rawLen = Math.hypot(rawDirX, rawDirY) || 1;
    const kickDirX = rawDirX / rawLen;
    const kickDirY = rawDirY / rawLen;

    // Historical opponent tendency bias (shots vs passes + favorite corner)
    const tend = this.playerTendencies.get(carrier.id);
    const totalTracked = (tend?.shotCount ?? 0) + (tend?.passCount ?? 0);
    const shotHabit = ((tend?.shotCount ?? 0) + 0.5) / (totalTracked + 1);
    const passHabit = ((tend?.passCount ?? 0) + 0.5) / (totalTracked + 1);
    const cornerHabitY = (tend?.preferredCornerYNorm ?? 0) * gh * 0.72;

    // Evaluate Shot Probability & Ray Projection onto our Goal
    const toGoalX = ownGoalX - this.ball.x;
    const toGoalY = -this.ball.y;
    const toGoalDist = Math.hypot(toGoalX, toGoalY) || 1;
    const goalAlign = kickDirX * (toGoalX / toGoalDist) + kickDirY * (toGoalY / toGoalDist);

    let rayGoalY = cornerHabitY;
    const shootingTowardOwnGoal = (ownGoalX - this.ball.x) * kickDirX > 0 && Math.abs(kickDirX) > 0.14;
    if (shootingTowardOwnGoal) {
      const rayT = (ownGoalX - this.ball.x) / kickDirX;
      rayGoalY = this.ball.y + kickDirY * rayT;
    }

    const predictedShotY = Math.max(
      -gh * 0.9,
      Math.min(gh * 0.9, rayGoalY * 0.74 + cornerHabitY * 0.26)
    );
    const inShotRange = toGoalDist < halfW * 0.88 && Math.abs(rayGoalY) < gh * 1.5;
    const shotScore =
      (inShotRange ? 0.48 : 0.08) +
      Math.max(0, goalAlign) * 0.46 +
      (shotHabit - 0.5) * 0.28 +
      (carrierDist < 42 ? 0.1 : 0);

    // Evaluate Pass Probability & Most Likely Receiver
    let likelyPassTarget: PlayerEntity | null = null;
    let likelyPassAimX = this.ball.x;
    let likelyPassAimY = this.ball.y;
    let bestMateScore = -Infinity;

    for (const mate of opponents) {
      if (mate.id === carrier.id) continue;
      const aimX = Math.max(-halfW + 28, Math.min(halfW - 28, mate.x + mate.vx * 0.26));
      const aimY = Math.max(-halfH + 24, Math.min(halfH - 24, mate.y + mate.vy * 0.26));
      const px = aimX - this.ball.x;
      const py = aimY - this.ball.y;
      const pLen = Math.hypot(px, py);
      if (pLen < 42 || pLen > halfW * 1.35) continue;

      const mateAlign = kickDirX * (px / pLen) + kickDirY * (py / pLen);
      const dangerForward = (aimX - this.ball.x) * -attackDir > 25 ? 0.18 : 0.05;
      const humanPriority = mate.isBot ? 0 : 0.14;
      const score = Math.max(0, mateAlign) * 0.72 + dangerForward + humanPriority;
      if (score > bestMateScore) {
        bestMateScore = score;
        likelyPassTarget = mate;
        likelyPassAimX = aimX;
        likelyPassAimY = aimY;
      }
    }

    const passScore =
      (likelyPassTarget ? Math.max(0, bestMateScore) : 0.08) + (passHabit - 0.5) * 0.28;

    let intent: 'shot' | 'pass' | 'dribble' = 'dribble';
    let confidence = 0.4;
    if (shotScore >= passScore && shotScore >= 0.62) {
      intent = 'shot';
      confidence = Math.min(1, shotScore);
    } else if (likelyPassTarget && passScore >= 0.58) {
      intent = 'pass';
      confidence = Math.min(1, passScore);
    }

    return {
      carrier,
      carrierDist,
      intent,
      confidence,
      predictedShotY,
      likelyPassTarget,
      likelyPassAimX,
      likelyPassAimY,
    };
  }

  private updateTeamBots(team: ActiveTeam): void {
    const teamPlayers = this.players.filter((p) => p.team === team);
    const opponents = this.players.filter((p) => p.team !== team);
    const bots = teamPlayers.filter((p) => p.isBot);
    if (bots.length === 0) return;

    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const gh = this.config.goalHalfHeight;
    const attackDir: 1 | -1 = team === 'red' ? 1 : -1;
    const ownGoalX = -attackDir * halfW;
    const enemyGoalX = attackDir * halfW;
    const formation = this.teamFormations[team];

    // Map every team player to its current formation spot (custom or preset)
    const presetSpots = MatchEngine.getPresetSpots(teamPlayers, formation);
    const spotByPlayerId = new Map<string, { normDepth: number; normY: number }>();
    for (const fb of presetSpots) {
      const custom = this.customStartSpots.get(fb.playerId);
      spotByPlayerId.set(fb.playerId, custom ?? { normDepth: fb.normDepth, normY: fb.normY });
    }

    const ballInOwnHalf = team === 'red' ? this.ball.x < 0 : this.ball.x > 0;
    const rawClosestDist = teamPlayers.reduce(
      (minD, p) => Math.min(minD, Math.hypot(p.x - this.ball.x, p.y - this.ball.y)),
      Infinity
    );
    const teamHasPossession = this.ball.lastTouchTeam === team;
    const teammateAdvancing = !ballInOwnHalf || (teamHasPossession && rawClosestDist < 145);

    // Precompute dynamic formation anchor for each teammate
    const anchorByPlayerId = new Map<string, { x: number; y: number }>();
    for (const p of teamPlayers) {
      const sp = spotByPlayerId.get(p.id) ?? { normDepth: 0.65, normY: 0 };
      anchorByPlayerId.set(
        p.id,
        this.getDynamicFormationAnchor(sp, formation, attackDir, teammateAdvancing)
      );
    }

    // Zone-aware primary ball chaser selection: close players commit immediately,
    // distant players defer to whichever teammate owns the zone covering the ball.
    const sortedByBall = [...teamPlayers].sort((a, b) => {
      const da = Math.hypot(a.x - this.ball.x, a.y - this.ball.y);
      const db = Math.hypot(b.x - this.ball.x, b.y - this.ball.y);
      const ancA = anchorByPlayerId.get(a.id);
      const ancB = anchorByPlayerId.get(b.id);
      const penA = da > 85 && ancA ? Math.hypot(this.ball.x - ancA.x, this.ball.y - ancA.y) * 0.24 : 0;
      const penB = db > 85 && ancB ? Math.hypot(this.ball.x - ancB.x, this.ball.y - ancB.y) * 0.24 : 0;
      return da + penA - (db + penB);
    });
    const closestPlayer = sortedByBall[0];
    const closestId = closestPlayer?.id ?? '';
    const secondClosestId = sortedByBall[1]?.id ?? '';

    // Assign keeper role strictly to explicit 'kaleci' bot (or fallback last bot in 3v3+ if no human keeper)
    const hasHumanKeeper = teamPlayers.some((p) => !p.isBot && p.role === 'kaleci');
    const explicitBotKeeper = bots.find((b) => b.role === 'kaleci');
    const keeperId = explicitBotKeeper
      ? explicitBotKeeper.id
      : !hasHumanKeeper && teamPlayers.length >= 3
        ? bots[bots.length - 1].id
        : null;

    // Evaluate enemy goal shot lanes across 7 points to aim where the keeper cannot reach
    const enemyKeepers = opponents.filter((o) =>
      team === 'red' ? o.x > halfW * 0.38 : o.x < -halfW * 0.38
    );
    const evaluateBestShotLane = (): { targetY: number; clearance: number; bestScore: number } => {
      const candidateYs = [-gh * 0.88, -gh * 0.66, -gh * 0.36, 0, gh * 0.36, gh * 0.66, gh * 0.88];
      let bestY = 0;
      let bestClearance = 0;
      let bestScore = -Infinity;

      for (const cy of candidateYs) {
        const clearance = this.minDistanceToSegment(this.ball.x, this.ball.y, enemyGoalX, cy, opponents);
        const shotDist = Math.hypot(enemyGoalX - this.ball.x, cy - this.ball.y);
        const flightTime = shotDist / KICK_STRENGTH;
        const keeperMargin = opponents.reduce((minMargin, opp) => {
          const isKeeperArea = team === 'red' ? opp.x > halfW * 0.35 : opp.x < -halfW * 0.35;
          const oppToPoint = Math.hypot(opp.x - enemyGoalX * 0.96, opp.y - cy);
          const oppReach = opp.radius + flightTime * (isKeeperArea ? 275 : 225);
          return Math.min(minMargin, oppToPoint - oppReach);
        }, 180);
        const cornerBonus = Math.abs(cy) >= gh * 0.6 ? 24 : Math.abs(cy) > 10 ? 10 : 0;
        const blockedPenalty = clearance < 20 ? -95 : 0;
        const score = clearance * 0.9 + keeperMargin * 1.45 + cornerBonus + blockedPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestClearance = clearance;
          bestY = cy;
        }
      }
      return { targetY: bestY, clearance: bestClearance, bestScore };
    };

    const bestShot = evaluateBestShotLane();
    let simpleAimY = 0;
    if (enemyKeepers.length > 0) {
      const avgKeeperY = enemyKeepers.reduce((sum, o) => sum + o.y, 0) / enemyKeepers.length;
      simpleAimY = avgKeeperY >= 0 ? -gh * 0.8 : gh * 0.8;
    } else {
      simpleAimY = this.ball.y >= 0 ? -gh * 0.72 : gh * 0.72;
    }

    // Helper: pick best open teammate for a pass, through-ball, or cutback
    const findBestPassTarget = (
      passer: PlayerEntity,
      leadFactor: number,
      allowThroughBall: boolean
    ): { mate: PlayerEntity; aimX: number; aimY: number; score: number } | null => {
      if (teamPlayers.length < 2) return null;
      let bestMate: PlayerEntity | null = null;
      let bestAimX = 0;
      let bestAimY = 0;
      let bestScore = -Infinity;

      for (const tm of teamPlayers) {
        if (tm.id === passer.id) continue;

        const leadAdvance = allowThroughBall ? attackDir * 24 : 0;
        const leadX = Math.max(-halfW + 30, Math.min(halfW - 30, tm.x + tm.vx * leadFactor + leadAdvance));
        const leadY = Math.max(-halfH + 25, Math.min(halfH - 25, tm.y + tm.vy * leadFactor));
        const passDist = Math.hypot(leadX - this.ball.x, leadY - this.ball.y);
        if (passDist < 42 || passDist > halfW * 1.3) continue;

        const progressGain = (leadX - this.ball.x) * attackDir;
        const laneClearance = this.minDistanceToSegment(
          this.ball.x,
          this.ball.y,
          leadX,
          leadY,
          opponents
        );
        if (laneClearance < 22) continue;

        const nearestOppToMate = opponents.reduce(
          (minD, opp) => Math.min(minD, Math.hypot(opp.x - leadX, opp.y - leadY)),
          Infinity
        );
        if (nearestOppToMate < 32) continue;

        const mateShotClearance = allowThroughBall
          ? this.minDistanceToSegment(leadX, leadY, enemyGoalX, 0, opponents)
          : 0;
        const keeperPenalty = tm.id === keeperId && ballInOwnHalf ? -38 : 0;
        const humanPriority = tm.isBot ? 0 : 42;
        const rolePriority = tm.role === 'forvet' ? 28 : tm.role === 'ortasaha' ? 18 : 6;
        const openSpaceScore = Math.min(125, nearestOppToMate * 0.72);
        const laneBonus = Math.min(48, (laneClearance - 22) * 0.7);
        const shotSetupBonus = mateShotClearance > 30 ? 30 : 0;
        const score =
          openSpaceScore +
          progressGain * 0.62 +
          humanPriority +
          rolePriority +
          laneBonus +
          shotSetupBonus +
          keeperPenalty;

        if (score > bestScore) {
          bestScore = score;
          bestMate = tm;
          bestAimX = leadX;
          bestAimY = leadY;
        }
      }
      return bestMate ? { mate: bestMate, aimX: bestAimX, aimY: bestAimY, score: bestScore } : null;
    };

    const incomingGoalCrossY = this.predictGoalLineCrossY(ownGoalX, attackDir);
    const hasEfsaneviBot = bots.some((b) => (b.botDifficulty ?? 'normal') === 'efsanevi');
    const predictedThreat = hasEfsaneviBot ? this.predictOpponentIntent(team, opponents) : null;

    bots.forEach((bot, idx) => {
      const difficulty = bot.botDifficulty ?? 'normal';
      const profile = BOT_PROFILES[difficulty];
      const usePredictionLayer = difficulty === 'efsanevi' && predictedThreat !== null;

      // Reaction cadence gate: Kolay reacts slowly (~166ms), Efsanevi reacts every 16.6ms tick
      if ((this.tickCount + idx) % profile.reactionTicks !== 0 && this.tickCount > 2) {
        return;
      }

      let targetX = this.ball.x;
      let targetY = this.ball.y;
      let wantsKick = false;
      let wantsSprint = false;

      const role = bot.role ?? 'ortasaha';
      const anchor = anchorByPlayerId.get(bot.id) ?? { x: ownGoalX + attackDir * halfW * 0.4, y: 0 };
      const distToBall = Math.hypot(this.ball.x - bot.x, this.ball.y - bot.y);

      const effectiveBall = profile.useIntercept
        ? this.findBallIntercept(bot, profile.lookaheadSec)
        : profile.lookaheadSec > 0
          ? this.predictBallAt(profile.lookaheadSec)
          : { x: this.ball.x, y: this.ball.y };

      // Hold outside center circle during opponent kickoff wait so bots never slam into the circle edge
      if (this.kickoffWaitingTouch && team !== this.kickoffTeam) {
        const centerR = this.getCenterCircleRadius();
        if (bot.id === keeperId) {
          targetX = ownGoalX + attackDir * 44;
          targetY = 0;
        } else if (bot.id === closestId) {
          targetX = -attackDir * (centerR + bot.radius + 14);
          targetY = Math.max(-centerR * 0.6, Math.min(centerR * 0.6, anchor.y * 0.35));
        } else {
          targetX = team === 'red' ? Math.min(-centerR - 36, anchor.x) : Math.max(centerR + 36, anchor.x);
          targetY = anchor.y;
        }
        wantsKick = false;
        wantsSprint = false;
      } else if (bot.id === keeperId && closestId !== bot.id) {
        const hasDefenderBehindBall = teamPlayers.some((tm) => {
          if (tm.id === bot.id) return false;
          return team === 'red' ? tm.x < this.ball.x + 28 : tm.x > this.ball.x - 28;
        });
        const attackingOpp = opponents.reduce<PlayerEntity | null>((best, o) => {
          if (!best) return o;
          return Math.hypot(o.x - this.ball.x, o.y - this.ball.y) <
            Math.hypot(best.x - this.ball.x, best.y - this.ball.y)
            ? o
            : best;
        }, null);
        const oppThreatDistToBall = attackingOpp
          ? Math.hypot(attackingOpp.x - this.ball.x, attackingOpp.y - this.ball.y)
          : Infinity;
        const ballDistFromOwnGoal = Math.abs(effectiveBall.x - ownGoalX);
        const noBackCoverThreat =
          !hasDefenderBehindBall &&
          ballDistFromOwnGoal < halfW * 1.12 &&
          oppThreatDistToBall < 145;

        if (profile.gkPredictShot && incomingGoalCrossY !== null) {
          // Predictive shot-stopping dive along the goal line
          targetX = ownGoalX + attackDir * 28;
          targetY = incomingGoalCrossY;
          wantsSprint = bot.stamina > 15;
        } else if (noBackCoverThreat) {
          // No defenders left behind the ball: aggressively rush out to close down the attacker!
          const rushTargetX =
            distToBall < 165
              ? effectiveBall.x - attackDir * 10
              : ownGoalX + (effectiveBall.x - ownGoalX) * 0.62;
          const rushTargetY =
            distToBall < 165
              ? effectiveBall.y
              : Math.max(-gh * 1.15, Math.min(gh * 1.15, effectiveBall.y * 0.82));
          targetX = rushTargetX;
          targetY = rushTargetY;
          wantsSprint = bot.stamina > 12;
        } else if (
          usePredictionLayer &&
          predictedThreat.intent === 'shot' &&
          predictedThreat.confidence >= 0.62 &&
          ballInOwnHalf
        ) {
          // Anticipate opponent's lined-up shot or favorite corner BEFORE they kick
          targetX = ownGoalX + attackDir * 36;
          targetY = Math.max(
            -gh * 0.88,
            Math.min(gh * 0.88, predictedThreat.predictedShotY * 0.72 + this.ball.y * 0.28)
          );
          wantsSprint =
            Math.abs(targetY - bot.y) > 24 && predictedThreat.carrierDist < 52 && bot.stamina > 18;
        } else if (
          usePredictionLayer &&
          predictedThreat.intent === 'pass' &&
          predictedThreat.likelyPassTarget &&
          Math.abs(predictedThreat.likelyPassAimX - ownGoalX) < halfW * 0.62
        ) {
          // Pre-shift across goal toward the predicted square-pass receiver
          targetX = ownGoalX + attackDir * 42;
          targetY = Math.max(
            -gh * 0.88,
            Math.min(gh * 0.88, predictedThreat.likelyPassAimY * 0.52 + this.ball.y * 0.48)
          );
          wantsSprint = Math.abs(targetY - bot.y) > 34 && bot.stamina > 24;
        } else if (!ballInOwnHalf) {
          // Respect custom keeper depth if pushed up as sweeper-keeper
          const customDepth = spotByPlayerId.get(bot.id)?.normDepth ?? 0.22;
          const sweepDist = halfW * (teamHasPossession ? 0.25 + customDepth * 0.35 : 0.19 + customDepth * 0.2);
          targetX = ownGoalX + attackDir * sweepDist;
          targetY = Math.max(-gh * 0.78, Math.min(gh * 0.78, this.ball.y * 0.48));
        } else {
          const dangerDist = profile.smartDribble ? 225 : 190;
          const ballInDangerBox =
            Math.abs(effectiveBall.x - ownGoalX) < dangerDist && Math.abs(effectiveBall.y) < gh * 1.55;
          const oppCloserThanKeeper = opponents.some(
            (o) => Math.hypot(o.x - effectiveBall.x, o.y - effectiveBall.y) + 14 < distToBall
          );

          if (ballInDangerBox && !oppCloserThanKeeper) {
            targetX = effectiveBall.x - attackDir * 12;
            targetY = effectiveBall.y;
            wantsSprint = bot.stamina > Math.max(10, profile.sprintStaminaMin - 6);
          } else {
            targetX = ownGoalX + attackDir * 44;
            targetY = Math.max(-gh * 0.9, Math.min(gh * 0.9, effectiveBall.y * 0.72));
            wantsSprint = Math.abs(targetY - bot.y) > 38 && bot.stamina > profile.sprintStaminaMin;
          }
        }

        // Clear decisively whenever rushed keeper reaches the ball
        if (distToBall <= bot.radius + this.ball.radius + KICK_REACH + 10) {
          const kickVecX = this.ball.x - bot.x;
          const forwardCheck = team === 'red' ? kickVecX >= -2 : kickVecX <= 2;
          if (forwardCheck) {
            wantsKick = true;
          }
        }
      } else if (bot.id === closestId) {
        // 2. Primary Ball Carrier / Presser AI (Proactive Shot & Pass Logic + Prediction Layer)
        const oppHasBallRightNow =
          usePredictionLayer &&
          predictedThreat.carrierDist + 10 < distToBall &&
          predictedThreat.carrierDist < 52 &&
          distToBall > 34;

        if (oppHasBallRightNow && predictedThreat.intent === 'shot') {
          // Step directly into the predicted shot ray to smother the strike
          const sx = ownGoalX - this.ball.x;
          const sy = predictedThreat.predictedShotY - this.ball.y;
          const sLen = Math.hypot(sx, sy) || 1;
          targetX = this.ball.x + (sx / sLen) * 26;
          targetY = this.ball.y + (sy / sLen) * 26;
          wantsSprint = bot.stamina > profile.sprintStaminaMin;
        } else if (
          oppHasBallRightNow &&
          predictedThreat.intent === 'pass' &&
          predictedThreat.likelyPassTarget &&
          distToBall > 52
        ) {
          // Shift onto the predicted passing lane to intercept the pass early
          const lx = predictedThreat.likelyPassAimX - this.ball.x;
          const ly = predictedThreat.likelyPassAimY - this.ball.y;
          const lLen = Math.hypot(lx, ly) || 1;
          targetX = this.ball.x + (lx / lLen) * 44;
          targetY = this.ball.y + (ly / lLen) * 44;
          wantsSprint = bot.stamina > profile.sprintStaminaMin;
        } else {
          // Shoot at unreachable corners when in finishing zone; otherwise pass decisively
          const shotY = profile.useCornerAnalysis ? bestShot.targetY : simpleAimY;
          const distToEnemyGoal = Math.hypot(enemyGoalX - this.ball.x, shotY - this.ball.y);
          const shotClearance = profile.useCornerAnalysis
            ? bestShot.clearance
            : this.minDistanceToSegment(this.ball.x, this.ball.y, enemyGoalX, shotY, opponents);
          const shotBlocked = shotClearance < 22;

          const maxShotDist = profile.smartDribble ? halfW * 0.86 : halfW * 0.75;
          const inFinishingZone =
            distToEnemyGoal < maxShotDist && Math.abs(this.ball.y) < gh * 1.68;
          const onWingByline =
            (team === 'red' ? this.ball.x > halfW * 0.34 : this.ball.x < -halfW * 0.34) &&
            Math.abs(this.ball.y) >= gh * 1.05;

          const passOption = findBestPassTarget(
            bot,
            profile.smartDribble ? 0.32 : 0.2,
            profile.useIntercept
          );
          const nearestOppToCarrier = opponents.reduce(
            (minD, opp) => Math.min(minD, Math.hypot(opp.x - bot.x, opp.y - bot.y)),
            Infinity
          );
          const oppPressingClose = nearestOppToCarrier < (profile.smartDribble ? 105 : 95);

          // Deterministic pass roll per tick bucket for lower difficulties
          const passNoiseRoll = ((this.tickCount + idx * 17) % 100) / 100;
          const willingToPass = passNoiseRoll < profile.passTendency;

          const teammateMuchBetterPlaced = Boolean(
            passOption &&
              (passOption.aimX - this.ball.x) * attackDir > 40 &&
              Math.abs(passOption.aimY) < Math.abs(this.ball.y) + 25
          );

          const shouldCrossOrPass = Boolean(
            passOption &&
              willingToPass &&
              (bot.id === keeperId ||
                onWingByline ||
                shotBlocked ||
                oppPressingClose ||
                !inFinishingZone ||
                teammateMuchBetterPlaced)
          );

          // Shoot immediately if inside finishing zone with a clean lane; otherwise pass decisively
          const usePass =
            shouldCrossOrPass &&
            (!inFinishingZone || shotBlocked || onWingByline || (teammateMuchBetterPlaced && distToEnemyGoal > halfW * 0.42));
          let aimX = usePass && passOption ? passOption.aimX : enemyGoalX;
          let aimY = usePass && passOption ? passOption.aimY : shotY;

          // Apply tight jitter on passes, and minimal precision jitter on shots so bots place corners cleanly
          const effectiveJitter = usePass ? profile.aimJitterRad : Math.min(0.055, profile.aimJitterRad * 0.22);
          if (effectiveJitter > 0) {
            const baseAng = Math.atan2(aimY - this.ball.y, aimX - this.ball.x);
            const wobble = Math.sin(this.tickCount * 0.23 + idx * 1.9) * effectiveJitter;
            const distAim = Math.hypot(aimX - this.ball.x, aimY - this.ball.y) || 200;
            aimX = this.ball.x + Math.cos(baseAng + wobble) * distAim;
            aimY = this.ball.y + Math.sin(baseAng + wobble) * distAim;
          }

          const toTargetX = aimX - this.ball.x;
          const toTargetY = aimY - this.ball.y;
          const len = Math.hypot(toTargetX, toTargetY) || 1;
          const dirX = toTargetX / len;
          const dirY = toTargetY / len;

          const chaseX = distToBall < 70 ? this.ball.x : effectiveBall.x;
          const chaseY = distToBall < 70 ? this.ball.y : effectiveBall.y;

          const behindBall = team === 'red' ? bot.x < chaseX - 4 : bot.x > chaseX + 4;
          if (behindBall) {
            targetX = chaseX - dirX * 15;
            targetY = chaseY - dirY * 15;
            wantsSprint =
              (distToBall > 82 || oppPressingClose) && bot.stamina > profile.sprintStaminaMin;
          } else {
            // Loop cleanly around the ball without pushing it backward toward own goal
            const side = bot.y >= chaseY ? 1 : -1;
            targetX = chaseX - attackDir * 48;
            targetY = chaseY + side * 48;
            wantsSprint = bot.stamina > profile.sprintStaminaMin;
          }

          // Arm kick within pre-collision anticipation window so stepPhysics fires cleanly on contact
          const preKickReach = bot.radius + this.ball.radius + KICK_REACH + 11;
          if (distToBall <= preKickReach) {
            const kickVecX = this.ball.x - bot.x;
            const kickVecY = this.ball.y - bot.y;
            const kickLen = Math.hypot(kickVecX, kickVecY) || 1;
            const alignDot = (kickVecX / kickLen) * dirX + (kickVecY / kickLen) * dirY;
            const towardGoal = team === 'red' ? kickVecX > 1 : kickVecX < -1;
            const dangerOwnBox =
              Math.abs(this.ball.x - ownGoalX) < halfW * 0.38 && Math.abs(this.ball.y) < gh * 1.5;

            if (usePass && alignDot > 0.34) {
              wantsKick = true;
            } else if (
              !usePass &&
              towardGoal &&
              (inFinishingZone ||
                dangerOwnBox ||
                oppPressingClose ||
                alignDot > 0.42)
            ) {
              wantsKick = true;
            }
          }
        }
      } else {
        // 3. Off-Ball Bots: Tactical Support / Cover BLENDED with Dynamic Formation Anchor + Prediction Layer
        const oppSide = this.ball.y >= 0 ? -1 : 1;
        const isSecondOutlet = bot.id === secondClosestId && teamPlayers.length >= 2;
        let tactX = anchor.x;
        let tactY = anchor.y;

        if (isSecondOutlet) {
          const carrier = closestPlayer;
          if (teammateAdvancing) {
            // Triangle outlet ahead/beside carrier within our vertical zone
            tactX = Math.max(
              -halfW * 0.6,
              Math.min(halfW * 0.84, (carrier?.x ?? this.ball.x) + attackDir * 145)
            );
            tactY = Math.max(
              -halfH * 0.8,
              Math.min(halfH * 0.8, anchor.y * 0.5 + (this.ball.y + oppSide * 130) * 0.5)
            );
          } else {
            // Goal-side shadow cover on passing lane
            tactX = (this.ball.x + ownGoalX) * 0.55;
            tactY = this.ball.y * 0.6 + anchor.y * 0.4;
          }
        } else if (teammateAdvancing) {
          if (role === 'forvet') {
            tactX = Math.max(-halfW * 0.2, Math.min(halfW * 0.84, this.ball.x + attackDir * 170));
            tactY = anchor.y;
          } else if (role === 'defans') {
            tactX = Math.max(-halfW * 0.62, Math.min(halfW * 0.42, this.ball.x - attackDir * 135));
            tactY = anchor.y;
          } else {
            tactX = Math.max(-halfW * 0.45, Math.min(halfW * 0.72, this.ball.x + attackDir * 105));
            tactY = anchor.y;
          }
        } else {
          // Defending: drop goal-side between ball and own goal while keeping lane shape
          if (role === 'defans') {
            tactX = ownGoalX + attackDir * Math.min(185, halfW * 0.34);
            tactY = this.ball.y * 0.45 + anchor.y * 0.55;
          } else if (role === 'forvet') {
            // Stay higher up as counter-attack outlet
            tactX = Math.max(-halfW * 0.35, Math.min(halfW * 0.32, this.ball.x + attackDir * 115));
            tactY = anchor.y;
          } else {
            tactX = (this.ball.x + ownGoalX) * 0.5;
            tactY = this.ball.y * 0.4 + anchor.y * 0.6;
          }
        }

        // Efsanevi Prediction Layer for off-ball players: jump passing lanes & shot corridors in-zone
        if (usePredictionLayer && !teammateAdvancing && (role === 'defans' || role === 'ortasaha')) {
          if (predictedThreat.intent === 'pass' && predictedThreat.likelyPassTarget) {
            const laneInterceptX = this.ball.x * 0.42 + predictedThreat.likelyPassAimX * 0.58;
            const laneInterceptY = this.ball.y * 0.42 + predictedThreat.likelyPassAimY * 0.58;
            if (Math.hypot(laneInterceptX - anchor.x, laneInterceptY - anchor.y) < 285) {
              tactX = laneInterceptX;
              tactY = laneInterceptY;
            }
          } else if (predictedThreat.intent === 'shot' && predictedThreat.confidence >= 0.62) {
            const blockX = this.ball.x * 0.58 + ownGoalX * 0.42;
            const blockY = this.ball.y * 0.58 + predictedThreat.predictedShotY * 0.42;
            if (Math.hypot(blockX - anchor.x, blockY - anchor.y) < 275) {
              tactX = blockX;
              tactY = blockY;
            }
          } else {
            let dangerOpp: PlayerEntity | null = null;
            let minOppAnchorDist = 175;
            for (const opp of opponents) {
              const oppInOurHalf = team === 'red' ? opp.x < halfW * 0.15 : opp.x > -halfW * 0.15;
              if (!oppInOurHalf) continue;
              const dAnch = Math.hypot(opp.x - anchor.x, opp.y - anchor.y);
              if (dAnch < minOppAnchorDist) {
                minOppAnchorDist = dAnch;
                dangerOpp = opp;
              }
            }
            if (dangerOpp) {
              tactX = dangerOpp.x - attackDir * 44;
              tactY = dangerOpp.y + Math.sign(-dangerOpp.y) * 6;
            }
          }
        }

        const loyalty = isSecondOutlet ? profile.formationLoyalty * 0.62 : profile.formationLoyalty;
        targetX = tactX * (1 - loyalty) + anchor.x * loyalty;
        targetY = tactY * (1 - loyalty) + anchor.y * loyalty;

        const moveDist = Math.hypot(targetX - bot.x, targetY - bot.y);
        wantsSprint = moveDist > (isSecondOutlet ? 125 : 155) && bot.stamina > profile.sprintStaminaMin + 8;
      }

      // Maintain minimum comfortable spacing from teammates so bots never clump
      for (const tm of teamPlayers) {
        if (tm.id === bot.id) continue;
        const sx = bot.x - tm.x;
        const sy = bot.y - tm.y;
        const sd = Math.hypot(sx, sy);
        if (sd > 0.1 && sd < 50 && distToBall > 55) {
          targetX += (sx / sd) * 30;
          targetY += (sy / sd) * 30;
        }
      }

      let finalTargetX = Math.max(-halfW + 24, Math.min(halfW - 24, targetX));
      let finalTargetY = Math.max(-halfH + 22, Math.min(halfH - 22, targetY));
      if (this.config.cornerRadius > 0) {
        const cr = this.config.cornerRadius;
        const csX = halfW - cr;
        const csY = halfH - cr;
        if (Math.abs(finalTargetX) > csX && Math.abs(finalTargetY) > csY) {
          const cx = Math.sign(finalTargetX) * csX;
          const cy = Math.sign(finalTargetY) * csY;
          const dx = finalTargetX - cx;
          const dy = finalTargetY - cy;
          const d = Math.hypot(dx, dy);
          const maxR = Math.max(12, cr - 22);
          if (d > maxR && d > 0.001) {
            finalTargetX = cx + (dx / d) * maxR;
            finalTargetY = cy + (dy / d) * maxR;
          }
        }
      }
      const fdx = finalTargetX - bot.x;
      const fdy = finalTargetY - bot.y;
      const fd = Math.hypot(fdx, fdy);
      const stopDeadzone = difficulty === 'efsanevi' ? 6 : 9;
      const moveX = fd > stopDeadzone ? (fdx / fd) * profile.pace : 0;
      const moveY = fd > stopDeadzone ? (fdy / fd) * profile.pace : 0;

      this.inputs.set(bot.id, {
        seq: this.tickCount,
        dx: moveX,
        dy: moveY,
        kick: wantsKick,
        sprint: wantsSprint,
      });
    });
  }

  public getSnapshot(): GameSnapshot {
    return {
      tick: this.tickCount,
      phase: this.phase,
      mode: this.mode,
      pitchSize: this.pitchSize,
      teamFormations: {
        red: this.teamFormations.red,
        blue: this.teamFormations.blue,
      },
      teamMeta: this.teamMeta,
      durationSec: this.durationSec,
      timeLeftSec: Math.ceil(this.timeLeftSec),
      phaseTimerSec: Math.round(this.phaseTimerSec * 10) / 10,
      redScore: this.redScore,
      blueScore: this.blueScore,
      kickoffTeam: this.kickoffTeam,
      kickoffWaitingTouch: this.kickoffWaitingTouch,
      goalBanner: this.goalBanner,
      ball: {
        x: Math.round(this.ball.x * 10) / 10,
        y: Math.round(this.ball.y * 10) / 10,
        vx: Math.round(this.ball.vx * 10) / 10,
        vy: Math.round(this.ball.vy * 10) / 10,
        angle: Math.round(this.ball.angle * 100) / 100,
      },
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        role: p.role,
        isBot: p.isBot,
        botDifficulty: p.botDifficulty,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        vx: Math.round(p.vx * 10) / 10,
        vy: Math.round(p.vy * 10) / 10,
        stamina: Math.round(p.stamina),
        isSprinting: p.isSprinting,
        kickAnim: Math.round(p.kickAnim * 100) / 100,
        facingX: Math.round(p.facingX * 100) / 100,
        facingY: Math.round(p.facingY * 100) / 100,
        emoji: this.activeEmojis.get(p.id)?.emoji,
      })),
      events: this.events,
      summary: this.summary,
    };
  }
}
