/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Header: Barra de navegación unificada de Allin School.
 * - Identidad visual limpia: Allin School (sin badges ni píldoras decorativas).
 * - Pestañas: Fundamentos, Paso a Paso, Mesa 6-Max, Lab Studio, TheTracker2, Academia D3 y Herramientas.
 * - Cambiador Usuario | Admin visible exclusivamente para administradores verificados.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Compass,
  Brain,
  BookOpen,
  Layers,
  Database,
  Globe,
  ShieldCheck,
  Lock,
  Crown,
  ExternalLink,
  RefreshCw,
  BarChart3,
  ChevronDown,
  GraduationCap,
  Wrench,
  Settings
} from 'lucide-react';
import { UserAuthButton } from './UserAuthButton';
import { useAuth } from '../context/AuthContext';
import { getAdminConsoleUrl, type LabSectionId } from '../lib/planCatalog';
import type { ExperienceLevel } from '../lib/experienceMode';

export type NavTab = LabSectionId | 'tracker2' | 'fundamentals';

interface HeaderProps {
  activeTab: NavTab;
  experienceLevel?: ExperienceLevel;
  onTabChange: (tab: NavTab) => void;
  onQuickSolve: () => void;
  onOpenPlanBenefits: () => void;
  onOpenSupport?: () => void;
  onOpenSettings?: () => void;
  isSolving: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  experienceLevel = 'regular',
  onTabChange,
  onQuickSolve,
  onOpenPlanBenefits,
  onOpenSupport,
  onOpenSettings,
  isSolving
}) => {
  const { isAdmin, verifyAdminSession, planTier, activePlanConfig, canAccessSection } = useAuth();
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const resolveAdminTargetUrl = (): string => {
    const envObj = (import.meta as { env?: Record<string, string | undefined> }).env;
    const configuredUrl = envObj?.VITE_ADMIN_APP_URL;
    const rawTarget =
      typeof configuredUrl === 'string' && configuredUrl.trim().length > 0
        ? configuredUrl.trim()
        : getAdminConsoleUrl();

    if (typeof window !== 'undefined' && !/^https?:\/\//i.test(rawTarget)) {
      try {
        return new URL(rawTarget, window.location.origin).toString();
      } catch {
        return rawTarget;
      }
    }
    return rawTarget;
  };

  const adminUrl = resolveAdminTargetUrl();

  const handleToggleView = async () => {
    if (isVerifyingAdmin) return;
    setToggleError(null);

    if (!isAdmin) {
      setToggleError('Solo tu perfil Administrador autorizado puede acceder a Allin Studio Admin.');
      return;
    }

    setIsVerifyingAdmin(true);
    try {
      const verified = await verifyAdminSession();
      if (!verified) {
        setToggleError('Tu sesión no cuenta con rol Admin verificado en Firebase.');
        return;
      }
      const targetUrl = resolveAdminTargetUrl();
      window.location.assign(targetUrl);
    } finally {
      setIsVerifyingAdmin(false);
    }
  };

  const getTabClass = (tab: NavTab, locked: boolean) => {
    const isActive = activeTab === tab;
    return `hover:text-white transition-colors whitespace-nowrap shrink-0 py-1.5 border-b-2 flex items-center gap-1.5 cursor-pointer ${
      isActive
        ? 'text-white border-blue-500 font-semibold'
        : locked
        ? 'border-transparent text-neutral-600 hover:text-neutral-400'
        : 'border-transparent text-neutral-400 hover:text-neutral-200'
    }`;
  };

  const isNavUnlocked = (id: NavTab): boolean => {
    if (id === 'tracker2') {
      return canAccessSection('trainer') || canAccessSection('solver');
    }
    if (id === 'fundamentals') {
      return canAccessSection('wizard') || canAccessSection('academy');
    }
    return canAccessSection(id);
  };

  const primaryItems: Array<{ id: NavTab; label: string; icon?: React.ReactNode }> = [
    ...(experienceLevel === 'beginner' || experienceLevel === 'recreational'
      ? [{ id: 'fundamentals' as const, label: 'Fundamentos', icon: <GraduationCap className="w-4 h-4 text-emerald-400" /> }]
      : []),
    { id: 'wizard', label: 'Paso a Paso', icon: <Compass className="w-4 h-4 text-blue-400" /> },
    { id: 'trainer', label: 'Mesa 6-Max' },
    { id: 'solver', label: 'Lab Studio', icon: <Layers className="w-4 h-4 text-blue-400" /> },
    { id: 'tracker2', label: 'TheTracker2', icon: <BarChart3 className="w-4 h-4 text-emerald-400" /> },
    { id: 'academy', label: 'Academia D3', icon: <Brain className="w-4 h-4 text-blue-400" /> }
  ];

  const secondaryItems: Array<{ id: NavTab; label: string; icon?: React.ReactNode }> = [
    ...(experienceLevel === 'regular' || experienceLevel === 'pro'
      ? [{ id: 'fundamentals' as const, label: 'Fundamentos (Mód. 0)', icon: <GraduationCap className="w-4 h-4 text-emerald-400" /> }]
      : []),
    { id: 'cheatsheet', label: 'Manual 6-Max', icon: <BookOpen className="w-4 h-4 text-cyan-400" /> },
    { id: 'solver_meta', label: 'Radar Web', icon: <Globe className="w-4 h-4 text-cyan-400" /> },
    { id: 'ranges', label: 'Rangos 13×13' },
    { id: 'scenarios', label: 'Spots Guardados', icon: <Database className="w-4 h-4 text-amber-400" /> },
    { id: 'benchmarks', label: 'Motor & Mates' }
  ];

  const visiblePrimary = primaryItems.filter(item => isNavUnlocked(item.id) || !activePlanConfig.hideLockedSections);
  const visibleSecondary = secondaryItems.filter(item => isNavUnlocked(item.id) || !activePlanConfig.hideLockedSections);
  const allMobileItems = [...visiblePrimary, ...visibleSecondary];
  const isSecondaryActive = visibleSecondary.some(s => s.id === activeTab);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-5 py-3 bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800/80 shrink-0 print:hidden">
      {/* Zone 1: Clean single-element Brand Wordmark */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={() => onTabChange(experienceLevel === 'beginner' ? 'fundamentals' : 'wizard')}
          className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity text-left cursor-pointer"
        >
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
            Allin School
          </span>
        </button>
      </div>

      {/* Zone 2: Clean Grouped Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-4 text-xs lg:text-sm font-medium">
        {visiblePrimary.map(item => {
          const locked = !isNavUnlocked(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              title={locked ? `Bloqueado en ${activePlanConfig.displayName}` : item.label}
              className={getTabClass(item.id, locked)}
            >
              {locked ? <Lock className="w-3.5 h-3.5 text-neutral-600" /> : item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}

        {visibleSecondary.length > 0 && (
          <div ref={toolsRef} className="relative">
            <button
              type="button"
              onClick={() => setToolsOpen(prev => !prev)}
              className={`hover:text-white transition-all whitespace-nowrap shrink-0 py-1 border-b-2 flex items-center gap-1 cursor-pointer ${
                isSecondaryActive
                  ? 'text-white border-blue-500 font-bold'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>Herramientas</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>

            {toolsOpen && (
              <div className="absolute left-0 top-full mt-2 w-56 rounded-xl bg-neutral-900 border border-neutral-800 shadow-lg p-1.5 z-50 space-y-0.5">
                {visibleSecondary.map(item => {
                  const locked = !isNavUnlocked(item.id);
                  const isAct = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onTabChange(item.id);
                        setToolsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                        isAct
                          ? 'bg-blue-600/20 text-white font-semibold border border-blue-500/30'
                          : locked
                          ? 'text-neutral-600 hover:bg-neutral-800/60'
                          : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {locked ? <Lock className="w-3.5 h-3.5 text-neutral-600" /> : item.icon}
                        <span>{item.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Zone 3: Plan Benefits Button + Optional Admin Repo Switcher + Auth + Action CTA */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenPlanBenefits}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/50 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          title="Ver secciones incluidas y beneficios de tu plan"
        >
          <Crown className={`w-3.5 h-3.5 ${planTier === 'elite' ? 'text-amber-400' : planTier === 'pro' ? 'text-blue-400' : 'text-neutral-400'}`} />
          <span className="font-mono uppercase text-[11px]">{planTier}</span>
        </button>

        {isAdmin && (
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl bg-neutral-900 border border-neutral-800 shrink-0"
            title="Pestaña exclusiva de tu perfil administrador"
          >
            <span className="px-2 sm:px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold whitespace-nowrap">
              Usuario
            </span>
            <button
              type="button"
              onClick={() => void handleToggleView()}
              disabled={isVerifyingAdmin}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-amber-300 hover:text-white hover:bg-amber-950/60 text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-60"
            >
              {isVerifyingAdmin ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <ShieldCheck className="w-3 h-3" />
              )}
              <span>{isVerifyingAdmin ? 'Verificando...' : 'Admin'}</span>
            </button>
            <a
              href={adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir Allin Studio Admin en pestaña nueva"
              aria-label="Abrir Allin Studio Admin en pestaña nueva"
              className="p-1 rounded-lg text-amber-300/80 hover:text-white hover:bg-amber-950/60 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/50 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Ajustes de usuario y estilo de baraja"
            aria-label="Ajustes de usuario y baraja"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xl:inline">Baraja</span>
          </button>
        )}

        <UserAuthButton
          onOpenPlanBenefits={onOpenPlanBenefits}
          onOpenSupport={onOpenSupport}
          onOpenSettings={onOpenSettings}
        />

        <button
          type="button"
          onClick={onQuickSolve}
          disabled={isSolving}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isSolving
              ? 'bg-neutral-800 text-neutral-400 border border-neutral-700 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isSolving ? 'Calculando...' : 'Calcular Equilibrio'}</span>
        </button>
      </div>

      {toggleError && (
        <div className="absolute right-5 top-full mt-2 z-50 px-3 py-2 rounded-xl bg-rose-950 border border-rose-700 text-xs text-rose-100 shadow-lg flex items-center gap-2">
          <span>{toggleError}</span>
          <button
            type="button"
            onClick={() => setToggleError(null)}
            className="text-rose-300 hover:text-white font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Mobile responsive navigation strip */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800/80 px-3 py-2 flex items-center gap-4 text-xs font-medium overflow-x-auto"
      >
        {allMobileItems.map(item => {
          const locked = !isNavUnlocked(item.id);
          return (
            <button
              key={`mob-${item.id}`}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={getTabClass(item.id, locked)}
            >
              {locked ? <Lock className="w-3.5 h-3.5 text-neutral-600" /> : item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
