/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive GTO Practice Arena:
 * - Select Hero position (BTN, BB, SB, CO) and Villain position with Swap affordance
 * - Pick custom hole cards or deal random hands from range
 * - Play against GTO bot with dynamic responses & showdown resolution
 * - Instant feedback: EV loss (BB/chips), action frequencies, quality grading
 * - Dynamic Elo rating progression with rank tiers
 * - Persistent attempt history log and scenario switcher
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, cardId, cardToString, RANKS, SUIT_COLORS, SUIT_SYMBOLS, SUITS } from '../engine/cards';
import { NodeStrategyResult, SolveResult } from '../engine/dcfr';
import { Action, ActionNode, GameNode, PlayerRole } from '../engine/gameTree';
import { ConcreteHandWithWeight } from '../engine/range';
import { createConcreteComboFromCards } from '../engine/combos';
import { compareHands, evaluateCards } from '../engine/evaluator';
import { ActionEvBarChart } from './ActionEvBarChart';
import {
  clearTrainingAttempts,
  dealRandomHeroHand,
  dealRandomVillainHand,
  ELO_TIERS,
  evaluateUserAction,
  getEloTier,
  loadTrainerStats,
  loadTrainingAttempts,
  sampleVillainAction,
  saveTrainerStats,
  saveTrainingAttempt,
  TrainerUserStats,
  TrainingAttempt,
  TrainingFeedback
} from '../trainer/trainerState';
import { PrebuiltScenario } from '../trainer/prebuiltScenarios';
import { LearnerService, LEARNER_UPDATE_EVENT, WeaknessPattern } from '../engine/learner';
import {
  Award,
  CheckCircle,
  Flame,
  RotateCcw,
  Target,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  History,
  Trash2,
  ChevronDown,
  Play,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Sparkles,
  ArrowLeftRight,
  Edit3,
  Shuffle,
  X,
  Check,
  Brain
} from 'lucide-react';
import {
  TablePosition,
  TABLE_POSITIONS,
  POSITION_INFO,
  getPostflopRole
} from './HandAndPositionBar';

interface TrainerModuleProps {
  scenarios: PrebuiltScenario[];
  activeScenario: PrebuiltScenario;
  onSelectScenario: (sc: PrebuiltScenario) => void;
  boardCards: Card[];
  oopCombos: ConcreteHandWithWeight[];
  ipCombos: ConcreteHandWithWeight[];
  activeNode: ActionNode;
  strategyResult?: NodeStrategyResult;
  nodeStrategies?: Map<string, NodeStrategyResult>;
  heroPos?: TablePosition;
  villainPos?: TablePosition;
  heroCards?: [Card, Card] | null;
  onHeroPosChange?: (pos: TablePosition) => void;
  onVillainPosChange?: (pos: TablePosition) => void;
  onSwapPositions?: () => void;
  onSelectHeroCards?: (card1: Card, card2: Card) => void;
  onBack?: () => void;
}

