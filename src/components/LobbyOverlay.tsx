import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  LogOut,
  MessageSquare,
  Palette,
  Play,
  PlayCircle,
  Send,
  Share2,
  Trophy,
  UserX,
} from 'lucide-react';
import { LEAGUE_CLUB_NAMES } from '../game/league';
import { MatchEngine } from '../game/physics';
import { TOURNAMENT_CLUB_NAMES } from '../game/tournament';
import {
  BOT_DIFFICULTY_LABELS,
  DEFAULT_TEAM_META,
  MODE_CONFIGS,
  PITCH_SIZE_LABELS,
  TEAM_COLOR_PALETTE,
} from '../game/types';
import type {
  BotDifficulty,
  GameMode,
  PitchSize,
  RoomGameType,
  RoomStateInfo,
  Team,
  TeamMetaMap,
  TournamentSize,
} from '../game/types';
import { SetupOptionModals } from './SetupOptionModals';
import type { SetupModalKind } from './SetupOptionModals';

interface LobbyOverlayProps {
  room: RoomStateInfo;
  localClientId: string;
  coins: number;
  onSwitchTeam: (team: Team) => void;
  onSwitchTournamentSlot: (slotIndex: number) => void;
  onToggleReady: (ready: boolean) => void;
  onWatchLobbyAd: () => void;
  onKickMember: (targetId: string) => void;
  onSendChat: (text: string) => void;
  onUpdateSettings: (
    mode: GameMode,
    pitchSize: PitchSize,
    durationSec: number,
    fillBots: boolean,
    defaultBotDifficulty?: BotDifficulty,
    botDifficulties?: Record<string, BotDifficulty>,
    gameType?: RoomGameType,
    tournamentSize?: TournamentSize,
    redBotCount?: number,
    blueBotCount?: number,
    teamMeta?: TeamMetaMap
  ) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

const ONLINE_ENTRY_FEE = 10;

export const LobbyOverlay: React.FC<LobbyOverlayProps> = ({
  room,
  localClientId,
  coins,
  onSwitchTeam,
  onSwitchTournamentSlot,
  onToggleReady,
  onWatchLobbyAd,
  onKickMember,
  onSendChat,
  onUpdateSettings,
  onStartMatch,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [setupModal, setSetupModal] = useState<SetupModalKind>(null);
  const [chatInput, setChatInput] = useState('');
  const [isChatFocused, setIsChatFocused] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const isHost = room.hostId === localClientId;
  const maxPerTeam = MODE_CONFIGS[room.mode].teamSize;
  const defaultBotDiff = room.defaultBotDifficulty ?? 'normal';
  const botDiffMap = room.botDifficulties ?? {};
  const teamMeta = room.teamMeta ?? DEFAULT_TEAM_META;
  const redTheme = TEAM_COLOR_PALETTE[teamMeta.red.colorId];
  const blueTheme = TEAM_COLOR_PALETTE[teamMeta.blue.colorId];

  const isTournament = room.gameType === 'tournament';
  const isLeague = room.gameType === 'league';
  const isClubCompetition = isTournament || isLeague;
  const clubSlotCount = isLeague ? 18 : 32;

  const redMembers = room.members.filter((m) => m.team === 'red');
  const blueMembers = room.members.filter((m) => m.team === 'blue');
  const specMembers = room.members.filter((m) => m.team === 'spec');
  const localMember = room.members.find((m) => m.id === localClientId);

  const rawRedBotCount =
    typeof room.redBotCount === 'number'
      ? room.redBotCount
      : room.fillBots
        ? Math.max(0, maxPerTeam - redMembers.length)
        : 0;
  const rawBlueBotCount =
    typeof room.blueBotCount === 'number'
      ? room.blueBotCount
      : room.fillBots
        ? Math.max(0, maxPerTeam - blueMembers.length)
        : 0;

  const redBotSlotsFree = Math.max(0, maxPerTeam - redMembers.length);
  const blueBotSlotsFree = Math.max(0, maxPerTeam - blueMembers.length);
  const effectiveRedBots = Math.min(Math.max(0, Math.min(maxPerTeam, Math.floor(rawRedBotCount))), redBotSlotsFree);
  const effectiveBlueBots = Math.min(Math.max(0, Math.min(maxPerTeam, Math.floor(rawBlueBotCount))), blueBotSlotsFree);

  const activeHumans = room.members
    .filter((m) => m.team === 'red' || m.team === 'blue')
    .map((m) => ({
      id: m.id,
      name: m.name,
      team: m.team as 'red' | 'blue',
      role: m.role,
      isBot: false,
    }));
  const previewBots = MatchEngine.buildParticipantsWithBots(
    room.mode,
    activeHumans,
    isClubCompetition ? true : room.fillBots,
    defaultBotDiff,
    botDiffMap,
    isClubCompetition ? null : { red: effectiveRedBots, blue: effectiveBlueBots }
  ).filter((p) => p.isBot);
  const redPreviewBots = previewBots.filter((b) => b.team === 'red');
  const bluePreviewBots = previewBots.filter((b) => b.team === 'blue');

  const inviteUrl = `${window.location.origin}?room=${room.roomCode}`;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.chatMessages?.length]);

