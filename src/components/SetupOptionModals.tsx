import React from 'react';
import { Bot, Check, Clock, MapPin, Palette, Users, X } from 'lucide-react';
import {
  BOT_DIFFICULTY_LABELS,
  MODE_CONFIGS,
  PITCH_SIZE_LABELS,
  TEAM_COLOR_LIST,
  TEAM_COLOR_PALETTE,
} from '../game/types';
import type {
  ActiveTeam,
  BotDifficulty,
  GameMode,
  PitchSize,
  TeamColorId,
  TeamMetaMap,
} from '../game/types';

export type SetupModalKind = 'mode' | 'pitch' | 'duration' | 'teams' | 'difficulty' | null;

const MODES: GameMode[] = ['1v1', '2v2', '3v3', '4v4', '5v5'];
const PITCH_SIZES: PitchSize[] = ['normal', 'large', 'ellipse'];
const DURATIONS = [120, 180, 300];
const DIFFICULTIES: BotDifficulty[] = ['kolay', 'normal', 'zor', 'efsanevi'];

interface SetupOptionModalsProps {
  activeModal: SetupModalKind;
  onClose: () => void;
  mode: GameMode;
  onChangeMode: (m: GameMode) => void;
  pitchSize: PitchSize;
  onChangePitchSize: (p: PitchSize) => void;
  durationSec: number;
  onChangeDurationSec: (d: number) => void;
  teamMeta: TeamMetaMap;
  onChangeTeamMeta: (next: TeamMetaMap) => void;
  onlyOwnTeam?: boolean;
  soloTeam?: ActiveTeam;
  onChangeSoloTeam?: (t: ActiveTeam) => void;
  botDifficulty: BotDifficulty;
  onChangeBotDifficulty: (d: BotDifficulty) => void;
  /** Optional online bot count controls inside the difficulty modal */
  showBotCounts?: boolean;
  redBotCount?: number;
  blueBotCount?: number;
  onChangeRedBotCount?: (n: number) => void;
  onChangeBlueBotCount?: (n: number) => void;
}

