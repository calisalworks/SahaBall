import React, { useState } from 'react';
import { ArrowLeft, Award, Check, Edit3, ShieldCheck, Star, Trophy, User } from 'lucide-react';
import {
  ACHIEVEMENTS,
  getLevelProgress,
  USERNAME_CHANGE_COST,
} from '../game/profile';
import type { ProfileData } from '../game/profile';

interface ProfileModalProps {
  open: boolean;
  playerName: string;
  coins: number;
  profile: ProfileData;
  ownedShopCount: number;
  onUpdateUsername: (newName: string) => { ok: boolean; error?: string };
  onClose: () => void;
}

const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  playerName,
  coins,
  profile,
  ownedShopCount,
  onUpdateUsername,
  onClose,
}) => {
  const [nameInput, setNameInput] = useState(playerName);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [tab, setTab] = useState<'overview' | 'achievements'>('overview');

  if (!open) return null;

  const progress = getLevelProgress(profile.stars);
  const isFreeChange = !profile.hasSetUsernameFree;
  const canAffordRename = isFreeChange || coins >= USERNAME_CHANGE_COST;
  const unlockedCount = ACHIEVEMENTS.filter(
    (a) => a.getCurrent(profile, ownedShopCount) >= a.target
  ).length;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onUpdateUsername(nameInput);
    if (res.ok) {
      setFeedback({
        type: 'ok',
        text: isFreeChange
          ? 'Kullanıcı adın ücretsiz olarak kaydedildi!'
          : 'Kullanıcı adın güncellendi (-5.000 Jeton).',
      });
    } else {
      setFeedback({
        type: 'err',
        text: res.error || 'Kullanıcı adı güncellenemedi.',
      });
    }
  };

  const handleGooglePrepClick = () => {
    setFeedback({
      type: 'info',
      text: 'Google ile giriş özelliği yakında aktif edilecek. İlk kullanıcı adı belirleme ücretsiz, sonraki değişiklikler 5.000 jeton olacaktır.',
    });
  };

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
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 hidden sm:flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-sm sm:text-lg leading-tight">
                Oyuncu Profili
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Seviye {progress.level} · {unlockedCount}/{ACHIEVEMENTS.length} Başarım
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white border border-[#E5DEC9]">
            <button
              type="button"
              onClick={() => setTab('overview')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-display font-bold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'overview' ? 'bg-[#0B2545] text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              Profil
            </button>
            <button
              type="button"
              onClick={() => setTab('achievements')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-display font-bold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                tab === 'achievements' ? 'bg-[#0B2545] text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Başarımlar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Zero-Scroll Body */}
      <div className="flex-1 min-h-0 py-3 flex flex-col overflow-hidden">
        {tab === 'overview' ? (
          <div className="flex-1 min-h-0 grid grid-cols-1 min-[580px]:grid-cols-12 gap-3 sm:gap-5 items-stretch">
            {/* Left Column: Level & Stars + Stats */}
            <div className="min-[580px]:col-span-6 flex flex-col justify-between gap-3">
              <div className="flex-1 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0B2545] to-[#143B6B] text-white shadow-md flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-400 text-amber-950 font-display font-extrabold text-lg sm:text-xl flex flex-col items-center justify-center leading-none shadow-xs shrink-0">
                      <span className="text-[9px] uppercase tracking-wider opacity-80">SV</span>
                      <span>{progress.level}</span>
                    </div>
                    <div>
                      <div className="font-display font-extrabold text-base sm:text-xl">
                        Seviye {progress.level} / 100
                      </div>
                      <div className="text-xs text-sky-200/90">
                        {progress.isMaxLevel
                          ? 'Maksimum seviyeye ulaştın!'
                          : `Sonraki seviye için ${100 - progress.currentInLevel} yıldız`}
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 flex items-center gap-1.5 shrink-0">
                    <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span className="font-mono-num font-extrabold text-base text-amber-200 tabular-nums">
                      {profile.stars}
                    </span>
                    <span className="text-xs text-white/80 font-semibold">Yıldız</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2.5 w-full rounded-full bg-white/15 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(3, progress.pct)}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-400 transition-all duration-300"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-sky-200/85 font-medium">
                    <span>Bilgisayara karşı: Galibiyet +10★ · Mağlubiyet +5★</span>
                    <span className="font-mono-num tabular-nums">{progress.currentInLevel}/100★</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 shrink-0">
                <div className="p-2.5 sm:p-3 rounded-2xl bg-white border border-[#E5DEC9] text-center">
                  <div className="font-mono-num font-extrabold text-base sm:text-xl text-emerald-700 tabular-nums">
                    {profile.soloWins}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500">Bot Galibiyet</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-white border border-[#E5DEC9] text-center">
                  <div className="font-mono-num font-extrabold text-base sm:text-xl text-rose-600 tabular-nums">
                    {profile.soloLosses}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500">Bot Mağlubiyet</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-white border border-[#E5DEC9] text-center">
                  <div className="font-mono-num font-extrabold text-base sm:text-xl text-sky-700 tabular-nums">
                    {profile.onlineMatches}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500">Çevrimiçi Maç</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-white border border-[#E5DEC9] text-center">
                  <div className="font-mono-num font-extrabold text-base sm:text-xl text-amber-700 tabular-nums">
                    {profile.totalGoals}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500">Toplam Gol</div>
                </div>
              </div>
            </div>

            {/* Right Column: Google Prep + Username Change */}
            <div className="min-[580px]:col-span-6 flex flex-col justify-between gap-3">
              {/* Google Sign-In Preparation Box */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF4E8] border border-[#E5DEC9] flex items-center justify-center shrink-0">
                    <GoogleGIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-sm text-[#0B2545]">
                        Google Hesabı
                      </span>
                      <span className="text-[10px] font-bold text-sky-700">· Yakında</span>
                    </div>
                    <p className="text-xs text-slate-600 truncate">
                      Giriş yaparak profilini ve ilerlemeni yedekle
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGooglePrepClick}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#FAF4E8] hover:bg-[#F3E9D2] border border-[#DFCCA8] text-[#0B2545] text-xs font-display font-bold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <GoogleGIcon className="w-4 h-4" />
                  <span>Google ile Giriş</span>
                </button>
              </div>

              {/* Username Form */}
              <form
                onSubmit={handleSaveName}
                className="flex-1 p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E5DEC9] flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs sm:text-sm font-display font-bold text-[#0B2545] flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-emerald-700" />
                    <span>Kullanıcı Adı</span>
                  </label>
                  <span
                    className={`text-[11px] font-bold ${
                      isFreeChange ? 'text-emerald-700' : 'text-amber-800'
                    }`}
                  >
                    {isFreeChange ? 'İlk Belirleme Ücretsiz' : 'Değişiklik: 5.000 Jeton'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    maxLength={14}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      if (feedback) setFeedback(null);
                    }}
                    placeholder="Kullanıcı adın..."
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#FAF4E8] border border-[#E5DEC9] text-sm font-semibold text-[#0B2545] focus:outline-none focus:border-[#118C4F]"
                  />
                  <button
                    type="submit"
                    disabled={!canAffordRename}
                    className={`min-h-[42px] px-4 rounded-xl font-display font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                      canAffordRename
                        ? 'bg-[#118C4F] hover:bg-[#0E7943] text-white shadow-xs active:scale-97'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isFreeChange ? 'Ücretsiz Kaydet' : 'Değiştir (5.000 J)'}
                  </button>
                </div>

                {feedback ? (
                  <div
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                      feedback.type === 'ok'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : feedback.type === 'info'
                          ? 'bg-sky-50 border-sky-200 text-sky-900'
                          : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {feedback.text}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    İlk kullanıcı adını ücretsiz belirleyebilirsin; sonraki her değişiklik 5.000 jetondur.
                  </div>
                )}
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col justify-between gap-2.5 overflow-hidden">
            <div className="flex-1 min-h-0 grid grid-cols-2 min-[700px]:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
              {ACHIEVEMENTS.map((ach) => {
                const current = Math.min(ach.target, ach.getCurrent(profile, ownedShopCount));
                const done = current >= ach.target;
                const pct = Math.min(100, Math.round((current / ach.target) * 100));
                return (
                  <div
                    key={ach.id}
                    className={`p-3 sm:p-4 rounded-2xl border flex flex-col justify-between gap-2 ${
                      done
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-white border-[#E5DEC9]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          done
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#FAF4E8] border border-[#E5DEC9] text-slate-500'
                        }`}
                      >
                        {done ? <Check className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
                      </div>
                      <span className="font-mono-num text-xs font-bold text-slate-600 tabular-nums shrink-0">
                        {current}/{ach.target}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="font-display font-bold text-xs sm:text-sm text-[#0B2545] truncate">
                        {ach.title}
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{ach.description}</p>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all ${
                          done ? 'bg-emerald-600' : 'bg-amber-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-white border border-[#E5DEC9] flex items-center gap-2 text-xs text-slate-700 font-medium shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#118C4F] shrink-0" />
              <span>Başarımlar maç tamamladıkça otomatik olarak güncellenir.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
