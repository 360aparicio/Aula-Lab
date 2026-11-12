/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AuthContext: Estado de autenticación Google (Firebase Auth), separación estricta de login
 * de Usuario vs login exclusivo de Administrador (sin botón de cambio visible para usuarios).
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, signInWithGoogle, signOutUser, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  runFullCloudSync,
  fetchUserCloudSummary,
  isBootstrappedAdminUser,
  mapSnapshotToUserProfile,
  getDefaultPlanPermissions,
  type UserProfileDoc,
  type PlanPermissions,
  type PlanTier
} from '../lib/cloudSync';
import { SM2_UPDATE_EVENT } from '../engine/spacedRepetition';
import { LEARNER_UPDATE_EVENT } from '../engine/learner';

export type CloudSyncStatus = 'local_only' | 'syncing' | 'synced' | 'error';
export type ScreenMode = 'user' | 'admin';

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfileDoc | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  isPlanActive: boolean;
  planTier: PlanTier;
  planPermissions: PlanPermissions;
  screenMode: ScreenMode;
  switchScreenMode: (mode: ScreenMode) => void;
  adminLoginPortalOpen: boolean;
  setAdminLoginPortalOpen: (open: boolean) => void;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: number | null;
  cloudCounts: { sm2: number; mistakes: number };
  authError: string | null;
  loginAsUser: () => Promise<void>;
  loginAsAdmin: () => Promise<void>;
  returnToMainEntry: () => Promise<void>;
  syncNow: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const LOGIN_INTENT_KEY = 'lab_studio_login_intent';
const SCREEN_MODE_KEY = 'lab_studio_screen_mode';

function readSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, val: string | null): void {
  try {
    if (val === null) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, val);
    }
  } catch {
    // ignore
  }
}

