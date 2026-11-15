import React, { useEffect, useState } from 'react';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Crown,
  Home,
  Play,
  RotateCcw,
  Trophy,
  Users,
} from 'lucide-react';
import type { LeagueStandingRow, LeagueStateInfo, RoomMemberInfo } from '../game/types';

interface LeagueOverlayProps {
  league: LeagueStateInfo;
  isSolo: boolean;
  isHost: boolean;
  localSlotIndex: number | null;
  members?: RoomMemberInfo[];
  onStartNextMatch: () => void;
  onBackToLobby?: () => void;
  onRestartSoloLeague?: () => void;
  onLeaveToMenu: () => void;
}

export const LeagueOverlay: React.FC<LeagueOverlayProps> = ({
  league,
  isSolo,
  isHost,
  localSlotIndex,
  members = [],
  onStartNextMatch,
  onBackToLobby,
  onRestartSoloLeague,
  onLeaveToMenu,
}) => {
  const totalWeeks = league.size - 1;
  const preferredWeek =
    league.phase === 'finished'
      ? totalWeeks - 1
      : league.lastCompletedWeekIndex !== null && league.lastCompletedWeekIndex !== undefined
        ? league.lastCompletedWeekIndex
        : league.currentWeekIndex;

  const [mobilePanel, setMobilePanel] = useState<'standings' | 'fixtures'>('standings');
  const [displayedWeekIndex, setDisplayedWeekIndex] = useState<number>(preferredWeek);

  useEffect(() => {
    setDisplayedWeekIndex(
      league.phase === 'finished'
        ? totalWeeks - 1
        : league.lastCompletedWeekIndex !== null && league.lastCompletedWeekIndex !== undefined
          ? league.lastCompletedWeekIndex
          : league.currentWeekIndex
    );
  }, [league.phase, league.lastCompletedWeekIndex, league.currentWeekIndex, totalWeeks]);

  const safeDisplayedWeek = Math.max(0, Math.min(totalWeeks - 1, displayedWeekIndex));
  const weekMatches = league.matches.filter((m) => m.weekIndex === safeDisplayedWeek);
  const isDisplayedWeekFinished =
    weekMatches.length > 0 && weekMatches.every((m) => m.status === 'finished');
  const currentMatch = league.currentMatchId
    ? league.matches.find((m) => m.id === league.currentMatchId) ?? null
    : null;

  const championRow = league.standings[0] ?? null;
  const localRank =
    localSlotIndex !== null
      ? league.standings.findIndex((r) => r.slotIndex === localSlotIndex) + 1
      : 0;
  const rewardPreviewCoins =
    localRank === 1 ? 150 : localRank === 2 ? 50 : localRank === 3 ? 25 : 0;

  const getSlotPlayersLabel = (slotIndex: number): string | null => {
    if (isSolo) return slotIndex === localSlotIndex ? 'Sen' : null;
    const slotMembers = members.filter((m) => m.team !== 'spec' && m.tournamentSlot === slotIndex);
    if (slotMembers.length === 0) return null;
    return slotMembers.map((m) => m.name).join(', ');
  };

  const halfStandings = Math.ceil(league.standings.length / 2);
  const leftStandings = league.standings.slice(0, halfStandings);
  const rightStandings = league.standings.slice(halfStandings);

  const renderStandingsSubtable = (rows: LeagueStandingRow[], startRank: number) => (
    <table className="w-full text-left text-[9.5px] sm:text-[10.5px] border-collapse">
      <thead className="text-slate-400 border-b border-white/10">
        <tr>
          <th className="py-1 px-1.5 font-medium w-5">#</th>
          <th className="py-1 px-1 font-medium">Takım</th>
          <th className="py-1 px-1 text-right font-medium">O</th>
          <th className="py-1 px-1 text-right font-medium">G</th>
          <th className="py-1 px-1 text-right font-medium">AV</th>
          <th className="py-1 px-1.5 text-right font-bold text-white">P</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/8">
        {rows.map((row, idx) => {
          const rank = startRank + idx;
          const isMine = localSlotIndex !== null && row.slotIndex === localSlotIndex;
          const gd = row.gf - row.ga;
          return (
            <tr
              key={row.slotIndex}
              className={
                isMine
                  ? 'bg-amber-500/20 text-amber-100 font-bold'
                  : rank <= 3
                    ? 'bg-emerald-500/10 text-white'
                    : 'hover:bg-white/5 text-slate-200'
              }
            >
              <td className="py-0.5 px-1.5 font-mono-num font-bold text-slate-300 tabular-nums">
                {rank}
              </td>
              <td className="py-0.5 px-1 truncate max-w-[110px]">
                <span>{row.name}</span>
                {isMine && (
                  <span className="ml-1 text-[8.5px] font-bold text-amber-300">(Sen)</span>
                )}
              </td>
              <td className="py-0.5 px-1 text-right font-mono-num tabular-nums">{row.played}</td>
              <td className="py-0.5 px-1 text-right font-mono-num text-emerald-300 tabular-nums">
                {row.won}
              </td>
              <td className="py-0.5 px-1 text-right font-mono-num tabular-nums">
                {gd > 0 ? `+${gd}` : gd}
              </td>
              <td className="py-0.5 px-1.5 text-right font-mono-num font-extrabold text-white tabular-nums">
                {row.points}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 z-40 w-full h-full overflow-hidden bg-slate-950/95 text-white flex flex-col justify-between gap-1.5 pt-[max(0.35rem,env(safe-area-inset-top))] pb-[max(0.35rem,env(safe-area-inset-bottom))] pl-[max(0.65rem,env(safe-area-inset-left))] pr-[max(0.65rem,env(safe-area-inset-right))] sm:p-4 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-xs sm:text-base leading-tight">
              SahaBall Süper Ligi · Hafta {league.currentWeekIndex + 1} / {league.size - 1}
            </h2>
            <p className="text-[10px] text-slate-400">
              {league.size} Takım · 1. +150 · 2. +50 · 3. +25 Jeton
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-white/8 border border-white/10 min-[740px]:hidden">
            <button
              type="button"
              onClick={() => setMobilePanel('standings')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-display font-bold transition-colors ${
                mobilePanel === 'standings' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              Puan Durumu
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel('fixtures')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-display font-bold transition-colors ${
                mobilePanel === 'fixtures' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
              }`}
            >
              {safeDisplayedWeek + 1}. Hafta
            </button>
          </div>

          {!isSolo && (
            <div className="px-2.5 py-1 rounded-lg bg-white/8 border border-white/10 text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{members.length} Oyuncu</span>
            </div>
          )}
        </div>
      </div>

      {/* Season Finished Champion Banner */}
      {league.phase === 'finished' && championRow && (
        <div
          className={`px-3 py-2 rounded-xl border flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            localRank === 1
              ? 'bg-gradient-to-r from-amber-500/25 via-emerald-500/20 to-amber-500/25 border-amber-400/60'
              : 'bg-white/8 border-white/15'
          }`}
        >
          <div className="flex items-center gap-2">
            <Crown
              className={`w-5 h-5 shrink-0 ${localRank === 1 ? 'text-amber-300' : 'text-slate-300'}`}
            />
            <div>
              <div className="font-display font-extrabold text-xs sm:text-sm text-white">
                {localRank === 1
                  ? 'TEBRİKLER! LİG ŞAMPİYONU OLDUN!'
                  : `Lig Şampiyonu: ${championRow.name} (${championRow.points} Puan)`}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-300">
                {localRank > 0
                  ? `Takımın sezonu ${localRank}. sırada tamamladı.`
                  : `${league.size - 1} haftalık sezon sona erdi.`}
              </div>
            </div>
          </div>

          {rewardPreviewCoins > 0 && (
            <div className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-display font-extrabold text-[11px] flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              <span>+{rewardPreviewCoins} Jeton ({localRank}. Sıra)</span>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Zero-Scroll Main Area */}
      <div className="flex-1 min-h-0 grid grid-cols-1 min-[740px]:grid-cols-12 gap-2.5 items-stretch overflow-hidden">
        {/* Standings Split into 2 Side-by-Side 9-Row Tables so all 18 fit without scroll */}
        <div
          className={`min-[740px]:col-span-7 rounded-xl border border-white/10 bg-white/5 p-2 flex flex-col justify-between overflow-hidden ${
            mobilePanel === 'standings' ? 'flex' : 'hidden min-[740px]:flex'
          }`}
        >
          <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-1 shrink-0">
            <span className="font-display font-bold text-xs text-emerald-300">Puan Durumu (18 Takım)</span>
            <span className="text-[10px] text-slate-400">1: +150 · 2: +50 · 3: +25 J</span>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-2 gap-2 items-start overflow-hidden">
            <div className="rounded-lg bg-black/20 border border-white/5 overflow-hidden">
              {renderStandingsSubtable(leftStandings, 1)}
            </div>
            <div className="rounded-lg bg-black/20 border border-white/5 overflow-hidden">
              {renderStandingsSubtable(rightStandings, halfStandings + 1)}
            </div>
          </div>
        </div>

        {/* Week Results / Fixtures (9 matches in compact grid) */}
        <div
          className={`min-[740px]:col-span-5 rounded-xl border border-white/10 bg-white/5 p-2 flex flex-col justify-between gap-1.5 overflow-hidden ${
            mobilePanel === 'fixtures' ? 'flex' : 'hidden min-[740px]:flex'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                aria-label="Önceki Hafta"
                disabled={safeDisplayedWeek <= 0}
                onClick={() => setDisplayedWeekIndex((w) => Math.max(0, w - 1))}
                className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-35 flex items-center justify-center text-white shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-display font-bold text-xs text-amber-300 truncate">
                {safeDisplayedWeek + 1}. Hafta {isDisplayedWeekFinished ? 'Sonuçları' : 'Fikstürü'}
              </span>
              <button
                type="button"
                aria-label="Sonraki Hafta"
                disabled={safeDisplayedWeek >= totalWeeks - 1}
                onClick={() => setDisplayedWeekIndex((w) => Math.min(totalWeeks - 1, w + 1))}
                className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-35 flex items-center justify-center text-white shrink-0 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {league.phase === 'fixtures' && safeDisplayedWeek !== league.currentWeekIndex ? (
              <button
                type="button"
                onClick={() => setDisplayedWeekIndex(league.currentWeekIndex)}
                className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-display font-bold text-[10px] shrink-0 whitespace-nowrap cursor-pointer"
              >
                {league.currentWeekIndex + 1}. Hafta →
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 shrink-0">{weekMatches.length} Maç</span>
            )}
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 gap-1 content-between overflow-hidden">
            {weekMatches.map((m) => {
              const isCurrent = m.id === league.currentMatchId;
              const teamA = league.teams[m.teamAIndex];
              const teamB = league.teams[m.teamBIndex];
              const mineA = localSlotIndex === m.teamAIndex;
              const mineB = localSlotIndex === m.teamBIndex;
              const pA = getSlotPlayersLabel(m.teamAIndex);
              const pB = getSlotPlayersLabel(m.teamBIndex);

              return (
                <div
                  key={m.id}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] sm:text-[10.5px] flex items-center justify-between gap-1.5 ${
                    isCurrent
                      ? 'bg-emerald-950/60 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.18)]'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div
                    className={`flex-1 min-w-0 text-right truncate ${
                      mineA ? 'text-amber-300 font-bold' : 'text-white'
                    }`}
                  >
                    {teamA}
                    {pA && !isSolo ? ` (${pA})` : ''}
                  </div>

                  <div className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-white/10 font-mono-num font-bold text-[10px] shrink-0 tabular-nums">
                    {m.status === 'finished' ? `${m.scoreA} - ${m.scoreB}` : 'vs'}
                  </div>

                  <div
                    className={`flex-1 min-w-0 text-left truncate ${
                      mineB ? 'text-amber-300 font-bold' : 'text-white'
                    }`}
                  >
                    {teamB}
                    {pB && !isSolo ? ` (${pB})` : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {currentMatch && league.phase === 'fixtures' && (
            <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-[10px] text-emerald-200 text-center truncate shrink-0">
              Sıradaki Maç: <strong>{league.teams[currentMatch.teamAIndex]}</strong> vs{' '}
              <strong>{league.teams[currentMatch.teamBIndex]}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLeaveToMenu}
            className="min-h-[38px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/25 text-white text-xs sm:text-sm font-display font-bold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Ana Menü</span>
          </button>

          {!isSolo && isHost && onBackToLobby && (
            <button
              type="button"
              onClick={onBackToLobby}
              className="min-h-[38px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/25 text-white text-xs sm:text-sm font-display font-bold transition-colors whitespace-nowrap cursor-pointer"
            >
              Lobiye Dön
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {league.phase === 'fixtures' && currentMatch ? (
            isSolo || isHost ? (
              <button
                type="button"
                onClick={onStartNextMatch}
                className="min-h-[40px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-97 whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{league.currentWeekIndex + 1}. Hafta Maçını Başlat</span>
              </button>
            ) : (
              <span className="text-xs text-emerald-300 font-medium">
                Kurucunun sıradaki lig maçını başlatması bekleniyor...
              </span>
            )
          ) : (
            isSolo &&
            onRestartSoloLeague && (
              <button
                type="button"
                onClick={onRestartSoloLeague}
                className="min-h-[40px] px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-97 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Yeni Lig Sezonu</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
