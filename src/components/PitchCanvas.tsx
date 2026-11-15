import React, { useEffect, useRef } from 'react';
import { getBallSprite, preloadBallSkin } from '../game/ballSprites';
import { CHALLENGE_TARGET } from '../game/challenge';
import { getJerseyTokenSprite, preloadJerseySkin } from '../game/jerseySprites';
import { getDevicePerfProfile } from '../game/performance';
import { DEFAULT_SKINS } from '../game/shop';
import type { EquippedSkins } from '../game/shop';
import { DEFAULT_TEAM_META, getPitchConfig, ROLE_LABELS, TEAM_COLOR_PALETTE } from '../game/types';
import type { GameSnapshot, PitchConfig } from '../game/types';

interface PitchCanvasProps {
  snapshotRef: React.MutableRefObject<GameSnapshot | null>;
  localPlayerId: string | null;
  skins?: EquippedSkins;
  challengeMode?: boolean;
  paused?: boolean;
  onBeforeRenderRef?: React.MutableRefObject<((now: number) => void) | null>;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface RenderEntityPos {
  x: number;
  y: number;
}

interface PitchCacheEntry {
  key: string;
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
  worldW: number;
  worldH: number;
}

interface PitchPalette {
  bg: string;
  apron: string;
  turfA: string;
  turfB: string;
  line: string;
}

function getPitchPalette(skin: EquippedSkins['pitch']): PitchPalette {
  if (skin === 'emerald') {
    return {
      bg: '#064E3B',
      apron: '#065F46',
      turfA: '#047857',
      turfB: '#059669',
      line: 'rgba(255, 255, 255, 0.84)',
    };
  }
  if (skin === 'night') {
    return {
      bg: '#071A15',
      apron: '#0A221C',
      turfA: '#0D2822',
      turfB: '#12362E',
      line: 'rgba(52, 211, 153, 0.78)',
    };
  }
  return {
    bg: '#114224',
    apron: '#15522B',
    turfA: '#1D703A',
    turfB: '#207A40',
    line: 'rgba(255, 255, 255, 0.72)',
  };
}

function buildStaticPitchCache(
  key: string,
  cfg: PitchConfig,
  palette: PitchPalette,
  redNetRgba: string,
  blueNetRgba: string,
  isChallenge: boolean,
  scale: number
): PitchCacheEntry {
  const halfW = cfg.width / 2;
  const halfH = cfg.height / 2;
  const gh = cfg.goalHalfHeight;
  const gd = cfg.goalDepth;
  const cr = cfg.cornerRadius ?? 0;
  const apron = cr > 0 ? 52 : 48;
  const pad = apron + 16;

  const originX = -halfW - (isChallenge ? 16 : gd) - pad;
  const originY = -halfH - pad;
  const worldW = cfg.width + ((isChallenge ? 16 : gd) + pad) * 2;
  const worldH = cfg.height + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(worldW * scale);
  canvas.height = Math.ceil(worldH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { key, canvas, originX, originY, worldW, worldH };
  }

  ctx.scale(scale, scale);
  ctx.translate(-originX, -originY);

  const apronRadius = cr > 0 ? cr + apron * 0.75 : 18;

  if (cr > 0) {
    ctx.fillStyle = '#0A2E1A';
    ctx.beginPath();
    ctx.roundRect(
      -halfW - (isChallenge ? 16 : gd) - apron - 10,
      -halfH - apron - 10,
      cfg.width + ((isChallenge ? 16 : gd) + apron + 10) * 2,
      cfg.height + (apron + 10) * 2,
      apronRadius + 10
    );
    ctx.fill();
  }

  ctx.fillStyle = palette.apron;
  ctx.beginPath();
  ctx.roundRect(
    -halfW - (isChallenge ? 16 : gd) - apron,
    -halfH - apron,
    cfg.width + ((isChallenge ? 16 : gd) + apron) * 2,
    cfg.height + apron * 2,
    apronRadius
  );
  ctx.fill();

  if (cr > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Main Green Pitch + Turf Stripes
  ctx.save();
  ctx.beginPath();
  if (cr > 0) {
    ctx.roundRect(-halfW, -halfH, cfg.width, cfg.height, cr);
  } else {
    ctx.rect(-halfW, -halfH, cfg.width, cfg.height);
  }
  ctx.clip();

  ctx.fillStyle = palette.turfA;
  ctx.fillRect(-halfW, -halfH, cfg.width, cfg.height);

  const stripeCount = 12;
  const stripeW = cfg.width / stripeCount;
  ctx.fillStyle = palette.turfB;
  for (let i = 0; i < stripeCount; i += 2) {
    ctx.fillRect(-halfW + i * stripeW, -halfH, stripeW, cfg.height);
  }
  ctx.restore();

  // Goal Interiors & Nets
  if (!isChallenge) {
    drawGoalNet(ctx, -halfW - gd, -gh, gd, gh * 2, 'left', redNetRgba);
    drawGoalNet(ctx, halfW, -gh, gd, gh * 2, 'right', blueNetRgba);
  }

  // Crisp Pitch Markings
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 2.5;

  if (isChallenge) {
    ctx.beginPath();
    if (cr > 0) {
      ctx.roundRect(-halfW, -halfH, cfg.width, cfg.height, cr);
    } else {
      ctx.rect(-halfW, -halfH, cfg.width, cfg.height);
    }
    ctx.stroke();
  } else if (cr > 0) {
    ctx.beginPath();
    ctx.moveTo(-halfW, -gh);
    ctx.lineTo(-halfW, -halfH + cr);
    ctx.arcTo(-halfW, -halfH, -halfW + cr, -halfH, cr);
    ctx.lineTo(halfW - cr, -halfH);
    ctx.arcTo(halfW, -halfH, halfW, -halfH + cr, cr);
    ctx.lineTo(halfW, -gh);

    ctx.moveTo(halfW, gh);
    ctx.lineTo(halfW, halfH - cr);
    ctx.arcTo(halfW, halfH, halfW - cr, halfH, cr);
    ctx.lineTo(-halfW + cr, halfH);
    ctx.arcTo(-halfW, halfH, -halfW, halfH - cr, cr);
    ctx.lineTo(-halfW, gh);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(-halfW, -gh);
    ctx.lineTo(-halfW, gh);
    ctx.moveTo(halfW, -gh);
    ctx.lineTo(halfW, gh);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.moveTo(-halfW, -halfH);
    ctx.lineTo(halfW, -halfH);
    ctx.moveTo(-halfW, halfH);
    ctx.lineTo(halfW, halfH);
    ctx.moveTo(-halfW, -halfH);
    ctx.lineTo(-halfW, -gh);
    ctx.moveTo(-halfW, gh);
    ctx.lineTo(-halfW, halfH);
    ctx.moveTo(halfW, -halfH);
    ctx.lineTo(halfW, -gh);
    ctx.moveTo(halfW, gh);
    ctx.lineTo(halfW, halfH);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(-halfW, -gh);
    ctx.lineTo(-halfW, gh);
    ctx.moveTo(halfW, -gh);
    ctx.lineTo(halfW, gh);
    ctx.stroke();
    ctx.restore();
  }

  // Halfway line & center circle
  ctx.beginPath();
  ctx.moveTo(0, -halfH);
  ctx.lineTo(0, halfH);
  ctx.stroke();

  if (isChallenge) {
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.88)';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, halfH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '700 10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('SINIR', -8, -halfH + 10);
    ctx.restore();
  }

  const centerR = Math.min(84, halfH * 0.34);
  ctx.beginPath();
  ctx.arc(0, 0, centerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  const boxW = Math.min(135, cfg.width * 0.14);
  const boxH = Math.min(halfH * 1.15, gh * 2.15);
  ctx.strokeRect(-halfW, -boxH / 2, boxW, boxH);
  if (!isChallenge) {
    ctx.strokeRect(halfW - boxW, -boxH / 2, boxW, boxH);
  }

  if (cr === 0) {
    const cornerR = 16;
    const drawCorner = (cx: number, cy: number, start: number, end: number) => {
      ctx.beginPath();
      ctx.arc(cx, cy, cornerR, start, end);
      ctx.stroke();
    };
    drawCorner(-halfW, -halfH, 0, Math.PI / 2);
    drawCorner(halfW, -halfH, Math.PI / 2, Math.PI);
    drawCorner(halfW, halfH, Math.PI, Math.PI * 1.5);
    drawCorner(-halfW, halfH, Math.PI * 1.5, Math.PI * 2);
  }

  if (isChallenge) {
    drawChallengeTarget(ctx, CHALLENGE_TARGET.x, CHALLENGE_TARGET.y);
  }

  return { key, canvas, originX, originY, worldW, worldH };
}

export const PitchCanvas: React.FC<PitchCanvasProps> = React.memo(({
  snapshotRef,
  localPlayerId,
  skins = DEFAULT_SKINS,
  challengeMode = false,
  paused = false,
  onBeforeRenderRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skinsRef = useRef<EquippedSkins>(skins);
  const challengeRef = useRef<boolean>(challengeMode);
  const pausedRef = useRef<boolean>(paused);

  useEffect(() => {
    skinsRef.current = skins;
    preloadBallSkin(skins.ball);
    preloadJerseySkin(skins.jersey);
    preloadJerseySkin('default');
  }, [skins]);

  useEffect(() => {
    challengeRef.current = challengeMode;
  }, [challengeMode]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const perf = getDevicePerfProfile();
    preloadBallSkin(skinsRef.current.ball);
    preloadJerseySkin(skinsRef.current.jersey);
    preloadJerseySkin('default');

    const getDpr = () => Math.min(window.devicePixelRatio || 1, perf.maxDpr);

    // Pre-bake 3D ball specular highlight once
    const specSize = 48;
    const specCanvas = document.createElement('canvas');
    specCanvas.width = specSize;
    specCanvas.height = specSize;
    const sCtx = specCanvas.getContext('2d');
    if (sCtx) {
      const half = specSize / 2;
      const g = sCtx.createRadialGradient(
        half - half * 0.34,
        half - half * 0.34,
        half * 0.08,
        half,
        half,
        half
      );
      g.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      g.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
      sCtx.fillStyle = g;
      sCtx.beginPath();
      sCtx.arc(half, half, half, 0, Math.PI * 2);
      sCtx.fill();
    }

    // Offscreen sprite cache for player name text
    const nameCache = new Map<string, HTMLCanvasElement>();
    const nameScale = perf.isLowEnd ? 1.25 : 2;
    const getNameSprite = (name: string, isLocal: boolean): HTMLCanvasElement => {
      const key = `${name}|${isLocal ? 1 : 0}`;
      const cached = nameCache.get(key);
      if (cached) return cached;
      const nc = document.createElement('canvas');
      const w = 136;
      const h = 24;
      nc.width = Math.round(w * nameScale);
      nc.height = Math.round(h * nameScale);
      const nCtx = nc.getContext('2d');
      if (nCtx) {
        nCtx.scale(nameScale, nameScale);
        nCtx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
        nCtx.textAlign = 'center';
        nCtx.textBaseline = 'top';
        nCtx.lineWidth = 3;
        nCtx.strokeStyle = 'rgba(8, 28, 16, 0.85)';
        nCtx.strokeText(name, w / 2, 2);
        nCtx.fillStyle = isLocal ? '#FEF08A' : 'rgba(255, 255, 255, 0.94)';
        nCtx.fillText(name, w / 2, 2);
      }
      if (nameCache.size > 48) nameCache.clear();
      nameCache.set(key, nc);
      return nc;
    };

    let pitchCache: PitchCacheEntry | null = null;
    let animId = 0;
    let lastTime = performance.now();
    let camX = 0;
    let camY = 0;
    let camZoom = 0.85;
    let camInitialized = false;
    let lastGoalTick = -1;

    const smoothPlayers = new Map<string, RenderEntityPos>();
    let smoothBall: RenderEntityPos = { x: 0, y: 0 };
    const ballTrail: Array<{ x: number; y: number; alpha: number }> = [];
    const particles: Particle[] = [];

    let cssW = window.innerWidth;
    let cssH = window.innerHeight;

    const resize = () => {
      const dpr = getDpr();
      const rect = canvas.getBoundingClientRect();
      cssW = Math.max(1, Math.round(rect.width || window.innerWidth));
      cssH = Math.max(1, Math.round(rect.height || window.innerHeight));
      const targetW = Math.max(1, Math.round(cssW * dpr));
      const targetH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', resize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const spawnGoalParticles = (x: number, y: number, color: string) => {
      const count = perf.maxGoalParticles;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 110 + Math.random() * 240;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.85 + Math.random() * 0.45,
          maxLife: 1.3,
          color,
          size: 3 + Math.random() * 3.5,
        });
      }
    };

    const render = (now: number) => {
      if (pausedRef.current) {
        lastTime = now;
        animId = requestAnimationFrame(render);
        return;
      }

      // Advance local simulation in exact VSync lockstep before drawing
      if (onBeforeRenderRef?.current) {
        onBeforeRenderRef.current(now);
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const vw = cssW;
      const vh = cssH;
      const scaleX = canvas.width / vw;
      const scaleY = canvas.height / vh;

      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';

      const snap = snapshotRef.current;
      if (!snap) {
        ctx.fillStyle = '#114224';
        ctx.fillRect(0, 0, vw, vh);
        animId = requestAnimationFrame(render);
        return;
      }

      const cfg = getPitchConfig(snap.mode, snap.pitchSize);
      const halfW = cfg.width / 2;
      const halfH = cfg.height / 2;
      const gh = cfg.goalHalfHeight;
      const gd = cfg.goalDepth;
      const teamMeta = snap.teamMeta ?? DEFAULT_TEAM_META;
      const redTheme = TEAM_COLOR_PALETTE[teamMeta.red.colorId];
      const blueTheme = TEAM_COLOR_PALETTE[teamMeta.blue.colorId];

      // Smooth entity interpolation
      const interpAlpha = 1 - Math.exp(-32 * dt);
      const bdx = snap.ball.x - smoothBall.x;
      const bdy = snap.ball.y - smoothBall.y;
      if (bdx * bdx + bdy * bdy > 19600) {
        smoothBall.x = snap.ball.x;
        smoothBall.y = snap.ball.y;
      } else {
        smoothBall.x += bdx * interpAlpha;
        smoothBall.y += bdy * interpAlpha;
      }

      const activeIds = new Set<string>();
      for (const p of snap.players) {
        activeIds.add(p.id);
        let pos = smoothPlayers.get(p.id);
        if (!pos) {
          pos = { x: p.x, y: p.y };
          smoothPlayers.set(p.id, pos);
        } else {
          const pdx = p.x - pos.x;
          const pdy = p.y - pos.y;
          if (pdx * pdx + pdy * pdy > 19600) {
            pos.x = p.x;
            pos.y = p.y;
          } else {
            pos.x += pdx * interpAlpha;
            pos.y += pdy * interpAlpha;
          }
        }
      }
      if (smoothPlayers.size > activeIds.size) {
        for (const id of smoothPlayers.keys()) {
          if (!activeIds.has(id)) smoothPlayers.delete(id);
        }
      }

      if (snap.phase === 'goal' && snap.goalBanner && lastGoalTick !== snap.tick && particles.length === 0) {
        lastGoalTick = snap.tick;
        const burstColor = snap.goalBanner.scoringTeam === 'red' ? redTheme.hex : blueTheme.hex;
        spawnGoalParticles(smoothBall.x, smoothBall.y, burstColor);
      }

      const localP = localPlayerId ? snap.players.find((p) => p.id === localPlayerId) : null;
      const localPos = localP ? smoothPlayers.get(localP.id) ?? { x: localP.x, y: localP.y } : null;

      let focusMinX: number;
      let focusMaxX: number;
      let focusMinY: number;
      let focusMaxY: number;

      const isChallenge = challengeRef.current;
      const curSkins = skinsRef.current;

      if (isChallenge) {
        focusMinX = -halfW - 24;
        focusMaxX = halfW + 24;
        focusMinY = -halfH - 42;
        focusMaxY = halfH + 42;
      } else if (localPos) {
        const marginX = 182;
        const marginY = 160;
        focusMinX = Math.min(localPos.x, smoothBall.x) - marginX;
        focusMaxX = Math.max(localPos.x, smoothBall.x) + marginX;
        focusMinY = Math.min(localPos.y, smoothBall.y) - marginY;
        focusMaxY = Math.max(localPos.y, smoothBall.y) + marginY;
      } else {
        focusMinX = -halfW - gd - 48;
        focusMaxX = halfW + gd + 48;
        focusMinY = -halfH - 68;
        focusMaxY = halfH + 68;
      }

      const spanX = Math.max(396, focusMaxX - focusMinX);
      const spanY = Math.max(286, focusMaxY - focusMinY);

      const minZoomFitPitch = Math.min(vw / (cfg.width + gd * 2 + 66), vh / (cfg.height + 120)) * 0.91;
      const maxZoom = (vw < 700 ? 1.12 : 1.25) * 0.90;
      const rawZoom = Math.min(vw / spanX, vh / spanY) * 0.91;
      const targetZoom = Math.max(Math.min(minZoomFitPitch, 0.86), Math.min(maxZoom, rawZoom));

      let targetCamX = (focusMinX + focusMaxX) / 2;
      let targetCamY = (focusMinY + focusMaxY) / 2;

      const visibleWorldW = vw / targetZoom;
      const visibleWorldH = vh / targetZoom;
      const maxOffsetX = Math.max(0, halfW + gd + 50 - visibleWorldW / 2);
      const maxOffsetY = Math.max(0, halfH + 65 - visibleWorldH / 2);
      targetCamX = Math.max(-maxOffsetX, Math.min(maxOffsetX, targetCamX));
      targetCamY = Math.max(-maxOffsetY, Math.min(maxOffsetY, targetCamY));

      if (!camInitialized) {
        camX = targetCamX;
        camY = targetCamY;
        camZoom = targetZoom;
        camInitialized = true;
      } else {
        const camLerp = 1 - Math.exp(-7.5 * dt);
        camX += (targetCamX - camX) * camLerp;
        camY += (targetCamY - camY) * camLerp;
        camZoom += (targetZoom - camZoom) * camLerp;
      }

      const pitchPalette = getPitchPalette(curSkins.pitch);

      // Fill outer background directly
      ctx.fillStyle = pitchPalette.bg;
      ctx.fillRect(0, 0, vw, vh);

      // Apply camera transform
      ctx.translate(vw / 2, vh / 2);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-camX, -camY);

      // 1-3. Single Blit of Cached Offscreen Static Stadium + Turf + Goal Nets + Markings
      const cacheScale = perf.isLowEnd ? 1.5 : 2.0;
      const cacheKey = `${snap.mode}|${snap.pitchSize}|${curSkins.pitch}|${teamMeta.red.colorId}|${teamMeta.blue.colorId}|${isChallenge ? 1 : 0}|${cacheScale}`;
      if (!pitchCache || pitchCache.key !== cacheKey) {
        pitchCache = buildStaticPitchCache(
          cacheKey,
          cfg,
          pitchPalette,
          redTheme.rgba,
          blueTheme.rgba,
          isChallenge,
          cacheScale
        );
      }
      ctx.drawImage(
        pitchCache.canvas,
        pitchCache.originX,
        pitchCache.originY,
        pitchCache.worldW,
        pitchCache.worldH
      );

      // 3b. Center Circle Kickoff (Santra) Lock Indicator
      if (!isChallenge && (snap.phase === 'countdown' || snap.kickoffWaitingTouch)) {
        const koTeam = snap.kickoffTeam ?? 'red';
        const koTheme = TEAM_COLOR_PALETTE[teamMeta[koTeam].colorId];
        const centerR = Math.min(84, halfH * 0.34);
        const localLockedOut =
          snap.phase === 'countdown' || (localP ? localP.team !== koTeam : true);
        const pulse = 0.65 + 0.35 * Math.sin(now * 0.008);

        ctx.save();
        if (localLockedOut) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.06 * pulse})`;
          ctx.beginPath();
          ctx.arc(0, 0, centerR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = koTheme.hex;
        ctx.globalAlpha = 0.55 + 0.3 * pulse;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.arc(0, 0, centerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 3c. Interactive Tutorial Target Zone
      if (snap.tutorialTarget) {
        drawTutorialTarget(ctx, snap.tutorialTarget, now);
      }

      // 4. Ball Motion Trail (skipped on ultra-low-end devices for fill-rate savings)
      if (perf.enableBallTrail) {
        const ballSpeedSq = snap.ball.vx * snap.ball.vx + snap.ball.vy * snap.ball.vy;
        if (ballSpeedSq > 52900 && ballTrail.length < 10) {
          ballTrail.push({ x: smoothBall.x, y: smoothBall.y, alpha: 0.4 });
        }
        for (let i = ballTrail.length - 1; i >= 0; i--) {
          ballTrail[i].alpha -= dt * 3.0;
          if (ballTrail[i].alpha <= 0) {
            ballTrail.splice(i, 1);
            continue;
          }
          ctx.fillStyle = `rgba(255, 255, 255, ${ballTrail[i].alpha * 0.36})`;
          ctx.beginPath();
          ctx.arc(ballTrail[i].x, ballTrail[i].y, cfg.ballRadius * (0.4 + ballTrail[i].alpha), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Players
      ctx.globalAlpha = 1;
      for (const p of snap.players) {
        const pos = smoothPlayers.get(p.id) ?? { x: p.x, y: p.y };
        const isLocal = p.id === localPlayerId;

        if (p.kickAnim > 0.02) {
          const haloR = cfg.playerRadius + (1 - p.kickAnim) * 16;
          ctx.strokeStyle = `rgba(255, 255, 255, ${p.kickAnim * 0.85})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, haloR, 0, Math.PI * 2);
          ctx.stroke();
        }

