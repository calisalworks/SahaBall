import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  MessageCircle,
  Pause,
  Scale,
  Shield,
  Smile,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DEFAULT_TEAM_META, TEAM_COLOR_PALETTE } from '../game/types';
import type { FormationPreset, GameMode, MatchPhase, TeamMetaMap } from '../game/types';

interface ScoreboardHUDProps {
  redScore: number;
  blueScore: number;
  timeLeftSec: number;
  phase: MatchPhase;
  mode: GameMode;
  teamMeta?: TeamMetaMap;
  isMuted: boolean;
  roomCode?: string | null;
  pingMs?: number | null;
  canSendEmoji?: boolean;
  activeTactic?: FormationPreset | null;
  onSelectTactic?: (preset: FormationPreset) => void;
  onSendEmoji?: (emoji: string) => void;
  onToggleMute: () => void;
  onOpenMenu: () => void;
}

const TACTIC_OPTIONS: Array<{
  id: FormationPreset;
  label: string;
  short: string;
  icon: React.FC<{ className?: string }>;
  activeClass: string;
}> = [
  {
    id: 'defansif',
    label: 'Defansif',
    short: 'Def',
    icon: Shield,
    activeClass: 'bg-sky-500/75 text-white shadow-xs',
  },
  {
    id: 'dengeli',
    label: 'Dengeli',
    short: 'Dng',
    icon: Scale,
    activeClass: 'bg-emerald-500/75 text-white shadow-xs',
  },
  {
    id: 'ofansif',
    label: 'Ofansif',
    short: 'Ofs',
    icon: Swords,
    activeClass: 'bg-rose-500/75 text-white shadow-xs',
  },
];

