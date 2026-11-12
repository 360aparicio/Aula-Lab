/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Poker Decision Tree Navigator & Action Node Inspector.
 * Features an intuitive visual flowchart, hierarchical branch explorer,
 * action breadcrumb navigation, integrated Next Street Guidance, and a
 * Comprehensive Visual Alert System for Exploitability and Regret convergence failures.
 */

import React, { useState, useMemo } from 'react';
import { ActionNode, GameNode, PlayerRole, Action } from '../engine/gameTree';
import { NodeStrategyResult } from '../engine/dcfr';
import { Card } from '../engine/cards';
import { NextStreetGuide } from './NextStreetGuide';
import { getPostflopRole, TablePosition } from './HandAndPositionBar';
import {
  GitBranch,
  Layers,
  Compass,
  ChevronRight,
  ChevronDown,
  Shield,
  Zap,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  Filter,
  AlertTriangle,
  AlertOctagon,
  Sliders,
  Flame,
  RefreshCw,
  Play
} from 'lucide-react';

interface DecisionTreeViewerProps {
  rootNode: ActionNode;
  selectedNodeId: string;
  onSelectNode: (node: ActionNode) => void;
  nodeStrategies?: Map<string, NodeStrategyResult>;
  // Optional next-street context
  currentStreet?: 'flop' | 'turn' | 'river';
  boardCards?: Card[];
  heroPos?: TablePosition;
  villainPos?: TablePosition;
  heroCards?: [Card, Card] | null;
  onAdvanceStreet?: (nextStreet: 'flop' | 'turn' | 'river', newCard: Card) => void;
  onRefineSolve?: () => void;
  isSolving?: boolean;
  bbUnit?: number; // Size of 1 BB in chips (default: 2)
}

export type ConvergenceStatus = 'critical' | 'warning' | 'converged' | 'pending';

export interface NodeConvergenceInfo {
  status: ConvergenceStatus;
  localExploitability: number; // in chips
  localExploitabilityBB: number; // in BB
  maxRegret: number;
  avgRegret: number;
  isCritical: boolean;
  isWarning: boolean;
  ratioToThreshold: number; // e.g. 1.5 = 150% of threshold
}

