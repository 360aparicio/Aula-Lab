/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AdminAuthContext: Autenticación Zero-Trust exclusiva del Repositorio Administrativo
 * Independiente (allin-studio-admin). Rechaza automáticamente cuentas sin permiso Admin activo.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  authRedirectPromise,
  signInWithGoogle,
  signInWithGoogleRedirect,
  signOutUser
} from '../lib/firebase';
import {
  verifyAdminProfileForSession,
  buildBootstrappedAdminProfile,
  isBootstrappedAdminUser,
  type UserProfileDoc
} from '../lib/adminCloudSync';

interface AdminAuthContextValue {
  user: User | null;
  profile: UserProfileDoc | null;
  isAuthReady: boolean;
  isAuthorizedAdmin: boolean;
  authError: string | null;
  loginAsAdmin: () => Promise<void>;
  loginAsAdminRedirect: () => Promise<void>;
  retryVerification: () => Promise<void>;
  signOutAdmin: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function checkIsAdminAuthorized(firebaseUser: User, profile: UserProfileDoc | null): boolean {
  if (!firebaseUser.emailVerified) return false;
  if (isBootstrappedAdminUser(firebaseUser)) return true;
  if (!profile || profile.planActive === false || profile.isManualPlaceholder) return false;
  return profile.role === 'admin' && profile.planPermissions?.planAdmin === true;
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const evaluateFirebaseSession = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setUser(null);
      setProfile(null);
      setIsAuthorizedAdmin(false);
      setIsAuthReady(true);
      return;
    }

    // Immediate non-blocking entry for the Bootstrapped Owner Admin so transient Firestore
    // cold-start latency right after switching from / -> /admin/ never locks them out.
    if (isBootstrappedAdminUser(firebaseUser)) {
      setUser(firebaseUser);
      setProfile(prev => prev || buildBootstrappedAdminProfile(firebaseUser));
      setIsAuthorizedAdmin(true);
      setAuthError(null);
      setIsAuthReady(true);

      verifyAdminProfileForSession(firebaseUser)
        .then(fetched => {
          if (fetched) setProfile(fetched);
        })
        .catch(() => {
          // Owner remains authorized with bootstrapped profile while Firestore catches up
        });
      return;
    }

    try {
      const fetched = await verifyAdminProfileForSession(firebaseUser);
      const allowed = checkIsAdminAuthorized(firebaseUser, fetched);
      if (!allowed) {
        await signOutUser();
        setUser(null);
        setProfile(null);
        setIsAuthorizedAdmin(false);
        setAuthError(
          'Acceso denegado: esta cuenta no tiene permisos de Administrador del Plan activos. Usa el Aula Educativo o solicita elevación al Administrador principal.'
        );
        setIsAuthReady(true);
        return;
      }

      setUser(firebaseUser);
      setProfile(fetched);
      setIsAuthorizedAdmin(true);
      setAuthError(null);
    } catch (err) {
      // On transient Firestore error for non-owner admin, keep signed in and allow retry
      setUser(firebaseUser);
      setProfile(null);
      setIsAuthorizedAdmin(false);
      setAuthError(
        err instanceof Error
          ? `No se pudo validar tu perfil en Firestore (${err.message}). Pulsa "Reintentar Validación".`
          : 'No se pudo validar tu perfil en Firestore. Pulsa "Reintentar Validación".'
      );
    } finally {
      setIsAuthReady(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let resolvedOnce = false;
    void authRedirectPromise.catch(() => null);

    const failSafeTimer = setTimeout(() => {
      if (!active || resolvedOnce) return;
      resolvedOnce = true;
      void evaluateFirebaseSession(auth.currentUser);
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!active) return;
      resolvedOnce = true;
      clearTimeout(failSafeTimer);
      void evaluateFirebaseSession(firebaseUser);
    });

    return () => {
      active = false;
      clearTimeout(failSafeTimer);
      unsubscribe();
    };
  }, [evaluateFirebaseSession]);

  const loginAsAdmin = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithGoogle();
      if (cred.user) {
        await evaluateFirebaseSession(cred.user);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'No se pudo completar el acceso con Google.');
    }
  }, [evaluateFirebaseSession]);

  const loginAsAdminRedirect = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithGoogleRedirect();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'No se pudo iniciar el acceso por redirección.');
    }
  }, []);

  const retryVerification = useCallback(async () => {
    setAuthError(null);
    await evaluateFirebaseSession(auth.currentUser);
  }, [evaluateFirebaseSession]);

  const signOutAdmin = useCallback(async () => {
    setAuthError(null);
    await signOutUser();
    setUser(null);
    setProfile(null);
    setIsAuthorizedAdmin(false);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        profile,
        isAuthReady,
        isAuthorizedAdmin,
        authError,
        loginAsAdmin,
        loginAsAdminRedirect,
        retryVerification,
        signOutAdmin,
        getIdToken
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }
  return ctx;
}
