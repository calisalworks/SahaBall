import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { MatchEngine, TICK_RATE } from './src/game/physics.ts';
import type { MatchParticipantSpec } from './src/game/physics.ts';
import {
  createLeagueSeason,
  getClubColorId,
  recordLeagueMatchResult,
  resolveLeagueBotMatches,
} from './src/game/league.ts';
import {
  createTournamentBracket,
  recordTournamentMatchResult,
  resolveBotOnlyMatches,
} from './src/game/tournament.ts';
import { DEFAULT_TEAM_META, MODE_CONFIGS, TEAM_COLOR_PALETTE } from './src/game/types.ts';
import type {
  ActiveTeam,
  BotDifficulty,
  ClientWsMessage,
  GameMode,
  LeagueStateInfo,
  LobbyChatMessage,
  PitchSize,
  PlayerRole,
  PublicRoomSummary,
  RoomGameType,
  RoomStateInfo,
  ServerWsMessage,
  Team,
  TeamColorId,
  TeamMetaMap,
  TournamentSize,
  TournamentStateInfo,
} from './src/game/types.ts';

const ONLINE_ENTRY_FEE = 10;
const VALID_DIFFICULTIES: BotDifficulty[] = ['kolay', 'normal', 'zor', 'efsanevi'];
function sanitizeDifficulty(val: unknown): BotDifficulty {
  return VALID_DIFFICULTIES.includes(val as BotDifficulty) ? (val as BotDifficulty) : 'normal';
}
function sanitizeDifficultyMap(raw: unknown): Record<string, BotDifficulty> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, BotDifficulty> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^bot_(red|blue)_[0-4]$/.test(k) && VALID_DIFFICULTIES.includes(v as BotDifficulty)) {
      out[k] = v as BotDifficulty;
    }
  }
  return out;
}
function sanitizeColorId(val: unknown, fallback: TeamColorId): TeamColorId {
  if (typeof val === 'string' && val in TEAM_COLOR_PALETTE) {
    return val as TeamColorId;
  }
  return fallback;
}
function sanitizeTeamMeta(raw: unknown): TeamMetaMap {
  const input = raw && typeof raw === 'object' ? (raw as Partial<TeamMetaMap>) : {};
  const redName = typeof input.red?.name === 'string' ? input.red.name.trim().slice(0, 14) : '';
  const blueName = typeof input.blue?.name === 'string' ? input.blue.name.trim().slice(0, 14) : '';
  return {
    red: {
      name: redName || DEFAULT_TEAM_META.red.name,
      colorId: sanitizeColorId(input.red?.colorId, DEFAULT_TEAM_META.red.colorId),
    },
    blue: {
      name: blueName || DEFAULT_TEAM_META.blue.name,
      colorId: sanitizeColorId(input.blue?.colorId, DEFAULT_TEAM_META.blue.colorId),
    },
  };
}
function sanitizeCoins(val: unknown, fallback = 50): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(10_000_000, Math.floor(num));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

interface ClientSession {
  id: string;
  ws: WebSocket;
  name: string;
  roomCode: string | null;
}

interface RoomMember {
  clientId: string;
  name: string;
  team: Team;
  role: PlayerRole;
  tournamentSlot: number;
  isReady: boolean;
  isWatchingAd: boolean;
  coins: number;
}

interface GameRoom {
  code: string;
  hostId: string;
  mode: GameMode;
  pitchSize: PitchSize;
  durationSec: number;
  fillBots: boolean;
  redBotCount: number;
  blueBotCount: number;
  gameType: RoomGameType;
  tournamentSize: TournamentSize;
  tournament: TournamentStateInfo | null;
  league: LeagueStateInfo | null;
  defaultBotDifficulty: BotDifficulty;
  botDifficulties: Record<string, BotDifficulty>;
  teamMeta: TeamMetaMap;
  chatMessages: LobbyChatMessage[];
  members: Map<string, RoomMember>;
  engine: MatchEngine | null;
  intervalId: NodeJS.Timeout | null;
  lastActivityAt: number;
}

