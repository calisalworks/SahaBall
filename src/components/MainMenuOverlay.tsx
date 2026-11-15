import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Clock,
  Crosshair,
  Gift,
  Globe,
  GraduationCap,
  MapPin,
  Palette,
  Play,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  Target,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { getBallPreviewUrl, preloadBallSkin, subscribeBallSprites } from '../game/ballSprites';
import { getServerHttpBase } from '../game/network';
import { PWAInstallButton } from './PWAInstallButton';
import {
  BOT_DIFFICULTY_LABELS,
  MODE_CONFIGS,
  PITCH_SIZE_LABELS,
  TEAM_COLOR_PALETTE,
} from '../game/types';
import type {
  ActiveTeam,
  BotDifficulty,
  GameMode,
  PitchSize,
  PublicRoomSummary,
  RoomGameType,
  TeamMetaMap,
} from '../game/types';
import { SetupOptionModals } from './SetupOptionModals';
import type { SetupModalKind } from './SetupOptionModals';

interface MainMenuOverlayProps {
  playerName: string;
  coins: number;
  dailyRewardAvailable: boolean;
  challengeTriesLabel: string;
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  pitchSize: PitchSize;
  onSelectPitchSize: (size: PitchSize) => void;
  durationSec: number;
  onSelectDuration: (sec: number) => void;
  teamMeta: TeamMetaMap;
  onChangeTeamMeta: (next: TeamMetaMap) => void;
  soloTeam: ActiveTeam;
  onSelectSoloTeam: (team: ActiveTeam) => void;
  soloGameType: RoomGameType;
  onChangeSoloGameType: (type: RoomGameType) => void;
  onlineGameType: RoomGameType;
  onChangeOnlineGameType: (type: RoomGameType) => void;
  defaultBotDifficulty: BotDifficulty;
  onChangeDefaultBotDifficulty: (diff: BotDifficulty) => void;
  fillBotsOnline: boolean;
  onToggleFillBotsOnline: (val: boolean) => void;
  onlineRedBots: number;
  onlineBlueBots: number;
  onChangeOnlineRedBots: (count: number) => void;
  onChangeOnlineBlueBots: (count: number) => void;
  savedTournamentResumeLabel: string | null;
  savedLeagueResumeLabel: string | null;
  wsConnected: boolean;
  errorMsg: string | null;
  onEnterLandscapeFullscreen: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenDailyReward: () => void;
  onOpenShop: () => void;
  onStartTraining: () => void;
  onStartTutorial: () => void;
  tutorialCompleted: boolean;
  onStartChallenge: () => void;
  onStartSolo: () => void;
  onStartSoloTournament: () => void;
  onResumeSoloTournament: () => void;
  onStartSoloLeague: () => void;
  onResumeSoloLeague: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
}

type MenuView = 'home' | 'play_choice' | 'solo_menu' | 'online_menu';

