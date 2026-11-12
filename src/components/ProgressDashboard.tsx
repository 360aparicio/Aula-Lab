/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ProgressDashboard: Dashboard de Progreso D3.js V3.1 Pro con Radar Chart,
 * Gráfica de Barras Agrupadas vs Benchmark GTO, Gráfica Horizontal de Hitos de Carrera
 * sincronizada en vivo y Exportación de Auditoría Pedagógica en PDF.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { LearnerService, LEARNER_UPDATE_EVENT } from '../engine/learner';
import { SpacedRepetitionManager, SM2_UPDATE_EVENT } from '../engine/spacedRepetition';
import { AutoLearningEngine } from '../engine/autoLearningEngine';
import {
  BarChart3,
  Printer,
  Target,
  ShieldAlert,
  TrendingUp,
  Award,
  CheckCircle2
} from 'lucide-react';

interface CategoryStatMap {
  [key: string]: { attempts: number; correct: number };
}

interface RoadmapPhaseSummary {
  id: number;
  name: string;
  doneCount: number;
  totalCount: number;
  pct: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  dry_flop: 'Secos (Dry)',
  wet_flop: 'Mojados (Wet)',
  monotone_flop: 'Monótonos',
  paired_flop: 'Emparejados',
  three_bet_pot: 'Botes 3-Bet',
  squeeze: 'Squeeze',
  rol: 'ROL Limpers',
  open_raise: 'Open Raise',
  four_bet: '4-Bet Pots',
  limp_reraise: 'Limp Re-Raise',
  blind_defense: 'Def. Ciegas',
  bluff_catch: 'Bluff Catch'
};

