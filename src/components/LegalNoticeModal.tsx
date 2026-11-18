/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LegalNoticeModal: Modal Legal Bilingüe (14 Cláusulas) de ALLin Studio.
 * Cumplimiento integrado: Uso Educativo / No Apuestas, Decisión Andina 351 de 1993 (PI),
 * Ley 1581 de 2012 (Habeas Data / Colombia) y Descargo de Interoperabilidad Técnica.
 */

import React, { useState } from 'react';
import { Scale, ShieldCheck, Globe, X } from 'lucide-react';

interface LegalNoticeModalProps {
  open: boolean;
  onClose: () => void;
  onOpenSupport?: () => void;
}

interface ClauseItem {
  num: string;
  title: string;
  body: string;
}

const CLAUSES_ES: ClauseItem[] = [
  { num: '01', title: 'Naturaleza Estrictamente Educativa', body: 'ALLin Studio, Allin School, Lab Studio y TheTracker2 son herramientas académicas de estudio matemático y análisis estratégico. No operan juegos con dinero real ni apuestas.' },
  { num: '02', title: 'Ausencia de Intermediación Financiera', body: 'La plataforma no recibe depósitos de juego, no custodia saldos apostables, no procesa retiros ni actúa como sala o casino.' },
  { num: '03', title: 'Propiedad Intelectual (Decisión Andina 351/1993)', body: 'El código fuente, algoritmos DCFR, evaluador de 7 cartas, simulador ICM Malmuth-Harville, banco SM-2 y diseño visual son obra original protegida bajo la Decisión 351 de 1993 de la Comunidad Andina.' },
  { num: '04', title: 'Identidad Propia Sin Afiliación', body: 'Allin School, Lab Studio, TheTracker2 y Allin Studio Admin son marcas e implementaciones independientes sin respaldo, patrocinio ni vínculo con terceros operadores.' },
  { num: '05', title: 'Interoperabilidad Técnica de Archivos', body: 'La lectura de formatos .txt, .zip, .xml o .json en TheTracker2 ocurre estrictamente como interoperabilidad técnica para analizar archivos propios del estudiante fuera de línea.' },
  { num: '06', title: 'Uso Responsable Fuera de Mesas (No RTA)', body: 'El estudiante se compromete a utilizar Lab Studio exclusivamente como estudio post-sesión y nunca como asistencia automatizada en tiempo real durante partidas.' },
  { num: '07', title: 'Protección de Datos (Ley 1581 de 2012)', body: 'El tratamiento de nombre, correo electrónico, UID y métricas académicas se rige por la Ley Estatutaria 1581 de 2012 (Colombia) y su decreto reglamentario.' },
  { num: '08', title: 'Finalidad Legítima del Tratamiento', body: 'Los datos se emplean únicamente para autenticar acceso, aislar bases de datos por UID, sincronizar progreso SM-2 y habilitar beneficios según plan activo.' },
  { num: '09', title: 'Aislamiento y Confidencialidad por UID', body: 'Cada historial importado, nota táctica y reporte de fugas está aislado por identificador único de usuario (UID) con control de acceso Fail-Closed.' },
  { num: '10', title: 'Derechos ARCO / Habeas Data', body: 'Puedes conocer, actualizar, rectificar o solicitar la supresión de tu información personal mediante un ticket en el Centro de Soporte / Habeas Data.' },
  { num: '11', title: 'No Cesión Comercial de Datos', body: 'ALLin Studio no vende, alquila ni comercializa tus datos personales ni historiales de estudio con terceros anunciantes.' },
  { num: '12', title: 'Naturaleza Probabilística de Cálculos', body: 'Las simulaciones Monte Carlo, DCFR e ICM representan modelos matemáticos bajo supuestos configurables y no constituyen garantía de ganancia financiera.' },
  { num: '13', title: 'Disponibilidad y Mantenimiento SaaS', body: 'Las funciones disponibles por nivel (Free, Pro, Elite) dependen de la configuración vigente gestionada de forma transparente en el catálogo de planes.' },
  { num: '14', title: 'Jurisdicción y Vigencia', body: 'Este marco legal aplica de forma permanente sobre Allin School y Allin Studio Admin, sujeto a la normativa aplicable de la República de Colombia.' }
];