export const MainMenuOverlay: React.FC<MainMenuOverlayProps> = ({
  playerName,
  coins,
  dailyRewardAvailable,
  challengeTriesLabel,
  selectedMode,
  onSelectMode,
  pitchSize,
  onSelectPitchSize,
  durationSec,
  onSelectDuration,
  teamMeta,
  onChangeTeamMeta,
  soloTeam,
  onSelectSoloTeam,
  soloGameType,
  onChangeSoloGameType,
  onlineGameType,
  onChangeOnlineGameType,
  defaultBotDifficulty,
  onChangeDefaultBotDifficulty,
  onToggleFillBotsOnline,
  onlineRedBots,
  onlineBlueBots,
  onChangeOnlineRedBots,
  onChangeOnlineBlueBots,
  savedTournamentResumeLabel,
  savedLeagueResumeLabel,
  wsConnected,
  errorMsg,
  onEnterLandscapeFullscreen,
  onOpenProfile,
  onOpenSettings,
  onOpenDailyReward,
  onOpenShop,
  onStartTraining,
  onStartTutorial,
  tutorialCompleted,
  onStartChallenge,
  onStartSolo,
  onStartSoloTournament,
  onResumeSoloTournament,
  onStartSoloLeague,
  onResumeSoloLeague,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [view, setView] = useState<MenuView>('home');
  const [setupModal, setSetupModal] = useState<SetupModalKind>(null);
  const [joinCode, setJoinCode] = useState('');
  const [openRooms, setOpenRooms] = useState<PublicRoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [, setBallTick] = useState(0);

  useEffect(() => {
    preloadBallSkin('default');
    return subscribeBallSprites(() => setBallTick((t) => t + 1));
  }, []);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch(`${getServerHttpBase()}/api/rooms`);
      if (res.ok) {
        const data = (await res.json()) as { rooms: PublicRoomSummary[] };
        setOpenRooms(data.rooms || []);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (view === 'online_menu') {
      fetchRooms();
    }
  }, [view]);

  const redTheme = TEAM_COLOR_PALETTE[teamMeta.red.colorId];
  const blueTheme = TEAM_COLOR_PALETTE[teamMeta.blue.colorId];
  const maxBotsPerTeam = MODE_CONFIGS[selectedMode].teamSize;
  const clampedRedBots = Math.max(0, Math.min(maxBotsPerTeam, onlineRedBots));
  const clampedBlueBots = Math.max(0, Math.min(maxBotsPerTeam, onlineBlueBots));

  return (
    <div className="fixed inset-0 z-40 w-full h-full overflow-hidden bg-[#FAF4E8] text-[#0D2545] flex flex-col justify-between pt-[max(0.3rem,env(safe-area-inset-top))] pb-[max(0.3rem,env(safe-area-inset-bottom))] pl-[max(0.6rem,env(safe-area-inset-left))] pr-[max(0.6rem,env(safe-area-inset-right))] sm:px-6 sm:py-2.5 select-none">
      {/* Subtle Hexagonal Background Pattern */}
      <svg
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none opacity-45"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="hex-grid" width="90" height="78" patternUnits="userSpaceOnUse">
            <path
              d="M45 0 L90 26 L90 52 L45 78 L0 52 L0 26 Z"
              fill="none"
              stroke="#DFCCA8"
              strokeWidth="1.2"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex-grid)" />
      </svg>

      {/* Top Header Bar: Profile (Left) & Coins + Daily (Right) */}
      <header className="relative z-10 flex items-center justify-between shrink-0 pb-1">
        <button
          type="button"
          onClick={onOpenProfile}
          className="min-h-[40px] flex items-center gap-2 pr-3 rounded-xl hover:bg-black/5 transition-colors text-left cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8DEC8] border-2 border-[#C7A972] flex items-center justify-center shadow-sm shrink-0">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#0D2545]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm sm:text-base text-[#0D2545] truncate max-w-[140px]">
              {playerName.trim() || 'Oyuncu'}
            </span>
            <span className="text-[10px] font-semibold text-[#118C4F]">Profil &amp; Başarımlar</span>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <PWAInstallButton />

          <div className="flex items-center gap-1.5 font-display font-bold text-sm sm:text-lg text-[#0D2545] tabular-nums">
            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600/50 text-[10px] sm:text-[11px] font-extrabold text-amber-950 shadow-sm">
              J
            </span>
            <span>{coins.toLocaleString('en-US')}</span>
          </div>

          <button
            type="button"
            onClick={onOpenDailyReward}
            aria-label="Günlük Ödül"
            title="Günlük Ödül"
            className={`relative min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] rounded-xl border shadow-sm flex items-center justify-center transition-colors cursor-pointer ${
              dailyRewardAvailable
                ? 'bg-amber-100 hover:bg-amber-200 border-amber-400 text-amber-900'
                : 'bg-white/90 hover:bg-white border-[#E5DEC9] text-[#0D2545]'
            }`}
          >
            <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
            {dailyRewardAvailable && (
              <span className="absolute -top-1 -right-1 px-1 rounded bg-red-600 text-white text-[8px] font-bold leading-tight">
                1
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area — Fullscreen, Zero Vertical Scroll */}
      <div className="relative z-10 flex-1 min-h-0 w-full flex flex-col overflow-hidden">
        {/* HOME VIEW */}
        {view === 'home' && (
          <div className="w-full h-full max-w-6xl mx-auto grid grid-cols-1 min-[520px]:grid-cols-12 items-center gap-2.5 sm:gap-6">
            {/* Hero Cluster */}
            <div className="min-[520px]:col-span-7 lg:col-span-8 flex flex-col min-[520px]:flex-row items-center justify-center gap-2.5 sm:gap-5">
              <div className="text-center min-[520px]:text-right flex flex-col items-center min-[520px]:items-end">
                <p className="text-[10px] sm:text-xs font-display font-bold tracking-[0.14em] text-[#0E7943] mb-1">
                  1v1 – 5v5 Futbol Arenası
                </p>
                <h1 className="font-display font-black italic text-4xl sm:text-5xl lg:text-[4.5rem] leading-[0.9] tracking-[-0.035em] drop-shadow-[0_2px_10px_rgba(11,37,69,0.08)]">
                  <span className="bg-gradient-to-br from-[#081A33] via-[#0E3263] to-[#174E8E] bg-clip-text text-transparent">
                    SAHA
                  </span>
                  <span className="bg-gradient-to-br from-[#118C4F] to-[#1AB969] bg-clip-text text-transparent">
                    BALL
                  </span>
                </h1>
                <div className="mt-2 flex items-center justify-center min-[520px]:justify-end gap-2">
                  <p className="text-xs sm:text-sm lg:text-base font-display font-semibold tracking-wide text-[#0B2545]/80">
                    Saha Senin, Top Senin
                  </p>
                  <span className="w-7 h-1 rounded-full bg-gradient-to-r from-[#118C4F] to-amber-400" />
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center shrink-0">
                <img
                  src={getBallPreviewUrl('default')}
                  alt="SahaBall Futbol Topu"
                  referrerPolicy="no-referrer"
                  className="relative z-10 w-24 h-24 min-[680px]:w-40 min-[680px]:h-40 lg:w-52 lg:h-52 rounded-full object-contain drop-shadow-[0_14px_20px_rgba(11,37,69,0.18)] select-none pointer-events-none"
                />
                <div className="w-20 sm:w-28 lg:w-36 h-2.5 -mt-1.5 rounded-full bg-[#0B2545]/18 blur-[4px] pointer-events-none" />
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="min-[520px]:col-span-5 lg:col-span-4 flex flex-col items-center min-[520px]:items-end gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  onEnterLandscapeFullscreen();
                  setView('play_choice');
                }}
                className="w-full max-w-[280px] min-h-[42px] sm:min-h-[48px] px-5 rounded-2xl bg-[#118C4F] hover:bg-[#0E7943] active:translate-y-0.5 text-white font-display font-extrabold text-base sm:text-xl tracking-wide flex items-center justify-center gap-2.5 shadow-[0_4px_0_#0A5D33] transition-all cursor-pointer whitespace-nowrap"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>OYNA</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onEnterLandscapeFullscreen();
                  onStartTraining();
                }}
                className="w-full max-w-[280px] min-h-[38px] sm:min-h-[44px] px-4 rounded-2xl bg-emerald-950 hover:bg-emerald-900 active:translate-y-0.5 text-white font-display font-bold text-xs sm:text-sm flex items-center justify-between gap-2 shadow-[0_3px_0_#022c22] transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>Serbest Antrenman</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onEnterLandscapeFullscreen();
                  onStartChallenge();
                }}
                className="w-full max-w-[280px] min-h-[38px] sm:min-h-[44px] px-4 rounded-2xl bg-[#0B2545] hover:bg-[#143766] active:translate-y-0.5 text-white font-display font-bold text-xs sm:text-sm flex items-center justify-between gap-2 shadow-[0_3px_0_#06162B] transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Günlük Challenge</span>
                </span>
                <span className="text-[10px] font-semibold font-mono-num tabular-nums text-amber-200 shrink-0">
                  {challengeTriesLabel}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onEnterLandscapeFullscreen();
                  onStartTutorial();
                }}
                className="w-full max-w-[280px] min-h-[38px] sm:min-h-[44px] px-4 rounded-2xl bg-white hover:bg-slate-50 active:translate-y-0.5 text-[#0B2545] border border-[#E6DEC9] font-display font-bold text-xs sm:text-sm flex items-center justify-between gap-2 shadow-[0_4px_14px_rgba(11,37,69,0.08)] transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#118C4F] shrink-0" />
                  <span>Nasıl Oynanır?</span>
                </span>
                <span
                  className={`text-[10px] font-bold shrink-0 ${
                    tutorialCompleted ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {tutorialCompleted ? 'Tamamlandı' : '4 Adım'}
                </span>
              </button>

              <div className="w-full max-w-[280px] grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={onOpenShop}
                  className="min-h-[38px] sm:min-h-[44px] px-3 rounded-2xl bg-white hover:bg-slate-50 active:translate-y-0.5 text-[#0B2545] border border-[#E6DEC9] font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(11,37,69,0.08)] transition-all cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag className="w-4 h-4 text-[#118C4F] shrink-0" />
                  <span>Mağaza</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="min-h-[38px] sm:min-h-[44px] px-3 rounded-2xl bg-white hover:bg-slate-50 active:translate-y-0.5 text-[#0B2545] border border-[#E6DEC9] font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(11,37,69,0.08)] transition-all cursor-pointer whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#0B2545] shrink-0" />
                  <span>Ayarlar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PLAY CHOICE VIEW — Fullscreen 2-Column Mode Selector */}
        {view === 'play_choice' && (
          <div className="w-full h-full bg-white/95 border border-[#E6DEC9] rounded-2xl sm:rounded-3xl shadow-xl p-3 sm:p-5 flex flex-col justify-between gap-3 overflow-hidden">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setView('home')}
                className="min-h-[38px] px-4 rounded-xl bg-[#0B2545] hover:bg-[#143766] border border-[#1E4A82] text-white text-xs sm:text-sm font-display font-extrabold flex items-center gap-1.5 shadow-[0_2px_0_#06162B] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Geri</span>
              </button>
              <h2 className="font-display font-extrabold text-base sm:text-xl text-[#0B2545] whitespace-nowrap">
                Oyun Modu Seç
              </h2>
              <div className="w-16 shrink-0" />
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 min-[500px]:grid-cols-2 gap-3 sm:gap-5 items-stretch">
              <button
                type="button"
                onClick={() => setView('solo_menu')}
                className="text-left p-4 sm:p-7 rounded-2xl bg-[#FAF4E8] hover:bg-[#F3E9D2] border-2 border-[#DFCCA8] hover:border-[#118C4F] transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#118C4F] text-white flex items-center justify-center shadow-sm">
                    <Bot className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-[#118C4F]">
                    Hızlı Maç · 32T Turnuva · 18T Lig
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="font-display font-extrabold text-xl sm:text-2xl text-[#0B2545]">
                    Tekli Mod
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Yapay zeka botlara karşı hızlı maç oyna, 32 takımlı eleme turnuvasına veya 18 takımlı Süper Lig sezonuna katıl.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setView('online_menu')}
                className="text-left p-4 sm:p-7 rounded-2xl bg-[#FAF4E8] hover:bg-[#F3E9D2] border-2 border-[#DFCCA8] hover:border-[#0B2545] transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0B2545] text-white flex items-center justify-center shadow-sm">
                    <Globe className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-[#0B2545]">
                    Oda Kur · Katıl · Lobi Sohbeti
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="font-display font-extrabold text-xl sm:text-2xl text-[#0B2545]">
                    Çevrimiçi
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Oda kur veya kod ile katıl, lobide sohbet et, mevki seç ve çevrimiçi oyuncularla karşılaş.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* MENU 1: TEKLİ MOD — Fullscreen, Zero Scroll */}
        {view === 'solo_menu' && (
          <div className="w-full h-full bg-white/95 border border-[#E6DEC9] rounded-2xl sm:rounded-3xl shadow-xl p-2 sm:p-4 flex flex-col justify-between gap-1.5 sm:gap-2.5 overflow-hidden">
            {/* Header & Game Type Switch */}
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setView('play_choice')}
                className="min-h-[34px] sm:min-h-[38px] px-3 sm:px-3.5 rounded-xl bg-[#0B2545] hover:bg-[#143766] border border-[#1E4A82] text-white text-xs sm:text-sm font-display font-extrabold flex items-center gap-1.5 shadow-[0_2px_0_#06162B] active:translate-y-0.5 transition-all shrink-0 whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                <span>Geri</span>
              </button>

              <div className="grid grid-cols-3 gap-1 p-0.5 sm:p-1 rounded-xl bg-slate-100 border border-slate-200/80 flex-1 max-w-md">
                <button
                  type="button"
                  onClick={() => onChangeSoloGameType('single')}
                  className={`min-h-[28px] sm:min-h-[34px] px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-display font-bold transition-colors truncate whitespace-nowrap cursor-pointer ${
                    soloGameType === 'single'
                      ? 'bg-[#0B2545] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#0B2545]'
                  }`}
                >
                  Hızlı Maç
                </button>
                <button
                  type="button"
                  onClick={() => onChangeSoloGameType('tournament')}
                  className={`min-h-[28px] sm:min-h-[34px] px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-display font-bold transition-colors flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                    soloGameType === 'tournament'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-[#0B2545]'
                  }`}
                >
                  <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>Turnuva</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeSoloGameType('league')}
                  className={`min-h-[28px] sm:min-h-[34px] px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-display font-bold transition-colors flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                    soloGameType === 'league'
                      ? 'bg-[#118C4F] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#0B2545]'
                  }`}
                >
                  <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>Lig</span>
                </button>
              </div>

              <div className="hidden min-[520px]:block w-14 sm:w-16 shrink-0" />
            </div>

            {/* Setting Tiles Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-3 gap-1.5 sm:gap-3 items-stretch">
              <button
                type="button"
                onClick={() => setSetupModal('mode')}
                className="p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#FAF4E8] hover:bg-[#F3E9D2] border border-[#E5DEC9] text-left transition-colors flex flex-col justify-between cursor-pointer min-h-0"
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#118C4F] shrink-0" />
                  <span className="truncate">Maç Modu</span>
                </span>
                <span className="font-display font-extrabold text-sm sm:text-2xl text-[#0B2545] leading-tight">
                  {selectedMode}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSetupModal('pitch')}
                className="p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#FAF4E8] hover:bg-[#F3E9D2] border border-[#E5DEC9] text-left transition-colors flex flex-col justify-between cursor-pointer min-h-0"
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#118C4F] shrink-0" />
                  <span className="truncate">Saha Seç</span>
                </span>
                <span className="font-display font-extrabold text-sm sm:text-2xl text-[#0B2545] truncate leading-tight">
                  {PITCH_SIZE_LABELS[pitchSize].label}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSetupModal('duration')}
                className="p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#FAF4E8] hover:bg-[#F3E9D2] border border-[#E5DEC9] text-left transition-colors flex flex-col justify-between cursor-pointer min-h-0"
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#118C4F] shrink-0" />
                  <span className="truncate">Maç Süresi</span>
                </span>
                <span className="font-display font-extrabold text-sm sm:text-2xl text-[#0B2545] leading-tight">
                  {Math.round(durationSec / 60)} Dakika
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSetupModal('difficulty')}
                className="p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#FAF4E8] hover:bg-[#F3E9D2] border border-[#E5DEC9] text-left transition-colors flex flex-col justify-between cursor-pointer min-h-0"
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#118C4F] shrink-0" />
                  <span className="truncate">Bot Zorluğu</span>
                </span>
                <span className="font-display font-extrabold text-sm sm:text-2xl text-[#0B2545] truncate leading-tight">
                  {BOT_DIFFICULTY_LABELS[defaultBotDifficulty].label}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSetupModal('teams')}
                className="col-span-2 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#FAF4E8] hover:bg-[#F3E9D2] border border-[#E5DEC9] text-left transition-colors flex flex-col justify-between cursor-pointer min-h-0"
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#118C4F] shrink-0" />
                  <span className="truncate">
                    {soloGameType === 'single'
                      ? 'Takım İsimleri & Renkleri'
                      : 'Kendi Takımın & Rengin'}
                  </span>
                </span>
                {soloGameType === 'single' ? (
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-xl font-display font-extrabold text-[#0B2545] truncate leading-tight">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <span
                        style={{ backgroundColor: redTheme.hex }}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/20 shrink-0"
                      />
                      <span className="truncate">{teamMeta.red.name}</span>
                    </span>
                    <span className="text-slate-400 text-xs sm:text-sm">vs</span>
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <span
                        style={{ backgroundColor: blueTheme.hex }}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/20 shrink-0"
                      />
                      <span className="truncate">{teamMeta.blue.name}</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs sm:text-xl font-display font-extrabold text-[#0B2545] truncate leading-tight">
                    <span
                      style={{ backgroundColor: redTheme.hex }}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/20 shrink-0"
                    />
                    <span className="truncate">{teamMeta.red.name}</span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-500">({redTheme.label})</span>
                  </div>
                )}
              </button>
            </div>

            {/* Competition Context Strip & CTA */}
            <div className="space-y-1.5 shrink-0">
              {soloGameType === 'tournament' && (
                <div className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 text-[10.5px] sm:text-xs text-amber-900 font-semibold">
                  <span className="truncate">32 Takımlı Eleme Turnuvası · Şampiyon +150 Jeton · İkinci +75 Jeton</span>
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
                </div>
              )}
              {soloGameType === 'league' && (
                <div className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2 text-[10.5px] sm:text-xs text-emerald-900 font-semibold">
                  <span className="truncate">18 Takımlı Süper Lig · 17 Hafta · 1. +150 · 2. +50 · 3. +25 Jeton</span>
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 shrink-0" />
                </div>
              )}

              {soloGameType === 'tournament' && savedTournamentResumeLabel ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={onResumeSoloTournament}
                    className="col-span-2 min-h-[38px] sm:min-h-[44px] rounded-xl font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_3px_0_#047857] transition-all active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                    <span>Devam Et ({savedTournamentResumeLabel})</span>
                  </button>
                  <button
                    type="button"
                    onClick={onStartSoloTournament}
                    className="min-h-[38px] sm:min-h-[44px] rounded-xl font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_3px_0_#B45309] transition-all active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Yeni Başlat</span>
                  </button>
                </div>
              ) : soloGameType === 'league' && savedLeagueResumeLabel ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={onResumeSoloLeague}
                    className="col-span-2 min-h-[38px] sm:min-h-[44px] rounded-xl font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_3px_0_#047857] transition-all active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                    <span>Devam Et ({savedLeagueResumeLabel})</span>
                  </button>
                  <button
                    type="button"
                    onClick={onStartSoloLeague}
                    className="min-h-[38px] sm:min-h-[44px] rounded-xl font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-[#0B2545] hover:bg-[#143766] text-white shadow-[0_3px_0_#06162B] transition-all active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Yeni Lig</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={
                    soloGameType === 'tournament'
                      ? onStartSoloTournament
                      : soloGameType === 'league'
                        ? onStartSoloLeague
                        : onStartSolo
                  }
                  className={`w-full min-h-[38px] sm:min-h-[46px] rounded-xl font-display font-extrabold text-xs sm:text-base flex items-center justify-center gap-2 transition-all active:translate-y-0.5 whitespace-nowrap cursor-pointer ${
                    soloGameType === 'tournament'
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_3px_0_#B45309]'
                      : 'bg-[#118C4F] hover:bg-[#0E7943] text-white shadow-[0_3px_0_#0A5D33]'
                  }`}
                >
                  {soloGameType === 'tournament' ? (
                    <>
                      <Trophy className="w-4 h-4" />
                      <span>Turnuvayı Başlat (32 Takım · {selectedMode})</span>
                    </>
                  ) : soloGameType === 'league' ? (
                    <>
                      <Trophy className="w-4 h-4" />
                      <span>Ligi Başlat (18 Takım · {selectedMode})</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Maça Başla ({selectedMode})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* MENU 2: ÇEVRİMİÇİ — Fullscreen, Zero Scroll */}
        {view === 'online_menu' && (
          <div className="w-full h-full bg-white/95 border border-[#E6DEC9] rounded-2xl sm:rounded-3xl shadow-xl p-2 sm:p-4 flex flex-col justify-between gap-1.5 sm:gap-2.5 overflow-hidden">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setView('play_choice')}
                className="min-h-[34px] sm:min-h-[38px] px-3 sm:px-3.5 rounded-xl bg-[#0B2545] hover:bg-[#143766] border border-[#1E4A82] text-white text-xs sm:text-sm font-display font-extrabold flex items-center gap-1.5 shadow-[0_2px_0_#06162B] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                <span>Geri</span>
              </button>
              <div className="text-center min-w-0">
                <h2 className="font-display font-extrabold text-xs sm:text-lg text-[#0B2545] truncate leading-tight">
                  Çevrimiçi
                </h2>
                <p className="text-[9.5px] sm:text-xs font-semibold text-slate-500 truncate leading-tight">
                  Lobi ücretsiz · Maç başlangıcı: 10 Jeton · Galibiyet: +18 Jeton
                </p>
              </div>
              <div className="w-14 sm:w-16 shrink-0" />
            </div>

            {errorMsg && (
              <div className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium shrink-0">
                {errorMsg}
              </div>
            )}

            <div className="flex-1 min-h-0 grid grid-cols-12 gap-2 sm:gap-3.5 items-stretch">
              {/* Col 1: Room Setup */}
              <div className="col-span-5 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#FAF4E8] border border-[#E5DEC9] flex flex-col justify-between gap-1.5 min-h-0">
                <div className="space-y-1.5 min-h-0">
                  <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-0.5 rounded-lg sm:rounded-xl bg-white/90 border border-[#E5DEC9]">
                    <button
                      type="button"
                      onClick={() => onChangeOnlineGameType('single')}
                      className={`min-h-[26px] sm:min-h-[32px] rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-display font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        onlineGameType === 'single' ? 'bg-[#0B2545] text-white' : 'text-slate-700'
                      }`}
                    >
                      Normal Maç
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeOnlineGameType('tournament')}
                      className={`min-h-[26px] sm:min-h-[32px] rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-display font-bold transition-colors flex items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap cursor-pointer ${
                        onlineGameType === 'tournament'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-700'
                      }`}
                    >
                      <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                      <span>Turnuva</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeOnlineGameType('league')}
                      className={`min-h-[26px] sm:min-h-[32px] rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-display font-bold transition-colors flex items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap cursor-pointer ${
                        onlineGameType === 'league'
                          ? 'bg-[#118C4F] text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                      <span>Lig</span>
                    </button>
                  </div>

                  {/* Clickable Setting Cards */}
                  <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSetupModal('mode')}
                      className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white hover:bg-slate-50 border border-[#E5DEC9] text-left cursor-pointer"
                    >
                      <div className="text-[9px] sm:text-[10px] font-bold text-slate-500">Mod</div>
                      <div className="font-display font-extrabold text-xs sm:text-sm text-[#0B2545] leading-tight">
                        {selectedMode}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetupModal('pitch')}
                      className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white hover:bg-slate-50 border border-[#E5DEC9] text-left cursor-pointer"
                    >
                      <div className="text-[9px] sm:text-[10px] font-bold text-slate-500">Saha</div>
                      <div className="font-display font-extrabold text-xs sm:text-sm text-[#0B2545] truncate leading-tight">
                        {PITCH_SIZE_LABELS[pitchSize].label}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetupModal('duration')}
                      className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white hover:bg-slate-50 border border-[#E5DEC9] text-left cursor-pointer"
                    >
                      <div className="text-[9px] sm:text-[10px] font-bold text-slate-500">Süre</div>
                      <div className="font-display font-extrabold text-xs sm:text-sm text-[#0B2545] leading-tight">
                        {Math.round(durationSec / 60)} Dk
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSetupModal('teams')}
                      className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white hover:bg-slate-50 border border-[#E5DEC9] text-left cursor-pointer"
                    >
                      <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 truncate">
                        {onlineGameType === 'single' ? 'Takımlar & Renk' : 'Takımım & Rengim'}
                      </div>
                      {onlineGameType === 'single' ? (
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#0B2545] truncate mt-0.5 leading-tight">
                          <span
                            style={{ backgroundColor: redTheme.hex }}
                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-black/20 shrink-0"
                          />
                          <span className="truncate">{teamMeta.red.name}</span>
                          <span className="text-slate-400">-</span>
                          <span
                            style={{ backgroundColor: blueTheme.hex }}
                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-black/20 shrink-0"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#0B2545] truncate mt-0.5 leading-tight">
                          <span
                            style={{ backgroundColor: redTheme.hex }}
                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-black/20 shrink-0"
                          />
                          <span className="truncate">{teamMeta.red.name}</span>
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSetupModal('difficulty')}
                      className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white hover:bg-slate-50 border border-[#E5DEC9] text-left cursor-pointer"
                    >
                      <div className="text-[9px] sm:text-[10px] font-bold text-slate-500">Botlar</div>
                      <div className="text-[11px] sm:text-xs font-bold text-[#0B2545] truncate mt-0.5 leading-tight">
                        {BOT_DIFFICULTY_LABELS[defaultBotDifficulty].label}
                        {onlineGameType === 'single' ? ` · ${clampedRedBots}+${clampedBlueBots}` : ''}
                      </div>
                    </button>
                  </div>

                  {onlineGameType === 'tournament' && (
                    <div className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 text-[9.5px] sm:text-[11px] font-semibold text-amber-900 truncate">
                      32 Takım · 1. +150 Jeton · 2. +75 Jeton
                    </div>
                  )}
                  {onlineGameType === 'league' && (
                    <div className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-[9.5px] sm:text-[11px] font-semibold text-emerald-900 truncate">
                      18 Takım · 1. +150 · 2. +50 · 3. +25 Jeton
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!wsConnected}
                  onClick={onCreateRoom}
                  className={`w-full min-h-[34px] sm:min-h-[42px] px-2.5 rounded-xl disabled:opacity-50 font-display font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-colors whitespace-nowrap cursor-pointer ${
                    onlineGameType === 'tournament'
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-[#118C4F] hover:bg-[#0E7943] text-white'
                  }`}
                >
                  {onlineGameType !== 'single' ? (
                    <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  ) : (
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {!wsConnected
                      ? 'Bağlanıyor...'
                      : onlineGameType === 'tournament'
                        ? `Turnuva Odası Kur (32T · ${selectedMode})`
                        : onlineGameType === 'league'
                          ? `Lig Odası Kur (18T · ${selectedMode})`
                          : `Oda Kur (${selectedMode})`}
                  </span>
                </button>
              </div>

              {/* Col 2: Join Room by Code */}
              <div className="col-span-3 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#FAF4E8] border border-[#E5DEC9] flex flex-col justify-between gap-1.5 min-h-0">
                <div>
                  <h3 className="font-display font-bold text-xs sm:text-base text-[#0B2545]">Kod ile Katıl</h3>
                  <p className="text-[10px] sm:text-xs text-slate-600 mt-0.5 leading-snug">
                    6 haneli oda kodunu gir.
                  </p>
                </div>
                <div className="space-y-1.5 sm:space-y-2.5">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="KOD (K7P2M9)"
                    className="w-full h-9 sm:h-11 px-2.5 rounded-xl bg-white border border-slate-300 text-[#0B2545] placeholder-slate-400 font-mono-num text-xs sm:text-sm uppercase tracking-wider focus:outline-none focus:border-[#118C4F]"
                  />
                  <button
                    type="button"
                    disabled={!wsConnected || joinCode.trim().length < 4}
                    onClick={() => onJoinRoom(joinCode.trim())}
                    className="w-full min-h-[34px] sm:min-h-[42px] px-2.5 rounded-xl bg-[#0B2545] hover:bg-[#143766] disabled:opacity-45 text-white font-display font-bold text-[11px] sm:text-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Odaya Katıl
                  </button>
                </div>
              </div>

              {/* Col 3: Open Rooms */}
              <div className="col-span-4 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between overflow-hidden min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-xs sm:text-sm font-bold text-[#0B2545]">Aktif Odalar</span>
                  <button
                    type="button"
                    onClick={fetchRooms}
                    className="text-xs font-semibold text-[#118C4F] flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-emerald-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
                    <span>Yenile</span>
                  </button>
                </div>

                {openRooms.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-500 px-3">
                    Açık oda yok. Soldan hemen oda kurabilirsin.
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-start gap-2 overflow-hidden">
                    {openRooms.slice(0, 3).map((rm) => (
                      <button
                        key={rm.roomCode}
                        type="button"
                        onClick={() => onJoinRoom(rm.roomCode)}
                        className="w-full min-h-[44px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#0B2545] truncate">
                            {rm.hostName} ·{' '}
                            <span className="font-mono-num text-[#118C4F]">{rm.roomCode}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {rm.mode} · {rm.playerCount}/{rm.maxPlayers}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#118C4F] ml-2 shrink-0">
                          Katıl
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Focused Small Setup Option Windows */}
      <SetupOptionModals
        activeModal={setupModal}
        onClose={() => setSetupModal(null)}
        mode={selectedMode}
        onChangeMode={onSelectMode}
        pitchSize={pitchSize}
        onChangePitchSize={onSelectPitchSize}
        durationSec={durationSec}
        onChangeDurationSec={onSelectDuration}
        teamMeta={teamMeta}
        onChangeTeamMeta={onChangeTeamMeta}
        onlyOwnTeam={
          view === 'solo_menu' ? soloGameType !== 'single' : onlineGameType !== 'single'
        }
        soloTeam={view === 'solo_menu' && soloGameType === 'single' ? soloTeam : undefined}
        onChangeSoloTeam={
          view === 'solo_menu' && soloGameType === 'single' ? onSelectSoloTeam : undefined
        }
        botDifficulty={defaultBotDifficulty}
        onChangeBotDifficulty={onChangeDefaultBotDifficulty}
        showBotCounts={view === 'online_menu' && onlineGameType === 'single'}
        redBotCount={clampedRedBots}
        blueBotCount={clampedBlueBots}
        onChangeRedBotCount={(next) => {
          onChangeOnlineRedBots(next);
          onToggleFillBotsOnline(next > 0 || clampedBlueBots > 0);
        }}
        onChangeBlueBotCount={(next) => {
          onChangeOnlineBlueBots(next);
          onToggleFillBotsOnline(clampedRedBots > 0 || next > 0);
        }}
      />
    </div>
  );
};
