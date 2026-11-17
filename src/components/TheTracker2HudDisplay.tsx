/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TheTracker2HudDisplay: Panel Propietario de 3 Cuadros de TheTracker2 (Allin School).
 * - Cuadro 1: Grid HUD importable / exportable en JSON con plantilla profesional.
 * - Cuadro 2: Guía instantánea en español claro al pasar el cursor (hover) sobre cualquier stat.
 * - Cuadro 3: Resumen de Ganancias Netas (Net Won, EV Adjusted, bb/100, Showdown vs Línea Roja).
 */

import React, { useRef, useState } from 'react';
import {
  DEFAULT_HUD_TEMPLATE,
  HUD_PRESETS,
  HUD_STAT_GLOSSARY,
  loadSavedHudTemplate,
  parseHudTemplateJson,
  saveHudTemplate,
  type HudStatKey,
  type HudTemplateConfig,
  type Tracker2HudStatSummary
} from '../engine/theTracker2Engine';
import { Download, Upload, RotateCcw, BookOpen, TrendingUp, Grid3X3, ArrowRight } from 'lucide-react';

interface TheTracker2HudDisplayProps {
  stats: Tracker2HudStatSummary;
  dbName: string;
  onOpenDiagnostic?: () => void;
}

export const TheTracker2HudDisplay: React.FC<TheTracker2HudDisplayProps> = ({
  stats,
  dbName,
  onOpenDiagnostic
}) => {
  const [template, setTemplate] = useState<HudTemplateConfig>(() => loadSavedHudTemplate());
  const [hoveredStat, setHoveredStat] = useState<HudStatKey>('vpip');
  const [templateStatus, setTemplateStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getStatDisplayValue = (key: HudStatKey): string => {
    const raw = stats[key];
    if (key === 'af') return raw.toFixed(2);
    return `${raw.toFixed(1)}%`;
  };

  const getStatHealthColor = (key: HudStatKey): string => {
    if (stats.hands === 0) return 'text-neutral-400 border-neutral-800';
    const val = stats[key];
    switch (key) {
      case 'vpip':
        return val >= 20 && val <= 28 ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-300 border-amber-500/30';
      case 'pfr':
        return val >= 16 && val <= 24 ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-300 border-amber-500/30';
      case 'threeBet':
        return val >= 6.5 && val <= 11.5 ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-300 border-amber-500/30';
      case 'cbet':
        return val >= 52 && val <= 70 ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-300 border-amber-500/30';
      case 'wsd':
        return val >= 50 ? 'text-emerald-400 border-emerald-500/30' : 'text-rose-400 border-rose-500/30';
      case 'af':
        return val >= 2.0 && val <= 3.8 ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-300 border-amber-500/30';
      default:
        return 'text-blue-300 border-neutral-800';
    }
  };

  const handleExportTemplate = () => {
    try {
      const json = JSON.stringify(template, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `allin-school-thetracker2-hud-${template.version || '2.0'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTemplateStatus({ kind: 'ok', msg: `Plantilla "${template.name}" exportada en JSON.` });
    } catch {
      setTemplateStatus({ kind: 'err', msg: 'No se pudo exportar la plantilla JSON.' });
    }
  };

  const handleImportTemplateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseHudTemplateJson(text);
      saveHudTemplate(parsed);
      setTemplate(parsed);
      setTemplateStatus({ kind: 'ok', msg: `HUD "${parsed.name}" importado y guardado en tu perfil.` });
    } catch (err) {
      setTemplateStatus({
        kind: 'err',
        msg: err instanceof Error ? err.message : 'Archivo JSON de HUD inválido.'
      });
    }
  };

  const handleResetTemplate = () => {
    saveHudTemplate(DEFAULT_HUD_TEMPLATE);
    setTemplate(DEFAULT_HUD_TEMPLATE);
    setTemplateStatus({ kind: 'ok', msg: 'Plantilla HUD TheTracker2 restaurada.' });
  };

  const activeGlossary = HUD_STAT_GLOSSARY[hoveredStat];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* CUADRO 1: HUD GRID IMPORTABLE / EXPORTABLE */}
      <div className="lg:col-span-5 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
              <Grid3X3 className="w-4 h-4" />
              <span>Cuadro 1 · HUD TheTracker2 ({template.name})</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Pasa el ratón o haz clic sobre cualquier métrica para ver su guía instantánea.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportTemplateFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] font-medium text-neutral-200 cursor-pointer whitespace-nowrap shrink-0"
              title="Importar plantilla JSON de HUD"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Importar</span>
            </button>
            <button
              type="button"
              onClick={handleExportTemplate}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] font-medium text-neutral-200 cursor-pointer whitespace-nowrap shrink-0"
              title="Exportar plantilla JSON de HUD"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar</span>
            </button>
            <button
              type="button"
              onClick={handleResetTemplate}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              title="Restaurar plantilla HUD por defecto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {templateStatus && (
          <div
            className={`px-3 py-2 rounded-xl border text-xs ${
              templateStatus.kind === 'ok'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
            }`}
          >
            {templateStatus.msg}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {HUD_PRESETS.map(preset => {
            const active = template.name === preset.name;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  saveHudTemplate(preset);
                  setTemplate(preset);
                  setTemplateStatus({ kind: 'ok', msg: `Preset HUD "${preset.name}" activado.` });
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {preset.name.split('(')[0].trim()}
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          {template.layoutRows.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {row.map(statKey => {
                const info = HUD_STAT_GLOSSARY[statKey];
                const isSelected = hoveredStat === statKey;
                const healthClass = getStatHealthColor(statKey);
                return (
                  <button
                    key={statKey}
                    type="button"
                    onMouseEnter={() => setHoveredStat(statKey)}
                    onFocus={() => setHoveredStat(statKey)}
                    onClick={() => setHoveredStat(statKey)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-950/50 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.4)]'
                        : `bg-black/60 hover:bg-neutral-900 ${healthClass}`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                        {info.shortCode}
                      </span>
                      {isSelected && <span className="text-[10px] font-mono text-blue-400">Activo</span>}
                    </div>
                    <div className="text-lg font-bold font-mono tabular-nums mt-1 text-white">
                      {getStatDisplayValue(statKey)}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate mt-0.5">{info.optimalRange}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* CUADRO 2: GUÍA INSTANTÁNEA */}
      <div className="lg:col-span-4 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <BookOpen className="w-4 h-4" />
              <span>Cuadro 2 · Guía Instantánea de Métrica</span>
            </div>
            <span className="text-xs font-mono font-bold text-white">{activeGlossary.shortCode}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-1.5">
            <div className="text-sm font-bold text-white">{activeGlossary.label}</div>
            <div className="text-[11px] font-mono text-blue-300">{activeGlossary.formula}</div>
            <div className="text-xs text-neutral-300 leading-relaxed pt-1">
              {activeGlossary.simpleExplanation}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <span className="text-[11px] font-semibold text-emerald-400 block">
                Rango Óptimo 6-Max: {activeGlossary.optimalRange}
              </span>
              <span className="text-neutral-300">
                Tu valor actual en {dbName}: <strong className="font-mono tabular-nums text-white">{getStatDisplayValue(hoveredStat)}</strong>
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <span className="text-[11px] font-semibold text-amber-300 block">Si está muy ALTO:</span>
              <span className="text-neutral-300">{activeGlossary.tooHighFix}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <span className="text-[11px] font-semibold text-blue-300 block">Si está muy BAJO:</span>
              <span className="text-neutral-300">{activeGlossary.tooLowFix}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CUADRO 3: RESUMEN DE GANANCIAS NETAS */}
      <div className="lg:col-span-3 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <TrendingUp className="w-4 h-4" />
            <span>Cuadro 3 · Ganancias Netas</span>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-black border border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-400">Net Won</span>
              <span
                className={`text-base font-bold font-mono tabular-nums ${
                  stats.netWonBB >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.netWonBB >= 0 ? '+' : ''}
                {stats.netWonBB.toFixed(1)} BB
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black border border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-400">EV Adjusted</span>
              <span
                className={`text-base font-bold font-mono tabular-nums ${
                  stats.evAdjustedBB >= 0 ? 'text-amber-300' : 'text-rose-400'
                }`}
              >
                {stats.evAdjustedBB >= 0 ? '+' : ''}
                {stats.evAdjustedBB.toFixed(1)} BB
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase">Winrate</div>
                <div
                  className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                    stats.bbPer100 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {stats.bbPer100 >= 0 ? '+' : ''}
                  {stats.bbPer100.toFixed(1)} bb/100
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase">EV bb/100</div>
                <div className="text-sm font-bold font-mono tabular-nums mt-0.5 text-amber-300">
                  {stats.evBbPer100 >= 0 ? '+' : ''}
                  {stats.evBbPer100.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase">Showdown</div>
                <div className="text-sm font-bold font-mono tabular-nums mt-0.5 text-blue-400">
                  {stats.showdownWonBB >= 0 ? '+' : ''}
                  {stats.showdownWonBB.toFixed(1)} BB
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase">Non-SD (Red)</div>
                <div className="text-sm font-bold font-mono tabular-nums mt-0.5 text-rose-400">
                  {stats.nonShowdownWonBB >= 0 ? '+' : ''}
                  {stats.nonShowdownWonBB.toFixed(1)} BB
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-neutral-800/80">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Muestra Filtrada</span>
            <span className="font-mono tabular-nums text-white font-semibold">{stats.hands} manos</span>
          </div>
          {onOpenDiagnostic && (
            <button
              type="button"
              onClick={onOpenDiagnostic}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Diagnosticar Nivel & Fugas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
