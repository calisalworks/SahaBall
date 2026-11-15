export interface DevicePerfProfile {
  isTouch: boolean;
  isLowEnd: boolean;
  maxDpr: number;
  ballSpriteSize: number;
  jerseyTokenSize: number;
  maxGoalParticles: number;
  enableBallTrail: boolean;
  staminaSyncIntervalFrames: number;
}

let cachedProfile: DevicePerfProfile | null = null;

export function getDevicePerfProfile(): DevicePerfProfile {
  if (cachedProfile) return cachedProfile;
  if (typeof window === 'undefined') {
    cachedProfile = {
      isTouch: false,
      isLowEnd: false,
      maxDpr: 1.5,
      ballSpriteSize: 192,
      jerseyTokenSize: 112,
      maxGoalParticles: 28,
      enableBallTrail: true,
      staminaSyncIntervalFrames: 1,
    };
    return cachedProfile;
  }

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const cores = navigator.hardwareConcurrency || 4;
  const reportedMemGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const prefersReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const isLowEnd =
    prefersReducedMotion ||
    cores <= 2 ||
    (typeof reportedMemGb === 'number' && reportedMemGb <= 2) ||
    (isTouch && cores <= 4 && typeof reportedMemGb === 'number' && reportedMemGb <= 3);

  cachedProfile = {
    isTouch,
    isLowEnd,
    maxDpr: isLowEnd ? 1.5 : 2,
    ballSpriteSize: isLowEnd ? 144 : isTouch ? 176 : 224,
    jerseyTokenSize: isLowEnd ? 88 : isTouch ? 104 : 128,
    maxGoalParticles: isLowEnd ? 12 : isTouch ? 20 : 28,
    enableBallTrail: !isLowEnd,
    staminaSyncIntervalFrames: isLowEnd ? 3 : isTouch ? 2 : 1,
  };

  return cachedProfile;
}
