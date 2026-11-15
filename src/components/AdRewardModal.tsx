import React, { useEffect, useState } from 'react';
import { CheckCircle2, Play, Sparkles, X } from 'lucide-react';

interface AdRewardModalProps {
  open: boolean;
  title: string;
  rewardLabel: string;
  onComplete: () => void;
  onCancel: () => void;
}

const AD_DURATION_MS = 5000;

export const AdRewardModal: React.FC<AdRewardModalProps> = ({
  open,
  title,
  rewardLabel,
  onComplete,
  onCancel,
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!open) {
      setElapsedMs(0);
      return;
    }
    setElapsedMs(0);
    const start = performance.now();
    const timer = setInterval(() => {
      const diff = performance.now() - start;
      if (diff >= AD_DURATION_MS) {
        setElapsedMs(AD_DURATION_MS);
        clearInterval(timer);
      } else {
        setElapsedMs(diff);
      }
    }, 60);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const progressPct = Math.min(100, (elapsedMs / AD_DURATION_MS) * 100);
  const remainingSec = Math.max(0, Math.ceil((AD_DURATION_MS - elapsedMs) / 1000));
  const finished = elapsedMs >= AD_DURATION_MS;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-950 border border-white/15 rounded-2xl shadow-2xl p-4 sm:p-5 text-white flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              {finished ? <CheckCircle2 className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </span>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base">{title}</h3>
              <p className="text-[11px] text-amber-300 font-semibold">{rewardLabel}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Kapat"
            className="min-w-[36px] min-h-[36px] rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Simulated Rewarded Video Frame */}
        <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-emerald-900 via-slate-900 to-amber-900/50 border border-white/10 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-amber-300 font-display font-extrabold text-lg">
            <Sparkles className="w-5 h-5" />
            <span>SAHABALL SPONSOR</span>
          </div>
          <p className="mt-1 text-xs text-slate-200">
            {finished
              ? 'Ödülün hazır! Hemen hesabına aktarabilirsin.'
              : `Ödül için reklam izleniyor... (${remainingSec} sn)`}
          </p>

          <div className="mt-3 h-2 w-full rounded-full bg-black/40 overflow-hidden">
            <div
              style={{ width: `${progressPct}%` }}
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-75"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {!finished && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200"
            >
              Vazgeç
            </button>
          )}
          <button
            type="button"
            disabled={!finished}
            onClick={onComplete}
            className="min-h-[42px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-display font-bold text-sm transition-colors"
          >
            {finished ? 'Ödülü Al' : `Bekle (${remainingSec}s)`}
          </button>
        </div>
      </div>
    </div>
  );
};
