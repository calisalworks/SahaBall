import React, { useState } from 'react';
import { Check, Home, PlayCircle, RotateCcw, Trophy } from 'lucide-react';
import { DEFAULT_TEAM_META, TEAM_COLOR_PALETTE } from '../game/types';
import type { MatchSummaryStats, TeamMetaMap } from '../game/types';
import { MatchRadarChart } from './MatchRadarChart';

interface MatchEndOverlayProps {
  summary: MatchSummaryStats;
  teamMeta?: TeamMetaMap;
  isOnline?: boolean;
  localPlayerId?: string | null;
  canRematch: boolean;
  earnedCoins: number;
  adDoubled: boolean;
  onWatchAdDouble: () => void;
  onRematch: () => void;
  onMainMenu: () => void;
  onBackToLobby?: () => void;
  tournamentMode?: boolean;
  tournamentContinueLabel?: string;
  onTournamentContinue?: () => void;
}

export const MatchEndOverlay: React.FC<MatchEndOverlayProps> = ({
  summary,
  teamMeta = DEFAULT_TEAM_META,
  isOnline = false,
  localPlayerId = null,
  canRematch,
  earnedCoins,
  adDoubled,
  onWatchAdDouble,
  onRematch,
  onMainMenu,
  onBackToLobby,
  tournamentMode = false,
  tournamentContinueLabel,
  onTournamentContinue,
}) => {
  const defaultSelectedId =
    (localPlayerId && summary.playerRows.find((r) => r.id === localPlayerId)?.id) ??
    summary.playerRows[0]?.id ??
    '';
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(defaultSelectedId);

  const redTheme = TEAM_COLOR_PALETTE[teamMeta.red.colorId];
  const blueTheme = TEAM_COLOR_PALETTE[teamMeta.blue.colorId];

  const headline =
    summary.winner === 'red'
      ? `${teamMeta.red.name} Kazandı`
      : summary.winner === 'blue'
      ? `${teamMeta.blue.name} Kazandı`
      : 'Maç Berabere Bitti';

  const headlineColor =
    summary.winner === 'red'
      ? redTheme.hex
      : summary.winner === 'blue'
      ? blueTheme.hex
      : '#FCD34D';

  const teamComparison = [
    {
      label: 'Top Hakimiyeti',
      red: `%${summary.redPossessionPct}`,
      blue: `%${summary.bluePossessionPct}`,
      redPct: summary.redPossessionPct,
    },
    {
      label: 'Toplam Şut',
      red: summary.redShots,
      blue: summary.blueShots,
      redPct:
        summary.redShots + summary.blueShots > 0
          ? (summary.redShots / (summary.redShots + summary.blueShots)) * 100
          : 50,
    },
    {
      label: 'İsabetli Şut',
      red: summary.redShotsOnTarget,
      blue: summary.blueShotsOnTarget,
      redPct:
        summary.redShotsOnTarget + summary.blueShotsOnTarget > 0
          ? (summary.redShotsOnTarget / (summary.redShotsOnTarget + summary.blueShotsOnTarget)) * 100
          : 50,
    },
    {
      label: 'Pas',
      red: summary.redPasses,
      blue: summary.bluePasses,
      redPct:
        summary.redPasses + summary.bluePasses > 0
          ? (summary.redPasses / (summary.redPasses + summary.bluePasses)) * 100
          : 50,
    },
    {
      label: 'Kurtarış',
      red: summary.redSaves,
      blue: summary.blueSaves,
      redPct:
        summary.redSaves + summary.blueSaves > 0
          ? (summary.redSaves / (summary.redSaves + summary.blueSaves)) * 100
          : 50,
    },
  ];

  const showOnlineAdButton = isOnline && !tournamentMode;
  const showSoloAdButton = !isOnline && !tournamentMode && earnedCoins > 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-5 bg-black/60 overflow-hidden">
      <div className="w-full max-w-4xl max-h-full overflow-y-auto bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl p-3 sm:p-4 text-white flex flex-col gap-2.5">
        {/* Top Row: Final Score & Winner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <h2
              style={{ color: headlineColor }}
              className="font-display font-extrabold text-base sm:text-xl"
            >
              {headline}
            </h2>
            <span className="text-[11px] text-slate-400">· {summary.durationPlayedSec} sn</span>
          </div>

          <div className="inline-flex items-center rounded-xl overflow-hidden border border-white/15 bg-white/5">
            <div
              style={{ backgroundColor: redTheme.hex }}
              className={`px-3 py-1 flex items-center gap-2 ${
                redTheme.isLight ? 'text-slate-950' : 'text-white'
              }`}
            >
              <span className="text-[10px] font-bold max-w-[85px] truncate">{teamMeta.red.name}</span>
              <span className="font-display font-extrabold text-lg sm:text-xl tabular-nums">
                {summary.redScore}
              </span>
            </div>
            <div className="px-2 py-1 text-xs font-bold text-slate-400">-</div>
            <div
              style={{ backgroundColor: blueTheme.hex }}
              className={`px-3 py-1 flex items-center gap-2 ${
                blueTheme.isLight ? 'text-slate-950' : 'text-white'
              }`}
            >
              <span className="font-display font-extrabold text-lg sm:text-xl tabular-nums">
                {summary.blueScore}
              </span>
              <span className="text-[10px] font-bold max-w-[85px] truncate">{teamMeta.blue.name}</span>
            </div>
          </div>
        </div>

        {/* Middle: Team Bars + D3 Radar Chart + Player Scoreboard Table */}
        <div className="grid grid-cols-1 min-[680px]:grid-cols-12 gap-2.5 items-start">
          {/* Left: Team Bars + Player Table */}
          <div className="min-[680px]:col-span-6 flex flex-col gap-2.5">
            <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              {teamComparison.map((row) => (
                <div key={row.label} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="font-mono-num text-white font-bold w-9 text-left">{row.red}</span>
                    <span className="text-slate-300">{row.label}</span>
                    <span className="font-mono-num text-white font-bold w-9 text-right">{row.blue}</span>
                  </div>
                  <div
                    style={{ backgroundColor: `${blueTheme.hex}99` }}
                    className="h-1.5 w-full rounded-full overflow-hidden flex"
                  >
                    <div
                      style={{
                        width: `${Math.max(4, Math.min(96, row.redPct))}%`,
                        backgroundColor: redTheme.hex,
                      }}
                      className="h-full transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    <th className="py-1.5 px-2 font-medium">Oyuncu</th>
                    <th className="py-1.5 px-1 font-medium text-right">Gol</th>
                    <th className="py-1.5 px-1 font-medium text-right">Şut</th>
                    <th className="py-1.5 px-1 font-medium text-right">Pas</th>
                    <th className="py-1.5 px-2 font-medium text-right">Mesafe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {summary.playerRows.slice(0, 6).map((row) => {
                    const isSelected = row.id === selectedPlayerId;
                    const dotColor = row.team === 'red' ? redTheme.hex : blueTheme.hex;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedPlayerId(row.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-white/12' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="py-1 px-2 font-medium flex items-center gap-1.5">
                          <span
                            style={{ backgroundColor: dotColor }}
                            className="w-2 h-2 rounded-full shrink-0"
                          />
                          <span className="truncate max-w-[95px] sm:max-w-[125px] text-white">
                            {row.name}
                          </span>
                        </td>
                        <td className="py-1 px-1 text-right font-mono-num font-bold text-white">
                          {row.goals}
                        </td>
                        <td className="py-1 px-1 text-right font-mono-num text-slate-300">
                          {row.shots}
                        </td>
                        <td className="py-1 px-1 text-right font-mono-num text-slate-300">
                          {row.passes}
                        </td>
                        <td className="py-1 px-2 text-right font-mono-num text-emerald-300 font-semibold">
                          {row.distanceMeters}m
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: D3 Radar Chart */}
          <div className="min-[680px]:col-span-6">
            <MatchRadarChart
              playerRows={summary.playerRows}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={setSelectedPlayerId}
            />
          </div>
        </div>

        {/* Bottom Actions & Earned Coins */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onMainMenu}
              className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Ana Menü</span>
            </button>
            {!tournamentMode && onBackToLobby && (
              <button
                type="button"
                onClick={onBackToLobby}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                Lobiye Dön
              </button>
            )}

            {!tournamentMode && (earnedCoins > 0 || (isOnline && adDoubled)) ? (
              <div className="min-h-[40px] px-3 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center gap-1.5 text-amber-300 font-display font-bold text-xs">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-[9px] font-extrabold text-amber-950">
                  J
                </span>
                <span>
                  +
                  {isOnline
                    ? earnedCoins + (adDoubled ? 25 : 0)
                    : adDoubled
                      ? earnedCoins * 2
                      : earnedCoins}{' '}
                  Jeton
                </span>
              </div>
            ) : tournamentMode ? (
              <div className="min-h-[40px] px-3 rounded-xl bg-white/5 border border-white/10 flex items-center text-slate-300 text-[11px] font-medium">
                Ödül sıralamaya göre sezon/turnuva sonunda verilir
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showOnlineAdButton &&
              (adDoubled ? (
                <span className="min-h-[40px] px-3.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 font-display font-bold text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>+25 Jeton Alındı</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onWatchAdDouble}
                  className="min-h-[40px] px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-transform active:scale-97"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Reklam İzle (+25 Jeton)</span>
                </button>
              ))}

            {showSoloAdButton &&
              (adDoubled ? (
                <span className="min-h-[40px] px-3.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 font-display font-bold text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>2x Jeton Alındı</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onWatchAdDouble}
                  className="min-h-[40px] px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-transform active:scale-97"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Reklam İzle (2x Jeton)</span>
                </button>
              ))}

            {tournamentMode ? (
              canRematch && onTournamentContinue ? (
                <button
                  type="button"
                  onClick={onTournamentContinue}
                  className="min-h-[40px] px-4.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-97"
                >
                  <Trophy className="w-4 h-4" />
                  <span>{tournamentContinueLabel || 'Turnuva Ağacına Geç'}</span>
                </button>
              ) : (
                <span className="text-xs text-emerald-300/90 font-medium">
                  Kurucu devam edebilir...
                </span>
              )
            ) : !isOnline && canRematch ? (
              <button
                type="button"
                onClick={onRematch}
                className="min-h-[40px] px-4.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-97"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Hızlı Rövanş</span>
              </button>
            ) : !isOnline ? (
              <span className="text-xs text-emerald-300/90 font-medium">
                Kurucu rövanşı başlatabilir...
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
