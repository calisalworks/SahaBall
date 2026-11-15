import jerseyBoltImg from '../assets/images/jersey_bolt_pro_1794736119179.jpg';
import jerseyClassicImg from '../assets/images/jersey_classic_pro_1794736117270.jpg';
import jerseyGoldImg from '../assets/images/jersey_gold_pro_1794736118537.jpg';
import { getDevicePerfProfile } from './performance';
import type { JerseySkinId } from './shop';
import { TEAM_COLOR_PALETTE } from './types';
import type { TeamColorId } from './types';

export const JERSEY_RAW_URLS: Record<JerseySkinId, string> = {
  default: jerseyClassicImg,
  gold_trim: jerseyGoldImg,
  bolt: jerseyBoltImg,
};

const PREVIEW_SIZE = 192;

const previewUrlCache: Partial<Record<JerseySkinId, string>> = {};
const tokenSpriteCache: Record<string, HTMLCanvasElement> = {};
const loadedImages: Partial<Record<JerseySkinId, HTMLImageElement>> = {};
const loadingStarted: Partial<Record<JerseySkinId, boolean>> = {};
const listeners = new Set<() => void>();

function buildShopJerseyPreview(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  ctx.drawImage(img, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  const imgData = ctx.getImageData(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  const { data } = imgData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const minC = Math.min(r, g, b);
    if (minC > 240 && Math.max(r, g, b) - minC < 12) {
      data[i + 3] = 0;
    } else if (minC > 224 && Math.max(r, g, b) - minC < 10) {
      const fade = (240 - minC) / 16;
      data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, fade)));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function buildPitchJerseyToken(
  img: HTMLImageElement,
  skinId: JerseySkinId,
  colorId: TeamColorId
): HTMLCanvasElement {
  const tokenSize = getDevicePerfProfile().jerseyTokenSize;
  const out = document.createElement('canvas');
  out.width = tokenSize;
  out.height = tokenSize;
  const ctx = out.getContext('2d');
  if (!ctx) return out;

  const cx = tokenSize / 2;
  const cy = tokenSize / 2;
  const r = tokenSize / 2 - 3;
  const theme = TEAM_COLOR_PALETTE[colorId] ?? TEAM_COLOR_PALETTE.red;

  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const sx = natW * 0.24;
  const sy = natH * 0.11;
  const sw = natW * 0.52;
  const sh = natH * 0.52;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const baseGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  baseGrad.addColorStop(0, theme.lightHex);
  baseGrad.addColorStop(0.55, theme.hex);
  baseGrad.addColorStop(1, theme.darkHex);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, tokenSize, tokenSize);

  ctx.save();
  ctx.globalAlpha = skinId === 'default' ? 0.55 : 0.72;
  ctx.globalCompositeOperation = 'luminosity';
  ctx.drawImage(img, sx, sy, sw, sh, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  if (skinId === 'gold_trim') {
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(img, sx, sy, sw, sh, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.fillRect(cx - 4, 0, 8, tokenSize);
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (skinId === 'bolt') {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, sx, sy, sw, sh, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.95, cy + r * 0.6);
    ctx.lineTo(cx + r * 0.95, cy - r * 0.6);
    ctx.stroke();
  } else {
    ctx.strokeStyle = theme.isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.82, r * 0.42, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }

  const shade = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.34, r * 0.08, cx, cy, r);
  shade.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  shade.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, tokenSize, tokenSize);
  ctx.restore();

  return out;
}

function loadJerseySkin(skinId: JerseySkinId): void {
  if (typeof window === 'undefined' || loadingStarted[skinId]) return;
  loadingStarted[skinId] = true;

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    loadedImages[skinId] = img;
    listeners.forEach((cb) => cb());
  };
  img.src = JERSEY_RAW_URLS[skinId];
}

export function preloadAllJerseySprites(): void {
  loadJerseySkin('default');
  loadJerseySkin('gold_trim');
  loadJerseySkin('bolt');
}

export function preloadJerseySkin(skinId: JerseySkinId): void {
  loadJerseySkin(skinId);
}

export function getJerseyTokenSprite(
  skinId: JerseySkinId,
  colorId: TeamColorId
): HTMLCanvasElement | null {
  if (!loadingStarted[skinId]) {
    loadJerseySkin(skinId);
  }
  const key = `${skinId}_${colorId}`;
  if (tokenSpriteCache[key]) return tokenSpriteCache[key];
  const img = loadedImages[skinId];
  if (img) {
    const built = buildPitchJerseyToken(img, skinId, colorId);
    tokenSpriteCache[key] = built;
    return built;
  }
  return null;
}

export function getJerseyPreviewUrl(skinId: JerseySkinId): string {
  if (!loadingStarted[skinId]) {
    loadJerseySkin(skinId);
  }
  if (previewUrlCache[skinId]) {
    return previewUrlCache[skinId]!;
  }
  const img = loadedImages[skinId];
  if (img) {
    const preview = buildShopJerseyPreview(img);
    if (preview) {
      previewUrlCache[skinId] = preview;
      return preview;
    }
  }
  return JERSEY_RAW_URLS[skinId];
}

export function subscribeJerseySprites(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
