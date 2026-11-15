import React, { useEffect, useState } from 'react';
import { Award, Crown, Home, Play, RotateCcw, Trophy, Users } from 'lucide-react';
import { getTournamentRunnerUpSlot } from '../game/tournament';
import type { RoomMemberInfo, TournamentStateInfo } from '../game/types';

interface TournamentBracketOverlayProps {
  tournament: TournamentStateInfo;
  isSolo: boolean;
  isHost: boolean;
  localSlotIndex: number | null;
  members?: RoomMemberInfo[];
  championBonusCoins?: number;
  runnerUpBonusCoins?: number;
  onStartNextMatch: () => void;
  onBackToLobby?: () => void;
  onRestartSoloTournament?: () => void;
  onLeaveToMenu: () => void;
}

export const TournamentBracketOverlay: React.FC<TournamentBracketOverlayProps> = ({
  tournament,
  isSolo,
  isHost,
  localSlotIndex,
  members = [],
  championBonusCoins = 150,
  runnerUpBonusCoins = 75,
  onStartNextMatch,
  onBackToLobby,
  onRestartSoloTournament,
  onLeaveToMenu,
}) => {
  const totalRounds = Math.round(Math.log2(tournament.size));
  const rounds = Array.from({ length: totalRounds }, (_, r) =>
    tournament.matches
      .filter((m) => m.roundIndex === r)
      .sort((a, b) => a.matchIndex - b.matchIndex)
  );

  const currentMatch = tournament.currentMatchId
    ? tournament.matches.find((m) => m.id === tournament.currentMatchId) ?? null
    : null;

  const activeRoundIndex =
    tournament.phase === 'champion'
      ? totalRounds - 1
      : currentMatch
        ? currentMatch.roundIndex
        : 0;

  const preferredInitialRound =
    tournament.phase === 'champion'
      ? totalRounds - 1
      : tournament.lastCompletedRoundIndex !== null &&
          tournament.lastCompletedRoundIndex !== undefined
        ? tournament.lastCompletedRoundIndex
        : activeRoundIndex;

  const [selectedRound, setSelectedRound] = useState<number>(preferredInitialRound);

  useEffect(() => {
    setSelectedRound(
      tournament.phase === 'champion'
        ? totalRounds - 1
        : tournament.lastCompletedRoundIndex !== null &&
            tournament.lastCompletedRoundIndex !== undefined
          ? tournament.lastCompletedRoundIndex
          : activeRoundIndex
    );
  }, [tournament.phase, tournament.lastCompletedRoundIndex, activeRoundIndex, totalRounds]);

  const championTeam =
    tournament.championSlotIndex !== null
      ? tournament.teams.find((t) => t.slotIndex === tournament.championSlotIndex) ?? null
      : null;

  const runnerUpSlot = getTournamentRunnerUpSlot(tournament);
  const localTeamWonChampion =
    localSlotIndex !== null && tournament.championSlotIndex === localSlotIndex;
  const localTeamWonRunnerUp =
    localSlotIndex !== null && runnerUpSlot !== null && runnerUpSlot === localSlotIndex;

  const getSlotPlayersLabel = (slotIndex: number | null): string | null => {
    if (slotIndex === null) return null;
    if (isSolo) {
      return slotIndex === localSlotIndex ? 'Sen' : null;
    }
    const slotMembers = members.filter((m) => m.tournamentSlot === slotIndex);
    if (slotMembers.length === 0) return null;
    return slotMembers.map((m) => m.name).join(', ');
  };

  const renderTeamRow = (
    slotIndex: number | null,
    score: number | null,
    isWinner: boolean,
    isMatchPlayingOrPending: boolean
  ) => {
    const team =
      slotIndex !== null
        ? tournament.teams.find((t) => t.slotIndex === slotIndex) ?? null
        : null;
    const isMine = slotIndex !== null && slotIndex === localSlotIndex;
    const playersLabel = getSlotPlayersLabel(slotIndex);

    return (
      <div
        className={`flex items-center justify-between gap-1 px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs transition-colors ${
          isWinner
            ? 'bg-emerald-500/20 border border-emerald-400/45 text-white font-bold'
            : isMine
              ? 'bg-amber-500/15 border border-amber-400/35 text-amber-100 font-semibold'
              : 'bg-white/5 border border-white/10 text-slate-200'
        } ${team?.eliminated && !isWinner && !isMatchPlayingOrPending ? 'opacity-55' : ''}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              slotIndex === null
                ? 'bg-slate-600'
                : isMine
                  ? 'bg-amber-400'
                  : slotIndex % 2 === 0
                    ? 'bg-red-400'
                    : 'bg-blue-400'
            }`}
          />
          <div className="min-w-0 truncate">
            <span className="truncate">{team ? team.name : 'Bekleniyor...'}</span>
            {playersLabel && (
              <span className="ml-1 text-[9px] font-bold text-amber-300">
                ({playersLabel})
              </span>
            )}
          </div>
        </div>
        <span className="font-mono-num font-bold text-[11px] sm:text-xs shrink-0 text-white tabular-nums">
          {score !== null ? score : '-'}
        </span>
      </div>
    );
  };

  const safeRound = Math.max(0, Math.min(totalRounds - 1, selectedRound));
  const displayedMatches = rounds[safeRound] ?? [];

  const gridColsClass =
    displayedMatches.length >= 16
      ? 'grid-cols-2 sm:grid-cols-4'
      : displayedMatches.length >= 8
        ? 'grid-cols-2 sm:grid-cols-4'
        : displayedMatches.length >= 4
          ? 'grid-cols-2'
          : displayedMatches.length === 2
            ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto w-full'
            : 'grid-cols-1 max-w-md mx-auto w-full';

  return (
    <div className="fixed inset-0 z-40 w-full h-full overflow-hidden bg-slate-950/95 text-white flex flex-col justify-between gap-1.5 pt-[max(0.35rem,env(safe-area-inset-top))] pb-[max(0.35rem,env(safe-area-inset-bottom))] pl-[max(0.65rem,env(safe-area-inset-left))] pr-[max(0.65rem,env(safe-area-inset-right))] sm:p-4 select-none">
      {/* Header + Round Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-xs sm:text-base leading-tight">
              SahaBall Turnuva Ağacı
            </h2>
            <p className="text-[10px] text-slate-400">
              {tournament.size} Takımlı Eleme · 1. +{championBonusCoins} · 2. +{runnerUpBonusCoins} Jeton
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/8 border border-white/10">
            {rounds.map((rMatches, rIdx) => {
              const isActive = safeRound === rIdx;
              const isCurrentRound = currentMatch?.roundIndex === rIdx;
              return (
                <button
                  key={rIdx}
                  type="button"
                  onClick={() => setSelectedRound(rIdx)}
                  className={`min-h-[26px] sm:min-h-[30px] px-2 sm:px-2.5 rounded-lg text-[10px] sm:text-xs font-display font-bold transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : isCurrentRound
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {isCurrentRound && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  )}
                  <span>
                    {rMatches[0]?.roundLabel} ({rMatches.length})
                  </span>
                </button>
              );
            })}
          </div>

          {!isSolo && (
            <div className="px-2 py-1 rounded-lg bg-white/8 border border-white/10 text-[10px] sm:text-[11px] font-semibold text-slate-300 hidden sm:flex items-center gap-1.5 shrink-0">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{members.length} Oyuncu</span>
            </div>
          )}
        </div>
      </div>

      {/* Round Results Notice Strip when viewing finished round while next round is ready */}
      {tournament.phase === 'bracket' && currentMatch && safeRound !== currentMatch.roundIndex && (
        <div className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-between gap-2 text-[10.5px] sm:text-xs shrink-0">
          <span className="text-emerald-100 font-semibold truncate">
            {displayedMatches[0]?.roundLabel} turu sonuçları oluştu · Sıradaki tur:{' '}
            <strong className="text-emerald-300">{currentMatch.roundLabel}</strong>
          </span>
          <button
            type="button"
            onClick={() => setSelectedRound(currentMatch.roundIndex)}
            className="px-2.5 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-[10px] sm:text-[11px] shrink-0 whitespace-nowrap cursor-pointer"
          >
            {currentMatch.roundLabel} Eşleşmelerini Gör →
          </button>
        </div>
      )}

      {/* Champion or Runner-Up Banner */}
      {tournament.phase === 'champion' && championTeam && (
        <div
          className={`px-3 py-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            localTeamWonChampion
              ? 'bg-gradient-to-r from-amber-500/25 via-emerald-500/20 to-amber-500/25 border-amber-400/60'
              : localTeamWonRunnerUp
                ? 'bg-gradient-to-r from-slate-400/20 via-emerald-500/15 to-slate-400/20 border-slate-300/50'
                : 'bg-white/8 border-white/15'
          }`}
        >
          <div className="flex items-center gap-2">
            <Crown
              className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${
                localTeamWonChampion
                  ? 'text-amber-300'
                  : localTeamWonRunnerUp
                    ? 'text-slate-200'
                    : 'text-slate-400'
              }`}
            />
            <div>
              <div className="font-display font-extrabold text-xs sm:text-sm text-white">
                {localTeamWonChampion
                  ? 'TEBRİKLER! TURNUVA ŞAMPİYONU OLDUN!'
                  : localTeamWonRunnerUp
                    ? 'TEBRİKLER! TURNUVA 2.’Sİ OLDUN!'
                    : `Turnuva Şampiyonu: ${championTeam.name}`}
              </div>
              <div className="text-[10px] text-slate-300">
                {getSlotPlayersLabel(championTeam.slotIndex)
                  ? `Şampiyon Kadro: ${getSlotPlayersLabel(championTeam.slotIndex)}`
                  : `1. Takım +${championBonusCoins} Jeton · 2. Takım +${runnerUpBonusCoins} Jeton`}
              </div>
            </div>
          </div>

          {localTeamWonChampion && championBonusCoins > 0 ? (
            <div className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-display font-extrabold text-[11px] flex items-center gap-1 shadow-sm">
              <Award className="w-3.5 h-3.5" />
              <span>+{championBonusCoins} Jeton (1. Sıra)</span>
            </div>
          ) : localTeamWonRunnerUp && runnerUpBonusCoins > 0 ? (
            <div className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-950 font-display font-extrabold text-[11px] flex items-center gap-1 shadow-sm">
              <Award className="w-3.5 h-3.5" />
              <span>+{runnerUpBonusCoins} Jeton (2. Sıra)</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Selected Round Grid — Fits 100% Without Downward Scroll */}
      <div className={`flex-1 min-h-0 grid ${gridColsClass} gap-1 sm:gap-2 items-stretch overflow-hidden`}>
        {displayedMatches.map((m) => {
          const isCurrent = m.id === tournament.currentMatchId;
          const isPending = m.status !== 'finished';
          return (
            <div
              key={m.id}
              className={`px-1.5 py-1 sm:p-2 rounded-xl border flex flex-col justify-center gap-0.5 transition-all ${
                isCurrent
                  ? 'bg-emerald-950/60 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-wider px-0.5">
                <span className={isCurrent ? 'text-emerald-300' : 'text-slate-400'}>
                  {isCurrent ? 'Sıradaki Maç' : m.status === 'finished' ? 'Tamamlandı' : 'Bekliyor'}
                </span>
                <span className="text-slate-500">#{m.matchIndex + 1}</span>
              </div>
              {renderTeamRow(
                m.teamAIndex,
                m.scoreA,
                m.winnerSlotIndex !== null && m.winnerSlotIndex === m.teamAIndex,
                isPending
              )}
              {renderTeamRow(
                m.teamBIndex,
                m.scoreB,
                m.winnerSlotIndex !== null && m.winnerSlotIndex === m.teamBIndex,
                isPending
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLeaveToMenu}
            className="min-h-[40px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/25 text-white text-xs sm:text-sm font-display font-bold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Ana Menü</span>
          </button>

          {!isSolo && isHost && onBackToLobby && (
            <button
              type="button"
              onClick={onBackToLobby}
              className="min-h-[40px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/25 text-white text-xs sm:text-sm font-display font-bold transition-colors whitespace-nowrap cursor-pointer"
            >
              Lobiye Dön
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {tournament.phase === 'bracket' && currentMatch ? (
            isSolo || isHost ? (
              <button
                type="button"
                onClick={onStartNextMatch}
                className="min-h-[42px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-97 whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{currentMatch.roundLabel} Maçını Başlat</span>
              </button>
            ) : (
              <span className="text-xs text-emerald-300 font-medium">
                Kurucunun sıradaki maçı başlatması bekleniyor...
              </span>
            )
          ) : (
            isSolo &&
            onRestartSoloTournament && (
              <button
                type="button"
                onClick={onRestartSoloTournament}
                className="min-h-[42px] px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-97 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Yeni Turnuva</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
