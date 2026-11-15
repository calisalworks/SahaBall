import React, { useRef, useState } from 'react';
import { Footprints, Gamepad2, RotateCcw, ArrowLeftRight, Zap } from 'lucide-react';
import {
  clampControlElement,
  DEFAULT_CONTROLS_LAYOUT,
  LEFT_HANDED_CONTROLS_LAYOUT,
} from '../game/controlsLayout';
import type { ControlElementId, ControlsLayoutConfig } from '../game/controlsLayout';

interface ControlLayoutEditorProps {
  layout: ControlsLayoutConfig;
  onChange: (next: ControlsLayoutConfig) => void;
}

const ELEMENT_META: Record<
  ControlElementId,
  { label: string; badgeClass: string; activeRing: string }
> = {
  joystick: {
    label: 'Joystick',
    badgeClass: 'bg-sky-500 text-white',
    activeRing: 'ring-4 ring-sky-400/75',
  },
  sprint: {
    label: 'Sprint',
    badgeClass: 'bg-amber-400 text-slate-950',
    activeRing: 'ring-4 ring-amber-300/85',
  },
  kick: {
    label: 'Şut',
    badgeClass: 'bg-emerald-500 text-slate-950',
    activeRing: 'ring-4 ring-emerald-300/85',
  },
};

