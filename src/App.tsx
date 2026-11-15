import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, PlayCircle, Target, Volume2, VolumeX } from 'lucide-react';
import { AdRewardModal } from './components/AdRewardModal';
import { DailyRewardModal } from './components/DailyRewardModal';
import { LandscapeGuard } from './components/LandscapeGuard';
import { LobbyOverlay } from './components/LobbyOverlay';
import { LeagueOverlay } from './components/LeagueOverlay';
import { MainMenuOverlay } from './components/MainMenuOverlay';
import { MatchEndOverlay } from './components/MatchEndOverlay';
import { PitchCanvas } from './components/PitchCanvas';
import { ProfileModal } from './components/ProfileModal';
import { ScoreboardHUD } from './components/ScoreboardHUD';
import { SettingsModal } from './components/SettingsModal';
import { ShopModal } from './components/ShopModal';
import { SoloPauseModal } from './components/SoloPauseModal';
import { TouchControls } from './components/TouchControls';
import { TournamentBracketOverlay } from './components/TournamentBracketOverlay';
import { TrainingHUD } from './components/TrainingHUD';
import { TutorialHUD } from './components/TutorialHUD';
import { ChallengeEngine } from './game/challenge';
import type { ChallengeResult, ChallengeStatus } from './game/challenge';
import { loadControlsLayout, saveControlsLayout } from './game/controlsLayout';
import type { ControlsLayoutConfig } from './game/controlsLayout';
import { getServerWsUrl } from './game/network';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  createLeagueSeason,
  getClubColorId,
  recordLeagueMatchResult,
  resolveLeagueBotMatches,
} from './game/league';
import { MatchEngine, TICK_RATE } from './game/physics';
import { getDevicePerfProfile } from './game/performance';
import { loadProfile, saveProfile, USERNAME_CHANGE_COST } from './game/profile';
import type { ProfileData } from './game/profile';
import { DEFAULT_SKINS } from './game/shop';
import type { EquippedSkins, ShopCategory, ShopItem } from './game/shop';
import { soundManager } from './game/sound';
import {
  createTournamentBracket,
  getTournamentRunnerUpSlot,
  recordTournamentMatchResult,
  resolveBotOnlyMatches,
} from './game/tournament';
import { TrainingEngine } from './game/training';
import type { TrainingKeeperMode, TrainingStats } from './game/training';
import { TUTORIAL_STEPS, TutorialEngine } from './game/tutorial';
import type { TutorialStepMeta } from './game/tutorial';
import { DEFAULT_TEAM_META, MODE_CONFIGS, TEAM_COLOR_PALETTE } from './game/types';
import type {
  ActiveTeam,
  BotDifficulty,
  ClientWsMessage,
  FormationPreset,
  GameMode,
  GameSnapshot,
  LeagueStateInfo,
  MatchPhase,
  PitchSize,
  PlayerEntity,
  PlayerInput,
  PlayerRole,
  RoomGameType,
  RoomStateInfo,
  ServerWsMessage,
  Team,
  TeamColorId,
  TeamMetaMap,
  TournamentStateInfo,
} from './game/types';

type ScreenView = 'menu' | 'lobby' | 'playing' | 'training' | 'tutorial' | 'challenge' | 'tournament' | 'league';

const EMPTY_PLAYERS: PlayerEntity[] = [];

interface SavedSoloTournament {
  tournament: TournamentStateInfo;
  mode: GameMode;
  pitchSize: PitchSize;
  durationSec: number;
  role: PlayerRole;
  bonusClaimed: boolean;
  ownColorId?: TeamColorId;
}

interface SavedSoloLeague {
  league: LeagueStateInfo;
  mode: GameMode;
  pitchSize: PitchSize;
  durationSec: number;
  role: PlayerRole;
  rewardClaimed: boolean;
  ownColorId?: TeamColorId;
}

const SOLO_TOURNAMENT_STORAGE_KEY = 'sahaball_solo_tournament_v1';
const SOLO_LEAGUE_STORAGE_KEY = 'sahaball_solo_league_v1';

function buildSoloCompetitionTeamMeta(
  slotA: number,
  slotB: number,
  nameA: string,
  nameB: string,
  ownColorId: TeamColorId
): TeamMetaMap {
  let colorA: TeamColorId;
  let colorB: TeamColorId;
  if (slotA === 0) {
    colorA = ownColorId;
    colorB = getClubColorId(slotB, ownColorId);
  } else if (slotB === 0) {
    colorB = ownColorId;
    colorA = getClubColorId(slotA, ownColorId);
  } else {
    colorA = getClubColorId(slotA);
    colorB = getClubColorId(slotB, colorA);
  }
  return {
    red: { name: nameA, colorId: colorA },
    blue: { name: nameB, colorId: colorB },
  };
}

