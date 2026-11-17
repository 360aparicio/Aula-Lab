/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LoginScreen: Entrada Principal del Aula / Laboratorio Educativo (Repo 1).
 * El Portal Administrativo vive de forma completamente independiente en Repo 2
 * y se enlaza únicamente vía getAdminConsoleUrl() (/admin/ o VITE_ADMIN_APP_URL).
 * Terminología estricta de "Laboratorio".
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAdminConsoleUrl } from '../lib/planCatalog';
import {
  LogIn,
  ShieldCheck,
  Brain,
  ClipboardCheck,
  BarChart3,
  Globe,
  Lock,
  RefreshCw,
  LogOut,
  Layers,
  Users,
  FlaskConical,
  GraduationCap,
  ExternalLink
} from 'lucide-react';

interface LoginScreenProps {
  mode: 'login' | 'inactive';
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ mode }) => {
  const {
    user,
    userProfile,
    planTier,
    authError,
    loginAsUser,
    loginAsUserRedirect,
    returnToMainEntry,
    refreshProfile
  } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpeningAdmin, setIsOpeningAdmin] = useState(false);

  const adminUrl = getAdminConsoleUrl();
  const selfUrl = typeof window !== 'undefined' ? window.location.href : '/';

  const handleUserLogin = async () => {
    setIsConnecting(true);
    try {
      await loginAsUser();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Screen when user's plan was deactivated from the Independent Admin Repository
  if (mode === 'inactive' && user) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400">
                Acceso Pausado · Plan Inactivo
              </span>
              <h1 className="text-xl font-bold text-white">
                Tu plan en Allin School está desactivado
              </h1>
            </div>
          </div>

          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Usuario'}
                className="w-10 h-10 rounded-full border border-neutral-700 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-neutral-300">
                {(user.displayName || 'U').slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">
                {userProfile?.displayName || user.displayName || 'Jugador Allin School'}
              </div>
              <div className="text-xs text-neutral-400 truncate">{user.email}</div>
            </div>
            <div className="text-right shrink-0 font-mono">
              <span className="text-[10px] uppercase text-neutral-500 block">Plan</span>
              <span className="text-xs font-bold uppercase text-amber-300">{planTier}</span>
            </div>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            Tu historial SM-2, nivel educativo, progreso D3.js y evaluaciones permanecen intactos en la nube. Un
            administrador debe reactivar tu suscripción desde{' '}
            <strong className="text-white">Allin Studio Admin</strong> para habilitar tu acceso completo.
          </p>

          {authError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-200">
              {authError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Verificar Estado del Plan</span>
            </button>
            <button
              type="button"
              onClick={() => void returnToMainEntry()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Volver a la Entrada Principal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Entry Screen for Educational Lab (Repo 1) + Discrete Link to Independent Admin Repo (Repo 2)
  return (
    <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Información completa del Aula & Laboratorio (solo terminología Laboratorio) */}
        <div className="lg:col-span-7 bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                Allin School
              </span>
              <span className="text-[11px] font-mono font-bold uppercase text-blue-300">
                Ecosistema Allin Studio · 6-Max
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Academia Cognitiva, Motor Lab Studio Nash y Sistema TheTracker2
            </h1>

            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Inicia sesión para entrar a tu estudio privado: motor propietario Lab Studio DCFR en vivo, seguimiento
              TheTracker2 con Replayer calle por calle, simulador 6-Max, más de 720 preguntas únicas por niveles y
              aprendizaje adaptativo SM-2.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-white">
                <FlaskConical className="w-4 h-4 text-blue-400" />
                <span>Lab Studio + Street Coach</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Árbol de decisiones interactivo, calibración de sizings, Pot Odds, SPR y MDF en tiempo real.
              </p>
            </div>

            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-white">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>TheTracker2 + Diagnóstico</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Importa tus sesiones, visualiza gráficas de rendimiento y pasa cualquier mano directo a Lab Studio.
              </p>
            </div>

            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-white">
                <Brain className="w-4 h-4 text-amber-400" />
                <span>Motor SM-2 &amp; Fugas &gt;5% EV</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Captura automática de errores y programación matemática de repaso personalizado para cada estudiante.
              </p>
            </div>

            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-white">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Radar Web &amp; Analítica D3</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Actualización de tendencias estratégicas, analítica multidimensional D3.js y reporte PDF offline.
              </p>
            </div>
          </div>
        </div>

        {/* Right: User Login Card + Discrete Link to Independent Admin Repository */}
        <div className="lg:col-span-5 flex flex-col gap-4 justify-between">
          <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-500/30">
                  Acceso de Estudiantes
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Inicio de Sesión — Allin School</h2>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Ingresa con tu cuenta Google para abrir Lab Studio y TheTracker2, guardar tu ELO, nivel educativo,
                  tarjetas SM-2 y revisar las secciones habilitadas por tu plan.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2 text-[11px] text-neutral-300">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Centro educativo adaptado a tu nivel y fugas reales.</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Sincronización privada en la nube en tiempo real.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Secciones y beneficios dinámicos según tu plan (Free / Pro / Elite).</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {authError && (
                <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-200">
                  {authError}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleUserLogin()}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {isConnecting ? 'Conectando al Laboratorio...' : 'Iniciar Sesión en el Aula (Google)'}
                </span>
              </button>

              <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400 pt-1">
                <button
                  type="button"
                  onClick={() => void loginAsUserRedirect()}
                  className="hover:text-blue-300 underline cursor-pointer"
                >
                  ¿Pop-up bloqueado? Entrar con redirección
                </button>
                <a
                  href={selfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white flex items-center gap-1"
                >
                  <span>Pestaña nueva</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Discrete entry link to the completely Independent Admin Repository */}
          <div className="bg-neutral-950 border border-neutral-800/90 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span>Allin Studio Admin</span>
              </div>
              <p className="text-[10px] text-neutral-500 truncate">
                Consola SaaS independiente para gestión de planes y cuentas
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOpeningAdmin(true);
                  window.location.assign(adminUrl);
                }}
                disabled={isOpeningAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/60 text-neutral-200 hover:text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-60"
              >
                <Lock className="w-3 h-3 text-blue-400" />
                <span>{isOpeningAdmin ? 'Abriendo Admin...' : 'Acceso Admin'}</span>
              </button>
              <a
                href={adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir Consola Admin en pestaña nueva"
                aria-label="Abrir Consola Admin en pestaña nueva"
                className="p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/60 text-neutral-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
