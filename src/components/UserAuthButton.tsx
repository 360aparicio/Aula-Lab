/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UserAuthButton: Acceso Google OAuth (Firebase Auth) y estado de sincronización privada en Firestore.
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, Cloud, CloudOff, RefreshCw, UserCheck, ChevronDown } from 'lucide-react';

export const UserAuthButton: React.FC = () => {
  const { user, isAuthReady, syncStatus, cloudCounts, authError, loginWithGoogle, logout, syncNow } = useAuth();
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
          onClick={() => void loginWithGoogle()}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-950 hover:bg-neutral-900 text-white border border-neutral-800 hover:border-blue-500/60 transition-all whitespace-nowrap cursor-pointer"
          title="Inicia sesión con Google para guardar tu progreso, mazo SM-2 y fugas en la nube"
        >
          <LogIn className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Sincronizar Cuenta Google</span>
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
          <span className="text-white font-semibold max-w-[110px] truncate">
            {user.displayName || 'Jugador GTO'}
          </span>
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
        <div className="absolute right-0 mt-2 w-64 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl p-3 space-y-2.5 z-50 text-xs">
          <div className="pb-2 border-b border-neutral-800">
            <div className="font-bold text-white truncate">{user.displayName || 'Jugador GTO'}</div>
            <div className="text-[11px] text-neutral-400 truncate">{user.email}</div>
          </div>

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
                void logout();
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
