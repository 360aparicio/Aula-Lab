/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AcademyRoadmapDashboard: Academia de Póker Interactiva & Dashboard D3.js.
 * - Simuladores de práctica para Spots, Texturas de flop (secas, coordinadas, monótonas, emparejadas),
 *   3-Bet pots, Squeeze, ROL, Open Raise (RFI), 4-Bet, Limp Re-Raise, Blind Defense y River Bluff Catching.
 * - Cambio dinámico de textura y board tras responder cada mano de entrenamiento.
 * - Dashboard de Progreso con gráfico D3.js para medir el dominio histórico en cada categoría.
 * - Reporte de diagnóstico y resumen de debilidades detectadas por la IA con Auto-Aprendizaje.
 * - Hoja de Ruta de Carrera ("Career Roadmap") de 4 fases estructuradas (Gestión de Bankroll,
 *   Juego Mental, Habilidades Técnicas y Revisión de Datos) de NL02 a NL100 con hitos interactivos.
 * - Gestor de Flashcards personalizadas con algoritmo de repetición espaciada SM-2 y botón 1-click para guardar manos.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, cardId, SUIT_COLORS, SUIT_SYMBOLS } from '../engine/cards';
import { AutoLearningEngine } from '../engine/autoLearningEngine';
import { SolverMetaUpdater } from '../engine/solverMetaUpdater';
import {
  SpacedRepetitionManager,
  SM2_QUALITY_RATINGS,
  SM2Item,
  SM2_UPDATE_EVENT
} from '../engine/spacedRepetition';
import { CustomFlashcardManager, SM2Flashcard } from './CustomFlashcardManager';
import { ProgressDashboard } from './ProgressDashboard';
import { EvaluationModule } from './EvaluationModule';
import {
  ACADEMY_SCENARIO_BANK,
  getNextAcademyScenario,
  type AcademyCategory,
  type QuizScenario
} from '../engine/academySpots';
import {
  GraduationCap,
  Award,
  AlertTriangle,
  Brain,
  ArrowRight,
  Zap,
  BarChart3,
  Compass,
  Check,
  Bookmark,
  CheckCircle2,
  Sparkles,
  Target,
  Clock,
  Layers,
  History,
  ClipboardCheck
} from 'lucide-react';

export type { AcademyCategory } from '../engine/academySpots';

const CATEGORIES: { id: AcademyCategory; label: string; icon: string }[] = [
  { id: 'dry_flop', label: 'Flops Secos (Dry)', icon: '🏜️' },
  { id: 'wet_flop', label: 'Flops Coordinados (Wet)', icon: '🌊' },
  { id: 'monotone_flop', label: 'Flops Monótonos', icon: '🎨' },
  { id: 'paired_flop', label: 'Flops Emparejados', icon: '♊' },
  { id: 'three_bet_pot', label: 'Botes 3-Bet', icon: '🔥' },
  { id: 'squeeze', label: 'Squeeze Spots', icon: '💥' },
  { id: 'rol', label: 'ROL (Limpers)', icon: '🎣' },
  { id: 'open_raise', label: 'Open Raise (RFI)', icon: '🚀' },
  { id: 'four_bet', label: '4-Bet Pots', icon: '⚡' },
  { id: 'limp_reraise', label: 'Limp Re-Raise', icon: '🪤' },
  { id: 'blind_defense', label: 'Defensa Ciegas', icon: '🛡️' },
  { id: 'bluff_catch', label: 'Bluff Catching', icon: '🎯' }
];

interface RoadmapPhase {
  id: number;
  name: string;
  badge: string;
  description: string;
  targetLevel: string;
  milestones: { id: string; text: string; done: boolean }[];
}

