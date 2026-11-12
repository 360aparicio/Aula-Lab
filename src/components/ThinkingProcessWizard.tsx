/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ThinkingProcessWizard: Asistente Automatizado del Proceso de Pensamiento Paso a Paso.
 * Estructura la toma de decisiones calle a calle (Preflop -> Flop -> Turn -> River),
 * ajustando automáticamente los rangos, posición y bote según el contexto.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Card, cardId, cardToString, parseCard, SUIT_COLORS, SUIT_SYMBOLS, SUITS, RANKS } from '../engine/cards';
import { evaluateCards, HandCategory } from '../engine/evaluator';
import { TablePosition, TABLE_POSITIONS, POSITION_INFO, getPostflopRole } from './HandAndPositionBar';
import { PreflopActionContext, getAutoMatchupProfile, OpponentProfile, OPPONENT_PROFILES } from '../engine/preflopMatchups';
import { PlayerRange, parseRangeString } from '../engine/range';
import { NodeStrategyResult } from '../engine/dcfr';
import { ActionNode } from '../engine/gameTree';
import { PrebuiltScenario } from '../trainer/prebuiltScenarios';
import { DecisionTreeViewer } from './DecisionTreeViewer';
import { DualCardSelectorModal } from './DualCardSelectorModal';
import { StreetCoachGauge } from './StreetCoachGauge';
import { AutoLearningEngine } from '../engine/autoLearningEngine';
import {
  Sparkles,
  Bookmark,
  Target,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Edit3,
  Shuffle,
  Layers,
  Flame,
  Play,
  HelpCircle,
  TrendingUp,
  Compass,
  Check,
  X,
  ChevronDown,
  Eye,
  EyeOff,
  Database,
  BookOpen,
  Filter,
  UserCheck,
  Fish,
  Shield,
  Scale
} from 'lucide-react';

export interface ThinkingProcessWizardProps {
  heroPos: TablePosition;
  villainPos: TablePosition;
  onHeroPosChange: (pos: TablePosition) => void;
  onVillainPosChange: (pos: TablePosition) => void;
  heroCards: [Card, Card] | null;
  onSelectHeroCards: (card1: Card, card2: Card) => void;
  onRandomHeroCards: () => void;
  boardCards: Card[];
  onBoardChange: (cards: Card[]) => void;
  street: 'flop' | 'turn' | 'river';
  onStreetChange: (street: 'flop' | 'turn' | 'river') => void;
  onUpdateRanges: (oopRange: PlayerRange, ipRange: PlayerRange, startingPot: number) => void;
  strategyResult?: NodeStrategyResult | null;
  gameTree?: ActionNode;
  selectedNodeId?: string;
  onSelectNode?: (node: ActionNode) => void;
  nodeStrategies?: Map<string, NodeStrategyResult>;
  onAdvanceStreet?: (nextStreet: 'flop' | 'turn' | 'river', newCard: Card) => void;
  allScenarios?: PrebuiltScenario[];
  onLoadScenario?: (scenario: PrebuiltScenario) => void;
  oopCombosCount?: number;
  ipCombosCount?: number;
  opponentProfile?: OpponentProfile;
  onOpponentProfileChange?: (profile: OpponentProfile) => void;
  onGoToTrainer?: () => void;
  onGoToSolver?: () => void;
  onSolve?: () => void;
  isSolving?: boolean;
}

export type WizardStep = 'preflop' | 'flop' | 'turn' | 'river';

