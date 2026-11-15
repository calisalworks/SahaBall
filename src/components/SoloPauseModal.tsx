import React, { useEffect, useRef, useState } from 'react';
import { Check, LayoutGrid, Pause, RotateCcw, Shield, Swords, Scale } from 'lucide-react';
import { MatchEngine } from '../game/physics';
import { DEFAULT_TEAM_META, ROLE_LABELS, TEAM_COLOR_PALETTE } from '../game/types';
import type { ActiveTeam, FormationPreset, FormationSpot, PlayerEntity, TeamMetaMap } from '../game/types';

interface SoloPauseModalProps {
  open: boolean;
  isSolo: boolean;
  team: ActiveTeam;
  teamMeta?: TeamMetaMap;
  players: PlayerEntity[];
  initialPreset: FormationPreset;
  initialSpots: FormationSpot[];
  onResume: () => void;
  onResetSolo: () => void;
  onLeaveToMenu: () => void;
  onApplyFormation: (preset: FormationPreset, spots: FormationSpot[], repositionNow: boolean) => void;
}

const PRESETS: Array<{ id: FormationPreset; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'defansif', label: 'Defansif', icon: Shield },
  { id: 'dengeli', label: 'Dengeli', icon: Scale },
  { id: 'ofansif', label: 'Ofansif', icon: Swords },
];

