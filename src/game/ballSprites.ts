import classicBallImg from '../assets/images/classic_match_ball_1794697070198.jpg';
import crimsonBallImg from '../assets/images/crimson_pro_ball_1794697071375.jpg';
import goldBallImg from '../assets/images/gold_champion_ball_1794697071354.jpg';
import sapphireBallImg from '../assets/images/sapphire_pro_ball_1794736116928.jpg';
import { getDevicePerfProfile } from './performance';
import type { BallSkinId } from './shop';

export const BALL_RAW_URLS: Record<BallSkinId, string> = {
  default: classicBallImg,
  gold: goldBallImg,
  crimson: crimsonBallImg,
  sapphire: sapphireBallImg,
};

const spriteCache: Partial<Record<BallSkinId, HTMLCanvasElement>> = {};
const dataUrlCache: Partial<Record<BallSkinId, string>> = {};
const loadingStarted: Partial<Record<BallSkinId, boolean>> = {};
const listeners = new Set<() => void>();

function buildCircularBallSprite(img: HTMLImageElement): HTMLCanvasElement {
  const size = getDevicePerfProfile().ballSpriteSize;

  // Step 1: Analyze image on a lightweight 96x96 scratch canvas to tightly crop uniform studio backdrop
  const scanSize = 96;
  const scratch = document.createElement('canvas');
  scratch.width = scanSize;
  scratch.height = scanSize;
  const sctx = scratch.getContext('2d', { willReadFrequently: true });

  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth || img.width;
  let sh = img.naturalHeight || img.height;

  if (sctx && sw > 0 && sh > 0) {
    sctx.drawImage(img, 0, 0, scanSize, scanSize);
    const { data } = sctx.getImageData(0, 0, scanSize, scanSize);

    let minX = scanSize;
    let maxX = -1;
    let minY = scanSize;
    let maxY = -1;

    for (let y = 0; y < scanSize; y++) {
      for (let x = 0; x < scanSize; x++) {
        const idx = (y * scanSize + x) * 4;
        if (data[idx] < 243 || data[idx + 1] < 243 || data[idx + 2] < 243) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    if (boxW > 30 && boxH > 30) {
      const cxRatio = (minX + maxX) / 2 / scanSize;
      const cyRatio = (minY + maxY) / 2 / scanSize;
      const rRatio = (Math.max(boxW, boxH) / 2 / scanSize) * 0.985;

      const natCx = cxRatio * sw;
      const natCy = cyRatio * sh;
      const natR = rRatio * Math.min(sw, sh);

      sx = Math.max(0, natCx - natR);
      sy = Math.max(0, natCy - natR);
      const cropDia = Math.min(natR * 2, sw - sx, sh - sy);
      sw = cropDia;
      sh = cropDia;
    }
  }

  // Step 2: Render tightly cropped sphere into a circular sprite canvas
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  if (!ctx) return out;

  const pad = 1;
  const radius = size / 2 - pad;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, size, size);

  ctx.drawImage(img, sx, sy, sw, sh, pad, pad, radius * 2, radius * 2);

  const rimGrad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    radius * 0.72,
    size / 2,
    size / 2,
    radius
  );
  rimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.lineWidth = Math.max(2, Math.round(size * 0.012));
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius - 1, 0, Math.PI * 2);
  ctx.stroke();

  return out;
}

function loadBallSkin(skinId: BallSkinId): void {
  if (typeof window === 'undefined' || loadingStarted[skinId]) return;
  loadingStarted[skinId] = true;

  const img = new Image();
  img.decoding = 'async';
  const finalize = () => {
    if (spriteCache[skinId]) return;
    spriteCache[skinId] = buildCircularBallSprite(img);
    listeners.forEach((cb) => cb());
  };
  img.onload = () => {
    if (typeof img.decode === 'function') {
      img.decode().then(finalize, finalize);
    } else {
      finalize();
    }
  };
  img.src = BALL_RAW_URLS[skinId];
}

export function preloadAllBallSprites(): void {
  loadBallSkin('default');
  loadBallSkin('gold');
  loadBallSkin('crimson');
  loadBallSkin('sapphire');
}

export function preloadBallSkin(skinId: BallSkinId): void {
  loadBallSkin(skinId);
}

export function getBallSprite(skinId: BallSkinId): HTMLCanvasElement | null {
  if (!loadingStarted[skinId]) {
    loadBallSkin(skinId);
  }
  return spriteCache[skinId] ?? null;
}

export function getBallPreviewUrl(skinId: BallSkinId): string {
  if (!loadingStarted[skinId]) {
    loadBallSkin(skinId);
  }
  if (dataUrlCache[skinId]) {
    return dataUrlCache[skinId]!;
  }
  const sprite = spriteCache[skinId];
  if (sprite) {
    try {
      const url = sprite.toDataURL('image/png');
      dataUrlCache[skinId] = url;
      return url;
    } catch {
      // Ignore toDataURL failure
    }
  }
  return BALL_RAW_URLS[skinId];
}

export function subscribeBallSprites(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