function loadSavedSoloTournament(): SavedSoloTournament | null {
  try {
    const raw = localStorage.getItem(SOLO_TOURNAMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSoloTournament;
    if (!parsed?.tournament || parsed.tournament.phase === 'champion' || parsed.tournament.size !== 32) {
      return null;
    }
    // Normalize any interrupted match back to 'bracket' so user can resume cleanly
    if (parsed.tournament.phase === 'playing') {
      parsed.tournament.phase = 'bracket';
      for (const m of parsed.tournament.matches) {
        if (m.status === 'playing') m.status = 'pending';
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function loadSavedSoloLeague(): SavedSoloLeague | null {
  try {
    const raw = localStorage.getItem(SOLO_LEAGUE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSoloLeague;
    if (!parsed?.league || parsed.league.phase === 'finished' || parsed.league.size !== 18) {
      return null;
    }
    if (parsed.league.phase === 'playing') {
      parsed.league.phase = 'fixtures';
      for (const m of parsed.league.matches) {
        if (m.status === 'playing') m.status = 'pending';
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

interface DailyChallengeQuota {
  date: string;
  freeUsed: boolean;
  adRetriesUsed: number;
}

type AdModalContext =
  | { type: 'match_double' }
  | { type: 'online_post_match' }
  | { type: 'challenge_retry' }
  | { type: 'daily_extra' }
  | { type: 'lobby_ad' }
  | null;

const LOCAL_SOLO_ID = 'local_human';
const DAILY_REWARD_AMOUNT = 10;
const MAX_CHALLENGE_AD_RETRIES = 3;

function getTodayKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCountdownToMidnight(nowMs: number): string {
  const now = new Date(nowMs);
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const totalSec = Math.max(0, Math.floor((nextMidnight - nowMs) / 1000));
  const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function loadChallengeQuota(): DailyChallengeQuota {
  const today = getTodayKey();
  try {
    const raw = localStorage.getItem('sahaball_challenge_daily');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyChallengeQuota>;
      if (parsed.date === today) {
        return {
          date: today,
          freeUsed: Boolean(parsed.freeUsed),
          adRetriesUsed: typeof parsed.adRetriesUsed === 'number' ? parsed.adRetriesUsed : 0,
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { date: today, freeUsed: false, adRetriesUsed: 0 };
}

export default function App() {
  const [screen, setScreen] = useState<ScreenView>('menu');
  const [playType, setPlayType] = useState<'solo' | 'online'>('solo');

  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('sahaball_name') || 'Oyuncu';
    } catch {
      return 'Oyuncu';
    }
  });
  const [coins, setCoins] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('sahaball_coins'));
      return Number.isFinite(saved) && saved >= 0 ? saved : 50;
    } catch {
      return 50;
    }
  });
  const [profile, setProfile] = useState<ProfileData>(() => loadProfile());
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [teamMeta, setTeamMeta] = useState<TeamMetaMap>(() => DEFAULT_TEAM_META);

  const [selectedMode, setSelectedMode] = useState<GameMode>('2v2');
  const [pitchSize, setPitchSize] = useState<PitchSize>('normal');
  const [durationSec, setDurationSec] = useState<number>(180);
  const [soloTeam, setSoloTeam] = useState<ActiveTeam>('red');
  const [soloGameType, setSoloGameType] = useState<RoomGameType>('single');
  const [onlineGameType, setOnlineGameType] = useState<RoomGameType>('single');
  const [soloTournament, setSoloTournament] = useState<TournamentStateInfo | null>(null);
  const [soloLeague, setSoloLeague] = useState<LeagueStateInfo | null>(null);
  const [savedSoloTournament, setSavedSoloTournament] = useState<SavedSoloTournament | null>(() =>
    loadSavedSoloTournament()
  );
  const [savedSoloLeague, setSavedSoloLeague] = useState<SavedSoloLeague | null>(() =>
    loadSavedSoloLeague()
  );
  const [soloActiveMatchTeam, setSoloActiveMatchTeam] = useState<ActiveTeam>('red');
  const [soloTournamentBonusClaimed, setSoloTournamentBonusClaimed] = useState<boolean>(false);
  const [soloLeagueBonusClaimed, setSoloLeagueBonusClaimed] = useState<boolean>(false);
  const [defaultBotDifficulty, setDefaultBotDifficulty] = useState<BotDifficulty>('normal');
  const [fillBotsOnline, setFillBotsOnline] = useState<boolean>(true);
  const [onlineRedBots, setOnlineRedBots] = useState<number>(1);
  const [onlineBlueBots, setOnlineBlueBots] = useState<number>(2);

  const isOnline = useOnlineStatus();
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [pauseOpen, setPauseOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Shop, Daily Reward, Ad Reward & Daily Challenge States
  const [ownedIds, setOwnedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('sahaball_owned');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [equippedSkins, setEquippedSkins] = useState<EquippedSkins>(() => {
    try {
      const raw = localStorage.getItem('sahaball_skins');
      return raw ? { ...DEFAULT_SKINS, ...(JSON.parse(raw) as Partial<EquippedSkins>) } : DEFAULT_SKINS;
    } catch {
      return DEFAULT_SKINS;
    }
  });
  const [lastDailyRewardDate, setLastDailyRewardDate] = useState<string>(() => {
    try {
      return localStorage.getItem('sahaball_daily_reward') || '';
    } catch {
      return '';
    }
  });
  const [challengeQuota, setChallengeQuota] = useState<DailyChallengeQuota>(() => loadChallengeQuota());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [shopOpen, setShopOpen] = useState<boolean>(false);
  const [dailyRewardOpen, setDailyRewardOpen] = useState<boolean>(false);
  const [challengeLimitOpen, setChallengeLimitOpen] = useState<boolean>(false);
  const [adContext, setAdContext] = useState<AdModalContext>(null);
  const [lastMatchEarnedCoins, setLastMatchEarnedCoins] = useState<number>(0);
  const [matchAdDoubled, setMatchAdDoubled] = useState<boolean>(false);

  const [challengeStatus, setChallengeStatus] = useState<ChallengeStatus>('dribbling');
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);

  // Custom Touch Controls Layout
  const [controlsLayout, setControlsLayout] = useState<ControlsLayoutConfig>(() =>
    loadControlsLayout()
  );

  // Interactive Tutorial Mode states
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sahaball_tutorial_done') === '1';
    } catch {
      return false;
    }
  });
  const [tutorialStepMeta, setTutorialStepMeta] = useState<TutorialStepMeta>(TUTORIAL_STEPS[0]);
  const [tutorialDoneNow, setTutorialDoneNow] = useState<boolean>(false);
  const [tutorialFirstReward, setTutorialFirstReward] = useState<number>(0);
  const [tutorialBannerText, setTutorialBannerText] = useState<string | null>(null);

  // Free Training Mode states
  const [trainingGkMode, setTrainingGkMode] = useState<TrainingKeeperMode>('moving');
  const [trainingGkCount, setTrainingGkCount] = useState<1 | 2>(1);
  const [trainingGkDiff, setTrainingGkDiff] = useState<BotDifficulty>('normal');
  const [trainingPitchSize, setTrainingPitchSize] = useState<PitchSize>('normal');
  const [trainingStats, setTrainingStats] = useState<TrainingStats>({ goals: 0, shots: 0, saves: 0 });
  const [trainingGoalBanner, setTrainingGoalBanner] = useState<GameSnapshot['goalBanner']>(null);

  // WebSocket / Online states
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomStateInfo | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  // HUD snapshot mirror (updated cleanly without stamina 60Hz re-renders)
  const [hudState, setHudState] = useState<{
    redScore: number;
    blueScore: number;
    timeLeftSec: number;
    phase: MatchPhase;
    phaseTimerSec: number;
    mode: GameMode;
    goalBanner: GameSnapshot['goalBanner'];
    summary: GameSnapshot['summary'];
    teamFormations: Record<ActiveTeam, FormationPreset>;
    teamMeta: TeamMetaMap;
    kickoffTeam: ActiveTeam;
    kickoffWaitingTouch: boolean;
  }>({
    redScore: 0,
    blueScore: 0,
    timeLeftSec: 180,
    phase: 'lobby',
    phaseTimerSec: 0,
    mode: '2v2',
    goalBanner: null,
    summary: null,
    teamFormations: { red: 'dengeli', blue: 'dengeli' },
    teamMeta: DEFAULT_TEAM_META,
    kickoffTeam: 'red',
    kickoffWaitingTouch: false,
  });

  const snapshotRef = useRef<GameSnapshot | null>(null);
  const inputRef = useRef<PlayerInput>({ seq: 0, dx: 0, dy: 0, kick: false, sprint: false });
  const staminaRef = useRef<number>(100);
  const clientIdRef = useRef<string | null>(null);
  const onBeforeRenderRef = useRef<((now: number) => void) | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const soloEngineRef = useRef<MatchEngine | null>(null);
  const demoEngineRef = useRef<MatchEngine | null>(null);
  const trainingEngineRef = useRef<TrainingEngine | null>(null);
  const tutorialEngineRef = useRef<TutorialEngine | null>(null);
  const tutorialRewardClaimedRef = useRef<boolean>(tutorialCompleted);
  const challengeEngineRef = useRef<ChallengeEngine | null>(null);
  const challengeSettledRef = useRef<boolean>(false);
  const pendingJoinCodeRef = useRef<string | null>(null);
  const matchRewardedRef = useRef<boolean>(false);
  const isClubCompetitionRef = useRef<boolean>(false);
  const soloActiveMatchIdRef = useRef<string | null>(null);
  const soloActiveLeagueMatchIdRef = useRef<string | null>(null);
  const soloMatchTeamMetaRef = useRef<TeamMetaMap | null>(null);
  const onlineChampionRewardedRef = useRef<boolean>(false);
  const onlineLeagueRewardedRef = useRef<boolean>(false);
  const playTypeRef = useRef<'solo' | 'online'>(playType);
  const coinsRef = useRef<number>(coins);

  useEffect(() => {
    playTypeRef.current = playType;
  }, [playType]);

  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  const addCoins = useCallback((amount: number) => {
    if (amount === 0) return;
    setCoins((prev) => {
      const next = Math.max(0, prev + amount);
      coinsRef.current = next;
      try {
        localStorage.setItem('sahaball_coins', String(next));
      } catch {
        // Ignore storage failures
      }
      return next;
    });
  }, []);

  const updateProfile = useCallback((updater: (prev: ProfileData) => ProfileData) => {
    setProfile((prev) => {
      const next = updater(prev);
      saveProfile(next);
      return next;
    });
  }, []);

  const handleUpdateUsername = useCallback(
    (rawName: string): { ok: boolean; error?: string } => {
      const trimmed = rawName.trim().slice(0, 14);
      if (trimmed.length < 2) {
        return { ok: false, error: 'Kullanıcı adı en az 2 karakter olmalı.' };
      }
      if (!profile.hasSetUsernameFree) {
        setPlayerName(trimmed);
        try {
          localStorage.setItem('sahaball_name', trimmed);
        } catch {
          // Ignore storage failures
        }
        updateProfile((prev) => ({ ...prev, hasSetUsernameFree: true }));
        return { ok: true };
      }
      if (trimmed === playerName.trim()) {
        return { ok: false, error: 'Zaten bu kullanıcı adını kullanıyorsun.' };
      }
      if (coinsRef.current < USERNAME_CHANGE_COST) {
        return {
          ok: false,
          error: `Kullanıcı adını değiştirmek için ${USERNAME_CHANGE_COST.toLocaleString('tr-TR')} jeton gerekli.`,
        };
      }
      addCoins(-USERNAME_CHANGE_COST);
      setPlayerName(trimmed);
      try {
        localStorage.setItem('sahaball_name', trimmed);
      } catch {
        // Ignore storage failures
      }
      return { ok: true };
    },
    [profile.hasSetUsernameFree, playerName, addCoins, updateProfile]
  );

  // Detect ?room=XXXXXX invite link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code && code.trim().length >= 4) {
      pendingJoinCodeRef.current = code.trim().toUpperCase();
    }
  }, []);

  // Unlock Web Audio once on first user interaction and then detach listeners
  useEffect(() => {
    soundManager.stopCrowdAmbience();
    if (soundManager.isReady) return;
    const unlock = () => {
      soundManager.unlock();
      if (soundManager.isReady) {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      soundManager.stopCrowdAmbience();
    };
  }, []);

  const hideNativeSystemBars = useCallback(() => {
    try {
      const cap = (window as unknown as {
        Capacitor?: {
          Plugins?: {
            StatusBar?: { hide?: () => Promise<void>; setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void> };
            NavigationBar?: { hide?: () => Promise<void> };
          };
        };
      }).Capacitor;
      void cap?.Plugins?.StatusBar?.setOverlaysWebView?.({ overlay: true });
      void cap?.Plugins?.StatusBar?.hide?.();
      void cap?.Plugins?.NavigationBar?.hide?.();
    } catch {
      // Ignore if not running inside Capacitor WebView
    }
  }, []);

  const requestImmersiveFullscreen = useCallback(async () => {
    hideNativeSystemBars();
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const el = document.documentElement as HTMLElement & {
      requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      if (el.requestFullscreen) {
        try {
          await el.requestFullscreen({ navigationUI: 'hide' });
        } catch {
          await el.requestFullscreen().catch(() => {});
        }
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen().catch(() => {});
      }
    }
    const scr = window.screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } };
    if (scr.orientation?.lock) {
      scr.orientation.lock('landscape').catch(() => {
        scr.orientation?.lock?.('landscape-primary').catch(() => {});
      });
    }
  }, [hideNativeSystemBars]);

  const enterLandscapeFullscreen = useCallback(async () => {
    try {
      await requestImmersiveFullscreen();
    } catch {
      // Ignore if browser restricts fullscreen/orientation lock
    }
  }, [requestImmersiveFullscreen]);

  // Hide mobile system bars on Capacitor launch & automatically enter immersive landscape fullscreen on first touch
  useEffect(() => {
    hideNativeSystemBars();
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    const onFirstTouch = () => {
      void enterLandscapeFullscreen();
    };
    window.addEventListener('pointerdown', onFirstTouch, { passive: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstTouch);
    };
  }, [hideNativeSystemBars, enterLandscapeFullscreen]);

  const toggleMute = useCallback(() => {
    soundManager.muted = !soundManager.muted;
    setIsMuted(soundManager.muted);
  }, []);

  const sendWs = useCallback((msg: ClientWsMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Keep competition-reward gate synced accurately
  useEffect(() => {
    isClubCompetitionRef.current =
      playType === 'solo'
        ? Boolean(soloTournament || soloLeague)
        : roomState?.gameType === 'tournament' || roomState?.gameType === 'league';
  }, [playType, soloTournament, soloLeague, roomState?.gameType]);

  // Keep online room member coin count synced with local balance
  useEffect(() => {
    if (!roomState?.roomCode) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update_coins', coins }));
    }
  }, [coins, roomState?.roomCode]);

  const syncHudFromSnapshot = useCallback(
    (snap: GameSnapshot, localId: string | null) => {
      for (const ev of snap.events) {
        soundManager.play(ev);
      }
      const localP = localId ? snap.players.find((p) => p.id === localId) : null;
      // Direct ref update for Sprint button ring -> zero React re-renders during active play
      staminaRef.current = localP ? localP.stamina : 100;

      if (snap.phase !== 'finished') {
        matchRewardedRef.current = false;
      } else if (snap.summary && !matchRewardedRef.current) {
        matchRewardedRef.current = true;
        const isOnlineNow = playTypeRef.current === 'online';
        const playerRow = localId ? snap.summary.playerRows.find((r) => r.id === localId) : undefined;
        const team = localP?.team ?? playerRow?.team;
        const won = Boolean(team && snap.summary.winner === team);
        const draw = snap.summary.winner === 'draw';
        const myGoals = playerRow?.goals ?? 0;

        // Profile stats & stars (solo vs computer: +10 win, +5 loss/draw)
        if (team === 'red' || team === 'blue') {
          updateProfile((prev) => {
            if (!isOnlineNow) {
              const earnedStars = won ? 10 : 5;
              return {
                ...prev,
                stars: prev.stars + earnedStars,
                soloWins: prev.soloWins + (won ? 1 : 0),
                soloDraws: prev.soloDraws + (draw ? 1 : 0),
                soloLosses: prev.soloLosses + (!won && !draw ? 1 : 0),
                totalGoals: prev.totalGoals + myGoals,
                totalMatches: prev.totalMatches + 1,
              };
            }
            return {
              ...prev,
              onlineWins: prev.onlineWins + (won ? 1 : 0),
              onlineMatches: prev.onlineMatches + 1,
              totalGoals: prev.totalGoals + myGoals,
              totalMatches: prev.totalMatches + 1,
            };
          });
        }

        if (isClubCompetitionRef.current) {
          // Tournament & League matches do NOT pay per match; rewards only at final placement
          setLastMatchEarnedCoins(0);
          setMatchAdDoubled(false);
        } else if (isOnlineNow) {
          // Online ("Arkadaşla Oyna"): win pays 18 jeton; post-match ad pays +25 jeton
          const reward = won ? 18 : 0;
          setLastMatchEarnedCoins(reward);
          setMatchAdDoubled(false);
          if (reward > 0) {
            addCoins(reward);
          }
        } else {
          const goalsBonus = myGoals * 15;
          const reward = (won ? 150 : 50) + goalsBonus;
          setLastMatchEarnedCoins(reward);
          setMatchAdDoubled(false);
          addCoins(reward);
        }
      }

      const countdownSec = snap.phase === 'countdown' ? Math.ceil(snap.phaseTimerSec) : 0;
      const nextRedForm = snap.teamFormations?.red ?? 'dengeli';
      const nextBlueForm = snap.teamFormations?.blue ?? 'dengeli';
      const nextMeta = snap.teamMeta ?? DEFAULT_TEAM_META;
      const nextKickoffTeam = snap.kickoffTeam ?? 'red';
      const nextKickoffWaiting = Boolean(snap.kickoffWaitingTouch);

      setHudState((prev) => {
        if (
          prev.redScore === snap.redScore &&
          prev.blueScore === snap.blueScore &&
          prev.timeLeftSec === snap.timeLeftSec &&
          prev.phase === snap.phase &&
          prev.phaseTimerSec === countdownSec &&
          prev.mode === snap.mode &&
          prev.goalBanner === snap.goalBanner &&
          prev.summary === snap.summary &&
          prev.teamFormations.red === nextRedForm &&
          prev.teamFormations.blue === nextBlueForm &&
          prev.teamMeta.red.name === nextMeta.red.name &&
          prev.teamMeta.red.colorId === nextMeta.red.colorId &&
          prev.teamMeta.blue.name === nextMeta.blue.name &&
          prev.teamMeta.blue.colorId === nextMeta.blue.colorId &&
          prev.kickoffTeam === nextKickoffTeam &&
          prev.kickoffWaitingTouch === nextKickoffWaiting
        ) {
          return prev;
        }
        return {
          redScore: snap.redScore,
          blueScore: snap.blueScore,
          timeLeftSec: snap.timeLeftSec,
          phase: snap.phase,
          phaseTimerSec: countdownSec,
          mode: snap.mode,
          goalBanner: snap.goalBanner,
          summary: snap.summary,
          teamFormations: { red: nextRedForm, blue: nextBlueForm },
          teamMeta: nextMeta,
          kickoffTeam: nextKickoffTeam,
          kickoffWaitingTouch: nextKickoffWaiting,
        };
      });
    },
    [addCoins, updateProfile]
  );

  // Persistent low-latency WebSocket client with auto-reconnect
  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(getServerWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setErrorMsg(null);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', t: performance.now() }));
          }
        }, 2500);
      };

      ws.onmessage = (ev) => {
        let msg: ServerWsMessage;
        try {
          msg = JSON.parse(ev.data as string) as ServerWsMessage;
        } catch {
          return;
        }

        if (msg.type === 'welcome') {
          clientIdRef.current = msg.clientId;
          setClientId(msg.clientId);
          if (pendingJoinCodeRef.current) {
            const code = pendingJoinCodeRef.current;
            pendingJoinCodeRef.current = null;
            ws.send(
              JSON.stringify({
                type: 'join_room',
                roomCode: code,
                playerName: (localStorage.getItem('sahaball_name') || 'Oyuncu').trim(),
                coins: coinsRef.current,
              })
            );
          }
        } else if (msg.type === 'pong') {
          setPingMs(Math.max(1, Math.round(performance.now() - msg.t)));
        } else if (msg.type === 'error') {
          setErrorMsg(msg.message);
        } else if (msg.type === 'room_state') {
          isClubCompetitionRef.current =
            msg.room.gameType === 'tournament' || msg.room.gameType === 'league';
          setRoomState(msg.room);
          setPlayType('online');
          setErrorMsg(null);
          if (msg.room.phase === 'lobby') {
            setScreen('lobby');
          } else if (msg.room.phase === 'finished') {
            setScreen((prev) => (prev === 'playing' ? 'playing' : 'lobby'));
          } else {
            setScreen('playing');
          }

          const cid = clientIdRef.current;
          const t = msg.room.tournament;
          if (!t || t.phase !== 'champion') {
            onlineChampionRewardedRef.current = false;
          } else if (
            t.phase === 'champion' &&
            t.championSlotIndex !== null &&
            !onlineChampionRewardedRef.current
          ) {
            const member = cid ? msg.room.members.find((m) => m.id === cid) : undefined;
            if (member && member.team !== 'spec') {
              const runnerUpSlot = getTournamentRunnerUpSlot(t);
              if (member.tournamentSlot === t.championSlotIndex) {
                onlineChampionRewardedRef.current = true;
                addCoins(150);
              } else if (runnerUpSlot !== null && member.tournamentSlot === runnerUpSlot) {
                onlineChampionRewardedRef.current = true;
                addCoins(75);
              }
            }
          }

          const lg = msg.room.league;
          if (!lg || lg.phase !== 'finished') {
            onlineLeagueRewardedRef.current = false;
          } else if (lg.phase === 'finished' && !onlineLeagueRewardedRef.current) {
            const member = cid ? msg.room.members.find((m) => m.id === cid) : undefined;
            if (member && member.team !== 'spec') {
              const rank = lg.standings.findIndex((r) => r.slotIndex === member.tournamentSlot) + 1;
              const bonus = rank === 1 ? 150 : rank === 2 ? 50 : rank === 3 ? 25 : 0;
              if (bonus > 0) {
                onlineLeagueRewardedRef.current = true;
                addCoins(bonus);
              }
            }
          }
        } else if (msg.type === 'chat_message') {
          setRoomState((prev) => {
            if (!prev) return prev;
            const nextChat = [...(prev.chatMessages ?? []), msg.message].slice(-50);
            return { ...prev, chatMessages: nextChat };
          });
        } else if (msg.type === 'match_entry_fee') {
          addCoins(-msg.amount);
        } else if (msg.type === 'kicked') {
          setRoomState(null);
          soloEngineRef.current = null;
          setPauseOpen(false);
          setAdContext(null);
          setScreen('menu');
          setErrorMsg(msg.reason);
        } else if (msg.type === 'snapshot') {
          snapshotRef.current = msg.snapshot;
          syncHudFromSnapshot(msg.snapshot, clientIdRef.current);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingInterval) clearInterval(pingInterval);
        if (!closed) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [syncHudFromSnapshot, addCoins]);

  // Ambient live pitch demo loop only when in online lobby (skip on low-end phones to save CPU/battery)
  useEffect(() => {
    const perf = getDevicePerfProfile();
    if (screen !== 'lobby' || perf.isLowEnd) {
      demoEngineRef.current = null;
      return;
    }

    const demoParticipants = MatchEngine.buildParticipantsWithBots('3v3', [], true);
    const engine = new MatchEngine('3v3', 300, demoParticipants);
    engine.phase = 'playing';
    demoEngineRef.current = engine;
    snapshotRef.current = engine.getSnapshot();

    const tickMs = 1000 / TICK_RATE;
    let last = performance.now();
    let acc = 0;

    const timer = setInterval(() => {
      const now = performance.now();
      acc += Math.min(80, now - last);
      last = now;
      let stepped = false;
      while (acc >= tickMs) {
        engine.step();
        if (engine.phase === 'finished') {
          engine.redScore = 0;
          engine.blueScore = 0;
          engine.timeLeftSec = 300;
          engine.phase = 'playing';
          engine.resetPositions();
        }
        acc -= tickMs;
        stepped = true;
      }
      if (stepped) {
        snapshotRef.current = engine.getSnapshot();
      }
    }, 33);

    return () => clearInterval(timer);
  }, [screen]);

  // rAF-lockstep physics simulation for Solo Match, Free Training, Tutorial & Daily Challenge
  useEffect(() => {
    const isSoloPlaying = screen === 'playing' && playType === 'solo';
    const isTraining = screen === 'training';
    const isTutorial = screen === 'tutorial';
    const isChallenge = screen === 'challenge';

    if (!isSoloPlaying && !isTraining && !isTutorial && !isChallenge) {
      onBeforeRenderRef.current = null;
      return;
    }

    const tickMs = 1000 / TICK_RATE;
    let last = performance.now();
    let acc = 0;
    let seq = 0;

    if (isSoloPlaying) {
      let activeEngine = soloEngineRef.current;
      onBeforeRenderRef.current = (now: number) => {
        const engine = soloEngineRef.current;
        if (!engine) return;
        if (engine !== activeEngine) {
          activeEngine = engine;
          last = now;
          acc = 0;
          seq = 0;
        }
        if (pauseOpen) {
          last = now;
          return;
        }
        acc += Math.min(64, Math.max(0, now - last));
        last = now;

        let stepped = false;
        while (acc >= tickMs) {
          seq++;
          engine.setPlayerInput(LOCAL_SOLO_ID, { ...inputRef.current, seq });
          engine.step();
          acc -= tickMs;
          stepped = true;
        }

        if (stepped) {
          const snap = engine.getSnapshot();
          snapshotRef.current = snap;
          syncHudFromSnapshot(snap, LOCAL_SOLO_ID);
        }
      };
    } else if (isTraining) {
      let lastGoals = -1;
      let lastShots = -1;
      let lastSaves = -1;
      let lastBannerVisible = false;

      onBeforeRenderRef.current = (now: number) => {
        const engine = trainingEngineRef.current;
        if (!engine) return;
        acc += Math.min(64, Math.max(0, now - last));
        last = now;

        let stepped = false;
        while (acc >= tickMs) {
          seq++;
          engine.setInput({ ...inputRef.current, seq });
          engine.step();
          acc -= tickMs;
          stepped = true;
        }

        if (stepped) {
          const snap = engine.getSnapshot();
          for (const ev of snap.events) {
            soundManager.play(ev);
          }
          snapshotRef.current = snap;
          staminaRef.current = engine.player.stamina;

          if (
            engine.stats.goals !== lastGoals ||
            engine.stats.shots !== lastShots ||
            engine.stats.saves !== lastSaves
          ) {
            lastGoals = engine.stats.goals;
            lastShots = engine.stats.shots;
            lastSaves = engine.stats.saves;
            setTrainingStats({ ...engine.stats });
          }

          const hasBanner = snap.goalBanner !== null;
          if (hasBanner !== lastBannerVisible) {
            lastBannerVisible = hasBanner;
            setTrainingGoalBanner(snap.goalBanner);
          }
        }
      };
    } else if (isTutorial) {
      let lastStepIdx = -1;
      let lastBanner: string | null = null;
      let lastCompleted = false;

      onBeforeRenderRef.current = (now: number) => {
        const engine = tutorialEngineRef.current;
        if (!engine) return;
        acc += Math.min(64, Math.max(0, now - last));
        last = now;

        let stepped = false;
        while (acc >= tickMs) {
          seq++;
          engine.setInput({ ...inputRef.current, seq });
          engine.step();
          acc -= tickMs;
          stepped = true;
        }

        if (stepped) {
          const snap = engine.getSnapshot();
          for (const ev of snap.events) {
            soundManager.play(ev);
          }
          snapshotRef.current = snap;
          staminaRef.current = engine.player.stamina;

          if (engine.stepIndex !== lastStepIdx) {
            lastStepIdx = engine.stepIndex;
            setTutorialStepMeta(engine.stepMeta);
          }
          if (engine.stepBannerText !== lastBanner) {
            lastBanner = engine.stepBannerText;
            setTutorialBannerText(engine.stepBannerText);
          }
          if (engine.completed && !lastCompleted) {
            lastCompleted = true;
            setTutorialDoneNow(true);
            if (!tutorialRewardClaimedRef.current) {
              tutorialRewardClaimedRef.current = true;
              setTutorialCompleted(true);
              setTutorialFirstReward(100);
              addCoins(100);
              try {
                localStorage.setItem('sahaball_tutorial_done', '1');
              } catch {
                // Ignore storage errors
              }
            } else {
              setTutorialFirstReward(0);
            }
          } else if (!engine.completed && lastCompleted) {
            lastCompleted = false;
          }
        }
      };
    } else {
      let lastStatus: ChallengeStatus | null = null;
      onBeforeRenderRef.current = (now: number) => {
        const engine = challengeEngineRef.current;
        if (!engine) return;
        if (adContext !== null) {
          last = now;
          return;
        }
        acc += Math.min(64, Math.max(0, now - last));
        last = now;

        let stepped = false;
        while (acc >= tickMs) {
          seq++;
          engine.setInput({ ...inputRef.current, seq });
          engine.step();
          acc -= tickMs;
          stepped = true;
        }

        if (stepped) {
          const snap = engine.getSnapshot();
          for (const ev of snap.events) {
            soundManager.play(ev);
          }
          snapshotRef.current = snap;
          staminaRef.current = engine.player.stamina;
          if (engine.status !== lastStatus) {
            lastStatus = engine.status;
            setChallengeStatus(engine.status);
          }

          if (engine.status === 'settled' && engine.result && !challengeSettledRef.current) {
            challengeSettledRef.current = true;
            setChallengeResult(engine.result);
            if (engine.result.rewardCoins > 0) {
              addCoins(engine.result.rewardCoins);
            }
          }
        }
      };
    }

    return () => {
      onBeforeRenderRef.current = null;
    };
  }, [screen, playType, pauseOpen, adContext, syncHudFromSnapshot, addCoins]);

  // Online match input sender (60Hz change-driven + lightweight heartbeat)
  useEffect(() => {
    if (screen !== 'playing' || playType !== 'online') return;

    let seq = 0;
    let lastSent = { dx: 0, dy: 0, kick: false, sprint: false };
    let idleCounter = 0;

    const timer = setInterval(() => {
      if (pauseOpen) return;
      const cur = inputRef.current;
      const changed =
        Math.abs(cur.dx - lastSent.dx) > 0.015 ||
        Math.abs(cur.dy - lastSent.dy) > 0.015 ||
        cur.kick !== lastSent.kick ||
        cur.sprint !== lastSent.sprint;

      idleCounter++;
      if (changed || idleCounter >= 3) {
        idleCounter = 0;
        seq++;
        lastSent = { dx: cur.dx, dy: cur.dy, kick: cur.kick, sprint: cur.sprint };
        sendWs({
          type: 'input',
          input: { seq, ...lastSent },
        });
      }
    }, 16);

    return () => clearInterval(timer);
  }, [screen, playType, pauseOpen, sendWs]);

  const persistSoloTournamentSave = useCallback(
    (
      nextTournament: TournamentStateInfo | null,
      mode: GameMode,
      size: PitchSize,
      dur: number,
      role: PlayerRole,
      bonusClaimed: boolean,
      ownColorId?: TeamColorId
    ) => {
      if (!nextTournament || nextTournament.phase === 'champion') {
        setSavedSoloTournament(null);
        try {
          localStorage.removeItem(SOLO_TOURNAMENT_STORAGE_KEY);
        } catch {
          // Ignore
        }
        return;
      }
      const payload: SavedSoloTournament = {
        tournament: nextTournament,
        mode,
        pitchSize: size,
        durationSec: dur,
        role,
        bonusClaimed,
        ownColorId,
      };
      setSavedSoloTournament(payload);
      try {
        localStorage.setItem(SOLO_TOURNAMENT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore
      }
    },
    []
  );

  const persistSoloLeagueSave = useCallback(
    (
      nextLeague: LeagueStateInfo | null,
      mode: GameMode,
      size: PitchSize,
      dur: number,
      role: PlayerRole,
      rewardClaimed: boolean,
      ownColorId?: TeamColorId
    ) => {
      if (!nextLeague || nextLeague.phase === 'finished') {
        setSavedSoloLeague(null);
        try {
          localStorage.removeItem(SOLO_LEAGUE_STORAGE_KEY);
        } catch {
          // Ignore
        }
        return;
      }
      const payload: SavedSoloLeague = {
        league: nextLeague,
        mode,
        pitchSize: size,
        durationSec: dur,
        role,
        rewardClaimed,
        ownColorId,
      };
      setSavedSoloLeague(payload);
      try {
        localStorage.setItem(SOLO_LEAGUE_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore
      }
    },
    []
  );

  const startSoloMatch = useCallback(
    (
      mode: GameMode,
      size: PitchSize,
      dur: number,
      team: ActiveTeam,
      role: PlayerRole,
      allowDraw = false,
      teamMetaOverride?: TeamMetaMap
    ) => {
      soundManager.unlock();
      enterLandscapeFullscreen();
      matchRewardedRef.current = false;
      setMatchAdDoubled(false);
      setLastMatchEarnedCoins(0);
      setAdContext(null);
      inputRef.current = { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
      const cleanName = playerName.trim() || 'Sen';
      const participants = MatchEngine.buildParticipantsWithBots(
        mode,
        [{ id: LOCAL_SOLO_ID, name: cleanName, team, role, isBot: false }],
        true,
        defaultBotDifficulty,
        {}
      );
      const effectiveMeta = teamMetaOverride ?? teamMeta;
      soloMatchTeamMetaRef.current = teamMetaOverride ?? null;
      const engine = new MatchEngine(mode, dur, participants, size, allowDraw, effectiveMeta);
      soloEngineRef.current = engine;
      const snap = engine.getSnapshot();
      snapshotRef.current = snap;
      syncHudFromSnapshot(snap, LOCAL_SOLO_ID);
      setPlayType('solo');
      setPauseOpen(false);
      setScreen('playing');
    },
    [playerName, defaultBotDifficulty, teamMeta, syncHudFromSnapshot, enterLandscapeFullscreen]
  );

  const startSoloTournament = useCallback(() => {
    soundManager.unlock();
    enterLandscapeFullscreen();
    const cleanName = playerName.trim() || 'Sen';
    const ownTeamName = teamMeta.red.name.trim() || `${cleanName} FK`;
    const bracket = createTournamentBracket(32, { 0: ownTeamName });
    const resolved = resolveBotOnlyMatches(bracket, (slot) => slot === 0);
    soloActiveMatchIdRef.current = null;
    soloActiveLeagueMatchIdRef.current = null;
    soloMatchTeamMetaRef.current = null;
    soloEngineRef.current = null;
    setSoloLeague(null);
    setSoloTournament(resolved);
    setSoloTournamentBonusClaimed(false);
    persistSoloTournamentSave(
      resolved,
      selectedMode,
      pitchSize,
      durationSec,
      'forvet',
      false,
      teamMeta.red.colorId
    );
    setPlayType('solo');
    setPauseOpen(false);
    setScreen('tournament');
  }, [
    playerName,
    teamMeta.red.name,
    teamMeta.red.colorId,
    selectedMode,
    pitchSize,
    durationSec,
    persistSoloTournamentSave,
    enterLandscapeFullscreen,
  ]);

  const resumeSoloTournament = useCallback(() => {
    if (!savedSoloTournament) return;
    soundManager.unlock();
    enterLandscapeFullscreen();
    setSelectedMode(savedSoloTournament.mode);
    setPitchSize(savedSoloTournament.pitchSize);
    setDurationSec(savedSoloTournament.durationSec);
    const savedOwnName = savedSoloTournament.tournament.teams[0]?.name;
    if (savedOwnName || savedSoloTournament.ownColorId) {
      setTeamMeta((prev) => ({
        ...prev,
        red: {
          name: savedOwnName || prev.red.name,
          colorId: savedSoloTournament.ownColorId ?? prev.red.colorId,
        },
      }));
    }
    soloActiveMatchIdRef.current = null;
    soloActiveLeagueMatchIdRef.current = null;
    soloMatchTeamMetaRef.current = null;
    soloEngineRef.current = null;
    setSoloLeague(null);
    setSoloTournament(savedSoloTournament.tournament);
    setSoloTournamentBonusClaimed(savedSoloTournament.bonusClaimed);
    setPlayType('solo');
    setPauseOpen(false);
    setScreen('tournament');
  }, [savedSoloTournament, enterLandscapeFullscreen]);

  const startSoloTournamentMatch = useCallback(() => {
    if (!soloTournament || !soloTournament.currentMatchId) return;
    const match = soloTournament.matches.find((m) => m.id === soloTournament.currentMatchId);
    if (!match || match.teamAIndex === null || match.teamBIndex === null) return;
    const matchTeam: ActiveTeam = match.teamAIndex === 0 ? 'red' : 'blue';
    const nameA =
      soloTournament.teams.find((t) => t.slotIndex === match.teamAIndex)?.name ??
      teamMeta.red.name;
    const nameB =
      soloTournament.teams.find((t) => t.slotIndex === match.teamBIndex)?.name ??
      teamMeta.blue.name;
    const matchTeamMeta = buildSoloCompetitionTeamMeta(
      match.teamAIndex,
      match.teamBIndex,
      nameA,
      nameB,
      teamMeta.red.colorId
    );
    soloActiveMatchIdRef.current = match.id;
    isClubCompetitionRef.current = true;
    setSoloActiveMatchTeam(matchTeam);
    startSoloMatch(selectedMode, pitchSize, durationSec, matchTeam, 'forvet', false, matchTeamMeta);
  }, [soloTournament, teamMeta, selectedMode, pitchSize, durationSec, startSoloMatch]);

  const handleFinishSoloTournamentMatch = useCallback(() => {
    if (!soloTournament || !soloActiveMatchIdRef.current || !hudState.summary) {
      setScreen('tournament');
      return;
    }
    const next = recordTournamentMatchResult(
      soloTournament,
      soloActiveMatchIdRef.current,
      hudState.summary.redScore,
      hudState.summary.blueScore,
      (slot) => slot === 0
    );
    soloActiveMatchIdRef.current = null;
    soloMatchTeamMetaRef.current = null;
    soloEngineRef.current = null;
    setSoloTournament(next);
    let claimed = soloTournamentBonusClaimed;
    if (next.phase === 'champion' && !claimed) {
      const runnerUpSlot = getTournamentRunnerUpSlot(next);
      if (next.championSlotIndex === 0) {
        addCoins(150);
      } else if (runnerUpSlot === 0) {
        addCoins(75);
      }
      claimed = true;
      setSoloTournamentBonusClaimed(true);
    }
    persistSoloTournamentSave(
      next,
      selectedMode,
      pitchSize,
      durationSec,
      'forvet',
      claimed,
      teamMeta.red.colorId
    );
    setScreen('tournament');
  }, [
    soloTournament,
    hudState.summary,
    soloTournamentBonusClaimed,
    selectedMode,
    pitchSize,
    durationSec,
    teamMeta.red.colorId,
    persistSoloTournamentSave,
    addCoins,
  ]);

  const startSoloLeague = useCallback(() => {
    soundManager.unlock();
    enterLandscapeFullscreen();
    const cleanName = playerName.trim() || 'Sen';
    const ownTeamName = teamMeta.red.name.trim() || `${cleanName} FK`;
    const season = createLeagueSeason({ 0: ownTeamName });
    const resolved = resolveLeagueBotMatches(season, (slot) => slot === 0);
    soloActiveMatchIdRef.current = null;
    soloActiveLeagueMatchIdRef.current = null;
    soloMatchTeamMetaRef.current = null;
    soloEngineRef.current = null;
    setSoloTournament(null);
    setSoloLeague(resolved);
    setSoloLeagueBonusClaimed(false);
    persistSoloLeagueSave(
      resolved,
      selectedMode,
      pitchSize,
      durationSec,
      'forvet',
      false,
      teamMeta.red.colorId
    );
    setPlayType('solo');
    setPauseOpen(false);
    setScreen('league');
  }, [
    playerName,
    teamMeta.red.name,
    teamMeta.red.colorId,
    selectedMode,
    pitchSize,
    durationSec,
    persistSoloLeagueSave,
    enterLandscapeFullscreen,
  ]);

  const resumeSoloLeague = useCallback(() => {
    if (!savedSoloLeague) return;
    soundManager.unlock();
    enterLandscapeFullscreen();
    setSelectedMode(savedSoloLeague.mode);
    setPitchSize(savedSoloLeague.pitchSize);
    setDurationSec(savedSoloLeague.durationSec);
    const savedOwnName = savedSoloLeague.league.teams[0];
    if (savedOwnName || savedSoloLeague.ownColorId) {
      setTeamMeta((prev) => ({
        ...prev,
        red: {
          name: savedOwnName || prev.red.name,
          colorId: savedSoloLeague.ownColorId ?? prev.red.colorId,
        },
      }));
    }
    soloActiveMatchIdRef.current = null;
    soloActiveLeagueMatchIdRef.current = null;
    soloMatchTeamMetaRef.current = null;
    soloEngineRef.current = null;
    setSoloTournament(null);
    setSoloLeague(savedSoloLeague.league);
    setSoloLeagueBonusClaimed(savedSoloLeague.rewardClaimed);
    setPlayType('solo');
    setPauseOpen(false);
    setScreen('league');
  }, [savedSoloLeague, enterLandscapeFullscreen]);

  const startSoloLeagueMatch = useCallback(() => {
    if (!soloLeague || !soloLeague.currentMatchId) return;
    const match = soloLeague.matches.find((m) => m.id === soloLeague.currentMatchId);
    if (!match) return;
    const matchTeam: ActiveTeam = match.teamAIndex === 0 ? 'red' : 'blue';
    const nameA = soloLeague.teams[match.teamAIndex] ?? teamMeta.red.name;
    const nameB = soloLeague.teams[match.teamBIndex] ?? teamMeta.blue.name;
    const matchTeamMeta = buildSoloCompetitionTeamMeta(
      match.teamAIndex,
      match.teamBIndex,
      nameA,
      nameB,
      teamMeta.red.colorId
    );
    soloActiveLeagueMatchIdRef.current = match.id;
    isClubCompetitionRef.current = true;
    setSoloActiveMatchTeam(matchTeam);
    startSoloMatch(selectedMode, pitchSize, durationSec, matchTeam, 'forvet', true, matchTeamMeta);
  }, [soloLeague, teamMeta, selectedMode, pitchSize, durationSec, startSoloMatch]);

  const handleFinishSoloLeagueMatch = useCallback(() => {
    if (!soloLeague || !soloActiveLeagueMatchIdRef.current || !hudState.summary) {
      setScreen('league');
      return;
    }
    const next = recordLeagueMatchResult(
      soloLeague,
      soloActiveLeagueMatchIdRef.current,
      hudState.summary.redScore,
      hudState.summary.blueScore,
      (slot) => slot === 0
    );
    soloActiveLeagueMatchIdRef.current = null;
    soloMatchTeamMetaRef.current = null;
    soloEngineRef.current = null;
    setSoloLeague(next);
    let claimed = soloLeagueBonusClaimed;
    if (next.phase === 'finished' && !claimed) {
      const rank = next.standings.findIndex((r) => r.slotIndex === 0) + 1;
      const bonus = rank === 1 ? 150 : rank === 2 ? 50 : rank === 3 ? 25 : 0;
      if (bonus > 0) {
        addCoins(bonus);
      }
      claimed = true;
      setSoloLeagueBonusClaimed(true);
    }
    persistSoloLeagueSave(
      next,
      selectedMode,
      pitchSize,
      durationSec,
      'forvet',
      claimed,
      teamMeta.red.colorId
    );
    setScreen('league');
  }, [
    soloLeague,
    hudState.summary,
    soloLeagueBonusClaimed,
    selectedMode,
    pitchSize,
    durationSec,
    teamMeta.red.colorId,
    persistSoloLeagueSave,
    addCoins,
  ]);

  const handleCreateRoom = () => {
    soundManager.unlock();
    enterLandscapeFullscreen();
    setErrorMsg(null);
    const maxPerTeam = MODE_CONFIGS[selectedMode].teamSize;
    const clampedRedBots = Math.max(0, Math.min(maxPerTeam, onlineRedBots));
    const clampedBlueBots = Math.max(0, Math.min(maxPerTeam, onlineBlueBots));
    sendWs({
      type: 'create_room',
      playerName: playerName.trim() || 'Kurucu',
      coins: coinsRef.current,
      mode: selectedMode,
      pitchSize,
      durationSec,
      fillBots:
        onlineGameType !== 'single' ? true : clampedRedBots > 0 || clampedBlueBots > 0,
      redBotCount: onlineGameType !== 'single' ? undefined : clampedRedBots,
      blueBotCount: onlineGameType !== 'single' ? undefined : clampedBlueBots,
      gameType: onlineGameType,
      tournamentSize: 32,
      defaultBotDifficulty,
      botDifficulties: {},
      teamMeta,
    });
  };

  const handleJoinRoom = (code: string) => {
    soundManager.unlock();
    enterLandscapeFullscreen();
    setErrorMsg(null);
    sendWs({
      type: 'join_room',
      roomCode: code,
      playerName: playerName.trim() || 'Oyuncu',
      coins: coinsRef.current,
    });
  };

  const handleSendEmoji = useCallback(
    (emoji: string) => {
      if (playType === 'solo') {
        soloEngineRef.current?.triggerEmoji(LOCAL_SOLO_ID, emoji);
      } else {
        sendWs({ type: 'send_emoji', emoji });
      }
    },
    [playType, sendWs]
  );

  const handleSelectTactic = useCallback(
    (team: ActiveTeam, preset: FormationPreset) => {
      setHudState((prev) =>
        prev.teamFormations[team] === preset
          ? prev
          : { ...prev, teamFormations: { ...prev.teamFormations, [team]: preset } }
      );
      if (playType === 'solo') {
        const eng = soloEngineRef.current;
        if (eng) {
          eng.setTeamFormation(team, preset, undefined, false);
          snapshotRef.current = eng.getSnapshot();
        }
      } else {
        sendWs({ type: 'set_tactic', preset });
      }
    },
    [playType, sendWs]
  );

  const handleLeaveToMenu = () => {
    if (playType === 'online') {
      sendWs({ type: 'leave_room' });
      setRoomState(null);
    }
    soloEngineRef.current = null;
    soloActiveMatchIdRef.current = null;
    soloActiveLeagueMatchIdRef.current = null;
    setSoloTournament(null);
    setSoloLeague(null);
    setPauseOpen(false);
    setScreen('menu');
    // Clean ?room param from URL if present
    if (window.location.search.includes('room=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleRematch = () => {
    if (playType === 'solo') {
      const isLeagueMatch = Boolean(soloLeague);
      startSoloMatch(
        selectedMode,
        pitchSize,
        durationSec,
        soloTournament || soloLeague ? soloActiveMatchTeam : soloTeam,
        'forvet',
        isLeagueMatch,
        soloMatchTeamMetaRef.current ?? undefined
      );
    } else {
      sendWs({ type: 'rematch' });
    }
  };

  const persistChallengeQuota = useCallback((next: DailyChallengeQuota) => {
    setChallengeQuota(next);
    try {
      localStorage.setItem('sahaball_challenge_daily', JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const launchChallengeAttempt = useCallback(() => {
    soundManager.unlock();
    const cleanName = playerName.trim() || 'Oyuncu';
    let engine = challengeEngineRef.current;
    if (!engine) {
      engine = new ChallengeEngine(cleanName);
      challengeEngineRef.current = engine;
    } else {
      engine.resetAttempt(cleanName);
    }
    challengeSettledRef.current = false;
    staminaRef.current = 100;
    inputRef.current = { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
    setChallengeStatus('dribbling');
    setChallengeResult(null);
    snapshotRef.current = engine.getSnapshot();
    setScreen('challenge');
  }, [playerName]);

  const handleStartChallenge = useCallback(() => {
    const today = getTodayKey();
    const quota =
      challengeQuota.date === today
        ? challengeQuota
        : { date: today, freeUsed: false, adRetriesUsed: 0 };

    if (!quota.freeUsed) {
      persistChallengeQuota({ ...quota, freeUsed: true });
      launchChallengeAttempt();
      return;
    }

    if (quota.adRetriesUsed < MAX_CHALLENGE_AD_RETRIES) {
      setAdContext({ type: 'challenge_retry' });
      return;
    }

    setChallengeLimitOpen(true);
  }, [challengeQuota, persistChallengeQuota, launchChallengeAttempt]);

  const handleLeaveChallenge = () => {
    challengeEngineRef.current = null;
    setChallengeResult(null);
    setScreen('menu');
  };

  // Free Training Mode handlers
  const startTraining = useCallback(() => {
    soundManager.unlock();
    enterLandscapeFullscreen();
    inputRef.current = { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
    staminaRef.current = 100;
    const engine = new TrainingEngine(
      playerName.trim() || 'Oyuncu',
      trainingPitchSize,
      trainingGkMode,
      trainingGkCount,
      trainingGkDiff
    );
    trainingEngineRef.current = engine;
    snapshotRef.current = engine.getSnapshot();
    setTrainingStats({ goals: 0, shots: 0, saves: 0 });
    setTrainingGoalBanner(null);
    setPauseOpen(false);
    setScreen('training');
  }, [
    playerName,
    trainingPitchSize,
    trainingGkMode,
    trainingGkCount,
    trainingGkDiff,
    enterLandscapeFullscreen,
  ]);

  const handleLeaveTraining = useCallback(() => {
    trainingEngineRef.current = null;
    setTrainingGoalBanner(null);
    setScreen('menu');
  }, []);

  const handleChangeTrainingKeeper = useCallback(
    (mode: TrainingKeeperMode, count: 1 | 2, diff: BotDifficulty) => {
      setTrainingGkMode(mode);
      setTrainingGkCount(count);
      setTrainingGkDiff(diff);
      const eng = trainingEngineRef.current;
      if (eng) {
        eng.setKeeperConfig(mode, count, diff);
        snapshotRef.current = eng.getSnapshot();
      }
    },
    []
  );

  const handleChangeTrainingPitch = useCallback((size: PitchSize) => {
    setTrainingPitchSize(size);
    const eng = trainingEngineRef.current;
    if (eng) {
      eng.setPitchSize(size);
      snapshotRef.current = eng.getSnapshot();
    }
  }, []);

  const handleBringTrainingBall = useCallback(() => {
    const eng = trainingEngineRef.current;
    if (eng) {
      eng.resetBallToPlayer();
      snapshotRef.current = eng.getSnapshot();
      setTrainingGoalBanner(null);
    }
  }, []);

  const handleResetTraining = useCallback(() => {
    const eng = trainingEngineRef.current;
    if (eng) {
      eng.resetSession(true);
      snapshotRef.current = eng.getSnapshot();
      setTrainingStats({ goals: 0, shots: 0, saves: 0 });
      setTrainingGoalBanner(null);
    }
  }, []);

  const handleChangeControlsLayout = useCallback((next: ControlsLayoutConfig) => {
    setControlsLayout(next);
    saveControlsLayout(next);
  }, []);

  // Interactive Tutorial Mode handlers
  const startTutorial = useCallback(() => {
    soundManager.unlock();
    enterLandscapeFullscreen();
    inputRef.current = { seq: 0, dx: 0, dy: 0, kick: false, sprint: false };
    staminaRef.current = 100;
    const engine = new TutorialEngine(playerName.trim() || 'Oyuncu');
    tutorialEngineRef.current = engine;
    snapshotRef.current = engine.getSnapshot();
    setTutorialStepMeta(engine.stepMeta);
    setTutorialDoneNow(false);
    setTutorialFirstReward(0);
    setTutorialBannerText(null);
    setPauseOpen(false);
    setScreen('tutorial');
  }, [playerName, enterLandscapeFullscreen]);

  const handleLeaveTutorial = useCallback(() => {
    tutorialEngineRef.current = null;
    setTutorialBannerText(null);
    setTutorialDoneNow(false);
    setScreen('menu');
  }, []);

  const handleBringTutorialBall = useCallback(() => {
    const eng = tutorialEngineRef.current;
    if (eng) {
      eng.resetBallToPlayer();
      snapshotRef.current = eng.getSnapshot();
    }
  }, []);

  const handleSkipTutorialStep = useCallback(() => {
    const eng = tutorialEngineRef.current;
    if (!eng) return;
    eng.nextStep();
    snapshotRef.current = eng.getSnapshot();
    setTutorialStepMeta(eng.stepMeta);
    setTutorialBannerText(null);
    if (eng.completed) {
      setTutorialDoneNow(true);
      if (!tutorialRewardClaimedRef.current) {
        tutorialRewardClaimedRef.current = true;
        setTutorialCompleted(true);
        setTutorialFirstReward(100);
        addCoins(100);
        try {
          localStorage.setItem('sahaball_tutorial_done', '1');
        } catch {
          // Ignore storage errors
        }
      } else {
        setTutorialFirstReward(0);
      }
    }
  }, [addCoins]);

  const handleRestartTutorial = useCallback(() => {
    const eng = tutorialEngineRef.current;
    if (!eng) return;
    eng.restartAll();
    snapshotRef.current = eng.getSnapshot();
    setTutorialStepMeta(eng.stepMeta);
    setTutorialDoneNow(false);
    setTutorialFirstReward(0);
    setTutorialBannerText(null);
  }, []);

  const handleBuyItem = (item: ShopItem) => {
    if (ownedIds.includes(item.id) || coins < item.price) return;
    addCoins(-item.price);
    const nextOwned = [...ownedIds, item.id];
    setOwnedIds(nextOwned);
    const nextEquipped = { ...equippedSkins, [item.category]: item.skinId };
    setEquippedSkins(nextEquipped);
    try {
      localStorage.setItem('sahaball_owned', JSON.stringify(nextOwned));
      localStorage.setItem('sahaball_skins', JSON.stringify(nextEquipped));
    } catch {
      // Ignore storage errors
    }
  };

  const handleEquipSkin = (category: ShopCategory, skinId: string) => {
    const nextEquipped = { ...equippedSkins, [category]: skinId } as EquippedSkins;
    setEquippedSkins(nextEquipped);
    try {
      localStorage.setItem('sahaball_skins', JSON.stringify(nextEquipped));
    } catch {
      // Ignore storage errors
    }
  };

  const handleClaimDailyReward = () => {
    const today = getTodayKey();
    if (lastDailyRewardDate === today) return;
    addCoins(DAILY_REWARD_AMOUNT);
    setLastDailyRewardDate(today);
    try {
      localStorage.setItem('sahaball_daily_reward', today);
    } catch {
      // Ignore storage errors
    }
  };

  const handleAdComplete = () => {
    const ctx = adContext;
    setAdContext(null);
    if (!ctx) return;

    if (ctx.type === 'match_double') {
      if (!matchAdDoubled && lastMatchEarnedCoins > 0) {
        addCoins(lastMatchEarnedCoins);
        setMatchAdDoubled(true);
      }
    } else if (ctx.type === 'online_post_match') {
      if (!matchAdDoubled) {
        addCoins(25);
        setMatchAdDoubled(true);
      }
    } else if (ctx.type === 'daily_extra') {
      addCoins(10);
    } else if (ctx.type === 'lobby_ad') {
      addCoins(10);
      sendWs({ type: 'set_watching_ad', watching: false });
    } else if (ctx.type === 'challenge_retry') {
      const today = getTodayKey();
      const base =
        challengeQuota.date === today
          ? challengeQuota
          : { date: today, freeUsed: true, adRetriesUsed: 0 };
      if (base.adRetriesUsed < MAX_CHALLENGE_AD_RETRIES) {
        persistChallengeQuota({
          date: today,
          freeUsed: true,
          adRetriesUsed: base.adRetriesUsed + 1,
        });
        launchChallengeAttempt();
      }
    }
  };

  const todayKey = getTodayKey(nowTick);
  const dailyRewardAvailable = lastDailyRewardDate !== todayKey;
  const currentQuota =
    challengeQuota.date === todayKey
      ? challengeQuota
      : { date: todayKey, freeUsed: false, adRetriesUsed: 0 };
  const challengeAdRetriesLeft = Math.max(0, MAX_CHALLENGE_AD_RETRIES - currentQuota.adRetriesUsed);
  const challengeCountdownText = formatCountdownToMidnight(nowTick);
  const challengeExhausted = currentQuota.freeUsed && challengeAdRetriesLeft === 0;
  const challengeTriesLabel = !currentQuota.freeUsed
    ? '1 Hak'
    : challengeAdRetriesLeft > 0
      ? `Reklam +${challengeAdRetriesLeft}`
      : challengeCountdownText;

  useEffect(() => {
    if (!challengeExhausted || (screen !== 'menu' && !challengeLimitOpen)) return;
    setNowTick(Date.now());
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [challengeExhausted, screen, challengeLimitOpen]);

  const localActiveId = playType === 'solo' ? LOCAL_SOLO_ID : clientId;
  const localRoomMember = playType === 'online' ? roomState?.members.find((m) => m.id === clientId) : undefined;
  const localMemberTeam: Team | undefined = (() => {
    if (playType === 'solo') {
      return soloTournament || soloLeague ? soloActiveMatchTeam : soloTeam;
    }
    if (!localRoomMember || localRoomMember.team === 'spec') return localRoomMember?.team;
    if (roomState?.gameType === 'tournament' && roomState.tournament) {
      const t = roomState.tournament;
      const activeMatch = t.currentMatchId
        ? t.matches.find((m) => m.id === t.currentMatchId)
        : null;
      if (activeMatch && t.phase === 'playing') {
        if (localRoomMember.tournamentSlot === activeMatch.teamAIndex) return 'red';
        if (localRoomMember.tournamentSlot === activeMatch.teamBIndex) return 'blue';
        return 'spec';
      }
    }
    if (roomState?.gameType === 'league' && roomState.league) {
      const lg = roomState.league;
      const activeMatch = lg.currentMatchId
        ? lg.matches.find((m) => m.id === lg.currentMatchId)
        : null;
      if (activeMatch && lg.phase === 'playing') {
        if (localRoomMember.tournamentSlot === activeMatch.teamAIndex) return 'red';
        if (localRoomMember.tournamentSlot === activeMatch.teamBIndex) return 'blue';
        return 'spec';
      }
    }
    return localRoomMember.team;
  })();
  const showControls =
    screen === 'playing' &&
    hudState.phase !== 'finished' &&
    !pauseOpen &&
    localMemberTeam !== 'spec';

  const isHostOnline = playType === 'online' && roomState?.hostId === clientId;

  const isTournamentMatchActive =
    playType === 'solo'
      ? Boolean(soloTournament)
      : Boolean(roomState?.gameType === 'tournament' && roomState?.tournament);

  const isLeagueMatchActive =
    playType === 'solo'
      ? Boolean(soloLeague)
      : Boolean(roomState?.gameType === 'league' && roomState?.league);

  const isClubCompetitionMatchActive = isTournamentMatchActive || isLeagueMatchActive;

  const isFinalTournamentMatch = (() => {
    if (!isTournamentMatchActive) return false;
    if (playType === 'online') {
      return roomState?.tournament?.phase === 'champion';
    }
    if (!soloTournament || !soloActiveMatchIdRef.current) return false;
    const m = soloTournament.matches.find((x) => x.id === soloActiveMatchIdRef.current);
    const finalRound = Math.round(Math.log2(soloTournament.size)) - 1;
    return m ? m.roundIndex === finalRound : false;
  })();

  const isFinalLeagueMatch = (() => {
    if (!isLeagueMatchActive) return false;
    if (playType === 'online') {
      return roomState?.league?.phase === 'finished';
    }
    if (!soloLeague || !soloActiveLeagueMatchIdRef.current) return false;
    const lastPending = soloLeague.matches.filter(
      (m) => m.status !== 'finished' && (m.teamAIndex === 0 || m.teamBIndex === 0)
    );
    return lastPending.length <= 1;
  })();

  const savedTournamentResumeLabel = savedSoloTournament
    ? (() => {
        const cur = savedSoloTournament.tournament.currentMatchId
          ? savedSoloTournament.tournament.matches.find(
              (m) => m.id === savedSoloTournament.tournament.currentMatchId
            )
          : null;
        return cur ? `${cur.roundLabel} · ${savedSoloTournament.mode}` : savedSoloTournament.mode;
      })()
    : null;

  const savedLeagueResumeLabel = savedSoloLeague
    ? `Hafta ${savedSoloLeague.league.currentWeekIndex + 1}/${savedSoloLeague.league.size - 1} · ${savedSoloLeague.mode}`
    : null;

  return (
    <main className="fixed inset-0 w-full h-full overflow-hidden bg-[#114224] select-none touch-none">
      {/* Fullscreen Pitch Canvas (Always visible!) */}
      <PitchCanvas
        snapshotRef={snapshotRef}
        localPlayerId={
          screen === 'playing'
            ? localActiveId
            : screen === 'training'
              ? 'training_player'
              : screen === 'tutorial'
                ? 'tutorial_player'
                : screen === 'challenge'
                  ? 'challenge_player'
                  : null
        }
        skins={equippedSkins}
        challengeMode={screen === 'challenge'}
        paused={
          screen === 'menu' ||
          screen === 'tournament' ||
          screen === 'league' ||
          profileOpen ||
          settingsOpen ||
          shopOpen ||
          dailyRewardOpen
        }
        onBeforeRenderRef={onBeforeRenderRef}
      />

      {/* Main Menu Overlay */}
      {screen === 'menu' && (
        <MainMenuOverlay
          playerName={playerName}
          coins={coins}
          dailyRewardAvailable={dailyRewardAvailable}
          challengeTriesLabel={challengeTriesLabel}
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          pitchSize={pitchSize}
          onSelectPitchSize={setPitchSize}
          durationSec={durationSec}
          onSelectDuration={setDurationSec}
          teamMeta={teamMeta}
          onChangeTeamMeta={setTeamMeta}
          soloTeam={soloTeam}
          onSelectSoloTeam={setSoloTeam}
          soloGameType={soloGameType}
          onChangeSoloGameType={setSoloGameType}
          onlineGameType={onlineGameType}
          onChangeOnlineGameType={setOnlineGameType}
          defaultBotDifficulty={defaultBotDifficulty}
          onChangeDefaultBotDifficulty={setDefaultBotDifficulty}
          fillBotsOnline={fillBotsOnline}
          onToggleFillBotsOnline={setFillBotsOnline}
          onlineRedBots={onlineRedBots}
          onlineBlueBots={onlineBlueBots}
          onChangeOnlineRedBots={setOnlineRedBots}
          onChangeOnlineBlueBots={setOnlineBlueBots}
          savedTournamentResumeLabel={savedTournamentResumeLabel}
          savedLeagueResumeLabel={savedLeagueResumeLabel}
          wsConnected={wsConnected}
          errorMsg={errorMsg}
          onEnterLandscapeFullscreen={enterLandscapeFullscreen}
          onOpenProfile={() => setProfileOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenDailyReward={() => setDailyRewardOpen(true)}
          onOpenShop={() => setShopOpen(true)}
          onStartTraining={startTraining}
          onStartTutorial={startTutorial}
          tutorialCompleted={tutorialCompleted}
          onStartChallenge={handleStartChallenge}
          onStartSolo={() => {
            setSoloTournament(null);
            setSoloLeague(null);
            isClubCompetitionRef.current = false;
            soloActiveMatchIdRef.current = null;
            soloActiveLeagueMatchIdRef.current = null;
            startSoloMatch(selectedMode, pitchSize, durationSec, soloTeam, 'forvet', false);
          }}
          onStartSoloTournament={startSoloTournament}
          onResumeSoloTournament={resumeSoloTournament}
          onStartSoloLeague={startSoloLeague}
          onResumeSoloLeague={resumeSoloLeague}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {/* Solo Tournament Bracket Overlay */}
      {screen === 'tournament' && soloTournament && (
        <TournamentBracketOverlay
          tournament={soloTournament}
          isSolo={true}
          isHost={true}
          localSlotIndex={0}
          championBonusCoins={150}
          runnerUpBonusCoins={75}
          onStartNextMatch={startSoloTournamentMatch}
          onRestartSoloTournament={startSoloTournament}
          onLeaveToMenu={handleLeaveToMenu}
        />
      )}

      {/* Solo League Overlay */}
      {screen === 'league' && soloLeague && (
        <LeagueOverlay
          league={soloLeague}
          isSolo={true}
          isHost={true}
          localSlotIndex={0}
          onStartNextMatch={startSoloLeagueMatch}
          onRestartSoloLeague={startSoloLeague}
          onLeaveToMenu={handleLeaveToMenu}
        />
      )}

      {/* Online Lobby, Tournament Bracket, or League Table Overlay */}
      {screen === 'lobby' && roomState && clientId && (
        roomState.gameType === 'tournament' && roomState.tournament ? (
          <TournamentBracketOverlay
            tournament={roomState.tournament}
            isSolo={false}
            isHost={isHostOnline}
            localSlotIndex={
              localRoomMember && localRoomMember.team !== 'spec'
                ? localRoomMember.tournamentSlot
                : null
            }
            members={roomState.members}
            championBonusCoins={150}
            runnerUpBonusCoins={75}
            onStartNextMatch={() => sendWs({ type: 'start_next_tournament_match' })}
            onBackToLobby={
              isHostOnline ? () => sendWs({ type: 'reset_tournament' }) : undefined
            }
            onLeaveToMenu={handleLeaveToMenu}
          />
        ) : roomState.gameType === 'league' && roomState.league ? (
          <LeagueOverlay
            league={roomState.league}
            isSolo={false}
            isHost={isHostOnline}
            localSlotIndex={
              localRoomMember && localRoomMember.team !== 'spec'
                ? localRoomMember.tournamentSlot
                : null
            }
            members={roomState.members}
            onStartNextMatch={() => sendWs({ type: 'start_next_league_match' })}
            onBackToLobby={
              isHostOnline ? () => sendWs({ type: 'reset_league' }) : undefined
            }
            onLeaveToMenu={handleLeaveToMenu}
          />
        ) : (
          <LobbyOverlay
            room={roomState}
            localClientId={clientId}
            coins={coins}
            onSwitchTeam={(t) => sendWs({ type: 'switch_team', team: t })}
            onSwitchTournamentSlot={(slotIndex) =>
              sendWs({ type: 'switch_tournament_slot', slotIndex })
            }
            onChangeRole={(r) => sendWs({ type: 'set_role', role: r })}
            onToggleReady={(ready) => sendWs({ type: 'set_ready', ready })}
            onWatchLobbyAd={() => {
              sendWs({ type: 'set_watching_ad', watching: true });
              setAdContext({ type: 'lobby_ad' });
            }}
            onKickMember={(targetId) => sendWs({ type: 'kick_member', targetId })}
            onSendChat={(text) => sendWs({ type: 'chat_message', text })}
            onUpdateSettings={(m, s, d, b, defDiff, diffMap, gType, tSize, redBots, blueBots, tMeta) =>
              sendWs({
                type: 'update_settings',
                mode: m,
                pitchSize: s,
                durationSec: d,
                fillBots: b,
                redBotCount: redBots,
                blueBotCount: blueBots,
                defaultBotDifficulty: defDiff,
                botDifficulties: diffMap,
                gameType: gType,
                tournamentSize: tSize,
                teamMeta: tMeta,
              })
            }
            onStartMatch={() => sendWs({ type: 'start_match' })}
            onLeaveRoom={handleLeaveToMenu}
          />
        )
      )}

      {/* Active In-Game HUD & Touch Controls (all directly over pitch!) */}
      {screen === 'playing' && (
        <>
          <ScoreboardHUD
            redScore={hudState.redScore}
            blueScore={hudState.blueScore}
            timeLeftSec={hudState.timeLeftSec}
            phase={hudState.phase}
            mode={hudState.mode}
            teamMeta={hudState.teamMeta}
            isMuted={isMuted}
            roomCode={playType === 'online' ? roomState?.roomCode : null}
            pingMs={playType === 'online' ? pingMs : null}
            canSendEmoji={localMemberTeam !== 'spec'}
            activeTactic={
              localMemberTeam === 'red' || localMemberTeam === 'blue'
                ? hudState.teamFormations[localMemberTeam]
                : null
            }
            onSelectTactic={
              localMemberTeam === 'red' || localMemberTeam === 'blue'
                ? (preset) => handleSelectTactic(localMemberTeam, preset)
                : undefined
            }
            onSendEmoji={handleSendEmoji}
            onToggleMute={toggleMute}
            onOpenMenu={() => setPauseOpen(true)}
          />

          {/* Kickoff Countdown Banner (positioned below scoreboard so the center circle remains fully visible) */}
          {hudState.phase === 'countdown' && (() => {
            const koMeta = hudState.teamMeta[hudState.kickoffTeam];
            const koTheme = TEAM_COLOR_PALETTE[koMeta.colorId];
            return (
              <div className="fixed inset-x-0 top-13 sm:top-15 z-25 pointer-events-none flex justify-center px-3">
                <div
                  className="px-4 py-1.5 rounded-2xl bg-slate-950/90 border shadow-xl flex items-center gap-3"
                  style={{ borderColor: koTheme.hex }}
                >
                  <span className="font-display font-extrabold text-xl sm:text-2xl text-white tabular-nums leading-none">
                    {Math.max(1, Math.ceil(hudState.phaseTimerSec))}
                  </span>
                  <div className="flex flex-col leading-tight text-left">
                    <span className="text-[11px] font-bold text-emerald-300">Santra Hazırlığı</span>
                    <span className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: koTheme.hex }}
                      />
                      <span>Santra: {koMeta.name}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {(hudState.phase === 'playing' || hudState.phase === 'overtime') &&
            hudState.kickoffWaitingTouch &&
            (() => {
              const koMeta = hudState.teamMeta[hudState.kickoffTeam];
              const koTheme = TEAM_COLOR_PALETTE[koMeta.colorId];
              return (
                <div className="fixed inset-x-0 top-13 sm:top-15 z-25 pointer-events-none flex justify-center px-3">
                  <div
                    className="px-3 py-1 rounded-xl bg-slate-950/85 border shadow-lg flex items-center gap-2 text-[11px] font-semibold text-white"
                    style={{ borderColor: koTheme.hex }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: koTheme.hex }}
                    />
                    <span>Santra vuruşu: {koMeta.name}</span>
                  </div>
                </div>
              );
            })()}

          {/* Goal Scored Celebration Banner */}
          {hudState.phase === 'goal' && hudState.goalBanner && (() => {
            const activeMeta = hudState.teamMeta ?? DEFAULT_TEAM_META;
            const scoringTheme =
              TEAM_COLOR_PALETTE[activeMeta[hudState.goalBanner.scoringTeam].colorId];
            return (
              <div className="fixed inset-x-0 top-16 z-25 pointer-events-none flex justify-center px-4">
                <div
                  className="px-6 py-3 rounded-2xl border shadow-2xl text-center bg-slate-950/92"
                  style={{
                    borderColor: scoringTheme.hex,
                    boxShadow: `0 12px 32px -8px ${scoringTheme.hex}66`,
                  }}
                >
                  <div className="font-display font-extrabold text-2xl sm:text-3xl tracking-wide text-white">
                    GOL!
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-white/95 mt-0.5">
                    {hudState.goalBanner.scorerName}
                    {hudState.goalBanner.assistName ? ` · Asist: ${hudState.goalBanner.assistName}` : ''}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Spectator Notice for Online Tournament / League Bystanders */}
          {playType === 'online' &&
            (roomState?.gameType === 'tournament' || roomState?.gameType === 'league') &&
            localMemberTeam === 'spec' &&
            hudState.phase !== 'finished' && (
              <div className="fixed inset-x-0 top-14 z-25 pointer-events-none flex justify-center px-3">
                <div className="px-3.5 py-1 rounded-full bg-slate-950/80 border border-amber-400/35 text-amber-200 text-[11px] font-semibold shadow-md">
                  İzleyici Modu · {roomState?.gameType === 'league' ? 'Lig' : 'Turnuva'} karşılaşması canlı izleniyor
                </div>
              </div>
            )}

          {/* Virtual Analog Joystick + Şut & Sprint Buttons (User Customizable Layout) */}
          {showControls && (
            <TouchControls
              inputRef={inputRef}
              staminaRef={staminaRef}
              layout={controlsLayout}
              disabled={false}
            />
          )}

          {/* In-Match Pause / Solo Formation Editor Overlay */}
          <SoloPauseModal
            open={pauseOpen && hudState.phase !== 'finished'}
            isSolo={playType === 'solo'}
            team={soloTournament || soloLeague ? soloActiveMatchTeam : soloTeam}
            teamMeta={hudState.teamMeta}
            players={pauseOpen ? (soloEngineRef.current?.players ?? EMPTY_PLAYERS) : EMPTY_PLAYERS}
            initialPreset={
              pauseOpen
                ? (soloEngineRef.current?.teamFormations[
                    soloTournament || soloLeague ? soloActiveMatchTeam : soloTeam
                  ] ?? 'dengeli')
                : 'dengeli'
            }
            initialSpots={
              pauseOpen
                ? (soloEngineRef.current?.getTeamFormationSpots(
                    soloTournament || soloLeague ? soloActiveMatchTeam : soloTeam
                  ) ?? [])
                : []
            }
            onResume={() => setPauseOpen(false)}
            onResetSolo={() =>
              startSoloMatch(
                selectedMode,
                pitchSize,
                durationSec,
                soloTournament || soloLeague ? soloActiveMatchTeam : soloTeam,
                'forvet',
                Boolean(soloLeague),
                soloMatchTeamMetaRef.current ?? undefined
              )
            }
            onLeaveToMenu={handleLeaveToMenu}
            onApplyFormation={(preset, spots, repositionNow) => {
              const eng = soloEngineRef.current;
              const activeSoloTeam = soloTournament || soloLeague ? soloActiveMatchTeam : soloTeam;
              if (!eng) return;
              eng.setTeamFormation(activeSoloTeam, preset, spots, repositionNow);
              if (repositionNow) {
                const snap = eng.getSnapshot();
                snapshotRef.current = snap;
                syncHudFromSnapshot(snap, LOCAL_SOLO_ID);
              }
            }}
          />

          {/* Post-Match Detailed Scoreboard & Quick Rematch / Tournament or League Advance Overlay */}
          {hudState.phase === 'finished' && hudState.summary && (
            <MatchEndOverlay
              summary={hudState.summary}
              teamMeta={hudState.teamMeta}
              isOnline={playType === 'online'}
              localPlayerId={playType === 'solo' ? LOCAL_SOLO_ID : clientId}
              canRematch={playType === 'solo' || isHostOnline}
              earnedCoins={lastMatchEarnedCoins}
              adDoubled={matchAdDoubled}
              onWatchAdDouble={() =>
                setAdContext({ type: playType === 'online' ? 'online_post_match' : 'match_double' })
              }
              onRematch={handleRematch}
              onMainMenu={handleLeaveToMenu}
              onBackToLobby={playType === 'online' ? () => setScreen('lobby') : undefined}
              tournamentMode={isClubCompetitionMatchActive}
              tournamentContinueLabel={
                isLeagueMatchActive
                  ? isFinalLeagueMatch
                    ? 'Sezon Sonunu Gör'
                    : 'Puan Durumuna Geç'
                  : isFinalTournamentMatch
                    ? 'Şampiyonu Gör'
                    : 'Turnuva Ağacına Geç'
              }
              onTournamentContinue={
                playType === 'solo'
                  ? isLeagueMatchActive
                    ? handleFinishSoloLeagueMatch
                    : handleFinishSoloTournamentMatch
                  : isLeagueMatchActive
                    ? () => sendWs({ type: 'advance_league' })
                    : () => sendWs({ type: 'advance_tournament' })
              }
            />
          )}
        </>
      )}

      {/* Free Training Mode HUD & Touch Controls */}
      {screen === 'training' && (
        <>
          <TrainingHUD
            stats={trainingStats}
            gkMode={trainingGkMode}
            gkCount={trainingGkCount}
            gkDifficulty={trainingGkDiff}
            pitchSize={trainingPitchSize}
            isMuted={isMuted}
            onChangeKeeperConfig={handleChangeTrainingKeeper}
            onChangePitchSize={handleChangeTrainingPitch}
            onBringBall={handleBringTrainingBall}
            onResetAll={handleResetTraining}
            onToggleMute={toggleMute}
            onLeave={handleLeaveTraining}
          />

          {trainingGoalBanner && (
            <div className="fixed inset-x-0 top-16 z-25 pointer-events-none flex justify-center px-4">
              <div className="px-5 py-2 rounded-2xl bg-emerald-950/92 border border-emerald-400/50 shadow-2xl text-center">
                <div className="font-display font-extrabold text-xl sm:text-2xl tracking-wide text-white">
                  GOL!
                </div>
              </div>
            </div>
          )}

          <TouchControls
            inputRef={inputRef}
            staminaRef={staminaRef}
            layout={controlsLayout}
            disabled={false}
          />
        </>
      )}

      {/* Interactive Tutorial Mode HUD & Touch Controls */}
      {screen === 'tutorial' && (
        <>
          <TutorialHUD
            stepMeta={tutorialStepMeta}
            completed={tutorialDoneNow}
            firstTimeRewardCoins={tutorialFirstReward}
            bannerText={tutorialBannerText}
            isMuted={isMuted}
            onBringBall={handleBringTutorialBall}
            onSkipStep={handleSkipTutorialStep}
            onRestart={handleRestartTutorial}
            onGoTraining={() => {
              tutorialEngineRef.current = null;
              setTutorialDoneNow(false);
              setTutorialBannerText(null);
              startTraining();
            }}
            onToggleMute={toggleMute}
            onLeave={handleLeaveTutorial}
          />

          {!tutorialDoneNow && (
            <TouchControls
              inputRef={inputRef}
              staminaRef={staminaRef}
              layout={controlsLayout}
              disabled={false}
            />
          )}
        </>
      )}

      {/* Daily Challenge HUD, Controls & Result Overlay */}
      {screen === 'challenge' && (
        <>
          <div className="fixed inset-x-0 top-0 pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] sm:top-2 sm:inset-x-4 z-30 flex flex-col gap-1.5 pointer-events-none">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleLeaveChallenge}
                className="pointer-events-auto min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-slate-950/88 hover:bg-slate-950 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ana Menü</span>
              </button>

              <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
                  className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-950/88 hover:bg-slate-950 border border-white/20 text-white flex items-center justify-center"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="self-center w-full max-w-xl px-3.5 py-1.5 rounded-xl bg-slate-950/88 border border-amber-400/35 text-white text-[11px] sm:text-xs font-medium flex items-center justify-center gap-2 text-center shadow-lg">
              <Target className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="whitespace-normal break-words">
                Orta sahayı geçmeden sağdaki hedefe nişan alıp şut çek!
              </span>
            </div>
          </div>

          {!challengeResult && (
            <TouchControls
              inputRef={inputRef}
              staminaRef={staminaRef}
              layout={controlsLayout}
              disabled={challengeStatus !== 'dribbling'}
            />
          )}

          {challengeResult && (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/45 backdrop-blur-[3px]">
              <div className="w-full max-w-md bg-slate-950/92 border border-white/15 rounded-2xl shadow-2xl p-4 sm:p-5 text-white text-center space-y-3">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300">
                  <Target className="w-6 h-6" />
                </div>

                <div>
                  <h2 className="font-display font-extrabold text-xl text-white">
                    {challengeResult.tierLabel}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Merkeze Uzaklık: <span className="font-mono-num font-bold text-white">{challengeResult.distancePx} px</span>
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/35 text-amber-300 font-display font-extrabold text-base">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-[10px] font-extrabold text-amber-950">
                    S
                  </span>
                  <span>+{challengeResult.rewardCoins} Jeton Kazanıldı</span>
                </div>

                <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleLeaveChallenge}
                    className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5"
                  >
                    <Home className="w-4 h-4" />
                    <span>Ana Menü</span>
                  </button>

                  {challengeAdRetriesLeft > 0 ? (
                    <button
                      type="button"
                      onClick={() => setAdContext({ type: 'challenge_retry' })}
                      className="min-h-[42px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Reklam İzle (+1 Hak · Kalan: {challengeAdRetriesLeft})</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 px-2">
                      Bugünkü ekstra deneme hakları doldu.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals: Shop, Daily Reward, Daily Challenge Limit & Rewarded Ad */}
      <ShopModal
        open={shopOpen}
        coins={coins}
        ownedIds={ownedIds}
        equipped={equippedSkins}
        onBuy={handleBuyItem}
        onEquip={handleEquipSkin}
        onClose={() => setShopOpen(false)}
      />

      <DailyRewardModal
        open={dailyRewardOpen}
        claimedToday={!dailyRewardAvailable}
        rewardAmount={DAILY_REWARD_AMOUNT}
        extraAdAmount={10}
        onClaim={handleClaimDailyReward}
        onWatchExtraAd={() => setAdContext({ type: 'daily_extra' })}
        onClose={() => setDailyRewardOpen(false)}
      />

      {profileOpen && (
        <ProfileModal
          open={profileOpen}
          playerName={playerName}
          coins={coins}
          profile={profile}
          ownedShopCount={ownedIds.length}
          onUpdateUsername={handleUpdateUsername}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          open={settingsOpen}
          isMuted={isMuted}
          controlsLayout={controlsLayout}
          onToggleMute={toggleMute}
          onChangeControlsLayout={handleChangeControlsLayout}
          onStartTutorial={() => {
            setSettingsOpen(false);
            startTutorial();
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {challengeLimitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-[#E5DEC9] rounded-2xl shadow-2xl p-5 text-[#0B2545] text-center space-y-3">
            <h3 className="font-display font-extrabold text-lg">Günlük Hakların Doldu</h3>
            <p className="text-xs text-slate-600">
              Bugünkü 1 ücretsiz ve {MAX_CHALLENGE_AD_RETRIES} reklamlı Günlük Challenge hakkını tamamladın.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold font-mono-num tabular-nums">
              <span>Yeni hak: {challengeCountdownText}</span>
            </div>
            <button
              type="button"
              onClick={() => setChallengeLimitOpen(false)}
              className="w-full min-h-[42px] rounded-xl bg-[#0B2545] text-white font-display font-bold text-sm"
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      <AdRewardModal
        open={adContext !== null}
        title={
          adContext?.type === 'match_double'
            ? '2x Maç Jetonu'
            : adContext?.type === 'online_post_match'
              ? 'Maç Sonu Reklam Ödülü'
              : adContext?.type === 'daily_extra'
                ? 'Ekstra Reklam Jetonu'
                : adContext?.type === 'lobby_ad'
                  ? 'Lobi Reklam Ödülü'
                  : 'Günlük Challenge Ekstra Hak'
        }
        rewardLabel={
          adContext?.type === 'match_double'
            ? `+${lastMatchEarnedCoins} Bonus Jeton Kazan!`
            : adContext?.type === 'online_post_match'
              ? '+25 Bonus Jeton Kazan!'
              : adContext?.type === 'daily_extra'
                ? '+10 Bonus Jeton Kazan!'
                : adContext?.type === 'lobby_ad'
                  ? '+10 Jeton Kazan ve Lobiye Dön!'
                  : '1 Ekstra Challenge Atışı Aç!'
        }
        onComplete={handleAdComplete}
        onCancel={() => {
          const prevCtx = adContext;
          setAdContext(null);
          if (prevCtx?.type === 'lobby_ad') {
            sendWs({ type: 'set_watching_ad', watching: false });
          }
        }}
      />
      {!isOnline && screen === 'menu' && (
        <div className="fixed bottom-2 left-3 z-[60] pointer-events-none px-2.5 py-1 rounded-lg bg-amber-500/95 text-slate-950 text-[11px] font-display font-bold shadow-md">
          Çevrimdışı Mod · Tekli Mod, Antrenman ve Eğitim Aktif
        </div>
      )}

      <LandscapeGuard onEnterLandscapeFullscreen={enterLandscapeFullscreen} />
    </main>
  );
}
