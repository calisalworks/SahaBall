import React, { useEffect, useRef } from 'react';
import { Footprints, Zap } from 'lucide-react';
import { DEFAULT_CONTROLS_LAYOUT } from '../game/controlsLayout';
import type { ControlsLayoutConfig } from '../game/controlsLayout';
import { getDevicePerfProfile } from '../game/performance';
import type { PlayerInput } from '../game/types';

interface TouchControlsProps {
  inputRef: React.MutableRefObject<PlayerInput>;
  staminaRef: React.MutableRefObject<number>;
  layout?: ControlsLayoutConfig;
  disabled?: boolean;
}

const MAX_RADIUS = 24;
const DEADZONE = 0.015;
const RING_R = 35;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

export const TouchControls: React.FC<TouchControlsProps> = React.memo(({
  inputRef,
  staminaRef,
  layout = DEFAULT_CONTROLS_LAYOUT,
  disabled = false,
}) => {
  const restingStickRef = useRef<HTMLDivElement | null>(null);
  const activeStickRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const kickBtnRef = useRef<HTMLButtonElement | null>(null);
  const sprintBtnRef = useRef<HTMLButtonElement | null>(null);
  const staminaCircleRef = useRef<SVGCircleElement | null>(null);

  const stickPointerId = useRef<number | null>(null);
  const stickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const kickPointerId = useRef<number | null>(null);
  const sprintPointerId = useRef<number | null>(null);
  const kickLatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kickPressedAtRef = useRef<number>(0);

  const layoutRef = useRef<ControlsLayoutConfig>(layout);
  layoutRef.current = layout;

  const keysRef = useRef<Set<string>>(new Set());

  const setKickVisual = (active: boolean) => {
    const el = kickBtnRef.current;
    if (!el) return;
    if (active) {
      el.style.transform = 'scale(0.91)';
      el.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
      el.style.color = '#022c22';
      el.style.borderColor = 'rgba(255, 255, 255, 0.95)';
    } else {
      el.style.transform = 'scale(1)';
      el.style.backgroundColor = 'rgba(2, 44, 34, 0.42)';
      el.style.color = 'rgba(255, 255, 255, 0.96)';
      el.style.borderColor = 'rgba(255, 255, 255, 0.48)';
    }
  };

  const setSprintVisual = (active: boolean) => {
    const el = sprintBtnRef.current;
    if (!el) return;
    if (active) {
      el.style.transform = 'scale(0.92)';
      el.style.backgroundColor = 'rgba(250, 204, 21, 0.85)';
      el.style.color = '#0f172a';
      el.style.borderColor = 'rgba(254, 240, 138, 0.95)';
    } else {
      el.style.transform = 'scale(1)';
      el.style.backgroundColor = 'rgba(15, 23, 42, 0.38)';
      el.style.color = 'rgba(255, 255, 255, 0.96)';
      el.style.borderColor = 'rgba(255, 255, 255, 0.36)';
    }
  };

  const hideActiveStick = () => {
    if (activeStickRef.current) {
      activeStickRef.current.style.opacity = '0';
    }
    if (restingStickRef.current) {
      restingStickRef.current.style.opacity = String(layoutRef.current.joystick.opacity);
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
  };

  // Sync stamina ring directly via DOM without triggering React re-renders during gameplay
  useEffect(() => {
    let rafId = 0;
    let lastShown = -1;
    let frameCount = 0;
    const syncInterval = getDevicePerfProfile().staminaSyncIntervalFrames;
    const updateRing = () => {
      frameCount++;
      if (frameCount >= syncInterval) {
        frameCount = 0;
        const clamped = Math.max(0, Math.min(100, staminaRef.current));
        if (Math.abs(clamped - lastShown) >= 0.8) {
          lastShown = clamped;
          const circle = staminaCircleRef.current;
          if (circle) {
            circle.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - clamped / 100));
            circle.style.stroke = clamped > 25 ? '#FACC15' : '#FB7185';
          }
        }
      }
      rafId = requestAnimationFrame(updateRing);
    };
    rafId = requestAnimationFrame(updateRing);
    return () => cancelAnimationFrame(rafId);
  }, [staminaRef]);

  // Global pointer release fallback for Kick/Sprint so sliding slightly off a button never gets stuck
  useEffect(() => {
    const finishKick = (e: PointerEvent) => {
      if (kickPointerId.current !== e.pointerId) return;
      kickPointerId.current = null;
      const elapsed = performance.now() - kickPressedAtRef.current;
      if (elapsed < 85) {
        kickLatchTimerRef.current = setTimeout(() => {
          if (kickPointerId.current === null) {
            inputRef.current.kick = false;
            setKickVisual(false);
          }
          kickLatchTimerRef.current = null;
        }, 85 - elapsed);
      } else {
        inputRef.current.kick = false;
        setKickVisual(false);
      }
    };

    const finishSprint = (e: PointerEvent) => {
      if (sprintPointerId.current !== e.pointerId) return;
      sprintPointerId.current = null;
      inputRef.current.sprint = false;
      setSprintVisual(false);
    };

    const onGlobalUp = (e: PointerEvent) => {
      finishKick(e);
      finishSprint(e);
    };

    window.addEventListener('pointerup', onGlobalUp, { passive: true });
    window.addEventListener('pointercancel', onGlobalUp, { passive: true });
    return () => {
      window.removeEventListener('pointerup', onGlobalUp);
      window.removeEventListener('pointercancel', onGlobalUp);
    };
  }, [inputRef]);

  // Keyboard support for desktop / tablet keyboards
  useEffect(() => {
    const syncKeyboard = () => {
      if (disabled) return;
      const keys = keysRef.current;
      let kx = 0;
      let ky = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) ky -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) ky += 1;

      if (kx !== 0 && ky !== 0) {
        const inv = 1 / Math.SQRT2;
        kx *= inv;
        ky *= inv;
      }

      if (stickPointerId.current === null) {
        inputRef.current.dx = kx;
        inputRef.current.dy = ky;
      }
      if (kickPointerId.current === null) {
        const kDown = keys.has('Space') || keys.has('KeyX') || keys.has('KeyJ');
        inputRef.current.kick = kDown;
        setKickVisual(kDown);
      }
      if (sprintPointerId.current === null) {
        const sDown = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyK');
        inputRef.current.sprint = sDown;
        setSprintVisual(sDown);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysRef.current.add(e.code);
      syncKeyboard();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      syncKeyboard();
    };

    const onBlur = () => {
      keysRef.current.clear();
      if (stickPointerId.current === null) {
        inputRef.current.dx = 0;
        inputRef.current.dy = 0;
      }
      inputRef.current.kick = false;
      inputRef.current.sprint = false;
      setKickVisual(false);
      setSprintVisual(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [disabled, inputRef]);

  useEffect(() => {
    if (disabled) {
      stickPointerId.current = null;
      kickPointerId.current = null;
      sprintPointerId.current = null;
      if (kickLatchTimerRef.current) {
        clearTimeout(kickLatchTimerRef.current);
        kickLatchTimerRef.current = null;
      }
      hideActiveStick();
      setKickVisual(false);
      setSprintVisual(false);
      inputRef.current.dx = 0;
      inputRef.current.dy = 0;
      inputRef.current.kick = false;
      inputRef.current.sprint = false;
    }
  }, [disabled, inputRef]);

  useEffect(() => {
    return () => {
      if (kickLatchTimerRef.current) {
        clearTimeout(kickLatchTimerRef.current);
      }
    };
  }, []);

  const updateStickFromPoint = (px: number, py: number) => {
    const cx = stickCenterRef.current.x;
    const cy = stickCenterRef.current.y;
    const stickScale = layoutRef.current.joystick.scale || 1;
    const dx = (px - cx) / stickScale;
    const dy = (py - cy) / stickScale;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(MAX_RADIUS, dist);
    const angle = Math.atan2(dy, dx);

    const ox = dist > 0 ? Math.cos(angle) * clampedDist : 0;
    const oy = dist > 0 ? Math.sin(angle) * clampedDist : 0;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
    }

    const norm = clampedDist / MAX_RADIUS;
    if (norm < DEADZONE) {
      inputRef.current.dx = 0;
      inputRef.current.dy = 0;
    } else {
      const eased = Math.min(1, Math.pow((norm - DEADZONE) / (1 - DEADZONE), 0.48));
      inputRef.current.dx = Math.cos(angle) * eased;
      inputRef.current.dy = Math.sin(angle) * eased;
    }
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || stickPointerId.current !== null) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture unavailable
    }
    stickPointerId.current = e.pointerId;

    const joy = layoutRef.current.joystick;
    const isRightSide = joy.xPct > 50;
    const minX = isRightSide ? window.innerWidth * 0.48 : 56;
    const maxX = isRightSide ? window.innerWidth - 56 : window.innerWidth * 0.52;
    const clampedX = Math.max(minX, Math.min(maxX, e.clientX));
    const clampedY = Math.max(68, Math.min(window.innerHeight - 56, e.clientY));
    stickCenterRef.current = { x: clampedX, y: clampedY };

    if (restingStickRef.current) {
      restingStickRef.current.style.opacity = '0';
    }
    if (activeStickRef.current) {
      activeStickRef.current.style.transform = `translate3d(${clampedX - 52}px, ${clampedY - 52}px, 0) scale(${joy.scale})`;
      activeStickRef.current.style.opacity = String(joy.opacity);
    }

    updateStickFromPoint(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    updateStickFromPoint(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    stickPointerId.current = null;
    hideActiveStick();
    inputRef.current.dx = 0;
    inputRef.current.dy = 0;
  };

  const handleKickDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.stopPropagation();
    if (kickLatchTimerRef.current) {
      clearTimeout(kickLatchTimerRef.current);
      kickLatchTimerRef.current = null;
    }
    kickPointerId.current = e.pointerId;
    kickPressedAtRef.current = performance.now();
    inputRef.current.kick = true;
    setKickVisual(true);
  };

  const handleSprintDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.stopPropagation();
    sprintPointerId.current = e.pointerId;
    inputRef.current.sprint = true;
    setSprintVisual(true);
  };

  const isJoystickRight = layout.joystick.xPct > 50;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none touch-none">
      {/* Dynamic Analog Joystick Touch Capture Zone (follows left or right-handed custom layout) */}
      <div
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickUp}
        onPointerCancel={handleStickUp}
        className={`pointer-events-auto fixed bottom-0 w-[54%] h-[72%] touch-none ${
          isJoystickRight ? 'right-0' : 'left-0'
        }`}
        aria-label="Yön Kontrolü"
      />

      {/* Custom Resting Joystick Indicator (exact user position, scale & opacity) */}
      <div
        ref={restingStickRef}
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickUp}
        onPointerCancel={handleStickUp}
        style={{
          left: `${layout.joystick.xPct}%`,
          top: `${layout.joystick.yPct}%`,
          opacity: layout.joystick.opacity,
          transform: `translate(-50%, -50%) scale(${layout.joystick.scale})`,
        }}
        className="pointer-events-auto fixed w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-white/28 bg-black/20 flex items-center justify-center touch-none"
      >
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/30 border border-white/50 pointer-events-none" />
      </div>

      {/* Active Dynamic Joystick (DOM-driven transforms for zero React re-render lag) */}
      <div
        ref={activeStickRef}
        style={{ opacity: 0, transformOrigin: 'center center' }}
        className="fixed top-0 left-0 w-[104px] h-[104px] rounded-full border-2 border-white/50 bg-black/30 flex items-center justify-center pointer-events-none will-change-transform"
      >
        <div
          ref={knobRef}
          className="w-12 h-12 rounded-full bg-white/80 border-2 border-white will-change-transform"
        />
      </div>

      {/* Custom Positioned & Scaled Sprint Button Wrapper */}
      <div
        style={{
          left: `${layout.sprint.xPct}%`,
          top: `${layout.sprint.yPct}%`,
          opacity: layout.sprint.opacity,
          transform: `translate(-50%, -50%) scale(${layout.sprint.scale})`,
        }}
        className="pointer-events-auto fixed z-25 touch-none"
      >
        <button
          ref={sprintBtnRef}
          type="button"
          onPointerDown={handleSprintDown}
          aria-label="Sprint"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.38)',
            color: 'rgba(255, 255, 255, 0.96)',
            borderColor: 'rgba(255, 255, 255, 0.36)',
          }}
          className="relative w-[76px] h-[76px] sm:w-[86px] sm:h-[86px] rounded-full flex flex-col items-center justify-center touch-none focus:outline-none border-2 will-change-transform"
        >
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
            viewBox="0 0 80 80"
          >
            <circle
              cx="40"
              cy="40"
              r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="3.5"
            />
            <circle
              ref={staminaCircleRef}
              cx="40"
              cy="40"
              r={RING_R}
              fill="none"
              stroke="#FACC15"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={0}
            />
          </svg>
          <Zap className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
          <span className="text-[10px] sm:text-[11px] font-bold tracking-wide mt-0.5 font-display">
            SPRİNT
          </span>
        </button>
      </div>

      {/* Custom Positioned & Scaled Şut (Kick) Button Wrapper */}
      <div
        style={{
          left: `${layout.kick.xPct}%`,
          top: `${layout.kick.yPct}%`,
          opacity: layout.kick.opacity,
          transform: `translate(-50%, -50%) scale(${layout.kick.scale})`,
        }}
        className="pointer-events-auto fixed z-25 touch-none"
      >
        <button
          ref={kickBtnRef}
          type="button"
          onPointerDown={handleKickDown}
          aria-label="Şut"
          style={{
            backgroundColor: 'rgba(2, 44, 34, 0.42)',
            color: 'rgba(255, 255, 255, 0.96)',
            borderColor: 'rgba(255, 255, 255, 0.48)',
          }}
          className="w-[94px] h-[94px] sm:w-[108px] sm:h-[108px] rounded-full flex flex-col items-center justify-center touch-none focus:outline-none border-2 will-change-transform"
        >
          <Footprints className="w-7 h-7 sm:w-8 sm:h-8" />
          <span className="text-xs sm:text-sm font-extrabold tracking-wider mt-0.5 font-display">
            ŞUT
          </span>
        </button>
      </div>
    </div>
  );
});
