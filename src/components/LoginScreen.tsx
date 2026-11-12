/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LoginScreen: Entrada Principal de Usuarios + Portal Exclusivo de Acceso para Administrador.
 * Terminología estricta de "Laboratorio" (sin menciones al término técnico prohibido en entrada).
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
  ArrowLeft,
  GraduationCap
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
    adminLoginPortalOpen,
    setAdminLoginPortalOpen,
    loginAsUser,
    loginAsAdmin,
    returnToMainEntry,
    refreshProfile
  } = useAuth();
  const [busyMode, setBusyMode] = useState<'user' | 'admin' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleUserLogin = async () => {
    setBusyMode('user');
    try {
      await loginAsUser();
    } finally {
      setBusyMode(null);
    }
  };

  const handleAdminLogin = async () => {
    setBusyMode('admin');
    try {
      await loginAsAdmin();
    } finally {
      setBusyMode(null);
    }
  };

  const openAdminPortal = () => {
    try {
      window.history.replaceState(null, '', '#admin');
    } catch {
      // ignore
    }
    setAdminLoginPortalOpen(true);
  };

  const backToMainEntry = () => {
    try {
      if (window.location.hash === '#admin') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch {
      // ignore
    }
    setAdminLoginPortalOpen(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Screen when user's plan was deactivated by an Administrator
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
                Tu plan en Lab Studio está desactivado
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
                {userProfile?.displayName || user.displayName || 'Jugador GTO'}
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
            administrador debe reactivar tu suscripción desde el <strong className="text-white">Módulo Administrador</strong>{' '}
            para habilitar tu Laboratorio GTO.
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

  // Dedicated, Separate Login Portal Exclusively for Administrators
  if (adminLoginPortalOpen) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
              Lab Studio
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/40">
              Portal Exclusivo · Admin
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Acceso de Administración</h1>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Consola privada Zero-Trust RBAC para gestionar usuarios, activar o desactivar planes (Free / Pro /
                Elite), auditar progreso educativo y monitorear la plataforma.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2 text-[11px] text-neutral-300">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Solo cuentas con opción Administrador en su plan pueden acceder.</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Configuración del sistema, gestión de cuentas y auditoría inmutable.</span>
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-200">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleAdminLogin()}
              disabled={busyMode !== null}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {busyMode === 'admin'
                  ? 'Verificando credenciales de Administrador...'
                  : 'Iniciar Sesión como Administrador (Google)'}
              </span>
            </button>

            <button
              type="button"
              onClick={backToMainEntry}
              disabled={busyMode !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la Entrada Principal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Entry Screen: Strictly User Login + Discrete Link to Separate Admin Portal
  return (
    <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Información completa de la plataforma (solo terminología Laboratorio) */}
        <div className="lg:col-span-7 bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                Lab Studio
              </span>
              <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/40">
                V3.4 Pro · NL Hold&apos;em 6-Max
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Centro Educativo Personalizado, Evaluación por Niveles y Laboratorio 6-Max
            </h1>

            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Inicia sesión para entrar a tu estudio privado: Laboratorio DCFR en vivo, selector dual de cartas en un
              clic, simulador multi-mano, más de 720 preguntas únicas sin repetición por niveles (NL2 ➔ NL100) con
              resultados visuales &quot;para dummies&quot; y motor cognitivo SM-2.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-white">
                <FlaskConical className="w-4 h-4 text-blue-400" />
                <span>Laboratorio DCFR + Street Coach</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Árbol de decisiones interactivo, Action Gauge de sizings, Pot Odds, SPR y MDF en tiempo real.
              </p>
            </div>

            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-white">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span>Evaluación 720+ Preguntas &amp; Niveles</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                4 niveles progresivos, temas fijos y spots personalizables sin repetir preguntas, con repaso visual de mano.
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
                <span>Laboratorios Web &amp; Analítica D3</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Actualización de tendencias en internet, analítica multidimensional D3.js y reporte PDF offline.
              </p>
            </div>
          </div>
        </div>

        {/* Right: User Login Card + Discrete Link to Separate Admin Login */}
        <div className="lg:col-span-5 flex flex-col gap-4 justify-between">
          <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-500/30">
                  Acceso de Jugadores
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Inicio de Sesión — Usuarios</h2>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Ingresa con tu cuenta Google para abrir tu Laboratorio de Póker, guardar tu ELO, nivel educativo,
                  tarjetas SM-2, exámenes y progreso NL02 ➔ NL100.
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
                  <span>Acceso inmediato según el estado de tu plan (Free / Pro / Elite).</span>
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
                disabled={busyMode !== null}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {busyMode === 'user' ? 'Conectando cuenta de usuario...' : 'Iniciar Sesión como Usuario (Google)'}
                </span>
              </button>
            </div>
          </div>

          {/* Discrete entry link to open the completely separate Admin Login Screen */}
          <div className="bg-neutral-950 border border-neutral-800/90 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span>Administración de Plataforma</span>
              </div>
              <p className="text-[10px] text-neutral-500 truncate">
                Portal independiente para administradores
              </p>
            </div>

            <button
              type="button"
              onClick={openAdminPortal}
              disabled={busyMode !== null}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/60 text-neutral-300 hover:text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
            >
              <Lock className="w-3 h-3 text-blue-400" />
              <span>Acceso Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