export const SoloPauseModal: React.FC<SoloPauseModalProps> = ({
  open,
  isSolo,
  team,
  teamMeta = DEFAULT_TEAM_META,
  players,
  initialPreset,
  initialSpots,
  onResume,
  onResetSolo,
  onLeaveToMenu,
  onApplyFormation,
}) => {
  const [tab, setTab] = useState<'pause' | 'formation'>('pause');
  const [preset, setPreset] = useState<FormationPreset>(initialPreset);
  const [spots, setSpots] = useState<FormationSpot[]>(initialSpots);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const spotsRef = useRef<FormationSpot[]>(initialSpots);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    spotsRef.current = spots;
  }, [spots]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setTab('pause');
      setPreset(initialPreset);
      setSpots(initialSpots);
      spotsRef.current = initialSpots;
      setDraggingId(null);
    }
    wasOpenRef.current = open;
  }, [open, initialPreset, initialSpots]);

  if (!open) return null;

  const teamPlayers = players.filter((p) => p.team === team);
  const isRed = team === 'red';

  const handleSelectPreset = (nextPreset: FormationPreset) => {
    setPreset(nextPreset);
    const nextSpots = MatchEngine.getPresetSpots(teamPlayers, nextPreset);
    setSpots(nextSpots);
    spotsRef.current = nextSpots;
    onApplyFormation(nextPreset, nextSpots, false);
  };

  const handleResetPreset = () => {
    const nextSpots = MatchEngine.getPresetSpots(teamPlayers, preset);
    setSpots(nextSpots);
    spotsRef.current = nextSpots;
    onApplyFormation(preset, nextSpots, false);
  };

  const updateSpotFromClientPoint = (playerId: string, clientX: number, clientY: number) => {
    const el = pitchRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    // Team's own half is left half (0..0.46) for Red, right half (0.54..1.0) for Blue
    // normDepth: 0 = own goal line edge, 1 = midfield outside center circle
    let normDepth: number;
    if (isRed) {
      const clampedX = Math.max(0.05, Math.min(0.45, relX));
      normDepth = (clampedX - 0.05) / 0.4;
    } else {
      const clampedX = Math.max(0.55, Math.min(0.95, relX));
      normDepth = (0.95 - clampedX) / 0.4;
    }

    const normY = Math.max(-0.88, Math.min(0.88, (relY - 0.5) * 2));

    setSpots((prev) => {
      const next = prev.map((s) => (s.playerId === playerId ? { ...s, normDepth, normY } : s));
      spotsRef.current = next;
      return next;
    });
  };

  const handleTokenDown = (playerId: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if capture unsupported
    }
    setDraggingId(playerId);
    updateSpotFromClientPoint(playerId, e.clientX, e.clientY);
  };

  const handleTokenMove = (playerId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingId !== playerId) return;
    updateSpotFromClientPoint(playerId, e.clientX, e.clientY);
  };

  const handleTokenUp = (playerId: string) => {
    if (draggingId !== playerId) return;
    setDraggingId(null);
    onApplyFormation(preset, spotsRef.current, false);
  };

  // Convert spot { normDepth, normY } to mini-pitch % coordinates
  const spotToPercent = (spot: FormationSpot): { leftPct: number; topPct: number } => {
    const clampedDepth = Math.max(0.05, Math.min(1, spot.normDepth));
    const leftPct = isRed
      ? 5 + clampedDepth * 40
      : 95 - clampedDepth * 40;
    const topPct = 50 + Math.max(-0.88, Math.min(0.88, spot.normY)) * 44;
    return { leftPct, topPct };
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4 bg-black/60">
      <div
        className={`w-full ${
          isSolo && tab === 'formation' ? 'max-w-xl' : 'max-w-xs'
        } max-h-full overflow-y-auto bg-slate-950/95 border border-white/15 rounded-2xl p-3.5 sm:p-5 text-white shadow-2xl transition-all`}
      >
        {/* Header + Solo Tabs */}
        <div className="flex flex-col gap-2.5 mb-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-bold text-base sm:text-lg">
              {tab === 'formation' ? 'Takım Dizilişi' : 'Oyun Duraklatıldı'}
            </h2>
            {isSolo && (
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-white/10 border border-white/10">
                <button
                  type="button"
                  onClick={() => setTab('pause')}
                  className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-display font-bold flex items-center gap-1 transition-colors ${
                    tab === 'pause' ? 'bg-white text-slate-950' : 'text-white/75 hover:bg-white/10'
                  }`}
                >
                  <Pause className="w-3 h-3" />
                  <span>Duraklat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('formation')}
                  className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-display font-bold flex items-center gap-1 transition-colors ${
                    tab === 'formation' ? 'bg-emerald-500 text-slate-950' : 'text-white/75 hover:bg-white/10'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Takım Dizilişi</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Standard Pause Actions */}
        {tab === 'pause' && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm"
            >
              Maça Devam Et
            </button>
            {isSolo && (
              <button
                type="button"
                onClick={onResetSolo}
                className="w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm"
              >
                Maçı Sıfırla
              </button>
            )}
            <button
              type="button"
              onClick={onLeaveToMenu}
              className="w-full min-h-[44px] rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-200 font-semibold text-sm"
            >
              Ana Menüye Dön
            </button>
          </div>
        )}

        {/* Solo Mode Interactive Formation Editor */}
        {isSolo && tab === 'formation' && (
          <div className="space-y-2.5">
            {/* Preset Buttons + Helper Text */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/8 border border-white/10 flex-1 min-w-[220px]">
                {PRESETS.map((pr) => {
                  const Icon = pr.icon;
                  const active = preset === pr.id;
                  return (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => handleSelectPreset(pr.id)}
                      className={`min-h-[34px] px-2 rounded-lg text-[11px] font-display font-bold flex items-center justify-center gap-1 transition-colors ${
                        active
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{pr.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleResetPreset}
                className="min-h-[34px] px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white/85 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Dizilişi Sıfırla</span>
              </button>
            </div>

            {/* Interactive Drag-and-Drop Mini Pitch */}
            <div
              ref={pitchRef}
              className="relative w-full h-[155px] sm:h-[185px] rounded-xl overflow-hidden border-2 border-white/25 bg-[#1B6B38] select-none touch-none"
            >
              {/* Alternating Turf Stripes */}
              <div
                className="absolute inset-0 opacity-35 pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, #16592E 0 12.5%, #207A40 12.5% 25%)',
                }}
              />

              {/* Highlight Active Team's Half */}
              <div
                className={`absolute inset-y-0 ${
                  isRed ? 'left-0 right-1/2 bg-red-500/10' : 'left-1/2 right-0 bg-blue-500/10'
                } pointer-events-none`}
              />

              {/* Halfway Line & Center Circle */}
              <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white/60 pointer-events-none" />
              <div className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60 pointer-events-none" />

              {/* Left & Right Goal Boxes */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-20 border-2 border-l-0 border-white/55 pointer-events-none" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-20 border-2 border-r-0 border-white/55 pointer-events-none" />

              {/* Attack Direction Label on Opponent Half */}
              <div
                className={`absolute top-2 ${
                  isRed ? 'right-3 text-right' : 'left-3 text-left'
                } text-[10px] font-bold text-white/65 pointer-events-none`}
              >
                {isRed ? 'RAKİP KALE →' : '← RAKİP KALE'}
              </div>
              <div
                className={`absolute bottom-1.5 ${
                  isRed ? 'left-3 text-left' : 'right-3 text-right'
                } text-[9px] font-semibold text-white/55 pointer-events-none`}
              >
                Oyuncuları sürükle
              </div>

              {/* Draggable Player Discs */}
              {teamPlayers.map((p) => {
                const spot = spots.find((s) => s.playerId === p.id) ?? {
                  playerId: p.id,
                  normDepth: 0.75,
                  normY: 0,
                };
                const { leftPct, topPct } = spotToPercent(spot);
                const isDragging = draggingId === p.id;
                const shortRole = ROLE_LABELS[p.role ?? 'ortasaha'].short;

                const teamTheme = TEAM_COLOR_PALETTE[teamMeta[team].colorId];

                return (
                  <div
                    key={p.id}
                    onPointerDown={(e) => handleTokenDown(p.id, e)}
                    onPointerMove={(e) => handleTokenMove(p.id, e)}
                    onPointerUp={() => handleTokenUp(p.id)}
                    onPointerCancel={() => handleTokenUp(p.id)}
                    style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing touch-none ${
                      isDragging ? 'z-20 scale-115' : 'z-10'
                    }`}
                  >
                    <div
                      style={{
                        backgroundColor: teamTheme.hex,
                        borderColor: teamTheme.ring,
                        color: teamTheme.isLight ? '#0F172A' : '#FFFFFF',
                      }}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-display font-extrabold text-[10px] shadow-md border-2 ${
                        !p.isBot ? 'ring-2 ring-amber-300' : ''
                      }`}
                    >
                      {shortRole}
                    </div>
                    <span className="mt-0.5 px-1 rounded bg-black/55 text-[9px] font-semibold text-white whitespace-nowrap max-w-[68px] truncate">
                      {!p.isBot ? 'Sen' : p.name.replace(' (Bot)', '')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  onApplyFormation(preset, spots, false);
                  onResume();
                }}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
              >
                Kaydet ve Devam Et
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyFormation(preset, spots, true);
                  onResume();
                }}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Sahaya Yerleştir & Devam</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