export const ControlLayoutEditor: React.FC<ControlLayoutEditorProps> = ({ layout, onChange }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<ControlElementId>('kick');
  const draggingRef = useRef<{ id: ControlElementId; pointerId: number } | null>(null);

  const selected = layout[selectedId];

  const updateElementFromPointer = (id: ControlElementId, clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    const updated = clampControlElement({ ...layout[id], xPct: rawX, yPct: rawY }, layout[id]);
    onChange({
      ...layout,
      [id]: updated,
    });
  };

  const handleElementDown = (id: ControlElementId, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setSelectedId(id);
    draggingRef.current = { id, pointerId: e.pointerId };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture unsupported
    }
    updateElementFromPointer(id, e.clientX, e.clientY);
  };

  const handleElementMove = (id: ControlElementId, e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    if (draggingRef.current.id !== id || draggingRef.current.pointerId !== e.pointerId) return;
    updateElementFromPointer(id, e.clientX, e.clientY);
  };

  const handleElementUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current?.pointerId === e.pointerId) {
      draggingRef.current = null;
    }
  };

  const handleScaleChange = (val: number) => {
    const updated = clampControlElement({ ...selected, scale: val }, selected);
    onChange({ ...layout, [selectedId]: updated });
  };

  const handleOpacityChange = (val: number) => {
    const updated = clampControlElement({ ...selected, opacity: val }, selected);
    onChange({ ...layout, [selectedId]: updated });
  };

  return (
    <div className="mt-2.5 grid grid-cols-1 min-[560px]:grid-cols-12 gap-3 items-stretch">
      {/* Left/Top: Interactive Drag-and-Drop Pitch Canvas Preview */}
      <div className="min-[560px]:col-span-7 flex flex-col gap-1.5">
        <div
          ref={stageRef}
          className="relative w-full min-h-[185px] sm:min-h-[220px] flex-1 rounded-2xl overflow-hidden border-2 border-[#C7A972]/60 bg-gradient-to-b from-[#176437] to-[#12522C] shadow-inner select-none touch-none"
        >
          {/* Pitch Field Lines Preview */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 220"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
          >
            <rect x="18" y="18" width="364" height="184" fill="none" stroke="#fff" strokeWidth="2" />
            <line x1="200" y1="18" x2="200" y2="202" stroke="#fff" strokeWidth="2" />
            <circle cx="200" cy="110" r="28" fill="none" stroke="#fff" strokeWidth="2" />
            <rect x="18" y="64" width="44" height="92" fill="none" stroke="#fff" strokeWidth="2" />
            <rect x="338" y="64" width="44" height="92" fill="none" stroke="#fff" strokeWidth="2" />
          </svg>

          {/* Simulated Top HUD Safe Zone Indicator */}
          <div className="absolute inset-x-3 top-2 h-6 rounded-lg bg-slate-950/55 border border-white/15 flex items-center justify-center pointer-events-none">
            <span className="text-[9px] font-semibold text-white/75 tracking-wide">
              Üst Skor Paneli Alanı · Sürükleyerek Konumlandır
            </span>
          </div>

          {/* Draggable Joystick Preview */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Joystick Konumu"
            onPointerDown={(e) => handleElementDown('joystick', e)}
            onPointerMove={(e) => handleElementMove('joystick', e)}
            onPointerUp={handleElementUp}
            onPointerCancel={handleElementUp}
            style={{
              left: `${layout.joystick.xPct}%`,
              top: `${layout.joystick.yPct}%`,
              opacity: layout.joystick.opacity,
              transform: `translate(-50%, -50%) scale(${layout.joystick.scale})`,
            }}
            className={`absolute w-[56px] h-[56px] rounded-full border-2 border-white/65 bg-black/35 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-shadow ${
              selectedId === 'joystick' ? ELEMENT_META.joystick.activeRing : ''
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-white/80 border border-white flex items-center justify-center">
              <Gamepad2 className="w-3.5 h-3.5 text-slate-900" />
            </div>
          </div>

          {/* Draggable Sprint Preview */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Sprint Konumu"
            onPointerDown={(e) => handleElementDown('sprint', e)}
            onPointerMove={(e) => handleElementMove('sprint', e)}
            onPointerUp={handleElementUp}
            onPointerCancel={handleElementUp}
            style={{
              left: `${layout.sprint.xPct}%`,
              top: `${layout.sprint.yPct}%`,
              opacity: layout.sprint.opacity,
              transform: `translate(-50%, -50%) scale(${layout.sprint.scale})`,
            }}
            className={`absolute w-[48px] h-[48px] rounded-full border-2 border-amber-300/80 bg-slate-950/50 text-white flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-shadow ${
              selectedId === 'sprint' ? ELEMENT_META.sprint.activeRing : ''
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[7px] font-display font-bold leading-none mt-0.5">SPRİNT</span>
          </div>

          {/* Draggable Kick Preview */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Şut Konumu"
            onPointerDown={(e) => handleElementDown('kick', e)}
            onPointerMove={(e) => handleElementMove('kick', e)}
            onPointerUp={handleElementUp}
            onPointerCancel={handleElementUp}
            style={{
              left: `${layout.kick.xPct}%`,
              top: `${layout.kick.yPct}%`,
              opacity: layout.kick.opacity,
              transform: `translate(-50%, -50%) scale(${layout.kick.scale})`,
            }}
            className={`absolute w-[60px] h-[60px] rounded-full border-2 border-emerald-200/80 bg-emerald-950/55 text-white flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-shadow ${
              selectedId === 'kick' ? ELEMENT_META.kick.activeRing : ''
            }`}
          >
            <Footprints className="w-4 h-4 text-emerald-200" />
            <span className="text-[8.5px] font-display font-extrabold leading-none mt-0.5">ŞUT</span>
          </div>
        </div>
      </div>

      {/* Right/Bottom: Selected Element Sliders & Presets */}
      <div className="min-[560px]:col-span-5 flex flex-col justify-between gap-2.5">
        {/* Element Selector Tabs */}
        <div>
          <span className="block text-[11px] font-semibold text-slate-600 mb-1">
            Düzenlenecek Kontrol
          </span>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
            {(['joystick', 'sprint', 'kick'] as ControlElementId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                className={`min-h-[34px] rounded-lg text-xs font-display font-bold transition-colors ${
                  selectedId === id
                    ? ELEMENT_META[id].badgeClass + ' shadow-sm'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                {ELEMENT_META[id].label}
              </button>
            ))}
          </div>
        </div>

        {/* Size & Opacity Sliders */}
        <div className="p-2.5 rounded-xl bg-[#FAF4E8] border border-[#E5DEC9] space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#0B2545] mb-1">
              <span>Boyut ({ELEMENT_META[selectedId].label})</span>
              <span className="font-mono-num font-bold text-[#118C4F]">
                %{Math.round(selected.scale * 100)}
              </span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.45}
              step={0.05}
              value={selected.scale}
              onChange={(e) => handleScaleChange(Number(e.target.value))}
              className="w-full accent-[#118C4F] cursor-pointer h-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#0B2545] mb-1">
              <span>Şeffaflık (Görünürlük)</span>
              <span className="font-mono-num font-bold text-[#0B2545]">
                %{Math.round(selected.opacity * 100)}
              </span>
            </div>
            <input
              type="range"
              min={0.25}
              max={1}
              step={0.05}
              value={selected.opacity}
              onChange={(e) => handleOpacityChange(Number(e.target.value))}
              className="w-full accent-[#0B2545] cursor-pointer h-2"
            />
          </div>
        </div>

        {/* Preset & Reset Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange(LEFT_HANDED_CONTROLS_LAYOUT)}
            className="min-h-[38px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B2545] text-[11px] font-display font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Solak Modu</span>
          </button>

          <button
            type="button"
            onClick={() => onChange(DEFAULT_CONTROLS_LAYOUT)}
            className="min-h-[38px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B2545] text-[11px] font-display font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Varsayılan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