const QUICK_EMOJIS = ['⚽', '🔥', '👏', '😂', '😮', '😤'];
const QUICK_PHRASES = [
  'Güzel pas!',
  'Bravo!',
  'Özür dilerim',
  'Harika gol!',
  'Pas ver!',
  'İyi savunma!',
];

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const ScoreboardHUD: React.FC<ScoreboardHUDProps> = ({
  redScore,
  blueScore,
  timeLeftSec,
  phase,
  mode,
  teamMeta = DEFAULT_TEAM_META,
  isMuted,
  roomCode,
  pingMs,
  canSendEmoji = false,
  activeTactic = null,
  onSelectTactic,
  onSendEmoji,
  onToggleMute,
  onOpenMenu,
}) => {
  const [copied, setCopied] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const lastPointerActionAtRef = useRef<number>(0);

  const runPointerAction = (e: React.PointerEvent, action: () => void) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    lastPointerActionAtRef.current = performance.now();
    action();
  };

  const runClickFallback = (action: () => void) => {
    if (performance.now() - lastPointerActionAtRef.current < 450) return;
    action();
  };

  const redTheme = TEAM_COLOR_PALETTE[teamMeta.red.colorId];
  const blueTheme = TEAM_COLOR_PALETTE[teamMeta.blue.colorId];

  const handleCopyCode = async () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  const handlePickEmoji = (emoji: string) => {
    setEmojiOpen(false);
    setChatOpen(false);
    onSendEmoji?.(emoji);
  };

  const handlePickPhrase = (phrase: string) => {
    setChatOpen(false);
    setEmojiOpen(false);
    onSendEmoji?.(phrase);
  };

  return (
    <div className="fixed inset-x-0 top-0 z-30 pointer-events-none flex items-start justify-between gap-1.5 pt-[max(0.4rem,env(safe-area-inset-top))] pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] sm:px-5 sm:pt-2.5">
      {/* Top Left: Menu / Pause Trigger + Compact Transparent Tactic Bar */}
      <div className="pointer-events-auto flex flex-col items-start gap-1 shrink-0 touch-none">
        <button
          type="button"
          onPointerDown={(e) => runPointerAction(e, onOpenMenu)}
          onClick={() => runClickFallback(onOpenMenu)}
          aria-label="Oyun Menüsü"
          className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] px-2 sm:px-2.5 rounded-xl bg-black/50 hover:bg-black/70 border border-white/20 text-white flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors active:scale-95 touch-none select-none"
        >
          <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline whitespace-nowrap">Menü</span>
        </button>

        {activeTactic && onSelectTactic && phase !== 'finished' && (
          <div
            role="group"
            aria-label="Hızlı Taktik Seçimi"
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-950/25 border border-white/15 touch-none select-none"
          >
            {TACTIC_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = activeTactic === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isSelected}
                  title={`${opt.label} Taktik`}
                  onPointerDown={(e) => runPointerAction(e, () => onSelectTactic(opt.id))}
                  onClick={() => runClickFallback(() => onSelectTactic(opt.id))}
                  className={`min-h-[24px] sm:min-h-[26px] px-1.5 sm:px-2 rounded-md text-[9px] sm:text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer touch-none select-none ${
                    isSelected
                      ? opt.activeClass
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                  <span className="sm:hidden">{opt.short}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Center: Slim, Elongated Equal-Width Scoreboard */}
      <div className="pointer-events-none flex flex-col items-center shrink-0">
        <div className="flex items-stretch bg-slate-950/90 border border-white/20 rounded-lg sm:rounded-xl overflow-hidden shadow-lg">
          {/* Team 1 */}
          <div
            style={{ backgroundColor: redTheme.hex }}
            className={`w-[124px] min-[600px]:w-[144px] sm:w-[162px] flex items-center justify-between gap-1.5 px-2 sm:px-2.5 py-[3px] sm:py-0.5 ${
              redTheme.isLight ? 'text-slate-950' : 'text-white'
            }`}
          >
            <span className="flex-1 min-w-0 text-left text-[9.5px] min-[600px]:text-[10.5px] sm:text-[11px] font-bold tracking-tight truncate leading-tight">
              {teamMeta.red.name}
            </span>
            <span className="font-display font-extrabold text-sm sm:text-base leading-none tabular-nums shrink-0">
              {redScore}
            </span>
          </div>

          {/* Match Clock */}
          <div
            className={`px-2 sm:px-2.5 py-[2px] sm:py-0.5 flex flex-col items-center justify-center min-w-[48px] sm:min-w-[60px] transition-colors ${
              phase === 'playing' && timeLeftSec <= 15 && timeLeftSec > 0 ? 'bg-red-950/85' : ''
            }`}
          >
            {phase === 'overtime' ? (
              <span className="font-display font-bold text-[9.5px] sm:text-[11px] text-amber-300 tracking-wide whitespace-nowrap leading-none">
                ALTIN GOL
              </span>
            ) : (
              <span
                className={`font-mono-num font-bold text-[11px] sm:text-xs leading-none ${
                  phase === 'playing' && timeLeftSec <= 15 && timeLeftSec > 0
                    ? 'text-red-400 font-extrabold'
                    : 'text-white'
                }`}
              >
                {formatClock(timeLeftSec)}
              </span>
            )}
            <span className="text-[8px] text-white/65 font-medium leading-none mt-0.5">
              {mode}
            </span>
          </div>

          {/* Team 2 */}
          <div
            style={{ backgroundColor: blueTheme.hex }}
            className={`w-[124px] min-[600px]:w-[144px] sm:w-[162px] flex items-center justify-between gap-1.5 px-2 sm:px-2.5 py-[3px] sm:py-0.5 ${
              blueTheme.isLight ? 'text-slate-950' : 'text-white'
            }`}
          >
            <span className="font-display font-extrabold text-sm sm:text-base leading-none tabular-nums shrink-0">
              {blueScore}
            </span>
            <span className="flex-1 min-w-0 text-right text-[9.5px] min-[600px]:text-[10.5px] sm:text-[11px] font-bold tracking-tight truncate leading-tight">
              {teamMeta.blue.name}
            </span>
          </div>
        </div>
      </div>

      {/* Top Right: Quick Chat, Emoji, Room Code, Ping, Sound */}
      <div className="pointer-events-auto relative flex items-center gap-1 sm:gap-1.5 shrink-0 touch-none">
        {roomCode && (
          <button
            type="button"
            onPointerDown={(e) => runPointerAction(e, () => void handleCopyCode())}
            onClick={() => runClickFallback(() => void handleCopyCode())}
            title="Davet linkini kopyala"
            className="min-h-[36px] sm:min-h-[40px] px-2 sm:px-2.5 rounded-xl bg-black/50 hover:bg-black/70 border border-white/20 text-white flex items-center gap-1 text-[11px] sm:text-xs font-semibold transition-colors active:scale-95 touch-none select-none"
          >
            <span className="font-mono-num tracking-wider text-amber-300">{roomCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/75" />}
          </button>
        )}

        {typeof pingMs === 'number' && (
          <div className="hidden md:flex items-center min-h-[40px] px-2.5 rounded-xl bg-black/45 border border-white/15 text-[11px] font-mono-num text-white/85">
            {pingMs} ms
          </div>
        )}

        {canSendEmoji && onSendEmoji && (
          <>
            <button
              type="button"
              onPointerDown={(e) =>
                runPointerAction(e, () => {
                  setEmojiOpen(false);
                  setChatOpen((prev) => !prev);
                })
              }
              onClick={() =>
                runClickFallback(() => {
                  setEmojiOpen(false);
                  setChatOpen((prev) => !prev);
                })
              }
              aria-label="Hızlı Mesaj Gönder"
              title="Hızlı Mesaj"
              className={`min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl border flex items-center justify-center transition-colors active:scale-95 touch-none select-none cursor-pointer ${
                chatOpen
                  ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                  : 'bg-black/50 hover:bg-black/70 border-white/20 text-white'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onPointerDown={(e) =>
                runPointerAction(e, () => {
                  setChatOpen(false);
                  setEmojiOpen((prev) => !prev);
                })
              }
              onClick={() =>
                runClickFallback(() => {
                  setChatOpen(false);
                  setEmojiOpen((prev) => !prev);
                })
              }
              aria-label="Anlık Emoji Gönder"
              title="Emoji Gönder"
              className={`min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl border flex items-center justify-center transition-colors active:scale-95 touch-none select-none cursor-pointer ${
                emojiOpen
                  ? 'bg-amber-400 text-slate-950 border-amber-200'
                  : 'bg-black/50 hover:bg-black/70 border-white/20 text-white'
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          type="button"
          onPointerDown={(e) => runPointerAction(e, onToggleMute)}
          onClick={() => runClickFallback(onToggleMute)}
          aria-label={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-black/50 hover:bg-black/70 border border-white/20 text-white flex items-center justify-center transition-colors active:scale-95 touch-none select-none"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Instant Quick Phrase Picker */}
        {chatOpen && canSendEmoji && onSendEmoji && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-[calc(100%+8px)] z-40 grid grid-cols-2 gap-1.5 p-2 rounded-2xl bg-slate-950/95 border border-white/25 shadow-2xl touch-none select-none min-w-[215px]"
          >
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onPointerDown={(e) => runPointerAction(e, () => handlePickPhrase(phrase))}
                onClick={() => runClickFallback(() => handlePickPhrase(phrase))}
                className="min-h-[34px] px-2.5 rounded-xl bg-white/10 hover:bg-emerald-500/35 border border-white/10 text-white text-[11px] sm:text-xs font-display font-bold whitespace-nowrap active:scale-95 transition-all touch-none select-none cursor-pointer"
              >
                {phrase}
              </button>
            ))}
          </div>
        )}

        {/* Instant Quick Emoji Picker Bar */}
        {emojiOpen && canSendEmoji && onSendEmoji && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-[calc(100%+8px)] z-40 flex items-center gap-1 p-1.5 rounded-2xl bg-slate-950/95 border border-white/25 shadow-2xl touch-none select-none"
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onPointerDown={(e) => runPointerAction(e, () => handlePickEmoji(emoji))}
                onClick={() => runClickFallback(() => handlePickEmoji(emoji))}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-white/25 active:scale-90 flex items-center justify-center text-lg sm:text-xl transition-transform touch-none select-none cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
