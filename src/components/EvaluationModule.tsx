/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * EvaluationModule: Centro Educativo Personalizado por Niveles (NL2 -> NL100),
 * Banco de 720+ Preguntas Sin Repetición (240+ por cada tipo) y Resultados Visuales "Para Dummies".
 */

import React, { useState, useMemo } from 'react';
import {
  EDUCATIONAL_LEVELS,
  generateNonRepeatingExam,
  getBankCountsByMode,
  loadSeenQuestionIds,
  markQuestionIdsSeen,
  resetSeenQuestionIds,
  type DifficultyLevel,
  type EvaluationFilters,
  type EvaluationMode,
  type EvaluationQuestion
} from '../engine/evaluationBank';
import { Card, SUIT_COLORS, SUIT_SYMBOLS } from '../engine/cards';
import { AutoLearningEngine } from '../engine/autoLearningEngine';
import { SolverMetaUpdater } from '../engine/solverMetaUpdater';
import {
  ClipboardCheck,
  SlidersHorizontal,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Award,
  AlertTriangle,
  GraduationCap,
  TrendingUp,
  Target,
  Brain,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Lock,
  Layers
} from 'lucide-react';

export interface SavedEvaluationSummary {
  lastMode: string;
  lastScorePct: number;
  bestScorePct: number;
  examsTaken: number;
  passedCount: number;
  currentLevel: DifficultyLevel;
  unlockedLevel: DifficultyLevel;
  xp: number;
  weakestCategory: string;
  strongestCategory: string;
  categoryPerf: Record<string, { attempts: number; correct: number }>;
  lastUpdatedAt: number;
}

export const EVAL_STATS_STORAGE_KEY = 'lab_studio_eval_stats';

export function loadEvaluationStats(): SavedEvaluationSummary {
  try {
    const raw = localStorage.getItem(EVAL_STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedEvaluationSummary>;
      return {
        lastMode: typeof parsed.lastMode === 'string' ? parsed.lastMode : 'fixed',
        lastScorePct: typeof parsed.lastScorePct === 'number' ? parsed.lastScorePct : 0,
        bestScorePct: typeof parsed.bestScorePct === 'number' ? parsed.bestScorePct : 0,
        examsTaken: typeof parsed.examsTaken === 'number' ? parsed.examsTaken : 0,
        passedCount: typeof parsed.passedCount === 'number' ? parsed.passedCount : 0,
        currentLevel: parsed.currentLevel && [1, 2, 3, 4].includes(parsed.currentLevel) ? parsed.currentLevel : 1,
        unlockedLevel: parsed.unlockedLevel && [1, 2, 3, 4].includes(parsed.unlockedLevel) ? parsed.unlockedLevel : 1,
        xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
        weakestCategory: typeof parsed.weakestCategory === 'string' ? parsed.weakestCategory : 'Sin datos aún',
        strongestCategory: typeof parsed.strongestCategory === 'string' ? parsed.strongestCategory : 'Sin datos aún',
        categoryPerf: parsed.categoryPerf && typeof parsed.categoryPerf === 'object' ? parsed.categoryPerf : {},
        lastUpdatedAt: typeof parsed.lastUpdatedAt === 'number' ? parsed.lastUpdatedAt : Date.now()
      };
    }
  } catch {
    // ignore
  }
  return {
    lastMode: 'fixed',
    lastScorePct: 0,
    bestScorePct: 0,
    examsTaken: 0,
    passedCount: 0,
    currentLevel: 1,
    unlockedLevel: 1,
    xp: 0,
    weakestCategory: 'Sin datos aún',
    strongestCategory: 'Sin datos aún',
    categoryPerf: {},
    lastUpdatedAt: Date.now()
  };
}

interface AnswerRecord {
  question: EvaluationQuestion;
  chosenIdx: number;
  isCorrect: boolean;
  evLossPct: number;
}