const CLAUSES_EN: ClauseItem[] = [
  { num: '01', title: 'Strictly Educational Purpose', body: 'ALLin Studio, Allin School, Lab Studio, and TheTracker2 are academic tools for mathematical game-theory study. No real-money gambling or wagering is offered.' },
  { num: '02', title: 'No Wagering or Custody of Funds', body: 'The platform does not accept betting deposits, hold player bankrolls, process wagers, or act as a gambling operator or casino.' },
  { num: '03', title: 'Intellectual Property (Andean Decision 351/1993)', body: 'All source code, DCFR solvers, 7-card evaluator, recursive Malmuth-Harville ICM engine, SM-2 academy, and UI architecture are original works protected under Andean Decision 351 of 1993.' },
  { num: '04', title: 'Independent Brand & Zero Affiliation', body: 'Allin School, Lab Studio, TheTracker2, and Allin Studio Admin are proprietary software modules with no affiliation, endorsement, or partnership with external operators.' },
  { num: '05', title: 'Technical File Interoperability Disclaimer', body: 'Support for .txt, .zip, .xml, or .json files in TheTracker2 is provided solely for technical interoperability so students can review their own exported study records offline.' },
  { num: '06', title: 'Off-Table Study Only (No RTA Policy)', body: 'Users agree to utilize Lab Studio strictly for off-table study and post-session review, never as real-time assistance during active play.' },
  { num: '07', title: 'Personal Data Protection (Law 1581 of 2012)', body: 'Processing of email, display name, UID, and study telemetry complies with Colombian Statutory Law 1581 of 2012 (Habeas Data).' },
  { num: '08', title: 'Limited Purpose of Processing', body: 'Personal data is processed solely to authenticate access, isolate private study databases by UID, sync SM-2 progress, and enforce subscription entitlements.' },
  { num: '09', title: 'Per-UID Storage Isolation & Security', body: 'Hand databases, training metrics, and diagnostic reports are strictly scoped per UID under fail-closed server and security-rule controls.' },
  { num: '10', title: 'Data Subject Rights (Access & Erasure)', body: 'You may request access, correction, or deletion of your personal data at any time through the Support & Habeas Data ticket channel.' },
  { num: '11', title: 'No Third-Party Data Monetization', body: 'ALLin Studio never sells, rents, or trades user study histories or personal profiles to third-party brokers.' },
  { num: '12', title: 'Mathematical Modeling Disclaimer', body: 'Monte Carlo equity, DCFR equilibrium, and ICM outputs are mathematical models subject to user-defined inputs and do not guarantee financial outcomes.' },
  { num: '13', title: 'Tier Entitlements & Plan Catalog', body: 'Feature access across Free, Pro, and Elite tiers reflects the active SaaS configuration documented transparently inside the plan benefits view.' },
  { num: '14', title: 'Governing Law & Acceptance', body: 'This 14-clause notice governs Allin School and Allin Studio Admin under applicable laws of the Republic of Colombia.' }
];

export const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({
  open,
  onClose,
  onOpenSupport
}) => {
  const [lang, setLang] = useState<'es' | 'en'>('es');

  if (!open) return null;
  const clauses = lang === 'es' ? CLAUSES_ES : CLAUSES_EN;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Aviso Legal, Propiedad Intelectual y Habeas Data"
    >
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                {lang === 'es'
                  ? 'Marco Legal, Propiedad Intelectual y Habeas Data (14 Cláusulas)'
                  : 'Legal Framework, IP & Data Privacy Notice (14 Clauses)'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                Decisión Andina 351 de 1993 · Ley 1581 de 2012 (Colombia) · Software Educativo (No Apuestas)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-black border border-neutral-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setLang('es')}
                className={`px-2.5 py-1 rounded-md cursor-pointer ${
                  lang === 'es' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-md cursor-pointer ${
                  lang === 'en' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal legal"
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {clauses.map(item => (
            <div key={item.num} className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-1">
              <div className="font-bold text-white flex items-center gap-2">
                <span className="font-mono text-blue-400">{item.num}.</span>
                <span>{item.title}</span>
              </div>
              <p className="text-neutral-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-neutral-800 bg-black/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {lang === 'es'
                ? 'Uso estrictamente educativo y de estudio matemático fuera de las mesas.'
                : 'Strictly for off-table mathematical and analytical poker study.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenSupport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupport();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-blue-300 font-semibold cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{lang === 'es' ? 'Solicitud Habeas Data / Soporte' : 'Habeas Data / Support Request'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
            >
              {lang === 'es' ? 'Entendido' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
