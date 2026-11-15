import React from 'react';
import { ArrowLeft, CheckCircle2, Gift, PlayCircle } from 'lucide-react';

interface DailyRewardModalProps {
  open: boolean;
  claimedToday: boolean;
  rewardAmount: number;
  extraAdAmount?: number;
  onClaim: () => void;
  onWatchExtraAd: () => void;
  onClose: () => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
  open,
  claimedToday,
  rewardAmount,
  extraAdAmount = 10,
  onClaim,
  onWatchExtraAd,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 w-full h-full overflow-hidden bg-[#FAF4E8] text-[#0B2545] flex flex-col justify-between pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:p-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E5DEC9] shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 rounded-xl bg-[#0B2545] hover:bg-[#143766] border border-[#1E4A82] text-white text-xs sm:text-sm font-display font-extrabold flex items-center gap-1.5 shadow-[0_2px_0_#06162B] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Geri</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 hidden sm:flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4" />
            </div>
            <h2 className="font-display font-extrabold text-base sm:text-lg">Günlük Ödül</h2>
          </div>
        </div>
        <div className="w-16 shrink-0" />
      </div>

      {/* Fullscreen Center Content — Zero Scroll */}
      <div className="flex-1 min-h-0 flex items-center justify-center py-3">
        <div className="w-full max-w-2xl p-5 sm:p-8 rounded-3xl bg-white border border-[#E5DEC9] shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
          <div className="p-5 rounded-2xl bg-[#FAF4E8] border border-[#E5DEC9] text-center space-y-2.5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center">
              <Gift className="w-7 h-7" />
            </div>
            <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600/40 text-amber-950 font-display font-extrabold text-lg shadow-xs tabular-nums">
              <span>+{rewardAmount} Jeton</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
              {claimedToday
                ? 'Bugünkü günlük ödülünü aldın. Ekstra reklam izleyerek sınırsız jeton kazanabilirsin!'
                : 'Her gün giriş yaparak 10 jeton, ayrıca ekstra reklamlarla sınırsız jeton kazanabilirsin.'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {claimedToday ? (
              <div className="w-full min-h-[48px] rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Bugünkü Günlük Ödül Alındı</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClaim}
                className="w-full min-h-[48px] rounded-xl bg-[#118C4F] hover:bg-[#0E7943] text-white font-display font-extrabold text-sm sm:text-base shadow-[0_3px_0_#0A5D33] active:translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
              >
                Günlük Ödülü Al (+{rewardAmount} Jeton)
              </button>
            )}

            <button
              type="button"
              onClick={onWatchExtraAd}
              className="w-full min-h-[48px] rounded-xl bg-gradient-to-b from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 border border-amber-500 text-amber-950 font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_3px_0_#B45309] active:translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
            >
              <PlayCircle className="w-5 h-5" />
              <span>Ekstra Reklam İzle (+{extraAdAmount} Jeton)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
