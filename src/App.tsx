/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Allin School — Plataforma propietaria de entrenamiento 6-Max,
 * motor de equilibrio Lab Studio DCFR y sistema TheTracker2.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, parseCard } from './engine/cards';
import { DCFRConfig, DEFAULT_DCFR_CONFIG, NodeStrategyResult, SolveResult } from './engine/dcfr';
import { ActionNode, buildGameTree, DEFAULT_TREE_CONFIG, getAllActionNodes, TreeConfig } from './engine/gameTree';
import { getRangeActiveCombos, parseRangeString, PlayerRange } from './engine/range';
import { AsyncSolverRunner, SolverProgress } from './engine/solverRunner';
import { PREBUILT_SCENARIOS, PrebuiltScenario } from './trainer/prebuiltScenarios';

import { Header, NavTab } from './components/Header';
import { StepByStepThinkingBar } from './components/StepByStepThinkingBar';
import { HandScenariosCard } from './components/HandScenariosCard';
import { RangeMatrix13x13 } from './components/RangeMatrix13x13';
import { DecisionTreeViewer } from './components/DecisionTreeViewer';
import { StrategyMatrixView } from './components/StrategyMatrixView';
import { NodeEvDistributionChart } from './components/NodeEvDistributionChart';
import { TrainerModule } from './components/TrainerModule';
import { TrainerMode } from './components/TrainerMode';
import { HandHistoryImporter } from './components/HandHistoryImporter';
import { ThinkingProcessWizard } from './components/ThinkingProcessWizard';
import { ScenarioManager } from './components/ScenarioManager';
import { BenchmarkAndDocs } from './components/BenchmarkAndDocs';
import { PositionalCheatSheet } from './components/PositionalCheatSheet';
import { AcademyRoadmapDashboard } from './components/AcademyRoadmapDashboard';
import type { SimPosition, SimScenarioType } from './engine/handSimulator';
import type { ParsedHandRecord } from './engine/theTracker2Engine';
import { PlayerLiveCoachTracker } from './components/PlayerLiveCoachTracker';
import { SolverMetaPanel } from './components/SolverMetaPanel';
import { TreeConfigPanel } from './components/TreeConfigPanel';
import { HandAndPositionBar, TablePosition, getPostflopRole } from './components/HandAndPositionBar';
import { BoardSelector } from './components/BoardSelector';
import { HandContextBar } from './components/HandContextBar';
import { PreflopActionContext, getAutoMatchupProfile, OpponentProfile } from './engine/preflopMatchups';
import { SolverMetaUpdater } from './engine/solverMetaUpdater';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { PlanBenefitsModal } from './components/PlanBenefitsModal';
import { SupportTicketModal } from './components/SupportTicketModal';
import { FundamentalsModule } from './components/FundamentalsModule';
import { Onboarding60sBanner } from './components/OnboardingAndLeaksBar';
import { LAB_SECTION_META } from './lib/planCatalog';
import {
  EXPERIENCE_LEVEL_META,
  loadExperienceMode,
  loadOnboardingState,
  resetOnboardingState,
  saveExperienceMode,
  saveOnboardingState,
  type ExperienceLevel,
  type OnboardingGoal,
  type OnboardingState
} from './lib/experienceMode';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';

import { Play, Pause, Square, SlidersHorizontal, Compass, Lock, Crown, Megaphone, X, Sparkles } from 'lucide-react';

interface LiveAnnouncementBanner {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning';
  targetPlan: 'all' | 'free' | 'pro' | 'elite';
}

export default function App() {
  const { user, isAuthReady, isPlanActive } = useAuth();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-9 h-9 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <div className="text-sm font-bold text-white">Allin School · Allin Studio</div>
          <div className="text-xs text-neutral-400">Verificando sesión, Lab Studio, TheTracker2 y beneficios de tu plan...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen mode="login" />;
  }

  if (!isPlanActive) {
    return <LoginScreen mode="inactive" />;
  }

  return <LabWorkspace key={user.uid} />;
}