const CardChip: React.FC<{ card: Card; size?: 'sm' | 'md' }> = ({ card, size = 'md' }) => {
  const dims = size === 'sm' ? 'w-9 h-12 text-sm' : 'w-11 h-15 text-base';
  return (
    <div
      className={`${dims} bg-neutral-950 rounded-lg border border-neutral-700 flex flex-col items-center justify-center font-mono font-bold shadow`}
    >
      <span className={SUIT_COLORS[card.suit].text}>{card.rank}</span>
      <span className={`text-xs ${SUIT_COLORS[card.suit].text}`}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
};

export const EvaluationModule: React.FC = () => {
  const bankCounts = useMemo(() => getBankCountsByMode(), []);
  const [evalStats, setEvalStats] = useState<SavedEvaluationSummary>(() => loadEvaluationStats());
  const [seenStore, setSeenStore] = useState(() => loadSeenQuestionIds());

  const [evalMode, setEvalMode] = useState<EvaluationMode>('levels');
  const [selectedLevel, setSelectedLevel] = useState<DifficultyLevel>(() => loadEvaluationStats().currentLevel);
  const [filters, setFilters] = useState<EvaluationFilters>({
    potType: 'all',
    texture: 'all',
    opponent: 'all',
    level: 'all',
    questionCount: 8
  });

  const [examQuestions, setExamQuestions] = useState<EvaluationQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [isExamActive, setIsExamActive] = useState(false);
  const [isExamFinished, setIsExamFinished] = useState(false);
  const [justLeveledUpTo, setJustLeveledUpTo] = useState<DifficultyLevel | null>(null);
  const [cycleNotice, setCycleNotice] = useState<string | null>(null);

  const activeLevelDef = useMemo(
    () => EDUCATIONAL_LEVELS.find(l => l.level === evalStats.currentLevel) || EDUCATIONAL_LEVELS[0],
    [evalStats.currentLevel]
  );

  const nextLevelDef = useMemo(
    () => EDUCATIONAL_LEVELS.find(l => l.level === evalStats.currentLevel + 1) || null,
    [evalStats.currentLevel]
  );

  const personalizedRecommendation = useMemo(() => {
    const entries = Object.entries(evalStats.categoryPerf) as Array<[string, { attempts: number; correct: number }]>;
    if (entries.length === 0) {
      return {
        headline: 'Completa tu primera evaluación diagnóstica para crear tu ruta personalizada.',
        focusTip: 'Empieza por "Evaluación por Niveles (Nivel 1)" para medir tus cimientos en NL2–NL5.'
      };
    }
    const weak = evalStats.weakestCategory;
    return {
      headline: `Tu área con mayor margen de mejora hoy es "${weak}".`,
      focusTip: `Practica 8 manos personalizadas filtrando "${weak}" y repasa tus fallos guardados en la cola SM-2 antes de intentar el siguiente nivel.`
    };
  }, [evalStats]);

  const startExam = (overrideMode?: EvaluationMode, overrideLevel?: DifficultyLevel) => {
    const modeToUse = overrideMode ?? evalMode;
    const levelToUse = overrideLevel ?? selectedLevel;
    const result = generateNonRepeatingExam(modeToUse, levelToUse, filters);
    const updatedSeen = markQuestionIdsSeen(
      modeToUse,
      result.questions.map(q => q.id)
    );
    setSeenStore(updatedSeen);
    setExamQuestions(result.questions);
    setCurrentIdx(0);
    setAnswers([]);
    setJustLeveledUpTo(null);
    setCycleNotice(
      result.cycleResetOccurred
        ? 'Completaste todas las preguntas nuevas de este modo; reiniciamos la baraja para una nueva ronda sin repeticiones.'
        : null
    );
    setIsExamActive(true);
    setIsExamFinished(false);
  };

  const handleResetSeenForMode = (mode: EvaluationMode) => {
    const updated = resetSeenQuestionIds(mode);
    setSeenStore(updated);
  };

  const handleAnswer = (optIdx: number) => {
    const question = examQuestions[currentIdx];
    if (!question) return;
    const chosen = question.options[optIdx];
    const isCorrect = chosen.isCorrect;

    const street =
      question.board.length === 0
        ? 'preflop'
        : question.board.length === 3
        ? 'flop'
        : question.board.length === 4
        ? 'turn'
        : 'river';

    // Sync decision with AutoLearning & Community Learner
    void SolverMetaUpdater.getInstance().reportUserDecision({
      texture: question.categoryName,
      street,
      chosenAction: chosen.label,
      bestAction: question.correctAction,
      evLossPct: chosen.evLossPct
    });

    if (!isCorrect) {
      AutoLearningEngine.getInstance().collectHand({
        heroPos: question.heroPos,
        villainPos: question.villainPos,
        heroCards: `${question.heroCards[0].rank}${SUIT_SYMBOLS[question.heroCards[0].suit]} ${question.heroCards[1].rank}${SUIT_SYMBOLS[question.heroCards[1].suit]}`,
        board: question.board.map(b => `${b.rank}${SUIT_SYMBOLS[b.suit]}`).join(' '),
        street,
        category: `${question.levelLabel} · ${question.categoryName}`,
        potBB: question.potBB,
        chosenAction: chosen.label,
        optimalAction: question.correctAction,
        evLossPct: chosen.evLossPct,
        isMistake: true,
        keyTakeaway: `${question.explanationDummies} | Consejo: ${question.dummiesTip}`
      });
    } else {
      AutoLearningEngine.getInstance().recordDecision({
        street,
        category: question.categoryName,
        chosenAction: chosen.label,
        optimalAction: question.correctAction,
        evLossPct: 0,
        isMistake: false,
        potBB: question.potBB
      });
    }

    const nextAnswers = [...answers, { question, chosenIdx: optIdx, isCorrect, evLossPct: chosen.evLossPct }];
    setAnswers(nextAnswers);

    if (currentIdx + 1 < examQuestions.length) {
      setCurrentIdx(currentIdx + 1);
      return;
    }

    // Exam finished: update XP, Level progression, category weaknesses, and persist
    const correctCount = nextAnswers.filter(a => a.isCorrect).length;
    const scorePct = Math.round((correctCount / Math.max(1, nextAnswers.length)) * 100);
    const levelReq =
      evalMode === 'levels'
        ? EDUCATIONAL_LEVELS.find(l => l.level === selectedLevel)?.passScorePct || 75
        : 75;
    const passed = scorePct >= levelReq;

    const updatedPerf: Record<string, { attempts: number; correct: number }> = { ...evalStats.categoryPerf };
    for (const ans of nextAnswers) {
      const key = ans.question.categoryName;
      const prev = updatedPerf[key] || { attempts: 0, correct: 0 };
      updatedPerf[key] = {
        attempts: prev.attempts + 1,
        correct: prev.correct + (ans.isCorrect ? 1 : 0)
      };
    }

    const perfList = Object.entries(updatedPerf)
      .filter(([, v]) => v.attempts > 0)
      .map(([name, v]) => ({ name, pct: Math.round((v.correct / v.attempts) * 100) }))
      .sort((a, b) => a.pct - b.pct);

    const weakestCategory = perfList[0]?.name || evalStats.weakestCategory;
    const strongestCategory = perfList[perfList.length - 1]?.name || evalStats.strongestCategory;

    const xpEarned = correctCount * 15 + (passed ? 50 : 15);
    const nextXp = evalStats.xp + xpEarned;

    let nextUnlockedLevel = evalStats.unlockedLevel;
    let nextCurrentLevel = evalStats.currentLevel;
    let promotedTo: DifficultyLevel | null = null;

    if (passed && evalMode === 'levels' && selectedLevel === evalStats.unlockedLevel && evalStats.unlockedLevel < 4) {
      nextUnlockedLevel = (evalStats.unlockedLevel + 1) as DifficultyLevel;
      nextCurrentLevel = nextUnlockedLevel;
      promotedTo = nextUnlockedLevel;
    } else if (nextXp >= 900 && nextUnlockedLevel < 4) {
      nextUnlockedLevel = 4;
      nextCurrentLevel = 4;
      promotedTo = 4;
    } else if (nextXp >= 500 && nextUnlockedLevel < 3) {
      nextUnlockedLevel = 3;
      nextCurrentLevel = 3;
      promotedTo = 3;
    } else if (nextXp >= 200 && nextUnlockedLevel < 2) {
      nextUnlockedLevel = 2;
      nextCurrentLevel = 2;
      promotedTo = 2;
    }

    if (promotedTo) {
      setJustLeveledUpTo(promotedTo);
      setSelectedLevel(promotedTo);
    }

    const updatedStats: SavedEvaluationSummary = {
      lastMode: evalMode,
      lastScorePct: scorePct,
      bestScorePct: Math.max(evalStats.bestScorePct, scorePct),
      examsTaken: evalStats.examsTaken + 1,
      passedCount: evalStats.passedCount + (passed ? 1 : 0),
      currentLevel: nextCurrentLevel,
      unlockedLevel: nextUnlockedLevel,
      xp: nextXp,
      weakestCategory,
      strongestCategory,
      categoryPerf: updatedPerf,
      lastUpdatedAt: Date.now()
    };

    setEvalStats(updatedStats);
    try {
      localStorage.setItem(EVAL_STATS_STORAGE_KEY, JSON.stringify(updatedStats));
      window.dispatchEvent(new Event('storage'));
    } catch {
      // ignore
    }

    setIsExamFinished(true);
    setIsExamActive(false);
  };

  const currentQuestion = examQuestions[currentIdx];

  return (
    <div className="space-y-6">
      {/* Centro Educativo Personalizado Header */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white">
                  Centro Educativo Personalizado &amp; Evaluaciones GTO
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/40">
                  {bankCounts.total} Preguntas Únicas Sin Repetición
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
                Avanza desde Nivel 1 (Micro-Límites) hasta Nivel 4 (High-Stakes) según tus resultados. Cada modalidad
                cuenta con más de 240 escenarios curados sin repeticiones al volver a evaluarte.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 text-center text-xs font-mono">
            <div className="px-3 py-2 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-500 block">Tu Nivel</span>
              <strong className="text-blue-400 text-sm tabular-nums">Nivel {evalStats.currentLevel}/4</strong>
            </div>
            <div className="px-3 py-2 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-500 block">Experiencia</span>
              <strong className="text-amber-300 text-sm tabular-nums">{evalStats.xp} XP</strong>
            </div>
            <div className="px-3 py-2 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-500 block">Mejor Nota</span>
              <strong className="text-emerald-400 text-sm tabular-nums">{evalStats.bestScorePct}%</strong>
            </div>
            <div className="px-3 py-2 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-500 block">Aprobados</span>
              <strong className="text-white text-sm tabular-nums">
                {evalStats.passedCount}/{evalStats.examsTaken}
              </strong>
            </div>
          </div>
        </div>

        {/* Personalized Diagnosis Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2 border-t border-neutral-800/80">
          <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
            <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
              <TrendingUp className="w-3.5 h-3.5" /> Fortaleza Actual
            </div>
            <div className="font-bold text-white">{evalStats.strongestCategory}</div>
            <div className="text-[11px] text-neutral-400">
              Rango actual: {activeLevelDef.name} ({activeLevelDef.stakes})
            </div>
          </div>

          <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
            <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Target className="w-3.5 h-3.5" /> Prioridad de Entrenamiento
            </div>
            <div className="font-bold text-white">{evalStats.weakestCategory}</div>
            <div className="text-[11px] text-neutral-400">{personalizedRecommendation.focusTip}</div>
          </div>

          <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Progreso de Nivel
              </span>
              <span className="font-mono text-neutral-300">
                {nextLevelDef ? `${evalStats.xp} / ${nextLevelDef.xpRequired} XP` : 'Nivel Máximo'}
              </span>
            </div>
            <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
              <div
                style={{
                  width: `${
                    nextLevelDef
                      ? Math.min(100, Math.round((evalStats.xp / nextLevelDef.xpRequired) * 100))
                      : 100
                  }%`
                }}
                className="h-full bg-blue-500 transition-all duration-300"
              />
            </div>
            <div className="text-[11px] text-neutral-400">
              {nextLevelDef
                ? `Aprueba Nivel ${evalStats.currentLevel} con ≥${activeLevelDef.passScorePct}% para desbloquear ${nextLevelDef.name}.`
                : 'Has desbloqueado los 4 niveles completos del Centro Educativo.'}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Configurator & 4-Level Ladder (visible when not taking an active exam) */}
      {!isExamActive && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setEvalMode('levels')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer space-y-2 ${
                evalMode === 'levels'
                  ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/40'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">1. Evaluación por Niveles</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-blue-300">
                  {bankCounts.levels} preguntas
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Evaluación progresiva del Nivel 1 al 4. Sube de nivel automáticamente al aprobar cada etapa (≥75%).
              </p>
              <div className="text-[10px] font-mono text-neutral-500">
                Vistas sin repetir: {seenStore.levels.length} / {bankCounts.levels}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEvalMode('fixed')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer space-y-2 ${
                evalMode === 'fixed'
                  ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/40'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">2. Temas Fijos Troncales</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-emerald-300">
                  {bankCounts.fixed} preguntas
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Exámenes rotativos sin repetición sobre todos los pilares fijos: RFI, Ciegas, Squeeze, ROL, Texturas y
                River.
              </p>
              <div className="text-[10px] font-mono text-neutral-500">
                Vistas sin repetir: {seenStore.fixed.length} / {bankCounts.fixed}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEvalMode('variable')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer space-y-2 ${
                evalMode === 'variable'
                  ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/40'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">3. Spot Personalizable</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-amber-300">
                  {bankCounts.variable} preguntas
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Filtra exactamente por Bote, Textura, Rival y Nivel desde nuestra base completa sin repetir preguntas.
              </p>
              <div className="text-[10px] font-mono text-neutral-500">
                Vistas sin repetir: {seenStore.variable.length} / {bankCounts.variable}
              </div>
            </button>
          </div>

          {/* Level Selector Ladder when in 'levels' mode */}
          {evalMode === 'levels' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Escalera de Niveles de Aprendizaje
                </span>
                <button
                  type="button"
                  onClick={() => handleResetSeenForMode('levels')}
                  className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Reiniciar historial visto
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {EDUCATIONAL_LEVELS.map(lvl => {
                  const isUnlocked = lvl.level <= evalStats.unlockedLevel;
                  const isSelected = selectedLevel === lvl.level;
                  return (
                    <button
                      key={lvl.level}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => setSelectedLevel(lvl.level)}
                      className={`p-3.5 rounded-xl border text-left transition-all space-y-1.5 ${
                        !isUnlocked
                          ? 'bg-neutral-950 border-neutral-900 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-neutral-900 border-blue-500 ring-1 ring-blue-500/40 cursor-pointer'
                          : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold text-blue-400">{lvl.stakes}</span>
                        {isUnlocked ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {lvl.badge}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-500 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Bloqueado
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-white">{lvl.name}</div>
                      <p className="text-[11px] text-neutral-400 leading-snug">{lvl.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fixed Mode Options */}
          {evalMode === 'fixed' && (
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <div className="font-bold text-white">Banco Troncal Rotativo ({bankCounts.fixed} spots únicos)</div>
                <p className="text-neutral-400 mt-0.5">
                  Cada repetición entrega preguntas completamente nuevas y distintas hasta completar las {bankCounts.fixed}.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  aria-label="Longitud evaluación fija"
                  value={filters.questionCount}
                  onChange={(e) =>
                    setFilters(prev => ({ ...prev, questionCount: Number(e.target.value) as 5 | 8 | 12 }))
                  }
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none"
                >
                  <option value={5}>5 Preguntas</option>
                  <option value={8}>8 Preguntas</option>
                  <option value={12}>12 Preguntas</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleResetSeenForMode('fixed')}
                  className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset Ciclo
                </button>
              </div>
            </div>
          )}

          {/* Variable Spot Filters */}
          {evalMode === 'variable' && (
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Personaliza Variables de Spot (Base Sin Repetición)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetSeenForMode('variable')}
                  className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Reset Historial Spot
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="text-neutral-400 block mb-1">Tipo de Bote</label>
                  <select
                    value={filters.potType}
                    onChange={(e) =>
                      setFilters(prev => ({ ...prev, potType: e.target.value as EvaluationFilters['potType'] }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Todos los Botes</option>
                    <option value="srp">Single Raised Pot (SRP)</option>
                    <option value="3bet">Bote 3-Bet</option>
                    <option value="squeeze">Squeeze Pot</option>
                    <option value="4bet">Bote 4-Bet</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Textura del Board</label>
                  <select
                    value={filters.texture}
                    onChange={(e) =>
                      setFilters(prev => ({ ...prev, texture: e.target.value as EvaluationFilters['texture'] }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Todas las Texturas</option>
                    <option value="dry">Flop Seco (Dry)</option>
                    <option value="wet">Flop Coordinado (Wet)</option>
                    <option value="monotone">Flop Monótono</option>
                    <option value="paired">Flop Emparejado</option>
                    <option value="preflop">Preflop (Sin Board)</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Perfil de Oponente</label>
                  <select
                    value={filters.opponent}
                    onChange={(e) =>
                      setFilters(prev => ({ ...prev, opponent: e.target.value as EvaluationFilters['opponent'] }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Mixto (Todos)</option>
                    <option value="regular">Regular (GTO)</option>
                    <option value="nit">Nit Pasivo</option>
                    <option value="fish">Calling Station (Fish)</option>
                    <option value="lag">LAG Agresivo</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Nivel</label>
                  <select
                    value={filters.level}
                    onChange={(e) =>
                      setFilters(prev => ({
                        ...prev,
                        level: e.target.value === 'all' ? 'all' : (Number(e.target.value) as DifficultyLevel)
                      }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Todos los Niveles (1-4)</option>
                    <option value={1}>Nivel 1 (NL2-NL5)</option>
                    <option value={2}>Nivel 2 (NL10-NL25)</option>
                    <option value={3}>Nivel 3 (NL50)</option>
                    <option value={4}>Nivel 4 (NL100+)</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Longitud</label>
                  <select
                    value={filters.questionCount}
                    onChange={(e) =>
                      setFilters(prev => ({ ...prev, questionCount: Number(e.target.value) as 5 | 8 | 12 }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none"
                  >
                    <option value={5}>5 Preguntas</option>
                    <option value={8}>8 Preguntas</option>
                    <option value={12}>12 Preguntas</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-neutral-400 font-mono">
              {evalMode === 'levels'
                ? `Evaluación Seleccionada: Nivel ${selectedLevel} (8 preguntas inéditas)`
                : evalMode === 'fixed'
                ? `Evaluación Seleccionada: Temas Fijos (${filters.questionCount} preguntas inéditas)`
                : `Evaluación Personalizada: ${filters.questionCount} spots únicos filtrados`}
            </div>
            <button
              type="button"
              onClick={() => startExam()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isExamFinished ? 'Repetir con Preguntas Nuevas' : 'Comenzar Evaluación'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Exam Runner */}
      {isExamActive && currentQuestion && (
        <div className="bg-neutral-950 border border-blue-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3 text-xs font-mono">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-blue-400 font-bold">
                Pregunta {currentIdx + 1} / {examQuestions.length}
              </span>
              <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                Nivel {currentQuestion.level} · {currentQuestion.streetLabel}
              </span>
              <span className="text-neutral-500">ID #{currentQuestion.id}</span>
            </div>
            <span className="text-neutral-400">
              Rival: <strong className="text-white uppercase">{currentQuestion.opponentProfile || 'regular'}</strong> · Bote:{' '}
              <strong className="text-emerald-400">{currentQuestion.potBB} BB</strong>
            </span>
          </div>

          {cycleNotice && currentIdx === 0 && (
            <div className="p-2.5 bg-blue-950/40 border border-blue-800 rounded-lg text-[11px] text-blue-200">
              {cycleNotice}
            </div>
          )}

          {/* Question Progress Bar */}
          <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.round(((currentIdx + 1) / examQuestions.length) * 100)}%` }}
              className="h-full bg-blue-500 transition-all duration-300"
            />
          </div>

          <div>
            <div className="text-[11px] font-mono text-amber-300 mb-1">{currentQuestion.conceptTag}</div>
            <h4 className="text-base font-bold text-white">{currentQuestion.title}</h4>
          </div>

          <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400 font-semibold">Hero ({currentQuestion.heroPos}):</span>
              <div className="flex items-center gap-1.5">
                {currentQuestion.heroCards.map((card, i) => (
                  <CardChip key={i} card={card} />
                ))}
              </div>
            </div>

            {currentQuestion.board.length > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-400 font-semibold">Board ({currentQuestion.streetLabel}):</span>
                <div className="flex items-center gap-1.5">
                  {currentQuestion.board.map((card, i) => (
                    <CardChip key={i} card={card} />
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-xs px-3 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-400 font-mono">
                Acción Preflop (Sin Board)
              </span>
            )}

            <div className="text-right text-xs">
              <div className="text-neutral-500">Situación en la Mesa</div>
              <div className="text-white font-semibold max-w-xs">{currentQuestion.villainAction}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currentQuestion.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAnswer(idx)}
                className="p-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-blue-500 rounded-xl text-left text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-between gap-2"
              >
                <span>{opt.label}</span>
                <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visual Results & Dummies Hand Replay Audit */}
      {isExamFinished && answers.length > 0 && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-6">
          {(() => {
            const correctCount = answers.filter(a => a.isCorrect).length;
            const total = answers.length;
            const scorePct = Math.round((correctCount / total) * 100);
            const totalEvLost = answers.reduce((acc, a) => acc + a.evLossPct, 0).toFixed(1);
            const passed = scorePct >= 75;

            return (
              <>
                {justLeveledUpTo && (
                  <div className="p-4 bg-blue-950/60 border border-blue-500 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-amber-300 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">
                          ¡Subiste al Nivel {justLeveledUpTo} del Centro Educativo!
                        </div>
                        <p className="text-xs text-blue-200">
                          Has demostrado dominio técnico y desbloqueaste el siguiente escalón de dificultad.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visual Summary Dashboard Banner */}
                <div
                  className={`p-5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-5 ${
                    passed
                      ? 'bg-emerald-950/25 border-emerald-700/60'
                      : 'bg-amber-950/25 border-amber-700/60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-mono shrink-0 ${
                        passed
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                          : 'bg-amber-950 border-amber-400 text-amber-300'
                      }`}
                    >
                      <span className="text-xl font-black leading-none">{scorePct}%</span>
                      <span className="text-[9px] uppercase mt-1">{passed ? 'APROBADO' : 'REPASAR'}</span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Award className={`w-5 h-5 ${passed ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <span>
                          {passed
                            ? 'Evaluación Superada — Tu Juego Evoluciona'
                            : 'Buen Entrenamiento — Refuerza tus Manos Falladas en SM-2'}
                        </span>
                      </h4>
                      <p className="text-xs text-neutral-300 mt-1">
                        Aciertos: <strong className="font-mono">{correctCount} de {total}</strong> · EV Perdido Total:{' '}
                        <strong className="font-mono text-rose-300">-{totalEvLost}%</strong> · Tus fallos se han guardado
                        automáticamente en tu mazo SM-2.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startExam()}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/20"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Nueva Evaluación (Sin Repetir Preguntas)</span>
                    </button>
                  </div>
                </div>

                {/* Visual Replay Cards for Every Single Hand */}
                <div className="space-y-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Recuerdo Visual Mano a Mano y Explicación Para Dummies ({answers.length} Manos)
                  </h5>

                  {answers.map((ans, idx) => {
                    const chosenLabel = ans.question.options[ans.chosenIdx]?.label || 'Sin selección';
                    return (
                      <div
                        key={ans.question.id}
                        className={`p-5 rounded-2xl border space-y-4 ${
                          ans.isCorrect
                            ? 'bg-neutral-900/60 border-neutral-800'
                            : 'bg-rose-950/15 border-rose-800/50'
                        }`}
                      >
                        {/* Card Top: Result Badge & Concept */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                          <div className="flex items-center gap-2.5">
                            {ans.isCorrect ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                            )}
                            <div>
                              <div className="text-xs font-bold text-white">
                                Mano #{idx + 1} · {ans.question.title}
                              </div>
                              <div className="text-[11px] font-mono text-neutral-400">
                                {ans.question.conceptTag} · Bote {ans.question.potBB} BB · vs{' '}
                                {ans.question.opponentProfile?.toUpperCase()}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                              ans.isCorrect
                                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                                : 'bg-rose-950/60 border-rose-700 text-rose-300'
                            }`}
                          >
                            {ans.isCorrect ? '✓ Decisión Perfecta (0% EV)' : `✗ Fuga -${ans.evLossPct}% EV · En SM-2`}
                          </span>
                        </div>

                        {/* Visual Table Strip: Hero Hand + Board Remembered */}
                        <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-semibold text-blue-400">
                              Tu Mano ({ans.question.heroPos}):
                            </span>
                            <div className="flex items-center gap-1.5">
                              {ans.question.heroCards.map((c, i) => (
                                <CardChip key={i} card={c} size="sm" />
                              ))}
                            </div>
                          </div>

                          {ans.question.board.length > 0 ? (
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-semibold text-neutral-400">
                                Mesa ({ans.question.streetLabel}):
                              </span>
                              <div className="flex items-center gap-1.5">
                                {ans.question.board.map((c, i) => (
                                  <CardChip key={i} card={c} size="sm" />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
                              Decisión Preflop
                            </span>
                          )}

                          <div className="text-[11px] text-neutral-400">
                            Situación: <strong className="text-neutral-200">{ans.question.villainAction}</strong>
                          </div>
                        </div>

                        {/* Side-by-Side Decision Comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div
                            className={`p-3 rounded-xl border ${
                              ans.isCorrect
                                ? 'bg-emerald-950/30 border-emerald-800/60'
                                : 'bg-rose-950/30 border-rose-800/60'
                            }`}
                          >
                            <span className="text-[10px] uppercase font-mono text-neutral-400 block">
                              Lo Que Tú Elegiste:
                            </span>
                            <strong className={ans.isCorrect ? 'text-emerald-300' : 'text-rose-300'}>
                              {chosenLabel}
                            </strong>
                          </div>

                          <div className="p-3 rounded-xl border bg-neutral-950 border-emerald-700/50">
                            <span className="text-[10px] uppercase font-mono text-neutral-400 block">
                              Lo Correcto (Matemática GTO):
                            </span>
                            <strong className="text-emerald-300">
                              {ans.question.correctAction} · Tamaño {ans.question.correctSizing} (Frec:{' '}
                              {ans.question.gtoFrequency}%)
                            </strong>
                          </div>
                        </div>

                        {/* Para Dummies Explanation + Rule of Thumb */}
                        <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                            <Brain className="w-4 h-4 shrink-0" />
                            <span>Explicación Simple (Para Dummies):</span>
                          </div>
                          <p className="text-neutral-200 leading-relaxed">{ans.question.explanationDummies}</p>
                          <div className="pt-1.5 border-t border-neutral-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="text-blue-300 font-semibold">💡 {ans.question.dummiesTip}</span>
                            {!ans.isCorrect && (
                              <span className="text-rose-300 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                {ans.question.leakWarning}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
