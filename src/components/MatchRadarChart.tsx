import React, { useMemo } from 'react';
import * as d3 from 'd3';
import type { MatchSummaryStats } from '../game/types';

type PlayerRow = MatchSummaryStats['playerRows'][number];

interface MatchRadarChartProps {
  playerRows: PlayerRow[];
  selectedPlayerId: string;
  onSelectPlayer: (id: string) => void;
}

interface RadarPoint {
  key: string;
  label: string;
  displayValue: string;
  norm: number;
  angle: number;
}

export const MatchRadarChart: React.FC<MatchRadarChartProps> = ({
  playerRows,
  selectedPlayerId,
  onSelectPlayer,
}) => {
  const selected =
    playerRows.find((r) => r.id === selectedPlayerId) ?? playerRows[0] ?? null;

  const { points, polygonPath, gridPolygons, spokes, viewW, viewH, cx, cy, maxR } =
    useMemo(() => {
      const w = 270;
      const h = 216;
      const centerX = w / 2;
      const centerY = h / 2 + 4;
      const radius = 64;

      if (!selected) {
        return {
          points: [] as RadarPoint[],
          polygonPath: '',
          gridPolygons: [] as string[],
          spokes: [] as Array<{ x2: number; y2: number; lx: number; ly: number; anchor: 'start' | 'middle' | 'end'; label: string; value: string }>,
          viewW: w,
          viewH: h,
          cx: centerX,
          cy: centerY,
          maxR: radius,
        };
      }

      const maxDistance = Math.max(60, d3.max(playerRows, (r) => r.distanceMeters) ?? 60);
      const maxShots = Math.max(3, d3.max(playerRows, (r) => r.shots) ?? 3);
      const maxPasses = Math.max(5, d3.max(playerRows, (r) => r.passes) ?? 5);
      const maxSprint = Math.max(5, d3.max(playerRows, (r) => r.sprintSec) ?? 5);

      const shotAcc =
        selected.shots > 0
          ? Math.round((selected.shotsOnTarget / selected.shots) * 100)
          : 0;

      const distScale = d3.scaleLinear().domain([0, maxDistance]).range([0.1, 1]).clamp(true);
      const accScale = d3.scaleLinear().domain([0, 100]).range([0.1, 1]).clamp(true);
      const shotScale = d3.scaleLinear().domain([0, maxShots]).range([0.1, 1]).clamp(true);
      const passScale = d3.scaleLinear().domain([0, maxPasses]).range([0.1, 1]).clamp(true);
      const sprintScale = d3.scaleLinear().domain([0, maxSprint]).range([0.1, 1]).clamp(true);

      const axesCount = 5;
      const angleSlice = (Math.PI * 2) / axesCount;

      const rawAxes: Array<Omit<RadarPoint, 'angle'>> = [
        {
          key: 'distance',
          label: 'Mesafe',
          displayValue: `${selected.distanceMeters} m`,
          norm: selected.distanceMeters > 0 ? distScale(selected.distanceMeters) : 0.08,
        },
        {
          key: 'accuracy',
          label: 'Şut İsabeti',
          displayValue: `%${shotAcc}`,
          norm: shotAcc > 0 ? accScale(shotAcc) : 0.08,
        },
        {
          key: 'shots',
          label: 'Şut',
          displayValue: `${selected.shots}`,
          norm: selected.shots > 0 ? shotScale(selected.shots) : 0.08,
        },
        {
          key: 'passes',
          label: 'Pas',
          displayValue: `${selected.passes}`,
          norm: selected.passes > 0 ? passScale(selected.passes) : 0.08,
        },
        {
          key: 'sprint',
          label: 'Sprint',
          displayValue: `${selected.sprintSec} sn`,
          norm: selected.sprintSec > 0 ? sprintScale(selected.sprintSec) : 0.08,
        },
      ];

      const pts: RadarPoint[] = rawAxes.map((ax, i) => ({
        ...ax,
        angle: i * angleSlice,
      }));

      const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);
      const radialLine = d3
        .lineRadial<RadarPoint>()
        .angle((d) => d.angle)
        .radius((d) => rScale(d.norm))
        .curve(d3.curveLinearClosed);

      const polyPath = radialLine(pts) ?? '';

      const levelLine = d3
        .lineRadial<number>()
        .angle((_, i) => i * angleSlice)
        .radius((d) => rScale(d))
        .curve(d3.curveLinearClosed);

      const levels = [0.25, 0.5, 0.75, 1];
      const grids = levels.map((lvl) => levelLine(new Array<number>(axesCount).fill(lvl)) ?? '');

      const spokeItems = pts.map((pt) => {
        const theta = pt.angle - Math.PI / 2;
        const x2 = Math.cos(theta) * radius;
        const y2 = Math.sin(theta) * radius;
        const labelR = radius + 19;
        const lx = Math.cos(theta) * labelR;
        const ly = Math.sin(theta) * labelR;
        const anchor: 'start' | 'middle' | 'end' =
          Math.abs(lx) < 10 ? 'middle' : lx > 0 ? 'start' : 'end';
        return {
          x2,
          y2,
          lx,
          ly,
          anchor,
          label: pt.label,
          value: pt.displayValue,
        };
      });

      return {
        points: pts,
        polygonPath: polyPath,
        gridPolygons: grids,
        spokes: spokeItems,
        viewW: w,
        viewH: h,
        cx: centerX,
        cy: centerY,
        maxR: radius,
      };
    }, [playerRows, selected]);

  if (!selected) return null;

  const isRed = selected.team === 'red';
  const strokeColor = isRed ? '#F87171' : '#60A5FA';
  const fillColor = isRed ? 'rgba(239, 68, 68, 0.28)' : 'rgba(59, 130, 246, 0.28)';
  const accuracyPct =
    selected.shots > 0 ? Math.round((selected.shotsOnTarget / selected.shots) * 100) : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 flex flex-col gap-2">
      {/* Header + Player Selector */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[11px] font-display font-bold text-slate-200 tracking-wide">
          Performans Radarı
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {playerRows.slice(0, 6).map((row) => {
            const active = row.id === selected.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelectPlayer(row.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 border transition-colors ${
                  active
                    ? row.team === 'red'
                      ? 'bg-red-500/25 border-red-400/60 text-white'
                      : 'bg-blue-500/25 border-blue-400/60 text-white'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    row.team === 'red' ? 'bg-red-400' : 'bg-blue-400'
                  }`}
                />
                <span className="truncate max-w-[70px]">{row.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* D3 SVG Radar + Key Readouts */}
      <div className="grid grid-cols-1 min-[440px]:grid-cols-12 gap-2 items-center">
        <div className="min-[440px]:col-span-7 flex items-center justify-center">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="w-full max-w-[260px] h-auto overflow-visible select-none"
            role="img"
            aria-label={`${selected.name} maç performans radar grafiği`}
          >
            <g transform={`translate(${cx}, ${cy})`}>
              {/* Concentric pentagon grid rings */}
              {gridPolygons.map((d, idx) => (
                <path
                  key={idx}
                  d={d}
                  fill={idx === gridPolygons.length - 1 ? 'rgba(255,255,255,0.03)' : 'none'}
                  stroke="rgba(255, 255, 255, 0.14)"
                  strokeWidth={idx === gridPolygons.length - 1 ? 1.2 : 0.9}
                />
              ))}

              {/* Radial axis spokes & labels */}
              {spokes.map((s, idx) => (
                <g key={idx}>
                  <line
                    x1={0}
                    y1={0}
                    x2={s.x2}
                    y2={s.y2}
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth={1}
                  />
                  <text
                    x={s.lx}
                    y={s.ly - 4}
                    textAnchor={s.anchor}
                    dominantBaseline="central"
                    fill="#CBD5E1"
                    fontSize={9.5}
                    fontWeight={600}
                  >
                    {s.label}
                  </text>
                  <text
                    x={s.lx}
                    y={s.ly + 7}
                    textAnchor={s.anchor}
                    dominantBaseline="central"
                    fill="#F8FAFC"
                    fontSize={9.5}
                    fontWeight={800}
                  >
                    {s.value}
                  </text>
                </g>
              ))}

              {/* D3 Data Polygon */}
              <path
                d={polygonPath}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={2}
                strokeLinejoin="round"
              />

              {/* Vertex dots */}
              {points.map((pt) => {
                const theta = pt.angle - Math.PI / 2;
                const px = Math.cos(theta) * (pt.norm * maxR);
                const py = Math.sin(theta) * (pt.norm * maxR);
                return (
                  <circle
                    key={pt.key}
                    cx={px}
                    cy={py}
                    r={3.2}
                    fill={strokeColor}
                    stroke="#0F172A"
                    strokeWidth={1.2}
                  />
                );
              })}
            </g>
          </svg>
        </div>

        {/* Highlighted Distance & Shot Accuracy Cards */}
        <div className="min-[440px]:col-span-5 grid grid-cols-2 min-[440px]:grid-cols-1 gap-1.5">
          <div className="rounded-lg bg-slate-900/80 border border-white/10 px-2.5 py-2">
            <div className="text-[10px] text-slate-400 font-medium">Kat Edilen Mesafe</div>
            <div className="font-mono-num font-extrabold text-base sm:text-lg text-emerald-300 mt-0.5">
              {selected.distanceMeters} m
            </div>
            <div className="text-[10px] text-slate-400">
              Sprint: <span className="text-slate-200 font-semibold">{selected.sprintSec} sn</span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/80 border border-white/10 px-2.5 py-2">
            <div className="text-[10px] text-slate-400 font-medium">Şut İsabet Oranı</div>
            <div className="font-mono-num font-extrabold text-base sm:text-lg text-amber-300 mt-0.5">
              %{accuracyPct}
            </div>
            <div className="text-[10px] text-slate-400">
              İsabet:{' '}
              <span className="text-slate-200 font-semibold">
                {selected.shotsOnTarget}/{selected.shots} şut
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
