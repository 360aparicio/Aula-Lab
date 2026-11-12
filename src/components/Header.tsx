/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Top Bar Contract compliant navigation header for Lab Studio V3.3 Pro.
 * Enforces strict separation: User View NEVER displays Admin buttons or toggles.
 * Admin View provides a direct "Volver a la Entrada Principal" action.
 */

import React from 'react';
import {
  Play,
  Compass,
  Brain,
  BookOpen,
  Layers,
  Database,
  Globe,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import { UserAuthButton } from './UserAuthButton';
import { useAuth } from '../context/AuthContext';

export type NavTab =
  | 'wizard'
  | 'solver'
  | 'trainer'
  | 'cheatsheet'
  | 'academy'
  | 'solver_meta'
  | 'ranges'
  | 'scenarios'
  | 'benchmarks';

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onQuickSolve: () => void;
  isSolving: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onQuickSolve,
  isSolving
}) => {
  const { isAdmin, screenMode, switchScreenMode, returnToMainEntry } = useAuth();
  const inAdminConsole = screenMode === 'admin' && isAdmin;

  const getTabClass = (tab: NavTab) => {
    const isActive = activeTab === tab;
    return `hover:text-white transition-all whitespace-nowrap shrink-0 py-1 border-b-2 flex items-center gap-1.5 cursor-pointer ${
      isActive
        ? 'text-white border-blue-500 font-bold shadow-[0_3px_12px_rgba(59,130,246,0.45)]'
        : 'border-transparent text-neutral-400 hover:text-neutral-200'
    }`;
  };

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-3.5 bg-black border-b border-neutral-800/80 shrink-0 print:hidden">
      {/* Zone 1: Brand wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        {inAdminConsole ? (
          <div className="text-lg font-bold tracking-tight text-white whitespace-nowrap flex items-center gap-2">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent font-black tracking-tight">
              Lab Studio
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/40 font-mono">
              V3.4 Admin
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onTabChange('wizard')}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap hover:text-blue-400 transition-colors flex items-center gap-2 text-left cursor-pointer"
          >
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent font-black tracking-tight">
              Lab Studio
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/40 font-mono">
              V3.4 Pro
            </span>
          </button>
        )}
      </div>

      {/* Zone 2: Navigation links (User Screen vs Admin Screen Banner) */}
      {inAdminConsole ? (
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-blue-300 bg-blue-950/30 border border-blue-500/30 px-3.5 py-1.5 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Consola de Administración · Usuarios, Planes, Niveles, Analítica y Auditoría</span>
        </div>
      ) : (
        <nav className="hidden md:flex items-center gap-4 text-xs lg:text-sm font-medium overflow-x-auto">
          <button type="button" onClick={() => onTabChange('wizard')} className={getTabClass('wizard')}>
            <Compass className="w-4 h-4 text-blue-400" />
            <span>Paso a Paso</span>
          </button>

          <button type="button" onClick={() => onTabChange('solver')} className={getTabClass('solver')}>
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Árbol &amp; Lab</span>
          </button>

          <button type="button" onClick={() => onTabChange('trainer')} className={getTabClass('trainer')}>
            <span>Práctica</span>
          </button>

          <button type="button" onClick={() => onTabChange('cheatsheet')} className={getTabClass('cheatsheet')}>
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Manual 6-Max</span>
          </button>

          <button type="button" onClick={() => onTabChange('academy')} className={getTabClass('academy')}>
            <Brain className="w-4 h-4 text-blue-400" />
            <span>Academia D3</span>
          </button>

          <button type="button" onClick={() => onTabChange('solver_meta')} className={getTabClass('solver_meta')}>
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Meta &amp; Web</span>
          </button>

          <button type="button" onClick={() => onTabChange('ranges')} className={getTabClass('ranges')}>
            <span>Rangos</span>
          </button>

          <button type="button" onClick={() => onTabChange('scenarios')} className={getTabClass('scenarios')}>
            <Database className="w-4 h-4 text-amber-400" />
            <span>Spots</span>
          </button>

          <button type="button" onClick={() => onTabChange('benchmarks')} className={getTabClass('benchmarks')}>
            <span>Mates</span>
          </button>
        </nav>
      )}

      {/* Zone 3: Admin/User Switcher (Admins only) + Auth + Action CTA */}
      <div className="flex items-center gap-2 shrink-0">
        {isAdmin && (
          <div
            className="flex items-center p-0.5 rounded-xl bg-neutral-950 border border-neutral-800 shrink-0"
            role="tablist"
            aria-label="Cambiar entre Plataforma de Uso y Administración"
          >
            <button
              type="button"
              role="tab"
              aria-selected={screenMode === 'user'}
              onClick={() => switchScreenMode('user')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                screenMode === 'user'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Cambiar a la plataforma de estudio y práctica"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Uso</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={screenMode === 'admin'}
              onClick={() => switchScreenMode('admin')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                screenMode === 'admin'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Cambiar a la consola de administración y usuarios"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>
        )}

        <UserAuthButton />

        {inAdminConsole ? (
          <button
            type="button"
            onClick={() => void returnToMainEntry()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-800 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Salir a Entrada</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onQuickSolve}
            disabled={isSolving}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 shadow-lg cursor-pointer ${
              isSolving
                ? 'bg-neutral-800 text-neutral-400 border border-neutral-700 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 hover:scale-[1.02]'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isSolving ? 'Calculando...' : 'Calcular GTO'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
