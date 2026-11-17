/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PlanCatalogManager: Configurador en vivo de Planes (Free, Pro, Elite),
 * Secciones Visibles del Aula/Lab (9 módulos), Límites y Lista de Beneficios.
 * Todo cambio guardado en /planConfigs/{tier} se refleja instantáneamente
 * en el Repositorio Educativo conectado vía Firestore onSnapshot.
 */

import React, { useState, useEffect } from 'react';
import {
  DEFAULT_PLAN_CONFIGS,
  LAB_SECTION_META,
  type LabSectionId,
  type PlanConfigDoc,
  type PlanPermissions,
  type PlanTier
} from '../lib/planCatalog';
import {
  adminSavePlanConfig,
  adminSeedDefaultPlanConfigs,
  fetchAllPlanConfigsForAdmin
} from '../lib/adminCloudSync';
import {
  Crown,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Layers
} from 'lucide-react';

interface PlanCatalogManagerProps {
  onStatus?: (msg: string) => void;
  onError?: (err: string) => void;
}

const PLAN_ORDER: PlanTier[] = ['free', 'pro', 'elite'];

const PERMISSION_META: Array<{ key: keyof PlanPermissions; label: string; desc: string }> = [
  { key: 'labPro', label: 'Laboratorio Pro', desc: 'Árbol DCFR completo, rangos 13×13 y simulador multi-calle' },
  { key: 'webBrain', label: 'Cerebro Web', desc: 'Reglas adaptativas desde internet y aprendizaje colectivo' },
  { key: 'unlimitedEval', label: 'Eval. Ilimitadas', desc: 'Exámenes ilimitados en Niveles 1–4, Temas Fijos y Spots' },
  { key: 'pdfExport', label: 'Exportar PDF', desc: 'Descarga oficial de reportes D3.js y Manual 6-Max en PDF' }
];

