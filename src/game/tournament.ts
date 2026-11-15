import type {
  TournamentMatchInfo,
  TournamentSize,
  TournamentStateInfo,
  TournamentTeamInfo,
} from './types.ts';

export const TOURNAMENT_CLUB_NAMES = [
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
  'Bursa Yeşil Timsah SK',
  'Kocaeli Körfez JK',
  'Sakarya Nehir SK',
  'Eskişehir Kızıl Şimşek FK',
  'Adana Turuncu Kaplan SK',
  'Mersin Liman İdman FK',
  'Hatay Akdeniz Yıldız FK',
  'Malatya Kayısı Gücü SK',
  'Elazığ Gakgoş FK',
  'Diyarbakır Sur Gücü SK',
  'Urfa Göbekli Spor FK',
  'Erzurum Palandöken SK',
  'Manisa Tarzan FK',
  'Balıkesir Marmara SK',
];

function getTotalRounds(size: TournamentSize): number {
  if (size === 32) return 5;
  if (size === 8) return 3;
  return 2;
}

function getRoundLabel(size: TournamentSize, roundIndex: number): string {
  if (size === 32) {
    if (roundIndex === 0) return 'Son 32';
    if (roundIndex === 1) return 'Son 16';
    if (roundIndex === 2) return 'Çeyrek Final';
    if (roundIndex === 3) return 'Yarı Final';
    return 'FİNAL';
  }
  if (size === 4) {
    return roundIndex === 0 ? 'Yarı Final' : 'FİNAL';
  }
  if (roundIndex === 0) return 'Çeyrek Final';
  if (roundIndex === 1) return 'Yarı Final';
  return 'FİNAL';
}

export function createTournamentBracket(
  size: TournamentSize,
  customNames?: Partial<Record<number, string>>
): TournamentStateInfo {
  const teams: TournamentTeamInfo[] = Array.from({ length: size }, (_, idx) => ({
    slotIndex: idx,
    name: customNames?.[idx] || TOURNAMENT_CLUB_NAMES[idx % TOURNAMENT_CLUB_NAMES.length],
    eliminated: false,
  }));

  const matches: TournamentMatchInfo[] = [];
  const totalRounds = getTotalRounds(size);

  for (let r = 0; r < totalRounds; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    const label = getRoundLabel(size, r);
    for (let m = 0; m < matchCount; m++) {
      matches.push({
        id: `r${r}_m${m}`,
        roundIndex: r,
        roundLabel: label,
        matchIndex: m,
        teamAIndex: r === 0 ? m * 2 : null,
        teamBIndex: r === 0 ? m * 2 + 1 : null,
        scoreA: null,
        scoreB: null,
        winnerSlotIndex: null,
        status: 'pending',
      });
    }
  }

  return {
    size,
    teams,
    matches,
    currentMatchId: matches[0]?.id ?? null,
    championSlotIndex: null,
    runnerUpSlotIndex: null,
    lastCompletedRoundIndex: null,
    phase: 'bracket',
  };
}

function simulateBotScore(): { a: number; b: number; winnerIsA: boolean } {
  const winnerGoals = 1 + Math.floor(Math.random() * 3); // 1..3
  const loserGoals = Math.floor(Math.random() * winnerGoals); // 0..winnerGoals-1
  const winnerIsA = Math.random() < 0.5;
  return winnerIsA
    ? { a: winnerGoals, b: loserGoals, winnerIsA: true }
    : { a: loserGoals, b: winnerGoals, winnerIsA: false };
}

function advanceWinnerInMatches(
  state: TournamentStateInfo,
  match: TournamentMatchInfo,
  winnerSlot: number,
  loserSlot: number
): void {
  const loserTeam = state.teams.find((t) => t.slotIndex === loserSlot);
  if (loserTeam) loserTeam.eliminated = true;

  const totalRounds = getTotalRounds(state.size);
  if (match.roundIndex >= totalRounds - 1) {
    state.championSlotIndex = winnerSlot;
    state.runnerUpSlotIndex = loserSlot;
    state.phase = 'champion';
    state.currentMatchId = null;
    return;
  }

  const nextRound = match.roundIndex + 1;
  const nextMatchIndex = Math.floor(match.matchIndex / 2);
  const nextMatch = state.matches.find(
    (m) => m.roundIndex === nextRound && m.matchIndex === nextMatchIndex
  );
  if (nextMatch) {
    if (match.matchIndex % 2 === 0) {
      nextMatch.teamAIndex = winnerSlot;
    } else {
      nextMatch.teamBIndex = winnerSlot;
    }
  }
}

