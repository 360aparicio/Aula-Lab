/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AuthContext: Estado de autenticación Google (Firebase Auth), separación estricta de login
 * de Usuario vs login exclusivo de Administrador (sin botón de cambio visible para usuarios).
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, query } from 'firebase/firestore';
import {
  auth,
  db,
  authRedirectPromise,
  signInWithGoogle,
  signInWithGoogleRedirect,
  signOutUser,
  mapAuthErrorToSpanish,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import {
  hydrateLocalStateFromCloud,
  runFullCloudSync,
  fetchUserCloudSummary,
  isBootstrappedAdminUser,
  buildBootstrappedAdminProfile,
  mapSnapshotToUserProfile,
  getDefaultPlanPermissions,
  type UserProfileDoc
} from '../lib/cloudSync';
import {
  DEFAULT_PLAN_CONFIGS,
  mergePlanConfig,
  getAdminConsoleUrl,
  type LabSectionId,
  type PlanConfigDoc,
  type PlanPermissions,
  type PlanTier
} from '../lib/planCatalog';
import { setActiveStorageUserUid } from '../lib/userStorage';
import { SpacedRepetitionManager, SM2_UPDATE_EVENT } from '../engine/spacedRepetition';
import { LearnerService, LEARNER_UPDATE_EVENT } from '../engine/learner';
import { AutoLearningEngine } from '../engine/autoLearningEngine';

export type CloudSyncStatus = 'local_only' | 'syncing' | 'synced' | 'error';

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfileDoc | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  isOwnerAdmin: boolean;
  isPlanActive: boolean;
  planTier: PlanTier;
  planPermissions: PlanPermissions;
  activePlanConfig: PlanConfigDoc;
  allPlanConfigs: Record<PlanTier, PlanConfigDoc>;
  canAccessSection: (section: LabSectionId) => boolean;
  verifyAdminSession: () => Promise<boolean>;
  openAdminConsole: () => void;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: number | null;
  cloudCounts: { sm2: number; mistakes: number };
  authError: string | null;
  loginAsUser: () => Promise<void>;
  loginAsUserRedirect: () => Promise<void>;
  returnToMainEntry: () => Promise<void>;
  syncNow: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function isProfileAuthorizedAdmin(firebaseUser: User | null, profile: UserProfileDoc | null): boolean {
  if (!firebaseUser || !firebaseUser.emailVerified) return false;
  if (isBootstrappedAdminUser(firebaseUser)) return true;
  if (!profile || profile.planActive === false || profile.isManualPlaceholder) return false;
  return profile.role === 'admin' && profile.planPermissions?.planAdmin === true;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileDoc | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [allPlanConfigs, setAllPlanConfigs] = useState<Record<PlanTier, PlanConfigDoc>>(DEFAULT_PLAN_CONFIGS);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('local_only');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [cloudCounts, setCloudCounts] = useState<{ sm2: number; mistakes: number }>({ sm2: 0, mistakes: 0 });
  const [authError, setAuthError] = useState<string | null>(null);
  const hydratedUidRef = useRef<string | null>(null);

  const performSync = useCallback(async (targetUser: User | null) => {
    if (!targetUser || !targetUser.emailVerified) {
      setSyncStatus('local_only');
      return null;
    }

    setSyncStatus('syncing');
    try {
      if (hydratedUidRef.current !== targetUser.uid) {
        await hydrateLocalStateFromCloud(targetUser);
        hydratedUidRef.current = targetUser.uid;
      }
      const result = await runFullCloudSync(targetUser);
      const summary = await fetchUserCloudSummary(targetUser);
      const latestProfile = summary.profile || result.profile || null;
      if (latestProfile) {
        if (isBootstrappedAdminUser(targetUser)) {
          setUserProfile({
            ...latestProfile,
            role: 'admin',
            planTier: 'elite',
            planActive: true,
            planPermissions: { ...latestProfile.planPermissions, planAdmin: true }
          });
        } else {
          setUserProfile(latestProfile);
        }
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

  const applyAuthenticatedUser = useCallback(
    async (firebaseUser: User | null, isStillActive: () => boolean) => {
      if (!firebaseUser) {
        hydratedUidRef.current = null;
        setActiveStorageUserUid(null);
        SpacedRepetitionManager.getInstance().reloadForActiveUser();
        LearnerService.getInstance().reloadForActiveUser();
        AutoLearningEngine.getInstance().reloadForActiveUser();

        setUser(null);
        setUserProfile(null);
        setAllPlanConfigs(DEFAULT_PLAN_CONFIGS);
        setSyncStatus('local_only');
        setCloudCounts({ sm2: 0, mistakes: 0 });
        setIsAuthReady(true);
        return;
      }

      // 1. Isolate browser storage to this UID synchronously before workspace renders
      setActiveStorageUserUid(firebaseUser.uid);
      SpacedRepetitionManager.getInstance().reloadForActiveUser();
      LearnerService.getInstance().reloadForActiveUser();
      AutoLearningEngine.getInstance().reloadForActiveUser();

      // 2. Immediate state transition so user & bootstrapped owner admin enter instantly
      setUser(firebaseUser);
      if (isBootstrappedAdminUser(firebaseUser)) {
        setUserProfile(prev => (prev && prev.uid === firebaseUser.uid ? prev : buildBootstrappedAdminProfile(firebaseUser)));
        setIsAuthReady(true);
      } else {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (!isStillActive()) return;
          if (snap.exists()) {
            setUserProfile(mapSnapshotToUserProfile(snap.id, snap.data() as Record<string, unknown>));
          }
        } catch {
          // Non-fatal: performSync will hydrate/sync below
        }
        if (!isStillActive()) return;
        setIsAuthReady(true);
      }

      // 3. Hydrate cloud progress into UID-scoped localStorage, then propagate latest profile metadata
      await performSync(firebaseUser);
      if (!isStillActive()) return;
      setIsAuthReady(true);
    },
    [performSync]
  );

  useEffect(() => {
    let active = true;
    let resolvedOnce = false;
    void authRedirectPromise.catch(() => null);

    const failSafeTimer = setTimeout(() => {
      if (!active || resolvedOnce) return;
      resolvedOnce = true;
      void applyAuthenticatedUser(auth.currentUser, () => active);
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!active) return;
      resolvedOnce = true;
      clearTimeout(failSafeTimer);
      void applyAuthenticatedUser(firebaseUser, () => active);
    });

    return () => {
      active = false;
      clearTimeout(failSafeTimer);
      unsubscribe();
    };
  }, [applyAuthenticatedUser]);

  // Real-time listener on user profile (locks User screen instantly if plan deactivated or changed by Admin Console)
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

  // Real-time listener on Admin-managed /planConfigs catalog (updates sections & benefits live across repos!)
  useEffect(() => {
    if (!isAuthReady || !user || !user.emailVerified) return;

    const q = query(collection(db, 'planConfigs'), limit(10));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next: Record<PlanTier, PlanConfigDoc> = { ...DEFAULT_PLAN_CONFIGS };
        for (const d of snap.docs) {
          if (d.id === 'free' || d.id === 'pro' || d.id === 'elite') {
            next[d.id] = mergePlanConfig(d.id, d.data() as Record<string, unknown>);
          }
        }
        setAllPlanConfigs(next);
      },
      () => {
        // Fallback smoothly to DEFAULT_PLAN_CONFIGS if catalog hasn't been initialized yet
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
    window.addEventListener('lab-pro-sync-needed', scheduleSync);
    window.addEventListener('storage', scheduleSync);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(SM2_UPDATE_EVENT, scheduleSync);
      window.removeEventListener(LEARNER_UPDATE_EVENT, scheduleSync);
      window.removeEventListener('lab-pro-sync-needed', scheduleSync);
      window.removeEventListener('storage', scheduleSync);
    };
  }, [user, performSync]);

  const isOwnerAdmin = useMemo(() => {
    return isBootstrappedAdminUser(user);
  }, [user]);

  const isAdmin = useMemo(() => {
    if (!user || !user.emailVerified) return false;
    return isProfileAuthorizedAdmin(user, userProfile);
  }, [user, userProfile]);

  const isPlanActive = useMemo(() => {
    if (!user) return false;
    if (isAdmin) return true;
    if (!userProfile) return true;
    return userProfile.planActive;
  }, [user, isAdmin, userProfile]);

  const planTier: PlanTier = useMemo(() => {
    if (userProfile?.planTier) return userProfile.planTier;
    return isAdmin ? 'elite' : 'free';
  }, [userProfile, isAdmin]);

  const activePlanConfig = useMemo(() => {
    return allPlanConfigs[planTier] || DEFAULT_PLAN_CONFIGS[planTier];
  }, [allPlanConfigs, planTier]);

  const planPermissions: PlanPermissions = useMemo(() => {
    if (userProfile?.planPermissions) {
      return {
        ...userProfile.planPermissions,
        planAdmin: isAdmin
      };
    }
    return {
      ...activePlanConfig.defaultPermissions,
      ...getDefaultPlanPermissions(planTier, isAdmin),
      planAdmin: isAdmin
    };
  }, [userProfile, activePlanConfig, planTier, isAdmin]);

  const canAccessSection = useCallback(
    (section: LabSectionId): boolean => {
      if (isAdmin) return true;
      return Boolean(activePlanConfig.visibleSections[section]);
    },
    [isAdmin, activePlanConfig]
  );

  const verifyAdminSession = useCallback(async (): Promise<boolean> => {
    const currentUser = auth.currentUser || user;
    if (!currentUser || !currentUser.emailVerified) {
      return false;
    }

    if (isBootstrappedAdminUser(currentUser)) {
      setUser(currentUser);
      setUserProfile(prev => (prev && prev.uid === currentUser.uid ? prev : buildBootstrappedAdminProfile(currentUser)));
      return true;
    }

    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (!snap.exists()) return false;
      const freshProfile = mapSnapshotToUserProfile(snap.id, snap.data() as Record<string, unknown>);
      setUserProfile(freshProfile);
      return isProfileAuthorizedAdmin(currentUser, freshProfile);
    } catch {
      return isProfileAuthorizedAdmin(currentUser, userProfile);
    }
  }, [user, userProfile]);

  const openAdminConsole = useCallback(() => {
    window.location.assign(getAdminConsoleUrl());
  }, []);

  const loginAsUser = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithGoogle();
      if (cred.user && isBootstrappedAdminUser(cred.user)) {
        setUser(cred.user);
        setUserProfile(prev => (prev && prev.uid === cred.user.uid ? prev : buildBootstrappedAdminProfile(cred.user)));
        setIsAuthReady(true);
      }
    } catch (err) {
      setAuthError(mapAuthErrorToSpanish(err));
    }
  };

  const loginAsUserRedirect = async () => {
    setAuthError(null);
    try {
      await signInWithGoogleRedirect();
    } catch (err) {
      setAuthError(mapAuthErrorToSpanish(err));
    }
  };

  const returnToMainEntry = async () => {
    setAuthError(null);
    try {
      await signOutUser();
      hydratedUidRef.current = null;
      setActiveStorageUserUid(null);
      SpacedRepetitionManager.getInstance().reloadForActiveUser();
      LearnerService.getInstance().reloadForActiveUser();
      AutoLearningEngine.getInstance().reloadForActiveUser();
      setUser(null);
      setUserProfile(null);
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
        isOwnerAdmin,
        isPlanActive,
        planTier,
        planPermissions,
        activePlanConfig,
        allPlanConfigs,
        canAccessSection,
        verifyAdminSession,
        openAdminConsole,
        syncStatus,
        lastSyncedAt,
        cloudCounts,
        authError,
        loginAsUser,
        loginAsUserRedirect,
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