function LabWorkspace() {
  const { user, isAuthReady, isAdmin, planTier, planPermissions, activePlanConfig, canAccessSection } = useAuth();
  const canEditSolver = isAdmin || planTier === 'pro' || planTier === 'elite' || Boolean(planPermissions?.labPro);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(() => loadExperienceMode());
  const [activeTab, setActiveTab] = useState<NavTab>(() =>
    loadExperienceMode() === 'beginner' ? 'fundamentals' : 'wizard'
  );
  const [previousTab, setPreviousTab] = useState<NavTab>('wizard');
  const [trainerViewMode, setTrainerViewMode] = useState<'live6max' | 'arena_dcfr'>('live6max');
  const [drillTarget, setDrillTarget] = useState<{
    pos: SimPosition | 'RANDOM';
    scenario: SimScenarioType | 'RANDOM';
    nonce: number;
  } | null>(null);
  const [showPlanBenefitsModal, setShowPlanBenefitsModal] = useState<boolean>(false);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [announcements, setAnnouncements] = useState<LiveAnnouncementBanner[]>([]);
  const [dismissedAnnIds, setDismissedAnnIds] = useState<string[]>([]);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(() => loadOnboardingState());

  const handleExperienceLevelChange = (lvl: ExperienceLevel) => {
    setExperienceLevel(lvl);
    saveExperienceMode(lvl);
  };

  const handleOnboardingGoal = (goal: OnboardingGoal) => {
    const next: OnboardingState = {
      completed: true,
      dismissed: false,
      goal,
      completedAt: Date.now()
    };
    saveOnboardingState(next);
    setOnboardingState(next);

    if (goal === 'learn_zero') {
      handleExperienceLevelChange('beginner');
      setActiveTab('fundamentals');
    } else if (goal === 'analyze_hands') {
      handleExperienceLevelChange('recreational');
      setActiveTab('tracker2');
    } else {
      handleExperienceLevelChange('pro');
      setTrainerViewMode('live6max');
      setActiveTab('trainer');
    }
  };

  const handleDismissOnboarding = () => {
    const next: OnboardingState = { ...onboardingState, dismissed: true };
    saveOnboardingState(next);
    setOnboardingState(next);
  };

  const handleReopenOnboarding = () => {
    resetOnboardingState();
    setOnboardingState({ completed: false, dismissed: false });
  };

  // Positions & Preflop Action Context
  const [heroPos, setHeroPos] = useState<TablePosition>('BTN');
  const [villainPos, setVillainPos] = useState<TablePosition>('BB');
  const [preflopAction, setPreflopAction] = useState<PreflopActionContext>('RFI');
  const [opponentProfile, setOpponentProfile] = useState<OpponentProfile>('regular');
  const [heroCards, setHeroCards] = useState<[Card, Card] | null>(null);

  // Scenario state
  const [allScenarios, setAllScenarios] = useState<PrebuiltScenario[]>(PREBUILT_SCENARIOS);
  const [activeScenario, setActiveScenario] = useState<PrebuiltScenario>(PREBUILT_SCENARIOS[0]);
  const [street, setStreet] = useState<'flop' | 'turn' | 'river'>(activeScenario.street);
  const [boardCards, setBoardCards] = useState<Card[]>(
    activeScenario.boardCards.map(parseCard)
  );
  const [oopRange, setOopRange] = useState<PlayerRange>(
    parseRangeString(activeScenario.oopRangeStr, 'OOP Defense Range')
  );
  const [ipRange, setIpRange] = useState<PlayerRange>(
    parseRangeString(activeScenario.ipRangeStr, 'IP Attack Range')
  );
  const [treeConfig, setTreeConfig] = useState<TreeConfig>(activeScenario.config);
  const [dcfrConfig, setDcfrConfig] = useState<DCFRConfig>(DEFAULT_DCFR_CONFIG);
  const [scenarioTitle, setScenarioTitle] = useState<string>(activeScenario.title);

  // Active decision tree
  const gameTree = useMemo(() => {
    return buildGameTree({ ...treeConfig, street });
  }, [treeConfig, street]);

  const [selectedNode, setSelectedNode] = useState<ActionNode>(gameTree);

  // Update selected node when game tree changes
  useEffect(() => {
    setSelectedNode(gameTree);
  }, [gameTree]);

  // Active unblocked combos for both players
  const oopCombos = useMemo(() => {
    return getRangeActiveCombos(oopRange, boardCards);
  }, [oopRange, boardCards]);

  const ipCombos = useMemo(() => {
    return getRangeActiveCombos(ipRange, boardCards);
  }, [ipRange, boardCards]);

  // Solver Runner
  const runnerRef = useRef<AsyncSolverRunner | null>(null);
  const [solverProgress, setSolverProgress] = useState<SolverProgress | null>(null);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  useEffect(() => {
    runnerRef.current = new AsyncSolverRunner();
    void SolverMetaUpdater.getInstance().fetchFromServer();
  }, []);

  const handleStartSolve = () => {
    if (!runnerRef.current) return;
    if (oopCombos.length === 0 || ipCombos.length === 0) {
      setSolverError('No se puede calcular: uno de los rangos tiene 0 combos activos en este board.');
      return;
    }
    setSolverError(null);

    const runner = runnerRef.current;
    runner.init(gameTree, boardCards, oopCombos, ipCombos, {
      ...dcfrConfig,
      simulateFutureStreets: dcfrConfig.simulateFutureStreets ?? boardCards.length < 5
    });

    runner.setCallbacks({
      onProgress: (prog) => {
        setSolverProgress({ ...prog });
      },
      onComplete: (res) => {
        setSolveResult(res);
        setSolverProgress(null);
      },
      onError: (err) => {
        console.error('Error de cálculo:', err);
        setSolverProgress(null);
      }
    });

    runner.start();
  };

  const handlePauseSolve = () => {
    runnerRef.current?.pause();
  };

  const handleResumeSolve = () => {
    runnerRef.current?.resume();
  };

  const handleCancelSolve = () => {
    runnerRef.current?.cancel();
    setSolverProgress(null);
  };

  // Ensure default hero cards when combos load
  useEffect(() => {
    if (!heroCards) {
      const isIp = getPostflopRole(heroPos, villainPos) === 'IP';
      const activeCombos = isIp ? ipCombos : oopCombos;
      if (activeCombos.length > 0) {
        setHeroCards([activeCombos[0].combo.card1, activeCombos[0].combo.card2]);
      }
    }
  }, [ipCombos, oopCombos, heroPos, villainPos, heroCards]);

  const handleOpponentProfileChange = (profile: OpponentProfile) => {
    setOpponentProfile(profile);
    const matchup = getAutoMatchupProfile(heroPos, villainPos, preflopAction, profile);
    const isHeroOop = matchup.heroRole === 'OOP';
    const oopStr = isHeroOop ? matchup.heroRangeStr : matchup.villainRangeStr;
    const ipStr = isHeroOop ? matchup.villainRangeStr : matchup.heroRangeStr;

    setOopRange(parseRangeString(oopStr, `${isHeroOop ? heroPos : villainPos} (OOP)`));
    setIpRange(parseRangeString(ipStr, `${isHeroOop ? villainPos : heroPos} (IP)`));
    setTreeConfig(prev => ({
      ...prev,
      startingPot: matchup.potChips,
      effectiveStack: Math.round(matchup.effectiveStackBB * 10)
    }));
    setScenarioTitle(matchup.spotLabel);
  };

  const handlePreflopActionChange = (action: PreflopActionContext) => {
    setPreflopAction(action);
    const profile = getAutoMatchupProfile(heroPos, villainPos, action, opponentProfile);
    const isHeroOop = profile.heroRole === 'OOP';
    const oopStr = isHeroOop ? profile.heroRangeStr : profile.villainRangeStr;
    const ipStr = isHeroOop ? profile.villainRangeStr : profile.heroRangeStr;

    setOopRange(parseRangeString(oopStr, `${isHeroOop ? heroPos : villainPos} (OOP)`));
    setIpRange(parseRangeString(ipStr, `${isHeroOop ? villainPos : heroPos} (IP)`));
    setTreeConfig(prev => ({
      ...prev,
      startingPot: profile.potChips,
      effectiveStack: Math.round(profile.effectiveStackBB * 10)
    }));
    setScenarioTitle(profile.spotLabel);
  };

  const handleHeroPosChange = (pos: TablePosition) => {
    setHeroPos(pos);
    const vPos = pos === villainPos ? (pos === 'BB' ? 'BTN' : 'BB') : villainPos;
    if (pos === villainPos) {
      setVillainPos(vPos);
    }
    const profile = getAutoMatchupProfile(pos, vPos, preflopAction, opponentProfile);
    const isHeroOop = profile.heroRole === 'OOP';
    const oopStr = isHeroOop ? profile.heroRangeStr : profile.villainRangeStr;
    const ipStr = isHeroOop ? profile.villainRangeStr : profile.heroRangeStr;

    setOopRange(parseRangeString(oopStr, `${isHeroOop ? pos : vPos} (OOP)`));
    setIpRange(parseRangeString(ipStr, `${isHeroOop ? vPos : pos} (IP)`));
    setTreeConfig(prev => ({
      ...prev,
      startingPot: profile.potChips,
      effectiveStack: Math.round(profile.effectiveStackBB * 10)
    }));
    setScenarioTitle(profile.spotLabel);
  };

  const handleVillainPosChange = (pos: TablePosition) => {
    setVillainPos(pos);
    const hPos = pos === heroPos ? (pos === 'BB' ? 'BTN' : 'BB') : heroPos;
    if (pos === heroPos) {
      setHeroPos(hPos);
    }
    const profile = getAutoMatchupProfile(hPos, pos, preflopAction, opponentProfile);
    const isHeroOop = profile.heroRole === 'OOP';
    const oopStr = isHeroOop ? profile.heroRangeStr : profile.villainRangeStr;
    const ipStr = isHeroOop ? profile.villainRangeStr : profile.heroRangeStr;

    setOopRange(parseRangeString(oopStr, `${isHeroOop ? hPos : pos} (OOP)`));
    setIpRange(parseRangeString(ipStr, `${isHeroOop ? pos : hPos} (IP)`));
    setTreeConfig(prev => ({
      ...prev,
      startingPot: profile.potChips,
      effectiveStack: Math.round(profile.effectiveStackBB * 10)
    }));
    setScenarioTitle(profile.spotLabel);
  };

  const handleSwapPositions = () => {
    const newHero = villainPos;
    const newVillain = heroPos;
    setHeroPos(newHero);
    setVillainPos(newVillain);
    const profile = getAutoMatchupProfile(newHero, newVillain, preflopAction, opponentProfile);
    const isHeroOop = profile.heroRole === 'OOP';
    const oopStr = isHeroOop ? profile.heroRangeStr : profile.villainRangeStr;
    const ipStr = isHeroOop ? profile.villainRangeStr : profile.heroRangeStr;

    setOopRange(parseRangeString(oopStr, `${isHeroOop ? newHero : newVillain} (OOP)`));
    setIpRange(parseRangeString(ipStr, `${isHeroOop ? newVillain : newHero} (IP)`));
    setTreeConfig(prev => ({
      ...prev,
      startingPot: profile.potChips,
      effectiveStack: Math.round(profile.effectiveStackBB * 10)
    }));
    setScenarioTitle(profile.spotLabel);
  };

  const handleStreetChange = (newStreet: 'flop' | 'turn' | 'river') => {
    setStreet(newStreet);
    // Ensure appropriate number of board cards for the street
    if (newStreet === 'flop') {
      if (boardCards.length < 3) {
        setBoardCards([parseCard('As'), parseCard('7d'), parseCard('2c')]);
      } else if (boardCards.length > 3) {
        setBoardCards(boardCards.slice(0, 3));
      }
    } else if (newStreet === 'turn') {
      if (boardCards.length < 4) {
        const extra = parseCard('8h');
        const base = boardCards.length >= 3 ? boardCards.slice(0, 3) : [parseCard('As'), parseCard('7d'), parseCard('2c')];
        setBoardCards([...base, extra]);
      } else if (boardCards.length > 4) {
        setBoardCards(boardCards.slice(0, 4));
      }
    } else if (newStreet === 'river') {
      if (boardCards.length < 5) {
        const extra = parseCard('2s');
        const base = boardCards.length >= 4 ? boardCards.slice(0, 4) : [...boardCards.slice(0, 3), parseCard('8h')];
        setBoardCards([...base, extra]);
      }
    }
  };

  const handleUpdateRangesFromWizard = (newOopRange: PlayerRange, newIpRange: PlayerRange, startingPot: number) => {
    setOopRange(newOopRange);
    setIpRange(newIpRange);
    setTreeConfig(prev => ({
      ...prev,
      startingPot
    }));
  };

  const handleAdvanceStreet = (nextStreet: 'flop' | 'turn' | 'river', newCard: Card) => {
    const currentBoard = [...boardCards];
    if (!currentBoard.some(c => c.id === newCard.id)) {
      currentBoard.push(newCard);
    }
    const maxAllowed = nextStreet === 'turn' ? 4 : 5;
    setBoardCards(currentBoard.slice(0, maxAllowed));
    setStreet(nextStreet);
  };

  const handleSelectHeroCards = (c1: Card, c2: Card) => {
    setHeroCards([c1, c2]);
  };

  const recentRandomCardKeysRef = useRef<string[]>([]);

  const handleRandomHeroCards = () => {
    const isIp = getPostflopRole(heroPos, villainPos) === 'IP';
    const combos = isIp ? ipCombos : oopCombos;
    if (combos.length === 0) return;

    const currentKey =
      heroCards ? `${heroCards[0].id}-${heroCards[1].id}` : null;
    if (recentRandomCardKeysRef.current.length >= combos.length) {
      recentRandomCardKeysRef.current = currentKey ? [currentKey] : [];
    }

    const excluded = new Set(recentRandomCardKeysRef.current);
    if (currentKey) excluded.add(currentKey);

    const fresh = combos.filter(c => !excluded.has(`${c.combo.card1.id}-${c.combo.card2.id}`));
    const pool = fresh.length > 0 ? fresh : combos;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const chosenKey = `${chosen.combo.card1.id}-${chosen.combo.card2.id}`;
    recentRandomCardKeysRef.current = [
      ...recentRandomCardKeysRef.current.filter(k => k !== chosenKey).slice(-9),
      chosenKey
    ];
    setHeroCards([chosen.combo.card1, chosen.combo.card2]);
  };

  const handleLoadScenario = (sc: PrebuiltScenario) => {
    setActiveScenario(sc);
    setScenarioTitle(sc.title);
    setStreet(sc.street);
    setBoardCards(sc.boardCards.map(parseCard));
    setOopRange(parseRangeString(sc.oopRangeStr, `${sc.title} - OOP`));
    setIpRange(parseRangeString(sc.ipRangeStr, `${sc.title} - IP`));
    setTreeConfig(sc.config);
    setSolveResult(null);
    setActiveTab('solver');
  };

  const handleSelectScenarioInTrainer = (sc: PrebuiltScenario) => {
    setActiveScenario(sc);
    setScenarioTitle(sc.title);
    setStreet(sc.street);
    const newBoard = sc.boardCards.map(parseCard);
    setBoardCards(newBoard);
    const newOop = parseRangeString(sc.oopRangeStr, `${sc.title} - OOP`);
    const newIp = parseRangeString(sc.ipRangeStr, `${sc.title} - IP`);
    setOopRange(newOop);
    setIpRange(newIp);
    setTreeConfig(sc.config);

    // Build and auto-solve for instant training feedback
    const newTree = buildGameTree({ ...sc.config, street: sc.street });
    const oCombos = getRangeActiveCombos(newOop, newBoard);
    const iCombos = getRangeActiveCombos(newIp, newBoard);
    if (oCombos.length > 0 && iCombos.length > 0) {
      const runner = new AsyncSolverRunner();
      runner.init(newTree, newBoard, oCombos, iCombos, {
        ...dcfrConfig,
        iterations: 120
      });
      runner.setCallbacks({
        onComplete: (res) => {
          setSolveResult(res);
        }
      });
      runner.start();
    }
  };

  const handleTrainScenario = (sc: PrebuiltScenario) => {
    handleSelectScenarioInTrainer(sc);
    setTrainerViewMode('arena_dcfr');
    setActiveTab('trainer');
  };

  const handleGoToTrainer = (fromTab: NavTab = activeTab) => {
    setPreviousTab(fromTab);
    setTrainerViewMode('arena_dcfr');
    setActiveTab('trainer');
  };

  const handleLaunchDiagnosticDrill = (
    pos: SimPosition | 'RANDOM',
    scenario: SimScenarioType | 'RANDOM'
  ) => {
    setDrillTarget({ pos, scenario, nonce: Date.now() });
    setTrainerViewMode('live6max');
    setActiveTab('trainer');
  };

  // Unified Allin School workflow: load any hand from TheTracker2 directly into Lab Studio
  const handleLoadHandInLabStudio = (hand: ParsedHandRecord) => {
    const tokens = (hand.boardStr || '').trim().split(/\s+/).filter(Boolean);
    const parsedBoard: Card[] = [];
    for (const tok of tokens) {
      try {
        if (tok.length === 2) parsedBoard.push(parseCard(tok));
      } catch {
        // skip invalid token
      }
    }
    if (parsedBoard.length >= 3) {
      const targetStreet: 'flop' | 'turn' | 'river' =
        parsedBoard.length >= 5 ? 'river' : parsedBoard.length === 4 ? 'turn' : 'flop';
      setStreet(targetStreet);
      setBoardCards(parsedBoard.slice(0, 5));
    } else {
      setStreet('flop');
      setBoardCards([parseCard('As'), parseCard('7d'), parseCard('2c')]);
    }

    const hTok = (hand.heroCardsStr || '').replace(/\s+/g, '');
    if (hTok.length === 4 && !hTok.includes('?')) {
      try {
        setHeroCards([parseCard(hTok.slice(0, 2)), parseCard(hTok.slice(2, 4))]);
      } catch {
        // ignore unparseable cards
      }
    }

    const mappedHero: TablePosition = hand.heroPos;
    const mappedVillain: TablePosition = mappedHero === 'BB' ? 'BTN' : 'BB';
    const mappedAction: PreflopActionContext =
      hand.potType === '4Bet' ? '4BET' : hand.potType === '3Bet' ? '3BET' : 'RFI';
    setHeroPos(mappedHero);
    setVillainPos(mappedVillain);
    setPreflopAction(mappedAction);

    const profile = getAutoMatchupProfile(mappedHero, mappedVillain, mappedAction, opponentProfile);
    const isHeroOop = profile.heroRole === 'OOP';
    const oopStr = isHeroOop ? profile.heroRangeStr : profile.villainRangeStr;
    const ipStr = isHeroOop ? profile.villainRangeStr : profile.heroRangeStr;
    setOopRange(parseRangeString(oopStr, `${isHeroOop ? mappedHero : mappedVillain} (OOP)`));
    setIpRange(parseRangeString(ipStr, `${isHeroOop ? mappedVillain : mappedHero} (IP)`));
    setTreeConfig(prev => ({
      ...prev,
      startingPot: profile.potChips,
      effectiveStack: Math.round(profile.effectiveStackBB * 10)
    }));
    setScenarioTitle(`TheTracker2 #${hand.handKey} · ${profile.spotLabel}`);
    setSolveResult(null);
    setActiveTab('solver');
  };

  // Live Auto-Solve effect: whenever gameTree, boardCards, or combos change,
  // automatically run a fast background solve (100 iterations) so the decision tree & D3 EV chart are always live and synchronized
  useEffect(() => {
    if (oopCombos.length === 0 || ipCombos.length === 0) return;

    const timer = setTimeout(() => {
      const runner = new AsyncSolverRunner();
      runner.init(gameTree, boardCards, oopCombos, ipCombos, {
        ...dcfrConfig,
        iterations: 150
      });
      runner.setCallbacks({
        onComplete: (res) => {
          setSolveResult(res);
        }
      });
      runner.start();
    }, 120);

    return () => clearTimeout(timer);
  }, [gameTree, boardCards, oopCombos.length, ipCombos.length, dcfrConfig]);

  // Real-time listener on active Admin announcements (/platformAnnouncements where active == true)
  useEffect(() => {
    if (!isAuthReady || !user || !user.emailVerified) {
      setAnnouncements([]);
      return;
    }

    const q = query(
      collection(db, 'platformAnnouncements'),
      where('active', '==', true),
      limit(10)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: LiveAnnouncementBanner[] = snap.docs.map(d => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            title: String(data.title || 'Aviso del Laboratorio'),
            message: String(data.message || ''),
            severity:
              data.severity === 'warning' || data.severity === 'success' ? data.severity : 'info',
            targetPlan:
              data.targetPlan === 'free' || data.targetPlan === 'pro' || data.targetPlan === 'elite'
                ? data.targetPlan
                : 'all'
          };
        });
        setAnnouncements(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'platformAnnouncements');
        } catch {
          // Avoid crashing UI on transient announcement fetch issues
        }
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const isSolving = solverProgress?.status === 'running' || solverProgress?.status === 'paused';

  const checkTabUnlocked = (tab: NavTab): boolean => {
    if (tab === 'tracker2') {
      return canAccessSection('trainer') || canAccessSection('solver');
    }
    if (tab === 'fundamentals') {
      return canAccessSection('wizard') || canAccessSection('academy');
    }
    return canAccessSection(tab);
  };

  // Auto-redirect to first unlocked section when Admin disables current tab + hideLockedSections is enabled
  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (!checkTabUnlocked(activeTab) && activePlanConfig.hideLockedSections) {
      const firstAllowed = LAB_SECTION_META.find(sec => canAccessSection(sec.id));
      if (firstAllowed && firstAllowed.id !== activeTab) {
        setActiveTab(firstAllowed.id);
      }
    }
  }, [isAuthReady, user, activeTab, canAccessSection, activePlanConfig.hideLockedSections]);

  const isSectionUnlocked = checkTabUnlocked(activeTab);
  const visibleAnnouncements = announcements.filter(
    a => (a.targetPlan === 'all' || a.targetPlan === planTier) && !dismissedAnnIds.includes(a.id)
  );

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans">
      {/* Universal Top Bar */}
      <Header
        activeTab={activeTab}
        experienceLevel={experienceLevel}
        onTabChange={setActiveTab}
        onQuickSolve={handleStartSolve}
        onOpenPlanBenefits={() => setShowPlanBenefitsModal(true)}
        onOpenSupport={() => setShowSupportModal(true)}
        isSolving={isSolving}
      />

      {/* Plan Benefits & Sections Visibility Modal */}
      <PlanBenefitsModal
        open={showPlanBenefitsModal}
        onClose={() => setShowPlanBenefitsModal(false)}
      />

      {/* Student Support Ticket Modal */}
      <SupportTicketModal
        open={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 pb-20 md:pb-6 flex flex-col gap-6">
        {/* Live Admin Platform Announcements */}
        {visibleAnnouncements.length > 0 && (
          <div className="space-y-2">
            {visibleAnnouncements.map(ann => {
              const cls =
                ann.severity === 'warning'
                  ? 'bg-amber-950/50 border-amber-500/40 text-amber-100'
                  : ann.severity === 'success'
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100'
                  : 'bg-blue-950/50 border-blue-500/40 text-blue-100';
              return (
                <div
                  key={ann.id}
                  className={`px-4 py-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${cls}`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Megaphone className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-bold mr-2">{ann.title}:</span>
                      <span className="opacity-90">{ann.message}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissedAnnIds(prev => [...prev, ann.id])}
                    className="p-1 rounded-lg hover:bg-black/30 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                    title="Ocultar aviso"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Adaptive Experience Level Selector Bar */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-semibold text-white">Perfil de Estudio:</span>
            <span className="text-neutral-400 hidden sm:inline">{EXPERIENCE_LEVEL_META[experienceLevel].description}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-black border border-neutral-800 text-[11px] font-semibold">
              {(Object.keys(EXPERIENCE_LEVEL_META) as ExperienceLevel[]).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleExperienceLevelChange(lvl)}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    experienceLevel === lvl ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {EXPERIENCE_LEVEL_META[lvl].label}
                </button>
              ))}
            </div>
            {(onboardingState.completed || onboardingState.dismissed) && (
              <button
                type="button"
                onClick={handleReopenOnboarding}
                className="px-2.5 py-1.5 rounded-xl bg-black hover:bg-neutral-900 border border-neutral-800 text-[11px] font-semibold text-blue-300 cursor-pointer whitespace-nowrap"
              >
                Guía 60s
              </button>
            )}
          </div>
        </div>

        {/* Interactive 60s First-Run / Goal Setup Banner */}
        {!onboardingState.completed && !onboardingState.dismissed && (
          <Onboarding60sBanner
            onSelectGoal={handleOnboardingGoal}
            onDismiss={handleDismissOnboarding}
          />
        )}

        {/* Auto-Learning Live Coach & Player Tracker Banner */}
        <PlayerLiveCoachTracker
          street={street}
          potBB={Math.round((treeConfig.startingPot / 10) * 10) / 10}
        />

        {!isSectionUnlocked ? (
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-8 max-w-2xl mx-auto w-full text-center space-y-4 shadow-2xl my-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300">
                Sección Restringida por tu Plan ({activePlanConfig.displayName})
              </span>
              <h2 className="text-xl font-bold text-white">
                Esta área requiere habilitación en tu suscripción
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-lg mx-auto">
                La configuración de secciones de tu plan se administra desde la Consola Administrativa Independiente.
                Revisa tus secciones activas y beneficios disponibles en cualquier momento.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPlanBenefitsModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                <span>Ver Secciones y Beneficios</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const first = LAB_SECTION_META.find(sec => canAccessSection(sec.id));
                  if (first) setActiveTab(first.id);
                }}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Ir a Sección Disponible
              </button>
            </div>
          </div>
        ) : (
          <>

        {solverError && (
          <div className="p-3 bg-rose-950/70 border border-rose-700 rounded-xl text-xs text-rose-200 flex items-center justify-between">
            <span>{solverError}</span>
            <button
              type="button"
              onClick={() => setSolverError(null)}
              className="text-rose-300 hover:text-white font-semibold ml-4 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* HandContextBar: Persistent Real-Time SPR, Pot Odds, Pot Size, and Opponent Profile */}
        {(activeTab === 'wizard' || activeTab === 'solver') && (
          <HandContextBar
            currentPot={treeConfig.startingPot}
            effectiveStack={treeConfig.effectiveStack}
            boardCards={boardCards}
            street={street}
            selectedNode={selectedNode}
            heroPos={heroPos}
            villainPos={villainPos}
            opponentProfile={opponentProfile}
            onOpponentProfileChange={handleOpponentProfileChange}
            bbUnit={10}
          />
        )}

        {/* TAB 00: MÓDULO 0 — FUNDAMENTOS VISUALES E INTERACTIVOS */}
        {activeTab === 'fundamentals' && (
          <FundamentalsModule
            experienceLevel={experienceLevel}
            onStartTrainer={() => {
              setTrainerViewMode('live6max');
              setActiveTab('trainer');
            }}
            onStartEvaluation={() => setActiveTab('academy')}
            onLaunchDrill={handleLaunchDiagnosticDrill}
          />
        )}

        {/* TAB 0: STEP-BY-STEP AUTOMATED THINKING PROCESS */}
        {activeTab === 'wizard' && (
          <ThinkingProcessWizard
            heroPos={heroPos}
            villainPos={villainPos}
            onHeroPosChange={handleHeroPosChange}
            onVillainPosChange={handleVillainPosChange}
            heroCards={heroCards}
            onSelectHeroCards={handleSelectHeroCards}
            onRandomHeroCards={handleRandomHeroCards}
            boardCards={boardCards}
            onBoardChange={setBoardCards}
            street={street}
            onStreetChange={handleStreetChange}
            onUpdateRanges={handleUpdateRangesFromWizard}
            strategyResult={solveResult?.nodeStrategies.get(selectedNode.id)}
            gameTree={gameTree}
            selectedNodeId={selectedNode.id}
            onSelectNode={setSelectedNode}
            nodeStrategies={solveResult?.nodeStrategies}
            onAdvanceStreet={handleAdvanceStreet}
            allScenarios={allScenarios}
            onLoadScenario={handleLoadScenario}
            oopCombosCount={oopCombos.length}
            ipCombosCount={ipCombos.length}
            opponentProfile={opponentProfile}
            onOpponentProfileChange={handleOpponentProfileChange}
            onGoToTrainer={() => handleGoToTrainer('wizard')}
            onGoToSolver={() => setActiveTab('solver')}
            onSolve={handleStartSolve}
            isSolving={isSolving}
          />
        )}

        {/* TAB 1: SOLVER WORKSPACE */}
        {activeTab === 'solver' && (
          <div className="flex flex-col gap-6">
            {/* Top Toolbar Strip */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white tracking-tight">
                    {scenarioTitle}
                  </h1>
                  <span className="text-xs text-neutral-500">· Análisis de Pensamiento Ideal Postflop</span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  OOP Combos: <span className="text-white font-mono">{oopCombos.length}</span> · IP Combos: <span className="text-white font-mono">{ipCombos.length}</span> · Pot: <span className="text-emerald-400 font-mono font-bold">{treeConfig.startingPot}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('wizard')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-500/40 transition-colors shadow-xs cursor-pointer"
                  title="Abrir el asistente automatizado del proceso de pensamiento"
                >
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Proceso Paso a Paso (Auto)</span>
                </button>

                {canEditSolver ? (
                  <button
                    onClick={() => setShowConfigPanel(!showConfigPanel)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      showConfigPanel
                        ? 'bg-neutral-800 border-neutral-700 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Sizings, Rake &amp; Node-Lock</span>
                  </button>
                ) : (
                  <span
                    title="Disponible en planes Pro / Elite o cuentas autorizadas"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-400"
                  >
                    <Lock className="w-3 h-3 text-neutral-500" />
                    <span>
                      Pot {treeConfig.startingPot} · Stack {treeConfig.effectiveStack} · {dcfrConfig.algorithm} (Plan Pro/Elite)
                    </span>
                  </span>
                )}

                {!isSolving ? (
                  <button
                    onClick={handleStartSolve}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Calcular Pensamiento Ideal</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {solverProgress?.status === 'running' ? (
                      <button
                        onClick={handlePauseSolve}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pausar</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleResumeSolve}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Reanudar</span>
                      </button>
                    )}
                    <button
                      onClick={handleCancelSolve}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-red-900 text-neutral-300 hover:text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Detener</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tree & Engine Config Panel (Pro / Elite / Admin) */}
            {canEditSolver && showConfigPanel && (
              <TreeConfigPanel
                treeConfig={treeConfig}
                onTreeConfigChange={setTreeConfig}
                dcfrConfig={dcfrConfig}
                onDCFRConfigChange={setDcfrConfig}
                selectedNode={selectedNode}
                gameTree={gameTree}
              />
            )}

            {/* Live Progress Bar */}
            {solverProgress && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-400">
                    Calculando Pensamiento Ideal ({solverProgress.status}): Iteración {solverProgress.currentIteration} / {solverProgress.totalIterations}
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {solverProgress.percent}% ({solverProgress.elapsedMs}ms)
                  </span>
                </div>
                <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    style={{ width: `${solverProgress.percent}%` }}
                    className="h-full bg-emerald-500 transition-all duration-100"
                  />
                </div>
              </div>
            )}

            {/* Quick Hand & Position Control Bar */}
            <HandAndPositionBar
              heroPos={heroPos}
              villainPos={villainPos}
              onHeroPosChange={handleHeroPosChange}
              onVillainPosChange={handleVillainPosChange}
              onSwapPositions={handleSwapPositions}
              heroCards={heroCards}
              onSelectHeroCards={handleSelectHeroCards}
              onRandomHeroCards={handleRandomHeroCards}
              boardCards={boardCards}
              extraAction={
                <button
                  type="button"
                  onClick={() => handleGoToTrainer('solver')}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <span>Practicar Mano →</span>
                </button>
              }
            />

            {/* Community Board Selector */}
            <BoardSelector
              board={boardCards}
              onChange={setBoardCards}
              street={street}
              onStreetChange={setStreet}
            />

            {/* Decision Tree & Strategy Heatmap Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Decision Tree Navigator */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <DecisionTreeViewer
                  rootNode={gameTree}
                  selectedNodeId={selectedNode.id}
                  onSelectNode={setSelectedNode}
                  nodeStrategies={solveResult?.nodeStrategies}
                  currentStreet={street}
                  boardCards={boardCards}
                  heroPos={heroPos}
                  villainPos={villainPos}
                  heroCards={heroCards}
                  onAdvanceStreet={handleAdvanceStreet}
                  onRefineSolve={handleStartSolve}
                  isSolving={isSolving}
                  bbUnit={10}
                />

                {solveResult && (
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div className="space-y-0.5">
                      <div className="text-neutral-400">Resumen de Convergencia Ideal:</div>
                      <div className="text-emerald-400 font-bold">
                        {solveResult.iterationsRun} Iteraciones en {solveResult.elapsedMs}ms
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('trainer')}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-medium transition-colors"
                    >
                      Practicar en Modo Práctica →
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: D3 EV Distribution Chart & 13x13 Strategy Heatmap */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* D3 Expected Value (EV) Distribution Chart for Selected Action Node */}
                <NodeEvDistributionChart
                  selectedNode={selectedNode}
                  strategyResult={solveResult?.nodeStrategies.get(selectedNode.id)}
                  heroCards={heroCards}
                  boardCards={boardCards}
                  bbUnit={10}
                />

                <StrategyMatrixView
                  selectedNode={selectedNode}
                  strategyResult={solveResult?.nodeStrategies.get(selectedNode.id)}
                  boardCards={boardCards}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RANGE MATRIX EDITOR / INSPECTOR */}
        {activeTab === 'ranges' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3 flex-wrap p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div>
                <h2 className="text-base font-bold text-white">
                  {canEditSolver ? '13×13 Hand Range Matrix Editor (Pro / Elite)' : '13×13 Hand Range Matrix Inspector'}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {canEditSolver
                    ? 'Configura distribuciones preflop ponderadas para Out-of-Position (OOP) y In-Position (IP).'
                    : 'Inspección en modo lectura de combos y bloqueadores activos (desbloqueado en planes Pro / Elite).'}
                </p>
              </div>
              {!canEditSolver && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-400">
                  <Lock className="w-3 h-3 text-neutral-500" />
                  <span>Solo Lectura (Free)</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RangeMatrix13x13
                range={oopRange}
                onChange={setOopRange}
                boardCards={boardCards}
                title="OOP Defense / Check Range"
                badgeLabel="OOP"
                readOnly={!canEditSolver}
              />

              <RangeMatrix13x13
                range={ipRange}
                onChange={setIpRange}
                boardCards={boardCards}
                title="IP Attack / Bet Range"
                badgeLabel="IP"
                readOnly={!canEditSolver}
              />
            </div>
          </div>
        )}

        {/* TAB 3: ENTRENADOR PRO 6-MAX EN VIVO + ARENA DCFR */}
        {activeTab === 'trainer' && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3">
              <div className="text-xs text-neutral-400">
                Modo de Entrenamiento: <strong className="text-white">{trainerViewMode === 'live6max' ? 'Mesa 6-Max en Vivo (Allin School)' : 'Arena Lab Studio de Escenario'}</strong>
              </div>
              <div className="flex items-center p-1 rounded-xl bg-black border border-neutral-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTrainerViewMode('live6max')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    trainerViewMode === 'live6max' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Mesa 6-Max en Vivo
                </button>
                <button
                  type="button"
                  onClick={() => setTrainerViewMode('arena_dcfr')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    trainerViewMode === 'arena_dcfr' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Arena Lab Studio
                </button>
              </div>
            </div>

            {trainerViewMode === 'live6max' ? (
              <TrainerMode
                drillTarget={drillTarget}
                experienceLevel={experienceLevel}
                onOpenDiagnostic={() => setActiveTab('tracker2')}
              />
            ) : (
              <TrainerModule
                scenarios={allScenarios}
                activeScenario={activeScenario}
                onSelectScenario={handleSelectScenarioInTrainer}
                boardCards={boardCards}
                oopCombos={oopCombos}
                ipCombos={ipCombos}
                activeNode={selectedNode}
                strategyResult={solveResult?.nodeStrategies.get(selectedNode.id)}
                nodeStrategies={solveResult?.nodeStrategies}
                heroPos={heroPos}
                villainPos={villainPos}
                heroCards={heroCards}
                onHeroPosChange={handleHeroPosChange}
                onVillainPosChange={handleVillainPosChange}
                onSwapPositions={handleSwapPositions}
                bbUnit={10}
                onSelectHeroCards={handleSelectHeroCards}
                onBack={() => setActiveTab(previousTab || 'wizard')}
              />
            )}
          </div>
        )}

        {/* TAB 3B: THETRACKER2 PRO + DIAGNÓSTICO DE NIVEL */}
        {activeTab === 'tracker2' && (
          <HandHistoryImporter
            onLaunchDrill={handleLaunchDiagnosticDrill}
            onLoadInLabStudio={handleLoadHandInLabStudio}
            onGoToTrainer={() => {
              setTrainerViewMode('live6max');
              setActiveTab('trainer');
            }}
          />
        )}

        {/* TAB 4: POSITIONAL CHEAT SHEET & 6-MAX MANUAL */}
        {activeTab === 'cheatsheet' && (
          <PositionalCheatSheet />
        )}

        {/* TAB 5: ACADEMIA DE POKER INTERACTIVA & DASHBOARD D3.JS */}
        {activeTab === 'academy' && (
          <AcademyRoadmapDashboard />
        )}

        {/* TAB 5B: SOLVERS AUTO-ACTUALIZABLES & APRENDIZAJE DE INTERNET */}
        {activeTab === 'solver_meta' && (
          <SolverMetaPanel />
        )}

        {/* TAB 6: SCENARIO LIBRARY */}
        {activeTab === 'scenarios' && (
          <ScenarioManager
            onLoadScenario={handleLoadScenario}
            onTrainScenario={handleTrainScenario}
          />
        )}

        {/* TAB 5: MATH BENCHMARKS & DOCS */}
        {activeTab === 'benchmarks' && (
          <BenchmarkAndDocs />
        )}
          </>
        )}
      </main>
    </div>
  );
}