export const DecisionTreeViewer: React.FC<DecisionTreeViewerProps> = ({
  rootNode,
  selectedNodeId,
  onSelectNode,
  nodeStrategies,
  currentStreet = 'flop',
  boardCards = [],
  heroPos = 'BTN',
  villainPos = 'BB',
  heroCards = null,
  onAdvanceStreet,
  onRefineSolve,
  isSolving = false,
  bbUnit = 2
}) => {
  const [viewMode, setViewMode] = useState<'flow' | 'tree' | 'guide'>('flow');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Convergence alert threshold settings
  const [criticalThresholdBB, setCriticalThresholdBB] = useState<number>(0.35); // in BB
  const [onlyShowAlerts, setOnlyShowAlerts] = useState<boolean>(false);
  const [showThresholdConfig, setShowThresholdConfig] = useState<boolean>(false);

  // Determine hero's postflop role (IP or OOP)
  const heroRole: PlayerRole = useMemo(() => {
    return getPostflopRole(heroPos, villainPos);
  }, [heroPos, villainPos]);

  // Recursively collect all ActionNodes in the tree
  const allActionNodes: ActionNode[] = useMemo(() => {
    const list: ActionNode[] = [];
    function collect(node: GameNode) {
      if (node.nodeType === 'action') {
        const act = node as ActionNode;
        list.push(act);
        for (const child of Object.values(act.children)) {
          collect(child);
        }
      }
    }
    collect(rootNode);
    return list;
  }, [rootNode]);

  // Helper to calculate convergence info for any node
  const getNodeConvergence = useMemo(() => {
    return (nodeId: string): NodeConvergenceInfo => {
      const strat = nodeStrategies?.get(nodeId);
      if (!strat) {
        return {
          status: 'pending',
          localExploitability: 0,
          localExploitabilityBB: 0,
          maxRegret: 0,
          avgRegret: 0,
          isCritical: false,
          isWarning: false,
          ratioToThreshold: 0
        };
      }

      const expChips = strat.localExploitability ?? 0;
      const expBB = Number((expChips / bbUnit).toFixed(2));
      const maxReg = strat.maxRegret ?? 0;
      const avgReg = strat.avgRegret ?? 0;

      // Threshold comparisons in Big Blinds
      const warningThresholdBB = criticalThresholdBB * 0.6;
      const ratio = criticalThresholdBB > 0 ? expBB / criticalThresholdBB : 0;

      const isCritical = expBB >= criticalThresholdBB || (maxReg >= 0.8 && expBB >= warningThresholdBB);
      const isWarning = !isCritical && (expBB >= warningThresholdBB || maxReg >= 0.35);

      const status: ConvergenceStatus = isCritical
        ? 'critical'
        : isWarning
        ? 'warning'
        : 'converged';

      return {
        status,
        localExploitability: expChips,
        localExploitabilityBB: expBB,
        maxRegret: maxReg,
        avgRegret: avgReg,
        isCritical,
        isWarning,
        ratioToThreshold: ratio
      };
    };
  }, [nodeStrategies, bbUnit, criticalThresholdBB]);

  // Aggregate stats across the tree
  const treeConvergenceStats = useMemo(() => {
    let criticalCount = 0;
    let warningCount = 0;
    let convergedCount = 0;
    let pendingCount = 0;
    const criticalNodeList: ActionNode[] = [];

    allActionNodes.forEach((node) => {
      const info = getNodeConvergence(node.id);
      if (info.status === 'critical') {
        criticalCount++;
        criticalNodeList.push(node);
      } else if (info.status === 'warning') {
        warningCount++;
      } else if (info.status === 'converged') {
        convergedCount++;
      } else {
        pendingCount++;
      }
    });

    const evaluatedTotal = criticalCount + warningCount + convergedCount;
    const healthPercent =
      evaluatedTotal > 0
        ? Math.round((convergedCount / evaluatedTotal) * 100)
        : 100;

    return {
      total: allActionNodes.length,
      evaluatedTotal,
      criticalCount,
      warningCount,
      convergedCount,
      pendingCount,
      criticalNodeList,
      healthPercent
    };
  }, [allActionNodes, getNodeConvergence]);

  // Jump to next unconverged node
  const handleJumpToNextAlert = () => {
    if (treeConvergenceStats.criticalNodeList.length === 0) return;
    const currentIndex = treeConvergenceStats.criticalNodeList.findIndex(
      (n) => n.id === selectedNodeId
    );
    const nextIndex = (currentIndex + 1) % treeConvergenceStats.criticalNodeList.length;
    onSelectNode(treeConvergenceStats.criticalNodeList[nextIndex]);
    setViewMode('flow');
  };

  // Build breadcrumb path from root to currently selected node
  const breadcrumbPath = useMemo(() => {
    const path: { node: ActionNode; actionLabel: string }[] = [];

    function findPath(curr: ActionNode, targetId: string, currentPath: { node: ActionNode; actionLabel: string }[]): boolean {
      if (curr.id === targetId) {
        path.push(...currentPath, { node: curr, actionLabel: curr.id === 'root' ? 'Inicio / Raíz' : curr.history.slice(-1)[0] || 'Raíz' });
        return true;
      }

      for (const [actionKey, child] of Object.entries(curr.children)) {
        if (child.nodeType === 'action') {
          const actNode = child as ActionNode;
          const label = curr.actions.find(a => (a.actionKey && a.actionKey === actionKey) || a.type === actionKey || actionKey.startsWith(a.type))?.label || actionKey;
          if (findPath(actNode, targetId, [...currentPath, { node: curr, actionLabel: label }])) {
            return true;
          }
        }
      }
      return false;
    }

    findPath(rootNode, selectedNodeId, []);
    return path.length > 0 ? path : [{ node: rootNode, actionLabel: 'Inicio / Raíz' }];
  }, [rootNode, selectedNodeId]);

  // Find currently selected node object
  const selectedNodeObj = useMemo(() => {
    function findNode(curr: GameNode, targetId: string): ActionNode | null {
      if (curr.id === targetId && curr.nodeType === 'action') return curr as ActionNode;
      if (curr.nodeType === 'action') {
        const act = curr as ActionNode;
        for (const child of Object.values(act.children)) {
          const found = findNode(child, targetId);
          if (found) return found;
        }
      }
      return null;
    }
    return findNode(rootNode, selectedNodeId) || rootNode;
  }, [rootNode, selectedNodeId]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const nextStreetName = currentStreet === 'flop' ? 'turn' : currentStreet === 'turn' ? 'river' : 'showdown';

  // Helper to format action badges
  const getActionBadgeColor = (actionKey: string) => {
    const lower = actionKey.toLowerCase();
    if (lower.includes('fold')) return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (lower.includes('check')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (lower.includes('call')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    if (lower.includes('allin') || lower.includes('all-in')) return 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold';
    if (lower.includes('raise')) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (lower.includes('bet')) {
      if (lower.includes('75') || lower.includes('100') || lower.includes('80')) {
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      }
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    return 'bg-neutral-800 text-neutral-300 border-neutral-700';
  };

  // Render a node card inside the visual flowchart or tree
  const renderNodeCard = (node: ActionNode, isCompact = false) => {
    const isSelected = node.id === selectedNodeId;
    const strat = nodeStrategies?.get(node.id);
    const isHero = node.player === heroRole;
    const playerPos = isHero ? heroPos : villainPos;
    const convInfo = getNodeConvergence(node.id);

    // If filtering by alerts only, hide converged nodes unless selected
    if (onlyShowAlerts && !convInfo.isCritical && !isSelected) {
      return null;
    }

    return (
      <div
        onClick={() => onSelectNode(node)}
        className={`group p-3 rounded-xl border text-left cursor-pointer transition-all relative overflow-hidden ${
          convInfo.isCritical
            ? 'border-rose-500/90 ring-2 ring-rose-500/40 bg-gradient-to-br from-rose-950/30 via-neutral-950 to-neutral-900 shadow-md shadow-rose-950/40'
            : convInfo.isWarning
            ? 'border-amber-500/80 ring-1 ring-amber-500/30 bg-neutral-950/90'
            : isSelected
            ? 'bg-neutral-800 border-emerald-500 ring-1 ring-emerald-500/50 shadow-md'
            : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60'
        }`}
      >
        {/* Top Header of Card */}
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono border ${
                isHero
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
              }`}
            >
              {playerPos} · {node.player} {isHero ? '(Hero)' : '(Villain)'}
            </span>
            <span className="text-[11px] font-bold text-white">
              {node.id === 'root' ? 'Decisión Inicial' : node.history.slice(-1)[0]}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Visual Convergence Alert Badge */}
            {convInfo.status === 'critical' ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-900/70 border border-rose-500/80 text-rose-200 text-[10px] font-mono font-bold animate-pulse">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>🚨 Alerta Crítica (+{convInfo.localExploitabilityBB} bb)</span>
              </span>
            ) : convInfo.status === 'warning' ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 text-[10px] font-mono font-semibold">
                <AlertOctagon className="w-3 h-3 text-amber-400" />
                <span>⚠️ Advertencia (+{convInfo.localExploitabilityBB} bb)</span>
              </span>
            ) : convInfo.status === 'converged' ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800 text-emerald-400 text-[9px] font-mono font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>En Equilibrio</span>
              </span>
            ) : null}

            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              Pot: {node.pot}
            </span>
          </div>
        </div>

        {/* Highlighted Warning Ribbon for Critical Nodes */}
        {convInfo.isCritical && (
          <div className="my-2 p-2 rounded-lg bg-rose-950/50 border border-rose-600/40 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-rose-300 font-bold">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>Falta de Convergencia Detectada</span>
              </span>
              <span className="font-mono text-rose-400">
                Regret Máx: {convInfo.maxRegret.toFixed(1)}
              </span>
            </div>
            <p className="text-[10px] text-rose-200/90 leading-tight">
              Incentivo de desvío de <strong className="text-white font-mono">+{convInfo.localExploitabilityBB} BB</strong> supera el umbral crítico ({criticalThresholdBB} BB). Las frecuencias calculadas aún no se han estabilizado completamente en este punto.
            </p>
          </div>
        )}

        {/* Strategy Frequency Stacked Bar if solved */}
        {strat && Object.keys(strat.overallStrategy).length > 0 ? (
          <div className="space-y-1.5 mt-2">
            {/* Stacked bar */}
            <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden flex border border-neutral-800">
              {Object.entries(strat.overallStrategy).map(([act, freq]) => {
                if (freq <= 0.005) return null;
                const actColor = act === 'FOLD'
                  ? 'bg-red-500'
                  : act === 'CHECK' || act === 'CALL'
                  ? 'bg-blue-500'
                  : act.startsWith('BET_33')
                  ? 'bg-emerald-500'
                  : act.startsWith('BET')
                  ? 'bg-amber-500'
                  : 'bg-purple-500';

                return (
                  <div
                    key={act}
                    style={{ width: `${freq * 100}%` }}
                    className={`${actColor} h-full transition-all`}
                    title={`${act}: ${(freq * 100).toFixed(1)}%`}
                  />
                );
              })}
            </div>

            {/* Frequencies text pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
              {Object.entries(strat.overallStrategy).map(([act, freq]) => {
                const actLabel = strat.actionLabels?.[act] || act;
                const pct = Math.round(freq * 100);
                const colorClass = getActionBadgeColor(act);
                return (
                  <span
                    key={act}
                    className={`px-1.5 py-0.5 rounded border ${colorClass} font-semibold`}
                  >
                    {actLabel}: {pct}%
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-neutral-500 italic mt-1">
            Haz clic para calcular o ver frecuencias ideales
          </div>
        )}
      </div>
    );
  };

  // Render Visual Flowchart View
  const renderFlowchartView = () => {
    const selectedStrat = nodeStrategies?.get(selectedNodeObj.id);
    const childEntries = Object.entries(selectedNodeObj.children);
    const convInfo = getNodeConvergence(selectedNodeObj.id);

    return (
      <div className="space-y-4">
        {/* Selected Node In-Depth Card */}
        <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nodo de Decisión Actual:</span>
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              Pot: {selectedNodeObj.pot} fichas
            </span>
          </div>

          {renderNodeCard(selectedNodeObj)}

          {/* Diagnostic Panel for Selected Node */}
          {selectedStrat && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                convInfo.isCritical
                  ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                  : convInfo.isWarning
                  ? 'bg-amber-950/30 border-amber-700/50 text-amber-200'
                  : 'bg-neutral-900/60 border-neutral-800 text-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800/80">
                <div className="flex items-center gap-2 font-bold">
                  {convInfo.isCritical ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                  ) : convInfo.isWarning ? (
                    <AlertOctagon className="w-4 h-4 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className={convInfo.isCritical ? 'text-rose-300 font-bold' : 'text-white'}>
                    Diagnóstico de Convergencia & Regret del Nodo
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    convInfo.isCritical
                      ? 'bg-rose-900/70 text-rose-200 border-rose-500'
                      : convInfo.isWarning
                      ? 'bg-amber-900/70 text-amber-200 border-amber-600'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  }`}
                >
                  {convInfo.isCritical ? 'ALERTA: CRÍTICO' : convInfo.isWarning ? 'ADVERTENCIA' : 'EQUILIBRIO OK'}
                </span>
              </div>

              {/* Exploitability & Regret Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                <div className="p-2 bg-neutral-950/80 rounded border border-neutral-800/80">
                  <div className="text-[10px] text-neutral-400">Local Exploitability</div>
                  <div className={`font-bold text-sm ${convInfo.isCritical ? 'text-rose-400' : 'text-emerald-400'}`}>
                    +{convInfo.localExploitabilityBB} BB
                  </div>
                  <div className="text-[9px] text-neutral-500">Umbral: {criticalThresholdBB} BB</div>
                </div>

                <div className="p-2 bg-neutral-950/80 rounded border border-neutral-800/80">
                  <div className="text-[10px] text-neutral-400">Regret Máximo</div>
                  <div className="font-bold text-sm text-amber-400">
                    {convInfo.maxRegret.toFixed(1)}
                  </div>
                  <div className="text-[9px] text-neutral-500">Arrepentimiento positivo máx</div>
                </div>

                <div className="p-2 bg-neutral-950/80 rounded border border-neutral-800/80 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-neutral-400">Regret Promedio</div>
                  <div className="font-bold text-sm text-cyan-400">
                    {convInfo.avgRegret.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-neutral-500">Promedio en rango activo</div>
                </div>
              </div>

              {/* Exploitability Relative Progress Meter */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                  <span>Margen de Convergencia</span>
                  <span className={convInfo.isCritical ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>
                    {(convInfo.ratioToThreshold * 100).toFixed(0)}% del umbral
                  </span>
                </div>
                <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    style={{ width: `${Math.min(100, convInfo.ratioToThreshold * 100)}%` }}
                    className={`h-full transition-all duration-300 ${
                      convInfo.isCritical ? 'bg-rose-500' : convInfo.isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>
              </div>

              {/* Action Explanations and EVs if available */}
              <div className="pt-2 border-t border-neutral-800/60">
                <div className="text-neutral-400 font-semibold flex items-center justify-between pb-1.5">
                  <span>Estrategia Ideal en este punto:</span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {selectedNodeObj.player === 'OOP' ? 'Fuera de Posición' : 'En Posición'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {Object.entries(selectedStrat.overallStrategy).map(([act, freq]) => {
                    const ev = selectedStrat.overallActionEVs?.[act];
                    const label = selectedStrat.actionLabels?.[act] || act;
                    return (
                      <div
                        key={act}
                        className="p-1.5 bg-neutral-950 rounded border border-neutral-800 flex flex-col justify-between"
                      >
                        <div className="text-[10px] font-bold text-white truncate">{label}</div>
                        <div className="flex items-center justify-between text-[10px] font-mono mt-0.5">
                          <span className="text-emerald-400 font-semibold">{Math.round(freq * 100)}%</span>
                          {ev !== undefined && (
                            <span className={ev >= 0 ? 'text-neutral-300' : 'text-rose-400'}>
                              EV: {ev > 0 ? `+${ev.toFixed(1)}` : ev.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action recommendation for unconverged nodes */}
              {convInfo.isCritical && onRefineSolve && (
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-rose-800/50">
                  <span className="text-[11px] text-rose-300">
                    Se recomienda calcular iteraciones adicionales para estabilizar este nodo:
                  </span>
                  <button
                    onClick={onRefineSolve}
                    disabled={isSolving}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors shrink-0 shadow-sm"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSolving ? 'animate-spin' : ''}`} />
                    <span>{isSolving ? 'Calculando...' : 'Refinar Convergencia'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Branch Options: Next Actions From This Node */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span>Siguientes Ramas Disponibles ({childEntries.length}):</span>
            </span>
            <span className="text-[10px] text-neutral-500">Haz clic en una rama para explorarla</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {childEntries.map(([actionKey, childNode]) => {
              const colorClass = getActionBadgeColor(actionKey);
              const isAction = childNode.nodeType === 'action';

              if (!isAction) {
                const isFold = childNode.nodeType === 'fold';
                const isHeroWinner = isFold && (childNode as any).winner === heroRole;

                return (
                  <div
                    key={actionKey}
                    className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}>
                        {actionKey}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        Pot: {childNode.pot}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-300 font-medium">
                      {isFold ? (
                        <span className="text-red-400">
                          {isHeroWinner ? '🎉 Fold del Villano (Ganas el bote)' : '🚪 Hero Foldea (Bote surrender)'}
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-cyan-400 font-bold">
                            🏁 Fin de Ronda en {currentStreet.toUpperCase()}
                          </span>
                          <p className="text-[11px] text-neutral-400">
                            La acción culmina en esta calle. La mano continúa hacia la siguiente calle o showdown.
                          </p>
                        </div>
                      )}
                    </div>

                    {!isFold && currentStreet !== 'river' && (
                      <button
                        onClick={() => setViewMode('guide')}
                        className="w-full mt-1 py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Ver Guía para el {nextStreetName.toUpperCase()} →</span>
                      </button>
                    )}
                  </div>
                );
              }

              // Child is an ActionNode
              const actChild = childNode as ActionNode;
              const isSelected = actChild.id === selectedNodeId;
              const childConv = getNodeConvergence(actChild.id);

              return (
                <div
                  key={actionKey}
                  onClick={() => onSelectNode(actChild)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all space-y-2 relative overflow-hidden ${
                    childConv.isCritical
                      ? 'border-rose-500/80 bg-gradient-to-r from-rose-950/30 to-neutral-900 shadow-sm'
                      : isSelected
                      ? 'bg-neutral-800 border-emerald-500 shadow-sm'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}>
                      Acción: {actionKey}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {childConv.isCritical && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-400 bg-rose-950 px-1.5 py-0.2 rounded border border-rose-800 animate-pulse">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>+{childConv.localExploitabilityBB} bb</span>
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-neutral-400">
                        Pot: {actChild.pot}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-semibold">
                      Turno: {actChild.player === heroRole ? `Hero (${heroPos})` : `Villano (${villainPos})`}
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render Hierarchical Tree View with filters and alert highlighting
  const renderTreeView = (node: GameNode, depth = 0): React.ReactNode => {
    if (node.nodeType !== 'action') {
      const isFold = node.nodeType === 'fold';
      return (
        <div
          key={node.id}
          style={{ paddingLeft: `${depth * 20}px` }}
          className="flex items-center gap-2 py-1.5 text-xs text-neutral-400 font-mono"
        >
          <span className="text-neutral-700">└─</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
              isFold
                ? 'bg-red-950/40 text-red-400 border-red-800/40'
                : 'bg-cyan-950/40 text-cyan-400 border-cyan-800/40'
            }`}
          >
            {isFold ? `Fold (${(node as any).winner} gana)` : 'Showdown / Fin de Ronda'}
          </span>
          <span className="text-neutral-500">Pot: {node.pot}</span>
        </div>
      );
    }

    const actionNode = node as ActionNode;
    const isSelected = actionNode.id === selectedNodeId;
    const isCollapsed = collapsedNodes.has(actionNode.id);
    const hasChildren = Object.keys(actionNode.children).length > 0;
    const strat = nodeStrategies?.get(actionNode.id);
    const isHero = actionNode.player === heroRole;
    const convInfo = getNodeConvergence(actionNode.id);

    // If filtering by alerts only, skip branch unless it or its children have alerts
    if (onlyShowAlerts && !convInfo.isCritical && !isSelected) {
      // Check if any descendant has critical alert
      let hasAlertDescendant = false;
      function check(n: GameNode) {
        if (n.nodeType === 'action') {
          if (getNodeConvergence(n.id).isCritical) hasAlertDescendant = true;
          for (const c of Object.values((n as ActionNode).children)) {
            check(c);
          }
        }
      }
      check(actionNode);
      if (!hasAlertDescendant) return null;
    }

    return (
      <div key={actionNode.id} className="flex flex-col">
        <div
          onClick={() => onSelectNode(actionNode)}
          style={{ paddingLeft: `${depth * 20}px` }}
          className={`flex items-center justify-between py-2 px-2.5 rounded-lg text-left cursor-pointer transition-colors ${
            convInfo.isCritical
              ? 'bg-rose-950/40 border border-rose-600/70 text-white font-medium shadow-sm'
              : isSelected
              ? 'bg-neutral-800 text-white font-medium border border-neutral-700 shadow-sm'
              : 'hover:bg-neutral-900/60 text-neutral-300'
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {hasChildren ? (
              <button
                onClick={(e) => toggleCollapse(actionNode.id, e)}
                className="text-neutral-500 hover:text-white p-0.5"
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono ${
                isHero
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                  : 'bg-amber-950 text-amber-400 border-amber-800/60'
              }`}
            >
              {actionNode.player} {isHero ? '(Hero)' : '(Villain)'}
            </span>

            <span className="text-xs font-semibold text-white truncate">
              {actionNode.id === 'root' ? 'Raíz' : actionNode.history.slice(-1)[0]}
            </span>

            {/* Alert badge directly in tree row */}
            {convInfo.isCritical && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                <AlertTriangle className="w-2.5 h-2.5" />
                <span>🚨 +{convInfo.localExploitabilityBB} BB</span>
              </span>
            )}

            <span className="text-[11px] text-neutral-500 font-mono">
              ({actionNode.pot} chips)
            </span>
          </div>

          {/* Mini strategy pill */}
          {strat && (
            <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
              {Object.entries(strat.overallStrategy).slice(0, 3).map(([act, freq]) => (
                <span key={act} className={`${getActionBadgeColor(act)} px-1 py-0.2 rounded border`}>
                  {act[0]}: {Math.round(freq * 100)}%
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Children if not collapsed */}
        {!isCollapsed && hasChildren && (
          <div className="flex flex-col">
            {Object.entries(actionNode.children).map(([actionKey, child]) => (
              <React.Fragment key={actionKey}>
                {renderTreeView(child, depth + 1)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3.5 shadow-xl">
      {/* Top Header & View Modes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Árbol de Decisión & Alertas de Convergencia</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-950 text-emerald-400 border border-neutral-800">
              Calle: {currentStreet.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Supervisa la convergencia de Nash, niveles de arrepentimiento (regret) y guía para la siguiente calle.
          </p>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          <button
            onClick={() => setViewMode('flow')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              viewMode === 'flow'
                ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Flujograma</span>
          </button>

          <button
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              viewMode === 'tree'
                ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Jerárquico</span>
          </button>

          <button
            onClick={() => setViewMode('guide')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
              viewMode === 'guide'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Guía Siguiente Calle</span>
          </button>
        </div>
      </div>

      {/* COMPREHENSIVE CONVERGENCE & REGRET ALERT BAR */}
      <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left status badge & health indicator */}
          <div className="flex items-center gap-2.5">
            {treeConvergenceStats.criticalCount > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950 border border-rose-500 text-rose-300 font-bold text-xs animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>{treeConvergenceStats.criticalCount} Nodos con Alerta Crítica</span>
                </span>
                <button
                  onClick={handleJumpToNextAlert}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 border border-neutral-700 cursor-pointer"
                  title="Saltar al siguiente nodo con falta de convergencia"
                >
                  <span>Saltar al nodo →</span>
                </button>
                {onRefineSolve && (
                  <button
                    onClick={onRefineSolve}
                    disabled={isSolving}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="Resolver y converger todos los nodos para reparar las alertas críticas"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSolving ? 'animate-spin' : ''}`} />
                    <span>{isSolving ? 'Reparando Nodos...' : '⚡ Reparar Todos los Nodos'}</span>
                  </button>
                )}
              </div>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Todos los Nodos en Equilibrio ({treeConvergenceStats.convergedCount} evaluados)</span>
              </span>
            )}

            <span className="text-[11px] font-mono text-neutral-400 hidden md:inline">
              Salud: <strong className={treeConvergenceStats.healthPercent > 80 ? 'text-emerald-400' : 'text-amber-400'}>{treeConvergenceStats.healthPercent}%</strong> en equilibrio
            </span>
          </div>

          {/* Right controls: filter alerts & threshold toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyShowAlerts(!onlyShowAlerts)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                onlyShowAlerts
                  ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>Sólo Alertas ({treeConvergenceStats.criticalCount})</span>
            </button>

            <button
              onClick={() => setShowThresholdConfig(!showThresholdConfig)}
              className={`p-1.5 rounded-lg border transition-colors ${
                showThresholdConfig
                  ? 'bg-neutral-800 border-neutral-700 text-white'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
              title="Ajustar Umbral Crítico de Exploitability / Regret"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsible Threshold Configuration Strip */}
        {showThresholdConfig && (
          <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-medium">Umbral Crítico de Exploitability:</span>
              <span className="font-mono text-white font-bold bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                {criticalThresholdBB} BB
              </span>
            </div>

            {/* Threshold Quick Presets */}
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <button
                onClick={() => setCriticalThresholdBB(0.15)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  criticalThresholdBB === 0.15
                    ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                Estricto (0.15 BB)
              </button>
              <button
                onClick={() => setCriticalThresholdBB(0.35)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  criticalThresholdBB === 0.35
                    ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                Estándar (0.35 BB)
              </button>
              <button
                onClick={() => setCriticalThresholdBB(0.75)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  criticalThresholdBB === 0.75
                    ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                Permisivo (0.75 BB)
              </button>
            </div>

            {/* Slider */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">0.05</span>
              <input
                type="range"
                min="0.05"
                max="1.50"
                step="0.05"
                value={criticalThresholdBB}
                onChange={(e) => setCriticalThresholdBB(parseFloat(e.target.value))}
                className="w-28 accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-neutral-500">1.50 BB</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Breadcrumb Trail ("Ruta de la Mano") */}
      <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <span className="text-neutral-500 font-semibold uppercase text-[10px] shrink-0 pl-1">
          Ruta:
        </span>
        {breadcrumbPath.map((item, idx) => {
          const isLast = idx === breadcrumbPath.length - 1;
          const nodeConv = getNodeConvergence(item.node.id);
          return (
            <React.Fragment key={item.node.id}>
              <button
                onClick={() => onSelectNode(item.node)}
                className={`px-2 py-0.5 rounded font-mono font-medium transition-colors whitespace-nowrap flex items-center gap-1 border ${
                  nodeConv.isCritical
                    ? 'bg-rose-950/90 text-rose-300 border-rose-500 font-bold shadow-xs'
                    : isLast
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800 font-bold shadow-xs'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                {nodeConv.isCritical && (
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                )}
                <span>{item.actionLabel}</span>
                <span className="text-[9px] text-neutral-500">({item.node.pot})</span>
              </button>
              {!isLast && <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* VIEW 1: INTERACTIVE FLOWCHART VIEW */}
      {viewMode === 'flow' && (
        <div className="space-y-3">
          {renderFlowchartView()}

          {/* Quick Banner to jump to Next Street Guide */}
          <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-cyan-950/40 border border-emerald-800/40 rounded-xl flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <div className="text-white font-bold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>¿Qué hacer en el {nextStreetName.toUpperCase()} según la carta que caiga?</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Consulta los planes por runouts (Sobrecartas, Bricks, Proyectos) y simula la siguiente carta.
              </p>
            </div>
            <button
              onClick={() => setViewMode('guide')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shrink-0 shadow-xs"
            >
              Abrir Guía →
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: HIERARCHICAL TREE VIEW */}
      {viewMode === 'tree' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pb-1">
            <span>Jerarquía completa de ramas y alertas:</span>
            <span className="text-neutral-500">Usa las flechas para colapsar/expandir</span>
          </div>

          <div className="overflow-y-auto max-h-[380px] space-y-0.5 pr-1 border border-neutral-800/60 rounded-lg p-2 bg-neutral-950">
            {renderTreeView(rootNode, 0)}
          </div>
        </div>
      )}

      {/* VIEW 3: NEXT STREET PLAYBOOK & GUIDANCE */}
      {viewMode === 'guide' && (
        <NextStreetGuide
          currentStreet={currentStreet}
          boardCards={boardCards}
          heroPos={heroPos}
          villainPos={villainPos}
          heroRole={heroRole}
          nodeHistory={selectedNodeObj.history}
          heroCards={heroCards}
          onAdvanceStreet={onAdvanceStreet}
        />
      )}
    </div>
  );
};