export const ThinkingProcessWizard: React.FC<ThinkingProcessWizardProps> = ({
  heroPos,
  villainPos,
  onHeroPosChange,
  onVillainPosChange,
  heroCards,
  onSelectHeroCards,
  onRandomHeroCards,
  boardCards,
  onBoardChange,
  street,
  onStreetChange,
  onUpdateRanges,
  strategyResult,
  gameTree,
  selectedNodeId,
  onSelectNode,
  nodeStrategies,
  onAdvanceStreet,
  allScenarios,
  onLoadScenario,
  oopCombosCount,
  ipCombosCount,
  opponentProfile = 'regular',
  onOpponentProfileChange,
  onGoToTrainer,
  onGoToSolver,
  onSolve,
  isSolving
}) => {
  // Wizard active step
  const [activeStep, setActiveStep] = useState<WizardStep>(
    street === 'flop' ? 'flop' : street === 'turn' ? 'turn' : 'river'
  );

  // Preflop context: did someone open before me?
  const [preflopAction, setPreflopAction] = useState<PreflopActionContext>('RFI');

  // Flop / Turn / River decision simulator state
  const [flopRivalAction, setFlopRivalAction] = useState<'check' | 'bet_small' | 'bet_big'>('check');
  const [turnRivalAction, setTurnRivalAction] = useState<'check' | 'bet_barrel'>('check');
  const [riverFacingAction, setRiverFacingAction] = useState<'check' | 'bet_river'>('check');

  // Live Decision Tree & Scenario Database Drawer state
  const [showLiveTree, setShowLiveTree] = useState<boolean>(true);
  const [showScenarioDrawer, setShowScenarioDrawer] = useState<boolean>(false);
  const [scenarioCategoryFilter, setScenarioCategoryFilter] = useState<string>('all');
  const [scenarioSearch, setScenarioSearch] = useState<string>('');

  // Card Picker Modal state
  const [pickerMode, setPickerMode] = useState<'hero' | 'board' | null>(null);
  const [heroPickerSlot, setHeroPickerSlot] = useState<0 | 1>(0);
  const [boardPickerSlot, setBoardPickerSlot] = useState<number>(0);
  const [showDualCardModal, setShowDualCardModal] = useState<boolean>(false);
  const [savedToastStreet, setSavedToastStreet] = useState<string | null>(null);

  const handleSaveWizardHandToSM2 = (currentStreet: 'flop' | 'turn' | 'river') => {
    if (!heroCards) return;
    const cardsStr = `${heroCards[0].rank}${SUIT_SYMBOLS[heroCards[0].suit]} ${heroCards[1].rank}${SUIT_SYMBOLS[heroCards[1].suit]}`;
    const boardSlice = currentStreet === 'flop' ? boardCards.slice(0, 3) : currentStreet === 'turn' ? boardCards.slice(0, 4) : boardCards.slice(0, 5);
    const boardStr = boardSlice.map(c => `${c.rank}${SUIT_SYMBOLS[c.suit]}`).join(' ');

    AutoLearningEngine.getInstance().collectHand({
      heroPos,
      villainPos,
      heroCards: cardsStr,
      board: boardStr,
      street: currentStreet,
      category: boardAnalysis.wetness === 'Seco' ? 'Flop Seco (Dry)' : boardAnalysis.wetness === 'Monótono' ? 'Flop Monótono' : 'Flop Coordinado (Wet)',
      potBB: currentStreet === 'flop' ? matchupProfile.potBB : currentStreet === 'turn' ? Number((matchupProfile.potBB * 1.8).toFixed(1)) : Number((matchupProfile.potBB * 2.8).toFixed(1)),
      chosenAction: 'Analizada en Wizard',
      optimalAction: 'Recomendación Action Gauge',
      evLossPct: 0,
      isMistake: false,
      keyTakeaway: `Spot de ${currentStreet.toUpperCase()} analizado en Wizard: Hero (${heroPos}) vs Villano (${villainPos}). Board: ${boardStr}. SPR: ${(100 / Math.max(1, matchupProfile.potBB)).toFixed(1)}.`
    });

    setSavedToastStreet(currentStreet);
    setTimeout(() => setSavedToastStreet(null), 3000);
  };

  // Sync internal activeStep when street prop changes
  useEffect(() => {
    if (street !== 'flop' && activeStep === 'preflop') return;
    if (street === 'flop' && activeStep !== 'flop' && activeStep !== 'preflop') setActiveStep('flop');
    if (street === 'turn' && activeStep !== 'turn') setActiveStep('turn');
    if (street === 'river' && activeStep !== 'river') setActiveStep('river');
  }, [street]);

  // Scenarios filter list
  const filteredScenarios = useMemo(() => {
    if (!allScenarios) return [];
    return allScenarios.filter(sc => {
      if (scenarioCategoryFilter !== 'all' && sc.category !== scenarioCategoryFilter) {
        return false;
      }
      if (scenarioSearch.trim()) {
        const q = scenarioSearch.toLowerCase();
        return sc.title.toLowerCase().includes(q) || sc.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allScenarios, scenarioCategoryFilter, scenarioSearch]);

  // Compute automatic matchup profile
  const matchupProfile = useMemo(() => {
    return getAutoMatchupProfile(heroPos, villainPos, preflopAction, opponentProfile);
  }, [heroPos, villainPos, preflopAction, opponentProfile]);

  // Apply automatic range & pot synchronization when matchup profile changes
  const applyMatchupAutomatically = () => {
    const isHeroOop = matchupProfile.heroRole === 'OOP';
    const oopStr = isHeroOop ? matchupProfile.heroRangeStr : matchupProfile.villainRangeStr;
    const ipStr = isHeroOop ? matchupProfile.villainRangeStr : matchupProfile.heroRangeStr;

    const oopRange = parseRangeString(oopStr, `${isHeroOop ? heroPos : villainPos} (OOP)`);
    const ipRange = parseRangeString(ipStr, `${isHeroOop ? villainPos : heroPos} (IP)`);

    onUpdateRanges(oopRange, ipRange, matchupProfile.potChips);
  };

  // Run auto-matchup sync when heroPos, villainPos, preflopAction, or opponentProfile changes
  useEffect(() => {
    applyMatchupAutomatically();
  }, [heroPos, villainPos, preflopAction, opponentProfile]);

  // Board texturing analysis
  const boardAnalysis = useMemo(() => {
    if (!boardCards || boardCards.length < 3) {
      return {
        wetness: 'Seco',
        highCard: 'Sin cartas',
        isPaired: false,
        suitTexture: 'Rainbow',
        rangeAdvantage: 'Hero tiene iniciativa preflop',
        desc: 'Introduce al menos 3 cartas comunitarias para analizar la textura.'
      };
    }

    const ranks = boardCards.map(c => '23456789TJQKA'.indexOf(c.rank)).sort((a, b) => b - a);
    const suits = boardCards.map(c => c.suit);
    const suitCounts: Record<string, number> = {};
    suits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
    const maxSuitCount = Math.max(...Object.values(suitCounts));

    const suitTexture = maxSuitCount >= 4 ? '4-Flush' : maxSuitCount === 3 ? 'Monocolor (Flush Draw Activo)' : maxSuitCount === 2 ? 'Dos tonos (Two-tone)' : 'Arcoíris (Rainbow)';
    
    // Check pairs on board
    const rankCounts: Record<string, number> = {};
    boardCards.forEach(c => { rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1; });
    const isPaired = Object.values(rankCounts).some(cnt => cnt >= 2);

    const highRank = boardCards[0]?.rank || 'A';
    const isAceHigh = boardCards.some(c => c.rank === 'A');
    const isKingHigh = boardCards.some(c => c.rank === 'K');

    // Wetness classification
    let wetness = 'Seco (Dry)';
    if (maxSuitCount >= 3 || (!isPaired && Math.abs(ranks[0] - ranks[2]) <= 4)) {
      wetness = 'Muy Conectado / Húmedo (Wet)';
    } else if (maxSuitCount === 2 || Math.abs(ranks[0] - ranks[1]) <= 2) {
      wetness = 'Coordinado / Semi-seco';
    }

    // Range advantage interpretation
    let rangeAdvantage = '';
    if (matchupProfile.aggressor === 'HERO') {
      if (isAceHigh || isKingHigh) {
        rangeAdvantage = `Fuerte ventaja de rango para Hero (${heroPos}). Tu rango tiene todos los sets altos y pares dominantes (AA, KK, AK). Sizing pequeño (33%) a alta frecuencia es muy rentable.`;
      } else {
        rangeAdvantage = `Ventaja de nuts dividida. El rival en ${villainPos} conecta con pares medios y dos parejas bajas. Se recomienda juego polarizado y control de bote.`;
      }
    } else {
      if (isAceHigh || isKingHigh) {
        rangeAdvantage = `El rival (${villainPos}) retiene ventaja de cartas altas y overpairs. Hero en ${heroPos} debe defender con cautela y atrapar faroles con manos medias.`;
      } else {
        rangeAdvantage = `Textura favorable para el rango de defensa de Hero en ${heroPos}. Tienes muchas combinaciones de dos parejas, tríos bajos y proyectos fuertes.`;
      }
    }

    return {
      wetness,
      highCard: highRank,
      isPaired,
      suitTexture,
      rangeAdvantage,
      desc: `Flop con carta alta ${highRank}, textura ${suitTexture} y estructura ${wetness}.`
    };
  }, [boardCards, matchupProfile, heroPos, villainPos]);

  // Hand strength evaluation for Hero if cards and board are present
  const heroHandEval = useMemo(() => {
    if (!heroCards || !boardCards || boardCards.length < 3) return null;
    try {
      const allCards = [heroCards[0], heroCards[1], ...boardCards];
      return evaluateCards(allCards);
    } catch (e) {
      return null;
    }
  }, [heroCards, boardCards]);

  // Card selector helper
  const handleSelectCardModal = (r: any, s: any) => {
    const card: Card = { rank: r, suit: s, id: cardId(r, s) };
    if (pickerMode === 'hero') {
      if (!heroCards) {
        onSelectHeroCards(card, { rank: 'K', suit: 's', id: cardId('K', 's') });
      } else {
        if (heroPickerSlot === 0) {
          onSelectHeroCards(card, heroCards[1]);
        } else {
          onSelectHeroCards(heroCards[0], card);
        }
      }
      setPickerMode(null);
    } else if (pickerMode === 'board') {
      const newBoard = [...boardCards];
      newBoard[boardPickerSlot] = card;
      onBoardChange(newBoard);
      setPickerMode(null);
    }
  };

  // Quick preset board textures
  const setPresetBoard = (cards: string[]) => {
    const parsed = cards.map(parseCard);
    onBoardChange(parsed);
  };

  // Format Card Pill
  const renderCardVisual = (c: Card | null, label = '', onClick?: () => void) => {
    if (!c) {
      return (
        <button
          type="button"
          onClick={onClick}
          className="w-11 h-16 rounded-lg border-2 border-dashed border-neutral-700 hover:border-emerald-500 bg-neutral-950/60 flex flex-col items-center justify-center text-neutral-500 hover:text-emerald-400 text-xs font-mono transition-colors"
        >
          <span>+</span>
          <span className="text-[9px]">{label}</span>
        </button>
      );
    }

    const isRed = c.suit === 'h' || c.suit === 'd';
    return (
      <div
        onClick={onClick}
        className={`w-11 h-16 rounded-lg bg-neutral-950 border border-neutral-700 flex flex-col justify-between p-1 shadow-md cursor-pointer hover:border-emerald-400 transition-colors select-none ${
          isRed ? 'text-rose-400' : 'text-neutral-100'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-bold leading-none">
          <span>{c.rank}</span>
          <span className="text-[11px]">{SUIT_SYMBOLS[c.suit]}</span>
        </div>
        <div className="text-center text-lg leading-none">
          {SUIT_SYMBOLS[c.suit]}
        </div>
        <div className="text-[9px] text-neutral-500 font-mono text-right">
          {label}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-6 relative">
      {/* Top Banner: Process Wizard Title & Steps Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Compass className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Proceso de Pensamiento Paso a Paso</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700">
                Ajuste Automático
              </span>
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Configura tu posición, la acción previa y tus cartas. El laboratorio ajustará automáticamente los rangos ideales y te guiará calle a calle hasta el river.
          </p>
        </div>

        {/* Street Step Buttons & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800 text-xs font-semibold overflow-x-auto">
            {[
              { id: 'preflop', label: '1. Preflop & Posición', streetName: 'flop' as const },
              { id: 'flop', label: '2. El Flop', streetName: 'flop' as const },
              { id: 'turn', label: '3. El Turn', streetName: 'turn' as const },
              { id: 'river', label: '4. El River', streetName: 'river' as const },
            ].map((s) => {
              const isCurrent = activeStep === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveStep(s.id as WizardStep);
                    if (s.id !== 'preflop') {
                      onStreetChange(s.streetName);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isCurrent
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Live Decision Tree Toggle */}
          {gameTree && (
            <button
              type="button"
              onClick={() => setShowLiveTree(!showLiveTree)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showLiveTree
                  ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
              title="Mostrar u ocultar el árbol de decisiones en vivo"
            >
              {showLiveTree ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showLiveTree ? 'Árbol en Vivo' : 'Ver Árbol'}</span>
            </button>
          )}

          {/* Scenario Database Explorer Button */}
          {allScenarios && allScenarios.length > 0 && (
            <button
              type="button"
              onClick={() => setShowScenarioDrawer(true)}
              className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-amber-300 hover:text-amber-200 rounded-xl border border-amber-900/50 hover:border-amber-600/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Explorar la base de datos de 32 escenarios reales"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Base de Datos ({allScenarios.length})</span>
            </button>
          )}

          {onGoToTrainer && (
            <button
              type="button"
              onClick={onGoToTrainer}
              className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded-xl border border-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Practicar mano en Modo Práctica"
            >
              <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
              <span>Práctica</span>
            </button>
          )}

          {onGoToSolver && (
            <button
              type="button"
              onClick={onGoToSolver}
              className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl border border-neutral-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Ver árbol de decisiones y gráfico EV"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Árbol & EV D3</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PASO 1: CONTEXTO PREFLOP, POSICIÓN, ACCIÓN PREVIA Y MIS CARTAS           */}
      {/* ========================================================================= */}
      {activeStep === 'preflop' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Subsection 1: Mi Posición y Rival */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Hero Position */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span>1.1 Tu Posición en la Mesa (Hero)</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                  Rol: {matchupProfile.heroRole}
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {TABLE_POSITIONS.map((pos) => {
                  const isSel = heroPos === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => {
                        onHeroPosChange(pos);
                        if (pos === villainPos) onVillainPosChange(pos === 'BB' ? 'BTN' : 'BB');
                      }}
                      className={`py-2 rounded-lg font-mono font-bold text-xs transition-all ${
                        isSel
                          ? 'bg-emerald-600 text-white shadow-xs border border-emerald-400'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                      }`}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-400">
                {POSITION_INFO[heroPos].full} · {POSITION_INFO[heroPos].name}
              </p>
            </div>

            {/* Right: Villain Position */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                  <span>1.2 Posición del Rival (Villano)</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                  Rol: {matchupProfile.villainRole}
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {TABLE_POSITIONS.map((pos) => {
                  const isSel = villainPos === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => {
                        onVillainPosChange(pos);
                        if (pos === heroPos) onHeroPosChange(pos === 'BTN' ? 'BB' : 'BTN');
                      }}
                      className={`py-2 rounded-lg font-mono font-bold text-xs transition-all ${
                        isSel
                          ? 'bg-rose-600 text-white shadow-xs border border-rose-400'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                      }`}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-400">
                {POSITION_INFO[villainPos].full} · {POSITION_INFO[villainPos].name}
              </p>
            </div>
          </div>

          {/* Subsection 1.3: Perfil del Rival (Nit / Regular / Fish) */}
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>1.3 Tipo de Jugador Rival: ¿Contra quién estás jugando?</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                Ajuste Explotativo Activo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'nit' as const,
                  title: 'Nit (Roca / Tight-Pasivo)',
                  icon: Shield,
                  badge: 'VPIP 12-16%',
                  desc: 'Rango ultra cerrado. Solo va fuerte con monstruos; no farolea en el river.',
                  hint: 'Explota: Roba sus ciegas sin piedad y foldea manos de un par ante sus subidas.'
                },
                {
                  id: 'regular' as const,
                  title: 'Regular (TAG / GTO)',
                  icon: Scale,
                  badge: 'GTO Equilibrado',
                  desc: 'Frecuencias balanceadas de valor y semi-farol con blockers de nuts.',
                  hint: 'Explota: Juega estrategia GTO balanceada, controlando botes y protegiendo rangos.'
                },
                {
                  id: 'fish' as const,
                  title: 'Fish (Ballena / Calling Station)',
                  icon: Fish,
                  badge: 'VPIP 40%+',
                  desc: 'Juega demasiadas manos preflop. Paga apuestas sin odds con proyectos y pares bajos.',
                  hint: 'Explota: Apuesta por valor grande (75%+ pot) y NUNCA intentes faroles puros en el river.'
                }
              ].map((prof) => {
                const isSelected = opponentProfile === prof.id;
                const IconComp = prof.icon;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => onOpponentProfileChange?.(prof.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? prof.id === 'nit'
                          ? 'bg-blue-950/70 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                          : prof.id === 'fish'
                          ? 'bg-amber-950/70 border-amber-500 ring-1 ring-amber-500 shadow-sm'
                          : 'bg-emerald-950/70 border-emerald-500 ring-1 ring-emerald-500 shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <IconComp className="w-3.5 h-3.5" />
                          <span>{prof.title}</span>
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-300 border border-neutral-800">
                          {prof.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                        {prof.desc}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-800/80 text-[10px] text-amber-300 font-medium">
                      💡 {prof.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subsection 2: Dinámica Preflop (¿Alguien abrió antes de mí?) */}
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>1.4 Acción Previa: ¿Alguien abrió la mano antes de ti?</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                Bote Inicial: {matchupProfile.potBB} BB ({matchupProfile.potChips} fichas)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                {
                  id: 'RFI' as const,
                  title: 'Nadie abrió antes',
                  desc: 'Abro yo la mano con Raise (RFI)',
                  tag: 'Iniciativa Hero'
                },
                {
                  id: 'FACING_OPEN' as const,
                  title: 'Rival abrió antes',
                  desc: 'Yo pago la subida (Cold Call)',
                  tag: 'Defensa Hero'
                },
                {
                  id: 'HERO_3BET' as const,
                  title: 'Rival abrió y yo resubí',
                  desc: 'Bote 3-Bet en ataque',
                  tag: 'Bote Grande (~20 BB)'
                },
                {
                  id: 'FACING_3BET' as const,
                  title: 'Yo abrí y rival me resubió',
                  desc: 'Hero defiende ante 3-Bet',
                  tag: 'Defensa 3-Bet'
                },
                {
                  id: 'BVB_LIMP' as const,
                  title: 'Bote Limpeado',
                  desc: 'SB completa y BB pasa',
                  tag: 'Bote Mínimo'
                }
              ].map((act) => {
                const isSelected = preflopAction === act.id;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setPreflopAction(act.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500 shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80 text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{act.title}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">{act.desc}</div>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-950 text-emerald-400 border border-neutral-800 self-start">
                      {act.tag}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Auto-Matchup Status Callout */}
            <div className="p-3 bg-neutral-900 border border-emerald-800/40 rounded-xl flex items-center justify-between text-xs gap-3">
              <div className="space-y-0.5">
                <div className="text-white font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{matchupProfile.spotLabel}</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {matchupProfile.summaryExplanation} Los rangos de {heroPos} y {villainPos} se sincronizaron automáticamente en la matriz 13×13.
                </p>
              </div>
            </div>
          </div>

          {/* Subsection 3: Mis 2 Cartas (Hero Hole Cards) */}
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span>1.4 Mis Cartas de Mano (Hero)</span>
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {heroCards ? `${cardToString(heroCards[0])} ${cardToString(heroCards[1])}` : 'Sin cartas'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Card visual slots */}
              <div className="flex items-center gap-2">
                {renderCardVisual(heroCards ? heroCards[0] : null, 'Carta 1', () => {
                  setShowDualCardModal(true);
                })}
                {renderCardVisual(heroCards ? heroCards[1] : null, 'Carta 2', () => {
                  setShowDualCardModal(true);
                })}
              </div>

              {/* Action buttons */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDualCardModal(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Selector Dual (Rango + Palo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={onRandomHeroCards}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mano Aleatoria</span>
                  </button>
                </div>

                {/* Hand suggestions from this range */}
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 flex-wrap">
                  <span className="text-[10px] text-neutral-500">Manos típicas:</span>
                  {matchupProfile.suggestedHeroHands.map((str) => (
                    <button
                      key={str}
                      type="button"
                      onClick={() => {
                        const c1 = parseCard(str.slice(0, 2));
                        const c2 = parseCard(str.slice(2, 4));
                        onSelectHeroCards(c1, c2);
                      }}
                      className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 font-mono text-[10px] transition-colors"
                    >
                      {str}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Subsection 4: Escenarios Preconfigurados de la Base de Datos */}
          {allScenarios && allScenarios.length > 0 && onLoadScenario && (
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>1.5 Escenarios de la Base de Datos ({allScenarios.length} Spots Reales)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowScenarioDrawer(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Ver todos los {allScenarios.length} escenarios →</span>
                </button>
              </div>

              <p className="text-[11px] text-neutral-400">
                Puedes cargar instantáneamente cualquier situación real con sus rangos exactos de ataque/defensa, tablero y tamaño de bote configurados.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {allScenarios.slice(0, 4).map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      onLoadScenario(sc);
                      setActiveStep(sc.street as WizardStep);
                    }}
                    className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800/80 text-left transition-all flex flex-col justify-between gap-1 group cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {sc.title}
                      </div>
                      <div className="text-[10px] text-neutral-400 line-clamp-2 mt-0.5">
                        {sc.description}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 pt-1 border-t border-neutral-800/60">
                      <span className="text-amber-400 uppercase font-semibold">{sc.street}</span>
                      <span className="text-neutral-500">Bote: {sc.config.startingPot}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action button to Advance to Flop */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setActiveStep('flop');
                onStreetChange('flop');
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
            >
              <span>Avanzar al Flop con estos Rangos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 2: EL FLOP — TEXTURA, VENTAJA DE RANGO Y DECISIÓN DE APUESTA        */}
      {/* ========================================================================= */}
      {activeStep === 'flop' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Flop Board Selector */}
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                <span>2.1 Cartas Comunitarias del Flop (3 Cartas)</span>
              </span>
              <span className="text-xs font-mono text-emerald-400">
                Bote: {matchupProfile.potBB} BB
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                {renderCardVisual(boardCards[0] || null, 'Flop 1', () => {
                  setBoardPickerSlot(0);
                  setPickerMode('board');
                })}
                {renderCardVisual(boardCards[1] || null, 'Flop 2', () => {
                  setBoardPickerSlot(1);
                  setPickerMode('board');
                })}
                {renderCardVisual(boardCards[2] || null, 'Flop 3', () => {
                  setBoardPickerSlot(2);
                  setPickerMode('board');
                })}
              </div>

              {/* Preset buttons */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-neutral-500 font-semibold uppercase">Texturas Frecuentes:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: 'A♠ 7♦ 2♣ (Seco As)', cards: ['As', '7d', '2c'] },
                    { label: 'K♥ J♠ 8♦ (Coordinado)', cards: ['Kh', 'Js', '8d'] },
                    { label: '9♠ 8♠ 4♦ (Mojado / Wet)', cards: ['9s', '8s', '4d'] },
                    { label: 'Q♥ Q♦ 5♣ (Emparejado)', cards: ['Qh', 'Qd', '5c'] },
                    { label: 'J♠ 7♠ 2♠ (Monocolor)', cards: ['Js', '7s', '2s'] },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPresetBoard(p.cards)}
                      className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] font-mono transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Automatic Flop Texture & Range Advantage Card */}
          <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-neutral-900 to-neutral-900 border border-cyan-800/40 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>2.2 Diagnóstico del Flop & Ventaja de Rango</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-700 font-bold">
                {boardAnalysis.wetness}
              </span>
            </div>

            <p className="text-xs text-neutral-200 leading-relaxed">
              {boardAnalysis.rangeAdvantage}
            </p>

            {heroHandEval && (
              <div className="p-2.5 bg-neutral-950/80 rounded-lg border border-neutral-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-neutral-400">Tu Mano en este Flop: </span>
                  <strong className="text-white font-mono">{heroHandEval.description}</strong>
                  <span className="text-emerald-400 font-semibold ml-2">({heroHandEval.categoryName})</span>
                </div>
              </div>
            )}
          </div>

          {/* Decision Simulation on Flop */}
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>2.3 Apuestas y Decisiones en el Flop</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300">
                {matchupProfile.heroRole === 'IP' ? 'Hero en Posición (IP · Actúa 2º)' : 'Hero Fuera de Posición (OOP · Actúa 1º)'}
              </span>
            </div>

            {matchupProfile.heroRole === 'OOP' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFlopRivalAction('check')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    flopRivalAction === 'check'
                      ? 'bg-emerald-950/60 border-emerald-500 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="text-xs font-bold text-white">Línea Óptima: Pasar (Check)</div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Estrategia estándar fuera de posición (~90% frecuencia) para proteger todo el rango de defensa.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFlopRivalAction('bet_small')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    flopRivalAction === 'bet_small'
                      ? 'bg-emerald-950/60 border-emerald-500 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="text-xs font-bold text-white">Rival apuesta C-Bet 33%</div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Requiere 20% pot odds. <strong>Pagar (Call)</strong> con proyectos y pares medios; <strong>Check-Raise</strong> con monstruos y draws fuertes.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFlopRivalAction('bet_big')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    flopRivalAction === 'bet_big'
                      ? 'bg-emerald-950/60 border-emerald-500 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="text-xs font-bold text-white">Rival apuesta fuerte (75%)</div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Requiere 30% pot odds. <strong>Fold</strong> aire sin proyecto; <strong>Call</strong> con Top Pair fuerte o combos de alta equity.
                  </div>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFlopRivalAction('check')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    flopRivalAction === 'check'
                      ? 'bg-emerald-950/60 border-emerald-500 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="text-xs font-bold text-white">Rival pasa (Check)</div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Hero en posición: <strong>C-Bet 33%</strong> a alta frecuencia para presión por rango, o <strong>Check behind</strong> para control de bote.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFlopRivalAction('bet_small')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    flopRivalAction === 'bet_small'
                      ? 'bg-emerald-950/60 border-emerald-500 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="text-xs font-bold text-white">Rival hace Donk Bet 33%</div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    <strong>Pagar (Call)</strong> con amplio rango de valor y proyectos; <strong>Subir (Raise)</strong> con overpairs y semifaroles con equity.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFlopRivalAction('bet_big')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    flopRivalAction === 'bet_big'
                      ? 'bg-emerald-950/60 border-emerald-500 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="text-xs font-bold text-white">Rival hace Donk Bet fuerte (75%)</div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Línea polarizada: <strong>Fold</strong> con aire; <strong>Call</strong> con Top Pair+; <strong>Raise</strong> con las mejores combinaciones.
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* IA Coach & Action Gauge for Flop */}
          <StreetCoachGauge
            street="flop"
            heroPos={heroPos}
            villainPos={villainPos}
            heroCards={heroCards}
            boardCards={boardCards.slice(0, 3)}
            potSizeBB={matchupProfile.potBB}
            effectiveStackBB={100}
            opponentProfile={opponentProfile || 'regular'}
            handCategory={heroHandEval?.categoryName as any}
            isHeroIP={matchupProfile.heroRole === 'IP'}
          />

          {/* Quick 1-Click Save to SM-2 Flashcards */}
          <div className="flex items-center justify-between p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <Bookmark className="w-4 h-4 text-blue-400" />
              <span>¿Quieres retener este spot? Guárdalo en tu sistema de repetición espaciada:</span>
            </div>
            <button
              type="button"
              onClick={() => handleSaveWizardHandToSM2('flop')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                savedToastStreet === 'flop'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
              }`}
            >
              <span>{savedToastStreet === 'flop' ? '✓ Mano Guardada en SM-2' : '🧠 Guardar Spot en SM-2'}</span>
            </button>
          </div>

          {/* Navigation to Turn */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveStep('preflop')}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors"
            >
              ← Volver al Preflop
            </button>
            <button
              type="button"
              onClick={() => {
                // If board doesn't have 4th card, add a default turn card
                if (boardCards.length < 4) {
                  const defaultTurn = parseCard('8h');
                  onBoardChange([...boardCards.slice(0, 3), defaultTurn]);
                }
                setActiveStep('turn');
                onStreetChange('turn');
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
            >
              <span>Avanzar al Turn con esta Acción</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 3: EL TURN — RUNOUT Y SEGUNDA BALA                                  */}
      {/* ========================================================================= */}
      {activeStep === 'turn' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span>3.1 La 4ª Carta Comunitaria (Turn)</span>
              </span>
              <span className="text-xs font-mono text-emerald-400">
                Bote acumulado: ~12 BB
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {renderCardVisual(boardCards[0] || null, 'Flop 1')}
                {renderCardVisual(boardCards[1] || null, 'Flop 2')}
                {renderCardVisual(boardCards[2] || null, 'Flop 3')}
                <span className="text-neutral-600 font-bold px-1">➔</span>
                {renderCardVisual(boardCards[3] || null, 'Turn', () => {
                  setBoardPickerSlot(3);
                  setPickerMode('board');
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setBoardPickerSlot(3);
                  setPickerMode('board');
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
              >
                Cambiar Carta del Turn
              </button>
            </div>
          </div>

          {/* Turn Runout Impact & Hand Strength */}
          <div className="p-4 bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-900 border border-amber-800/40 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Impacto del Runout en el Turn ({boardCards[3] ? cardToString(boardCards[3]) : 'Carta'})</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                Bote: ~12-16 BB
              </span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              La carta del turn altera las texturas de proyectos. Si completó color o escalera, el rango del jugador agresor debe polarizarse hacia apuestas fuertes (66-75% pot) con manos monstruo y faroles con blockers, pasando con pares medios.
            </p>

            {heroHandEval && (
              <div className="p-2.5 bg-neutral-950/80 rounded-lg border border-neutral-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-neutral-400">Tu Mano con la carta del Turn: </span>
                  <strong className="text-white font-mono">{heroHandEval.description}</strong>
                  <span className="text-amber-400 font-semibold ml-2">({heroHandEval.categoryName})</span>
                </div>
              </div>
            )}
          </div>

          {/* Turn Decision Simulation */}
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>3.2 Decisión y Apuestas en el Turn (Segunda Bala)</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300">
                Línea Óptima Postflop
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTurnRivalAction('bet_barrel')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  turnRivalAction === 'bet_barrel'
                    ? 'bg-amber-950/60 border-amber-500 shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
              >
                <div className="text-xs font-bold text-white">Segunda Bala (Barrel 66% - 75%)</div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Recomendado para manos monstruo (Dobles, Tríos, Overpairs fuertes) y faroles con blockers de nuts.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTurnRivalAction('check')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  turnRivalAction === 'check'
                    ? 'bg-amber-950/60 border-amber-500 shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
              >
                <div className="text-xs font-bold text-white">Control de Bote (Pot Control / Check)</div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Pasar con manos medias de showdown (2º par, Top pair kicker medio) para no inflar el bote y llegar barato al river.
                </div>
              </button>

              <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/60 text-left">
                <div className="text-xs font-bold text-cyan-400">Pot Odds ante Apuesta en Turn</div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Si rival apuesta 50% pot, requieres <strong>25% de equity</strong>. Proyectos de 8 outs (17%) necesitan implied odds para pagar.
                </div>
              </div>
            </div>
          </div>

          {/* IA Coach & Action Gauge for Turn */}
          <StreetCoachGauge
            street="turn"
            heroPos={heroPos}
            villainPos={villainPos}
            heroCards={heroCards}
            boardCards={boardCards.slice(0, 4)}
            potSizeBB={Number((matchupProfile.potBB * 1.8).toFixed(1))}
            effectiveStackBB={90}
            opponentProfile={opponentProfile || 'regular'}
            handCategory={heroHandEval?.categoryName as any}
            isHeroIP={matchupProfile.heroRole === 'IP'}
          />

          {/* Quick 1-Click Save to SM-2 Flashcards */}
          <div className="flex items-center justify-between p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <Bookmark className="w-4 h-4 text-blue-400" />
              <span>¿Decisión crítica en el Turn? Guárdala para repaso espaciado:</span>
            </div>
            <button
              type="button"
              onClick={() => handleSaveWizardHandToSM2('turn')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                savedToastStreet === 'turn'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
              }`}
            >
              <span>{savedToastStreet === 'turn' ? '✓ Turn Guardado en SM-2' : '🧠 Guardar Turn en SM-2'}</span>
            </button>
          </div>

          {/* Navigation to River */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setActiveStep('flop');
                onStreetChange('flop');
              }}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors"
            >
              ← Volver al Flop
            </button>
            <button
              type="button"
              onClick={() => {
                if (boardCards.length < 5) {
                  const defaultRiver = parseCard('2s');
                  onBoardChange([...boardCards.slice(0, 4), defaultRiver]);
                }
                setActiveStep('river');
                onStreetChange('river');
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
            >
              <span>Avanzar al River (Decisión Final)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 4: EL RIVER — SHOWDOWN, VALUE BET VS FAROL & VEREDICTO FINAL        */}
      {/* ========================================================================= */}
      {activeStep === 'river' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Full Board */}
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                <span>4.1 Board Completo en el River (5 Cartas)</span>
              </span>
              <span className="text-xs font-mono text-emerald-400">
                Bote Final: ~28 BB
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {renderCardVisual(boardCards[0] || null, 'Flop 1')}
              {renderCardVisual(boardCards[1] || null, 'Flop 2')}
              {renderCardVisual(boardCards[2] || null, 'Flop 3')}
              {renderCardVisual(boardCards[3] || null, 'Turn')}
              <span className="text-neutral-600 font-bold px-0.5">➔</span>
              {renderCardVisual(boardCards[4] || null, 'River', () => {
                setBoardPickerSlot(4);
                setPickerMode('board');
              })}
            </div>
          </div>

          {/* Final Hand & Execution Verdict */}
          {heroHandEval && (
            <div className="p-4 bg-gradient-to-r from-emerald-950/50 via-neutral-900 to-neutral-900 border-2 border-emerald-500/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Veredicto del Proceso de Pensamiento en el River</span>
                </span>
                <span className="text-xs font-mono font-bold bg-neutral-950 px-2.5 py-0.5 rounded text-white border border-neutral-800">
                  {heroHandEval.description}
                </span>
              </div>

              <div className="text-xs text-neutral-300 leading-relaxed space-y-2">
                <p>
                  <strong>Categoría de Mano:</strong> {heroHandEval.categoryName}. En el river ya no existen proyectos; cada mano es <em>Valor Puro</em>, <em>Atrapafaroles (Bluff Catcher)</em> o <em>Farol Total</em>.
                </p>
                <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 font-mono text-[11px] text-emerald-300">
                  {heroHandEval.category >= HandCategory.TwoPair ? (
                    <span>★ MANO DE VALOR: Realiza una apuesta por valor (66% a 75% pot) para extraer fichas de parejas peores del rival.</span>
                  ) : heroHandEval.category === HandCategory.OnePair ? (
                    <span>⚖ BLUFF CATCHER: Pasa para inducir faroles del rival o pagar apuestas moderadas si el rival tiene suficientes faroles no completados.</span>
                  ) : (
                    <span>⚔ FAROL O ABANDONO: Sin valor en showdown. Si tienes blockers de escalera o color, considera farolear; de lo contrario, pasa y ríndete si enfrentas apuesta.</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                {onGoToTrainer && (
                  <button
                    type="button"
                    onClick={onGoToTrainer}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Practicar esta Mano en Modo Práctica →</span>
                  </button>
                )}

                {onGoToSolver && (
                  <button
                    type="button"
                    onClick={onGoToSolver}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-neutral-700 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Ver Árbol y Gráfico EV en Pensamiento Ideal →</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveStep('preflop');
                    onStreetChange('flop');
                  }}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-800 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Configurar Otra Mano</span>
                </button>
              </div>
            </div>
          )}

          {/* IA Coach & Action Gauge for River */}
          <StreetCoachGauge
            street="river"
            heroPos={heroPos}
            villainPos={villainPos}
            heroCards={heroCards}
            boardCards={boardCards.slice(0, 5)}
            potSizeBB={Number((matchupProfile.potBB * 2.8).toFixed(1))}
            effectiveStackBB={75}
            opponentProfile={opponentProfile || 'regular'}
            handCategory={heroHandEval?.categoryName as any}
            isHeroIP={matchupProfile.heroRole === 'IP'}
          />

          {/* Quick 1-Click Save to SM-2 Flashcards */}
          <div className="flex items-center justify-between p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <Bookmark className="w-4 h-4 text-blue-400" />
              <span>¿Veredicto de River difícil? Guárdalo en SM-2 para afianzar el showdown:</span>
            </div>
            <button
              type="button"
              onClick={() => handleSaveWizardHandToSM2('river')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                savedToastStreet === 'river'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
              }`}
            >
              <span>{savedToastStreet === 'river' ? '✓ River Guardado en SM-2' : '🧠 Guardar River en SM-2'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ÁRBOL DE DECISIÓN EN VIVO & ALERTAS DE CONVERGENCIA GTO                   */}
      {/* ========================================================================= */}
      {showLiveTree && gameTree && onSelectNode && (
        <div className="bg-neutral-950/80 rounded-2xl border border-neutral-800 p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                <Layers className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Árbol de Decisión en Vivo · Calle: {street.toUpperCase()}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Actualizado en Tiempo Real
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onSolve && (
                <button
                  type="button"
                  onClick={onSolve}
                  disabled={isSolving}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isSolving ? 'Calculando...' : 'Recalcular Árbol'}</span>
                </button>
              )}
            </div>
          </div>

          <DecisionTreeViewer
            rootNode={gameTree}
            selectedNodeId={selectedNodeId || gameTree.id}
            onSelectNode={onSelectNode}
            nodeStrategies={nodeStrategies}
            currentStreet={street}
            boardCards={boardCards}
            heroPos={heroPos}
            villainPos={villainPos}
            heroCards={heroCards}
            onAdvanceStreet={onAdvanceStreet}
            onRefineSolve={onSolve}
            isSolving={isSolving}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL / DRAWER EXPLORADOR DE BASE DE DATOS (32 ESCENARIOS)                */}
      {/* ========================================================================= */}
      {showScenarioDrawer && allScenarios && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Base de Datos de Escenarios Reales ({allScenarios.length} Spots)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScenarioDrawer(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filters Bar */}
            <div className="p-3 border-b border-neutral-800/80 bg-neutral-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                {[
                  { id: 'all', label: `Todos (${allScenarios.length})` },
                  { id: 'single-raised', label: 'Bote Subido (SRP)' },
                  { id: 'three-bet', label: 'Bote 3-Bet' },
                  { id: 'blind-vs-blind', label: 'Guerra de Ciegas' },
                  { id: 'turn-probe', label: 'Turn Dinámico' },
                  { id: 'river-decision', label: 'River Showdown' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setScenarioCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      scenarioCategoryFilter === cat.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Buscar por cartas, título..."
                value={scenarioSearch}
                onChange={e => setScenarioSearch(e.target.value)}
                className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 w-48"
              />
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredScenarios.map(sc => (
                <div
                  key={sc.id}
                  className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 flex flex-col justify-between gap-2 group transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                        {sc.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-amber-400 border border-neutral-800 uppercase font-semibold">
                        {sc.street}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                      {sc.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-900">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-neutral-500">Board:</span>
                      <span className="font-mono text-emerald-400 font-bold text-[11px]">
                        {sc.boardCards.join(' ')}
                      </span>
                    </div>

                    {onLoadScenario && (
                      <button
                        type="button"
                        onClick={() => {
                          onLoadScenario(sc);
                          setActiveStep(sc.street as WizardStep);
                          setShowScenarioDrawer(false);
                        }}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cargar Escenario
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 52-Card Universal Picker Modal */}
      {pickerMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-xl w-full p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{pickerMode === 'hero' ? 'Seleccionar Carta de Hero' : `Seleccionar Carta Comunitaria (Slot ${boardPickerSlot + 1})`}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPickerMode(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of suits and ranks */}
            <div className="space-y-2.5">
              {SUITS.map(suit => {
                const isRed = suit === 'h' || suit === 'd';
                return (
                  <div key={suit} className="flex items-center gap-1.5">
                    <span className={`w-6 text-center font-bold text-sm ${isRed ? 'text-rose-400' : 'text-neutral-300'}`}>
                      {SUIT_SYMBOLS[suit]}
                    </span>
                    <div className="grid grid-cols-13 gap-1 flex-1">
                      {RANKS.map(rank => {
                        const id = cardId(rank, suit);
                        // Check if card is already taken on board or hero
                        const isTaken = (heroCards && (heroCards[0]?.id === id || heroCards[1]?.id === id)) ||
                                        (boardCards && boardCards.some(c => c?.id === id));
                        return (
                          <button
                            key={rank}
                            type="button"
                            disabled={isTaken}
                            onClick={() => handleSelectCardModal(rank, suit)}
                            className={`py-1.5 rounded text-xs font-mono font-bold transition-all ${
                              isTaken
                                ? 'bg-neutral-950 text-neutral-600 border border-neutral-900 cursor-not-allowed opacity-40'
                                : isRed
                                ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-900'
                                : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white border border-neutral-700'
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
          </div>
        </div>
      )}
      {/* Dual Card Selector Modal (Rank + Suit in 1 step) */}
      <DualCardSelectorModal
        isOpen={showDualCardModal}
        onClose={() => setShowDualCardModal(false)}
        onSelect={(c1, c2) => {
          onSelectHeroCards(c1, c2);
          setShowDualCardModal(false);
        }}
        initialCards={heroCards}
        excludedCards={boardCards}
      />
    </div>
  );
};
