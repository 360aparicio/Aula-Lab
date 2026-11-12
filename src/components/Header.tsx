/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Top Bar Contract compliant navigation header for Lab Studio V3.1 Pro.
 * Absolute Black background (#000000) and bright electric blue active tabs (#3B82F6).
 */

import React from 'react';
import { Play, Compass, Brain, BookOpen, Layers, Database, Globe } from 'lucide-react';
import { UserAuthButton } from './UserAuthButton';

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
        <button
          type="button"
          onClick={() => onTabChange('wizard')}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap hover:text-blue-400 transition-colors flex items-center gap-2 text-left cursor-pointer"
        >
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent font-black tracking-tight">
            Lab Studio
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-500/40 font-mono">
            V3.1 Pro
          </span>
        </button>
      </div>

      {/* Zone 2: Navigation links */}
      <nav className="hidden md:flex items-center gap-4 text-xs lg:text-sm font-medium overflow-x-auto">
        <button type="button" onClick={() => onTabChange('wizard')} className={getTabClass('wizard')}>
          <Compass className="w-4 h-4 text-blue-400" />
          <span>Paso a Paso</span>
        </button>

        <button type="button" onClick={() => onTabChange('solver')} className={getTabClass('solver')}>
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Árbol & Solver</span>
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
          <span>Solvers & Web</span>
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

      {/* Zone 3: Primary action + Google Auth Sync */}
      <div className="flex items-center gap-2.5 shrink-0">
        <UserAuthButton />
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
      </div>
    </header>
  );
};
