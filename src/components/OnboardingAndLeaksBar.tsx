/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OnboardingAndLeaksBar:
 * 1) Onboarding interactivo en 60 segundos: 1 clic para configurar la plataforma
 *    según la meta del jugador ("Aprender desde cero", "Analizar manos de sala", "Entrenar 6-Max/Solver").
 * 2) Radar de Fugas en Español Claro: "Tus 3 errores más caros de la semana" con lanzamiento de drills.
 */

import React, { useEffect, useState } from 'react';
import {
  buildWeeklyLeaksRadar,
  type OnboardingGoal,
  type WeeklyLeakRadarItem
} from '../lib/experienceMode';
import type { SimPosition, SimScenarioType } from '../engine/handSimulator';
import {
  AlertTriangle,
  ArrowRight,
  Compass,
  FileBarChart,
  GraduationCap,
  RefreshCw,
  Target,
  X
} from 'lucide-react';

interface Onboarding60sBannerProps {
  onSelectGoal: (goal: OnboardingGoal) => void;
  onDismiss: () => void;
}

export const Onboarding60sBanner: React.FC<Onboarding60sBannerProps> = ({
  onSelectGoal,
  onDismiss
}) => {
  return (
    <section
      aria-label="Configuración rápida en 60 segundos"
      className="bg-neutral-950 border border-blue-500/40 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
            Inicio Rápido en 60 Segundos · Elige tu ruta hoy
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            ¿Qué vienes a mejorar hoy en Allin School?
          </h2>
          <p className="text-xs text-neutral-400">
            Ajustaremos el vocabulario, las pestañas prioritarias y tus misiones diarias en un solo clic.
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          title="Ocultar guía rápida"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onSelectGoal('learn_zero')}
          className="p-4 rounded-xl bg-black border border-neutral-800 hover:border-emerald-500/70 text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer group"
        >
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
              Aprender desde cero
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Duelo visual de jerarquía de manos, mapa de asientos y calculadora simple de Pot Odds sin tecnicismos.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 whitespace-nowrap">
            <span>Abrir Fundamentos (Módulo 0)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectGoal('analyze_hands')}
          className="p-4 rounded-xl bg-black border border-neutral-800 hover:border-blue-500/70 text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer group"
        >
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <FileBarChart className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
              Analizar mis manos de sala
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Sube archivos .txt, .xml o .zip exportados de sala, reproduce tus botes calle a calle y detecta tus fugas reales.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 whitespace-nowrap">
            <span>Abrir TheTracker2 &amp; Replayer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectGoal('crush_stakes')}
          className="p-4 rounded-xl bg-black border border-neutral-800 hover:border-amber-500/70 text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer group"
        >
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
              Entrenar 6-Max &amp; Lab Studio
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Mesa 6-Max Preflop a River contra regulares/recreativos y motor Lab Studio DCFR multi-calle con Node-Locking porcentual.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 whitespace-nowrap">
            <span>Entrar a Mesa 6-Max</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>
    </section>
  );
};

interface WeeklyLeaksRadarCardProps {
  onLaunchDrill: (pos: SimPosition | 'RANDOM', scenario: SimScenarioType | 'RANDOM') => void;
}

export const WeeklyLeaksRadarCard: React.FC<WeeklyLeaksRadarCardProps> = ({
  onLaunchDrill
}) => {
  const [leaks, setLeaks] = useState<WeeklyLeakRadarItem[]>(() => buildWeeklyLeaksRadar());

  const refreshLeaks = () => {
    setLeaks(buildWeeklyLeaksRadar());
  };

  useEffect(() => {
    const handler = () => refreshLeaks();
    window.addEventListener('learner-state-updated', handler);
    window.addEventListener('lab-pro-sync-needed', handler);
    return () => {
      window.removeEventListener('learner-state-updated', handler);
      window.removeEventListener('lab-pro-sync-needed', handler);
    };
  }, []);

  return (
    <section className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Radar de Fugas en Español Claro</span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            Tus 3 errores más caros de la semana
          </h3>
          <p className="text-xs text-neutral-400">
            Detectados automáticamente desde tus manos jugadas, entrenamientos 6-Max e historial TheTracker2 sin tecnicismos.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshLeaks}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black hover:bg-neutral-900 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
          <span>Actualizar Radar</span>
        </button>
      </div>

      {leaks.length === 0 ? (
        <div className="p-4 rounded-xl bg-black border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-white">
              Aún no hay errores registrados esta semana en tu cuenta
            </div>
            <p className="text-neutral-400">
              Juega 3 manos en la Mesa 6-Max en Vivo o importa tus manos de sala para ver aquí exactamente dónde estás perdiendo ciegas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onLaunchDrill('RANDOM', 'RANDOM')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Jugar Mano de Diagnóstico</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {leaks.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-black border border-neutral-800 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                  <span className="text-neutral-400 font-semibold">Fuga #{idx + 1}</span>
                  <span className="text-rose-400 font-bold">{item.costLabel}</span>
                </div>
                <div className="text-sm font-bold text-white leading-snug">{item.title}</div>
                <p className="text-xs text-neutral-400 leading-relaxed">{item.plainReason}</p>
                <div className="pt-1 text-xs text-emerald-300 leading-relaxed">
                  <strong className="text-emerald-400">Qué hacer:</strong> {item.fixAction}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onLaunchDrill(item.drillPos, item.drillScenario)}
                className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-blue-600 border border-neutral-800 hover:border-blue-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Target className="w-3.5 h-3.5" />
                <span>Practicar este spot ahora</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
