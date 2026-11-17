/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Mathematical Benchmark Runner & Technical Documentation Viewer.
 */

import React, { useState } from 'react';
import { runEvaluatorTests } from '../../tests/evaluator.test';
import { runRangeTests } from '../../tests/range.test';
import { runGameTreeTests } from '../../tests/gameTree.test';
import { runKuhnTests } from '../../tests/kuhn.test';
import { runDCFRTests } from '../../tests/dcfr.test';
import { runPersonalizationTests } from '../../tests/personalization.test';
import { runV39ProTests } from '../../tests/v39pro.test';
import { runGtoAuditTests } from '../../tests/gto_audit.test';
import { Play, FileText, Code2, ShieldAlert, Cpu } from 'lucide-react';

export const BenchmarkAndDocs: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'tests' | 'algorithms' | 'architecture' | 'windows' | 'status'>('tests');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    try {
      const t1 = runEvaluatorTests();
      const t2 = runRangeTests();
      const t3 = runGameTreeTests();
      const t4 = runKuhnTests();
      const t5 = runDCFRTests();
      const t6 = runPersonalizationTests();
      const t7 = await runV39ProTests();
      const t8 = runGtoAuditTests();

      const totalPassed =
        t1.passed + t2.passed + t3.passed + t4.passed + t5.passed + t6.passed + t7.passed + t8.passed;
      const totalFailed =
        t1.failed + t2.failed + t3.failed + t4.failed + t5.failed + t6.failed + t7.failed + t8.failed;

      const report = `
========================================================================
      ALLIN SCHOOL · LAB STUDIO — AUDITORÍA MATEMÁTICA EN TIEMPO REAL
========================================================================
[1] Evaluador Exacto 7 Cartas y Desempates:  ${t1.passed} ok, ${t1.failed} fallos
[2] Matriz 13x13 y Motor de Bloqueadores:   ${t2.passed} ok, ${t2.failed} fallos
[3] Árbol Multi-Calle & Acciones Legales:   ${t3.passed} ok, ${t3.failed} fallos
[4] Referencia Analítica Kuhn Poker Nash:    ${t4.passed} ok, ${t4.failed} fallos
[5] Motor DCFR Subjuego (Runouts + EV):     ${t5.passed} ok, ${t5.failed} fallos
[6] Aislamiento por UID y Pools Sin Rep.:   ${t6.passed} ok, ${t6.failed} fallos
[7] Simulador 6-Max, TheTracker2 y Nivel:   ${t7.passed} ok, ${t7.failed} fallos
[8] Auditoría Matemática Lab Studio Pro:    ${t8.passed} ok, ${t8.failed} fallos
------------------------------------------------------------------------
RESUMEN TOTAL: ${totalPassed} PRUEBAS PASADAS / ${totalFailed} FALLOS
ESTADO: ${totalFailed === 0 ? 'INVARIANTES MATEMÁTICOS Y CONVERGENCIA VERIFICADOS' : 'ATENCIÓN: REVISAR FALLOS DETECTADOS'}
========================================================================`;
      setTestOutput(report);
    } catch (err: any) {
      setTestOutput(`Error ejecutando la batería matemática: ${err.message || String(err)}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col gap-6">
      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveSubTab('tests')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'tests'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Pruebas Matemáticas en Vivo</span>
        </button>

        <button
          onClick={() => setActiveSubTab('algorithms')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'algorithms'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Algoritmo DCFR</span>
        </button>

        <button
          onClick={() => setActiveSubTab('architecture')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'architecture'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Arquitectura</span>
        </button>

        <button
          onClick={() => setActiveSubTab('windows')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'windows'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Empaquetado Windows</span>
        </button>

        <button
          onClick={() => setActiveSubTab('status')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'status'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Estado del Motor Lab Studio</span>
        </button>
      </div>

      {/* Tab 1: Live Math Benchmarks */}
      {activeSubTab === 'tests' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Invariantes Matemáticos y Batería Completa</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Ejecuta todas las suites automatizadas del motor en el navegador, verificando utilidad suma-cero, convergencia DCFR, TheTracker2 y simulador 6-Max.
              </p>
            </div>
            <button
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunningTests ? 'Ejecutando Pruebas...' : 'Ejecutar Todas las Pruebas (8 Suites)'}</span>
            </button>
          </div>

          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 font-mono text-xs text-neutral-300 overflow-x-auto whitespace-pre">
            {testOutput || 'Haz clic en "Ejecutar Todas las Pruebas (8 Suites)" para auditar el motor en vivo.'}
          </div>
        </div>
      )}

      {/* Tab 2: DCFR Algorithms */}
      {activeSubTab === 'algorithms' && (
        <div className="space-y-4 text-xs text-neutral-300 leading-relaxed max-w-3xl">
          <h3 className="text-base font-bold text-white">Discounted Counterfactual Regret Minimization (DCFR)</h3>
          <p>
            Lab Studio implementa la formulación de Discounted CFR establecida por Noam Brown y Tuomas Sandholm (2019):
          </p>

          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 font-mono space-y-2">
            <div><strong>Parámetros de Descuento:</strong></div>
            <div>· α = 1.5 (Descuenta regrets positivos: R₊(I, a) *= t^α / (t^α + 1))</div>
            <div>· β = 0.0 (Descuenta regrets negativos: R₋(I, a) *= t^β / (t^β + 1) = 0.5)</div>
            <div>· γ = 2.0 (Descuenta estrategia acumulada: S(I, a) *= (t / (t + 1))^γ)</div>
          </div>

          <h4 className="text-sm font-semibold text-white pt-2">Regret Matching+ &amp; Derivación de Estrategia</h4>
          <p>
            En cada iteración t, para el conjunto de información I y acción legal a:
          </p>
          <pre className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px] font-mono">
{`σ(I, a) = max(0, R(I, a)) / ∑ max(0, R(I, b))`}
          </pre>
          <p>
            Cuando el regret positivo acumulado es cero, se asigna distribución uniforme 1/|A| para garantizar exploración.
            La estrategia acumulada se pondera por la probabilidad de alcance π_i(h) del jugador activo y soporta Node-Locking porcentual mixto.
          </p>
        </div>
      )}

      {/* Tab 3: Architecture */}
      {activeSubTab === 'architecture' && (
        <div className="space-y-4 text-xs text-neutral-300 leading-relaxed max-w-3xl">
          <h3 className="text-base font-bold text-white">Arquitectura del Sistema</h3>
          <p>
            Allin School (motor Lab Studio + TheTracker2) está estructurado en tres capas desacopladas:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="font-bold text-emerald-400 mb-1">Capa A: UI & Explorador</div>
              <p className="text-neutral-400 text-[11px]">
                React 19, Tailwind CSS v4, Matriz 13x13, Gráficos D3 de EV, Árbol de Decisiones y Entrenador Interactivo.
              </p>
            </div>
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="font-bold text-cyan-400 mb-1">Capa B: Motor Matemático</div>
              <p className="text-neutral-400 text-[11px]">
                Evaluador exacto de 7 cartas, generador de 1326 combos con bloqueadores, matching de arrepentimiento DCFR y ejecutor asíncrono.
              </p>
            </div>
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="font-bold text-amber-400 mb-1">Capa C: Persistencia</div>
              <p className="text-neutral-400 text-[11px]">
                Almacenamiento local, importación/exportación JSON, esquemas de escenarios e historial de decisiones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Windows Packaging */}
      {activeSubTab === 'windows' && (
        <div className="space-y-4 text-xs text-neutral-300 leading-relaxed max-w-3xl">
          <h3 className="text-base font-bold text-white">Empaquetado de Escritorio Windows</h3>
          <p>
            Esta aplicación está diseñada para ejecución web/SaaS y offline. Para empaquetarla como ejecutable nativo en Windows (.exe / instalador):
          </p>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 font-mono space-y-2 text-[11px]">
            <div className="text-neutral-500"># Opción 1: Tauri (Backend Rust + Frontend Web)</div>
            <div>npm install -D @tauri-apps/cli</div>
            <div>npx tauri init</div>
            <div>npx tauri build --target x86_64-pc-windows-msvc</div>
            <div className="pt-2 text-neutral-500"># Opción 2: Electron Builder</div>
            <div>npx electron-builder --win --x64</div>
          </div>
          <p className="text-neutral-400 text-[11px]">
            Los scripts de compilación y flujos CI están documentados en <code className="text-white">docs/INSTALLATION_WINDOWS.md</code>.
          </p>
        </div>
      )}

      {/* Tab 5: Build Status & Honesty */}
      {activeSubTab === 'status' && (
        <div className="space-y-4 text-xs text-neutral-300 leading-relaxed max-w-3xl">
          <h3 className="text-base font-bold text-white">Estado de Construcción y Verificación · Allin School</h3>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
            <div className="text-emerald-400 font-bold">Totalmente Implementado y Matemáticamente Verificado:</div>
            <ul className="list-disc list-inside space-y-1 text-neutral-300 text-[11px]">
              <li>Evaluador exacto de 7 cartas para Texas Hold&apos;em con desempates completos</li>
              <li>Matriz 13×13, 1326 combinaciones y filtro automático de bloqueadores</li>
              <li>Constructor de árbol multi-calle (Flop → Turn → River) con Check, Bet, Call, Fold, Raise y All-in</li>
              <li>Gráficos interactivos D3.js de distribución de EV y rentabilidad por línea</li>
              <li>Motor DCFR Lab Studio (α=1.5, β=0.0, γ=2.0) con cálculo real de p1EV/p2EV y Node-Locking mixto por porcentaje</li>
              <li>Entrenador 6-Max en Vivo, Parser TheTracker2 multi-sala, Replayer calle por calle y Academia SM-2</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
