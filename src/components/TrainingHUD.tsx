import React, { useState } from 'react';
import {
  Crosshair,
  Home,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { TrainingKeeperMode, TrainingStats } from '../game/training';
import { BOT_DIFFICULTY_LABELS } from '../game/types';
import type { BotDifficulty, PitchSize } from '../game/types';

interface TrainingHUDProps {
  stats: TrainingStats;
  gkMode: TrainingKeeperMode;
  gkCount: 1 | 2;
  gkDifficulty: BotDifficulty;
  pitchSize: PitchSize;
  isMuted: boolean;
  onChangeKeeperConfig: (mode: TrainingKeeperMode, count: 1 | 2, diff: BotDifficulty) => void;
  onChangePitchSize: (size: PitchSize) => void;
  onBringBall: () => void;
  onResetAll: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
}

const GK_MODES: Array<{ id: TrainingKeeperMode; label: string }> = [
  { id: 'none', label: 'Kalecisiz' },
  { id: 'static', label: 'Sabit' },
  { id: 'moving', label: 'Hareketli' },
];

const DIFFICULTIES: BotDifficulty[] = ['kolay', 'normal', 'zor', 'efsanevi'];

const PITCH_SIZES: Array<{ id: PitchSize; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Büyük' },
  { id: 'ellipse', label: 'Elips' },
];

export const TrainingHUD: React.FC<TrainingHUDProps> = ({
  stats,
  gkMode,
  gkCount,
  gkDifficulty,
  pitchSize,
  isMuted,
  onChangeKeeperConfig,
  onChangePitchSize,
  onBringBall,
  onResetAll,
  onToggleMute,
  onLeave,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 top-0 z-30 pointer-events-none pt-[max(0.45rem,env(safe-area-inset-top))] pl-[max(0.55rem,env(safe-area-inset-left))] pr-[max(0.55rem,env(safe-area-inset-right))] sm:px-4 sm:pt-2.5 flex flex-col gap-1.5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-1.5">
        {/* Left: Menu Back & Live Counters */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onLeave}
            className="min-h-[36px] sm:min-h-[40px] px-2.5 sm:px-3 rounded-xl bg-slate-950/82 hover:bg-slate-950 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden min-[520px]:inline">Ana Menü</span>
          </button>

          <div className="min-h-[36px] sm:min-h-[40px] px-2.5 rounded-xl bg-slate-950/82 border border-white/20 text-white flex items-center gap-2.5 text-[11px] font-display font-bold">
            <span className="text-emerald-300">
              Gol: <span className="font-mono-num text-white">{stats.goals}</span>
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-amber-300">
              Şut: <span className="font-mono-num text-white">{stats.shots}</span>
            </span>
            <span className="hidden sm:inline text-slate-400">·</span>
            <span className="hidden sm:inline text-sky-300">
              Kurtarış: <span className="font-mono-num text-white">{stats.saves}</span>
            </span>
          </div>
        </div>

        {/* Center/Right: Bring Ball, GK Panel Toggle, Reset, Sound, Fullscreen */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onBringBall}
            title="Topu Önüne Al"
            className="min-h-[36px] sm:min-h-[40px] px-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-300/40 text-white text-[11px] sm:text-xs font-display font-bold flex items-center gap-1"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Topu Getir</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            className={`min-h-[36px] sm:min-h-[40px] px-2.5 rounded-xl border text-[11px] sm:text-xs font-display font-bold flex items-center gap-1 transition-colors ${
              drawerOpen
                ? 'bg-amber-400 text-slate-950 border-amber-200'
                : 'bg-slate-950/82 hover:bg-slate-950 border-white/20 text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Kaleci & Saha</span>
          </button>

          <button
            type="button"
            onClick={onResetAll}
            title="Antrenmanı Sıfırla"
            aria-label="Antrenmanı Sıfırla"
            className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-slate-950/82 hover:bg-slate-950 border border-white/20 text-white flex items-center justify-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-slate-950/82 hover:bg-slate-950 border border-white/20 text-white flex items-center justify-center"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Top Training Tip Banner (All text fully visible above the pitch) */}
      {!drawerOpen && (
        <div className="self-center w-full max-w-2xl px-3 py-1.5 rounded-xl bg-slate-950/86 border border-emerald-400/35 text-center shadow-lg">
          <p className="text-[11px] sm:text-xs font-medium text-white leading-snug whitespace-normal break-words">
            <span className="font-display font-bold text-emerald-300">İpucu: </span>
            Serbestçe top sür, kaleye nişanlı şut çek ve <span className="text-amber-300 font-semibold">Kaleci &amp; Saha</span> menüsünden sabit/hareketli kaleci ayarla.
          </p>
        </div>
      )}

      {/* Collapsible Compact Training Setup Bar */}
      {drawerOpen && (
        <div className="pointer-events-auto self-center w-full max-w-3xl rounded-2xl bg-slate-950/92 border border-white/20 p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2 text-white">
          {/* Keeper Mode */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
              <Shield className="w-3 h-3 text-sky-400" />
              Kaleci:
            </span>
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-white/10">
              {GK_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeKeeperConfig(m.id, gkCount, gkDifficulty)}
                  className={`min-h-[28px] px-2 rounded-md text-[10px] font-display font-bold transition-colors ${
                    gkMode === m.id ? 'bg-emerald-500 text-slate-950' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Keeper Count (1 or 2 goals) & Difficulty */}
          {gkMode !== 'none' && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-300">Adet:</span>
                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-white/10">
                  {([1, 2] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => onChangeKeeperConfig(gkMode, cnt, gkDifficulty)}
                      className={`min-h-[28px] px-2 rounded-md text-[10px] font-display font-bold transition-colors ${
                        gkCount === cnt ? 'bg-amber-400 text-slate-950' : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {cnt === 1 ? '1 Kale' : '2 Kale'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-300">Zorluk:</span>
                <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-white/10">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onChangeKeeperConfig(gkMode, gkCount, d)}
                      className={`min-h-[28px] px-2 rounded-md text-[10px] font-display font-bold transition-colors ${
                        gkDifficulty === d
                          ? d === 'efsanevi'
                            ? 'bg-purple-500 text-white'
                            : d === 'zor'
                              ? 'bg-amber-400 text-slate-950'
                              : d === 'kolay'
                                ? 'bg-sky-400 text-slate-950'
                                : 'bg-white text-slate-950'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {BOT_DIFFICULTY_LABELS[d].label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Pitch Size */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-300">Saha:</span>
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-white/10">
              {PITCH_SIZES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChangePitchSize(p.id)}
                  className={`min-h-[28px] px-2 rounded-md text-[10px] font-display font-bold transition-colors ${
                    pitchSize === p.id ? 'bg-white text-slate-950' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