        const pColorId = teamMeta[p.team].colorId;
        const pTheme = TEAM_COLOR_PALETTE[pColorId];

        if (p.isSprinting) {
          ctx.fillStyle = `${pTheme.hex}47`;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, cfg.playerRadius + 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + cfg.playerRadius * 0.72, cfg.playerRadius * 0.92, cfg.playerRadius * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        if (isLocal) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, cfg.playerRadius + 4.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        const jerseySkin = isLocal ? curSkins.jersey : 'default';
        const jerseySprite = getJerseyTokenSprite(jerseySkin, pColorId);
        if (jerseySprite) {
          const jd = cfg.playerRadius * 2.06;
          ctx.drawImage(jerseySprite, pos.x - jd / 2, pos.y - jd / 2, jd, jd);
        } else {
          ctx.fillStyle = pTheme.hex;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, cfg.playerRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, cfg.playerRadius, 0, Math.PI * 2);
        ctx.strokeStyle =
          isLocal && curSkins.jersey === 'gold_trim'
            ? '#FDE047'
            : isLocal && curSkins.jersey === 'bolt'
              ? '#7DD3FC'
              : pTheme.ring;
        ctx.lineWidth = 2.4;
        ctx.stroke();

        ctx.fillStyle = pTheme.isLight ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)';
        ctx.beginPath();
        ctx.arc(
          pos.x + p.facingX * (cfg.playerRadius * 0.68),
          pos.y + p.facingY * (cfg.playerRadius * 0.68),
          2.2,
          0,
          Math.PI * 2
        );
        ctx.fill();