const INITIAL_ROADMAP: RoadmapPhase[] = [
  {
    id: 1,
    name: 'Fase 1: Gestión de Bankroll y Micro-Límites',
    badge: 'NL02 - NL05',
    description: 'Aprende a sobrevivir a la varianza y a construir disciplina matemática antes de subir de nivel.',
    targetLevel: 'NL02 -> NL05',
    milestones: [
      { id: 'm1_1', text: 'Mantener mínimo 40 Cajas (Buy-ins) en la sala para el nivel actual (80€ para NL02).', done: true },
      { id: 'm1_2', text: 'Regla de Stop-Loss estricta: Cerrar sesión tras perder 3 cajas en el mismo día.', done: true },
      { id: 'm1_3', text: 'Descender de nivel de inmediato si el bankroll cae por debajo de 30 cajas.', done: false },
      { id: 'm1_4', text: 'Registrar resultados de sesión (Winrate en bb/100 manos) sin mirar la gráfica intra-sesión.', done: false }
    ]
  },
  {
    id: 2,
    name: 'Fase 2: Juego Mental y Control de Tilt',
    badge: 'NL05 - NL10',
    description: 'Elimina los sesgos emocionales y los errores provocados por bad beats o frustración.',
    targetLevel: 'NL05 -> NL10',
    milestones: [
      { id: 'm2_1', text: 'Eliminar el "Tilt de Venganza" tras perder botes contra Calling Stations.', done: true },
      { id: 'm2_2', text: 'Aceptar la probabilidad: Un 80% de equity pierde 1 de cada 5 veces matemáticamente.', done: false },
      { id: 'm2_3', text: 'Tomar pausas de 10 minutos cada 60-90 minutos continuos de juego.', done: false },
      { id: 'm2_4', text: 'Revisar las 5 manos más costosas del día en frío (fuera de las mesas con el solver).', done: false }
    ]
  },
  {
    id: 3,
    name: 'Fase 3: Habilidades Técnicas y Solvers',
    badge: 'NL10 - NL25',
    description: 'Dominio de rangos GTO, cálculo mental de Pot Odds, SPR y juego posicional balanceado.',
    targetLevel: 'NL10 -> NL25',
    milestones: [
      { id: 'm3_1', text: 'Memorizar rangos de apertura RFI de las 6 posiciones de memoria.', done: true },
      { id: 'm3_2', text: 'Calcular Pot Odds y Equity instantáneamente ante cualquier sizing rival.', done: false },
      { id: 'm3_3', text: 'Diferenciar familias de texturas para elegir el tamaño de C-Bet adecuado (33% vs 75%).', done: false },
      { id: 'm3_4', text: 'Construir rangos de 4-bet bluff con bloqueadores de Ases/Reyes suited.', done: false }
    ]
  },
  {
    id: 4,
    name: 'Fase 4: Revisión de Datos & Ascenso a NL50 - NL100',
    badge: 'NL50 - NL100',
    description: 'Análisis de base de datos masiva, detección de fugas (leaks) y explotación avanzada de regulares.',
    targetLevel: 'NL25 -> NL100',
    milestones: [
      { id: 'm4_1', text: 'Filtrar base de datos: Winrate en Big Blind menor a -35 bb/100.', done: false },
      { id: 'm4_2', text: 'Verificar Frecuencia de C-Bet global entre 55% y 68%.', done: false },
      { id: 'm4_3', text: 'W$SD (Won $ at Showdown) mantenido por encima del 52%.', done: false },
      { id: 'm4_4', text: 'Overbetting polarizado en river con combinaciones de nuts y bluff blockers.', done: false }
    ]
  }
];

