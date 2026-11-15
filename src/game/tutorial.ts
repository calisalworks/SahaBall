import { DT, TICK_RATE } from './physics';
import { getPitchConfig } from './types';
import type {
  GameSnapshot,
  PhysicsSoundEvent,
  PitchConfig,
  PlayerEntity,
  PlayerInput,
} from './types';

export type TutorialStepId = 'dribble' | 'sprint' | 'shoot' | 'keeper';

export interface TutorialStepMeta {
  stepIndex: number;
  totalSteps: number;
  id: TutorialStepId;
  title: string;
  instruction: string;
  hint: string;
}

export const TUTORIAL_STEPS: TutorialStepMeta[] = [
  {
    stepIndex: 0,
    totalSteps: 4,
    id: 'dribble',
    title: 'Hareket & Top Sürme',
    instruction: 'Sol analog joystick (veya WASD / Ok) ile koş ve topu yeşil hedef alanına sür.',
    hint: 'Topa yumuşakça dokunarak hedef daireye taşı.',
  },
  {
    stepIndex: 1,
    totalSteps: 4,
    id: 'sprint',
    title: 'Sprint (Hızlı Koşu)',
    instruction: 'SPRİNT tuşuna (veya Shift) basılı tutarak hızlan ve topu sarı alana taşı.',
    hint: 'Sprint enerjini kullan; bıraktığında enerjin hızlıca dolar.',
  },
  {
    stepIndex: 2,
    totalSteps: 4,
    id: 'shoot',
    title: 'Nişanlı Şut',
    instruction: 'Joystick ile sağ kaleye nişan al ve ŞUT tuşuna (veya Boşluk) basarak gol at!',
    hint: 'Topun yanındayken ŞUT tuşuna bastığında güçlü vurursun.',
  },
  {
    stepIndex: 3,
    totalSteps: 4,
    id: 'keeper',
    title: 'Kaleciyi Geç & Gol At',
    instruction: 'Açını bul, kaleciyi yanılt ve topu ağlara gönder!',
    hint: 'Köşelere nişan al veya duvardan sektirip vole vur.',
  },
];

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

export class TutorialEngine {
  public readonly pitchMode = '2v2' as const;
  public readonly pitchSize = 'normal' as const;
  public readonly config: PitchConfig;

  public tickCount = 0;
  public stepIndex = 0;
  public completed = false;
  public stepBannerText: string | null = null;

  public player: PlayerEntity;
  public keeper: PlayerEntity | null = null;
  public ball: { x: number; y: number; vx: number; vy: number; angle: number };
  public target: GameSnapshot['tutorialTarget'] = null;