export const TrainerModule: React.FC<TrainerModuleProps> = ({
  scenarios,
  activeScenario,
  onSelectScenario,
  boardCards,
  oopCombos,
  ipCombos,
  activeNode,
  strategyResult,
  nodeStrategies,
  heroPos: propHeroPos,
  villainPos: propVillainPos,
  heroCards: propHeroCards,
  onHeroPosChange: propOnHeroPosChange,
  onVillainPosChange: propOnVillainPosChange,
  onSwapPositions: propOnSwapPositions,
  onSelectHeroCards: propOnSelectHeroCards,
  onBack
}) => {
  // Table Positions
  const [internalHeroPos, setInternalHeroPos] = useState<TablePosition>(
    activeScenario.defaultHero === 'IP' ? 'BTN' : 'BB'
  );
  const [internalVillainPos, setInternalVillainPos] = useState<TablePosition>(
    activeScenario.defaultHero === 'IP' ? 'BB' : 'BTN'
  );

  const heroPos = propHeroPos || internalHeroPos;
  const villainPos = propVillainPos || internalVillainPos;

  // Derived role: dynamic postflop acting order (SB acts 1st, BB 2nd, EP 3rd, MP 4th, CO 5th, BTN 6th)
  const heroRole: PlayerRole = getPostflopRole(heroPos, villainPos);
  const villainRole: PlayerRole = heroRole === 'IP' ? 'OOP' : 'IP';

  const [currentNode, setCurrentNode] = useState<ActionNode>(activeNode);

  // Dealt cards
  const [heroHand, setHeroHand] = useState<ConcreteHandWithWeight | null>(null);
  const [villainHand, setVillainHand] = useState<ConcreteHandWithWeight | null>(null);

  // Custom Card Picker modal state
  const [isCardPickerOpen, setIsCardPickerOpen] = useState(false);
  const [pickerCard1, setPickerCard1] = useState<Card | null>(null);
  const [pickerCard2, setPickerCard2] = useState<Card | null>(null);

  // Turn state & feedback
  const [feedback, setFeedback] = useState<TrainingFeedback | null>(null);
  const [villainActionMessage, setVillainActionMessage] = useState<string | null>(null);
  const [isHandOver, setIsHandOver] = useState<boolean>(false);
  const [showdownResult, setShowdownResult] = useState<{ winner: string; desc: string } | null>(null);

  // Persistence & Stats
  const [stats, setStats] = useState<TrainerUserStats>(loadTrainerStats());
  const [attempts, setAttempts] = useState<TrainingAttempt[]>(loadTrainingAttempts());
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'practice' | 'history' | 'weaknesses'>('practice');

  // Learner Service state for weakness patterns tracking
  const [learnerSummary, setLearnerSummary] = useState(() => LearnerService.getInstance().getLearnerSummary());
  const [showWeaknessModal, setShowWeaknessModal] = useState<boolean>(false);

  useEffect(() => {
    const handleLearnerUpdate = () => {
      setLearnerSummary(LearnerService.getInstance().getLearnerSummary());
    };
    window.addEventListener(LEARNER_UPDATE_EVENT, handleLearnerUpdate);
    return () => window.removeEventListener(LEARNER_UPDATE_EVENT, handleLearnerUpdate);
  }, []);

  // Hero & Villain Combos based on role
  const heroCombos = heroRole === 'OOP' ? oopCombos : ipCombos;
  const villainCombos = heroRole === 'OOP' ? ipCombos : oopCombos;

  // Deal a new random hand from range
  const startNewHand = () => {
    if (heroCombos.length === 0 || villainCombos.length === 0) return;

    const dealtHero = dealRandomHeroHand(heroCombos);
    if (!dealtHero) return;

    const dealtVillain = dealRandomVillainHand(villainCombos, dealtHero);

    setHeroHand(dealtHero);
    setVillainHand(dealtVillain);
    setCurrentNode(activeNode);
    setFeedback(null);
    setVillainActionMessage(null);
    setIsHandOver(false);
    setShowdownResult(null);

    if (propOnSelectHeroCards && dealtHero) {
      propOnSelectHeroCards(dealtHero.combo.card1, dealtHero.combo.card2);
    }
  };

  useEffect(() => {
    if (propHeroCards) {
      try {
        const concrete = createConcreteComboFromCards(propHeroCards[0], propHeroCards[1]);
        const existing = heroCombos.find(c => c.combo.key === concrete.key);
        const customHand: ConcreteHandWithWeight = existing || { combo: concrete, weight: 1.0 };
        setHeroHand(customHand);
        const dealtVillain = dealRandomVillainHand(villainCombos, customHand);
        setVillainHand(dealtVillain);
        setCurrentNode(activeNode);
        setFeedback(null);
        setVillainActionMessage(null);
        setIsHandOver(false);
        setShowdownResult(null);
      } catch (e) {
        startNewHand();
      }
    } else {
      startNewHand();
    }
  }, [propHeroCards, activeScenario.id, heroRole, heroCombos.length]);

  // Handle position changes
  const handleHeroPosChange = (newPos: TablePosition) => {
    if (propOnHeroPosChange) {
      propOnHeroPosChange(newPos);
    } else {
      setInternalHeroPos(newPos);
      if (newPos === villainPos) {
        setInternalVillainPos(newPos === 'BB' ? 'BTN' : 'BB');
      }
    }
  };

  const handleVillainPosChange = (newPos: TablePosition) => {
    if (propOnVillainPosChange) {
      propOnVillainPosChange(newPos);
    } else {
      setInternalVillainPos(newPos);
      if (newPos === heroPos) {
        setInternalHeroPos(newPos === 'BB' ? 'BTN' : 'BB');
      }
    }
  };

  const handleSwapPositions = () => {
    if (propOnSwapPositions) {
      propOnSwapPositions();
    } else {
      const tempHero = internalHeroPos;
      setInternalHeroPos(internalVillainPos);
      setInternalVillainPos(tempHero);
    }
  };

  // Open custom card picker
  const handleOpenCardPicker = () => {
    if (heroHand) {
      setPickerCard1(heroHand.combo.card1);
      setPickerCard2(heroHand.combo.card2);
    } else {
      setPickerCard1(null);
      setPickerCard2(null);
    }
    setIsCardPickerOpen(true);
  };

  // Apply custom selected hole cards
  const handleApplyCustomCards = () => {
    if (!pickerCard1 || !pickerCard2) return;
    if (pickerCard1.id === pickerCard2.id) {
      return;
    }

    try {
      if (propOnSelectHeroCards) {
        propOnSelectHeroCards(pickerCard1, pickerCard2);
      }
      const concrete = createConcreteComboFromCards(pickerCard1, pickerCard2);
      // Check if hand exists in range
      const existing = heroCombos.find(c => c.combo.key === concrete.key);
      const customHandWithWeight: ConcreteHandWithWeight = existing || {
        combo: concrete,
        weight: 1.0
      };

      setHeroHand(customHandWithWeight);
      const dealtVillain = dealRandomVillainHand(villainCombos, customHandWithWeight);
      setVillainHand(dealtVillain);

      setCurrentNode(activeNode);
      setFeedback(null);
      setVillainActionMessage(null);
      setIsHandOver(false);
      setShowdownResult(null);
      setIsCardPickerOpen(false);
    } catch (err) {
      console.error('Error creating hand:', err);
    }
  };

  // Card click in modal
  const handleCardClickInPicker = (card: Card) => {
    // If already card 1, unselect
    if (pickerCard1 && pickerCard1.id === card.id) {
      setPickerCard1(null);
      return;
    }
    // If already card 2, unselect
    if (pickerCard2 && pickerCard2.id === card.id) {
      setPickerCard2(null);
      return;
    }
    // If card 1 empty, set card 1
    if (!pickerCard1) {
      setPickerCard1(card);
      return;
    }
    // If card 2 empty, set card 2
    if (!pickerCard2) {
      setPickerCard2(card);
      return;
    }
    // If both full, replace card 2
    setPickerCard2(card);
  };

  // Set of dead cards on board
  const boardCardIds = useMemo(() => new Set(boardCards.map(c => c.id)), [boardCards]);

  // Handle user decision action
  const handleHeroAction = (action: Action) => {
    if (!heroHand || isHandOver) return;

    const activeStrat = nodeStrategies?.get(currentNode.id) || strategyResult;
    if (!activeStrat) return;

    const actKey = action.actionKey || action.type;
    const fb = evaluateUserAction(actKey, heroHand, activeStrat, currentNode.pot);
    setFeedback(fb);

    // Update stats
    const updatedStats: TrainerUserStats = {
      ...stats,
      handsPlayed: stats.handsPlayed + 1,
      elo: Math.max(700, stats.elo + fb.eloChange),
      optimalMoves: fb.grade === 'optimal' ? stats.optimalMoves + 1 : stats.optimalMoves,
      acceptableMoves: fb.grade === 'acceptable' ? stats.acceptableMoves + 1 : stats.acceptableMoves,
      inaccuracies: fb.grade === 'inaccuracy' ? stats.inaccuracies + 1 : stats.inaccuracies,
      mistakes: fb.grade === 'mistake' ? stats.mistakes + 1 : stats.mistakes,
      blunders: fb.grade === 'blunder' ? stats.blunders + 1 : stats.blunders,
      streak: fb.eloChange > 0 ? stats.streak + 1 : 0,
      bestStreak: fb.eloChange > 0 ? Math.max(stats.bestStreak, stats.streak + 1) : stats.bestStreak,
      totalEvLossBB: Math.round((stats.totalEvLossBB + fb.evLossBB) * 100) / 100
    };

    setStats(updatedStats);
    saveTrainerStats(updatedStats);

    const newAttempt: TrainingAttempt = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      scenarioTitle: activeScenario.title,
      nodeHistory: currentNode.history,
      heroCombo: heroHand.combo.key,
      board: boardCards.map(c => `${c.rank}${c.suit}`),
      chosenAction: action.label || actKey,
      bestAction: fb.bestAction,
      grade: fb.grade,
      chosenFrequency: fb.chosenFrequency,
      bestFrequency: fb.bestFrequency,
      evLossBB: fb.evLossBB,
      evLossChips: fb.evLossChips,
      evLossPercentOfPot: fb.evLossPercentOfPot,
      isMistakeThresholdExceeded: fb.isMistakeThresholdExceeded,
      eloChange: fb.eloChange,
      newElo: updatedStats.elo
    };

    saveTrainingAttempt(newAttempt);
    setAttempts(loadTrainingAttempts());

    // Captura automática de desviaciones críticas (>5% EV) en LearnerService
    LearnerService.getInstance().recordTrainerDecision({
      scenarioTitle: activeScenario.title,
      heroCombo: heroHand.combo.key,
      boardCards: boardCards,
      heroPos,
      villainPos,
      potBB: Math.round((currentNode.pot / 2) * 10) / 10,
      chosenAction: action.label || actKey,
      bestAction: fb.bestAction,
      chosenFrequency: fb.chosenFrequency,
      bestFrequency: fb.bestFrequency,
      evLossBB: fb.evLossBB,
      evLossChips: fb.evLossChips,
      evLossPercentOfPot: fb.evLossPercentOfPot,
      isMistakeThresholdExceeded: fb.isMistakeThresholdExceeded,
      grade: fb.grade
    });

    // Advance the game tree (resolving exact actionKey first to avoid colliding bet sizes)
    const childKey = action.actionKey ||
      (currentNode.children[action.type] ? action.type :
       Object.keys(currentNode.children).find(k => k === action.type || k.startsWith(action.type)) ||
       Object.keys(currentNode.children)[0]);
    const nextNode = currentNode.children[childKey] || currentNode.children[action.type];

    if (!nextNode) {
      setIsHandOver(true);
      return;
    }

    if (nextNode.nodeType === 'fold') {
      setIsHandOver(true);
      const isHeroWinner = nextNode.winner === heroRole;
      setShowdownResult({
        winner: isHeroWinner ? 'Hero Wins Pot!' : 'Villain Wins Pot',
        desc: isHeroWinner ? 'Villain folded to your pressure.' : 'You surrendered the pot.'
      });
      return;
    }

    if (nextNode.nodeType === 'showdown') {
      setIsHandOver(true);
      evaluateShowdown(nextNode.pot);
      return;
    }

    // Next is an action node
    if (nextNode.nodeType === 'action') {
      if (nextNode.player === heroRole) {
        setCurrentNode(nextNode);
      } else {
        handleVillainResponse(nextNode);
      }
    }
  };

  // Bot plays GTO response
  const handleVillainResponse = (villainNode: ActionNode) => {
    if (!villainHand) return;

    const villainStrat = nodeStrategies?.get(villainNode.id);
    if (!villainStrat) {
      setIsHandOver(true);
      return;
    }

    const sampled = sampleVillainAction(villainStrat, villainHand);
    const chosenKey = sampled.actionKey;
    const label = villainNode.actions.find(a => (a.actionKey && a.actionKey === chosenKey) || a.type === chosenKey)?.label || chosenKey;

    setVillainActionMessage(`Villano (${villainPos}) respondió: ${label} (${(sampled.frequency * 100).toFixed(1)}% freq)`);

    const childKey = villainNode.children[chosenKey] ? chosenKey :
      (Object.keys(villainNode.children).find(k => k === chosenKey || k.startsWith(chosenKey)) || Object.keys(villainNode.children)[0]);
    const afterVillain = villainNode.children[childKey] || villainNode.children[chosenKey];

    if (!afterVillain) {
      setIsHandOver(true);
      return;
    }

    if (afterVillain.nodeType === 'fold') {
      setIsHandOver(true);
      setShowdownResult({
        winner: 'Hero Wins Pot!',
        desc: 'Villain folded! You collect the pot.'
      });
      return;
    }

    if (afterVillain.nodeType === 'showdown') {
      setIsHandOver(true);
      evaluateShowdown(afterVillain.pot);
      return;
    }

    if (afterVillain.nodeType === 'action') {
      setCurrentNode(afterVillain);
    }
  };

  const evaluateShowdown = (pot: number) => {
    if (!heroHand || !villainHand) return;

    const heroCards = [heroHand.combo.card1, heroHand.combo.card2];
    const villainCards = [villainHand.combo.card1, villainHand.combo.card2];

    const heroEval = evaluateCards([...heroCards, ...boardCards]);
    const villainEval = evaluateCards([...villainCards, ...boardCards]);

    const cmp = heroEval.score - villainEval.score;

    if (cmp > 0) {
      setShowdownResult({
        winner: 'Hero Wins Showdown!',
        desc: `Hero (${heroEval.description}) beats Villain (${villainEval.description}) for ${pot} chips.`
      });
    } else if (cmp < 0) {
      setShowdownResult({
        winner: 'Villain Wins Showdown',
        desc: `Villain (${villainEval.description}) beats Hero (${heroEval.description}) for ${pot} chips.`
      });
    } else {
      setShowdownResult({
        winner: 'Split Pot (Tie)',
        desc: `Both players hold identical five-card strength: ${heroEval.description}.`
      });
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear all training attempt logs?')) {
      clearTrainingAttempts();
      setAttempts([]);
    }
  };

  const currentTier = getEloTier(stats.elo);
  const accuracyPct = stats.handsPlayed > 0
    ? Math.round(((stats.optimalMoves + stats.acceptableMoves) / stats.handsPlayed) * 100)
    : 100;
  const avgEvLossBB = stats.handsPlayed > 0
    ? Math.round((stats.totalEvLossBB / stats.handsPlayed) * 100) / 100
    : 0.00;

  const filteredAttempts = attempts.filter(a => {
    if (filterGrade === 'all') return true;
    if (filterGrade === 'mistake_threshold') {
      return a.isMistakeThresholdExceeded || (a.evLossPercentOfPot !== undefined ? a.evLossPercentOfPot > 5.0 : a.evLossBB > 2.0);
    }
    if (filterGrade === 'blunders') return a.grade === 'blunder' || a.grade === 'mistake';
    if (filterGrade === 'optimal') return a.grade === 'optimal';
    return true;
  });

  const renderCard = (card: Card, size: 'sm' | 'md' = 'md') => {
    const style = SUIT_COLORS[card.suit];
    const isSm = size === 'sm';
    return (
      <div
        key={card.id}
        className={`${
          isSm ? 'w-10 h-14 p-1' : 'w-14 h-20 p-1.5'
        } rounded-lg bg-neutral-950 border ${style.border} flex flex-col justify-between shadow-lg select-none`}
      >
        <div className="flex items-center justify-between">
          <span className={`${isSm ? 'text-xs' : 'text-base'} font-bold leading-none ${style.text}`}>
            {card.rank}
          </span>
          <span className={`${isSm ? 'text-[10px]' : 'text-xs'} ${style.text}`}>
            {SUIT_SYMBOLS[card.suit]}
          </span>
        </div>
        <div className="flex justify-center items-center my-auto">
          <span className={`${isSm ? 'text-lg' : 'text-2xl'} leading-none ${style.text}`}>
            {SUIT_SYMBOLS[card.suit]}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Configuration Bar: Back Button, Scenario Selector & Tab Switcher */}
      <div className="flex flex-col gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Volver Button & Scenario Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-950/60 to-neutral-900 hover:from-emerald-900/60 hover:to-neutral-800 text-white rounded-xl text-xs font-bold border border-emerald-500/60 hover:border-emerald-400 transition-all shadow-md group cursor-pointer"
                title="Volver al análisis o proceso de pensamiento"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-1 transition-transform" />
                <span className="tracking-wide">← Volver al Análisis</span>
              </button>
            )}

            {onBack && <div className="h-5 w-px bg-neutral-800 hidden sm:block" />}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Escenario / Spot:
              </span>
              <select
                value={activeScenario.id}
                onChange={(e) => {
                  const sc = scenarios.find(s => s.id === e.target.value);
                  if (sc) onSelectScenario(sc);
                }}
                className="text-xs font-bold bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 text-white focus:outline-hidden"
              >
                {scenarios.map(sc => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title} ({sc.street.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Switcher: Live Practice vs Attempt History */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setActiveTab('practice')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeTab === 'practice'
                  ? 'bg-neutral-800 text-white font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Práctica en Vivo / Live Practice
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-neutral-800 text-white font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historial ({attempts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('weaknesses')}
              className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'weaknesses'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-blue-400" />
              <span>Patrones de Debilidad IA</span>
              {learnerSummary.criticalMistakesCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-950 text-red-300 border border-red-800 font-bold font-mono">
                  {learnerSummary.criticalMistakesCount} &gt;5% EV
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* DEDICATED PROMINENT POSITION & HOLE CARDS SELECTOR CARD */}
      <div className="bg-neutral-900 border-2 border-emerald-500/60 rounded-xl p-4 sm:p-5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <span>🎯 Selección de Posiciones (Hero vs Villano) y Mis Cartas</span>
            </h2>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 font-semibold hidden sm:inline">
            Hero: {heroPos} ({heroRole}) · Villano: {villainPos} ({villainRole})
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Positions Selection */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              {/* Hero Position */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-emerald-400">Mi Posición (Hero):</span>
                  <span className="text-neutral-400 text-[11px] font-mono">
                    ({heroRole === 'IP' ? 'Con Posición / IP' : 'Fuera de Posición / OOP'})
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs flex-wrap">
                  {TABLE_POSITIONS.map(pos => {
                    const role = getPostflopRole(pos, villainPos);
                    const isSelected = heroPos === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => handleHeroPosChange(pos)}
                        className={`px-2.5 sm:px-3 py-1.5 rounded font-mono font-bold transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                        }`}
                        title={`${POSITION_INFO[pos].full} - ${role === 'IP' ? 'In Position' : 'Out of Position'}`}
                      >
                        <span>{pos}</span>
                        <span className={`text-[10px] font-normal ${isSelected ? 'text-emerald-100' : 'text-neutral-500'}`}>
                          {role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex flex-col justify-end pt-4">
                <button
                  type="button"
                  onClick={handleSwapPositions}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-700 shadow-xs"
                  title="Invertir posiciones entre Hero y Villano"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Invertir Posiciones</span>
                </button>
              </div>

              {/* Villain Position */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span className="font-medium text-neutral-300">Posición del Villano:</span>
                  <span className="text-neutral-500 text-[11px] font-mono">
                    ({villainRole === 'IP' ? 'IP' : 'OOP'})
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs flex-wrap">
                  {TABLE_POSITIONS.map(pos => {
                    const role = getPostflopRole(pos, heroPos);
                    const isSelected = villainPos === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => handleVillainPosChange(pos)}
                        className={`px-2 sm:px-2.5 py-1.5 rounded font-mono font-medium transition-colors flex items-center gap-1 ${
                          isSelected
                            ? 'bg-rose-600 text-white font-bold shadow-xs border border-rose-500 ring-1 ring-rose-400/50'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
                        }`}
                        title={`${POSITION_INFO[pos].full} - ${role === 'IP' ? 'In Position' : 'Out of Position'}`}
                      >
                        <span>{pos}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-rose-100 font-semibold' : 'text-neutral-500'}`}>
                          {role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Matchup Presets */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 flex-wrap pt-0.5">
              <span className="text-[11px] text-neutral-500 font-medium">Spots Comunes:</span>
              {[
                { h: 'EP', v: 'BB', label: 'EP vs BB' },
                { h: 'MP', v: 'BB', label: 'MP vs BB' },
                { h: 'CO', v: 'BB', label: 'CO vs BB' },
                { h: 'BTN', v: 'BB', label: 'BTN vs BB' },
                { h: 'MP', v: 'BTN', label: 'MP vs BTN' },
                { h: 'EP', v: 'BTN', label: 'EP vs BTN' },
                { h: 'SB', v: 'BB', label: 'SB vs BB' },
              ].map(spot => {
                const isActive = heroPos === spot.h && villainPos === spot.v;
                return (
                  <button
                    key={spot.label}
                    type="button"
                    onClick={() => {
                      handleHeroPosChange(spot.h as TablePosition);
                      handleVillainPosChange(spot.v as TablePosition);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors border ${
                      isActive
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/80 font-bold shadow-xs'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    {spot.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Hero Hole Cards Selector */}
          <div className="flex items-center gap-3 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
            {/* Card Preview Slots */}
            <div
              onClick={handleOpenCardPicker}
              className="flex items-center gap-1.5 cursor-pointer group hover:opacity-90 transition-opacity"
              title="Haz clic para seleccionar tus 2 cartas"
            >
              {heroHand ? (
                <>
                  {renderCard(heroHand.combo.card1, 'sm')}
                  {renderCard(heroHand.combo.card2, 'sm')}
                </>
              ) : (
                <>
                  <div className="w-10 h-14 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                    Carta 1
                  </div>
                  <div className="w-10 h-14 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                    Carta 2
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>{heroHand ? heroHand.combo.canonicalName : 'Sin cartas'}</span>
                {heroHand && (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    ({heroHand.combo.key})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenCardPicker}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Elegir Mis Cartas</span>
                </button>

                <button
                  type="button"
                  onClick={startNewHand}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                  title="Repartir mano aleatoria desde el rango"
                >
                  <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Aleatorio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-3">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-neutral-800 rounded-lg text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 font-medium">Elo Rating</div>
            <div className="text-lg font-bold font-mono text-white tabular-nums flex items-center gap-1.5">
              <span>{stats.elo}</span>
              <span className={`text-[10px] font-normal ${currentTier.color}`}>
                ({currentTier.name})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-neutral-800 rounded-lg text-cyan-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 font-medium">Precisión Ideal</div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">{accuracyPct}%</div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-neutral-800 rounded-lg text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 font-medium">Avg EV Loss</div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">{avgEvLossBB} BB</div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-neutral-800 rounded-lg text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 font-medium">Optimal Streak</div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">{stats.streak} (Best: {stats.bestStreak})</div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-neutral-800 rounded-lg text-purple-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 font-medium">Hands Solved</div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">{stats.handsPlayed}</div>
          </div>
        </div>
      </div>

      {/* VIEW 1: LIVE PRACTICE ARENA */}
      {activeTab === 'practice' && (
        <div className="flex flex-col gap-6">
          {/* Poker Table Visualizer Container */}
          <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl min-h-[480px] flex flex-col justify-between p-6">
            {/* Subtle Felt Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-luminosity">
              <img
                src="/src/assets/images/gto_poker_banner_1792155305971.jpg"
                alt="Poker Felt"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/80 via-neutral-950/60 to-neutral-950/95 pointer-events-none" />

            {/* Table Header Strip */}
            <div className="relative z-10 flex items-center justify-between pb-3 border-b border-neutral-800/80 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold border border-emerald-500/50 hover:border-emerald-400 transition-all shadow-md group cursor-pointer"
                    title="Volver al análisis o proceso de pensamiento"
                  >
                    <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Volver</span>
                  </button>
                )}
                <div>
                  <div className="text-xs text-neutral-400">
                    Spot: {activeScenario.title} · <span className="text-white font-mono">{heroPos} vs {villainPos}</span>
                  </div>
                  <div className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                    <span>Acting Player:</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-800 text-emerald-400">
                      {currentNode.player} {currentNode.player === heroRole ? `(Hero / ${heroPos})` : `(Villain / ${villainPos})`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Center-Right: Mistake Threshold Indicator */}
              <div className="flex flex-col items-center sm:items-end justify-center">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mistake Threshold:</span>
                  <span className="font-mono text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-900/50">
                    &gt;5.0% EV Loss
                  </span>
                </div>
                <div className="mt-1">
                  {!feedback ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900/90 text-neutral-400 border border-neutral-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Monitoreo Activo (Tolerancia 5% Pot)</span>
                    </span>
                  ) : feedback.isMistakeThresholdExceeded ? (
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-500/80 shadow-xs flex items-center gap-1 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>¡UMBRAL SUPERADO! ({feedback.evLossPercentOfPot}% EV Loss)</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Línea GTO Válida ({feedback.evLossPercentOfPot}% Loss ≤ 5%)</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-xs text-neutral-400">Pot Size</div>
                <div className="text-base font-bold text-emerald-400 tabular-nums">
                  {currentNode.pot} chips ({Math.round(currentNode.pot / 2)} BB)
                </div>
              </div>
            </div>

            {/* Center: Community Board Cards & Alerts */}
            <div className="relative z-10 flex flex-col items-center justify-center my-6 gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                Community Board ({boardCards.length} Cards)
              </div>
              <div className="flex items-center gap-2">
                {boardCards.map(c => renderCard(c, 'md'))}
              </div>

              {/* Bot notification / showdown announcement */}
              {villainActionMessage && !showdownResult && (
                <div className="mt-2 px-3 py-1 bg-neutral-900/90 border border-neutral-700 rounded-lg text-xs font-mono text-cyan-300 shadow-sm">
                  {villainActionMessage}
                </div>
              )}

              {/* Highlight Banner when Mistake Threshold is exceeded */}
              {feedback && feedback.isMistakeThresholdExceeded && (
                <div className="mt-2 p-3.5 bg-rose-950/90 border-2 border-rose-500 rounded-xl text-left shadow-2xl max-w-lg w-full animate-pulse">
                  <div className="flex items-center justify-between gap-2 border-b border-rose-800/80 pb-2 mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-200 flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4 text-rose-400" />
                      <span>⚠️ Umbral de Error GTO Superado (&gt;5% Pérdida de EV)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900 text-rose-100 font-bold border border-rose-400">
                      -{feedback.evLossBB} BB ({feedback.evLossPercentOfPot}% Pot)
                    </span>
                  </div>
                  <p className="text-xs text-rose-100 leading-relaxed font-medium">
                    Tu acción <strong>{feedback.chosenAction}</strong> ({((feedback.chosenFrequency) * 100).toFixed(1)}% freq) se desvía drásticamente de la estrategia óptima. La línea GTO calculada era <strong>{feedback.bestAction}</strong> ({((feedback.bestFrequency) * 100).toFixed(1)}% freq).
                  </p>
                  <div className="mt-2 pt-2 border-t border-rose-900/60 flex items-center justify-between text-[11px] font-mono text-rose-300">
                    <span>Límite de Tolerancia GTO: 5.0%</span>
                    <span className="font-bold text-white">Desviación: {feedback.evLossPercentOfPot}% (+{(feedback.evLossPercentOfPot - 5.0).toFixed(1)}% exceso)</span>
                  </div>
                </div>
              )}

              {showdownResult && (
                <div className="mt-2 p-3.5 bg-neutral-900/95 border border-emerald-500/50 rounded-xl text-center shadow-xl space-y-1.5 max-w-md">
                  <div className="text-sm font-bold text-emerald-400">{showdownResult.winner}</div>
                  <div className="text-xs text-neutral-300">{showdownResult.desc}</div>
                  {villainHand && (
                    <div className="pt-2 flex items-center justify-center gap-2 text-xs font-mono text-neutral-400 border-t border-neutral-800">
                      <span>Villain hand:</span>
                      <span className="text-white font-bold">{villainHand.combo.canonicalName}</span>
                      <span>({villainHand.combo.key})</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Controls: Hero Hand & Decision Box */}
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-neutral-800/80">
              {/* Hero Hand with Direct Click to Pick */}
              <div className="flex items-center gap-4">
                <div
                  onClick={handleOpenCardPicker}
                  className="flex items-center gap-1.5 cursor-pointer group"
                  title="Click to select your exact cards"
                >
                  {heroHand ? (
                    <>
                      {renderCard(heroHand.combo.card1, 'md')}
                      {renderCard(heroHand.combo.card2, 'md')}
                    </>
                  ) : (
                    <div className="text-xs text-neutral-500">No hands in range</div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <span>Hero Hole Cards ({heroPos})</span>
                    <button
                      onClick={handleOpenCardPicker}
                      className="text-emerald-400 hover:text-emerald-300 underline text-[11px] font-medium"
                    >
                      (Change)
                    </button>
                  </div>
                  <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span>{heroHand ? `${heroHand.combo.canonicalName} (${heroHand.combo.key})` : '-'}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    Stack: {currentNode.stacks[heroRole]} chips · Weight: {heroHand ? `${Math.round(heroHand.weight * 100)}%` : '-'}
                  </div>
                </div>
              </div>

              {/* Action Decision Controls */}
              {!feedback && !isHandOver ? (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {currentNode.actions.map(act => {
                    const isFold = act.type === 'FOLD';
                    const isPassive = act.type === 'CHECK' || act.type === 'CALL';
                    return (
                      <button
                        key={act.actionKey || `${act.type}_${act.amount}`}
                        onClick={() => handleHeroAction(act)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-transform active:scale-95 shadow-sm cursor-pointer ${
                          isFold
                            ? 'bg-neutral-800 hover:bg-red-950 hover:text-red-300 text-neutral-300 border border-neutral-700'
                            : isPassive
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {act.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Feedback & Next Hand Strip */
                <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3.5 rounded-xl border bg-neutral-900/90 backdrop-blur-xs">
                  {feedback ? (
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${feedback.gradeColor}`}>
                          {feedback.gradeLabel}
                        </span>
                        {feedback.isMistakeThresholdExceeded && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/80 flex items-center gap-1 animate-pulse">
                            <AlertOctagon className="w-3 h-3 text-rose-400" />
                            <span>&gt;5% EV Loss ({feedback.evLossPercentOfPot}% Pot)</span>
                          </span>
                        )}
                        <span className={`text-xs font-mono font-bold ${
                          feedback.eloChange > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {feedback.eloChange > 0 ? `+${feedback.eloChange}` : feedback.eloChange} Elo
                        </span>
                        <span className="text-xs font-mono text-neutral-400">
                          EV Loss: <strong className={feedback.evLossBB > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            {feedback.evLossBB} BB
                          </strong> ({feedback.evLossChips} chips{feedback.evLossPercentOfPot ? ` · ${feedback.evLossPercentOfPot}% Pot` : ''})
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300">
                        {feedback.explanation}
                      </p>
                      {/* Distribution breakdown */}
                      <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-400 pt-1 flex-wrap">
                        {Object.entries(feedback.gtoDistribution).map(([act, freq]) => (
                          <span key={act} className={act === feedback.bestAction ? 'text-emerald-400 font-bold' : ''}>
                            {act}: {(freq * 100).toFixed(1)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-400 font-mono">
                      Hand completed. Ready for next practice deal.
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                    {onBack && (
                      <button
                        type="button"
                        onClick={onBack}
                        className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 hover:border-emerald-500/50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Volver a la vista del árbol de decisión y análisis"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Volver a Pensamiento Ideal</span>
                      </button>
                    )}
                    <button
                      onClick={startNewHand}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <span>Siguiente Mano</span>
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Action EV Bar Chart comparing available actions against GTO strategy */}
          <ActionEvBarChart
            currentNode={currentNode}
            strategyResult={nodeStrategies?.get(currentNode.id) || strategyResult}
            heroHand={heroHand}
            chosenActionType={feedback?.chosenAction}
            potSize={currentNode.pot}
          />
        </div>
      )}

      {/* VIEW 2: ATTEMPT HISTORY LOG & ELO STATS */}
      {activeTab === 'history' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white">Historial de Decisiones de Práctica</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Registro de decisiones, diferencias de EV y ajustes de Elo contra la estrategia ideal.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
                <button
                  onClick={() => setFilterGrade('all')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterGrade === 'all' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  All ({attempts.length})
                </button>
                <button
                  onClick={() => setFilterGrade('mistake_threshold')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    filterGrade === 'mistake_threshold' ? 'bg-rose-950 text-rose-300 border border-rose-500/80 font-bold shadow-xs' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Mostrar únicamente decisiones que superaron el umbral de error (>5% de pérdida de EV)"
                >
                  <AlertOctagon className="w-3 h-3 text-rose-400" />
                  <span>Errores &gt;5% EV ({attempts.filter(a => a.isMistakeThresholdExceeded || (a.evLossPercentOfPot !== undefined ? a.evLossPercentOfPot > 5.0 : a.evLossBB > 2.0)).length})</span>
                </button>
                <button
                  onClick={() => setFilterGrade('optimal')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterGrade === 'optimal' ? 'bg-neutral-800 text-emerald-400 font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Optimal
                </button>
                <button
                  onClick={() => setFilterGrade('blunders')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterGrade === 'blunders' ? 'bg-neutral-800 text-rose-400 font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Mistakes / Blunders
                </button>
              </div>

              {attempts.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-lg transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {filteredAttempts.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500 font-mono">
              No training attempts recorded in this filter. Play hands in Live Practice mode to build your record.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Scenario</th>
                    <th className="py-2.5 px-3">Hero Hand</th>
                    <th className="py-2.5 px-3">Action Chosen</th>
                    <th className="py-2.5 px-3">Línea Ideal</th>
                    <th className="py-2.5 px-3">Grade</th>
                    <th className="py-2.5 px-3 text-right">EV Loss</th>
                    <th className="py-2.5 px-3 text-right">Elo Delta</th>
                    <th className="py-2.5 px-3 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {filteredAttempts.map(att => {
                    const isPositive = att.eloChange > 0;
                    return (
                      <tr key={att.id} className="hover:bg-neutral-950/40">
                        <td className="py-2.5 px-3 text-neutral-500">
                          {new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 text-white font-medium truncate max-w-[160px]">
                          {att.scenarioTitle}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {att.heroCombo}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-300">
                          {att.chosenAction} ({(att.chosenFrequency * 100).toFixed(0)}%)
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400">
                          {att.bestAction} ({(att.bestFrequency * 100).toFixed(0)}%)
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            att.grade === 'optimal'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80'
                              : att.grade === 'acceptable'
                              ? 'bg-blue-950/60 text-blue-400 border border-blue-800/80'
                              : att.grade === 'inaccuracy'
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-800/80'
                              : 'bg-red-950/60 text-red-400 border border-red-800/80'
                          }`}>
                            {att.grade.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <div className="flex flex-col items-end">
                            <span className={att.evLossBB > 0 ? 'text-rose-400 font-bold' : 'text-neutral-500'}>
                              {att.evLossBB > 0 ? `-${att.evLossBB} BB` : '0.00 BB'}
                            </span>
                            {att.isMistakeThresholdExceeded && (
                              <span className="text-[9px] font-bold text-rose-300 bg-rose-950 px-1 py-0.5 rounded border border-rose-500/60 flex items-center gap-0.5 mt-0.5">
                                <AlertOctagon className="w-2.5 h-2.5 text-rose-400" />
                                &gt;5% EV Loss {att.evLossPercentOfPot ? `(${att.evLossPercentOfPot}%)` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                            {isPositive ? `+${att.eloChange}` : att.eloChange}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white tabular-nums">
                          {att.newElo}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: RECURRING WEAKNESS PATTERNS (LEARNER AI ENGINE) */}
      {activeTab === 'weaknesses' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-xl space-y-6 animate-fadeIn">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Patrones Recurrentes de Debilidad (Learner IA)
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-300 font-mono">
                    Mistake Threshold &gt; 5% EV
                  </span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Captura tus decisiones subóptimas y las correlaciona con la textura del board para neutralizar tus fugas.
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto text-xs font-mono">
              <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800 text-center">
                <span className="text-[9px] text-neutral-500 uppercase block">Desviaciones &gt;5%:</span>
                <strong className="text-red-400 font-bold">{learnerSummary.criticalMistakesCount}</strong>
              </div>
              <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800 text-center">
                <span className="text-[9px] text-neutral-500 uppercase block">EV Total Perdido:</span>
                <strong className="text-rose-400 font-bold">-{learnerSummary.totalEvLossBBLost} BB</strong>
              </div>
              <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800 text-center">
                <span className="text-[9px] text-neutral-500 uppercase block">Peor Textura:</span>
                <strong className="text-amber-300 truncate block">{learnerSummary.worstTexture}</strong>
              </div>
              <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800 text-center">
                <span className="text-[9px] text-neutral-500 uppercase block">Peor Posición:</span>
                <strong className="text-blue-400 font-bold">{learnerSummary.worstPosition}</strong>
              </div>
            </div>
          </div>

          {/* Weakness Patterns by Texture Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Patrones de Debilidad Agrupados por Textura del Board:</span>
            </h4>

            {learnerSummary.topWeaknessPatterns.length === 0 ? (
              <div className="p-8 text-center bg-neutral-950 rounded-xl border border-neutral-800 text-neutral-500 text-xs">
                ¡No se han detectado patrones de debilidad recurrentes aún! Continúa practicando en el Trainer.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {learnerSummary.topWeaknessPatterns.map(pattern => (
                  <div
                    key={pattern.patternId}
                    className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900 font-mono">
                            {pattern.textureType}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${
                            pattern.severity === 'Crítica'
                              ? 'bg-red-950 text-red-300 border-red-800'
                              : pattern.severity === 'Alta'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                          }`}>
                            Severidad: {pattern.severity}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {pattern.mistakeCount} errores ({pattern.frequencyPct}%)
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-white mt-1">{pattern.title}</h5>
                      </div>

                      <div className="text-right font-mono text-xs">
                        <span className="text-neutral-500 text-[9px] block uppercase">Pérdida EV:</span>
                        <strong className="text-rose-400">-{pattern.totalEvLossBB} BB</strong>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed font-sans bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-850">
                      <strong>Diagnóstico:</strong> {pattern.diagnosis}
                    </p>

                    <div className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-900/40 p-2.5 rounded-lg flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Recomendación Prescriptiva:</strong> {pattern.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feed of Critical Mistakes (>5% EV) */}
          <div className="space-y-3 pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <span>Registro Detallado de Decisiones con Desviación &gt; 5% EV Loss:</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  if (confirm('¿Limpiar registro de debilidades de Learner?')) {
                    LearnerService.getInstance().clearMistakes();
                  }
                }}
                className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpiar Registro</span>
              </button>
            </div>

            {LearnerService.getInstance().getMistakes().length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-xs">
                Cero desviaciones registradas.
              </div>
            ) : (
              <div className="space-y-2.5">
                {LearnerService.getInstance().getMistakes().map(m => (
                  <div
                    key={m.id}
                    className="p-3 bg-neutral-950 border border-red-950/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap font-mono">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900">
                          {m.boardTexture.summary}
                        </span>
                        <span className="text-white font-bold">
                          Hero: {m.heroCombo} ({m.heroPos}) vs {m.villainPos}
                        </span>
                        {m.boardCards.length > 0 && (
                          <span className="text-amber-300 text-[11px]">
                            Board: [{m.boardCards.join(' ')}]
                          </span>
                        )}
                        <span className="text-neutral-400">Bote: {m.potBB} BB</span>
                      </div>
                      <p className="text-neutral-300">
                        Elegiste: <span className="text-rose-300 font-bold">{m.chosenAction}</span> ({(m.chosenFrequency * 100).toFixed(0)}% freq) · GTO Óptimo:{' '}
                        <span className="text-emerald-400 font-bold">{m.bestAction}</span> ({(m.bestFrequency * 100).toFixed(0)}% freq)
                      </p>
                      <p className="text-[11px] text-neutral-400 italic">
                        {m.prescriptiveFix}
                      </p>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold block mb-1">
                        Pérdida EV: -{m.evLossPercentOfPot}% (-{m.evLossBB} BB)
                      </span>
                      <span className="text-[9px] text-neutral-500">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CUSTOM HOLE CARD PICKER MODAL */}
      {isCardPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl flex flex-col gap-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="text-sm font-bold text-white">Select Your Hole Cards</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Pick two distinct cards for Hero ({heroPos}). Community cards are blocked.
                </p>
              </div>
              <button
                onClick={() => setIsCardPickerOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Cards Preview Strip */}
            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-400">Selected Hand:</span>
                <div className="flex items-center gap-1.5">
                  {pickerCard1 ? (
                    renderCard(pickerCard1, 'sm')
                  ) : (
                    <div className="w-10 h-14 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                      Card 1
                    </div>
                  )}
                  {pickerCard2 ? (
                    renderCard(pickerCard2, 'sm')
                  ) : (
                    <div className="w-10 h-14 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                      Card 2
                    </div>
                  )}
                </div>
              </div>

              {pickerCard1 && pickerCard2 && (
                <div className="text-right">
                  <div className="text-sm font-bold text-white font-mono">
                    {createConcreteComboFromCards(pickerCard1, pickerCard2).canonicalName}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    {createConcreteComboFromCards(pickerCard1, pickerCard2).key}
                  </div>
                </div>
              )}
            </div>

            {/* 4-Color Card Picker Grid */}
            <div className="space-y-2.5">
              {SUITS.map(suit => {
                const suitStyle = SUIT_COLORS[suit];
                return (
                  <div key={suit} className="flex items-center gap-1.5">
                    <div className="w-6 text-center">
                      <span className={`text-base font-bold ${suitStyle.text}`}>
                        {SUIT_SYMBOLS[suit]}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-13 gap-1">
                      {RANKS.slice().reverse().map(rank => {
                        const cid = cardId(rank, suit);
                        const isDead = boardCardIds.has(cid);
                        const isSelectedCard1 = pickerCard1?.id === cid;
                        const isSelectedCard2 = pickerCard2?.id === cid;
                        const isSelected = isSelectedCard1 || isSelectedCard2;

                        const currentCard: Card = { rank, suit, id: cid };

                        return (
                          <button
                            key={rank}
                            disabled={isDead}
                            onClick={() => handleCardClickInPicker(currentCard)}
                            className={`h-9 rounded flex items-center justify-center font-bold text-xs transition-all ${
                              isDead
                                ? 'bg-neutral-950 text-neutral-800 line-through cursor-not-allowed border border-neutral-900'
                                : isSelected
                                ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 font-extrabold scale-105 z-10'
                                : `${suitStyle.bg} ${suitStyle.text} border ${suitStyle.border} hover:brightness-125`
                            }`}
                          >
                            {rank}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
              <button
                onClick={() => {
                  setPickerCard1(null);
                  setPickerCard2(null);
                }}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Clear Selection
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCardPickerOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!pickerCard1 || !pickerCard2}
                  onClick={handleApplyCustomCards}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    pickerCard1 && pickerCard2
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Practice With This Hand</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