export const SetupOptionModals: React.FC<SetupOptionModalsProps> = ({
  activeModal,
  onClose,
  mode,
  onChangeMode,
  pitchSize,
  onChangePitchSize,
  durationSec,
  onChangeDurationSec,
  teamMeta,
  onChangeTeamMeta,
  onlyOwnTeam = false,
  soloTeam,
  onChangeSoloTeam,
  botDifficulty,
  onChangeBotDifficulty,
  showBotCounts = false,
  redBotCount = 0,
  blueBotCount = 0,
  onChangeRedBotCount,
  onChangeBlueBotCount,
}) => {
  if (!activeModal) return null;

  const teamSize = MODE_CONFIGS[mode].teamSize;

  const titles: Record<Exclude<SetupModalKind, null>, { title: string; icon: React.ReactNode }> = {
    mode: { title: 'Maç Modu Seç', icon: <Users className="w-4 h-4 text-[#118C4F]" /> },
    pitch: { title: 'Saha Seç', icon: <MapPin className="w-4 h-4 text-[#118C4F]" /> },
    duration: { title: 'Maç Süresi Seç', icon: <Clock className="w-4 h-4 text-[#118C4F]" /> },
    teams: {
      title: onlyOwnTeam ? 'Kendi Takımın & Rengin' : 'Takım Adları ve Renkleri',
      icon: <Palette className="w-4 h-4 text-[#118C4F]" />,
    },
    difficulty: { title: 'Bot Zorluğu', icon: <Bot className="w-4 h-4 text-[#118C4F]" /> },
  };

  const currentMeta = titles[activeModal];

  const updateTeamField = (
    team: ActiveTeam,
    patch: Partial<{ name: string; colorId: TeamColorId }>
  ) => {
    onChangeTeamMeta({
      ...teamMeta,
      [team]: {
        ...teamMeta[team],
        ...patch,
      },
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[94dvh] overflow-y-auto bg-white border border-[#E5DEC9] rounded-2xl sm:rounded-3xl shadow-2xl p-3 sm:p-4 text-[#0B2545] flex flex-col gap-2 sm:gap-3"
      >
        <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#FAF4E8] border border-[#E5DEC9] flex items-center justify-center">
              {currentMeta.icon}
            </div>
            <h3 className="font-display font-extrabold text-sm sm:text-base">{currentMeta.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-w-[32px] min-h-[32px] sm:min-w-[34px] sm:min-h-[34px] rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Modal */}
        {activeModal === 'mode' && (
          <div className="grid grid-cols-5 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChangeMode(m);
                  onClose();
                }}
                className={`min-h-[42px] sm:min-h-[44px] rounded-xl text-xs sm:text-sm font-display font-extrabold border transition-colors ${
                  mode === m
                    ? 'bg-[#118C4F] text-white border-[#0D6E3E] shadow-xs'
                    : 'bg-[#FAF4E8] text-[#0B2545] border-[#E5DEC9] hover:bg-[#F3EAD5]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Pitch Modal */}
        {activeModal === 'pitch' && (
          <div className="space-y-1.5 sm:space-y-2">
            {PITCH_SIZES.map((ps) => {
              const info = PITCH_SIZE_LABELS[ps];
              const active = pitchSize === ps;
              return (
                <button
                  key={ps}
                  type="button"
                  onClick={() => {
                    onChangePitchSize(ps);
                    onClose();
                  }}
                  className={`w-full p-2.5 sm:p-3 rounded-xl border text-left flex items-center justify-between transition-colors ${
                    active
                      ? 'bg-emerald-50 border-[#118C4F] text-[#0B2545]'
                      : 'bg-[#FAF4E8] border-[#E5DEC9] text-[#0B2545] hover:bg-[#F3EAD5]'
                  }`}
                >
                  <div>
                    <div className="font-display font-extrabold text-sm">{info.label}</div>
                    <div className="text-[11px] text-slate-600">{info.desc}</div>
                  </div>
                  {active && (
                    <span className="w-6 h-6 rounded-full bg-[#118C4F] text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Duration Modal */}
        {activeModal === 'duration' && (
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((sec) => {
              const active = durationSec === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    onChangeDurationSec(sec);
                    onClose();
                  }}
                  className={`min-h-[48px] sm:min-h-[52px] rounded-xl border font-display font-extrabold text-sm transition-colors ${
                    active
                      ? 'bg-[#118C4F] text-white border-[#0D6E3E] shadow-xs'
                      : 'bg-[#FAF4E8] text-[#0B2545] border-[#E5DEC9] hover:bg-[#F3EAD5]'
                  }`}
                >
                  {sec / 60} Dakika
                </button>
              );
            })}
          </div>
        )}

        {/* Teams & Colors Modal */}
        {activeModal === 'teams' && (
          <div className="space-y-2 sm:space-y-3">
            {(onlyOwnTeam ? (['red'] as ActiveTeam[]) : (['red', 'blue'] as ActiveTeam[])).map(
              (tKey, idx) => {
                const info = teamMeta[tKey];
                const theme = TEAM_COLOR_PALETTE[info.colorId];
                const isSelectedSolo = soloTeam === tKey;
                return (
                  <div
                    key={tKey}
                    className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[#FAF4E8] border border-[#E5DEC9] space-y-1.5 sm:space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          style={{ backgroundColor: theme.hex }}
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                        />
                        <span className="text-xs font-display font-extrabold text-[#0B2545]">
                          {onlyOwnTeam ? 'Senin Takımın' : idx === 0 ? '1. Takım' : '2. Takım'}
                        </span>
                      </div>
                      {!onlyOwnTeam && onChangeSoloTeam && (
                        <button
                          type="button"
                          onClick={() => onChangeSoloTeam(tKey)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-display font-bold border transition-colors ${
                            isSelectedSolo
                              ? 'bg-[#118C4F] text-white border-[#0D6E3E]'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {isSelectedSolo ? 'Senin Takımın ✓' : 'Bu Takımda Oyna'}
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={info.name}
                      maxLength={14}
                      onChange={(e) => updateTeamField(tKey, { name: e.target.value })}
                      placeholder={onlyOwnTeam ? 'Takım Adın' : idx === 0 ? '1. Takım Adı' : '2. Takım Adı'}
                      className="w-full min-h-[32px] sm:min-h-[36px] px-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-[#0B2545] focus:outline-none focus:border-[#118C4F]"
                    />

                    <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                      {TEAM_COLOR_LIST.map((sw) => {
                        const selected = info.colorId === sw.id;
                        return (
                          <button
                            key={sw.id}
                            type="button"
                            title={sw.label}
                            onClick={() => updateTeamField(tKey, { colorId: sw.id })}
                            style={{ backgroundColor: sw.hex }}
                            className={`h-6 sm:h-7 rounded-lg border flex items-center justify-center transition-transform ${
                              selected
                                ? 'ring-2 ring-[#0B2545] scale-105 border-white'
                                : 'border-black/20 opacity-85 hover:opacity-100'
                            }`}
                          >
                            {selected && (
                              <Check
                                className={`w-3.5 h-3.5 ${
                                  sw.isLight ? 'text-slate-950' : 'text-white'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[36px] sm:min-h-[40px] rounded-xl bg-[#118C4F] hover:bg-[#0E7943] text-white font-display font-extrabold text-xs"
            >
              Tamam
            </button>
          </div>
        )}

        {/* Bot Difficulty (+ optional Online Bot Count) Modal */}
        {activeModal === 'difficulty' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {DIFFICULTIES.map((diff) => {
                const active = botDifficulty === diff;
                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => {
                      onChangeBotDifficulty(diff);
                      if (!showBotCounts) onClose();
                    }}
                    className={`min-h-[42px] rounded-xl text-xs font-display font-extrabold border transition-colors ${
                      active
                        ? 'bg-[#118C4F] text-white border-[#0D6E3E] shadow-xs'
                        : 'bg-[#FAF4E8] text-[#0B2545] border-[#E5DEC9] hover:bg-[#F3EAD5]'
                    }`}
                  >
                    {BOT_DIFFICULTY_LABELS[diff].label}
                  </button>
                );
              })}
            </div>

            {showBotCounts && onChangeRedBotCount && onChangeBlueBotCount && (
              <div className="p-2.5 rounded-2xl bg-[#FAF4E8] border border-[#E5DEC9] space-y-2">
                <div className="text-[11px] font-bold text-slate-600">Odadaki Bot Sayısı</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold truncate max-w-[68px]">
                      {teamMeta.red.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onChangeRedBotCount(Math.max(0, redBotCount - 1))}
                        className="w-6 h-6 rounded-md bg-slate-100 text-xs font-extrabold"
                      >
                        -
                      </button>
                      <span className="w-4 text-center font-mono-num text-xs font-bold">
                        {redBotCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => onChangeRedBotCount(Math.min(teamSize, redBotCount + 1))}
                        className="w-6 h-6 rounded-md bg-slate-100 text-xs font-extrabold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold truncate max-w-[68px]">
                      {teamMeta.blue.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onChangeBlueBotCount(Math.max(0, blueBotCount - 1))}
                        className="w-6 h-6 rounded-md bg-slate-100 text-xs font-extrabold"
                      >
                        -
                      </button>
                      <span className="w-4 text-center font-mono-num text-xs font-bold">
                        {blueBotCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => onChangeBlueBotCount(Math.min(teamSize, blueBotCount + 1))}
                        className="w-6 h-6 rounded-md bg-slate-100 text-xs font-extrabold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full min-h-[38px] rounded-xl bg-[#118C4F] text-white font-display font-bold text-xs"
                >
                  Tamam
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
