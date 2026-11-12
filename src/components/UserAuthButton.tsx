/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UserAuthButton: Estado de cuenta Google OAuth (Firebase Auth) y salida limpia a la Entrada Principal.
 * No expone controles administrativos dentro de la vista de usuario.
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  RefreshCw,
  UserCheck,
  ChevronDown,
  ShieldCheck,
  Compass
} from 'lucide-react';

export const UserAuthButton: React.FC = () => {
  const {
    user,
    isAuthReady,
    isAdmin,
    screenMode,
    switchScreenMode,
    planTier,
    syncStatus,
    cloudCounts,
    authError,
    loginAsUser,
    returnToMainEntry,
    syncNow
  } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isAuthReady) {
    return (
      <div className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-500">
        Conectando...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => void loginAsUser()}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-950 hover:bg-neutral-900 text-white border border-neutral-800 hover:border-blue-500/60 transition-all whitespace-nowrap cursor-pointer"
          title="Inicia sesión con Google para guardar tu progreso, mazo SM-2 y fugas en la nube"
        >
          <LogIn className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Iniciar Sesión Google</span>
          <span className="sm:hidden">Entrar</span>
        </button>
        {authError && (
          <div className="absolute right-0 mt-2 w-64 p-2.5 bg-red-950 border border-red-800 rounded-xl text-[11px] text-red-200 z-50 shadow-xl">
            {authError}
          </div>
        )}
      </div>
    );
  }

  const planBadgeClass =
    planTier === 'elite'
      ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
      : planTier === 'pro'
      ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
      : 'bg-neutral-900 text-neutral-300 border-neutral-700';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen(prev => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 transition-all text-xs cursor-pointer"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Perfil'}
            className="w-6 h-6 rounded-full border border-blue-500/50 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="hidden lg:flex flex-col items-start leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-semibold max-w-[100px] truncate">
              {user.displayName || 'Jugador GTO'}
            </span>
            {isAdmin && (
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-amber-950/80 text-amber-300 border-amber-500/50">
                ADMIN
              </span>
            )}
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border ${planBadgeClass}`}>
              {planTier}
            </span>
          </div>
          <span className="text-[10px] font-mono flex items-center gap-1 text-neutral-400">
            {syncStatus === 'syncing' ? (
              <>
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-blue-400" />
                <span>Sincronizando...</span>
              </>
            ) : syncStatus === 'synced' ? (
              <>
                <Cloud className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-emerald-400">Nube Activa</span>
              </>
            ) : syncStatus === 'error' ? (
              <>
                <CloudOff className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-amber-400">Error Sync</span>
              </>
            ) : (
              <span>Local</span>
            )}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl p-3 space-y-2.5 z-50 text-xs">
          <div className="pb-2 border-b border-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-white truncate">{user.displayName || 'Jugador GTO'}</span>
              <div className="flex items-center gap-1 shrink-0">
                {isAdmin && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600">
                    ADMIN
                  </span>
                )}
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${planBadgeClass}`}>
                  {planTier}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-neutral-400 truncate mt-0.5">{user.email}</div>
          </div>

          {isAdmin && (
            <div className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                Vista de Plataforma (Admin / Uso)
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    switchScreenMode('user');
                    setMenuOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    screenMode === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Uso (Lab)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    switchScreenMode('admin');
                    setMenuOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    screenMode === 'admin'
                      ? 'bg-amber-600 text-white'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800">
              <span className="text-neutral-500 block">SM-2 Nube</span>
              <strong className="text-blue-400 tabular-nums">{cloudCounts.sm2} tarjetas</strong>
            </div>
            <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800">
              <span className="text-neutral-500 block">Fugas &gt;5% EV</span>
              <strong className="text-rose-400 tabular-nums">{cloudCounts.mistakes} registros</strong>
            </div>
          </div>

          {authError && (
            <div className="p-2 bg-red-950/60 border border-red-900 rounded-lg text-[10px] text-red-200">
              {authError}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                void syncNow();
                setMenuOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void returnToMainEntry();
                setMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 rounded-lg font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
