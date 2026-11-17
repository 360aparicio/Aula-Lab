/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PlanBenefitsModal: Transparencia total para el alumno en el Aula/Lab Educativo.
 * Muestra en vivo las secciones habilitadas/bloqueadas, permisos y beneficios de su plan
 * configurados desde el Repositorio Administrativo Independiente.
 */

import React from 'react';
import {
  CheckCircle2,
  Lock,
  Crown,
  Sparkles,
  X,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LAB_SECTION_META, type PlanTier } from '../lib/planCatalog';

interface PlanBenefitsModalProps {
  open: boolean;
  onClose: () => void;
}

const TIER_ORDER: PlanTier[] = ['free', 'pro', 'elite'];

export const PlanBenefitsModal: React.FC<PlanBenefitsModalProps> = ({ open, onClose }) => {
  const { planTier, planPermissions, activePlanConfig, allPlanConfigs, isAdmin } = useAuth();

  if (!open) return null;

  const badgeTone =
    planTier === 'elite'
      ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
      : planTier === 'pro'
      ? 'bg-blue-950/70 text-blue-300 border-blue-500/40'
      : 'bg-neutral-900 text-neutral-300 border-neutral-700';

  const permissionItems: Array<{ label: string; enabled: boolean }> = [
    { label: 'Laboratorio Pro & Práctica Multi-Calle', enabled: planPermissions.labPro },
    { label: 'Cerebro Web & Meta en Tiempo Real', enabled: planPermissions.webBrain },
    { label: 'Evaluaciones Ilimitadas (Niveles 1–4)', enabled: planPermissions.unlimitedEval },
    { label: 'Exportación Oficial PDF (Progreso & Manual)', enabled: planPermissions.pdfExport }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-4xl w-full bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {activePlanConfig.displayName}
                </h2>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${badgeTone}`}>
                  Tu Plan Actual · {activePlanConfig.priceLabel}
                </span>
                {isAdmin && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Acceso Total Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">{activePlanConfig.tagline}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer shrink-0"
            aria-label="Cerrar detalles del plan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs">
          {/* Active Plan Highlights: Benefits + Permissions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Beneficios de tu Plan</span>
                </h3>
                <span className="text-[11px] font-mono text-cyan-300">
                  {activePlanConfig.maxDailyEvaluations === 0
                    ? 'Eval. Ilimitadas'
                    : `${activePlanConfig.maxDailyEvaluations} eval/día`}
                </span>
              </div>
              <ul className="space-y-2">
                {activePlanConfig.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-neutral-200 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Permisos Técnicos Asignados a tu Cuenta
              </h3>
              <div className="space-y-2">
                {permissionItems.map(item => (
                  <div
                    key={item.label}
                    className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 ${
                      item.enabled || isAdmin
                        ? 'bg-emerald-950/25 border-emerald-700/50 text-emerald-200'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-500'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="font-mono font-bold text-[10px]">
                      {item.enabled || isAdmin ? 'ACTIVO' : 'BLOQUEADO'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section Access Matrix for User's Current Plan */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Secciones del Aula Educativo en tu Plan</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {LAB_SECTION_META.map(sec => {
                const unlocked = isAdmin || activePlanConfig.visibleSections[sec.id];
                return (
                  <div
                    key={sec.id}
                    className={`p-3 rounded-xl border space-y-1 ${
                      unlocked
                        ? 'bg-blue-950/20 border-blue-500/40 text-white'
                        : 'bg-neutral-950 border-neutral-800/90 text-neutral-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{sec.label}</span>
                      {unlocked ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] leading-snug text-neutral-400">{sec.shortDesc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Plan Comparison from Admin Catalog */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Comparativa de Planes Disponibles (Configurados por Administración)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TIER_ORDER.map(tier => {
                const cfg = allPlanConfigs[tier];
                const isCurrent = tier === planTier;
                const enabledCount = LAB_SECTION_META.filter(s => cfg.visibleSections[s.id]).length;
                return (
                  <div
                    key={tier}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                      isCurrent
                        ? 'bg-blue-950/25 border-blue-500/70'
                        : 'bg-neutral-900/50 border-neutral-800'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{cfg.displayName}</span>
                        {isCurrent && (
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">
                            Actual
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-mono font-bold text-blue-400">{cfg.priceLabel}</div>
                      <p className="text-[11px] text-neutral-400">{cfg.tagline}</p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-neutral-800/80">
                      <div className="text-[11px] font-mono text-cyan-300">
                        {enabledCount} / {LAB_SECTION_META.length} secciones del Lab
                      </div>
                      <ul className="space-y-1 text-[11px] text-neutral-300">
                        {cfg.benefits.slice(0, 3).map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

          {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/40 flex items-center justify-between gap-3 text-[11px] text-neutral-400">
          <span>
            Los planes, secciones y beneficios se sincronizan en vivo desde Allin Studio Admin.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
