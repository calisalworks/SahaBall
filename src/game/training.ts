import { DT, TICK_RATE } from './physics';
import { getPitchConfig } from './types';
import type {
  ActiveTeam,
  BotDifficulty,
  GameSnapshot,
  PhysicsSoundEvent,
  PitchConfig,
  PitchSize,
  PlayerEntity,
  PlayerInput,
} from './types';

export type TrainingKeeperMode = 'none' | 'static' | 'moving';

export interface TrainingStats {
  goals: number;
  shots: number;
  saves: number;
}

const SIM_SCALE = 0.35;
const SIM_DT = DT * SIM_SCALE;
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

interface KeeperProfile {
  reactionTicks: number;
  pace: number;
  lookaheadSec: number;
  staticSwayPx: number;
  predictShot: boolean;
}

const KEEPER_PROFILES: Record<BotDifficulty, KeeperProfile> = {
  kolay: {
    reactionTicks: 10,
    pace: 0.64,
    lookaheadSec: 0,
    staticSwayPx: 0,
    predictShot: false,
  },
  normal: {
    reactionTicks: 5,
    pace: 0.84,
    lookaheadSec: 0.14,
    staticSwayPx: 12,
    predictShot: false,
  },
  zor: {
    reactionTicks: 2,
    pace: 0.96,
    lookaheadSec: 0.3,
    staticSwayPx: 24,
    predictShot: true,
  },
  efsanevi: {
    reactionTicks: 1,
    pace: 1.04,
    lookaheadSec: 0.52,
    staticSwayPx: 36,
    predictShot: true,
  },
};

export class TrainingEngine {
  public readonly pitchMode = '2v2' as const;
  public pitchSize: PitchSize;
  public config: PitchConfig;
  public gkMode: TrainingKeeperMode;
  public gkCount: 1 | 2;
  public gkDifficulty: BotDifficulty;

  public tickCount = 0;
  public stats: TrainingStats = { goals: 0, shots: 0, saves: 0 };
  public goalResetTicks = 0;
  public goalBanner: GameSnapshot['goalBanner'] = null;