function isProfileAuthorizedAdmin(firebaseUser: User, profile: UserProfileDoc | null): boolean {
  if (!firebaseUser.emailVerified) return false;
  if (isBootstrappedAdminUser(firebaseUser)) return true;
  if (!profile || profile.planActive === false) return false;
  return profile.role === 'admin' || profile.planPermissions?.planAdmin === true;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileDoc | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>(() => {
    try {
      if (window.location.hash === '#admin' || readSessionValue(SCREEN_MODE_KEY) === 'admin') {
        return 'admin';
      }
    } catch {
      // ignore
    }
    return 'user';
  });
  const [adminLoginPortalOpen, setAdminLoginPortalOpen] = useState<boolean>(() => {
    try {
      return window.location.hash === '#admin';
    } catch {
      return false;
    }
  });
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('local_only');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [cloudCounts, setCloudCounts] = useState<{ sm2: number; mistakes: number }>({ sm2: 0, mistakes: 0 });
  const [authError, setAuthError] = useState<string | null>(null);

  const loginIntentRef = useRef<ScreenMode | null>(null);

  const performSync = useCallback(async (targetUser: User | null) => {
    if (!targetUser || !targetUser.emailVerified) {
      setSyncStatus('local_only');
      return null;
    }

    setSyncStatus('syncing');
    try {
      const result = await runFullCloudSync(targetUser);
      const summary = await fetchUserCloudSummary(targetUser);
      const latestProfile = summary.profile || result.profile || null;
      if (latestProfile) {
        setUserProfile(latestProfile);
      }
      setCloudCounts({ sm2: summary.cloudSm2Count, mistakes: summary.cloudMistakeCount });
      setLastSyncedAt(Date.now());
      setSyncStatus('synced');
      return latestProfile;
    } catch (err) {
      setSyncStatus('error');
      setAuthError(err instanceof Error ? err.message : 'Error al sincronizar con la nube');
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setScreenMode('user');
        setSyncStatus('local_only');
        setCloudCounts({ sm2: 0, mistakes: 0 });
        setIsAuthReady(true);
        return;
      }

      const hashIsAdmin = typeof window !== 'undefined' && window.location.hash === '#admin';
      const storedIntent = readSessionValue(LOGIN_INTENT_KEY);
      const storedScreen = readSessionValue(SCREEN_MODE_KEY);
      const explicitAdminAttempt =
        loginIntentRef.current === 'admin' || storedIntent === 'admin' || hashIsAdmin;

      // Immediately pre-set admin view if bootstrapped admin opened admin portal, preventing user-screen flash
      if (explicitAdminAttempt && isBootstrappedAdminUser(firebaseUser)) {
        setScreenMode('admin');
        setAdminLoginPortalOpen(false);
        writeSessionValue(SCREEN_MODE_KEY, 'admin');
      }

      setUser(firebaseUser);
      const profile = await performSync(firebaseUser);
      const isAllowedAdmin = isProfileAuthorizedAdmin(firebaseUser, profile);

      if (explicitAdminAttempt) {
        if (isAllowedAdmin) {
          setScreenMode('admin');
          setAdminLoginPortalOpen(false);
          setAuthError(null);
          writeSessionValue(SCREEN_MODE_KEY, 'admin');
        } else {
          await signOutUser();
          setUser(null);
          setUserProfile(null);
          setScreenMode('user');
          setAdminLoginPortalOpen(true);
          writeSessionValue(SCREEN_MODE_KEY, null);
          writeSessionValue(LOGIN_INTENT_KEY, null);
          setAuthError('Acceso Denegado: esta cuenta no tiene la opción de Administrador activa en su plan.');
        }
        loginIntentRef.current = null;
        writeSessionValue(LOGIN_INTENT_KEY, null);
      } else if (storedScreen === 'admin' && isAllowedAdmin) {
        setScreenMode('admin');
        setAdminLoginPortalOpen(false);
      } else {
        setScreenMode('user');
        writeSessionValue(SCREEN_MODE_KEY, 'user');
      }

      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [performSync]);

  // Real-time listener on user profile (locks User screen instantly if plan deactivated by Admin)
  useEffect(() => {
    if (!isAuthReady || !user || !user.emailVerified) return;

    const userPath = `users/${user.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(mapSnapshotToUserProfile(snap.id, snap.data() as Record<string, unknown>));
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, userPath);
        } catch (wrapped) {
          setAuthError(wrapped instanceof Error ? wrapped.message : String(wrapped));
        }
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Auto-sync whenever SM-2, Learner mistakes, or local storage updates
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
    window.addEventListener('storage', scheduleSync);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(SM2_UPDATE_EVENT, scheduleSync);
      window.removeEventListener(LEARNER_UPDATE_EVENT, scheduleSync);
      window.removeEventListener('storage', scheduleSync);
    };
  }, [user, performSync]);

  const isAdmin = useMemo(() => {
    if (!user || !user.emailVerified) return false;
    return isProfileAuthorizedAdmin(user, userProfile);
  }, [user, userProfile]);

  const isPlanActive = useMemo(() => {
    if (!user) return false;
    if (screenMode === 'admin' && isAdmin) return true;
    if (!userProfile) return true;
    return userProfile.planActive;
  }, [user, screenMode, isAdmin, userProfile]);

  const planTier: PlanTier = useMemo(() => {
    if (userProfile?.planTier) return userProfile.planTier;
    return isAdmin ? 'elite' : 'free';
  }, [userProfile, isAdmin]);

  const planPermissions: PlanPermissions = useMemo(() => {
    if (userProfile?.planPermissions) {
      return {
        ...userProfile.planPermissions,
        planAdmin: isAdmin
      };
    }
    return getDefaultPlanPermissions(planTier, isAdmin);
  }, [userProfile, planTier, isAdmin]);

  const switchScreenMode = useCallback(
    (nextMode: ScreenMode) => {
      if (nextMode === 'admin' && !isAdmin) return;
      setScreenMode(nextMode);
      writeSessionValue(SCREEN_MODE_KEY, nextMode);
      try {
        if (nextMode === 'admin') {
          window.history.replaceState(null, '', '#admin');
        } else if (window.location.hash === '#admin') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch {
        // ignore
      }
    },
    [isAdmin]
  );

  const loginAsUser = async () => {
    setAuthError(null);
    loginIntentRef.current = 'user';
    writeSessionValue(LOGIN_INTENT_KEY, 'user');
    writeSessionValue(SCREEN_MODE_KEY, 'user');
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.');
    }
  };

  const loginAsAdmin = async () => {
    setAuthError(null);
    loginIntentRef.current = 'admin';
    writeSessionValue(LOGIN_INTENT_KEY, 'admin');
    writeSessionValue(SCREEN_MODE_KEY, 'admin');
    try {
      const cred = await signInWithGoogle();
      if (cred.user && isBootstrappedAdminUser(cred.user)) {
        setScreenMode('admin');
        setAdminLoginPortalOpen(false);
      }
    } catch (err) {
      loginIntentRef.current = null;
      writeSessionValue(LOGIN_INTENT_KEY, null);
      writeSessionValue(SCREEN_MODE_KEY, null);
      setAuthError(err instanceof Error ? err.message : 'No se pudo iniciar sesión en el Módulo Administrador.');
    }
  };

  const returnToMainEntry = async () => {
    setAuthError(null);
    loginIntentRef.current = null;
    writeSessionValue(LOGIN_INTENT_KEY, null);
    writeSessionValue(SCREEN_MODE_KEY, null);
    setAdminLoginPortalOpen(false);
    try {
      if (window.location.hash === '#admin') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch {
      // ignore
    }
    try {
      await signOutUser();
      setUser(null);
      setUserProfile(null);
      setScreenMode('user');
      setSyncStatus('local_only');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Error al volver a la entrada principal.');
    }
  };

  const syncNow = async () => {
    if (user) {
      await performSync(user);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const summary = await fetchUserCloudSummary(user);
      if (summary.profile) {
        setUserProfile(summary.profile);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'No se pudo verificar el estado del plan.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAuthReady,
        isAdmin,
        isPlanActive,
        planTier,
        planPermissions,
        screenMode,
        switchScreenMode,
        adminLoginPortalOpen,
        setAdminLoginPortalOpen,
        syncStatus,
        lastSyncedAt,
        cloudCounts,
        authError,
        loginAsUser,
        loginAsAdmin,
        returnToMainEntry,
        syncNow,
        refreshProfile
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