        if (p.role && !isChallenge) {
          ctx.font = '800 8px "Plus Jakarta Sans", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = pTheme.isLight ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)';
          ctx.fillText(ROLE_LABELS[p.role].short, pos.x, pos.y + 0.5);
        }

        if (isLocal && p.stamina < 99) {
          const pct = Math.max(0, Math.min(1, p.stamina / 100));
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, cfg.playerRadius + 8, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();

          ctx.strokeStyle = pct > 0.25 ? '#FACC15' : '#FB7185';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, cfg.playerRadius + 8, Math.PI * 1.15, Math.PI * (1.15 + 0.7 * pct));
          ctx.stroke();
        }

        const nameSprite = getNameSprite(p.name, isLocal);
        ctx.drawImage(nameSprite, pos.x - 68, pos.y + cfg.playerRadius + 3, 136, 24);

        if (p.emoji) {
          const isPhrase = p.emoji.length > 2 || /[\p{L}\p{N}]/u.test(p.emoji);
          const bx = pos.x;
          const by = pos.y - cfg.playerRadius - 24;
          ctx.save();
          ctx.font = isPhrase
            ? '700 11px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif'
            : '16px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
          const measuredW = isPhrase ? Math.ceil(ctx.measureText(p.emoji).width) + 16 : 32;
          const bubbleW = Math.max(32, Math.min(150, measuredW));
          const bubbleH = isPhrase ? 24 : 26;
          const halfW = bubbleW / 2;
          const halfH = bubbleH / 2;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.strokeStyle = isPhrase ? 'rgba(52, 211, 153, 0.7)' : 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bx - halfW, by - halfH, bubbleW, bubbleH, 9);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(bx - 4, by + halfH - 0.5);
          ctx.lineTo(bx + 4, by + halfH - 0.5);
          ctx.lineTo(bx, by + halfH + 5);
          ctx.closePath();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, bx, by + (isPhrase ? 0.5 : -0.5), bubbleW - 10);
          ctx.restore();
        }
      }

      // 6. Ball
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(
        smoothBall.x + 1,
        smoothBall.y + cfg.ballRadius * 0.78,
        cfg.ballRadius * 0.94,
        cfg.ballRadius * 0.44,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      const ballSprite = getBallSprite(curSkins.ball);

      ctx.save();
      ctx.translate(smoothBall.x, smoothBall.y);
      ctx.rotate(snap.ball.angle);

      if (ballSprite) {
        const d = cfg.ballRadius * 2.04;
        ctx.drawImage(ballSprite, -d / 2, -d / 2, d, d);
      } else {
        ctx.fillStyle = curSkins.ball === 'gold' ? '#FACC15' : '#F8FAFC';
        ctx.beginPath();
        ctx.arc(0, 0, cfg.ballRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.drawImage(
        specCanvas,
        smoothBall.x - cfg.ballRadius,
        smoothBall.y - cfg.ballRadius,
        cfg.ballRadius * 2,
        cfg.ballRadius * 2
      );

      // 7. Solid Goalposts
      if (!isChallenge) {
        const posts = [
          { x: -halfW, y: -gh, color: redTheme.ring },
          { x: -halfW, y: gh, color: redTheme.ring },
          { x: halfW, y: -gh, color: blueTheme.ring },
          { x: halfW, y: gh, color: blueTheme.ring },
        ];
        for (const post of posts) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(post.x, post.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = post.color;
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      }

      // 8. Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
        pt.life -= dt;
        if (pt.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      vv?.removeEventListener('resize', resize);
      ro?.disconnect();
    };
  }, [snapshotRef, localPlayerId, onBeforeRenderRef]);

  return <canvas ref={canvasRef} className="fixed inset-0 block w-full h-full touch-none" />;
});

