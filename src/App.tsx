/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GTO Studio — Desktop & Web No-Limit Texas Hold'em Game Theory Optimal Solver.
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
import { ThinkingProcessWizard } from './components/ThinkingProcessWizard';
import { ScenarioManager } from './components/ScenarioManager';
import { BenchmarkAndDocs } from './components/BenchmarkAndDocs';
import { PositionalCheatSheet } from './components/PositionalCheatSheet';
import { AcademyRoadmapDashboard } from './components/AcademyRoadmapDashboard';
import { PlayerLiveCoachTracker } from './components/PlayerLiveCoachTracker';
import { SolverMetaPanel } from './components/SolverMetaPanel';
import { TreeConfigPanel } from './components/TreeConfigPanel';
import { HandAndPositionBar, TablePosition, getPostflopRole } from './components/HandAndPositionBar';
import { BoardSelector } from './components/BoardSelector';
import { HandContextBar } from './components/HandContextBar';
import { PreflopActionContext, getAutoMatchupProfile, OpponentProfile } from './engine/preflopMatchups';
import { SolverMetaUpdater } from './engine/solverMetaUpdater';

import { Play, Pause, Square, RefreshCw, Zap, CheckCircle, SlidersHorizontal, Compass } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('wizard');
  const [previousTab, setPreviousTab] = useState<NavTab>('wizard');

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
    runner.init(gameTree, boardCards, oopCombos, ipCombos, dcfrConfig);

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
      startingPot: matchup.potChips
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
      startingPot: profile.potChips
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
      startingPot: profile.potChips
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
      startingPot: profile.potChips
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
      startingPot: profile.potChips
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

  const handleRandomHeroCards = () => {
    const isIp = getPostflopRole(heroPos, villainPos) === 'IP';
    const combos = isIp ? ipCombos : oopCombos;
    if (combos.length > 0) {
      const idx = Math.floor(Math.random() * combos.length);
      setHeroCards([combos[idx].combo.card1, combos[idx].combo.card2]);
    }
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
    setActiveTab('trainer');
  };

  const handleGoToTrainer = (fromTab: NavTab = activeTab) => {
    setPreviousTab(fromTab);
    setActiveTab('trainer');
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
  }, [gameTree, boardCards, oopCombos.length, ipCombos.length]);

  const isSolving = solverProgress?.status === 'running' || solverProgress?.status === 'paused';

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans">
      {/* Universal Top Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickSolve={handleStartSolve}
        isSolving={isSolving}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Auto-Learning Live Coach & Player Tracker Banner */}
        <PlayerLiveCoachTracker street={street} potBB={treeConfig.startingPot} />

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
            bbUnit={2}
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

                <button
                  onClick={() => setShowConfigPanel(!showConfigPanel)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    showConfigPanel
                      ? 'bg-neutral-800 border-neutral-700 text-white'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Sizings & Config</span>
                </button>

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

            {/* Tree & Engine Config Panel */}
            {showConfigPanel && (
              <TreeConfigPanel
                treeConfig={treeConfig}
                onTreeConfigChange={setTreeConfig}
                dcfrConfig={dcfrConfig}
                onDCFRConfigChange={setDcfrConfig}
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

        {/* TAB 2: RANGE MATRIX EDITOR */}
        {activeTab === 'ranges' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div>
                <h2 className="text-base font-bold text-white">13×13 Hand Range Matrix Editor</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Configure weighted preflop distributions for Out-of-Position (OOP) and In-Position (IP) players.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RangeMatrix13x13
                range={oopRange}
                onChange={setOopRange}
                boardCards={boardCards}
                title="OOP Defense / Check Range"
                badgeLabel="OOP"
              />

              <RangeMatrix13x13
                range={ipRange}
                onChange={setIpRange}
                boardCards={boardCards}
                title="IP Attack / Bet Range"
                badgeLabel="IP"
              />
            </div>
          </div>
        )}

        {/* TAB 3: GTO TRAINER */}
        {activeTab === 'trainer' && (
          <div className="flex flex-col gap-6">
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
              onSelectHeroCards={handleSelectHeroCards}
              onBack={() => setActiveTab(previousTab || 'wizard')}
            />
          </div>
        )}

        {/* TAB 4: POSITIONAL CHEAT SHEET & 6-MAX MANUAL (GTO & EXPLOTATIVO) */}
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
      </main>
    </div>
  );
}
