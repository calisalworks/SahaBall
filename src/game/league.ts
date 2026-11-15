import type { LeagueMatchInfo, LeagueStandingRow, LeagueStateInfo, TeamColorId } from './types.ts';

export const LEAGUE_CLUB_NAMES = [
  'Galata Aslan SK',
  'Fener Kanarya FK',
  'Beşik Kartal JK',
  'Karadeniz Fırtına SK',
  'Başak Şehir FK',
  'Samsun Kuzey SK',
  'İzmir Körfez FK',
  'Boğaz Eyüp FK',
  'Haliç Tersane SK',
  'Selçuklu Kartalı SK',
  'Antalya Akdeniz FK',
  'Alanya Kale SK',
  'Rize Yayla Çay SK',
  'Erciyes Zirve FK',
  'Gazi Şahin FK',
  'Sivas Yiğido FK',
  'Çukurova Demir SK',
  'Başkent Gençler SK',
];

export const CLUB_COLOR_IDS: TeamColorId[] = [
  'red',
  'amber',
  'slate',
  'purple',
  'orange',
  'red',
  'amber',
  'purple',
  'blue',
  'emerald',
  'red',
  'orange',
  'emerald',
  'amber',
  'slate',
  'red',
  'blue',
  'red',
];

export function getClubColorId(slotIndex: number, avoidColorId?: TeamColorId): TeamColorId {
  const preferred = CLUB_COLOR_IDS[slotIndex % CLUB_COLOR_IDS.length] ?? 'blue';
  if (!avoidColorId || preferred !== avoidColorId) {
    return preferred;
  }
  const fallbacks: TeamColorId[] = ['blue', 'red', 'emerald', 'amber', 'purple', 'cyan', 'orange'];
  return fallbacks.find((c) => c !== avoidColorId) ?? 'blue';
}

function sortStandings(rows: LeagueStandingRow[]): LeagueStandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name, 'tr');
  });
}

function generateRoundRobinSchedule(numTeams: number): LeagueMatchInfo[] {
  const matches: LeagueMatchInfo[] = [];
  const teams = Array.from({ length: numTeams }, (_, i) => i);
  const totalWeeks = numTeams - 1; // 17 weeks for 18 teams
  const half = numTeams / 2; // 9 matches per week

  const rotating = teams.slice(1);
  for (let w = 0; w < totalWeeks; w++) {
    const order = [teams[0], ...rotating];
    for (let m = 0; m < half; m++) {
      const a = order[m];
      const b = order[numTeams - 1 - m];
      const swapHome = (w + m) % 2 === 1;
      matches.push({
        id: `w${w}_m${m}`,
        weekIndex: w,
        teamAIndex: swapHome ? b : a,
        teamBIndex: swapHome ? a : b,
        scoreA: null,
        scoreB: null,
        status: 'pending',
      });
    }
    const last = rotating.pop()!;
    rotating.unshift(last);
  }
  return matches;
}

export function createLeagueSeason(
  customNames?: Partial<Record<number, string>>
): LeagueStateInfo {
  const size = 18 as const;
  const teams = Array.from({ length: size }, (_, idx) => {
    return customNames?.[idx] || LEAGUE_CLUB_NAMES[idx % LEAGUE_CLUB_NAMES.length];
  });

  const standings: LeagueStandingRow[] = teams.map((name, slotIndex) => ({
    slotIndex,
    name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0,
  }));

  const matches = generateRoundRobinSchedule(size);

  return {
    size,
    teams,
    standings,
    matches,
    currentWeekIndex: 0,
    currentMatchId: matches[0]?.id ?? null,
    championSlotIndex: null,
    lastCompletedWeekIndex: null,
    phase: 'fixtures',
  };
}

function simulateLeagueAiScore(): { a: number; b: number } {
  const a = Math.floor(Math.random() * 4); // 0..3
  const b = Math.floor(Math.random() * 4); // 0..3
  return { a, b };
}

