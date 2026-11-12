/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AuthContext: Estado de autenticación Google (Firebase Auth) y sincronización en la nube.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '../lib/firebase';
import { runFullCloudSync, fetchUserCloudSummary } from '../lib/cloudSync';
import { SM2_UPDATE_EVENT } from '../engine/spacedRepetition';
import { LEARNER_UPDATE_EVENT } from '../engine/learner';

export type CloudSyncStatus = 'local_only' | 'syncing' | 'synced' | 'error';

interface AuthContextValue {
  user: User | null;
  isAuthReady: boolean;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: number | null;
  cloudCounts: { sm2: number; mistakes: number };
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('local_only');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [cloudCounts, setCloudCounts] = useState<{ sm2: number; mistakes: number }>({ sm2: 0, mistakes: 0 });
  const [authError, setAuthError] = useState<string | null>(null);

  const performSync = useCallback(async (targetUser: User | null) => {
    if (!targetUser || !targetUser.emailVerified) {
      setSyncStatus('local_only');
      return;
    }

    setSyncStatus('syncing');
    try {
      await runFullCloudSync(targetUser);
      const summary = await fetchUserCloudSummary(targetUser);
      setCloudCounts({ sm2: summary.cloudSm2Count, mistakes: summary.cloudMistakeCount });
      setLastSyncedAt(Date.now());
      setSyncStatus('synced');
      setAuthError(null);
    } catch (err) {
      setSyncStatus('error');
      setAuthError(err instanceof Error ? err.message : 'Error al sincronizar con la nube');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      if (firebaseUser) {
        void performSync(firebaseUser);
      } else {
        setSyncStatus('local_only');
        setCloudCounts({ sm2: 0, mistakes: 0 });
      }
    });
    return () => unsubscribe();
  }, [performSync]);

  // Auto-sync whenever SM-2 deck or Learner mistakes update while authenticated
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSync = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void performSync(user);
      }, 1200);
    };

    window.addEventListener(SM2_UPDATE_EVENT, scheduleSync);
    window.addEventListener(LEARNER_UPDATE_EVENT, scheduleSync);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(SM2_UPDATE_EVENT, scheduleSync);
      window.removeEventListener(LEARNER_UPDATE_EVENT, scheduleSync);
    };
  }, [user, performSync]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithGoogle();
      if (cred.user) {
        await performSync(cred.user);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.');
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await signOutUser();
      setSyncStatus('local_only');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Error al cerrar sesión.');
    }
  };

  const syncNow = async () => {
    if (user) {
      await performSync(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthReady,
        syncStatus,
        lastSyncedAt,
        cloudCounts,
        authError,
        loginWithGoogle,
        logout,
        syncNow
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