export const PlanCatalogManager: React.FC<PlanCatalogManagerProps> = ({ onStatus, onError }) => {
  const [configs, setConfigs] = useState<Record<PlanTier, PlanConfigDoc>>(DEFAULT_PLAN_CONFIGS);
  const [selectedTier, setSelectedTier] = useState<PlanTier>('free');
  const [loading, setLoading] = useState<boolean>(true);
  const [savingTier, setSavingTier] = useState<PlanTier | null>(null);
  const [seedingAll, setSeedingAll] = useState<boolean>(false);
  const [newBenefitText, setNewBenefitText] = useState<string>('');

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await fetchAllPlanConfigsForAdmin();
      setConfigs(data);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'No se pudo cargar el catálogo de planes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = configs[selectedTier];

  const updateCurrent = (updater: (prev: PlanConfigDoc) => PlanConfigDoc) => {
    setConfigs(prev => ({
      ...prev,
      [selectedTier]: updater(prev[selectedTier])
    }));
  };

  const handleToggleSection = (sectionId: LabSectionId) => {
    updateCurrent(prev => ({
      ...prev,
      visibleSections: {
        ...prev.visibleSections,
        [sectionId]: !prev.visibleSections[sectionId]
      }
    }));
  };

  const handleToggleDefaultPerm = (permKey: keyof PlanPermissions) => {
    updateCurrent(prev => ({
      ...prev,
      defaultPermissions: {
        ...prev.defaultPermissions,
        [permKey]: !prev.defaultPermissions[permKey]
      }
    }));
  };

  const handleAddBenefit = () => {
    const text = newBenefitText.trim();
    if (!text) return;
    if (current.benefits.length >= 15) {
      onError?.('Máximo 15 beneficios por plan.');
      return;
    }
    updateCurrent(prev => ({
      ...prev,
      benefits: [...prev.benefits, text.slice(0, 140)]
    }));
    setNewBenefitText('');
  };

  const handleRemoveBenefit = (idx: number) => {
    updateCurrent(prev => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateBenefitText = (idx: number, value: string) => {
    updateCurrent(prev => ({
      ...prev,
      benefits: prev.benefits.map((b, i) => (i === idx ? value.slice(0, 140) : b))
    }));
  };

  const handleSaveTier = async (tier: PlanTier) => {
    setSavingTier(tier);
    try {
      const saved = await adminSavePlanConfig(configs[tier]);
      setConfigs(prev => ({ ...prev, [tier]: saved }));
      onStatus?.(
        `Plan ${tier.toUpperCase()} guardado y sincronizado en vivo con todos los estudiantes del Aula Educativo.`
      );
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'No se pudo guardar el catálogo del plan.');
    } finally {
      setSavingTier(null);
    }
  };

  const handleSeedAllDefaults = async () => {
    setSeedingAll(true);
    try {
      const seeded = await adminSeedDefaultPlanConfigs();
      setConfigs(seeded);
      onStatus?.('Catálogo completo Free / Pro / Elite restaurado y publicado en Firestore.');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error restaurando catálogo por defecto.');
    } finally {
      setSeedingAll(false);
    }
  };

  const enabledSections = LAB_SECTION_META.filter(s => current.visibleSections[s.id]);
  const lockedSections = LAB_SECTION_META.filter(s => !current.visibleSections[s.id]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span>Arquitecto de Planes, Secciones del Aula y Beneficios en Vivo</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Define exactamente qué módulos del Aula/Lab puede ver y usar cada estudiante según su plan (
            <code className="text-blue-300">Free</code>, <code className="text-blue-300">Pro</code>,{' '}
            <code className="text-amber-300">Elite</code>). Los cambios se propagan en tiempo real a los usuarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => void loadCatalog()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-xl font-semibold cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Recargar</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSeedAllDefaults()}
            disabled={seedingAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-amber-500/40 text-amber-300 rounded-xl font-semibold cursor-pointer disabled:opacity-60"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{seedingAll ? 'Publicando...' : 'Publicar Valores Base'}</span>
          </button>
        </div>
      </div>

      {/* Tier Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAN_ORDER.map(tier => {
          const cfg = configs[tier];
          const isSelected = selectedTier === tier;
          const activeCount = Object.values(cfg.visibleSections).filter(Boolean).length;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier(tier)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                isSelected
                  ? 'bg-blue-950/30 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Crown
                    className={`w-4 h-4 ${
                      tier === 'elite' ? 'text-amber-400' : tier === 'pro' ? 'text-blue-400' : 'text-neutral-400'
                    }`}
                  />
                  <span className="font-bold text-white text-sm uppercase">{tier}</span>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-200">
                  {cfg.priceLabel}
                </span>
              </div>
              <div className="text-xs font-semibold text-neutral-200">{cfg.displayName}</div>
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-1">
                <span>{activeCount}/9 secciones activas</span>
                <span>{cfg.benefits.length} beneficios</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Tier Editor + Live Student Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Configuration Controls */}
        <div className="xl:col-span-8 space-y-5 bg-neutral-950 border border-neutral-800 rounded-2xl p-6 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Configuración del Plan {selectedTier.toUpperCase()}</span>
              </h3>
              <p className="text-neutral-400 text-[11px]">
                Personaliza identidad comercial, visibilidad por sección del Lab y beneficios.
              </p>
            </div>
            <button
              type="button"
              disabled={savingTier === selectedTier}
              onClick={() => void handleSaveTier(selectedTier)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{savingTier === selectedTier ? 'Guardando...' : `Guardar Plan ${selectedTier.toUpperCase()}`}</span>
            </button>
          </div>

          {/* Identity & Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold block">Nombre Comercial</label>
              <input
                type="text"
                maxLength={48}
                value={current.displayName}
                onChange={(e) => updateCurrent(prev => ({ ...prev, displayName: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold block">Etiqueta de Precio</label>
              <input
                type="text"
                maxLength={32}
                value={current.priceLabel}
                onChange={(e) => updateCurrent(prev => ({ ...prev, priceLabel: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white font-mono outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold block">Evaluaciones / Día (0 = Ilimitado)</label>
              <input
                type="number"
                min={0}
                max={1000}
                value={current.maxDailyEvaluations}
                onChange={(e) =>
                  updateCurrent(prev => ({
                    ...prev,
                    maxDailyEvaluations: Math.max(0, Math.min(1000, Number(e.target.value) || 0))
                  }))
                }
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white font-mono outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-neutral-300 font-semibold block">Descripción / Subtítulo Visible al Usuario</label>
              <input
                type="text"
                maxLength={160}
                value={current.tagline}
                onChange={(e) => updateCurrent(prev => ({ ...prev, tagline: e.target.value }))}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => updateCurrent(prev => ({ ...prev, hideLockedSections: !prev.hideLockedSections }))}
              className={`px-3 py-2 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                current.hideLockedSections
                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-blue-500/40'
              }`}
            >
              {current.hideLockedSections ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>
                {current.hideLockedSections ? 'Ocultar Pestañas Bloqueadas' : 'Mostrar con Candado 🔒'}
              </span>
            </button>
          </div>

          {/* 9 Lab Sections Toggle Grid */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                Secciones Visibles y Desbloqueadas en el Aula/Lab (9 Módulos)
              </h4>
              <span className="font-mono text-blue-300">{enabledSections.length} activas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {LAB_SECTION_META.map(sec => {
                const enabled = current.visibleSections[sec.id];
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleToggleSection(sec.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      enabled
                        ? 'bg-emerald-950/30 border-emerald-500/60 text-white hover:bg-emerald-950/50'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        {enabled ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        )}
                        <span className="truncate">{sec.label}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2">{sec.shortDesc}</p>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        enabled ? 'bg-emerald-950 text-emerald-300' : 'bg-neutral-950 text-neutral-500'
                      }`}
                    >
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default Subscription Capabilities */}
          <div className="space-y-2.5 pt-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Capacidades Técnicas por Defecto del Tier
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PERMISSION_META.map(item => {
                const active = current.defaultPermissions[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToggleDefaultPerm(item.key)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      active
                        ? 'bg-blue-950/30 border-blue-500/60 text-white'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">{item.label}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</div>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        active ? 'bg-blue-950 text-blue-300 border border-blue-700' : 'bg-neutral-950 text-neutral-500'
                      }`}
                    >
                      {active ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Benefits List Editor */}
          <div className="space-y-2.5 pt-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Lista de Beneficios Mostrada al Estudiante ({current.benefits.length}/15)
            </h4>
            <div className="space-y-2">
              {current.benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-mono text-neutral-500 w-5 text-right">{idx + 1}.</span>
                  <input
                    type="text"
                    maxLength={140}
                    value={benefit}
                    onChange={(e) => handleUpdateBenefitText(idx, e.target.value)}
                    className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-1.5 text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveBenefit(idx)}
                    className="p-2 rounded-xl bg-neutral-900 hover:bg-rose-950 border border-neutral-800 hover:border-rose-600 text-neutral-400 hover:text-rose-300 cursor-pointer"
                    title="Eliminar beneficio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                maxLength={140}
                value={newBenefitText}
                onChange={(e) => setNewBenefitText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBenefit();
                  }
                }}
                placeholder="Añadir nuevo beneficio visible para este plan..."
                className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white outline-none"
              />
              <button
                type="button"
                onClick={handleAddBenefit}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Student Experience Preview */}
        <div className="xl:col-span-4 bg-neutral-950 border border-blue-500/30 rounded-2xl p-5 space-y-4 text-xs h-fit">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-white">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Vista Previa del Estudiante ({selectedTier.toUpperCase()})</span>
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              {current.priceLabel}
            </span>
          </div>

          <div>
            <div className="text-sm font-bold text-white">{current.displayName}</div>
            <p className="text-[11px] text-neutral-400 mt-0.5">{current.tagline}</p>
          </div>

          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1.5">
            <div className="text-[10px] font-mono uppercase text-neutral-400">Menú Superior del Aula</div>
            <div className="flex flex-wrap gap-1.5">
              {LAB_SECTION_META.map(sec => {
                const ok = current.visibleSections[sec.id];
                if (!ok && current.hideLockedSections) return null;
                return (
                  <span
                    key={sec.id}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 ${
                      ok
                        ? 'bg-blue-950/60 border-blue-500/50 text-blue-200'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-500'
                    }`}
                  >
                    {!ok && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                    <span>{sec.label}</span>
                  </span>
                );
              })}
            </div>
            {lockedSections.length > 0 && (
              <p className="text-[10px] text-neutral-500 pt-1">
                {current.hideLockedSections
                  ? `${lockedSections.length} secciones ocultas completamente.`
                  : `${lockedSections.length} secciones visibles con candado para incentivar upgrade.`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase text-neutral-400">Beneficios del Plan</div>
            <ul className="space-y-1.5">
              {current.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-neutral-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded-xl flex items-center justify-between font-mono text-[11px]">
            <span className="text-neutral-400">Evaluaciones Diarias:</span>
            <strong className="text-cyan-300">
              {current.maxDailyEvaluations === 0 ? 'Ilimitadas' : `${current.maxDailyEvaluations} / día`}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
