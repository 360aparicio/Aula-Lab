/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firebase Admin Bearer token verification middleware compatible with Node ESM.
 */

import type { Request, Response, NextFunction } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

function getFirebaseAdminAuth() {
  if (getApps().length === 0) {
    initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  return getAuth();
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