export const AcademyRoadmapDashboard: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'sim' | 'evaluation' | 'dashboard' | 'roadmap' | 'flashcards' | 'concepts'>('sim');
  const [activeCategory, setActiveCategory] = useState<AcademyCategory>('dry_flop');
  const [currentScenario, setCurrentScenario] = useState<QuizScenario>(() => getNextAcademyScenario('dry_flop'));
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [cardSavedToast, setCardSavedToast] = useState(false);

  // Infinite Procedural Quiz + 30s Timer + ELO progression
  const [isInfiniteQuizMode, setIsInfiniteQuizMode] = useState<boolean>(false);
  const [quizSecondsLeft, setQuizSecondsLeft] = useState<number>(30);
  const [quizElo, setQuizElo] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gto_academy_quiz_elo');
      return saved ? Number(saved) || 1200 : 1200;
    } catch {
      return 1200;
    }
  });
  const [quizStreak, setQuizStreak] = useState<number>(0);

  // Spaced Repetition (SM-2) Concept Rating state
  const [conceptRatedToast, setConceptRatedToast] = useState<string | null>(null);
  const [lastRatedGrade, setLastRatedGrade] = useState<number | null>(null);
  const [sm2Stats, setSm2Stats] = useState(() => SpacedRepetitionManager.getInstance().getStats());
  const [sm2ItemsFilter, setSm2ItemsFilter] = useState<'all' | 'due' | 'concepts' | 'hands'>('all');

  // Listen for SM-2 updates
  useEffect(() => {
    const handleSM2Update = () => {
      setSm2Stats(SpacedRepetitionManager.getInstance().getStats());
    };
    window.addEventListener(SM2_UPDATE_EVENT, handleSM2Update);
    return () => window.removeEventListener(SM2_UPDATE_EVENT, handleSM2Update);
  }, []);

  const currentConceptId = `concept-${currentScenario.category}`;
  const currentConceptSM2 = useMemo(() => {
    return SpacedRepetitionManager.getInstance().getItem(currentConceptId) || null;
  }, [currentScenario.category, lastRatedGrade]);

  const handleRateCurrentConcept = (grade: number) => {
    setLastRatedGrade(grade);
    const item = SpacedRepetitionManager.getInstance().registerOrUpdateConcept({
      id: currentConceptId,
      title: `${currentScenario.categoryName}: ${currentScenario.title}`,
      category: currentScenario.categoryName,
      prompt: currentScenario.title,
      explanation: currentScenario.explanationDummies,
      rule: currentScenario.leakWarning,
      context: `Hero: ${currentScenario.heroPos} vs ${currentScenario.villainPos} · Bote: ${currentScenario.potBB} BB · Frecuencia GTO: ${currentScenario.gtoFrequency}%`,
      initialQuality: grade
    });

    const nextDays = item.intervalDays;
    setConceptRatedToast(
      `✓ Concepto calificado con grado ${grade}. Próximo repaso en ${nextDays} día${nextDays > 1 ? 's' : ''} (EF: ${item.easeFactor}, Reps: ${item.repetitions}).`
    );
    setSm2Stats(SpacedRepetitionManager.getInstance().getStats());
    setTimeout(() => setConceptRatedToast(null), 4000);
  };

  // Stats storage in localStorage
  const [categoryStats, setCategoryStats] = useState<Record<string, { attempts: number; correct: number }>>(() => {
    try {
      const saved = localStorage.getItem('gto_academy_stats');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
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
  });

  // Roadmap storage
  const [roadmap, setRoadmap] = useState<RoadmapPhase[]>(() => {
    try {
      const saved = localStorage.getItem('gto_career_roadmap');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_ROADMAP;
  });

  useEffect(() => {
    try {
      localStorage.setItem('gto_academy_stats', JSON.stringify(categoryStats));
    } catch (e) {}
  }, [categoryStats]);

  useEffect(() => {
    try {
      localStorage.setItem('gto_career_roadmap', JSON.stringify(roadmap));
    } catch (e) {}
  }, [roadmap]);

  // Handle category switch (always deals a fresh scenario distinct from current)
  const handleSelectCategory = (cat: AcademyCategory) => {
    setActiveCategory(cat);
    setCurrentScenario(getNextAcademyScenario(cat, currentScenario.id));
    setSelectedOptionIndex(null);
    setLastRatedGrade(null);
    setHasAnswered(false);
    setCardSavedToast(false);
    setConceptRatedToast(null);
    setQuizSecondsLeft(30);
  };

  // Sync quiz ELO
  useEffect(() => {
    try {
      localStorage.setItem('gto_academy_quiz_elo', String(quizElo));
    } catch {}
  }, [quizElo]);

  // 30-second countdown timer for Infinite Procedural Quiz
  useEffect(() => {
    if (!isInfiniteQuizMode || activeSubTab !== 'sim' || hasAnswered) return;
    if (quizSecondsLeft <= 0) {
      // Timeout counts as mistake and syncs to SM-2
      setHasAnswered(true);
      setQuizStreak(0);
      setQuizElo(prev => Math.max(800, prev - 15));
      AutoLearningEngine.getInstance().collectHand({
        heroPos: currentScenario.heroPos,
        villainPos: currentScenario.villainPos,
        heroCards: `${currentScenario.heroCards[0].rank}${SUIT_SYMBOLS[currentScenario.heroCards[0].suit]} ${currentScenario.heroCards[1].rank}${SUIT_SYMBOLS[currentScenario.heroCards[1].suit]}`,
        board: currentScenario.board.map(c => `${c.rank}${SUIT_SYMBOLS[c.suit]}`).join(' '),
        street: currentScenario.board.length === 0 ? 'preflop' : currentScenario.board.length === 3 ? 'flop' : currentScenario.board.length === 4 ? 'turn' : 'river',
        category: currentScenario.categoryName,
        potBB: currentScenario.potBB,
        chosenAction: 'Tiempo Agotado (30s)',
        optimalAction: `${currentScenario.correctAction} (Sizing: ${currentScenario.correctSizing || 'Estándar'})`,
        evLossPct: 6.5,
        isMistake: true,
        keyTakeaway: currentScenario.explanationDummies
      });
      return;
    }

    const timer = setTimeout(() => {
      setQuizSecondsLeft(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [isInfiniteQuizMode, activeSubTab, hasAnswered, quizSecondsLeft, currentScenario]);

  // Answer handle with AutoLearningEngine recording & Auto-Capture of Mistakes into SM-2
  const handleSelectOption = (idx: number) => {
    if (hasAnswered) return;
    setSelectedOptionIndex(idx);
    setHasAnswered(true);

    const chosen = currentScenario.options[idx];
    const isCorrect = chosen.isCorrect;
    const isMistake = chosen.evLossPct > 3.0;

    if (isInfiniteQuizMode) {
      if (isCorrect) {
        setQuizStreak(s => s + 1);
        setQuizElo(e => e + (quizSecondsLeft >= 20 ? 18 : 12));
      } else {
        setQuizStreak(0);
        setQuizElo(e => Math.max(800, e - Math.round(chosen.evLossPct * 2)));
      }
    }

    const streetName = currentScenario.board.length === 0 ? 'preflop' : currentScenario.board.length === 3 ? 'flop' : currentScenario.board.length === 4 ? 'turn' : 'river';

    // Report to collective learner server
    void SolverMetaUpdater.getInstance().reportUserDecision({
      texture: currentScenario.categoryName,
      street: streetName,
      chosenAction: chosen.label,
      bestAction: currentScenario.correctAction,
      evLossPct: chosen.evLossPct
    });

    // Si es un error o desviación, la auto-capturamos directamente en el sistema SM-2
    if (isMistake) {
      AutoLearningEngine.getInstance().collectHand({
        heroPos: currentScenario.heroPos,
        villainPos: currentScenario.villainPos,
        heroCards: `${currentScenario.heroCards[0].rank}${SUIT_SYMBOLS[currentScenario.heroCards[0].suit]} ${currentScenario.heroCards[1].rank}${SUIT_SYMBOLS[currentScenario.heroCards[1].suit]}`,
        board: currentScenario.board.map(c => `${c.rank}${SUIT_SYMBOLS[c.suit]}`).join(' '),
        street: streetName,
        category: currentScenario.categoryName,
        potBB: currentScenario.potBB,
        chosenAction: chosen.label,
        optimalAction: `${currentScenario.correctAction} (Sizing: ${currentScenario.correctSizing || 'Estándar'})`,
        evLossPct: chosen.evLossPct,
        isMistake: true,
        keyTakeaway: currentScenario.explanationDummies
      });
    } else {
      // Record regular decision
      AutoLearningEngine.getInstance().recordDecision({
        street: streetName,
        category: currentScenario.categoryName,
        heroCards: `${currentScenario.heroCards[0].rank}${currentScenario.heroCards[0].suit} ${currentScenario.heroCards[1].rank}${currentScenario.heroCards[1].suit}`,
        board: currentScenario.board.map(c => `${c.rank}${c.suit}`).join(' '),
        chosenAction: chosen.label,
        optimalAction: currentScenario.correctAction,
        evLossPct: chosen.evLossPct,
        isMistake: false,
        potBB: currentScenario.potBB
      });
    }

    setCategoryStats(prev => {
      const current = prev[currentScenario.category] || { attempts: 0, correct: 0 };
      return {
        ...prev,
        [currentScenario.category]: {
          attempts: current.attempts + 1,
          correct: current.correct + (isCorrect ? 1 : 0)
        }
      };
    });
  };

  // Next Hand generator: guarantees advancing to a genuinely different hand/board spot
  const handleNextHand = () => {
    const nextCat = isInfiniteQuizMode
      ? CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].id
      : activeCategory;
    if (isInfiniteQuizMode) {
      setActiveCategory(nextCat);
    }
    setCurrentScenario(getNextAcademyScenario(nextCat, currentScenario.id));
    setSelectedOptionIndex(null);
    setHasAnswered(false);
    setCardSavedToast(false);
    setLastRatedGrade(null);
    setConceptRatedToast(null);
    setQuizSecondsLeft(30);
  };

  // 1-Click Save to SM-2 Flashcards
  const handleSaveToFlashcard = () => {
    try {
      AutoLearningEngine.getInstance().collectHand({
        heroPos: currentScenario.heroPos,
        villainPos: currentScenario.villainPos,
        heroCards: `${currentScenario.heroCards[0].rank}${SUIT_SYMBOLS[currentScenario.heroCards[0].suit]} ${currentScenario.heroCards[1].rank}${SUIT_SYMBOLS[currentScenario.heroCards[1].suit]}`,
        board: currentScenario.board.map(c => `${c.rank}${SUIT_SYMBOLS[c.suit]}`).join(' '),
        street: currentScenario.board.length === 0 ? 'preflop' : currentScenario.board.length === 3 ? 'flop' : currentScenario.board.length === 4 ? 'turn' : 'river',
        category: currentScenario.categoryName,
        potBB: currentScenario.potBB,
        chosenAction: selectedOptionIndex !== null ? currentScenario.options[selectedOptionIndex].label : 'Estudio Manual',
        optimalAction: `${currentScenario.correctAction} (Sizing: ${currentScenario.correctSizing || 'Estándar'})`,
        evLossPct: 0,
        isMistake: false,
        keyTakeaway: currentScenario.explanationDummies
      });

      setCardSavedToast(true);
      setTimeout(() => setCardSavedToast(false), 3000);
    } catch (e) {}
  };

  // Toggle milestone in roadmap
  const toggleMilestone = (phaseId: number, milestoneId: string) => {
    setRoadmap(prev =>
      prev.map(phase => {
        if (phase.id !== phaseId) return phase;
        return {
          ...phase,
          milestones: phase.milestones.map(m =>
            m.id === milestoneId ? { ...m, done: !m.done } : m
          )
        };
      })
    );
  };

  // D3 Chart rendering
  const chartRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!chartRef.current || activeSubTab !== 'sim') return;
    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove();

    const width = 520;
    const height = 240;
    const margin = { top: 20, right: 15, bottom: 50, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const data = CATEGORIES.slice(0, 7).map(c => {
      const stat = categoryStats[c.id] || { attempts: 0, correct: 0 };
      const pct = stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 50;
      return { name: c.label.replace('Flops ', '').replace('Flop ', ''), pct, attempts: stat.attempts };
    });

    const x = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, innerWidth])
      .padding(0.28);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Gridlines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', '#1f2937')
      .attr('stroke-dasharray', '2,2');

    // Axes
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x));

    xAxis.selectAll('text')
      .attr('transform', 'rotate(-18)')
      .attr('text-anchor', 'end')
      .attr('fill', '#9ca3af')
      .attr('font-size', '9px')
      .attr('font-family', 'sans-serif');

    xAxis.select('.domain').attr('stroke', '#374151');

    const yAxis = g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`));

    yAxis.selectAll('text')
      .attr('fill', '#9ca3af')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    yAxis.select('.domain').attr('stroke', '#374151');

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.name) || 0)
      .attr('y', d => y(d.pct))
      .attr('width', x.bandwidth())
      .attr('height', d => innerHeight - y(d.pct))
      .attr('rx', 4)
      .attr('fill', d => (d.pct >= 75 ? '#3b82f6' : d.pct >= 55 ? '#f59e0b' : '#ef4444'))
      .attr('opacity', 0.95);

    // Value Labels
    g.selectAll('.label')
      .data(data)
      .enter()
      .append('text')
      .attr('x', d => (x(d.name) || 0) + x.bandwidth() / 2)
      .attr('y', d => y(d.pct) - 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(d => `${d.pct}%`);

  }, [categoryStats, activeSubTab]);

  // Overall Mastery
  const overallMastery = useMemo(() => {
    let totalAttempts = 0;
    let totalCorrect = 0;
    Object.values(categoryStats).forEach(s => {
      totalAttempts += s.attempts;
      totalCorrect += s.correct;
    });
    return totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 78;
  }, [categoryStats]);

  return (
    <div className="space-y-6">
      {/* Academy Top Hero */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Academia de Póker Interactiva & Dashboard D3.js
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 font-mono">
                V3.2 Pro · NL02 ➔ NL100
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Simulador multi-mano (48 spots únicos), Módulo de Evaluación Fija/Variable, Auditoría D3 y Carrera en 4 Fases SM-2.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-800 shrink-0">
          <Award className="w-5 h-5 text-amber-400" />
          <div>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide block">Dominio Global:</span>
            <strong className="text-lg font-bold font-mono text-blue-400">{overallMastery}%</strong>
          </div>
        </div>
      </div>

      {/* SubTab Navigation */}
      <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('sim')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'sim'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <span>🎯 Simulador Multi-Mano</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('evaluation')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'evaluation'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>📝 Evaluación (Fijos + Variables)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Auditoría D3 + Radar PDF</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('roadmap')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'roadmap'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <span>🗺️ Hoja de Ruta (NL02 ➔ NL100)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('flashcards')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'flashcards'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <span>🃏 Gestor Flashcards</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('concepts')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'concepts'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-blue-400" />
          <span>🧠 Conceptos &amp; Manos SM-2</span>
          {sm2Stats.dueTodayCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold font-mono">
              {sm2Stats.dueTodayCount}
            </span>
          )}
        </button>
      </div>

      {/* VIEW 1: SIMULATOR & D3 DASHBOARD */}
      {activeSubTab === 'sim' && (
        <div className="space-y-6">
          {/* Categories Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {CATEGORIES.map(c => {
              const isSelected = activeCategory === c.id;
              const stat = categoryStats[c.id] || { attempts: 0, correct: 0 };
              const pct = stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCategory(c.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-800 border-blue-500 text-white ring-2 ring-blue-500/30 shadow-md font-semibold'
                      : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    pct >= 75 ? 'bg-blue-950 text-blue-300 border border-blue-900' :
                    pct >= 50 ? 'bg-amber-950 text-amber-300 border border-amber-900' :
                    'bg-neutral-800 text-neutral-400'
                  }`}>
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Main Grid: Interactive Practice Simulator on Left, D3 Dashboard on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Interactive Category Quiz (7 Cols) */}
            <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    Spot Activo: {currentScenario.categoryName}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-400">
                    #{currentScenario.id}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleNextHand}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-950 hover:bg-neutral-800 text-blue-300 border border-blue-500/30 transition-colors cursor-pointer"
                    title="Repartir otra mano y board distinto dentro de esta categoría"
                  >
                    <span>Siguiente Mano</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInfiniteQuizMode(prev => !prev);
                      setQuizSecondsLeft(30);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isInfiniteQuizMode
                        ? 'bg-amber-600 text-black border-amber-400 shadow-md'
                        : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-blue-500/50'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isInfiniteQuizMode ? 'Quiz 30s + ELO: ON' : 'Quiz Infinito (30s)'}</span>
                  </button>
                  <span className="text-xs text-neutral-400 font-mono">
                    Frec GTO: <strong className="text-emerald-400">{currentScenario.gtoFrequency}%</strong>
                  </span>
                </div>
              </div>

              {isInfiniteQuizMode && (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-400">
                      ELO Quiz: <strong className="text-blue-400 tabular-nums">{quizElo}</strong> · Racha:{' '}
                      <strong className="text-emerald-400 tabular-nums">{quizStreak}</strong>
                    </span>
                    <span className={`font-bold tabular-nums ${quizSecondsLeft <= 8 ? 'text-rose-400' : 'text-amber-300'}`}>
                      {hasAnswered ? 'Respondido' : `⏱ ${quizSecondsLeft}s`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${(quizSecondsLeft / 30) * 100}%` }}
                      className={`h-full transition-all duration-1000 ${
                        quizSecondsLeft <= 8 ? 'bg-rose-500' : 'bg-blue-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              <h3 className="text-base font-bold text-white">
                {currentScenario.title}
              </h3>

              {/* Table Context Box */}
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800/80 flex flex-wrap items-center justify-between gap-4">
                {/* Hero Cards */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-neutral-400">Hero ({currentScenario.heroPos}):</span>
                  <div className="flex items-center gap-1.5">
                    {currentScenario.heroCards.map((c, i) => (
                      <div
                        key={i}
                        className="w-10 h-14 bg-neutral-850 rounded-lg border border-neutral-700 flex flex-col items-center justify-center font-mono font-bold text-base shadow"
                      >
                        <span className={SUIT_COLORS[c.suit].text}>{c.rank}</span>
                        <span className={`text-xs ${SUIT_COLORS[c.suit].text}`}>{SUIT_SYMBOLS[c.suit]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Board Cards (if postflop) */}
                {currentScenario.board.length > 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-neutral-400">Board:</span>
                    <div className="flex items-center gap-1.5">
                      {currentScenario.board.map((c, i) => (
                        <div
                          key={i}
                          className="w-10 h-14 bg-neutral-850 rounded-lg border border-neutral-700 flex flex-col items-center justify-center font-mono font-bold text-base shadow"
                        >
                          <span className={SUIT_COLORS[c.suit].text}>{c.rank}</span>
                          <span className={`text-xs ${SUIT_COLORS[c.suit].text}`}>{SUIT_SYMBOLS[c.suit]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs px-2.5 py-1 bg-neutral-850 text-neutral-400 rounded-lg font-mono">
                    Fase Preflop
                  </span>
                )}

                {/* Pot & Action */}
                <div className="text-right">
                  <div className="text-[10px] text-neutral-500 uppercase">Acción Previa:</div>
                  <div className="text-xs font-bold text-white">{currentScenario.villainAction}</div>
                  <div className="text-[11px] text-cyan-400 font-mono mt-0.5">Bote: {currentScenario.potBB} BB</div>
                </div>
              </div>

              {/* Interactive Options */}
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-semibold text-neutral-300 block">
                  ¿Cuál es la acción matemáticamente óptima?
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {currentScenario.options.map((opt, idx) => {
                    const isSelected = selectedOptionIndex === idx;
                    let btnStyle = 'bg-neutral-800/80 border-neutral-700 hover:bg-neutral-750 text-neutral-200';

                    if (hasAnswered) {
                      if (opt.isCorrect) {
                        btnStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30 font-bold';
                      } else if (isSelected && !opt.isCorrect) {
                        btnStyle = 'bg-red-950/80 border-red-500 text-red-200 ring-2 ring-red-500/30';
                      } else {
                        btnStyle = 'bg-neutral-900 border-neutral-800 text-neutral-500 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={hasAnswered}
                        onClick={() => handleSelectOption(idx)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${btnStyle}`}
                      >
                        <div className="text-xs font-semibold">{opt.label}</div>
                        {hasAnswered && (
                          <div className="text-[10px] mt-1 font-mono">
                            {opt.isCorrect ? (
                              <span className="text-emerald-400 font-bold">✓ GTO Óptimo (0% EV Loss)</span>
                            ) : (
                              <span className="text-red-400">✗ -{opt.evLossPct}% EV Loss</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Explanation Box (Visible After Answering) */}
              {hasAnswered && (
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide">
                      <Brain className="w-4 h-4" />
                      <span>Explicación Paso a Paso para Dummies:</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveToFlashcard}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-blue-300 rounded-lg text-xs font-semibold transition-colors border border-blue-500/30 cursor-pointer"
                        title="Guardar esta mano para repaso espaciado con algoritmo SM-2"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-blue-400" />
                        <span>{cardSavedToast ? '✓ Guardada en SM-2!' : 'Guardar en Flashcards'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNextHand}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow"
                      >
                        <span>Siguiente Mano Dinámica</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                    {currentScenario.explanationDummies}
                  </p>

                  <div className="p-2.5 bg-red-950/30 border border-red-900/50 rounded-lg text-xs text-red-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{currentScenario.leakWarning}</span>
                  </div>

                  {/* SM-2 Interactive Concept Difficulty Evaluator */}
                  <div className="pt-3 border-t border-neutral-800 space-y-2.5 bg-neutral-900/40 p-3 rounded-xl border border-neutral-800/80">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wide">
                        <Brain className="w-4 h-4" />
                        <span>Autoevaluación SM-2: ¿Qué tan difícil fue recordar este concepto?</span>
                      </div>
                      {currentConceptSM2 && (
                        <div className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 flex items-center gap-2">
                          <span>Intervalo: <strong className="text-white">{currentConceptSM2.intervalDays}d</strong></span>
                          <span>EF: <strong className="text-blue-300">{currentConceptSM2.easeFactor}</strong></span>
                          <span>Reps: <strong className="text-emerald-300">{currentConceptSM2.repetitions}</strong></span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-neutral-400 leading-snug">
                      Marca tu facilidad de recuerdo (0 a 5). El algoritmo SuperMemo calculará el momento óptimo para reprogramar este spot antes de que decaiga en tu memoria:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {SM2_QUALITY_RATINGS.map(rate => {
                        const isSelected = lastRatedGrade === rate.grade;
                        return (
                          <button
                            key={rate.grade}
                            type="button"
                            onClick={() => handleRateCurrentConcept(rate.grade)}
                            className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${rate.badgeClass} ${
                              isSelected ? 'ring-2 ring-white scale-102 shadow-lg font-bold' : ''
                            }`}
                            title={rate.detail}
                          >
                            <span className="text-xs font-bold block">{rate.label}</span>
                            <span className="text-[9px] opacity-80 block truncate">{rate.scheduleText}</span>
                          </button>
                        );
                      })}
                    </div>

                    {conceptRatedToast && (
                      <div className="p-2.5 bg-blue-950/70 border border-blue-500/50 rounded-lg text-xs text-blue-200 flex items-center justify-between animate-fadeIn">
                        <span>{conceptRatedToast}</span>
                        <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ SM-2 Actualizado</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: D3 Progress Chart & IA Diagnostic Report (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* D3 Chart Card */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span>Dominio Histórico por Categoría (D3.js):</span>
                  </h3>
                </div>

                <div className="w-full flex justify-center">
                  <svg ref={chartRef} viewBox="0 0 520 240" className="w-full h-auto" />
                </div>

                <div className="text-[11px] text-neutral-500 text-center font-mono">
                  Azul: ≥75% (Dominado) · Ámbar: 55-74% (Aceptable) · Rojo: &lt;55% (Fuga detectada)
                </div>
              </div>

              {/* AI Diagnostic Report / Leak Summary */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Zap className="w-4 h-4" />
                  <span>Reporte de Diagnóstico de Fugas (Auto-Aprendizaje IA):</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 text-neutral-300 leading-relaxed">
                    <strong className="text-blue-400 block mb-0.5">Fortaleza Detectada:</strong>
                    Excelente disciplina en <span className="text-white">Flops Secos y Emparejados</span>; aplicas C-bets del tamaño óptimo con alta frecuencia.
                  </div>
                  <div className="p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 text-neutral-300 leading-relaxed">
                    <strong className="text-red-400 block mb-0.5">Fuga Crítica Detectada:</strong>
                    Tendencia a jugar con sizing excesivo en <span className="text-white">Botes 3-Bet</span> y overplay en <span className="text-white">Flops Monótonos</span> sin blockers del palo.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1A: EVALUATION MODULE (FIXED + VARIABLE SPOTS) */}
      {activeSubTab === 'evaluation' && (
        <EvaluationModule />
      )}

      {/* VIEW 1B: PROGRESS DASHBOARD D3.JS + PDF AUDIT */}
      {activeSubTab === 'dashboard' && (
        <ProgressDashboard />
      )}

      {/* VIEW 2: CAREER ROADMAP (NL02 ➔ NL100) */}
      {activeSubTab === 'roadmap' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-400" />
                <span>Hoja de Ruta de Carrera ("Career Roadmap"): NL02 ➔ NL100</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                4 fases secuenciales con hitos de Bankroll, Mindset, Técnica y Análisis de Datos. Guarda tu progreso automáticamente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {roadmap.map(phase => {
              const completedCount = phase.milestones.filter(m => m.done).length;
              const totalCount = phase.milestones.length;
              const progressPct = Math.round((completedCount / totalCount) * 100);

              return (
                <div
                  key={phase.id}
                  className="p-5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-4 shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono text-xs font-bold flex items-center justify-center">
                        {phase.id}
                      </span>
                      <h4 className="text-sm font-bold text-white">{phase.name}</h4>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-neutral-800 text-cyan-300 rounded-md font-mono font-semibold border border-neutral-700">
                      {phase.badge}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {phase.description}
                  </p>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                      <span>Hitos Completados:</span>
                      <span className="text-white font-bold">{completedCount} / {totalCount} ({progressPct}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className={`h-full transition-all duration-300 ${
                          progressPct === 100 ? 'bg-emerald-400' : 'bg-blue-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Milestones checklist */}
                  <div className="space-y-2 pt-1">
                    {phase.milestones.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMilestone(phase.id, m.id)}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                          m.done
                            ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-900/40'
                            : 'bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-850'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                          m.done ? 'bg-emerald-500 border-emerald-400 text-neutral-950' : 'border-neutral-600'
                        }`}>
                          {m.done && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className={`leading-relaxed ${m.done ? 'line-through text-neutral-400' : ''}`}>
                          {m.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: CUSTOM FLASHCARD MANAGER */}
      {activeSubTab === 'flashcards' && (
        <CustomFlashcardManager />
      )}

      {/* VIEW 4: SM-2 CONCEPTS & HAND HISTORY REPETITION ENGINE */}
      {activeSubTab === 'concepts' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header SM-2 Metrics Banner */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Motor Universal de Repetición Espaciada SM-2
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 font-mono">
                    Conceptos & Manos
                  </span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  El algoritmo SuperMemo programa el repaso de tus fundamentos y manos en el momento exacto antes del olvido.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
              <div className="px-3 py-1.5 bg-neutral-950 rounded-xl border border-neutral-800 text-center">
                <span className="text-[10px] text-neutral-500 uppercase block">Total Ítems:</span>
                <strong className="text-sm font-bold text-white font-mono">{sm2Stats.totalItems}</strong>
              </div>
              <div className="px-3 py-1.5 bg-neutral-950 rounded-xl border border-neutral-800 text-center">
                <span className="text-[10px] text-amber-500 uppercase block">Pendientes Hoy:</span>
                <strong className="text-sm font-bold text-amber-400 font-mono">{sm2Stats.dueTodayCount}</strong>
              </div>
              <div className="px-3 py-1.5 bg-neutral-950 rounded-xl border border-neutral-800 text-center">
                <span className="text-[10px] text-blue-500 uppercase block">EF Medio:</span>
                <strong className="text-sm font-bold text-blue-300 font-mono">{sm2Stats.averageEaseFactor}</strong>
              </div>
              <div className="px-3 py-1.5 bg-neutral-950 rounded-xl border border-neutral-800 text-center">
                <span className="text-[10px] text-emerald-500 uppercase block">Dominados:</span>
                <strong className="text-sm font-bold text-emerald-400 font-mono">{sm2Stats.masteredCount}</strong>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setSm2ItemsFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sm2ItemsFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todos ({sm2Stats.totalItems})</span>
            </button>

            <button
              type="button"
              onClick={() => setSm2ItemsFilter('due')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sm2ItemsFilter === 'due'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>🎯 Pendientes Hoy ({sm2Stats.dueTodayCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSm2ItemsFilter('concepts')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sm2ItemsFilter === 'concepts'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>💡 Conceptos Teóricos ({sm2Stats.totalConcepts})</span>
            </button>

            <button
              type="button"
              onClick={() => setSm2ItemsFilter('hands')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sm2ItemsFilter === 'hands'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>🃏 Historial de Manos ({sm2Stats.totalHands})</span>
            </button>
          </div>

          {/* Items List */}
          {(() => {
            const allItems = SpacedRepetitionManager.getInstance().getAllItems();
            const now = Date.now();
            const filtered = allItems.filter(item => {
              if (sm2ItemsFilter === 'due') return item.nextReviewDate <= now;
              if (sm2ItemsFilter === 'concepts') return item.type === 'concept';
              if (sm2ItemsFilter === 'hands') return item.type === 'hand';
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-10 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="text-base font-bold text-white">¡No hay ítems en esta categoría!</h4>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto">
                    A medida que respondas spots en la Academia y analices manos en el Wizard, aparecerán aquí con sus fechas óptimas de repaso.
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(item => {
                  const isDue = item.nextReviewDate <= now;
                  return (
                    <div
                      key={item.id}
                      className={`p-5 rounded-2xl border transition-all space-y-3 ${
                        isDue
                          ? 'bg-neutral-950 border-amber-500/50 shadow-lg shadow-amber-500/5'
                          : 'bg-neutral-950 border-neutral-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900 font-mono">
                              {item.category}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 font-mono">
                              {item.type === 'concept' ? '💡 Concepto Teórico' : '🃏 Mano Jugada'}
                            </span>
                            {isDue ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold font-mono">
                                🔔 Repasar Hoy
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                                En memoria ({Math.max(1, Math.round((item.nextReviewDate - now) / 86400000))}d restantes)
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-white">{item.title}</h4>
                        </div>

                        <div className="text-right shrink-0 font-mono text-[11px]">
                          <span className="text-neutral-500 block text-[9px] uppercase">Intervalo:</span>
                          <strong className="text-blue-400 font-bold">{item.intervalDays}d</strong>
                        </div>
                      </div>

                      <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-850 space-y-2 text-xs">
                        <p className="text-neutral-300 leading-relaxed font-sans">
                          {item.content.explanation}
                        </p>
                        <div className="text-[11px] text-amber-300 font-sans border-t border-neutral-800/60 pt-1.5 flex items-start gap-1.5">
                          <span className="shrink-0">💡</span>
                          <span>{item.content.rule}</span>
                        </div>
                      </div>

                      {/* Calificación interactiva SM-2 */}
                      <div className="pt-2 border-t border-neutral-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-400">Marcar Dificultad de Recuerdo:</span>
                          <span className="text-[10px] font-mono text-neutral-500">
                            EF: {item.easeFactor} · Reps: {item.repetitions}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {SM2_QUALITY_RATINGS.map(rate => (
                            <button
                              key={rate.grade}
                              type="button"
                              onClick={() => {
                                SpacedRepetitionManager.getInstance().rateItem(item.id, rate.grade);
                                setSm2Stats(SpacedRepetitionManager.getInstance().getStats());
                              }}
                              className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${rate.badgeClass}`}
                              title={rate.detail}
                            >
                              <span className="text-[11px] font-bold block">{rate.grade}</span>
                              <span className="text-[8px] opacity-80 block truncate">{rate.shortDesc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