const clients = new Map<string, ClientSession>();
const rooms = new Map<string, GameRoom>();

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function sendMsg(ws: WebSocket, msg: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastToRoom(room: GameRoom, msg: ServerWsMessage): void {
  const payload = JSON.stringify(msg);
  for (const member of room.members.values()) {
    const client = clients.get(member.clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function toRoomStateInfo(room: GameRoom): RoomStateInfo {
  return {
    roomCode: room.code,
    hostId: room.hostId,
    mode: room.mode,
    pitchSize: room.pitchSize,
    durationSec: room.durationSec,
    fillBots: room.fillBots,
    redBotCount: room.redBotCount,
    blueBotCount: room.blueBotCount,
    gameType: room.gameType,
    tournamentSize: room.tournamentSize,
    tournament: room.tournament,
    league: room.league,
    defaultBotDifficulty: room.defaultBotDifficulty,
    botDifficulties: room.botDifficulties,
    teamMeta: room.teamMeta,
    chatMessages: room.chatMessages.slice(-50),
    phase: room.engine ? room.engine.phase : 'lobby',
    members: Array.from(room.members.values()).map((m) => ({
      id: m.clientId,
      name: m.name,
      team: m.team,
      role: m.role,
      tournamentSlot: m.tournamentSlot,
      isHost: m.clientId === room.hostId,
      isReady: m.isReady,
      isWatchingAd: m.isWatchingAd,
      coins: m.coins,
    })),
  };
}

function validateRoomCanStart(room: GameRoom): string | null {
  for (const m of room.members.values()) {
    if (m.isWatchingAd) {
      return `${m.name} şu an reklam izliyor. Bitmesini bekleyin.`;
    }
    if (!m.isReady) {
      return `Maçı başlatmak için ${m.name} dahil herkes hazır olmalı.`;
    }
    if (m.team !== 'spec' && m.coins < ONLINE_ENTRY_FEE) {
      return `${m.name} oyuncusunun en az ${ONLINE_ENTRY_FEE} jetonu olmalı (reklam izleyerek kazanabilir).`;
    }
  }
  return null;
}

function chargeEntryFeeForParticipants(room: GameRoom, participantIds: Set<string>): void {
  for (const id of participantIds) {
    const member = room.members.get(id);
    if (!member) continue;
    member.coins = Math.max(0, member.coins - ONLINE_ENTRY_FEE);
    const client = clients.get(id);
    if (client) {
      sendMsg(client.ws, { type: 'match_entry_fee', amount: ONLINE_ENTRY_FEE });
    }
  }
}

function stopRoomLoop(room: GameRoom): void {
  if (room.intervalId) {
    clearInterval(room.intervalId);
    room.intervalId = null;
  }
}

function isHumanInTournamentSlot(room: GameRoom, slotIndex: number): boolean {
  for (const m of room.members.values()) {
    if (m.team !== 'spec' && m.tournamentSlot === slotIndex) {
      return true;
    }
  }
  return false;
}

function runRoomTickLoop(
  room: GameRoom,
  activeTournamentMatchId: string | null,
  activeLeagueMatchId: string | null = null
): void {
  const tickMs = 1000 / TICK_RATE;
  let lastTickTime = performance.now();
  let accumulator = 0;

  room.intervalId = setInterval(() => {
    if (!room.engine) {
      stopRoomLoop(room);
      return;
    }

    const now = performance.now();
    accumulator += Math.min(100, now - lastTickTime);
    lastTickTime = now;

    let stepped = false;
    while (accumulator >= tickMs) {
      room.engine.step();
      accumulator -= tickMs;
      stepped = true;
    }

    if (stepped) {
      const snap = room.engine.getSnapshot();
      broadcastToRoom(room, { type: 'snapshot', snapshot: snap });
      if (snap.phase === 'finished') {
        stopRoomLoop(room);
        // Reset non-host readiness after a match finishes so everyone readies up again
        for (const m of room.members.values()) {
          m.isReady = m.clientId === room.hostId && !m.isWatchingAd;
        }
        if (activeTournamentMatchId && room.tournament) {
          room.tournament = recordTournamentMatchResult(
            room.tournament,
            activeTournamentMatchId,
            snap.redScore,
            snap.blueScore,
            (slot) => isHumanInTournamentSlot(room, slot)
          );
        } else if (activeLeagueMatchId && room.league) {
          room.league = recordLeagueMatchResult(
            room.league,
            activeLeagueMatchId,
            snap.redScore,
            snap.blueScore,
            (slot) => isHumanInTournamentSlot(room, slot)
          );
        }
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
      }
    }
  }, 15);
}

function startMatchInRoom(room: GameRoom): void {
  stopRoomLoop(room);
  const teamSize = MODE_CONFIGS[room.mode].teamSize;
  const humans: MatchParticipantSpec[] = [];
  const chargedIds = new Set<string>();

  for (const m of room.members.values()) {
    if (m.team === 'red' || m.team === 'blue') {
      const currentInTeam = humans.filter((h) => h.team === m.team).length;
      if (currentInTeam < teamSize) {
        humans.push({
          id: m.clientId,
          name: m.name,
          team: m.team,
          role: m.role,
          isBot: false,
        });
        chargedIds.add(m.clientId);
      }
    }
  }

  chargeEntryFeeForParticipants(room, chargedIds);

  const participants = MatchEngine.buildParticipantsWithBots(
    room.mode,
    humans,
    room.fillBots,
    room.defaultBotDifficulty,
    room.botDifficulties,
    { red: room.redBotCount, blue: room.blueBotCount }
  );
  const redTotal = participants.filter((p) => p.team === 'red').length;
  const blueTotal = participants.filter((p) => p.team === 'blue').length;
  if (redTotal === 0 || blueTotal === 0) {
    const fallbackParticipants = MatchEngine.buildParticipantsWithBots(
      room.mode,
      humans,
      true,
      room.defaultBotDifficulty,
      room.botDifficulties,
      {
        red: redTotal === 0 ? Math.max(1, room.redBotCount) : room.redBotCount,
        blue: blueTotal === 0 ? Math.max(1, room.blueBotCount) : room.blueBotCount,
      }
    );
    room.engine = new MatchEngine(
      room.mode,
      room.durationSec,
      fallbackParticipants,
      room.pitchSize,
      false,
      room.teamMeta
    );
  } else {
    room.engine = new MatchEngine(
      room.mode,
      room.durationSec,
      participants,
      room.pitchSize,
      false,
      room.teamMeta
    );
  }

  room.lastActivityAt = Date.now();
  broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
  broadcastToRoom(room, { type: 'snapshot', snapshot: room.engine.getSnapshot() });
  runRoomTickLoop(room, null);
}

function buildCompetitionMatchTeamMeta(
  room: GameRoom,
  slotA: number,
  slotB: number,
  nameA: string,
  nameB: string
): TeamMetaMap {
  const ownColor = room.teamMeta.red.colorId;
  let colorA: TeamColorId;
  let colorB: TeamColorId;
  if (slotA === 0) {
    colorA = ownColor;
    colorB = getClubColorId(slotB, ownColor);
  } else if (slotB === 0) {
    colorB = ownColor;
    colorA = getClubColorId(slotA, ownColor);
  } else {
    colorA = getClubColorId(slotA);
    colorB = getClubColorId(slotB, colorA);
  }
  return {
    red: { name: nameA, colorId: colorA },
    blue: { name: nameB, colorId: colorB },
  };
}

function startTournamentBracketInRoom(room: GameRoom): void {
  stopRoomLoop(room);
  room.engine = null;
  room.league = null;
  const ownName = room.teamMeta.red.name.trim() || '1. Takım';
  const bracket = createTournamentBracket(32, { 0: ownName });
  room.tournament = resolveBotOnlyMatches(bracket, (slot) => isHumanInTournamentSlot(room, slot));
  room.lastActivityAt = Date.now();
  broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
}

function startNextTournamentMatchInRoom(room: GameRoom): void {
  if (!room.tournament || !room.tournament.currentMatchId) return;
  const match = room.tournament.matches.find((m) => m.id === room.tournament?.currentMatchId);
  if (!match || match.teamAIndex === null || match.teamBIndex === null) return;

  stopRoomLoop(room);
  match.status = 'playing';
  room.tournament.phase = 'playing';

  const teamSize = MODE_CONFIGS[room.mode].teamSize;
  const slotA = match.teamAIndex;
  const slotB = match.teamBIndex;
  const humans: MatchParticipantSpec[] = [];

  for (const m of room.members.values()) {
    if (m.team === 'spec') continue;
    let assignedTeam: ActiveTeam | null = null;
    if (m.tournamentSlot === slotA) assignedTeam = 'red';
    else if (m.tournamentSlot === slotB) assignedTeam = 'blue';
    if (!assignedTeam) continue;

    const currentInTeam = humans.filter((h) => h.team === assignedTeam).length;
    if (currentInTeam < teamSize) {
      humans.push({
        id: m.clientId,
        name: m.name,
        team: assignedTeam,
        role: m.role,
        isBot: false,
      });
    }
  }

  // Always fill AI clubs and partial friend squads with bots in tournament matches
  const chargedIds = new Set(humans.map((h) => h.id));
  chargeEntryFeeForParticipants(room, chargedIds);
  const participants = MatchEngine.buildParticipantsWithBots(
    room.mode,
    humans,
    true,
    room.defaultBotDifficulty,
    room.botDifficulties
  );
  const nameA =
    room.tournament.teams.find((t) => t.slotIndex === slotA)?.name ?? room.teamMeta.red.name;
  const nameB =
    room.tournament.teams.find((t) => t.slotIndex === slotB)?.name ?? room.teamMeta.blue.name;
  const matchTeamMeta = buildCompetitionMatchTeamMeta(room, slotA, slotB, nameA, nameB);

  room.engine = new MatchEngine(
    room.mode,
    room.durationSec,
    participants,
    room.pitchSize,
    false,
    matchTeamMeta
  );
  room.lastActivityAt = Date.now();
  broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
  broadcastToRoom(room, { type: 'snapshot', snapshot: room.engine.getSnapshot() });
  runRoomTickLoop(room, match.id, null);
}

function startLeagueSeasonInRoom(room: GameRoom): void {
  stopRoomLoop(room);
  room.engine = null;
  room.tournament = null;
  const ownName = room.teamMeta.red.name.trim() || '1. Takım';
  const season = createLeagueSeason({ 0: ownName });
  room.league = resolveLeagueBotMatches(season, (slot) => isHumanInTournamentSlot(room, slot));
  room.lastActivityAt = Date.now();
  broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
}

function startNextLeagueMatchInRoom(room: GameRoom): void {
  if (!room.league || !room.league.currentMatchId) return;
  const match = room.league.matches.find((m) => m.id === room.league?.currentMatchId);
  if (!match) return;

  stopRoomLoop(room);
  match.status = 'playing';
  room.league.phase = 'playing';

  const teamSize = MODE_CONFIGS[room.mode].teamSize;
  const slotA = match.teamAIndex;
  const slotB = match.teamBIndex;
  const humans: MatchParticipantSpec[] = [];

  for (const m of room.members.values()) {
    if (m.team === 'spec') continue;
    let assignedTeam: ActiveTeam | null = null;
    if (m.tournamentSlot === slotA) assignedTeam = 'red';
    else if (m.tournamentSlot === slotB) assignedTeam = 'blue';
    if (!assignedTeam) continue;

    const currentInTeam = humans.filter((h) => h.team === assignedTeam).length;
    if (currentInTeam < teamSize) {
      humans.push({
        id: m.clientId,
        name: m.name,
        team: assignedTeam,
        role: m.role,
        isBot: false,
      });
    }
  }

  const chargedIds = new Set(humans.map((h) => h.id));
  chargeEntryFeeForParticipants(room, chargedIds);
  const participants = MatchEngine.buildParticipantsWithBots(
    room.mode,
    humans,
    true,
    room.defaultBotDifficulty,
    room.botDifficulties
  );
  const nameA = room.league.teams[slotA] ?? room.teamMeta.red.name;
  const nameB = room.league.teams[slotB] ?? room.teamMeta.blue.name;
  const matchTeamMeta = buildCompetitionMatchTeamMeta(room, slotA, slotB, nameA, nameB);

  // League matches allow draws (1 point each)
  room.engine = new MatchEngine(
    room.mode,
    room.durationSec,
    participants,
    room.pitchSize,
    true,
    matchTeamMeta
  );
  room.lastActivityAt = Date.now();
  broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
  broadcastToRoom(room, { type: 'snapshot', snapshot: room.engine.getSnapshot() });
  runRoomTickLoop(room, null, match.id);
}

function removeClientFromRoom(client: ClientSession): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;

  room.members.delete(client.id);
  if (room.members.size === 0) {
    stopRoomLoop(room);
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === client.id) {
    const nextHost = room.members.values().next().value;
    if (nextHost) {
      room.hostId = nextHost.clientId;
      nextHost.isReady = !nextHost.isWatchingAd;
    }
  }
  broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
}

function pickBalancedTeam(room: GameRoom): Team {
  const maxPerTeam = MODE_CONFIGS[room.mode].teamSize;
  let redCount = 0;
  let blueCount = 0;
  for (const m of room.members.values()) {
    if (m.team === 'red') redCount++;
    else if (m.team === 'blue') blueCount++;
  }
  if (redCount < maxPerTeam && redCount <= blueCount) return 'red';
  if (blueCount < maxPerTeam) return 'blue';
  if (redCount < maxPerTeam) return 'red';
  return 'spec';
}

function pickBalancedTournamentSlot(room: GameRoom): number {
  const maxPerTeam = MODE_CONFIGS[room.mode].teamSize;
  const maxSlots = room.gameType === 'league' ? 18 : 32;
  const counts = new Array<number>(maxSlots).fill(0);
  for (const m of room.members.values()) {
    if (m.team !== 'spec' && m.tournamentSlot >= 0 && m.tournamentSlot < maxSlots) {
      counts[m.tournamentSlot]++;
    }
  }
  let bestSlot = 0;
  let bestCount = Infinity;
  for (let i = 0; i < maxSlots; i++) {
    if (counts[i] < maxPerTeam && counts[i] < bestCount) {
      bestCount = counts[i];
      bestSlot = i;
    }
  }
  return bestSlot;
}

function sanitizeName(raw: string): string {
  const trimmed = (raw || '').trim().slice(0, 14);
  return trimmed || 'Oyuncu';
}

async function bootstrap(): Promise<void> {
  const app = express();
  const server = http.createServer(app);

  // Disable Nagle's algorithm on incoming TCP sockets for minimal input/snapshot latency
  server.on('connection', (socket) => {
    socket.setNoDelay(true);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, clients: clients.size });
  });

  app.get('/api/rooms', (_req, res) => {
    const list: PublicRoomSummary[] = [];
    for (const room of rooms.values()) {
      const host = room.members.get(room.hostId);
      list.push({
        roomCode: room.code,
        mode: room.mode,
        pitchSize: room.pitchSize,
        playerCount: room.members.size,
        maxPlayers:
          MODE_CONFIGS[room.mode].teamSize *
          (room.gameType === 'tournament' ? 32 : room.gameType === 'league' ? 18 : 2),
        phase: room.engine ? room.engine.phase : 'lobby',
        hostName: host?.name ?? 'Kurucu',
      });
    }
    res.json({ rooms: list.slice(0, 20) });
  });

  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false, // Zero compression delay for 60Hz snapshots
  });

  server.on('upgrade', (req, socket, head) => {
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const clientId = generateId('p');
    const session: ClientSession = {
      id: clientId,
      ws,
      name: 'Oyuncu',
      roomCode: null,
    };
    clients.set(clientId, session);
    sendMsg(ws, { type: 'welcome', clientId });

    ws.on('message', (rawData) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(rawData.toString()) as ClientWsMessage;
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        sendMsg(ws, { type: 'pong', t: msg.t });
        return;
      }

      if (msg.type === 'create_room') {
        removeClientFromRoom(session);
        session.name = sanitizeName(msg.playerName);
        const mode: GameMode = MODE_CONFIGS[msg.mode] ? msg.mode : '2v2';
        const pitchSize: PitchSize =
          msg.pitchSize === 'large' || msg.pitchSize === 'ellipse' ? msg.pitchSize : 'normal';
        const durationSec = [120, 180, 300].includes(msg.durationSec) ? msg.durationSec : 180;
        const gameType: RoomGameType = 'single';
        const tournamentSize: TournamentSize = 32;
        const teamSize = MODE_CONFIGS[mode].teamSize;
        const fillBots = Boolean(msg.fillBots);
        const redBotCount =
          typeof msg.redBotCount === 'number' && Number.isFinite(msg.redBotCount)
            ? Math.max(0, Math.min(teamSize, Math.floor(msg.redBotCount)))
            : fillBots
              ? Math.max(0, teamSize - 1)
              : 0;
        const blueBotCount =
          typeof msg.blueBotCount === 'number' && Number.isFinite(msg.blueBotCount)
            ? Math.max(0, Math.min(teamSize, Math.floor(msg.blueBotCount)))
            : fillBots
              ? teamSize
              : 0;
        const code = generateRoomCode();
        const room: GameRoom = {
          code,
          hostId: session.id,
          mode,
          pitchSize,
          durationSec,
          fillBots: gameType !== 'single' ? true : redBotCount > 0 || blueBotCount > 0 || fillBots,
          redBotCount,
          blueBotCount,
          gameType,
          tournamentSize,
          tournament: null,
          league: null,
          defaultBotDifficulty: sanitizeDifficulty(msg.defaultBotDifficulty),
          botDifficulties: sanitizeDifficultyMap(msg.botDifficulties),
          teamMeta: sanitizeTeamMeta(msg.teamMeta),
          chatMessages: [],
          members: new Map([
            [
              session.id,
              {
                clientId: session.id,
                name: session.name,
                team: 'red',
                role: 'forvet',
                tournamentSlot: 0,
                isReady: true,
                isWatchingAd: false,
                coins: sanitizeCoins(msg.coins, 50),
              },
            ],
          ]),
          engine: null,
          intervalId: null,
          lastActivityAt: Date.now(),
        };
        rooms.set(code, room);
        session.roomCode = code;
        sendMsg(ws, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'join_room') {
        const cleanCode = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(cleanCode);
        if (!room) {
          sendMsg(ws, { type: 'error', message: 'Oda bulunamadı. Oda kodunu kontrol edin.' });
          return;
        }
        removeClientFromRoom(session);
        session.name = sanitizeName(msg.playerName);
        const assignedSlot = pickBalancedTournamentSlot(room);
        const isClubMode = room.gameType === 'tournament' || room.gameType === 'league';
        const assignedTeam: Team = isClubMode
          ? assignedSlot % 2 === 0
            ? 'red'
            : 'blue'
          : pickBalancedTeam(room);
        const teamCount = Array.from(room.members.values()).filter((m) =>
          isClubMode ? m.tournamentSlot === assignedSlot : m.team === assignedTeam
        ).length;
        const defaultRoles: PlayerRole[] = ['forvet', 'ortasaha', 'defans', 'kaleci'];
        room.members.set(session.id, {
          clientId: session.id,
          name: session.name,
          team: assignedTeam,
          role: defaultRoles[teamCount % defaultRoles.length],
          tournamentSlot: assignedSlot,
          isReady: false,
          isWatchingAd: false,
          coins: sanitizeCoins(msg.coins, 50),
        });
        session.roomCode = room.code;
        room.lastActivityAt = Date.now();
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        if (room.engine) {
          sendMsg(ws, { type: 'snapshot', snapshot: room.engine.getSnapshot() });
        }
        return;
      }

      if (msg.type === 'leave_room') {
        removeClientFromRoom(session);
        return;
      }

      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room) return;
      room.lastActivityAt = Date.now();

      if (msg.type === 'switch_team') {
        if (room.engine && room.engine.phase !== 'lobby' && room.engine.phase !== 'finished') return;
        const member = room.members.get(session.id);
        if (!member) return;
        const maxPerTeam = MODE_CONFIGS[room.mode].teamSize;
        if (msg.team === 'red' || msg.team === 'blue') {
          const count = Array.from(room.members.values()).filter(
            (m) => m.team === msg.team && m.clientId !== session.id
          ).length;
          if (count >= maxPerTeam) {
            sendMsg(ws, { type: 'error', message: 'Bu takım dolu.' });
            return;
          }
        }
        member.team = msg.team;
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'switch_tournament_slot') {
        if (room.engine && room.engine.phase !== 'lobby' && room.engine.phase !== 'finished') return;
        if (room.tournament !== null || room.league !== null) return;
        const member = room.members.get(session.id);
        if (!member) return;
        const maxSlots = room.gameType === 'league' ? 18 : 32;
        const slotIndex = Math.floor(Number(msg.slotIndex));
        if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex >= maxSlots) return;
        const maxPerTeam = MODE_CONFIGS[room.mode].teamSize;
        const count = Array.from(room.members.values()).filter(
          (m) => m.team !== 'spec' && m.tournamentSlot === slotIndex && m.clientId !== session.id
        ).length;
        if (count >= maxPerTeam) {
          sendMsg(ws, { type: 'error', message: 'Bu kulüp kadrosu dolu.' });
          return;
        }
        member.tournamentSlot = slotIndex;
        member.team = slotIndex % 2 === 0 ? 'red' : 'blue';
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'set_role') {
        if (room.engine && room.engine.phase !== 'lobby' && room.engine.phase !== 'finished') return;
        const member = room.members.get(session.id);
        if (!member) return;
        if (['kaleci', 'defans', 'ortasaha', 'forvet'].includes(msg.role)) {
          member.role = msg.role;
          broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        }
        return;
      }

      if (msg.type === 'set_ready') {
        if (room.engine && room.engine.phase !== 'lobby' && room.engine.phase !== 'finished') return;
        const member = room.members.get(session.id);
        if (!member) return;
        if (msg.ready) {
          if (member.isWatchingAd) {
            sendMsg(ws, { type: 'error', message: 'Reklam izlerken hazır olamazsın.' });
            return;
          }
          if (member.team !== 'spec' && member.coins < ONLINE_ENTRY_FEE) {
            sendMsg(ws, {
              type: 'error',
              message: `Oynamak için en az ${ONLINE_ENTRY_FEE} jeton gerekli. Reklam izleyerek jeton kazanabilirsin.`,
            });
            return;
          }
        }
        member.isReady = Boolean(msg.ready);
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'set_watching_ad') {
        const member = room.members.get(session.id);
        if (!member) return;
        member.isWatchingAd = Boolean(msg.watching);
        if (member.isWatchingAd) {
          member.isReady = false;
        } else if (member.clientId === room.hostId) {
          member.isReady = true;
        }
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'update_coins') {
        const member = room.members.get(session.id);
        if (!member) return;
        member.coins = sanitizeCoins(msg.coins, member.coins);
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'kick_member') {
        if (room.hostId !== session.id) return;
        if (typeof msg.targetId !== 'string' || msg.targetId === session.id) return;
        const targetMember = room.members.get(msg.targetId);
        if (!targetMember) return;
        room.members.delete(msg.targetId);
        const targetClient = clients.get(msg.targetId);
        if (targetClient) {
          targetClient.roomCode = null;
          sendMsg(targetClient.ws, {
            type: 'kicked',
            reason: 'Oda kurucusu tarafından odadan çıkarıldınız.',
          });
        }
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'chat_message') {
        const member = room.members.get(session.id);
        if (!member || typeof msg.text !== 'string') return;
        const cleanText = msg.text.trim().slice(0, 180);
        if (!cleanText) return;
        const chatMsg: LobbyChatMessage = {
          id: generateId('chat'),
          senderId: member.clientId,
          senderName: member.name,
          text: cleanText,
          timestamp: Date.now(),
        };
        room.chatMessages.push(chatMsg);
        if (room.chatMessages.length > 50) {
          room.chatMessages = room.chatMessages.slice(-50);
        }
        broadcastToRoom(room, { type: 'chat_message', message: chatMsg });
        return;
      }

      if (msg.type === 'update_settings') {
        if (room.hostId !== session.id) return;
        if (room.engine && room.engine.phase !== 'lobby' && room.engine.phase !== 'finished') return;
        if (MODE_CONFIGS[msg.mode]) room.mode = msg.mode;
        if (msg.pitchSize === 'normal' || msg.pitchSize === 'large' || msg.pitchSize === 'ellipse') {
          room.pitchSize = msg.pitchSize;
        }
        if ([120, 180, 300].includes(msg.durationSec)) room.durationSec = msg.durationSec;
        const nextTeamSize = MODE_CONFIGS[room.mode].teamSize;
        if (typeof msg.redBotCount === 'number' && Number.isFinite(msg.redBotCount)) {
          room.redBotCount = Math.max(0, Math.min(nextTeamSize, Math.floor(msg.redBotCount)));
        } else {
          room.redBotCount = Math.min(room.redBotCount, nextTeamSize);
        }
        if (typeof msg.blueBotCount === 'number' && Number.isFinite(msg.blueBotCount)) {
          room.blueBotCount = Math.max(0, Math.min(nextTeamSize, Math.floor(msg.blueBotCount)));
        } else {
          room.blueBotCount = Math.min(room.blueBotCount, nextTeamSize);
        }
        if (typeof msg.redBotCount === 'number' || typeof msg.blueBotCount === 'number') {
          room.fillBots = room.redBotCount > 0 || room.blueBotCount > 0;
        } else {
          room.fillBots = Boolean(msg.fillBots);
          if (!room.fillBots) {
            room.redBotCount = 0;
            room.blueBotCount = 0;
          } else if (room.redBotCount === 0 && room.blueBotCount === 0) {
            room.redBotCount = nextTeamSize;
            room.blueBotCount = nextTeamSize;
          }
        }
        room.gameType = 'single';
        room.tournament = null;
        room.league = null;
        room.tournamentSize = 32;
        if (msg.defaultBotDifficulty !== undefined) {
          room.defaultBotDifficulty = sanitizeDifficulty(msg.defaultBotDifficulty);
        }
        if (msg.botDifficulties !== undefined) {
          room.botDifficulties = sanitizeDifficultyMap(msg.botDifficulties);
        }
        if (msg.teamMeta !== undefined) {
          room.teamMeta = sanitizeTeamMeta(msg.teamMeta);
        }
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'start_match') {
        if (room.hostId !== session.id) return;
        const blockReason = validateRoomCanStart(room);
        if (blockReason) {
          sendMsg(ws, { type: 'error', message: blockReason });
          return;
        }
        if (room.gameType === 'tournament') {
          startTournamentBracketInRoom(room);
        } else if (room.gameType === 'league') {
          startLeagueSeasonInRoom(room);
        } else {
          startMatchInRoom(room);
        }
        return;
      }

      if (msg.type === 'start_next_tournament_match') {
        if (room.hostId !== session.id) return;
        startNextTournamentMatchInRoom(room);
        return;
      }

      if (msg.type === 'advance_tournament') {
        if (room.hostId !== session.id) return;
        stopRoomLoop(room);
        room.engine = null;
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'reset_tournament') {
        if (room.hostId !== session.id) return;
        stopRoomLoop(room);
        room.engine = null;
        room.tournament = null;
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'start_next_league_match') {
        if (room.hostId !== session.id) return;
        startNextLeagueMatchInRoom(room);
        return;
      }

      if (msg.type === 'advance_league') {
        if (room.hostId !== session.id) return;
        stopRoomLoop(room);
        room.engine = null;
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'reset_league') {
        if (room.hostId !== session.id) return;
        stopRoomLoop(room);
        room.engine = null;
        room.league = null;
        broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        return;
      }

      if (msg.type === 'rematch') {
        if (room.hostId !== session.id) return;
        if (room.gameType === 'tournament' || room.gameType === 'league') {
          stopRoomLoop(room);
          room.engine = null;
          broadcastToRoom(room, { type: 'room_state', room: toRoomStateInfo(room) });
        } else {
          const blockReason = validateRoomCanStart(room);
          if (blockReason) {
            sendMsg(ws, { type: 'error', message: blockReason });
            return;
          }
          startMatchInRoom(room);
        }
        return;
      }

      if (msg.type === 'input') {
        if (room.engine) {
          room.engine.setPlayerInput(session.id, msg.input);
        }
        return;
      }

      if (msg.type === 'send_emoji') {
        if (room.engine && typeof msg.emoji === 'string') {
          const clean = msg.emoji.trim().slice(0, 24);
          if (clean) {
            room.engine.triggerEmoji(session.id, clean);
          }
        }
        return;
      }

      if (msg.type === 'set_tactic') {
        if (
          room.engine &&
          room.engine.phase !== 'finished' &&
          (msg.preset === 'defansif' || msg.preset === 'dengeli' || msg.preset === 'ofansif')
        ) {
          const activePlayer = room.engine.players.find((p) => p.id === session.id);
          if (activePlayer && (activePlayer.team === 'red' || activePlayer.team === 'blue')) {
            room.engine.setTeamFormation(activePlayer.team, msg.preset, undefined, false);
          }
        }
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(session);
      clients.delete(clientId);
    });
  });

  // Periodic stale room cleanup (every 2 minutes)
  setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [code, room] of rooms.entries()) {
      if (room.members.size === 0 || room.lastActivityAt < cutoff) {
        stopRoomLoop(room);
        rooms.delete(code);
      }
    }
  }, 120_000);

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: hmrDisabled ? false : { server },
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SahaBall server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start SahaBall server:', err);
  process.exit(1);
});