  public player: PlayerEntity;
  public keepers: PlayerEntity[] = [];
  public ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    isShotOnTarget: boolean;
    lastTouchedByHuman: boolean;
  };

  private input: PlayerInput = { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
  private prevKick = false;
  private kickBufferTicks = 0;
  private sprintExhausted = false;
  private lastWallOrPostBounceTick = -1000;
  private events: PhysicsSoundEvent[] = [];

  constructor(
    playerName: string,
    pitchSize: PitchSize = 'normal',
    gkMode: TrainingKeeperMode = 'moving',
    gkCount: 1 | 2 = 1,
    gkDifficulty: BotDifficulty = 'normal'
  ) {
    this.pitchSize = pitchSize;
    this.config = getPitchConfig(this.pitchMode, pitchSize);
    this.gkMode = gkMode;
    this.gkCount = gkCount;
    this.gkDifficulty = gkDifficulty;

    this.player = {
      id: 'training_player',
      name: playerName || 'Oyuncu',
      team: 'red',
      role: 'forvet',
      isBot: false,
      x: -140,
      y: 0,
      vx: 0,
      vy: 0,
      radius: this.config.playerRadius,
      stamina: 100,
      isSprinting: false,
      kickAnim: 0,
      kickCooldown: 0,
      facingX: 1,
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
    };

    this.ball = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      isShotOnTarget: false,
      lastTouchedByHuman: false,
    };

    this.rebuildKeepers();
  }

  private createKeeper(id: string, name: string, side: 'left' | 'right'): PlayerEntity {
    const halfW = this.config.width / 2;
    const x = side === 'right' ? halfW - 22 : -halfW + 22;
    return {
      id,
      name,
      team: 'blue',
      role: 'kaleci',
      isBot: true,
      botDifficulty: this.gkDifficulty,
      x,
      y: 0,
      vx: 0,
      vy: 0,
      radius: this.config.playerRadius,
      stamina: 100,
      isSprinting: false,
      kickAnim: 0,
      kickCooldown: 0,
      facingX: side === 'right' ? -1 : 1,
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
    };
  }

  public rebuildKeepers(): void {
    if (this.gkMode === 'none') {
      this.keepers = [];
      return;
    }
    const modeTag = this.gkMode === 'static' ? 'Sabit' : 'Kaleci';
    const next: PlayerEntity[] = [
      this.createKeeper('gk_right', `${modeTag} 1`, 'right'),
    ];
    if (this.gkCount === 2) {
      next.push(this.createKeeper('gk_left', `${modeTag} 2`, 'left'));
    }
    this.keepers = next;
  }

  public setKeeperConfig(
    gkMode: TrainingKeeperMode,
    gkCount: 1 | 2,
    gkDifficulty: BotDifficulty
  ): void {
    const changed =
      this.gkMode !== gkMode || this.gkCount !== gkCount || this.gkDifficulty !== gkDifficulty;
    this.gkMode = gkMode;
    this.gkCount = gkCount;
    this.gkDifficulty = gkDifficulty;
    if (changed) {
      this.rebuildKeepers();
    }
  }

  public setPitchSize(size: PitchSize): void {
    if (this.pitchSize === size) return;
    this.pitchSize = size;
    this.config = getPitchConfig(this.pitchMode, size);
    this.resetSession(false);
  }

  public resetBallToPlayer(): void {
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const fMag = Math.hypot(this.player.facingX, this.player.facingY) || 1;
    const fx = this.player.facingX / fMag;
    const fy = this.player.facingY / fMag;
    const bx = this.player.x + fx * (this.config.playerRadius + this.config.ballRadius + 10);
    const by = this.player.y + fy * (this.config.playerRadius + this.config.ballRadius + 10);
    this.ball.x = Math.max(-halfW + 30, Math.min(halfW - 30, bx));
    this.ball.y = Math.max(-halfH + 30, Math.min(halfH - 30, by));
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.isShotOnTarget = false;
    this.goalResetTicks = 0;
    this.goalBanner = null;
  }

  public resetSession(resetStats = true): void {
    this.player.x = -140;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.stamina = 100;
    this.player.isSprinting = false;
    this.player.kickAnim = 0;
    this.player.kickCooldown = 0;
    this.player.facingX = 1;
    this.player.facingY = 0;

    this.ball.x = -90;
    this.ball.y = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.isShotOnTarget = false;
    this.ball.lastTouchedByHuman = false;
    this.goalResetTicks = 0;
    this.goalBanner = null;
    this.kickBufferTicks = 0;

    if (resetStats) {
      this.stats = { goals: 0, shots: 0, saves: 0 };
    }
    this.rebuildKeepers();
  }

  public setInput(inp: PlayerInput): void {
    const mag = Math.hypot(inp.dx, inp.dy);
    const dx = mag > 1 ? inp.dx / mag : inp.dx;
    const dy = mag > 1 ? inp.dy / mag : inp.dy;
    this.input = {
      seq: inp.seq,
      dx: Number.isFinite(dx) ? dx : 0,
      dy: Number.isFinite(dy) ? dy : 0,
      kick: Boolean(inp.kick),
      sprint: Boolean(inp.sprint),
    };
  }

  public step(): void {
    this.tickCount++;
    this.events = [];

    if (this.goalResetTicks > 0) {
      this.goalResetTicks--;
      if (this.goalResetTicks === 0) {
        this.goalBanner = null;
        this.ball.x = 0;
        this.ball.y = 0;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.isShotOnTarget = false;
        this.rebuildKeepers();
      }
    }

    // 1. Human player input & movement
    const p = this.player;
    const moveMag = Math.hypot(this.input.dx, this.input.dy);
    const isMoving = moveMag > 0.05;
    const canSprint = !this.sprintExhausted && p.stamina > 0.5;
    const wantsSprint = this.input.sprint && isMoving;

    if (wantsSprint && canSprint) {
      p.isSprinting = true;
      p.stamina = Math.max(0, p.stamina - 36 * DT);
      if (p.stamina <= 0.1) {
        this.sprintExhausted = true;
        p.isSprinting = false;
      }
    } else {
      p.isSprinting = false;
      p.stamina = Math.min(100, p.stamina + 34 * DT);
      if (this.sprintExhausted && p.stamina >= 15) {
        this.sprintExhausted = false;
      }
    }

    const accel = p.isSprinting ? SPRINT_ACCEL : NORMAL_ACCEL;
    p.vx += this.input.dx * accel * SIM_DT;
    p.vy += this.input.dy * accel * SIM_DT;
    if (isMoving) {
      p.facingX = this.input.dx / moveMag;
      p.facingY = this.input.dy / moveMag;
    }

    const kickRising = this.input.kick && !this.prevKick;
    this.prevKick = this.input.kick;
    if (kickRising) {
      this.kickBufferTicks = KICK_BUFFER_TICKS;
      if (p.kickCooldown === 0) p.kickAnim = 1;
    } else if (this.input.kick) {
      this.kickBufferTicks = Math.max(this.kickBufferTicks, 2);
    } else if (this.kickBufferTicks > 0) {
      this.kickBufferTicks--;
    }

    // 2. Keepers AI movement
    const keeperKicks = new Map<string, boolean>();
    const profile = KEEPER_PROFILES[this.gkDifficulty];
    const halfW = this.config.width / 2;
    const gh = this.config.goalHalfHeight;

    for (const gk of this.keepers) {
      const side: 'left' | 'right' = gk.id === 'gk_left' ? 'left' : 'right';
      const goalX = side === 'right' ? halfW : -halfW;
      const dirToField = side === 'right' ? -1 : 1;

      if (this.gkMode === 'static') {
        // Sabit Kaleci: Anchored on goal line; higher difficulties have tighter goal-line micro-reflexes
        const anchorX = goalX + dirToField * 22;
        let anchorY = 0;
        if (profile.staticSwayPx > 0) {
          const approaching =
            (side === 'right' && this.ball.vx > 20) || (side === 'left' && this.ball.vx < -20);
          let targetBallY = this.ball.y;
          if (approaching && profile.predictShot && Math.abs(this.ball.vx) > 40) {
            const tImpact = Math.max(0, Math.min(0.6, (anchorX - this.ball.x) / this.ball.vx));
            targetBallY = this.ball.y + this.ball.vy * tImpact;
          }
          anchorY = Math.max(-profile.staticSwayPx, Math.min(profile.staticSwayPx, targetBallY * 0.45));
        }

        const dx = anchorX - gk.x;
        const dy = anchorY - gk.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const factor = (dist > 14 ? 0.92 : 0.48) * profile.pace;
          gk.vx += (dx / dist) * NORMAL_ACCEL * factor * SIM_DT;
          gk.vy += (dy / dist) * NORMAL_ACCEL * factor * SIM_DT;
        }
        gk.facingX = dirToField;
        gk.facingY = 0;

        // Clear/block ball if right at keeper reach
        const bDist = Math.hypot(this.ball.x - gk.x, this.ball.y - gk.y);
        keeperKicks.set(gk.id, bDist <= gk.radius + this.config.ballRadius + 4);
      } else {
        // Hareketli Kaleci: Dynamic shot-angle keeper scaled by difficulty
        const ballToGoalX = this.ball.x - goalX;
        const ballInBox = Math.abs(ballToGoalX) < 135 && Math.abs(this.ball.y) < gh + 32;
        const ballSlow = Math.hypot(this.ball.vx, this.ball.vy) < 130;

        let targetX = goalX + dirToField * (profile.predictShot ? 28 : 22);
        let targetY = Math.max(-gh + 12, Math.min(gh - 12, this.ball.y * 0.65));

        if (profile.predictShot) {
          const incoming =
            (side === 'right' && this.ball.vx > 80) || (side === 'left' && this.ball.vx < -80);
          if (incoming) {
            const tGoal = Math.max(
              0,
              Math.min(0.85, (targetX - this.ball.x) / (this.ball.vx || 0.001))
            );
            const predY = this.ball.y + this.ball.vy * tGoal;
            targetY = Math.max(-gh + 10, Math.min(gh - 10, predY));
          } else {
            // Cut shooting angle toward ball
            const distFromLine = Math.min(36, Math.max(20, Math.abs(ballToGoalX) * 0.18));
            targetX = goalX + dirToField * distFromLine;
          }
        }

        if (ballInBox && ballSlow) {
          targetX = this.ball.x + this.ball.vx * profile.lookaheadSec * 0.35;
          targetY = this.ball.y + this.ball.vy * profile.lookaheadSec * 0.35;
        }

        const dx = targetX - gk.x;
        const dy = targetY - gk.y;
        const dist = Math.hypot(dx, dy);
        const shouldReact =
          this.tickCount % Math.max(1, Math.round(profile.reactionTicks / 2)) === 0 || dist > 10;
        if (shouldReact && dist > 3) {
          const urge = dist > 28 ? 1 : dist / 28;
          const useSprint = profile.pace >= 0.9 && dist > 36 && gk.stamina > 25;
          gk.isSprinting = useSprint;
          const accelScale = (useSprint ? SPRINT_ACCEL : NORMAL_ACCEL) * profile.pace * urge;
          gk.vx += (dx / dist) * accelScale * SIM_DT;
          gk.vy += (dy / dist) * accelScale * SIM_DT;
        } else {
          gk.isSprinting = false;
        }

        const lookX = this.ball.x - gk.x;
        const lookY = this.ball.y - gk.y;
        const lMag = Math.hypot(lookX, lookY) || 1;
        gk.facingX = lookX / lMag;
        gk.facingY = lookY / lMag;

        const bDist = Math.hypot(this.ball.x - gk.x, this.ball.y - gk.y);
        keeperKicks.set(gk.id, bDist <= gk.radius + this.config.ballRadius + KICK_REACH);
      }
    }

    // 3. Integrate all participants
    const allActors: PlayerEntity[] = [this.player, ...this.keepers];
    for (const actor of allActors) {
      actor.vx *= PLAYER_DAMPING;
      actor.vy *= PLAYER_DAMPING;
      actor.x += actor.vx * SIM_DT;
      actor.y += actor.vy * SIM_DT;
      if (actor.kickAnim > 0) actor.kickAnim = Math.max(0, actor.kickAnim - DT * 4.5);
      if (actor.kickCooldown > 0) actor.kickCooldown--;
      this.clampActorInsidePitch(actor);
    }

    // 4. Advance ball
    this.ball.x += this.ball.vx * SIM_DT;
    this.ball.y += this.ball.vy * SIM_DT;
    const preDamp = Math.hypot(this.ball.vx, this.ball.vy);
    const activeDamp = preDamp < 235 ? SLOW_BALL_DAMPING : BALL_DAMPING;
    this.ball.vx *= activeDamp;
    this.ball.vy *= activeDamp;

    const bSpeed = Math.hypot(this.ball.vx, this.ball.vy);
    if (bSpeed < 12) {
      this.ball.vx = 0;
      this.ball.vy = 0;
    } else {
      this.ball.angle += (bSpeed * SIM_DT) / this.config.ballRadius;
    }

    // 5. Actor-Actor Collisions
    for (let i = 0; i < allActors.length; i++) {
      for (let j = i + 1; j < allActors.length; j++) {
        const a = allActors[i];
        const b = allActors[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.radius + b.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }

    // 6. Kicks BEFORE passive bounce so shots & wall rebounds are razor sharp
    if (this.kickBufferTicks > 0 && p.kickCooldown === 0) {
      const dx = this.ball.x - p.x;
      const dy = this.ball.y - p.y;
      const dist = Math.hypot(dx, dy);
      const wallBonusReach =
        this.tickCount - this.lastWallOrPostBounceTick <= WALL_REBOUND_WINDOW_TICKS ? 3.5 : 0;
      const maxReach = p.radius + this.config.ballRadius + KICK_REACH + wallBonusReach;
      if (dist <= maxReach) {
        this.performHumanKick(dx, dy, dist);
      }
    }

    // Keeper kicks / saves
    for (const gk of this.keepers) {
      if (keeperKicks.get(gk.id) && gk.kickCooldown === 0) {
        const side: 'left' | 'right' = gk.id === 'gk_left' ? 'left' : 'right';
        const clearDirX = side === 'right' ? -1 : 1;
        const clearY = Math.max(-0.5, Math.min(0.5, (this.ball.y - gk.y) * 0.03));
        const mag = Math.hypot(clearDirX, clearY) || 1;
        const power = this.gkMode === 'static' ? 430 : 560;
        this.ball.vx = (clearDirX / mag) * power;
        this.ball.vy = (clearY / mag) * power;
        gk.kickAnim = 1;
        gk.kickCooldown = 12;
        if (this.ball.isShotOnTarget && this.ball.lastTouchedByHuman) {
          this.stats.saves++;
        }
        this.ball.isShotOnTarget = false;
        this.ball.lastTouchedByHuman = false;
        this.events.push('kick');
      }
    }

    // 7. Actor-Ball Passive Collisions
    for (const actor of allActors) {
      const dx = this.ball.x - actor.x;
      const dy = this.ball.y - actor.y;
      const minDist = actor.radius + this.config.ballRadius;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const totalMass = PLAYER_MASS + BALL_MASS;
        actor.x -= nx * overlap * (BALL_MASS / totalMass);
        actor.y -= ny * overlap * (BALL_MASS / totalMass);
        this.ball.x += nx * overlap * (PLAYER_MASS / totalMass);
        this.ball.y += ny * overlap * (PLAYER_MASS / totalMass);

        const rvx = this.ball.vx - actor.vx;
        const rvy = this.ball.vy - actor.vy;
        const velNormal = rvx * nx + rvy * ny;
        if (velNormal < 0) {
          const restitution = 0.02;
          const impulse = (-(1 + restitution) * velNormal) / (1 / PLAYER_MASS + 1 / BALL_MASS);
          actor.vx -= (impulse / PLAYER_MASS) * nx;
          actor.vy -= (impulse / PLAYER_MASS) * ny;
          this.ball.vx += (impulse / BALL_MASS) * nx;
          this.ball.vy += (impulse / BALL_MASS) * ny;

          if (actor.isBot && this.ball.isShotOnTarget && this.ball.lastTouchedByHuman) {
            this.stats.saves++;
            this.ball.isShotOnTarget = false;
          }
          if (!actor.isBot) {
            this.ball.lastTouchedByHuman = true;
          } else {
            this.ball.lastTouchedByHuman = false;
          }
        }
      }
    }

    // 8. Goalpost Collisions + Pitch Walls + Goal Detection
    this.resolveGoalpostsAndWalls();
  }

  private performHumanKick(dx: number, dy: number, dist: number): void {
    const p = this.player;
    const isReboundVolley =
      this.tickCount - this.lastWallOrPostBounceTick <= WALL_REBOUND_WINDOW_TICKS;
    p.kickAnim = 1;
    p.kickCooldown = isReboundVolley ? 4 : KICK_COOLDOWN_TICKS;
    this.kickBufferTicks = 0;

    const cnx = dist > 0.001 ? dx / dist : p.facingX;
    const cny = dist > 0.001 ? dy / dist : p.facingY;
    const inputMag = Math.hypot(this.input.dx, this.input.dy);
    const fx = inputMag > 0.12 ? this.input.dx / inputMag : p.facingX;
    const fy = inputMag > 0.12 ? this.input.dy / inputMag : p.facingY;
    let kx = cnx;
    let ky = cny;
    if (fx * cnx + fy * cny > -0.25) {
      const bx = fx * 0.58 + cnx * 0.42;
      const by = fy * 0.58 + cny * 0.42;
      const bMag = Math.hypot(bx, by) || 1;
      const ubx = bx / bMag;
      const uby = by / bMag;
      const cross = fx * cny - fy * cnx;
      const angleBias = Math.max(-0.22, Math.min(0.22, cross * 0.28));
      const cosA = Math.cos(angleBias);
      const sinA = Math.sin(angleBias);
      kx = ubx * cosA - uby * sinA;
      ky = ubx * sinA + uby * cosA;
    }

    this.ball.vx = this.ball.vx * 0.18 + kx * KICK_STRENGTH + p.vx * 0.22;
    this.ball.vy = this.ball.vy * 0.18 + ky * KICK_STRENGTH + p.vy * 0.22;
    this.ball.lastTouchedByHuman = true;
    this.stats.shots++;

    // Detect shot heading toward either goal mouth
    const halfW = this.config.width / 2;
    const gh = this.config.goalHalfHeight;
    let onTarget = false;
    if (this.ball.vx > 80) {
      const t = (halfW - this.ball.x) / this.ball.vx;
      const py = this.ball.y + this.ball.vy * t;
      onTarget = Math.abs(py) <= gh + 10;
    } else if (this.ball.vx < -80) {
      const t = (-halfW - this.ball.x) / this.ball.vx;
      const py = this.ball.y + this.ball.vy * t;
      onTarget = Math.abs(py) <= gh + 10;
    }
    this.ball.isShotOnTarget = onTarget;
    this.events.push('kick');
  }

  private clampActorInsidePitch(actor: PlayerEntity): void {
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const r = actor.radius;
    const cr = this.config.cornerRadius || 0;

    if (actor.y - r < -halfH) {
      actor.y = -halfH + r;
      actor.vy = Math.max(0, actor.vy);
    } else if (actor.y + r > halfH) {
      actor.y = halfH - r;
      actor.vy = Math.min(0, actor.vy);
    }
    if (actor.x - r < -halfW) {
      actor.x = -halfW + r;
      actor.vx = Math.max(0, actor.vx);
    } else if (actor.x + r > halfW) {
      actor.x = halfW - r;
      actor.vx = Math.min(0, actor.vx);
    }

    if (cr > r + 4) {
      const innerX = halfW - cr;
      const innerY = halfH - cr;
      if (Math.abs(actor.x) > innerX && Math.abs(actor.y) > innerY) {
        const cx = Math.sign(actor.x) * innerX;
        const cy = Math.sign(actor.y) * innerY;
        const dx = actor.x - cx;
        const dy = actor.y - cy;
        const dist = Math.hypot(dx, dy) || 0.001;
        const maxDist = cr - r;
        if (dist > maxDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          actor.x = cx + nx * maxDist;
          actor.y = cy + ny * maxDist;
          const vn = actor.vx * nx + actor.vy * ny;
          if (vn > 0) {
            actor.vx -= vn * nx;
            actor.vy -= vn * ny;
          }
        }
      }
    }
  }

  private resolveGoalpostsAndWalls(): void {
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const gh = this.config.goalHalfHeight;
    const gd = this.config.goalDepth;
    const br = this.config.ballRadius;
    const cr = this.config.cornerRadius || 0;

    const posts = [
      { x: -halfW, y: -gh },
      { x: -halfW, y: gh },
      { x: halfW, y: -gh },
      { x: halfW, y: gh },
    ];
    for (const post of posts) {
      const dx = this.ball.x - post.x;
      const dy = this.ball.y - post.y;
      const minDist = br + POST_RADIUS;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        this.ball.x = post.x + nx * minDist;
        this.ball.y = post.y + ny * minDist;
        const vn = this.ball.vx * nx + this.ball.vy * ny;
        if (vn < 0) {
          this.ball.vx -= (1 + 0.85) * vn * nx;
          this.ball.vy -= (1 + 0.85) * vn * ny;
          this.lastWallOrPostBounceTick = this.tickCount;
          if (Math.abs(vn) > 70) this.events.push('post');
        }
      }
    }

    // Top/Bottom walls
    if (this.ball.y - br < -halfH) {
      this.ball.y = -halfH + br;
      this.ball.vy = Math.abs(this.ball.vy) * 0.78;
      this.lastWallOrPostBounceTick = this.tickCount;
      if (Math.abs(this.ball.vy) > 65) this.events.push('wall');
    } else if (this.ball.y + br > halfH) {
      this.ball.y = halfH - br;
      this.ball.vy = -Math.abs(this.ball.vy) * 0.78;
      this.lastWallOrPostBounceTick = this.tickCount;
      if (Math.abs(this.ball.vy) > 65) this.events.push('wall');
    }

    // Rounded corners for Ellipse pitch
    if (cr > br + 4) {
      const innerX = halfW - cr;
      const innerY = halfH - cr;
      if (Math.abs(this.ball.x) > innerX && Math.abs(this.ball.y) > innerY) {
        const cx = Math.sign(this.ball.x) * innerX;
        const cy = Math.sign(this.ball.y) * innerY;
        const dx = this.ball.x - cx;
        const dy = this.ball.y - cy;
        const dist = Math.hypot(dx, dy) || 0.001;
        const maxDist = cr - br;
        if (dist > maxDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          this.ball.x = cx + nx * maxDist;
          this.ball.y = cy + ny * maxDist;
          const vn = this.ball.vx * nx + this.ball.vy * ny;
          if (vn > 0) {
            this.ball.vx -= (1 + 0.78) * vn * nx;
            this.ball.vy -= (1 + 0.78) * vn * ny;
            this.lastWallOrPostBounceTick = this.tickCount;
            if (vn > 65) this.events.push('wall');
          }
        }
      }
    }

    const inGoalMouthY = Math.abs(this.ball.y) < gh - br * 0.3;
    if (this.ball.x - br < -halfW) {
      if (inGoalMouthY) {
        if (this.ball.x - br < -halfW - gd) {
          this.ball.x = -halfW - gd + br;
          this.ball.vx = Math.abs(this.ball.vx) * 0.35;
        }
        if (this.ball.x < -halfW - br && this.goalResetTicks === 0) {
          this.triggerGoal('red');
        }
      } else {
        this.ball.x = -halfW + br;
        this.ball.vx = Math.abs(this.ball.vx) * 0.78;
        this.lastWallOrPostBounceTick = this.tickCount;
        if (Math.abs(this.ball.vx) > 65) this.events.push('wall');
      }
    } else if (this.ball.x + br > halfW) {
      if (inGoalMouthY) {
        if (this.ball.x + br > halfW + gd) {
          this.ball.x = halfW + gd - br;
          this.ball.vx = -Math.abs(this.ball.vx) * 0.35;
        }
        if (this.ball.x > halfW + br && this.goalResetTicks === 0) {
          this.triggerGoal('red');
        }
      } else {
        this.ball.x = halfW - br;
        this.ball.vx = -Math.abs(this.ball.vx) * 0.78;
        this.lastWallOrPostBounceTick = this.tickCount;
        if (Math.abs(this.ball.vx) > 65) this.events.push('wall');
      }
    }
  }

  private triggerGoal(team: ActiveTeam): void {
    this.stats.goals++;
    this.ball.isShotOnTarget = false;
    this.goalResetTicks = Math.round(TICK_RATE * 0.9);
    this.goalBanner = {
      scoringTeam: team,
      scorerName: this.player.name,
      assistName: null,
      isOwnGoal: false,
    };
    this.events.push('goal');
  }

  public getSnapshot(): GameSnapshot {
    return {
      tick: this.tickCount,
      phase: this.goalBanner ? 'goal' : 'playing',
      mode: this.pitchMode,
      pitchSize: this.pitchSize,
      durationSec: 0,
      timeLeftSec: 0,
      phaseTimerSec: 0,
      redScore: this.stats.goals,
      blueScore: this.stats.saves,
      goalBanner: this.goalBanner,
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        vx: this.ball.vx,
        vy: this.ball.vy,
        angle: this.ball.angle,
      },
      players: [this.player, ...this.keepers].map((actor) => ({
        id: actor.id,
        name: actor.name,
        team: actor.team,
        role: actor.role,
        isBot: actor.isBot,
        botDifficulty: actor.botDifficulty,
        x: actor.x,
        y: actor.y,
        vx: actor.vx,
        vy: actor.vy,
        stamina: Math.round(actor.stamina),
        isSprinting: actor.isSprinting,
        kickAnim: actor.kickAnim,
        facingX: actor.facingX,
        facingY: actor.facingY,
      })),
      events: this.events,
      summary: null,
    };
  }
}
