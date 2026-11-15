import { DT, TICK_RATE } from './physics';
import type { GameSnapshot, PhysicsSoundEvent, PlayerInput } from './types';

const SIM_SCALE = 0.35;
const SIM_DT = DT * SIM_SCALE;
const PLAYER_DAMPING = Math.pow(0.865, SIM_SCALE);
const BALL_DAMPING = Math.pow(0.978, SIM_SCALE);
const SLOW_BALL_DAMPING = Math.pow(0.935, SIM_SCALE);
const NORMAL_ACCEL = 3450;
const SPRINT_ACCEL = 5100;
const KICK_REACH = 1.5;
const KICK_STRENGTH = 895;
const PLAYER_MASS = 2.4;
const BALL_MASS = 1.0;

export const CHALLENGE_TARGET = {
  x: 265,
  y: 0,
  outerRadius: 125,
  rings: [
    { radius: 18, reward: 250, label: 'Tam Merkez!' },
    { radius: 45, reward: 150, label: 'Çok Yakın!' },
    { radius: 82, reward: 90, label: 'İyi Atış!' },
    { radius: 125, reward: 45, label: 'Hedefte!' },
  ],
};

export type ChallengeStatus = 'dribbling' | 'shot_in_flight' | 'settled';

export interface ChallengeResult {
  distancePx: number;
  rewardCoins: number;
  tierLabel: string;
}

export class ChallengeEngine {
  public readonly pitchMode = '2v2' as const; // 960 x 500 pitch
  public readonly width = 960;
  public readonly height = 500;
  public readonly playerRadius = 16;
  public readonly ballRadius = 8;

  public tickCount = 0;
  public status: ChallengeStatus = 'dribbling';
  public flightTicks = 0;
  public result: ChallengeResult | null = null;
  private events: PhysicsSoundEvent[] = [];

  public player: {
    id: string;
    name: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    stamina: number;
    isSprinting: boolean;
    kickAnim: number;
    kickCooldown: number;
    facingX: number;
    facingY: number;
  };