export function resolveBotOnlyMatches(
  inputState: TournamentStateInfo,
  isHumanInSlot: (slotIndex: number) => boolean
): TournamentStateInfo {
  const state: TournamentStateInfo = {
    ...inputState,
    teams: inputState.teams.map((t) => ({ ...t })),
    matches: inputState.matches.map((m) => ({ ...m })),
    lastCompletedRoundIndex: inputState.lastCompletedRoundIndex ?? null,
  };

  const totalRounds = getTotalRounds(state.size);

  // Process strictly round by round:
  // Do NOT simulate other matches in round `r` until all human matches in round `r` are finished.
  for (let r = 0; r < totalRounds; r++) {
    const roundMatches = state.matches
      .filter((m) => m.roundIndex === r)
      .sort((a, b) => a.matchIndex - b.matchIndex);

    const pendingHumanMatch = roundMatches.find(
      (m) =>
        m.status === 'pending' &&
        m.teamAIndex !== null &&
        m.teamBIndex !== null &&
        (isHumanInSlot(m.teamAIndex) || isHumanInSlot(m.teamBIndex))
    );

    if (pendingHumanMatch) {
      state.currentMatchId = pendingHumanMatch.id;
      state.phase = 'bracket';
      return state;
    }

    // No pending human matches remain in round `r`: simulate remaining ready bot-only matches in round `r`
    let simulatedAnyInRound = false;
    for (const m of roundMatches) {
      if (m.status !== 'pending' || m.teamAIndex === null || m.teamBIndex === null) continue;
      const a = m.teamAIndex;
      const b = m.teamBIndex;
      if (!isHumanInSlot(a) && !isHumanInSlot(b)) {
        const sim = simulateBotScore();
        m.scoreA = sim.a;
        m.scoreB = sim.b;
        m.winnerSlotIndex = sim.winnerIsA ? a : b;
        m.status = 'finished';
        advanceWinnerInMatches(state, m, m.winnerSlotIndex, sim.winnerIsA ? b : a);
        simulatedAnyInRound = true;
      }
    }

    const allRoundFinished = roundMatches.every((m) => m.status === 'finished');
    if (simulatedAnyInRound || allRoundFinished) {
      state.lastCompletedRoundIndex = r;
    }

    if (state.championSlotIndex !== null) {
      state.phase = 'champion';
      state.currentMatchId = null;
      return state;
    }
  }

  state.currentMatchId = null;
  state.phase = 'champion';
  return state;
}

export function recordTournamentMatchResult(
  inputState: TournamentStateInfo,
  matchId: string,
  scoreA: number,
  scoreB: number,
  isHumanInSlot: (slotIndex: number) => boolean
): TournamentStateInfo {
  const state: TournamentStateInfo = {
    ...inputState,
    teams: inputState.teams.map((t) => ({ ...t })),
    matches: inputState.matches.map((m) => ({ ...m })),
  };

  const match = state.matches.find((m) => m.id === matchId);
  if (match && match.teamAIndex !== null && match.teamBIndex !== null) {
    const a = match.teamAIndex;
    const b = match.teamBIndex;
    let finalA = scoreA;
    let finalB = scoreB;
    if (finalA === finalB) {
      // Defensive tie-breaker (Golden Goal already resolves ties in live play)
      if (isHumanInSlot(a) && !isHumanInSlot(b)) finalA += 1;
      else if (isHumanInSlot(b) && !isHumanInSlot(a)) finalB += 1;
      else finalA += 1;
    }
    const winnerSlot = finalA > finalB ? a : b;
    const loserSlot = finalA > finalB ? b : a;
    match.scoreA = finalA;
    match.scoreB = finalB;
    match.winnerSlotIndex = winnerSlot;
    match.status = 'finished';
    advanceWinnerInMatches(state, match, winnerSlot, loserSlot);
  }

  return resolveBotOnlyMatches(state, isHumanInSlot);
}

export function getTournamentRunnerUpSlot(state: TournamentStateInfo | null): number | null {
  if (!state || state.phase !== 'champion' || state.championSlotIndex === null) return null;
  if (typeof state.runnerUpSlotIndex === 'number') return state.runnerUpSlotIndex;
  const totalRounds = getTotalRounds(state.size);
  const finalMatch = state.matches.find((m) => m.roundIndex === totalRounds - 1);
  if (!finalMatch || finalMatch.teamAIndex === null || finalMatch.teamBIndex === null) return null;
  return finalMatch.teamAIndex === state.championSlotIndex
    ? finalMatch.teamBIndex
    : finalMatch.teamAIndex;
}