function applyMatchToStandings(
  standings: LeagueStandingRow[],
  teamAIndex: number,
  teamBIndex: number,
  scoreA: number,
  scoreB: number
): void {
  const rowA = standings.find((r) => r.slotIndex === teamAIndex);
  const rowB = standings.find((r) => r.slotIndex === teamBIndex);
  if (!rowA || !rowB) return;

  rowA.played += 1;
  rowB.played += 1;
  rowA.gf += scoreA;
  rowA.ga += scoreB;
  rowB.gf += scoreB;
  rowB.ga += scoreA;

  if (scoreA > scoreB) {
    rowA.won += 1;
    rowA.points += 3;
    rowB.lost += 1;
  } else if (scoreB > scoreA) {
    rowB.won += 1;
    rowB.points += 3;
    rowA.lost += 1;
  } else {
    rowA.drawn += 1;
    rowB.drawn += 1;
    rowA.points += 1;
    rowB.points += 1;
  }
}

export function resolveLeagueBotMatches(
  inputState: LeagueStateInfo,
  isHumanInSlot: (slotIndex: number) => boolean
): LeagueStateInfo {
  const state: LeagueStateInfo = {
    ...inputState,
    teams: [...inputState.teams],
    standings: inputState.standings.map((r) => ({ ...r })),
    matches: inputState.matches.map((m) => ({ ...m })),
    lastCompletedWeekIndex: inputState.lastCompletedWeekIndex ?? null,
  };

  const totalWeeks = state.size - 1;

  for (let w = 0; w < totalWeeks; w++) {
    const weekMatches = state.matches.filter((m) => m.weekIndex === w);
    const pendingHumanMatch = weekMatches.find(
      (m) =>
        m.status === 'pending' &&
        (isHumanInSlot(m.teamAIndex) || isHumanInSlot(m.teamBIndex))
    );

    // If a human match is still pending in week `w`, do NOT simulate other matches in week `w` yet
    if (pendingHumanMatch) {
      state.standings = sortStandings(state.standings);
      state.currentWeekIndex = w;
      state.currentMatchId = pendingHumanMatch.id;
      state.phase = 'fixtures';
      return state;
    }

    // All human matches in week `w` are finished: simulate the remaining AI-only matches of week `w`
    let simulatedAnyInWeek = false;
    for (const m of weekMatches) {
      if (m.status !== 'pending') continue;
      const hasHuman = isHumanInSlot(m.teamAIndex) || isHumanInSlot(m.teamBIndex);
      if (!hasHuman) {
        const sim = simulateLeagueAiScore();
        m.scoreA = sim.a;
        m.scoreB = sim.b;
        m.status = 'finished';
        applyMatchToStandings(state.standings, m.teamAIndex, m.teamBIndex, sim.a, sim.b);
        simulatedAnyInWeek = true;
      }
    }

    if (simulatedAnyInWeek || weekMatches.every((m) => m.status === 'finished')) {
      state.lastCompletedWeekIndex = w;
    }
  }

  state.standings = sortStandings(state.standings);
  state.currentWeekIndex = totalWeeks - 1;
  state.currentMatchId = null;
  state.championSlotIndex = state.standings[0]?.slotIndex ?? 0;
  state.phase = 'finished';
  return state;
}

export function recordLeagueMatchResult(
  inputState: LeagueStateInfo,
  matchId: string,
  scoreA: number,
  scoreB: number,
  isHumanInSlot: (slotIndex: number) => boolean
): LeagueStateInfo {
  const state: LeagueStateInfo = {
    ...inputState,
    teams: [...inputState.teams],
    standings: inputState.standings.map((r) => ({ ...r })),
    matches: inputState.matches.map((m) => ({ ...m })),
  };

  const match = state.matches.find((m) => m.id === matchId);
  if (match && match.status !== 'finished') {
    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.status = 'finished';
    applyMatchToStandings(state.standings, match.teamAIndex, match.teamBIndex, scoreA, scoreB);
  }

  return resolveLeagueBotMatches(state, isHumanInSlot);
}
