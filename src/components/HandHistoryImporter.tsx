/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HandHistoryImporter: Módulo Propietario TheTracker2 · Allin School.
 * - Hasta 3 bases de datos independientes por UID con selector TheTracker2.
 * - Carga multi-sala (.txt, .log, .xml, .json y .zip) con reporte exacto de duplicadas.
 * - 4 gráficas TheTracker2 en D3.js (Won BB, EV Adjusted, Showdown, Non-Showdown).
 * - Selector de Filtros Importados junto a la gráfica + botón Actualizar (Refresh).
 * - Puente directo de 1 clic para cargar cualquier mano en Lab Studio.
 * - Integra TheTracker2HudDisplay (3 cuadros) y LevelDiagnosticPanel en sub-pestañas.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import * as d3 from 'd3';
import {
  appendHandsToTracker2Database,
  buildTracker2ChartSeries,
  computeHudStats,
  exportTracker2BackupGzip,
  exportTracker2BackupZip,
  filterHands,
  generateSampleSessionHands,
  getActiveTracker2DatabaseId,
  getHandActionSteps,
  importTracker2BackupFromBytes,
  loadTracker2Databases,
  MAX_TRACKER2_DATABASES,
  parseHandHistoriesText,
  POPULATION_BENCHMARKS,
  saveTracker2Databases,
  setActiveTracker2DatabaseId,
  type ParsedHandRecord,
  type Tracker2Database,
  type Tracker2FilterKey
} from '../engine/theTracker2Engine';
import { parseCard, SUIT_COLORS, SUIT_SYMBOLS } from '../engine/cards';
import type { SimPosition, SimScenarioType } from '../engine/handSimulator';
import { TheTracker2HudDisplay } from './TheTracker2HudDisplay';
import { LevelDiagnosticPanel } from './LevelDiagnosticPanel';
import { auth } from '../lib/firebase';
import { AutoLearningEngine } from '../engine/autoLearningEngine';
import { incrementMissionProgress } from '../lib/experienceMode';
import { PokerGlossaryTip } from './PokerGlossaryTip';
import {
  Database,
  UploadCloud,
  Plus,
  Trash2,
  RefreshCw,
  FileArchive,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Filter,
  BarChart3,
  Activity,
  Brain,
  Bookmark,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Cpu
} from 'lucide-react';

interface HandHistoryImporterProps {
  onLaunchDrill: (pos: SimPosition | 'RANDOM', scenario: SimScenarioType | 'RANDOM') => void;
  onGoToTrainer?: () => void;
  onLoadInLabStudio?: (hand: ParsedHandRecord) => void;
}

const FILTER_OPTIONS: Array<{ key: Tracker2FilterKey; label: string }> = [
  { key: 'ALL', label: 'Todas las manos' },
  { key: 'EP', label: 'Posición UTG / EP' },
  { key: 'MP', label: 'Posición MP' },
  { key: 'CO', label: 'Posición CO' },
  { key: 'BTN', label: 'Posición BTN' },
  { key: 'SB', label: 'Posición SB' },
  { key: 'BB', label: 'Posición BB' },
  { key: 'SRP', label: 'Botes SRP' },
  { key: '3BET', label: 'Botes 3-Bet' },
  { key: '4BET', label: 'Botes 4-Bet' },
  { key: 'MULTIWAY', label: 'Botes Multiway' },
  { key: 'SHOWDOWN', label: 'Solo Showdown' },
  { key: 'WINS', label: 'Manos Ganadoras' },
  { key: 'LOSSES', label: 'Manos Perdedoras' }
];