function readCategoryStats(): CategoryStatMap {
  try {
    const saved = localStorage.getItem('gto_academy_stats');
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return {
    dry_flop: { attempts: 12, correct: 10 },
    wet_flop: { attempts: 10, correct: 7 },
    monotone_flop: { attempts: 8, correct: 5 },
    paired_flop: { attempts: 14, correct: 12 },
    three_bet_pot: { attempts: 9, correct: 6 },
    squeeze: { attempts: 7, correct: 5 },
    rol: { attempts: 11, correct: 10 },
    open_raise: { attempts: 15, correct: 14 },
    four_bet: { attempts: 8, correct: 6 },
    limp_reraise: { attempts: 6, correct: 5 },
    blind_defense: { attempts: 12, correct: 10 },
    bluff_catch: { attempts: 9, correct: 7 }
  };
}

function readRoadmapPhases(): RoadmapPhaseSummary[] {
  const defaultPhases: RoadmapPhaseSummary[] = [
    { id: 1, name: 'Fase 1: Bankroll', doneCount: 2, totalCount: 4, pct: 50 },
    { id: 2, name: 'Fase 2: Juego Mental', doneCount: 1, totalCount: 4, pct: 25 },
    { id: 3, name: 'Fase 3: Técnica GTO', doneCount: 1, totalCount: 4, pct: 25 },
    { id: 4, name: 'Fase 4: Datos NL100', doneCount: 0, totalCount: 4, pct: 0 }
  ];

  try {
    const raw = localStorage.getItem('gto_career_roadmap');
    if (!raw) return defaultPhases;
    const parsed = JSON.parse(raw) as Array<{
      id: number;
      name: string;
      milestones: Array<{ id: string; done: boolean }>;
    }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultPhases;
    return parsed.map(phase => {
      const totalCount = phase.milestones?.length || 1;
      const doneCount = (phase.milestones || []).filter(m => m.done).length;
      const shortName = phase.name
        .replace('Gestión de Bankroll y Micro-Límites', 'Bankroll')
        .replace('Juego Mental y Control de Tilt', 'Juego Mental')
        .replace('Habilidades Técnicas y Solvers', 'Técnica GTO')
        .replace('Revisión de Datos & Ascenso a NL50 - NL100', 'Datos NL100');
      return {
        id: phase.id,
        name: shortName,
        doneCount,
        totalCount,
        pct: Math.round((doneCount / totalCount) * 100)
      };
    });
  } catch {
    return defaultPhases;
  }
}

export const ProgressDashboard: React.FC = () => {
  const [catStats, setCatStats] = useState<CategoryStatMap>(() => readCategoryStats());
  const [roadmapPhases, setRoadmapPhases] = useState<RoadmapPhaseSummary[]>(() => readRoadmapPhases());
  const [learnerSummary, setLearnerSummary] = useState(() => LearnerService.getInstance().getLearnerSummary());
  const [sm2Stats, setSm2Stats] = useState(() => SpacedRepetitionManager.getInstance().getStats());
  const learningProfile = useMemo(() => AutoLearningEngine.getInstance().getProfile(), [learnerSummary, sm2Stats]);

  const radarRef = useRef<SVGSVGElement | null>(null);
  const groupedBarRef = useRef<SVGSVGElement | null>(null);
  const roadmapBarRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const refreshAll = () => {
      setCatStats(readCategoryStats());
      setRoadmapPhases(readRoadmapPhases());
      setLearnerSummary(LearnerService.getInstance().getLearnerSummary());
      setSm2Stats(SpacedRepetitionManager.getInstance().getStats());
    };
    window.addEventListener('storage', refreshAll);
    window.addEventListener(LEARNER_UPDATE_EVENT, refreshAll);
    window.addEventListener(SM2_UPDATE_EVENT, refreshAll);
    return () => {
      window.removeEventListener('storage', refreshAll);
      window.removeEventListener(LEARNER_UPDATE_EVENT, refreshAll);
      window.removeEventListener(SM2_UPDATE_EVENT, refreshAll);
    };
  }, []);

  const radarAxes = useMemo(() => {
    const pctOf = (key: string, fallback: number) => {
      const s = catStats[key];
      if (!s || s.attempts === 0) return fallback;
      return Math.round((s.correct / s.attempts) * 100);
    };
    return [
      { axis: 'RFI Preflop', hero: pctOf('open_raise', 88), gto: 95 },
      { axis: 'C-Bet Secos', hero: pctOf('dry_flop', 82), gto: 92 },
      { axis: 'Boards Mojados', hero: pctOf('wet_flop', 70), gto: 88 },
      { axis: 'Botes 3-Bet', hero: pctOf('three_bet_pot', 67), gto: 90 },
      { axis: 'Defensa Ciegas', hero: pctOf('blind_defense', 80), gto: 90 },
      { axis: 'River Bluff Catch', hero: pctOf('bluff_catch', 75), gto: 87 }
    ];
  }, [catStats]);

  const categoryComparisonData = useMemo(() => {
    return Object.entries(CATEGORY_LABELS).map(([key, label]) => {
      const s = catStats[key] || { attempts: 1, correct: 0 };
      const heroPct = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0;
      const gtoTarget = key === 'open_raise' || key === 'dry_flop' ? 92 : 85;
      return { key, label, heroPct, gtoTarget };
    });
  }, [catStats]);

  // 1. Render D3 Radar (Spider) Chart
  useEffect(() => {
    if (!radarRef.current) return;
    const svg = d3.select(radarRef.current);
    svg.selectAll('*').remove();

    const width = 360;
    const height = 310;
    const radius = 100;
    const cx = width / 2;
    const cy = height / 2 + 6;
    const levels = 4;
    const totalAxes = radarAxes.length;
    const angleSlice = (Math.PI * 2) / totalAxes;

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Concentric grid webs
    for (let level = 1; level <= levels; level++) {
      const r = (radius / levels) * level;
      const pts = radarAxes.map((_, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        return [r * Math.cos(angle), r * Math.sin(angle)] as [number, number];
      });
      g.append('polygon')
        .attr('points', pts.map(p => p.join(',')).join(' '))
        .attr('fill', 'none')
        .attr('stroke', '#262626')
        .attr('stroke-width', 1);
    }

    // Axis spokes & labels
    radarAxes.forEach((d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const x2 = radius * Math.cos(angle);
      const y2 = radius * Math.sin(angle);
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', '#262626')
        .attr('stroke-width', 1);

      const lx = (radius + 24) * Math.cos(angle);
      const ly = (radius + 18) * Math.sin(angle);
      g.append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', Math.abs(lx) < 12 ? 'middle' : lx > 0 ? 'start' : 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#d4d4d8')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text(`${d.axis} (${d.hero}%)`);
    });

    const buildPath = (values: number[]) =>
      values
        .map((v, i) => {
          const r = (Math.max(0, Math.min(100, v)) / 100) * radius;
          const angle = i * angleSlice - Math.PI / 2;
          return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
        })
        .join(' ');

    // GTO Benchmark Polygon
    g.append('polygon')
      .attr('points', buildPath(radarAxes.map(a => a.gto)))
      .attr('fill', '#10b981')
      .attr('fill-opacity', 0.12)
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3');

    // Hero Polygon
    g.append('polygon')
      .attr('points', buildPath(radarAxes.map(a => a.hero)))
      .attr('fill', '#3b82f6')
      .attr('fill-opacity', 0.32)
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2.5);

    // Hero Data Points
    radarAxes.forEach((d, i) => {
      const r = (d.hero / 100) * radius;
      const angle = i * angleSlice - Math.PI / 2;
      g.append('circle')
        .attr('cx', r * Math.cos(angle))
        .attr('cy', r * Math.sin(angle))
        .attr('r', 4)
        .attr('fill', '#60a5fa')
        .attr('stroke', '#000000')
        .attr('stroke-width', 1.5);
    });
  }, [radarAxes]);

  // 2. Render D3 Grouped Bar Chart (Hero vs GTO Target)
  useEffect(() => {
    if (!groupedBarRef.current) return;
    const svg = d3.select(groupedBarRef.current);
    svg.selectAll('*').remove();

    const width = 580;
    const height = 270;
    const margin = { top: 20, right: 16, bottom: 56, left: 42 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x0 = d3.scaleBand()
      .domain(categoryComparisonData.map(d => d.label))
      .range([0, innerWidth])
      .paddingInner(0.22);

    const x1 = d3.scaleBand()
      .domain(['heroPct', 'gtoTarget'])
      .range([0, x0.bandwidth()])
      .padding(0.08);

    const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', '#1f2937')
      .attr('stroke-dasharray', '2,2');

    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0));
    xAxis.selectAll('text')
      .attr('transform', 'rotate(-26)')
      .attr('text-anchor', 'end')
      .attr('fill', '#9ca3af')
      .attr('font-size', '9px');
    xAxis.select('.domain').attr('stroke', '#374151');

    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`));
    yAxis.selectAll('text').attr('fill', '#9ca3af').attr('font-size', '9px').attr('font-family', 'monospace');
    yAxis.select('.domain').attr('stroke', '#374151');

    const groups = g.selectAll('.cat-group')
      .data(categoryComparisonData)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${x0(d.label) || 0},0)`);

    groups.append('rect')
      .attr('x', x1('heroPct') || 0)
      .attr('y', d => y(d.heroPct))
      .attr('width', x1.bandwidth())
      .attr('height', d => innerHeight - y(d.heroPct))
      .attr('rx', 3)
      .attr('fill', '#3b82f6');

    groups.append('rect')
      .attr('x', x1('gtoTarget') || 0)
      .attr('y', d => y(d.gtoTarget))
      .attr('width', x1.bandwidth())
      .attr('height', d => innerHeight - y(d.gtoTarget))
      .attr('rx', 3)
      .attr('fill', '#10b981')
      .attr('opacity', 0.45);
  }, [categoryComparisonData]);

  // 3. Render D3 Horizontal Bar Chart for Career Roadmap Milestones
  useEffect(() => {
    if (!roadmapBarRef.current) return;
    const svg = d3.select(roadmapBarRef.current);
    svg.selectAll('*').remove();

    const width = 520;
    const height = 185;
    const margin = { top: 10, right: 56, bottom: 20, left: 132 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const y = d3.scaleBand()
      .domain(roadmapPhases.map(p => p.name))
      .range([0, innerHeight])
      .padding(0.32);

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yAxis = g.append('g').call(d3.axisLeft(y));
    yAxis.selectAll('text').attr('fill', '#e5e7eb').attr('font-size', '10px').attr('font-weight', '600');
    yAxis.select('.domain').attr('stroke', '#374151');

    // Background track
    g.selectAll('.track')
      .data(roadmapPhases)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', d => y(d.name) || 0)
      .attr('width', innerWidth)
      .attr('height', y.bandwidth())
      .attr('rx', 5)
      .attr('fill', '#171717');

    // Progress bars
    g.selectAll('.prog')
      .data(roadmapPhases)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', d => y(d.name) || 0)
      .attr('width', d => x(d.pct))
      .attr('height', y.bandwidth())
      .attr('rx', 5)
      .attr('fill', d => (d.pct >= 75 ? '#10b981' : d.pct >= 40 ? '#3b82f6' : '#f59e0b'));

    // Labels
    g.selectAll('.pct-label')
      .data(roadmapPhases)
      .enter()
      .append('text')
      .attr('x', innerWidth + 8)
      .attr('y', d => (y(d.name) || 0) + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#e5e7eb')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(d => `${d.doneCount}/${d.totalCount} (${d.pct}%)`);
  }, [roadmapPhases]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:border-neutral-300 print:bg-white print:text-black">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white print:text-black">
              Auditoría Analítica D3.js & Radar GTO
            </h2>
            <p className="text-xs text-neutral-400 print:text-neutral-600 mt-0.5">
              Comparativa en tiempo real frente al equilibrio GTO, fugas capturadas y progreso de carrera NL02 → NL100.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer print:hidden"
        >
          <Printer className="w-4 h-4" />
          <span>Exportar Auditoría PDF</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <Award className="w-4 h-4 text-blue-400" />
            <span>Dominio General</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {learningProfile.masteryScore}/100
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">{learningProfile.styleProfile}</div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Fugas Críticas (&gt;5% EV)</span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
            {learnerSummary.criticalMistakesCount}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Peor textura: {learnerSummary.worstTexture}
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>Retención SM-2</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {sm2Stats.retentionRatePct}%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {sm2Stats.masteredCount}/{sm2Stats.totalItems} conceptos dominados
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>EV Perdido Acumulado</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            -{learnerSummary.totalEvLossBBLost} BB
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Posición vulnerable: {learnerSummary.worstPosition}
          </div>
        </div>
      </div>

      {/* Charts Row 1: Radar Chart + Grouped Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white">Radar Estratégico 6 Ejes</h3>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-blue-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" /> Hero
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Meta GTO
              </span>
            </div>
          </div>
          <svg ref={radarRef} viewBox="0 0 360 310" className="w-full max-w-[360px] h-auto" />
        </div>

        <div className="lg:col-span-7 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Precisión Hero vs Benchmark GTO (12 Categorías)</h3>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-blue-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" /> Tu Precisión
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/60 inline-block" /> Objetivo GTO
              </span>
            </div>
          </div>
          <svg ref={groupedBarRef} viewBox="0 0 580 270" className="w-full h-auto" />
        </div>
      </div>

      {/* Row 2: Horizontal Roadmap Chart + AI Prescriptive Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-neutral-950 border border-neutral-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-2">Hitos de Carrera Sincronizados (NL02 → NL100)</h3>
          <p className="text-xs text-neutral-400 mb-3">
            Actualizado automáticamente al marcar objetivos en la Hoja de Ruta.
          </p>
          <svg ref={roadmapBarRef} viewBox="0 0 520 185" className="w-full h-auto" />
        </div>

        <div className="lg:col-span-6 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Plan de Acción Prioritario (Auditoría IA)</span>
          </h3>

          {learnerSummary.topWeaknessPatterns.length === 0 ? (
            <p className="text-xs text-neutral-400">
              No se detectaron fugas críticas superiores al 5% EV todavía. Continúa practicando en Arena y Quiz Infinito.
            </p>
          ) : (
            <div className="space-y-2.5">
              {learnerSummary.topWeaknessPatterns.slice(0, 3).map(pat => (
                <div
                  key={pat.patternId}
                  className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-white">{pat.title}</strong>
                    <span className={`font-mono text-[11px] font-bold ${
                      pat.severity === 'Crítica' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      -{pat.averageEvLossPercent}% EV ({pat.mistakeCount}x)
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">{pat.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