  const emitSettings = (overrides: {
    mode?: GameMode;
    pitchSize?: PitchSize;
    durationSec?: number;
    fillBots?: boolean;
    defaultBotDifficulty?: BotDifficulty;
    botDifficulties?: Record<string, BotDifficulty>;
    gameType?: RoomGameType;
    tournamentSize?: TournamentSize;
    redBotCount?: number;
    blueBotCount?: number;
    teamMeta?: TeamMetaMap;
  }) => {
    const nextRedBots = overrides.redBotCount ?? rawRedBotCount;
    const nextBlueBots = overrides.blueBotCount ?? rawBlueBotCount;
    onUpdateSettings(
      overrides.mode ?? room.mode,
      overrides.pitchSize ?? room.pitchSize,
      overrides.durationSec ?? room.durationSec,
      overrides.fillBots ?? room.fillBots,
      overrides.defaultBotDifficulty ?? defaultBotDiff,
      overrides.botDifficulties ?? botDiffMap,
      overrides.gameType ?? room.gameType,
      overrides.tournamentSize ?? room.tournamentSize,
      nextRedBots,
      nextBlueBots,
      overrides.teamMeta ?? teamMeta
    );
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SahaBall Maç Daveti',
          text: `SahaBall odama katıl! Oda Kodu: ${room.roomCode}`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyInvite();
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;
    onSendChat(clean);
    setChatInput('');
  };

  // Start validation check mirroring server
  const notReadyMember = room.members.find((m) => !m.isReady || m.isWatchingAd);
  const lowCoinMember = room.members.find((m) => m.team !== 'spec' && m.coins < ONLINE_ENTRY_FEE);
  const canHostStart = !notReadyMember && !lowCoinMember;
  const startBlockReason = notReadyMember
    ? notReadyMember.isWatchingAd
      ? `${notReadyMember.name} reklam izliyor...`
      : `${notReadyMember.name} henüz hazır değil`
    : lowCoinMember
      ? `${lowCoinMember.name} için 10 jeton gerekli`
      : null;