export const HandHistoryImporter: React.FC<HandHistoryImporterProps> = ({
  onLaunchDrill,
  onGoToTrainer,
  onLoadInLabStudio
}) => {
  const [subTab, setSubTab] = useState<'tracker2' | 'diagnostic'>('tracker2');
  const [databases, setDatabases] = useState<Tracker2Database[]>(() => loadTracker2Databases());
  const [activeDbId, setActiveDbId] = useState<string>(() => getActiveTracker2DatabaseId());
  const [activeFilter, setActiveFilter] = useState<Tracker2FilterKey>('ALL');
  const [pasteText, setPasteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [newDbName, setNewDbName] = useState('');
  const [showCreateDb, setShowCreateDb] = useState(false);

  const [importBanner, setImportBanner] = useState<{
    kind: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const [visibleLines, setVisibleLines] = useState({
    wonBB: true,
    evAdjustedBB: true,
    showdownBB: true,
    nonShowdownBB: true
  });

  const [hoverPointIdx, setHoverPointIdx] = useState<number | null>(null);
  const [benchmarkStake, setBenchmarkStake] = useState<'NL10' | 'NL25' | 'NL50+'>('NL25');
  const [selectedHandId, setSelectedHandId] = useState<string>('');
  const [handReviewLoading, setHandReviewLoading] = useState(false);
  const [handReviewError, setHandReviewError] = useState<string | null>(null);
  const [handReviewResult, setHandReviewResult] = useState<{
    handId: string;
    summary: string;
    leakDetected: string;
    correctLine: string;
    keyTakeaway: string;
  } | null>(null);
  const [sm2ExportedId, setSm2ExportedId] = useState<string | null>(null);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [replayerStepIdx, setReplayerStepIdx] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const activeDb = useMemo(
    () => databases.find(d => d.id === activeDbId) || databases[0],
    [databases, activeDbId]
  );

  const filteredHands = useMemo(
    () => filterHands(activeDb?.hands || [], activeFilter),
    [activeDb, activeFilter]
  );

  const chartSeries = useMemo(() => buildTracker2ChartSeries(filteredHands), [filteredHands]);
  const hudStats = useMemo(() => computeHudStats(filteredHands), [filteredHands]);

  const notableHands = useMemo(() => {
    return [...filteredHands]
      .sort((a, b) => a.netWonBB - b.netWonBB)
      .slice(0, 25);
  }, [filteredHands]);

  const inspectedHand = useMemo(() => {
    if (notableHands.length === 0) return null;
    return notableHands.find(h => h.id === selectedHandId) || notableHands[0];
  }, [notableHands, selectedHandId]);

  const replaySteps = useMemo(() => {
    if (!inspectedHand) return [];
    return getHandActionSteps(inspectedHand);
  }, [inspectedHand]);

  const clampedStepIdx = Math.min(replayerStepIdx, Math.max(0, replaySteps.length - 1));
  const currentReplayStep = replaySteps[clampedStepIdx] || null;

  useEffect(() => {
    setReplayerStepIdx(0);
    setIsReplaying(false);
  }, [inspectedHand?.id]);

  useEffect(() => {
    if (!isReplaying || replaySteps.length <= 1) return;
    if (clampedStepIdx >= replaySteps.length - 1) {
      setIsReplaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReplayerStepIdx(prev => Math.min(replaySteps.length - 1, prev + 1));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [isReplaying, clampedStepIdx, replaySteps.length]);

  const handleSelectDb = (id: string) => {
    setActiveDbId(id);
    setActiveTracker2DatabaseId(id);
    setConfirmClearId(null);
  };

  const handleRefresh = () => {
    const fresh = loadTracker2Databases();
    setDatabases(fresh);
    setHoverPointIdx(null);
    setImportBanner({
      kind: 'success',
      text: `Vista actualizada: ${fresh.find(d => d.id === activeDbId)?.hands.length || 0} manos totales en "${activeDb?.name}".`
    });
  };

  const handleCreateDatabase = () => {
    if (databases.length >= MAX_TRACKER2_DATABASES) return;
    const clean = newDbName.trim() || `Base 6-Max #${databases.length + 1}`;
    const created: Tracker2Database = {
      id: `db-${Date.now()}`,
      name: clean.slice(0, 40),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hands: [],
      importedFiles: []
    };
    const next = [...databases, created];
    saveTracker2Databases(next);
    setDatabases(next);
    setActiveDbId(created.id);
    setActiveTracker2DatabaseId(created.id);
    setNewDbName('');
    setShowCreateDb(false);
    setImportBanner({ kind: 'success', text: `Nueva base "${created.name}" creada y activada.` });
  };

  const handleDeleteOrClearDb = (id: string) => {
    if (databases.length === 1) {
      const reset = databases.map(d =>
        d.id === id ? { ...d, hands: [], importedFiles: [], updatedAt: Date.now() } : d
      );
      saveTracker2Databases(reset);
      setDatabases(reset);
      setConfirmClearId(null);
      setImportBanner({ kind: 'warning', text: `Se vaciaron todas las manos de "${activeDb?.name}".` });
      return;
    }
    const remaining = databases.filter(d => d.id !== id);
    saveTracker2Databases(remaining);
    setDatabases(remaining);
    if (activeDbId === id && remaining[0]) {
      setActiveDbId(remaining[0].id);
      setActiveTracker2DatabaseId(remaining[0].id);
    }
    setConfirmClearId(null);
    setImportBanner({ kind: 'warning', text: 'Base de datos eliminada de tu espacio privado.' });
  };

  const ingestFiles = async (fileList: FileList | File[]) => {
    if (!activeDb) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsImporting(true);
    let totalAdded = 0;
    let totalDup = 0;
    let processedSources = 0;

    try {
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files).filter(
            entry => !entry.dir && /\.(txt|log|json|xml)$/i.test(entry.name)
          );
          for (const entry of entries) {
            const content = await entry.async('string');
            const parsed = parseHandHistoriesText(content, entry.name);
            if (parsed.length > 0) {
              const res = appendHandsToTracker2Database(activeDb.id, parsed, `${file.name}/${entry.name}`);
              setDatabases(res.databases);
              totalAdded += res.addedCount;
              totalDup += res.duplicateCount;
              processedSources++;
            }
          }
        } else {
          const content = await file.text();
          const parsed = parseHandHistoriesText(content, file.name);
          if (parsed.length > 0) {
            const res = appendHandsToTracker2Database(activeDb.id, parsed, file.name);
            setDatabases(res.databases);
            totalAdded += res.addedCount;
            totalDup += res.duplicateCount;
            processedSources++;
          }
        }
      }

      if (processedSources === 0) {
        setImportBanner({
          kind: 'error',
          text: 'No se detectaron historiales de manos compatibles (.txt, .xml, .zip o JSON estándar de sala).'
        });
      } else {
        setImportBanner({
          kind: totalDup > 0 ? 'warning' : 'success',
          text: `Importación completada en "${activeDb.name}": ${totalAdded} manos nuevas agregadas · ${totalDup} duplicadas omitidas automáticamente.`
        });
      }
    } catch (err) {
      setImportBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Error leyendo archivo o ZIP.'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportPaste = () => {
    if (!activeDb || !pasteText.trim()) return;
    const parsed = parseHandHistoriesText(pasteText, `pegado-${Date.now()}`);
    if (parsed.length === 0) {
      setImportBanner({
        kind: 'error',
        text: 'El texto pegado no coincide con un formato de historial de sala o arreglo JSON válido.'
      });
      return;
    }
    const res = appendHandsToTracker2Database(activeDb.id, parsed, `Texto manual (${parsed.length})`);
    setDatabases(res.databases);
    setPasteText('');
    setImportBanner({
      kind: res.duplicateCount > 0 ? 'warning' : 'success',
      text: `${res.addedCount} manos nuevas agregadas a "${activeDb.name}" · ${res.duplicateCount} duplicadas omitidas.`
    });
  };

  const handleLoadDemoSession = () => {
    if (!activeDb) return;
    const demo = generateSampleSessionHands(250, 'demo250');
    const res = appendHandsToTracker2Database(activeDb.id, demo, 'Sesión Demo 250 Manos');
    setDatabases(res.databases);
    setImportBanner({
      kind: res.duplicateCount > 0 ? 'warning' : 'success',
      text:
        res.addedCount > 0
          ? `Sesión Demo cargada en "${activeDb.name}": ${res.addedCount} manos agregadas · ${res.duplicateCount} duplicadas omitidas.`
          : `Todas las 250 manos demo ya existían en "${activeDb.name}" (${res.duplicateCount} duplicadas omitidas).`
    });
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportPortableBackup = async (format: 'zip' | 'gz') => {
    setIsBackupBusy(true);
    try {
      if (format === 'zip') {
        const res = await exportTracker2BackupZip(databases, activeDbId);
        triggerBlobDownload(res.blob, res.filename);
        setImportBanner({
          kind: 'success',
          text: `Respaldo portátil .ZIP descargado (${res.dbCount} base(s), ${res.handsCount} manos comprimidas).`
        });
      } else {
        const res = await exportTracker2BackupGzip(databases, activeDbId);
        triggerBlobDownload(res.blob, res.filename);
        setImportBanner({
          kind: 'success',
          text: `Respaldo portátil ${res.isGzipped ? '.JSON.GZ' : '.JSON'} descargado (${res.dbCount} base(s), ${res.handsCount} manos).`
        });
      }
    } catch (err) {
      setImportBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'No se pudo generar el respaldo portátil.'
      });
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleImportPortableBackup = async (file: File) => {
    setIsBackupBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const res = await importTracker2BackupFromBytes(file.name, buf);
      setDatabases(res.databases);
      setImportBanner({
        kind: res.duplicateHands > 0 ? 'warning' : 'success',
        text: `Respaldo restaurado: ${res.addedHands} manos nuevas importadas (${res.addedDbs} base(s) nueva(s)) · ${res.duplicateHands} duplicadas omitidas.`
      });
    } catch (err) {
      setImportBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'No se pudo leer el archivo de respaldo.'
      });
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleAnalyzeHandWithAI = async () => {
    if (!inspectedHand) return;
    setHandReviewLoading(true);
    setHandReviewError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/gemini/hand-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          heroPos: inspectedHand.heroPos,
          scenario: inspectedHand.scenario,
          heroCards: inspectedHand.heroCardsStr,
          board: inspectedHand.boardStr,
          netWonBB: inspectedHand.netWonBB
        })
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Error ${res.status} al analizar mano.`);
      }
      const data = (await res.json()) as {
        summary: string;
        leakDetected: string;
        correctLine: string;
        keyTakeaway: string;
      };
      setHandReviewResult({
        handId: inspectedHand.id,
        summary: data.summary,
        leakDetected: data.leakDetected,
        correctLine: data.correctLine,
        keyTakeaway: data.keyTakeaway
      });
    } catch (err) {
      setHandReviewError(err instanceof Error ? err.message : 'No se pudo completar el análisis IA.');
    } finally {
      setHandReviewLoading(false);
    }
  };

  const handleSendHandToSM2 = () => {
    if (!inspectedHand) return;
    const isMistake = inspectedHand.netWonBB < -3;
    const takeaway =
      handReviewResult?.handId === inspectedHand.id
        ? handReviewResult.keyTakeaway
        : `Revisión TheTracker2 (${inspectedHand.heroPos === 'EP' ? 'UTG / EP' : inspectedHand.heroPos} · ${inspectedHand.potType}): evalúa C-Bet, SPR y Pot Odds con ${inspectedHand.heroCardsStr} en ${inspectedHand.boardStr}.`;

    AutoLearningEngine.getInstance().collectHand({
      heroPos: inspectedHand.heroPos === 'EP' ? 'UTG / EP' : inspectedHand.heroPos,
      villainPos: 'Villain',
      heroCards: inspectedHand.heroCardsStr,
      board: inspectedHand.boardStr,
      street: inspectedHand.wentToShowdown ? 'river' : 'flop',
      category: `TheTracker2 ${inspectedHand.potType}`,
      potBB: Math.max(3, Math.round(inspectedHand.heroInvestedBB * 2)),
      chosenAction: inspectedHand.cbet === false ? 'Check / Call' : 'Bet / Raise',
      optimalAction:
        handReviewResult?.handId === inspectedHand.id
          ? handReviewResult.correctLine
          : 'Línea de Equilibrio Lab Studio por posición y textura',
      evLossPct: isMistake ? Math.min(25, Math.max(3.5, Math.abs(inspectedHand.netWonBB))) : 1.2,
      isMistake,
      keyTakeaway: takeaway
    });
    setSm2ExportedId(inspectedHand.id);
    incrementMissionProgress('m-sm2', 1);
  };

  // D3.js 4-Series TheTracker2 Line Graph
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 820;
    const height = 290;
    const margin = { top: 18, right: 24, bottom: 32, left: 56 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxHand = Math.max(1, chartSeries[chartSeries.length - 1]?.handIndex || 1);
    const allY: number[] = [0];
    for (const p of chartSeries) {
      if (visibleLines.wonBB) allY.push(p.wonBB);
      if (visibleLines.evAdjustedBB) allY.push(p.evAdjustedBB);
      if (visibleLines.showdownBB) allY.push(p.showdownBB);
      if (visibleLines.nonShowdownBB) allY.push(p.nonShowdownBB);
    }

    const minY = Math.min(-10, ...(allY.length ? allY : [-10]));
    const maxY = Math.max(10, ...(allY.length ? allY : [10]));
    const padY = Math.max(4, (maxY - minY) * 0.12);

    const xScale = d3.scaleLinear().domain([0, maxHand]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([minY - padY, maxY + padY]).range([innerH, 0]);

    // Horizontal grid lines
    const yTicks = yScale.ticks(5);
    g.selectAll('.grid-line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', d => (d === 0 ? '#52525b' : '#262626'))
      .attr('stroke-width', d => (d === 0 ? 1.4 : 1))
      .attr('stroke-dasharray', d => (d === 0 ? '4,4' : '2,3'));

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat(d => `#${d}`);
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d} BB`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text, path, line')
      .attr('stroke', '#52525b')
      .attr('fill', '#a3a3a3')
      .style('font-size', '10px');

    g.append('g')
      .call(yAxis)
      .selectAll('text, path, line')
      .attr('stroke', '#52525b')
      .attr('fill', '#a3a3a3')
      .style('font-size', '10px');

    const drawSeries = (key: 'wonBB' | 'evAdjustedBB' | 'showdownBB' | 'nonShowdownBB', color: string, widthPx: number) => {
      if (!visibleLines[key] || chartSeries.length < 2) return;
      const lineGen = d3
        .line<(typeof chartSeries)[number]>()
        .x(d => xScale(d.handIndex))
        .y(d => yScale(d[key]));

      g.append('path')
        .datum(chartSeries)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', widthPx)
        .attr('d', lineGen);
    };

    drawSeries('showdownBB', '#3B82F6', 2);
    drawSeries('nonShowdownBB', '#F43F5E', 2);
    drawSeries('evAdjustedBB', '#F59E0B', 2.2);
    drawSeries('wonBB', '#10B981', 2.6);

    if (hoverPointIdx !== null && chartSeries[hoverPointIdx]) {
      const pt = chartSeries[hoverPointIdx];
      g.append('line')
        .attr('x1', xScale(pt.handIndex))
        .attr('x2', xScale(pt.handIndex))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#60a5fa')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    }
  }, [chartSeries, visibleLines, hoverPointIdx]);

  const activeHoverPoint =
    hoverPointIdx !== null && chartSeries[hoverPointIdx]
      ? chartSeries[hoverPointIdx]
      : chartSeries[chartSeries.length - 1];

  return (
    <div className="space-y-6">
      {/* TOP SUB-TABS: THETRACKER2 PRO vs LEVEL DIAGNOSTIC */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-950 border border-neutral-800 rounded-2xl p-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            TheTracker2 Pro · Auditoría de Manos &amp; Diagnóstico de Nivel
          </h1>
          <p className="text-xs text-neutral-400">
            Tus bases de datos, HUD propietario y progreso del Reto de 100 Manos están aislados exclusivamente para tu cuenta.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-black border border-neutral-800">
          <button
            type="button"
            onClick={() => setSubTab('tracker2')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'tracker2' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>TheTracker2 (Gráficas &amp; HUD)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('diagnostic')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'diagnostic' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnóstico de Nivel</span>
          </button>
        </div>
      </div>

      {subTab === 'diagnostic' ? (
        <LevelDiagnosticPanel
          activeTracker2Db={activeDb}
          onLaunchDrill={onLaunchDrill}
          onGoToTrainer={onGoToTrainer}
        />
      ) : (
        <>
          {/* THETRACKER2 DATABASE BAR (UP TO 3 DBs) */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                <Database className="w-4 h-4" />
                <span>Bases de Datos TheTracker2 ({databases.length} / {MAX_TRACKER2_DATABASES} máximo)</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadDemoSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cargar Sesión Demo (250 Manos)</span>
                </button>

                {databases.length < MAX_TRACKER2_DATABASES && (
                  <button
                    type="button"
                    onClick={() => setShowCreateDb(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-200 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Nueva Base</span>
                  </button>
                )}
              </div>
            </div>

            {showCreateDb && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-black border border-neutral-800">
                <input
                  type="text"
                  value={newDbName}
                  onChange={e => setNewDbName(e.target.value)}
                  placeholder="Ej: NL10 Sesión Octubre 6-Max"
                  className="flex-1 min-w-[200px] bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCreateDatabase}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                >
                  Crear Base
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {databases.map(dbItem => {
                const isSelected = dbItem.id === activeDb?.id;
                return (
                  <div
                    key={dbItem.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-950/30 border-blue-500'
                        : 'bg-black border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectDb(dbItem.id)}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="text-xs font-bold text-white truncate">{dbItem.name}</div>
                      <div className="text-[11px] font-mono tabular-nums text-neutral-400 mt-0.5">
                        {dbItem.hands.length} manos · {dbItem.importedFiles.length} archivos
                      </div>
                    </button>

                    {confirmClearId === dbItem.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteOrClearDb(dbItem.id)}
                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearId(null)}
                          className="px-2 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-[10px] cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearId(dbItem.id)}
                        title={databases.length === 1 ? 'Vaciar base' : 'Eliminar base'}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {importBanner && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  importBanner.kind === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : importBanner.kind === 'warning'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}
              >
                {importBanner.kind === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{importBanner.text}</span>
              </div>
            )}

            {/* DROPZONE + TEXT PASTE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) {
                    void ingestFiles(e.dataTransfer.files);
                  }
                }}
                className={`lg:col-span-6 p-5 rounded-xl border border-dashed flex flex-col items-center justify-center text-center gap-2.5 transition-colors ${
                  isDragging
                    ? 'bg-blue-950/30 border-blue-500'
                    : 'bg-black border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.log,.json,.zip,.xml"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.length) {
                      void ingestFiles(e.target.files);
                    }
                    e.target.value = '';
                  }}
                />
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  {isImporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileArchive className="w-5 h-5" />}
                </div>
                <div className="text-xs font-semibold text-white">
                  Arrastra aquí tus historiales (.txt, .xml, .json o .zip exportados de sala)
                </div>
                <p className="text-[11px] text-neutral-400 max-w-md">
                  Anexa sesiones nuevas directamente a <strong className="text-white">{activeDb?.name}</strong> con detección exacta de manos duplicadas.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isImporting ? 'Procesando archivo...' : 'Seleccionar Archivos / ZIP'}</span>
                </button>
              </div>

              <div className="lg:col-span-6 flex flex-col gap-2">
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={4}
                  placeholder="O pega aquí el historial de texto exportado de tu sala de póker o un arreglo JSON..."
                  className="w-full flex-1 bg-black border border-neutral-800 rounded-xl p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-blue-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleImportPaste}
                    disabled={!pasteText.trim()}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
                  >
                    Anexar Texto Pegado a Base Activa
                  </button>
                </div>
              </div>
            </div>

            {/* PORTABLE BACKUP BAR BETWEEN DEVICES (.ZIP / .JSON.GZ) */}
            <div className="pt-3 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-400">
                <strong className="text-neutral-200">Respaldo Portátil entre Dispositivos:</strong> Exporta o restaura tus bases TheTracker2 completas con compresión sin saturar tu cuenta.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={backupInputRef}
                  type="file"
                  accept=".zip,.gz,.json.gz,.json"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void handleImportPortableBackup(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={isBackupBusy}
                  onClick={() => void handleExportPortableBackup('zip')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-900 border border-neutral-800 text-xs font-semibold text-blue-300 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Respaldo (.ZIP)</span>
                </button>
                <button
                  type="button"
                  disabled={isBackupBusy}
                  onClick={() => void handleExportPortableBackup('gz')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-900 border border-neutral-800 text-xs font-semibold text-emerald-300 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar (.JSON.GZ)</span>
                </button>
                <button
                  type="button"
                  disabled={isBackupBusy}
                  onClick={() => backupInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Importar Respaldo</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4-SERIES THETRACKER2 D3 GRAPH + FILTER SELECTOR BESIDE GRAPH + REFRESH */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Gráfica TheTracker2 Pro (4 Líneas): Won BB · EV Adjusted · Showdown · Non-Showdown
                </h2>
                {activeHoverPoint && (
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums mt-1">
                    <span className="text-neutral-400">Mano #{activeHoverPoint.handIndex}</span>
                    <span className="text-emerald-400">Won: {activeHoverPoint.wonBB} BB</span>
                    <span className="text-amber-300">EV: {activeHoverPoint.evAdjustedBB} BB</span>
                    <span className="text-blue-400">SD: {activeHoverPoint.showdownBB} BB</span>
                    <span className="text-rose-400">Red Line: {activeHoverPoint.nonShowdownBB} BB</span>
                  </div>
                )}
              </div>

              {/* FILTER SELECTOR BESIDE GRAPH + REFRESH BUTTON */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black border border-neutral-800">
                  <Filter className="w-3.5 h-3.5 text-blue-400" />
                  <select
                    value={activeFilter}
                    onChange={e => setActiveFilter(e.target.value as Tracker2FilterKey)}
                    aria-label="Filtro de manos importadas"
                    className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {FILTER_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key} className="bg-neutral-950 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleRefresh}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-200 cursor-pointer"
                  title="Actualizar gráfica y métricas TheTracker2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* SERIES TOGGLE CHECKBOXES */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {(
                [
                  { key: 'wonBB', label: 'Won BB (Verde)', dotClass: 'bg-emerald-500' },
                  { key: 'evAdjustedBB', label: 'EV Adjusted (Ámbar)', dotClass: 'bg-amber-400' },
                  { key: 'showdownBB', label: 'Showdown (Azul)', dotClass: 'bg-blue-500' },
                  { key: 'nonShowdownBB', label: 'Non-Showdown / Red Line (Rojo)', dotClass: 'bg-rose-500' }
                ] as const
              ).map(s => (
                <label key={s.key} className="flex items-center gap-2 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={visibleLines[s.key]}
                    onChange={() => setVisibleLines(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                    className="rounded border-neutral-700 bg-black text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`w-2.5 h-2.5 rounded-sm ${s.dotClass}`} />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>

            {filteredHands.length === 0 ? (
              <div className="h-[220px] rounded-xl bg-black border border-neutral-800 flex flex-col items-center justify-center text-center p-6 gap-2">
                <div className="text-sm font-semibold text-neutral-300">
                  No hay manos en esta base con el filtro seleccionado
                </div>
                <p className="text-xs text-neutral-500">
                  Carga tus historiales (.txt, .xml o .zip) o haz clic en &quot;Cargar Sesión Demo (250 Manos)&quot;.
                </p>
              </div>
            ) : (
              <div className="bg-black border border-neutral-800 rounded-xl p-2 overflow-x-auto">
                <svg
                  ref={svgRef}
                  viewBox="0 0 820 290"
                  className="w-full h-[270px] min-w-[540px]"
                  onMouseMove={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left - 56) / Math.max(1, rect.width - 80)));
                    const idx = Math.round(relX * (chartSeries.length - 1));
                    setHoverPointIdx(Math.max(0, Math.min(chartSeries.length - 1, idx)));
                  }}
                  onMouseLeave={() => setHoverPointIdx(null)}
                />
              </div>
            )}
          </div>

          {/* 3-BOX THETRACKER2 HUD DISPLAY */}
          <TheTracker2HudDisplay
            stats={hudStats}
            dbName={activeDb?.name || 'Base Principal'}
            onOpenDiagnostic={() => setSubTab('diagnostic')}
          />

          {/* WINNING POPULATION BENCHMARK COMPARATOR */}
          {hudStats.hands > 0 && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Comparador vs Población Ganadora (6-Max)
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Compara tus estadísticas TheTracker2 reales contra el estándar ganador del stake elegido.
                  </p>
                </div>
                <div className="flex items-center p-1 rounded-xl bg-black border border-neutral-800 text-xs font-mono">
                  {(['NL10', 'NL25', 'NL50+'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setBenchmarkStake(st)}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        benchmarkStake === st ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-mono tabular-nums">
                {(
                  [
                    { label: 'VPIP', mine: hudStats.vpip, target: POPULATION_BENCHMARKS[benchmarkStake].vpip, unit: '%' },
                    { label: 'PFR', mine: hudStats.pfr, target: POPULATION_BENCHMARKS[benchmarkStake].pfr, unit: '%' },
                    { label: '3-Bet', mine: hudStats.threeBet, target: POPULATION_BENCHMARKS[benchmarkStake].threeBet, unit: '%' },
                    { label: 'C-Bet Flop', mine: hudStats.cbet, target: POPULATION_BENCHMARKS[benchmarkStake].cbet, unit: '%' },
                    { label: 'WTSD', mine: hudStats.wtsd, target: POPULATION_BENCHMARKS[benchmarkStake].wtsd, unit: '%' },
                    { label: 'W$SD', mine: hudStats.wsd, target: POPULATION_BENCHMARKS[benchmarkStake].wsd, unit: '%' }
                  ] as const
                ).map(item => {
                  const diff = Math.round((item.mine - item.target) * 10) / 10;
                  const near = Math.abs(diff) <= 3.5;
                  return (
                    <div key={item.label} className="p-3 rounded-xl bg-black border border-neutral-800 space-y-1">
                      <span className="text-[10px] text-neutral-500 block">{item.label}</span>
                      <div className="text-sm font-bold text-white">
                        {item.mine.toFixed(1)}
                        {item.unit}
                      </div>
                      <div className={`text-[10px] ${near ? 'text-emerald-400' : 'text-amber-300'}`}>
                        Meta {benchmarkStake}: {item.target}
                        {item.unit} ({diff >= 0 ? '+' : ''}
                        {diff})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI HAND REVIEW, VISUAL 6-MAX REPLAYER & SM-2 EXPORT FOR IMPORTED HANDS */}
          {inspectedHand && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Brain className="w-4 h-4 text-blue-400" />
                    <span>Replayer Visual 6-Max · Guía IA &amp; Envío a Mazo SM-2</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Selecciona una mano (ordenadas desde las mayores pérdidas en BB) para reproducir la mesa, auditar la línea y guardarla en tu repaso SM-2.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={inspectedHand.id}
                    onChange={e => {
                      setSelectedHandId(e.target.value);
                      setHandReviewError(null);
                    }}
                    aria-label="Seleccionar mano importada para revisión"
                    className="px-3 py-1.5 rounded-xl bg-black border border-neutral-800 text-xs font-mono text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {notableHands.map(h => (
                      <option key={h.id} value={h.id} className="bg-neutral-950 text-white">
                        #{h.handKey.slice(-6)} · {h.heroPos === 'EP' ? 'UTG/EP' : h.heroPos} · {h.heroCardsStr} ({h.netWonBB >= 0 ? '+' : ''}
                        {h.netWonBB} BB)
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => void handleAnalyzeHandWithAI()}
                    disabled={handReviewLoading}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>{handReviewLoading ? 'Analizando...' : 'Analizar Mano con IA'}</span>
                  </button>

                  {onLoadInLabStudio && (
                    <button
                      type="button"
                      onClick={() => onLoadInLabStudio(inspectedHand)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Analizar en Lab Studio</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSendHandToSM2}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-emerald-300 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{sm2ExportedId === inspectedHand.id ? 'Enviada a SM-2 ✓' : 'Enviar Mano a SM-2'}</span>
                  </button>
                </div>
              </div>

              {/* VISUAL 6-MAX CHRONOLOGICAL STREET-BY-STREET REPLAYER */}
              <div className="rounded-2xl bg-gradient-to-b from-emerald-950/45 to-black border border-emerald-900/40 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                  <span className="text-neutral-300">
                    Replayer #{inspectedHand.handKey.slice(-8)} ·{' '}
                    <PokerGlossaryTip term={inspectedHand.potType === 'SRP' ? 'SRP' : inspectedHand.potType === '3Bet' ? '3-Bet' : inspectedHand.potType} />
                  </span>
                  <div className="flex flex-wrap items-center gap-3 text-neutral-300">
                    <span>
                      Calle:{' '}
                      <strong className="text-white uppercase">
                        {currentReplayStep?.street || (inspectedHand.wentToShowdown ? 'showdown' : 'preflop')}
                      </strong>
                    </span>
                    <span>
                      Bote:{' '}
                      <strong className="text-emerald-400">
                        {(currentReplayStep ? currentReplayStep.potAfterBB : inspectedHand.heroInvestedBB * 2).toFixed(1)} BB
                      </strong>
                    </span>
                    {currentReplayStep && currentReplayStep.potOddsPct !== null && (
                      <span className="text-cyan-300 font-bold">
                        Pot Odds: {currentReplayStep.potOddsPct.toFixed(1)}% (Pagar {currentReplayStep.toCallBB.toFixed(1)} BB)
                      </span>
                    )}
                    <span>
                      EV Final:{' '}
                      <strong className="text-amber-300">
                        {inspectedHand.evAdjustedBB >= 0 ? '+' : ''}
                        {inspectedHand.evAdjustedBB} BB
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Playback Transport Controls */}
                {replaySteps.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-black/80 border border-neutral-800">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsReplaying(false);
                          setReplayerStepIdx(0);
                        }}
                        title="Inicio de la mano"
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsReplaying(false);
                          setReplayerStepIdx(prev => Math.max(0, prev - 1));
                        }}
                        title="Acción anterior"
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (clampedStepIdx >= replaySteps.length - 1) {
                            setReplayerStepIdx(0);
                          }
                          setIsReplaying(prev => !prev);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        {isReplaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span>{isReplaying ? 'Pausar' : 'Reproducir'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsReplaying(false);
                          setReplayerStepIdx(prev => Math.min(replaySteps.length - 1, prev + 1));
                        }}
                        title="Siguiente acción"
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsReplaying(false);
                          setReplayerStepIdx(Math.max(0, replaySteps.length - 1));
                        }}
                        title="Final de la mano"
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, replaySteps.length - 1)}
                      value={clampedStepIdx}
                      aria-label="Línea temporal de la mano"
                      onChange={e => {
                        setIsReplaying(false);
                        setReplayerStepIdx(parseInt(e.target.value, 10));
                      }}
                      className="flex-1 min-w-[140px] accent-blue-500 cursor-pointer"
                    />

                    <span className="text-[11px] font-mono tabular-nums text-neutral-400 shrink-0">
                      Paso {clampedStepIdx + 1} / {replaySteps.length}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  {/* Hero Box */}
                  <div
                    className={`p-3 rounded-xl bg-black/75 border flex items-center justify-between gap-2 transition-colors ${
                      currentReplayStep?.isHero ? 'border-blue-400' : 'border-blue-500/30'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-mono uppercase text-blue-300">
                        Hero · {inspectedHand.heroPos === 'EP' ? 'UTG / EP' : inspectedHand.heroPos}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-neutral-400 mt-0.5">
                        Invertido: {inspectedHand.heroInvestedBB.toFixed(1)} BB
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {inspectedHand.heroCardsStr
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((tok, i) => {
                          try {
                            const c = parseCard(tok);
                            const col = SUIT_COLORS[c.suit];
                            return (
                              <span
                                key={`${tok}-${i}`}
                                className={`w-9 h-12 rounded-lg border ${col.bg} ${col.border} ${col.text} font-mono font-bold text-xs flex flex-col items-center justify-center`}
                              >
                                <span>{c.rank}</span>
                                <span>{SUIT_SYMBOLS[c.suit]}</span>
                              </span>
                            );
                          } catch {
                            return (
                              <span key={i} className="px-2 py-1 rounded bg-neutral-900 text-xs font-mono text-white">
                                {tok}
                              </span>
                            );
                          }
                        })}
                    </div>
                  </div>

                  {/* Progressive Board Center */}
                  <div className="p-3 rounded-xl bg-black/60 border border-neutral-800 flex flex-col items-center justify-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase text-neutral-400">
                      Board ({currentReplayStep?.street?.toUpperCase() || 'MESA'})
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-center min-h-[44px]">
                      {currentReplayStep && currentReplayStep.boardSoFar ? (
                        currentReplayStep.boardSoFar
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 5)
                          .map((tok, i) => {
                            try {
                              const c = parseCard(tok);
                              const col = SUIT_COLORS[c.suit];
                              return (
                                <span
                                  key={`${tok}-${i}`}
                                  className={`w-8 h-11 rounded-md border ${col.bg} ${col.border} ${col.text} font-mono font-bold text-xs flex flex-col items-center justify-center`}
                                >
                                  <span>{c.rank}</span>
                                  <span className="text-[10px]">{SUIT_SYMBOLS[c.suit]}</span>
                                </span>
                              );
                            } catch {
                              return (
                                <span key={i} className="px-2 py-1 rounded bg-neutral-900 text-xs font-mono text-white">
                                  {tok}
                                </span>
                              );
                            }
                          })
                      ) : (
                        <span className="text-xs font-mono text-neutral-500">Preflop (sin cartas comunitarias)</span>
                      )}
                    </div>
                  </div>

                  {/* Villain Box */}
                  <div
                    className={`p-3 rounded-xl bg-black/75 border flex items-center justify-between gap-2 transition-colors ${
                      currentReplayStep && !currentReplayStep.isHero && currentReplayStep.actionType !== 'deal'
                        ? 'border-amber-400/70'
                        : 'border-neutral-800'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-mono uppercase text-neutral-400">Rival / Resultado</div>
                      <div
                        className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                          inspectedHand.netWonBB >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {inspectedHand.netWonBB >= 0 ? '+' : ''}
                        {inspectedHand.netWonBB} BB
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {inspectedHand.villainCardsStr ? (
                        inspectedHand.villainCardsStr
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((tok, i) => {
                            try {
                              const c = parseCard(tok);
                              const col = SUIT_COLORS[c.suit];
                              return (
                                <span
                                  key={`${tok}-${i}`}
                                  className={`w-9 h-12 rounded-lg border ${col.bg} ${col.border} ${col.text} font-mono font-bold text-xs flex flex-col items-center justify-center`}
                                >
                                  <span>{c.rank}</span>
                                  <span>{SUIT_SYMBOLS[c.suit]}</span>
                                </span>
                              );
                            } catch {
                              return null;
                            }
                          })
                      ) : (
                        <span className="text-[11px] font-mono text-neutral-500">Muck / Fold</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Current Step Highlight + Clickable Chronological Action Log */}
                {currentReplayStep && (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-black/85 border border-blue-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-white font-semibold">{currentReplayStep.summary}</span>
                      <div className="font-mono tabular-nums text-[11px] text-neutral-400">
                        Bote tras acción: <strong className="text-emerald-400">{currentReplayStep.potAfterBB.toFixed(1)} BB</strong>
                        {currentReplayStep.potOddsPct !== null && (
                          <span className="ml-2 text-cyan-300">
                            · Equity mín. (Pot Odds): <strong>{currentReplayStep.potOddsPct.toFixed(1)}%</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 pr-1">
                      {replaySteps.map((st, idx) => {
                        const isCur = idx === clampedStepIdx;
                        return (
                          <button
                            key={`${st.stepIndex}-${st.street}`}
                            type="button"
                            onClick={() => {
                              setIsReplaying(false);
                              setReplayerStepIdx(idx);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-mono transition-colors cursor-pointer ${
                              isCur
                                ? 'bg-blue-950/60 border-blue-500 text-white font-bold'
                                : st.isHero
                                ? 'bg-black/70 border-neutral-800 text-blue-200 hover:border-blue-500/40'
                                : 'bg-black/50 border-neutral-800/80 text-neutral-400 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] opacity-80">
                              <span className="uppercase">{st.street}</span>
                              <span>{st.potAfterBB.toFixed(1)} BB</span>
                            </div>
                            <div className="truncate">{st.summary}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono tabular-nums">
                <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                  <span className="text-[10px] text-neutral-500 block">ID Mano</span>
                  <span className="text-white font-bold">#{inspectedHand.handKey.slice(-8)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                  <span className="text-[10px] text-neutral-500 block">Posición / Bote</span>
                  <span className="text-white font-bold">
                    {inspectedHand.heroPos === 'EP' ? 'UTG / EP' : inspectedHand.heroPos} · {inspectedHand.potType}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                  <span className="text-[10px] text-neutral-500 block">Cartas Hero</span>
                  <span className="text-blue-300 font-bold">{inspectedHand.heroCardsStr}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                  <span className="text-[10px] text-neutral-500 block">Board</span>
                  <span className="text-neutral-200 font-bold">{inspectedHand.boardStr || 'Preflop'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                  <span className="text-[10px] text-neutral-500 block">Neto</span>
                  <span className={`font-bold ${inspectedHand.netWonBB >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {inspectedHand.netWonBB >= 0 ? '+' : ''}
                    {inspectedHand.netWonBB} BB
                  </span>
                </div>
              </div>

              {handReviewError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200">
                  {handReviewError}
                </div>
              )}

              {handReviewResult && handReviewResult.handId === inspectedHand.id && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-1.5">
                    <div className="text-[11px] font-mono uppercase text-blue-400">Diagnóstico de la Línea</div>
                    <p className="text-neutral-200 leading-relaxed">{handReviewResult.summary}</p>
                    <p className="text-amber-300 leading-relaxed">
                      <strong>Fuga detectada:</strong> {handReviewResult.leakDetected}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-emerald-500/30 space-y-1.5">
                    <div className="text-[11px] font-mono uppercase text-emerald-400">Línea Perfecta &amp; Regla SM-2</div>
                    <p className="text-neutral-200 leading-relaxed">{handReviewResult.correctLine}</p>
                    <p className="text-cyan-300 leading-relaxed">
                      <strong>Nota clave:</strong> {handReviewResult.keyTakeaway}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
