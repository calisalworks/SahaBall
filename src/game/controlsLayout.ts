export type ControlElementId = 'joystick' | 'kick' | 'sprint';

export interface ControlElementLayout {
  xPct: number;
  yPct: number;
  scale: number;
  opacity: number;
}

export interface ControlsLayoutConfig {
  joystick: ControlElementLayout;
  kick: ControlElementLayout;
  sprint: ControlElementLayout;
}

export const DEFAULT_CONTROLS_LAYOUT: ControlsLayoutConfig = {
  joystick: { xPct: 14, yPct: 76, scale: 1, opacity: 0.92 },
  kick: { xPct: 88, yPct: 79, scale: 1, opacity: 0.94 },
  sprint: { xPct: 73, yPct: 72, scale: 1, opacity: 0.94 },
};

export const LEFT_HANDED_CONTROLS_LAYOUT: ControlsLayoutConfig = {
  joystick: { xPct: 86, yPct: 76, scale: 1, opacity: 0.92 },
  kick: { xPct: 12, yPct: 79, scale: 1, opacity: 0.94 },
  sprint: { xPct: 27, yPct: 72, scale: 1, opacity: 0.94 },
};

const STORAGE_KEY = 'sahaball_controls_layout_v1';

export function clampControlElement(
  el: Partial<ControlElementLayout> | undefined,
  fallback: ControlElementLayout
): ControlElementLayout {
  const xPct =
    typeof el?.xPct === 'number' && Number.isFinite(el.xPct)
      ? Math.max(7, Math.min(93, Math.round(el.xPct * 10) / 10))
      : fallback.xPct;
  const yPct =
    typeof el?.yPct === 'number' && Number.isFinite(el.yPct)
      ? Math.max(20, Math.min(91, Math.round(el.yPct * 10) / 10))
      : fallback.yPct;
  const scale =
    typeof el?.scale === 'number' && Number.isFinite(el.scale)
      ? Math.max(0.7, Math.min(1.45, Math.round(el.scale * 100) / 100))
      : fallback.scale;
  const opacity =
    typeof el?.opacity === 'number' && Number.isFinite(el.opacity)
      ? Math.max(0.25, Math.min(1, Math.round(el.opacity * 100) / 100))
      : fallback.opacity;

  return { xPct, yPct, scale, opacity };
}

export function normalizeControlsLayout(
  raw: Partial<ControlsLayoutConfig> | null | undefined
): ControlsLayoutConfig {
  return {
    joystick: clampControlElement(raw?.joystick, DEFAULT_CONTROLS_LAYOUT.joystick),
    kick: clampControlElement(raw?.kick, DEFAULT_CONTROLS_LAYOUT.kick),
    sprint: clampControlElement(raw?.sprint, DEFAULT_CONTROLS_LAYOUT.sprint),
  };
}

export function loadControlsLayout(): ControlsLayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONTROLS_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<ControlsLayoutConfig>;
    return normalizeControlsLayout(parsed);
  } catch {
    return DEFAULT_CONTROLS_LAYOUT;
  }
}

export function saveControlsLayout(cfg: ControlsLayoutConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage failures
  }
}