function drawGoalNet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  side: 'left' | 'right',
  fillColor: string
): void {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);

  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.4;
  const step = 12;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += step) {
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
  }
  for (let gy = y; gy <= y + h; gy += step) {
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
  }
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (side === 'left') {
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
  }
  ctx.stroke();
}

function drawChallengeTarget(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.beginPath();
  ctx.arc(tx + 3, ty + 4, CHALLENGE_TARGET.outerRadius + 4, 0, Math.PI * 2);
  ctx.fill();

  const ringStyles = [
    { radius: 125, fill: '#F8FAFC', stroke: '#0F172A' },
    { radius: 82, fill: '#0EA5E9', stroke: '#FFFFFF' },
    { radius: 45, fill: '#EF4444', stroke: '#FFFFFF' },
    { radius: 18, fill: '#FACC15', stroke: '#92400E' },
  ];

  for (const r of ringStyles) {
    ctx.fillStyle = r.fill;
    ctx.beginPath();
    ctx.arc(tx, ty, r.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = r.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.arc(tx, ty, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '800 10px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#0F172A';
  ctx.fillText('+45', tx, ty - 103);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('+90', tx, ty - 63);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('+150', tx, ty - 31);

  ctx.font = '800 9px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#451A03';
  ctx.fillText('+250', tx, ty - 10);

  ctx.restore();
}

function drawTutorialTarget(
  ctx: CanvasRenderingContext2D,
  target: NonNullable<GameSnapshot['tutorialTarget']>,
  now: number
): void {
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
  const strokeColor =
    target.kind === 'sprint'
      ? `rgba(250, 204, 21, ${0.65 + pulse * 0.35})`
      : target.kind === 'goal'
        ? `rgba(56, 189, 248, ${0.65 + pulse * 0.35})`
        : `rgba(52, 211, 153, ${0.65 + pulse * 0.35})`;
  const fillColor =
    target.kind === 'sprint'
      ? 'rgba(250, 204, 21, 0.14)'
      : target.kind === 'goal'
        ? 'rgba(56, 189, 248, 0.16)'
        : 'rgba(16, 185, 129, 0.16)';
  const label =
    target.kind === 'sprint' ? 'SPRİNT HEDEFİ' : target.kind === 'goal' ? 'ŞUT HEDEFİ' : 'BURAYA SÜR';

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius + pulse * 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '800 10px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, target.x, target.y);
  ctx.restore();
}