  public ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
  };

  private input: PlayerInput = { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
  private prevKick = false;
  private sprintExhausted = false;

  constructor(playerName: string) {
    this.player = {
      id: 'challenge_player',
      name: playerName || 'Oyuncu',
      x: -this.width / 2 + 65,
      y: 0,
      vx: 0,
      vy: 0,
      stamina: 100,
      isSprinting: false,
      kickAnim: 0,
      kickCooldown: 0,
      facingX: 1,
      facingY: 0,
    };
    this.ball = {
      x: -this.width / 2 + 112,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
    };
  }

  public resetAttempt(playerName: string): void {
    this.tickCount = 0;
    this.status = 'dribbling';
    this.flightTicks = 0;
    this.result = null;
    this.events = [];
    this.prevKick = false;
    this.sprintExhausted = false;

    this.player.name = playerName || 'Oyuncu';
    this.player.x = -this.width / 2 + 65;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.stamina = 100;
    this.player.isSprinting = false;
    this.player.kickAnim = 0;
    this.player.kickCooldown = 0;
    this.player.facingX = 1;
    this.player.facingY = 0;

    this.ball.x = -this.width / 2 + 112;
    this.ball.y = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.angle = 0;
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
    if (this.status === 'settled') return;

    const p = this.player;
    const b = this.ball;
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    // 1. Player movement & stamina (frozen if ball already launched across midfield)
    if (this.status === 'dribbling') {
      const moveMag = Math.hypot(this.input.dx, this.input.dy);
      const isMoving = moveMag > 0.05;
      const canSprint = !this.sprintExhausted && p.stamina > 0.5;
      const wantsSprint = this.input.sprint && isMoving;

      if (wantsSprint && canSprint) {
        p.isSprinting = true;
        p.stamina = Math.max(0, p.stamina - 45 * DT);
        if (p.stamina <= 0.1) {
          this.sprintExhausted = true;
          p.isSprinting = false;
        }
      } else {
        p.isSprinting = false;
        p.stamina = Math.min(100, p.stamina + 24 * DT);
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
      p.vx *= PLAYER_DAMPING;
      p.vy *= PLAYER_DAMPING;
      p.x += p.vx * SIM_DT;
      p.y += p.vy * SIM_DT;

      // Player bounds + strict midfield barrier (cannot cross x > -playerRadius)
      if (p.x - this.playerRadius < -halfW) {
        p.x = -halfW + this.playerRadius;
        p.vx = Math.max(0, p.vx);
      }
      if (p.x + this.playerRadius > 0) {
        p.x = -this.playerRadius;
        p.vx = Math.min(0, p.vx);
      }
      if (p.y - this.playerRadius < -halfH) {
        p.y = -halfH + this.playerRadius;
        p.vy = Math.max(0, p.vy);
      } else if (p.y + this.playerRadius > halfH) {
        p.y = halfH - this.playerRadius;
        p.vy = Math.min(0, p.vy);
      }

      if (p.kickAnim > 0) p.kickAnim = Math.max(0, p.kickAnim - DT * 4.5);
      if (p.kickCooldown > 0) p.kickCooldown--;

      // Player-ball collision (soft touch)
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const minDist = this.playerRadius + this.ballRadius;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const totalMass = PLAYER_MASS + BALL_MASS;
        p.x -= nx * overlap * (BALL_MASS / totalMass);
        p.y -= ny * overlap * (BALL_MASS / totalMass);
        b.x += nx * overlap * (PLAYER_MASS / totalMass);
        b.y += ny * overlap * (PLAYER_MASS / totalMass);

        const rvx = b.vx - p.vx;
        const rvy = b.vy - p.vy;
        const velNormal = rvx * nx + rvy * ny;
        if (velNormal < 0) {
          const impulse = (-(1 + 0.02) * velNormal) / (1 / PLAYER_MASS + 1 / BALL_MASS);
          p.vx -= (impulse / PLAYER_MASS) * nx;
          p.vy -= (impulse / PLAYER_MASS) * ny;
          b.vx += (impulse / BALL_MASS) * nx;
          b.vy += (impulse / BALL_MASS) * ny;
        }
      }

      // Kick check on exact contact
      const kickTriggered = this.input.kick && !this.prevKick;
      this.prevKick = this.input.kick;
      if ((kickTriggered || this.input.kick) && p.kickCooldown === 0) {
        if (kickTriggered) p.kickAnim = 1;
        const distToBall = Math.hypot(b.x - p.x, b.y - p.y);
        if (distToBall <= this.playerRadius + this.ballRadius + KICK_REACH) {
          p.kickAnim = 1;
          p.kickCooldown = 14;
          const cnx = distToBall > 0.001 ? (b.x - p.x) / distToBall : p.facingX;
          const cny = distToBall > 0.001 ? (b.y - p.y) / distToBall : p.facingY;
          const fx = moveMag > 0.12 ? this.input.dx / moveMag : p.facingX;
          const fy = moveMag > 0.12 ? this.input.dy / moveMag : p.facingY;
          let knx = cnx;
          let kny = cny;
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
            knx = ubx * cosA - uby * sinA;
            kny = ubx * sinA + uby * cosA;
          }
          b.vx = b.vx * 0.22 + knx * KICK_STRENGTH + p.vx * 0.25;
          b.vy = b.vy * 0.22 + kny * KICK_STRENGTH + p.vy * 0.25;
          this.events.push('kick');
        }
      }
    } else {
      if (p.kickAnim > 0) p.kickAnim = Math.max(0, p.kickAnim - DT * 4.5);
      p.vx *= 0.85;
      p.vy *= 0.85;
    }

    // 2. Move Ball
    b.x += b.vx * SIM_DT;
    b.y += b.vy * SIM_DT;
    const preDampSpeed = Math.hypot(b.vx, b.vy);
    const activeBallDamping = preDampSpeed < 235 ? SLOW_BALL_DAMPING : BALL_DAMPING;
    b.vx *= activeBallDamping;
    b.vy *= activeBallDamping;

    const ballSpeed = Math.hypot(b.vx, b.vy);
    if (ballSpeed < 12) {
      b.vx = 0;
      b.vy = 0;
    } else {
      b.angle += (ballSpeed * SIM_DT) / this.ballRadius;
    }

    // Solid pitch walls (no goals!)
    if (b.y - this.ballRadius < -halfH) {
      b.y = -halfH + this.ballRadius;
      b.vy = Math.abs(b.vy) * 0.78;
      if (Math.abs(b.vy) > 65) this.events.push('wall');
    } else if (b.y + this.ballRadius > halfH) {
      b.y = halfH - this.ballRadius;
      b.vy = -Math.abs(b.vy) * 0.78;
      if (Math.abs(b.vy) > 65) this.events.push('wall');
    }

    if (b.x - this.ballRadius < -halfW) {
      b.x = -halfW + this.ballRadius;
      b.vx = Math.abs(b.vx) * 0.78;
      if (Math.abs(b.vx) > 65) this.events.push('wall');
    } else if (b.x + this.ballRadius > halfW) {
      b.x = halfW - this.ballRadius;
      b.vx = -Math.abs(b.vx) * 0.78;
      if (Math.abs(b.vx) > 65) this.events.push('wall');
    }

    // 3. Detect shot crossing midfield & wait for ball to stop
    if (this.status === 'dribbling' && b.x > 16) {
      this.status = 'shot_in_flight';
      this.flightTicks = 0;
    } else if (this.status === 'shot_in_flight') {
      this.flightTicks++;
      if (ballSpeed < 12 && this.flightTicks > TICK_RATE * 0.4) {
        b.vx = 0;
        b.vy = 0;
        this.status = 'settled';
        const dist = Math.round(Math.hypot(b.x - CHALLENGE_TARGET.x, b.y - CHALLENGE_TARGET.y));
        let rewardCoins = 0;
        let tierLabel = 'Hedef Dışı';
        for (const ring of CHALLENGE_TARGET.rings) {
          if (dist <= ring.radius) {
            rewardCoins = ring.reward;
            tierLabel = ring.label;
            break;
          }
        }
        this.result = { distancePx: dist, rewardCoins, tierLabel };
        this.events.push(rewardCoins > 0 ? 'goal' : 'whistle');
      }
    }
  }

  public getSnapshot(): GameSnapshot {
    return {
      tick: this.tickCount,
      phase: 'playing',
      mode: this.pitchMode,
      durationSec: 0,
      timeLeftSec: 0,
      phaseTimerSec: 0,
      redScore: 0,
      blueScore: 0,
      goalBanner: null,
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        vx: this.ball.vx,
        vy: this.ball.vy,
        angle: this.ball.angle,
      },
      players: [
        {
          id: this.player.id,
          name: this.player.name,
          team: 'red',
          isBot: false,
          x: this.player.x,
          y: this.player.y,
          vx: this.player.vx,
          vy: this.player.vy,
          stamina: Math.round(this.player.stamina),
          isSprinting: this.player.isSprinting,
          kickAnim: this.player.kickAnim,
          facingX: this.player.facingX,
          facingY: this.player.facingY,
        },
      ],
      events: this.events,
      summary: null,
    };
  }
}
