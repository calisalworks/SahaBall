export interface ProfileData {
  stars: number;
  hasSetUsernameFree: boolean;
  googleLinked: boolean;
  soloWins: number;
  soloLosses: number;
  soloDraws: number;
  onlineWins: number;
  onlineMatches: number;
  totalGoals: number;
  totalMatches: number;
}

const PROFILE_STORAGE_KEY = 'sahaball_profile_v1';

export const USERNAME_CHANGE_COST = 5000;

export const DEFAULT_PROFILE: ProfileData = {
  stars: 0,
  hasSetUsernameFree: false,
  googleLinked: false,
  soloWins: 0,
  soloLosses: 0,
  soloDraws: 0,
  onlineWins: 0,
  onlineMatches: 0,
  totalGoals: 0,
  totalMatches: 0,
};

export function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<ProfileData>;
    return {
      stars: typeof parsed.stars === 'number' && parsed.stars >= 0 ? Math.floor(parsed.stars) : 0,
      hasSetUsernameFree: Boolean(parsed.hasSetUsernameFree),
      googleLinked: Boolean(parsed.googleLinked),
      soloWins: typeof parsed.soloWins === 'number' ? Math.max(0, parsed.soloWins) : 0,
      soloLosses: typeof parsed.soloLosses === 'number' ? Math.max(0, parsed.soloLosses) : 0,
      soloDraws: typeof parsed.soloDraws === 'number' ? Math.max(0, parsed.soloDraws) : 0,
      onlineWins: typeof parsed.onlineWins === 'number' ? Math.max(0, parsed.onlineWins) : 0,
      onlineMatches: typeof parsed.onlineMatches === 'number' ? Math.max(0, parsed.onlineMatches) : 0,
      totalGoals: typeof parsed.totalGoals === 'number' ? Math.max(0, parsed.totalGoals) : 0,
      totalMatches: typeof parsed.totalMatches === 'number' ? Math.max(0, parsed.totalMatches) : 0,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile: ProfileData): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors
  }
}

/**
 * 0-99 stars => Level 1
 * 100-199 stars => Level 2
 * 200-299 stars => Level 3
 * ... up to Level 100
 */
export function getLevelFromStars(stars: number): number {
  const safeStars = Math.max(0, Math.floor(stars));
  return Math.min(100, Math.floor(safeStars / 100) + 1);
}

export function getLevelProgress(stars: number): {
  level: number;
  currentInLevel: number;
  requiredForNext: number;
  pct: number;
  isMaxLevel: boolean;
} {
  const safeStars = Math.max(0, Math.floor(stars));
  const level = getLevelFromStars(safeStars);
  const isMaxLevel = level >= 100;
  const currentInLevel = isMaxLevel ? 100 : safeStars % 100;
  return {
    level,
    currentInLevel,
    requiredForNext: 100,
    pct: isMaxLevel ? 100 : currentInLevel,
    isMaxLevel,
  };
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  target: number;
  getCurrent: (profile: ProfileData, ownedShopCount: number) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_match',
    title: 'İlk Düdük',
    description: 'İlk maçını tamamla',
    target: 1,
    getCurrent: (p) => p.totalMatches,
  },
  {
    id: 'first_solo_win',
    title: 'İlk Zafer',
    description: 'Bilgisayara karşı 1 maç kazan',
    target: 1,
    getCurrent: (p) => p.soloWins,
  },
  {
    id: 'goal_machine',
    title: 'Gol Makinesi',
    description: 'Maçlarda toplam 10 gol at',
    target: 10,
    getCurrent: (p) => p.totalGoals,
  },
  {
    id: 'win_streak_5',
    title: 'Seri Galip',
    description: 'Bilgisayara karşı 5 galibiyet al',
    target: 5,
    getCurrent: (p) => p.soloWins,
  },
  {
    id: 'level_2',
    title: 'Yükselen Yıldız',
    description: 'Profilde Seviye 2’ye ulaş (100 Yıldız)',
    target: 100,
    getCurrent: (p) => p.stars,
  },
  {
    id: 'level_5',
    title: 'Saha Efsanesi',
    description: 'Profilde Seviye 5’e ulaş (400 Yıldız)',
    target: 400,
    getCurrent: (p) => p.stars,
  },
  {
    id: 'online_match',
    title: 'Dostluk Maçı',
    description: '1 çevrimiçi maç oyna',
    target: 1,
    getCurrent: (p) => p.onlineMatches,
  },
  {
    id: 'collector',
    title: 'Koleksiyoncu',
    description: 'Mağazadan 1 ürün satın al',
    target: 1,
    getCurrent: (_p, ownedCount) => ownedCount,
  },
];