  private input: PlayerInput = { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
  private prevKick = false;
  private kickBufferTicks = 0;
  private sprintExhausted = false;
  private sprintedInStep = false;
  private advanceDelayTicks = 0;
  private events: PhysicsSoundEvent[] = [];

  constructor(playerName: string) {
    this.config = getPitchConfig(this.pitchMode, this.pitchSize);
    this.player = {
      id: 'tutorial_player',
      name: playerName || 'Oyuncu',
      team: 'red',
      role: 'forvet',
      isBot: false,
      x: -240,
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
    this.ball = { x: -165, y: 0, vx: 0, vy: 0, angle: 0 };
    this.setupStep(0);
  }

  public get stepMeta(): TutorialStepMeta {
    return TUTORIAL_STEPS[Math.min(this.stepIndex, TUTORIAL_STEPS.length - 1)];
  }

  public setupStep(idx: number): void {
    const clamped = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, idx));
    this.stepIndex = clamped;
    this.completed = false;
    this.advanceDelayTicks = 0;
    this.stepBannerText = null;
    this.sprintedInStep = false;
    this.kickBufferTicks = 0;

    this.player.vx = 0;
    this.player.vy = 0;
    this.player.stamina = 100;
    this.player.isSprinting = false;
    this.player.kickAnim = 0;
    this.player.kickCooldown = 0;
    this.player.facingX = 1;
    this.player.facingY = 0;

    this.ball.vx = 0;
    this.ball.vy = 0;

    const halfW = this.config.width / 2;
    const stepId = TUTORIAL_STEPS[clamped].id;

    if (stepId === 'dribble') {
      this.player.x = -250;
      this.player.y = 20;
      this.ball.x = -175;
      this.ball.y = 10;
      this.keeper = null;
      this.target = { x: 45, y: -10, radius: 64, kind: 'dribble' };
    } else if (stepId === 'sprint') {
      this.player.x = -260;
      this.player.y = 40;
      this.ball.x = -185;
      this.ball.y = 32;
      this.keeper = null;
      this.target = { x: 170, y: -60, radius: 66, kind: 'sprint' };
    } else if (stepId === 'shoot') {
      this.player.x = 70;
      this.player.y = 34;
      this.ball.x = 138;
      this.ball.y = 18;
      this.keeper = null;
      this.target = { x: halfW - 14, y: 0, radius: 56, kind: 'goal' };
    } else {
      this.player.x = -40;
      this.player.y = 26;
      this.ball.x = 28;
      this.ball.y = 12;
      this.keeper = {
        id: 'tutorial_gk',
        name: 'Kaleci',
        team: 'blue',
        role: 'kaleci',
        isBot: true,
        botDifficulty: 'kolay',
        x: halfW - 24,
        y: 0,
        vx: 0,
        vy: 0,
        radius: this.config.playerRadius,
        stamina: 100,
        isSprinting: false,
        kickAnim: 0,
        kickCooldown: 0,
        facingX: -1,
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
      this.target = { x: halfW - 14, y: 0, radius: 56, kind: 'goal' };
    }
  }

  public resetBallToPlayer(): void {
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const fMag = Math.hypot(this.player.facingX, this.player.facingY) || 1;
    const bx = this.player.x + (this.player.facingX / fMag) * (this.player.radius + this.config.ballRadius + 10);
    const by = this.player.y + (this.player.facingY / fMag) * (this.player.radius + this.config.ballRadius + 10);
    this.ball.x = Math.max(-halfW + 30, Math.min(halfW - 30, bx));
    this.ball.y = Math.max(-halfH + 30, Math.min(halfH - 30, by));
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  public nextStep(): void {
    if (this.stepIndex < TUTORIAL_STEPS.length - 1) {
      this.setupStep(this.stepIndex + 1);
    } else {
      this.completed = true;
    }
  }

  public restartAll(): void {
    this.setupStep(0);
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

  private completeCurrentStep(banner: string): void {
    if (this.advanceDelayTicks > 0 || this.completed) return;
    this.stepBannerText = banner;
    this.events.push('whistle');
    this.advanceDelayTicks = Math.round(TICK_RATE * 1.15);
  }

  public step(): void {
    this.tickCount++;
    this.events = [];

    if (this.advanceDelayTicks > 0) {
      this.advanceDelayTicks--;
      if (this.advanceDelayTicks === 0) {
        this.stepBannerText = null;
        if (this.stepIndex < TUTORIAL_STEPS.length - 1) {
          this.setupStep(this.stepIndex + 1);
        } else {
          this.completed = true;
        }
        return;
      }
    }

    if (this.completed) return;

    const p = this.player;
    const moveMag = Math.hypot(this.input.dx, this.input.dy);
    const isMoving = moveMag > 0.05;
    const canSprint = !this.sprintExhausted && p.stamina > 0.5;
    const wantsSprint = this.input.sprint && isMoving;

    if (wantsSprint && canSprint) {
      p.isSprinting = true;
      this.sprintedInStep = true;
      p.stamina = Math.max(0, p.stamina - 36 * DT);
      if (p.stamina <= 0.1) {
        this.sprintExhausted = true;
        p.isSprinting = false;
      }
    } else {
      p.isSprinting = false;
      p.stamina = Math.min(100, p.stamina + 36 * DT);
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

    // Gentle goalkeeper AI for step 4
    let gkWantsKick = false;
    const halfW = this.config.width / 2;
    const halfH = this.config.height / 2;
    const gh = this.config.goalHalfHeight;
    if (this.keeper) {
      const gk = this.keeper;
      const targetX = halfW - 24;
      const targetY = Math.max(-gh + 14, Math.min(gh - 14, this.ball.y * 0.55));
      const dx = targetX - gk.x;
      const dy = targetY - gk.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 3) {
        gk.vx += (dx / dist) * NORMAL_ACCEL * 0.66 * SIM_DT;
        gk.vy += (dy / dist) * NORMAL_ACCEL * 0.66 * SIM_DT;
      }
      gk.facingX = -1;
      gk.facingY = 0;
      const bDist = Math.hypot(this.ball.x - gk.x, this.ball.y - gk.y);
      gkWantsKick = bDist <= gk.radius + this.config.ballRadius + 5;
    }

    const actors: PlayerEntity[] = this.keeper ? [this.player, this.keeper] : [this.player];
    for (const actor of actors) {
      actor.vx *= PLAYER_DAMPING;
      actor.vy *= PLAYER_DAMPING;
      actor.x += actor.vx * SIM_DT;
      actor.y += actor.vy * SIM_DT;
      if (actor.kickAnim > 0) actor.kickAnim = Math.max(0, actor.kickAnim - DT * 4.5);
      if (actor.kickCooldown > 0) actor.kickCooldown--;
      actor.x = Math.max(-halfW + actor.radius, Math.min(halfW - actor.radius, actor.x));
      actor.y = Math.max(-halfH + actor.radius, Math.min(halfH - actor.radius, actor.y));
    }

    // Ball motion
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

    // Actor-actor separation
    if (this.keeper) {
      const dx = this.keeper.x - p.x;
      const dy = this.keeper.y - p.y;
      const minD = p.radius + this.keeper.radius;
      const dSq = dx * dx + dy * dy;
      if (dSq < minD * minD) {
        const d = Math.sqrt(dSq) || 0.001;
        const ov = (minD - d) * 0.5;
        p.x -= (dx / d) * ov;
        p.y -= (dy / d) * ov;
        this.keeper.x += (dx / d) * ov;
        this.keeper.y += (dy / d) * ov;
      }
    }

    // Human kick
    if (this.kickBufferTicks > 0 && p.kickCooldown === 0) {
      const dx = this.ball.x - p.x;
      const dy = this.ball.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= p.radius + this.config.ballRadius + KICK_REACH) {
        p.kickAnim = 1;
        p.kickCooldown = KICK_COOLDOWN_TICKS;
        this.kickBufferTicks = 0;
        const cnx = dist > 0.001 ? dx / dist : p.facingX;
        const cny = dist > 0.001 ? dy / dist : p.facingY;
        const inMag = Math.hypot(this.input.dx, this.input.dy);
        const fx = inMag > 0.12 ? this.input.dx / inMag : p.facingX;
        const fy = inMag > 0.12 ? this.input.dy / inMag : p.facingY;
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
        this.events.push('kick');
      }
    }

    // Keeper clear
    if (this.keeper && gkWantsKick && this.keeper.kickCooldown === 0) {
      this.keeper.kickAnim = 1;
      this.keeper.kickCooldown = 16;
      const cy = Math.max(-0.45, Math.min(0.45, (this.ball.y - this.keeper.y) * 0.03));
      const mag = Math.hypot(-1, cy) || 1;
      this.ball.vx = (-1 / mag) * 430;
      this.ball.vy = (cy / mag) * 430;
      this.events.push('kick');
    }

    // Passive ball-actor bounce (low restitution so ball doesn't bounce away on touch)
    for (const actor of actors) {
      const dx = this.ball.x - actor.x;
      const dy = this.ball.y - actor.y;
      const minD = actor.radius + this.config.ballRadius;
      const dSq = dx * dx + dy * dy;
      if (dSq < minD * minD) {
        const d = Math.sqrt(dSq) || 0.001;
        const nx = dx / d;
        const ny = dy / d;
        const ov = minD - d;
        const total = PLAYER_MASS + BALL_MASS;
        actor.x -= nx * ov * (BALL_MASS / total);
        actor.y -= ny * ov * (BALL_MASS / total);
        this.ball.x += nx * ov * (PLAYER_MASS / total);
        this.ball.y += ny * ov * (PLAYER_MASS / total);

        const rvx = this.ball.vx - actor.vx;
        const rvy = this.ball.vy - actor.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const imp = (-(1 + 0.02) * vn) / (1 / PLAYER_MASS + 1 / BALL_MASS);
          actor.vx -= (imp / PLAYER_MASS) * nx;
          actor.vy -= (imp / PLAYER_MASS) * ny;
          this.ball.vx += (imp / BALL_MASS) * nx;
          this.ball.vy += (imp / BALL_MASS) * ny;
        }
      }
    }

    // Posts & walls & goal check
    const br = this.config.ballRadius;
    const gd = this.config.goalDepth;
    const posts = [
      { x: -halfW, y: -gh },
      { x: -halfW, y: gh },
      { x: halfW, y: -gh },
      { x: halfW, y: gh },
    ];
    for (const post of posts) {
      const dx = this.ball.x - post.x;
      const dy = this.ball.y - post.y;
      const minD = br + POST_RADIUS;
      const dSq = dx * dx + dy * dy;
      if (dSq < minD * minD) {
        const d = Math.sqrt(dSq) || 0.001;
        const nx = dx / d;
        const ny = dy / d;
        this.ball.x = post.x + nx * minD;
        this.ball.y = post.y + ny * minD;
        const vn = this.ball.vx * nx + this.ball.vy * ny;
        if (vn < 0) {
          this.ball.vx -= 1.85 * vn * nx;
          this.ball.vy -= 1.85 * vn * ny;
          if (Math.abs(vn) > 70) this.events.push('post');
        }
      }
    }

    if (this.ball.y - br < -halfH) {
      this.ball.y = -halfH + br;
      this.ball.vy = Math.abs(this.ball.vy) * 0.78;
      if (Math.abs(this.ball.vy) > 65) this.events.push('wall');
    } else if (this.ball.y + br > halfH) {
      this.ball.y = halfH - br;
      this.ball.vy = -Math.abs(this.ball.vy) * 0.78;
      if (Math.abs(this.ball.vy) > 65) this.events.push('wall');
    }

    const inGoalY = Math.abs(this.ball.y) < gh - br * 0.3;
    let scoredRightGoal = false;

    if (this.ball.x - br < -halfW) {
      this.ball.x = -halfW + br;
      this.ball.vx = Math.abs(this.ball.vx) * 0.78;
      if (Math.abs(this.ball.vx) > 65) this.events.push('wall');
    } else if (this.ball.x + br > halfW) {
      if (inGoalY) {
        if (this.ball.x + br > halfW + gd) {
          this.ball.x = halfW + gd - br;
          this.ball.vx = -Math.abs(this.ball.vx) * 0.35;
        }
        if (this.ball.x > halfW + br) {
          scoredRightGoal = true;
        }
      } else {
        this.ball.x = halfW - br;
        this.ball.vx = -Math.abs(this.ball.vx) * 0.78;
        if (Math.abs(this.ball.vx) > 65) this.events.push('wall');
      }
    }

    // Check step completion objectives
    if (this.advanceDelayTicks === 0 && this.target) {
      const stepId = this.stepMeta.id;
      if (stepId === 'dribble') {
        const dBall = Math.hypot(this.ball.x - this.target.x, this.ball.y - this.target.y);
        if (dBall <= this.target.radius - 6) {
          this.completeCurrentStep('Harika Top Sürme!');
        }
      } else if (stepId === 'sprint') {
        const dBall = Math.hypot(this.ball.x - this.target.x, this.ball.y - this.target.y);
        const dPlayer = Math.hypot(p.x - this.target.x, p.y - this.target.y);
        if (this.sprintedInStep && (dBall <= this.target.radius || dPlayer <= this.target.radius - 10)) {
          this.completeCurrentStep('Süper Hızlanma!');
        }
      } else if (stepId === 'shoot' || stepId === 'keeper') {
        if (scoredRightGoal) {
          this.events.push('goal');
          this.completeCurrentStep(stepId === 'keeper' ? 'Mükemmel Gol! Eğitim Tamam!' : 'Müthiş Şut!');
        }
      }
    }
  }

  public getSnapshot(): GameSnapshot {
    const actors = this.keeper ? [this.player, this.keeper] : [this.player];
    return {
      tick: this.tickCount,
      phase: this.stepBannerText ? 'goal' : 'playing',
      mode: this.pitchMode,
      pitchSize: this.pitchSize,
      durationSec: 0,
      timeLeftSec: 0,
      phaseTimerSec: 0,
      redScore: this.stepIndex + 1,
      blueScore: TUTORIAL_STEPS.length,
      goalBanner: this.stepBannerText
        ? {
            scoringTeam: 'red',
            scorerName: this.stepBannerText,
            assistName: null,
            isOwnGoal: false,
          }
        : null,
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        vx: this.ball.vx,
        vy: this.ball.vy,
        angle: this.ball.angle,
      },
      players: actors.map((a) => ({
        id: a.id,
        name: a.name,
        team: a.team,
        role: a.role,
        isBot: a.isBot,
        botDifficulty: a.botDifficulty,
        x: a.x,
        y: a.y,
        vx: a.vx,
        vy: a.vy,
        stamina: Math.round(a.stamina),
        isSprinting: a.isSprinting,
        kickAnim: a.kickAnim,
        facingX: a.facingX,
        facingY: a.facingY,
      })),
      events: this.events,
      summary: null,
      tutorialTarget: this.completed ? null : this.target,
    };
  }
}