  const needsCoinsToPlay = localMember?.team !== 'spec' && coins < ONLINE_ENTRY_FEE;

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center p-[max(0.25rem,env(safe-area-inset-top))] pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] pb-[max(0.25rem,env(safe-area-inset-bottom))] bg-black/65 overflow-hidden">
      <div className={`w-full max-w-none h-full max-h-[100dvh] min-h-0 overflow-hidden bg-slate-950/95 border border-white/15 rounded-xl shadow-2xl p-2 sm:p-3 text-white flex flex-col gap-1.5 ${isChatFocused ? 'p-1' : ''}`}>
        {/* Room Header & Invite Controls */}
        {!isChatFocused && <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-num font-bold text-lg sm:text-xl tracking-widest text-amber-300">
              {room.roomCode}
            </span>
            {isTournament && (
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-display font-bold flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                <span>Turnuva (32T)</span>
              </span>
            )}
            {isLeague && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-display font-bold flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                <span>Lig (18T)</span>
              </span>
            )}
            <span className="text-[11px] text-slate-300">
              {room.mode} · {PITCH_SIZE_LABELS[room.pitchSize].label} · {Math.round(room.durationSec / 60)} Dk
            </span>
            <span className="text-[11px] font-semibold text-amber-200">
              · Giriş 10 Jeton / Galibiyet +18 Jeton
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 font-mono-num text-xs font-bold">
              {coins} Jeton
            </div>

            <button
              type="button"
              onClick={handleCopyInvite}
              className="min-h-[34px] px-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopyalandı' : 'Davet'}</span>
            </button>

            {'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                aria-label="Paylaş"
                className="min-w-[34px] min-h-[34px] px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-200 flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>}

        {/* Host Compact Settings Strip (Small Windows for each setting) */}
        {!isChatFocused && isHost && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-white/10 shrink-0">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setSetupModal('mode')}
                className="min-h-[28px] px-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-bold"
              >
                Mod: {room.mode}
              </button>
              <button
                type="button"
                onClick={() => setSetupModal('pitch')}
                className="min-h-[28px] px-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-bold"
              >
                Saha: {PITCH_SIZE_LABELS[room.pitchSize].label.replace(' Saha', '')}
              </button>
              <button
                type="button"
                onClick={() => setSetupModal('duration')}
                className="min-h-[28px] px-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-bold"
              >
                Süre: {Math.round(room.durationSec / 60)} Dk
              </button>
              <button
                type="button"
                onClick={() => setSetupModal('teams')}
                className="min-h-[28px] px-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-bold flex items-center gap-1"
              >
                <Palette className="w-3 h-3" />
                <span>{isClubCompetition ? 'Takımım' : 'Takımlar'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSetupModal('difficulty')}
                className="min-h-[28px] px-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-bold"
              >
                Bot: {BOT_DIFFICULTY_LABELS[defaultBotDiff].label}
              </button>
            </div>
          </div>
        )}

        {/* Main Middle Body: Teams (Left 7 cols) + Lobby Chat (Right 5 cols) */}
        <div className={`flex-1 min-h-0 grid ${isChatFocused ? 'grid-cols-1' : 'grid-cols-1 min-[680px]:grid-cols-12'} gap-2 overflow-hidden`}>
          {/* Teams Section */}
          {!isChatFocused && <div className="min-[680px]:col-span-5 min-h-0 overflow-y-auto pr-0.5">
            {isClubCompetition ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {Array.from({ length: clubSlotCount }, (_, slotIdx) => {
                  const slotMembers = room.members.filter(
                    (m) => m.team !== 'spec' && m.tournamentSlot === slotIdx
                  );
                  const isMine =
                    localMember?.team !== 'spec' && localMember?.tournamentSlot === slotIdx;
                  const isFull = slotMembers.length >= maxPerTeam;
                  const clubNames = isLeague ? LEAGUE_CLUB_NAMES : TOURNAMENT_CLUB_NAMES;
                  const clubName =
                    slotIdx === 0 && teamMeta.red.name.trim()
                      ? teamMeta.red.name.trim()
                      : clubNames[slotIdx % clubNames.length];
                  const isSideA = slotIdx % 2 === 0;

                  return (
                    <div
                      key={slotIdx}
                      className={`rounded-xl border p-2 flex flex-col justify-between gap-1.5 ${
                        isMine
                          ? 'bg-amber-500/15 border-amber-400/60'
                          : isSideA
                            ? 'bg-red-950/25 border-red-500/25'
                            : 'bg-blue-950/25 border-blue-500/25'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-display font-bold text-[11px] text-white truncate">
                            {slotIdx + 1}. {clubName}
                          </span>
                          <span className="font-mono-num text-[10px] text-slate-300 shrink-0">
                            {slotMembers.length}/{maxPerTeam}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {slotMembers.map((m) => (
                            <div
                              key={m.id}
                              className="px-1.5 py-0.5 rounded bg-white/12 text-[10px] font-medium text-white flex items-center justify-between gap-1"
                            >
                              <span className="truncate">
                                {m.name}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {m.isReady && <Check className="w-3 h-3 text-emerald-400" />}
                                {isHost && !m.isHost && (
                                  <button
                                    type="button"
                                    title="Odadan At"
                                    onClick={() => onKickMember(m.id)}
                                    className="text-rose-300 hover:text-rose-200"
                                  >
                                    <UserX className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {slotMembers.length === 0 && (
                            <span className="text-[10px] text-white/40 italic">Bot Takım</span>
                          )}
                        </div>
                      </div>

                      {isMine ? (
                        <div className="w-full min-h-[24px] rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold flex items-center justify-center">
                          Buradasın
                        </div>
                      ) : (
                        !isFull && (
                          <button
                            type="button"
                            onClick={() => onSwitchTournamentSlot(slotIdx)}
                            className="w-full min-h-[24px] rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-semibold"
                          >
                            Katıl
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {/* Team 1 */}
                <div
                  style={{ borderColor: `${redTheme.hex}66`, backgroundColor: `${redTheme.hex}18` }}
                  className="rounded-xl border p-2.5 flex flex-col justify-between gap-2 min-h-[150px]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        style={{ color: redTheme.hex }}
                        className="font-display font-extrabold text-xs sm:text-sm truncate"
                      >
                        {teamMeta.red.name}
                      </span>
                      <span className="font-mono-num text-xs text-white/80">
                        {redMembers.length + redPreviewBots.length}/{maxPerTeam}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {redMembers.map((m) => (
                        <div
                          key={m.id}
                          className="px-2 py-1 rounded-lg bg-black/35 border border-white/10 text-[11px] font-medium text-white flex items-center justify-between gap-1.5"
                        >
                          <div className="min-w-0 truncate">
                            <span>{m.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                m.isReady
                                  ? 'bg-emerald-500/25 text-emerald-300'
                                  : 'bg-white/10 text-slate-300'
                              }`}
                            >
                              {m.isReady ? 'Hazır' : 'Bekliyor'}
                            </span>
                            {isHost && !m.isHost && (
                              <button
                                type="button"
                                title="Odadan At"
                                onClick={() => onKickMember(m.id)}
                                className="p-1 rounded bg-rose-500/25 hover:bg-rose-500/45 text-rose-200 transition-colors"
                              >
                                <UserX className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {redPreviewBots.map((b) => (
                        <div
                          key={b.id}
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10.5px] font-medium text-white/80 truncate"
                        >
                          {b.name}
                        </div>
                      ))}
                      {redMembers.length === 0 && redPreviewBots.length === 0 && (
                        <span className="text-[11px] text-white/40 italic">Oyuncu bekleniyor...</span>
                      )}
                    </div>
                  </div>

                  {localMember?.team !== 'red' && redMembers.length < maxPerTeam && (
                    <button
                      type="button"
                      onClick={() => onSwitchTeam('red')}
                      style={{
                        backgroundColor: redTheme.hex,
                        color: redTheme.isLight ? '#0F172A' : '#FFFFFF',
                      }}
                      className="w-full min-h-[30px] rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                    >
                      Bu Takıma Geç
                    </button>
                  )}
                </div>

                {/* Team 2 */}
                <div
                  style={{ borderColor: `${blueTheme.hex}66`, backgroundColor: `${blueTheme.hex}18` }}
                  className="rounded-xl border p-2.5 flex flex-col justify-between gap-2 min-h-[150px]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        style={{ color: blueTheme.hex }}
                        className="font-display font-extrabold text-xs sm:text-sm truncate"
                      >
                        {teamMeta.blue.name}
                      </span>
                      <span className="font-mono-num text-xs text-white/80">
                        {blueMembers.length + bluePreviewBots.length}/{maxPerTeam}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {blueMembers.map((m) => (
                        <div
                          key={m.id}
                          className="px-2 py-1 rounded-lg bg-black/35 border border-white/10 text-[11px] font-medium text-white flex items-center justify-between gap-1.5"
                        >
                          <div className="min-w-0 truncate">
                            <span>{m.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                m.isReady
                                  ? 'bg-emerald-500/25 text-emerald-300'
                                  : 'bg-white/10 text-slate-300'
                              }`}
                            >
                              {m.isReady ? 'Hazır' : 'Bekliyor'}
                            </span>
                            {isHost && !m.isHost && (
                              <button
                                type="button"
                                title="Odadan At"
                                onClick={() => onKickMember(m.id)}
                                className="p-1 rounded bg-rose-500/25 hover:bg-rose-500/45 text-rose-200 transition-colors"
                              >
                                <UserX className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {bluePreviewBots.map((b) => (
                        <div
                          key={b.id}
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10.5px] font-medium text-white/80 truncate"
                        >
                          {b.name}
                        </div>
                      ))}
                      {blueMembers.length === 0 && bluePreviewBots.length === 0 && (
                        <span className="text-[11px] text-white/40 italic">Oyuncu bekleniyor...</span>
                      )}
                    </div>
                  </div>

                  {localMember?.team !== 'blue' && blueMembers.length < maxPerTeam && (
                    <button
                      type="button"
                      onClick={() => onSwitchTeam('blue')}
                      style={{
                        backgroundColor: blueTheme.hex,
                        color: blueTheme.isLight ? '#0F172A' : '#FFFFFF',
                      }}
                      className="w-full min-h-[30px] rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                    >
                      Bu Takıma Geç
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>}

          {/* Lobby Chat Panel */}
          <div className={`${isChatFocused ? 'col-span-1' : 'min-[680px]:col-span-7'} flex flex-col min-h-0 h-full rounded-xl bg-white/[0.04] border border-white/12 p-2.5`}>
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10 shrink-0">
              <span className="text-xs font-display font-bold text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Lobi Sohbeti</span>
              </span>
              <span className="text-[10px] text-slate-400">{room.members.length} Kişi</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 text-[11px] [touch-action:pan-y]">
              {(room.chatMessages ?? []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-center">
                  Maç başlamadan önce arkadaşlarınla sohbet edebilirsin.
                </div>
              ) : (
                (room.chatMessages ?? []).map((msg) => (
                  <div key={msg.id} className="leading-snug break-words">
                    <span
                      className={`font-bold mr-1.5 ${
                        msg.senderId === localClientId ? 'text-amber-300' : 'text-emerald-300'
                      }`}
                    >
                      {msg.senderName}:
                    </span>
                    <span dir="ltr" style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }} className="text-white/90">{msg.text}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="mt-2 flex items-center gap-1.5 shrink-0">
              <input
                type="text"
                value={chatInput}
                maxLength={180}
                onChange={(e) => setChatInput(e.target.value)}
                onFocus={() => setIsChatFocused(true)}
                onBlur={() => setIsChatFocused(false)}
                dir="ltr"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left', touchAction: 'auto', userSelect: 'text', WebkitUserSelect: 'text' }}
                placeholder="Mesaj yaz..."
                className="flex-1 min-h-[40px] px-2.5 rounded-lg bg-black/40 border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 [touch-action:pan-x]"
              />
              <button
                type="submit"
                aria-label="Gönder"
                className="min-w-[34px] min-h-[34px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions: Leave / Spec + Ad Watch + Ready + Host Start */}
        {!isChatFocused && <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onLeaveRoom}
              className="min-h-[38px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/85 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Ayrıl</span>
            </button>
            {localMember?.team !== 'spec' && (
              <button
                type="button"
                onClick={() => onSwitchTeam('spec')}
                className="min-h-[38px] px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
              >
                İzleyici
              </button>
            )}
            {specMembers.length > 0 && (
              <span className="text-[10px] text-slate-400">
                İzleyen: {specMembers.map((s) => s.name).join(', ')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ad button in Lobby so players without coins (or anyone) can watch an ad */}
            <button
              type="button"
              onClick={onWatchLobbyAd}
              className={`min-h-[38px] px-3 rounded-xl font-display font-bold text-xs flex items-center gap-1.5 transition-all active:scale-97 ${
                needsCoinsToPlay
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md ring-2 ring-amber-200'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              <span>Reklam İzle (+10 Jeton)</span>
            </button>

            {/* Ready Toggle */}
            {localMember && (
              <button
                type="button"
                disabled={localMember.isWatchingAd}
                onClick={() => onToggleReady(!localMember.isReady)}
                className={`min-h-[38px] px-3.5 rounded-xl font-display font-bold text-xs flex items-center gap-1.5 border transition-colors ${
                  localMember.isReady
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-white/10 hover:bg-white/15 border-white/25 text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{localMember.isReady ? 'Hazırım ✓' : 'Hazır Ol'}</span>
              </button>
            )}

            {isHost ? (
              <div className="flex items-center gap-2">
                {startBlockReason && (
                  <span className="text-[10.5px] font-medium text-amber-300 hidden sm:inline">
                    {startBlockReason}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!canHostStart}
                  onClick={onStartMatch}
                  className={`min-h-[40px] px-4 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg transition-all ${
                    !canHostStart
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : isTournament
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-97'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-97'
                  }`}
                >
                  {isClubCompetition ? <Trophy className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>
                    {isTournament
                      ? 'Turnuvayı Başlat'
                      : isLeague
                        ? 'Ligi Başlat'
                        : 'Maçı Başlat (-10 J)'}
                  </span>
                </button>
              </div>
            ) : (
              <span className="text-xs text-emerald-300/90 font-medium">
                {localMember?.isReady ? 'Kurucu bekleniyor...' : 'Başlamak için Hazır Ol'}
              </span>
            )}
          </div>
        </div>}
      </div>

      {isHost && (
        <SetupOptionModals
          activeModal={setupModal}
          onClose={() => setSetupModal(null)}
          mode={room.mode}
          onChangeMode={(m) => emitSettings({ mode: m })}
          pitchSize={room.pitchSize}
          onChangePitchSize={(p) => emitSettings({ pitchSize: p })}
          durationSec={room.durationSec}
          onChangeDurationSec={(d) => emitSettings({ durationSec: d })}
          teamMeta={teamMeta}
          onChangeTeamMeta={(next) => emitSettings({ teamMeta: next })}
          onlyOwnTeam={isClubCompetition}
          botDifficulty={defaultBotDiff}
          onChangeBotDifficulty={(d) => emitSettings({ defaultBotDifficulty: d, botDifficulties: {} })}
          showBotCounts={!isClubCompetition}
          redBotCount={effectiveRedBots}
          blueBotCount={effectiveBlueBots}
          onChangeRedBotCount={(next) =>
            emitSettings({
              redBotCount: next,
              blueBotCount: effectiveBlueBots,
              fillBots: next > 0 || effectiveBlueBots > 0,
            })
          }
          onChangeBlueBotCount={(next) =>
            emitSettings({
              redBotCount: effectiveRedBots,
              blueBotCount: next,
              fillBots: effectiveRedBots > 0 || next > 0,
            })
          }
        />
      )}
    </div>
  );
};
