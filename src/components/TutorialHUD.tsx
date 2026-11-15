import React from 'react';
import {
  CheckCircle2,
  Crosshair,
  GraduationCap,
  Home,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { TutorialStepMeta } from '../game/tutorial';

interface TutorialHUDProps {
  stepMeta: TutorialStepMeta;
  completed: boolean;
  firstTimeRewardCoins: number;
  bannerText: string | null;
  isMuted: boolean;
  onBringBall: () => void;
  onSkipStep: () => void;
  onRestart: () => void;
  onGoTraining: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
}

export const TutorialHUD: React.FC<TutorialHUDProps> = ({
  stepMeta,
  completed,
  firstTimeRewardCoins,
  bannerText,
  isMuted,
  onBringBall,
  onSkipStep,
  onRestart,
  onGoTraining,
  onToggleMute,
  onLeave,
}) => {
  return (
    <>
      {/* Top Tutorial Controls & Full-Visibility Instruction Tip Frame */}
      <div className="fixed inset-x-0 top-0 z-30 pointer-events-none pt-[max(0.45rem,env(safe-area-inset-top))] pl-[max(0.55rem,env(safe-area-inset-left))] pr-[max(0.55rem,env(safe-area-inset-right))] sm:px-4 sm:pt-2.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          {/* Back to Menu */}
          <button
            type="button"
            onClick={onLeave}
            className="pointer-events-auto min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-slate-950/88 hover:bg-slate-950 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden min-[520px]:inline">Ana Menü</span>
          </button>

          {/* Compact Step Counter Badge */}
          <div className="px-3 py-1 rounded-xl bg-slate-950/85 border border-emerald-400/35 text-[11px] font-display font-bold text-emerald-300 shadow-md flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono-num">
              ADIM {stepMeta.stepIndex + 1}/{stepMeta.totalSteps}
            </span>
          </div>

          {/* Right Quick Actions */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onBringBall}
              title="Topu Önüne Al"
              className="min-h-[38px] px-2 sm:px-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-300/40 text-white text-[11px] font-display font-bold flex items-center gap-1"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Topu Getir</span>
            </button>

            {!completed && (
              <button
                type="button"
                onClick={onSkipStep}
                title="Sonraki Adım"
                className="min-h-[38px] px-2 sm:px-2.5 rounded-xl bg-slate-950/88 hover:bg-slate-950 border border-white/20 text-amber-300 text-[11px] font-display font-bold flex items-center gap-1"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Geç</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
              className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-950/88 hover:bg-slate-950 border border-white/20 text-white flex items-center justify-center"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Full-Width Centered Tip Frame at Top of Game Screen (Zero Truncation) */}
        {!completed && (
          <div className="self-center w-full max-w-2xl px-3.5 py-2 rounded-xl bg-slate-950/90 border border-emerald-400/40 text-white shadow-xl text-center">
            <div className="text-[11px] font-display font-extrabold text-emerald-300">
              {stepMeta.title}
            </div>
            <div className="text-xs sm:text-[13px] font-semibold text-white leading-snug mt-0.5 whitespace-normal break-words">
              {stepMeta.instruction}
            </div>
            <div className="text-[10.5px] text-slate-300 leading-snug mt-0.5 whitespace-normal break-words">
              İpucu: {stepMeta.hint}
            </div>
          </div>
        )}
      </div>

      {/* Step Success Toast */}
      {bannerText && !completed && (
        <div className="fixed inset-x-0 top-28 z-25 pointer-events-none flex justify-center px-4">
          <div className="px-5 py-2 rounded-2xl bg-emerald-950/92 border border-emerald-400/50 shadow-2xl text-center">
            <div className="font-display font-extrabold text-lg sm:text-xl text-white">
              {bannerText}
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Completion Modal */}
      {completed && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-black/55">
          <div className="w-full max-w-md max-h-full overflow-y-auto bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl p-4 sm:p-5 text-white text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
              <GraduationCap className="w-6 h-6" />
            </div>

            <div>
              <h2 className="font-display font-extrabold text-xl text-white">
                Eğitim Tamamlandı!
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Top sürme, sprint, nişanlı şut ve kaleciye karşı gol atma becerilerini öğrendin.
              </p>
            </div>

            {firstTimeRewardCoins > 0 ? (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/35 text-amber-300 font-display font-extrabold text-sm">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-[10px] font-extrabold text-amber-950">
                  S
                </span>
                <span>+{firstTimeRewardCoins} Jeton Eğitim Ödülü</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>Eğitim ödülü daha önce alındı</span>
              </div>
            )}

            <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onLeave}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Ana Menü</span>
              </button>

              <button
                type="button"
                onClick={onRestart}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tekrar Oyna</span>
              </button>

              <button
                type="button"
                onClick={onGoTraining}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1.5 shadow-lg"
              >
                <Crosshair className="w-4 h-4" />
                <span>Serbest Antrenman</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
