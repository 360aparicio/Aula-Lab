/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CustomFlashcardManager: Gestor de Flashcards & Motor de Repetición Espaciada SuperMemo SM-2.
 * Permite la auto-recopilación de manos analizadas, detección de debilidades y repaso inteligente
 * con cálculo exacto de la curva del olvido para garantizar que los spots difíciles se dominen.
 */

import React, { useState, useEffect } from 'react';
import {
  Brain,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  HelpCircle,
  Zap,
  Bookmark,
  Target,
  Clock,
  History,
  ShieldCheck,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { AutoLearningEngine, calculateSM2, HandHistoryRecord } from '../engine/autoLearningEngine';

export interface SM2Flashcard {
  id: string;
  question: string;
  answer: string;
  category: string;
  situationContext: string;
  keyRule: string;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  nextReviewDate: number; // timestamp
  createdDate: number;
  isAutoCaptured?: boolean;
  evLossPct?: number;
}

const STORAGE_KEY = 'lab_studio_sm2_flashcards';

const INITIAL_CARDS: SM2Flashcard[] = [
  {
    id: 'fc-1',
    question: 'Hero en BTN con K♠ 7♠. Board: K♥ J♦ 4♣. Rival en BB pasa. ¿Qué sizing de C-Bet es óptimo?',
    answer: 'Bet 33% del bote (o Check behind marginal).',
    category: 'Flop Seco (Dry)',
    situationContext: 'Single Raised Pot (SRP) BTN vs BB con Top Pair Kicker débil.',
    keyRule: 'En boards secos donde tienes ventaja de rango, una apuesta pequeña (1/3) extrae valor de pares inferiores sin aislarte.',
    intervalDays: 1,
    repetitions: 0,
    easeFactor: 2.5,
    nextReviewDate: Date.now(),
    createdDate: Date.now() - 86400000
  },
  {
    id: 'fc-2',
    question: 'En Bote 3-Bet (BB vs BTN), Flop A♦ 8♠ 3♣. ¿Por qué se aconseja C-Bet de 25-33% en vez de 75%?',
    answer: 'Porque el SPR ya es bajo (~4.5) y no necesitas apostar grande para comprometer stacks.',
    category: 'Botes 3-Bet',
    situationContext: '3-Bet Pot Preflop, SPR bajo, mesa seca con As alto.',
    keyRule: 'Apostar 75% pot en 3-Bet pots aísla tu mano contra las nuts del rival y hace foldear todas las manos peores.',
    intervalDays: 1,
    repetitions: 0,
    easeFactor: 2.5,
    nextReviewDate: Date.now(),
    createdDate: Date.now() - 86400000
  },
  {
    id: 'fc-3',
    question: 'Rival Calling Station te paga Flop y Turn en board coordinado. Llegas al River con Draw Fallido (aire puro). ¿Qué haces?',
    answer: 'Rendición total (Check-Fold). CERO faroles en river contra jugadores pasivos que pagan de más.',
    category: 'Explotación Calling Station',
    situationContext: 'River Showdown contra rival con VPIP 45%+ y WTSD alto.',
    keyRule: 'Regla de Oro: Nunca intentes faroles puros en el river contra jugadores que no tienen botón de fold.',
    intervalDays: 2,
    repetitions: 1,
    easeFactor: 2.6,
    nextReviewDate: Date.now(),
    createdDate: Date.now() - 172800000
  }
];

export const CustomFlashcardManager: React.FC = () => {
  const [cards, setCards] = useState<SM2Flashcard[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_CARDS;
  });

  const [activeTab, setActiveTab] = useState<'due' | 'all' | 'history'>('due');
  const [activeReviewIndex, setActiveReviewIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Auto-captured hands feed from AutoLearningEngine
  const [collectedHands, setCollectedHands] = useState<HandHistoryRecord[]>(() => {
    return AutoLearningEngine.getInstance().getProfile().collectedHands || [];
  });

  // New card form state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('Flops Secos (Dry)');
  const [newRule, setNewRule] = useState('');

  // Save to localStorage & update AutoLearningEngine counts
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
      AutoLearningEngine.getInstance().updateSM2Counts();
    } catch (e) {}
  }, [cards]);

  // Listen for storage changes
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setCards(JSON.parse(saved));
        setCollectedHands(AutoLearningEngine.getInstance().getProfile().collectedHands || []);
      } catch (e) {}
    };
    window.addEventListener('storage', handleUpdate);
    return () => window.removeEventListener('storage', handleUpdate);
  }, []);

  // Filter cards
  const dueCards = cards.filter(c => c.nextReviewDate <= Date.now());
  const masteredCards = cards.filter(c => c.repetitions >= 3 && c.easeFactor >= 2.4);
  const averageEF = (
    cards.reduce((acc, c) => acc + c.easeFactor, 0) / Math.max(1, cards.length)
  ).toFixed(2);

  // Active card pool for review
  const activeDeck = activeTab === 'due' ? (dueCards.length > 0 ? dueCards : cards) : cards;
  const currentCard = activeDeck[activeReviewIndex] || null;

  /**
   * Ejecutar Algoritmo SuperMemo SM-2
   */
  const handleRateCard = (quality: number) => {
    if (!currentCard) return;

    const sm2Result = calculateSM2(
      quality,
      currentCard.intervalDays,
      currentCard.repetitions,
      currentCard.easeFactor
    );

    const updated = cards.map(c => {
      if (c.id === currentCard.id) {
        return {
          ...c,
          intervalDays: sm2Result.intervalDays,
          repetitions: sm2Result.repetitions,
          easeFactor: sm2Result.easeFactor,
          nextReviewDate: sm2Result.nextReviewDate
        };
      }
      return c;
    });

    setCards(updated);
    setIsFlipped(false);
    if (activeReviewIndex >= activeDeck.length - 1) {
      setActiveReviewIndex(0);
    }
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const newCard: SM2Flashcard = {
      id: `fc-${Date.now()}`,
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      category: newCategory,
      situationContext: 'Personalizada por el usuario',
      keyRule: newRule.trim() || 'Regla mnemotécnica de decisión GTO.',
      intervalDays: 1,
      repetitions: 0,
      easeFactor: 2.5,
      nextReviewDate: Date.now(),
      createdDate: Date.now()
    };

    setCards(prev => [newCard, ...prev]);
    setNewQuestion('');
    setNewAnswer('');
    setNewRule('');
    setShowAddModal(false);
  };

  const handleDeleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    setIsFlipped(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card con Métricas SM-2 */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Gestor de Flashcards & Repetición Espaciada SM-2
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 font-mono">
                Auto-Aprendizaje Autosuficiente
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              El algoritmo SuperMemo SM-2 reprograma cada spot según tu facilidad de recuerdo, eliminando la curva del olvido.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="px-3 py-1.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-mono">
            <span className="text-neutral-400">Pendientes Hoy: </span>
            <strong className="text-blue-400 font-bold">{dueCards.length}</strong> / {cards.length}
          </div>
          <div className="px-3 py-1.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-mono">
            <span className="text-neutral-400">Neutralizadas: </span>
            <strong className="text-emerald-400 font-bold">{masteredCards.length}</strong>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Flashcard</span>
          </button>
        </div>
      </div>

      {/* Selector de Subpestañas */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
        <button
          type="button"
          onClick={() => { setActiveTab('due'); setActiveReviewIndex(0); setIsFlipped(false); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'due'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Fugas Pendientes Hoy ({dueCards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('all'); setActiveReviewIndex(0); setIsFlipped(false); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Todas las Tarjetas ({cards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Manos Recopiladas del Juego ({collectedHands.length})</span>
        </button>
      </div>

      {/* Vista de Manos Recopiladas */}
      {activeTab === 'history' ? (
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              Feed de Manos Auto-Recopiladas por la IA
            </h3>
            <span className="text-xs text-neutral-400">
              Registradas automáticamente desde el Wizard de 4 Pasos y Quizzes
            </span>
          </div>

          {collectedHands.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs">
              No hay manos recopiladas todavía. Practica en la Academia o en el Wizard para que la IA capture tus decisiones.
            </div>
          ) : (
            <div className="space-y-3">
              {collectedHands.map((h, i) => (
                <div
                  key={h.id || i}
                  className={`p-3.5 rounded-xl border transition-all ${
                    h.isMistake
                      ? 'bg-red-950/20 border-red-900/40'
                      : 'bg-neutral-900/60 border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-blue-400 font-mono">
                          {h.category}
                        </span>
                        <span className="text-xs font-bold text-white font-mono">
                          {h.heroPos} vs {h.villainPos}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-amber-300 font-mono">
                          Hero: {h.heroCards}
                        </span>
                        {h.board && (
                          <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-emerald-300 font-mono">
                            Board: {h.board}
                          </span>
                        )}
                        <span className="text-[11px] text-neutral-400">
                          Bote: {h.potBB} BB
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 font-medium">
                        Tu acción: <span className="text-neutral-100 font-bold">{h.chosenAction}</span> · Óptima:{' '}
                        <span className="text-emerald-400 font-bold">{h.optimalAction}</span>
                      </p>
                      <p className="text-[11px] text-neutral-400 italic">
                        {h.keyTakeaway}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {h.isMistake ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 border border-red-800 text-red-300 font-bold block mb-1">
                          Pérdida EV: -{h.evLossPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold block mb-1">
                          Línea Óptima (0% EV Loss)
                        </span>
                      )}
                      <span className="text-[9px] text-neutral-500 font-mono">
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Viewport de Repaso SM-2 */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Flashcard Interactive Area */}
          <div className="lg:col-span-2 space-y-4">
            {currentCard ? (
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative">
                {/* Badge Superior */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 font-mono font-semibold">
                      {currentCard.category}
                    </span>
                    {currentCard.isAutoCaptured && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 font-mono">
                        Auto-Capturada de tu Juego
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                    <span>
                      Tarjeta {activeReviewIndex + 1} de {activeDeck.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(currentCard.id)}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Eliminar tarjeta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Pregunta / Contexto */}
                <div className="min-h-[140px] flex flex-col justify-center py-4 border-y border-neutral-900">
                  <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                    {currentCard.question}
                  </p>
                  <p className="text-xs text-neutral-400 mt-2 font-mono">
                    Contexto: {currentCard.situationContext}
                  </p>
                </div>

                {/* Respuesta Desplegada al Girar */}
                {isFlipped ? (
                  <div className="mt-4 pt-4 border-t border-blue-500/30 bg-blue-950/20 rounded-xl p-4 space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4" />
                      Línea Óptima & Solución GTO:
                    </div>
                    <p className="text-sm sm:text-base font-bold text-white">
                      {currentCard.answer}
                    </p>
                    <div className="text-xs text-neutral-300 bg-black/40 rounded-lg p-2.5 border border-neutral-800 mt-2">
                      <strong className="text-blue-400 block mb-0.5">Regla Nemotécnica para Dummies:</strong>
                      {currentCard.keyRule}
                    </div>

                    {/* Calificación SM-2 (0 a 5) */}
                    <div className="pt-3 border-t border-neutral-800">
                      <p className="text-xs font-semibold text-neutral-300 mb-2 flex items-center justify-between">
                        <span>¿Cómo de fácil recordaste la respuesta? (Algoritmo SM-2):</span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Intervalo actual: {currentCard.intervalDays}d | EF: {currentCard.easeFactor}
                        </span>
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {[
                          { q: 0, label: '0: Olvido Total', desc: 'Repasar hoy', color: 'bg-red-950 text-red-300 border-red-800' },
                          { q: 1, label: '1: Error Grave', desc: 'Repasar hoy', color: 'bg-red-900/60 text-red-200 border-red-700' },
                          { q: 2, label: '2: Dudé Mucho', desc: 'Repasar hoy', color: 'bg-amber-950 text-amber-300 border-amber-800' },
                          { q: 3, label: '3: Correcto Difícil', desc: '1 día', color: 'bg-blue-950 text-blue-300 border-blue-800' },
                          { q: 4, label: '4: Correcto Ligero', desc: 'Expandir', color: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
                          { q: 5, label: '5: Recuerdo Perfecto', desc: 'Máximo', color: 'bg-emerald-900 text-emerald-200 border-emerald-600' }
                        ].map(item => (
                          <button
                            key={item.q}
                            type="button"
                            onClick={() => handleRateCard(item.q)}
                            className={`p-2 rounded-xl border text-center transition-all hover:scale-105 cursor-pointer ${item.color}`}
                          >
                            <span className="text-xs font-bold block">{item.label}</span>
                            <span className="text-[9px] opacity-80 block">{item.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsFlipped(true)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Ver Respuesta & Evaluar con SM-2</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-8 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-white">¡No tienes tarjetas pendientes de repaso para hoy!</h3>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Has completado la curva de repetición del algoritmo SuperMemo SM-2. El sistema volverá a agendar tarjetas cuando la memoria comience a decaer.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-xs font-bold text-white rounded-xl hover:bg-neutral-800 transition-all cursor-pointer"
                >
                  Ver Todas las Tarjetas ({cards.length})
                </button>
              </div>
            )}
          </div>

          {/* Panel Lateral: Parámetros del Algoritmo SM-2 y Guía para Dummies */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              ¿Por qué SM-2 hace la app autosuficiente?
            </h3>

            <div className="space-y-2.5 text-xs text-neutral-300">
              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
                <strong className="text-white block font-semibold">1. Combate la Curva del Olvido:</strong>
                <p className="text-neutral-400 text-[11px]">
                  El cerebro olvida el 70% de las líneas complejas de póker a las 48 horas. SM-2 re-agenda la mano exactamente antes del momento crítico de olvido.
                </p>
              </div>

              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
                <strong className="text-white block font-semibold">2. Auto-Captura de Manos Débiles:</strong>
                <p className="text-neutral-400 text-[11px]">
                  Cada vez que cometes un error en el Wizard o Quiz, se crea una tarjeta automáticamente para que lo conviertas en fortaleza.
                </p>
              </div>

              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
                <strong className="text-white block font-semibold">3. Factor de Facilidad Dinámico:</strong>
                <p className="text-neutral-400 text-[11px]">
                  Si un spot te cuesta (calificación &lt; 3), el intervalo se reduce a 1 día; si lo dominas, se amplía a 6, 15, 30 días automáticamente.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 space-y-1.5 text-[11px] font-mono text-neutral-400">
              <div className="flex justify-between">
                <span>Factor Facilidad Promedio:</span>
                <span className="text-white font-bold">{averageEF}</span>
              </div>
              <div className="flex justify-between">
                <span>Tarjetas Neutralizadas:</span>
                <span className="text-emerald-400 font-bold">{masteredCards.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Manos Auto-Capturadas:</span>
                <span className="text-blue-400 font-bold">{collectedHands.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear Flashcard Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-400" />
                Crear Flashcard SM-2 Manual
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Categoría:</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Flops Secos (Dry)">Flops Secos (Dry)</option>
                  <option value="Flops Coordinados (Wet)">Flops Coordinados (Wet)</option>
                  <option value="Flops Monótonos">Flops Monótonos</option>
                  <option value="Flops Emparejados">Flops Emparejados</option>
                  <option value="Botes 3-Bet">Botes 3-Bet</option>
                  <option value="Squeeze Spots">Squeeze Spots</option>
                  <option value="ROL (Limpers)">ROL (Limpers)</option>
                  <option value="River Bluff Catching">River Bluff Catching</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Pregunta / Spot:</label>
                <textarea
                  rows={2}
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  placeholder="Ej: Hero en BTN con A5s ante 3-Bet de SB..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Respuesta / Línea Óptima:</label>
                <textarea
                  rows={2}
                  value={newAnswer}
                  onChange={e => setNewAnswer(e.target.value)}
                  placeholder="Ej: 4-Bet Bluff a 22 BB..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Regla Nemotécnica para Dummies (Opcional):</label>
                <input
                  type="text"
                  value={newRule}
                  onChange={e => setNewRule(e.target.value)}
                  placeholder="Ej: El As bloquea AA y AK del rival..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-neutral-900 text-neutral-400 rounded-xl text-xs hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                >
                  Guardar en SM-2
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
