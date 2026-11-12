/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firebase Admin Bearer token + Plan-Admin RBAC verification middleware compatible with Node ESM.
 */

import type { Request, Response, NextFunction } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

const BOOTSTRAPPED_ADMIN_EMAIL = '360aparicio@gmail.com';

function ensureFirebaseAdminApp() {
  if (getApps().length === 0) {
    initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  return getApp();
}

function getFirebaseAdminAuth() {
  return getAuth(ensureFirebaseAdminApp());
}

function getFirebaseAdminFirestore() {
  const app = ensureFirebaseAdminApp();
  return firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    req.user = decoded;
  } catch {
    // Token could not be verified; treat as unauthenticated for optional endpoints
  }
  next();
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication Bearer token required.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Autenticación de Administrador requerida.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    req.user = decoded;

    if (!decoded.email_verified) {
      res.status(403).json({ error: 'Se requiere correo verificado con permisos de Administrador.' });
      return;
    }

    if (decoded.email?.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
      next();
      return;
    }

    const db = getFirebaseAdminFirestore();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const data = userSnap.data() as Record<string, unknown> | undefined;
    const isPlanActive = data?.planActive === true;
    const isRoleAdmin = data?.role === 'admin';
    const perms = data?.planPermissions as Record<string, unknown> | undefined;
    const isPlanAdminPerm = perms?.planAdmin === true;

    if (userSnap.exists && isPlanActive && (isRoleAdmin || isPlanAdminPerm)) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Solo las cuentas con la opción de Administrador activa en su plan pueden configurar o sincronizar el sistema.'
    });
  } catch {
    res.status(401).json({ error: 'Token de Administrador inválido o expirado.' });
  }
}
