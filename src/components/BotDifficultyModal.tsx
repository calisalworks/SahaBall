import React from 'react';
import { Bot, Check, Sparkles, X } from 'lucide-react';
import type { MatchParticipantSpec } from '../game/physics';
import { BOT_DIFFICULTY_LABELS, ROLE_LABELS } from '../game/types';
import type { ActiveTeam, BotDifficulty } from '../game/types';

interface BotDifficultyModalProps {
  open: boolean;
  bots: MatchParticipantSpec[];
  defaultDifficulty: BotDifficulty;
  botDifficulties: Record<string, BotDifficulty>;
  onChangeDefault: (diff: BotDifficulty) => void;
  onChangeBot: (botId: string, diff: BotDifficulty) => void;
  onChangeTeam: (team: ActiveTeam, diff: BotDifficulty) => void;
  onClose: () => void;
}

const DIFFICULTIES: BotDifficulty[] = ['kolay', 'normal', 'zor', 'efsanevi'];

const DIFF_ACTIVE_STYLES: Record<BotDifficulty, string> = {
  kolay: 'bg-sky-500 text-white shadow-sm',
  normal: 'bg-emerald-600 text-white shadow-sm',
  zor: 'bg-amber-500 text-slate-950 shadow-sm',
  efsanevi: 'bg-purple-600 text-white shadow-sm',
};

export const BotDifficultyModal: React.FC<BotDifficultyModalProps> = ({
  open,
  bots,
  defaultDifficulty,
  botDifficulties,
  onChangeDefault,
  onChangeBot,
  onChangeTeam,
  onClose,
}) => {
  if (!open) return null;

  const redBots = bots.filter((b) => b.team === 'red');
  const blueBots = bots.filter((b) => b.team === 'blue');

  const renderBotRow = (bot: MatchParticipantSpec) => {
    const activeDiff = botDifficulties[bot.id] ?? defaultDifficulty;
    const roleShort = ROLE_LABELS[bot.role ?? 'ortasaha'].short;
    const cleanName = bot.name.replace(' (Bot)', '');

    return (
      <div
        key={bot.id}
        className="p-1.5 rounded-lg bg-white border border-slate-200/80 flex flex-col gap-1"
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-display font-extrabold text-[#0B2545] shrink-0">
              {roleShort}
            </span>
            <span className="text-[11px] font-bold text-[#0B2545] truncate">{cleanName}</span>
          </div>
          <span className="text-[9px] font-semibold text-slate-500 shrink-0">
            {BOT_DIFFICULTY_LABELS[activeDiff].label}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-md bg-slate-100">
          {DIFFICULTIES.map((d) => {
            const selected = activeDiff === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onChangeBot(bot.id, d)}
                className={`min-h-[26px] rounded text-[9.5px] sm:text-[10px] font-display font-bold transition-colors ${
                  selected ? DIFF_ACTIVE_STYLES[d] : 'text-slate-600 hover:bg-white'
                }`}
              >
                {BOT_DIFFICULTY_LABELS[d].label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4 bg-black/55">
      <div className="w-full max-w-2xl max-h-full overflow-y-auto bg-white border border-[#E5DEC9] rounded-2xl shadow-2xl p-3 sm:p-4 text-[#0B2545] flex flex-col gap-2.5">
        {/* Header + Global Quick Preset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0B2545] text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-sm sm:text-base leading-tight">
                Bot Zorluklarını Ayarla
              </h3>
              <p className="text-[10px] text-slate-500">
                Her botu tek tek seç veya takımın tamamını ayarla
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-w-[34px] min-h-[34px] rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* All Bots Bulk Preset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#FAF4E8] border border-[#E6DEC9]">
          <span className="text-[11px] font-bold text-[#0B2545] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Tüm Botlar:</span>
          </span>
          <div className="grid grid-cols-4 gap-1 flex-1 max-w-sm">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChangeDefault(d)}
                className={`min-h-[28px] px-1.5 rounded-lg text-[10px] font-display font-bold border transition-colors ${
                  defaultDifficulty === d && Object.keys(botDifficulties).length === 0
                    ? `${DIFF_ACTIVE_STYLES[d]} border-transparent`
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {BOT_DIFFICULTY_LABELS[d].label}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Red vs Blue Individual Bot Selectors */}
        <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-2.5">
          {/* Red Team Bots */}
          <div className="p-2 rounded-xl bg-red-50/70 border border-red-200 space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-display font-extrabold text-red-800">
                Kırmızı Botlar ({redBots.length})
              </span>
              {redBots.length > 0 && (
                <div className="flex items-center gap-0.5">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      title={`Tüm Kırmızı: ${BOT_DIFFICULTY_LABELS[d].label}`}
                      onClick={() => onChangeTeam('red', d)}
                      className="w-6 h-6 rounded bg-white hover:bg-red-100 border border-red-200 text-[9px] font-display font-extrabold text-red-900"
                    >
                      {BOT_DIFFICULTY_LABELS[d].short}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {redBots.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-slate-500 italic">
                Bu takımda bot yok
              </div>
            ) : (
              <div className="space-y-1.5">{redBots.map(renderBotRow)}</div>
            )}
          </div>

          {/* Blue Team Bots */}
          <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-display font-extrabold text-blue-800">
                Mavi Botlar ({blueBots.length})
              </span>
              {blueBots.length > 0 && (
                <div className="flex items-center gap-0.5">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      title={`Tüm Mavi: ${BOT_DIFFICULTY_LABELS[d].label}`}
                      onClick={() => onChangeTeam('blue', d)}
                      className="w-6 h-6 rounded bg-white hover:bg-blue-100 border border-blue-200 text-[9px] font-display font-extrabold text-blue-900"
                    >
                      {BOT_DIFFICULTY_LABELS[d].short}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {blueBots.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-slate-500 italic">
                Bu takımda bot yok
              </div>
            ) : (
              <div className="space-y-1.5">{blueBots.map(renderBotRow)}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[10px] text-slate-500">
            Efsanevi botlar top tahmini, pas üçgenleri ve akıllı kalecilik kullanır.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 rounded-xl bg-[#118C4F] hover:bg-[#0E7943] text-white font-display font-bold text-xs flex items-center gap-1.5 shrink-0"
          >
            <Check className="w-4 h-4" />
            <span>Kaydet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
