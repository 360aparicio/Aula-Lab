/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AdminLoginScreen: Portal de acceso independiente para Administradores de Lab Studio.
 */

import React from 'react';
import { ShieldCheck, ExternalLink, Lock, Layers, Users, BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { getLabAppUrl } from '../lib/planCatalog';

export const AdminLoginScreen: React.FC = () => {
  const { user, loginAsAdmin, loginAsAdminRedirect, retryVerification, signOutAdmin, authError } = useAdminAuth();
  const labUrl = getLabAppUrl();

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between gap-4 border-b border-neutral-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 border border-blue-500/40 p-2 rounded-xl text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Lab Studio · Consola Admin</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                REPO INDEPENDIENTE V4.2
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Gestión SaaS, Catálogo de Planes, Secciones Visibles, Beneficios y Analítica D3.js
            </p>
          </div>
        </div>

        <a
          href={labUrl}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white transition-colors"
        >
          <span>Ir al Aula Educativo</span>
          <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
        </a>
      </div>

      <main className="max-w-xl w-full mx-auto my-8">
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white">Acceso Restringido · Administración</h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Esta plataforma opera de forma independiente del Aula Educativo para controlar usuarios,
              planes, visibilidad de módulos, beneficios en vivo y analítica global sin exponer herramientas
              administrativas en el código estudiantil.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <Layers className="w-4 h-4 text-blue-400" />
              <div className="font-bold text-white">Planes &amp; Secciones</div>
              <p className="text-[11px] text-neutral-400">Activa qué módulos y beneficios ve cada plan en tiempo real.</p>
            </div>
            <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <Users className="w-4 h-4 text-emerald-400" />
              <div className="font-bold text-white">Alta Manual &amp; RBAC</div>
              <p className="text-[11px] text-neutral-400">Pre-registro de cuentas y permisos granulares.</p>
            </div>
            <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-1">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <div className="font-bold text-white">Analítica D3 &amp; BD</div>
              <p className="text-[11px] text-neutral-400">Crecimiento, retención mensual y uso de Firestore.</p>
            </div>
          </div>

          {authError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-700 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {user && (
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="text-neutral-400">Sesión detectada:</div>
                <div className="text-white font-semibold truncate">{user.email}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void retryVerification()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reintentar</span>
                </button>
                <button
                  type="button"
                  onClick={() => void signOutAdmin()}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold cursor-pointer"
                >
                  Cambiar cuenta
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => void loginAsAdmin()}
              className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Iniciar Sesión como Administrador (Google)</span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => void loginAsAdminRedirect()}
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
              >
                Usar acceso por redirección (si bloquea ventanas emergentes)
              </button>
              <a
                href={typeof window !== 'undefined' ? window.location.href : '/admin/'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-neutral-400 hover:text-white"
              >
                <span>Abrir en pestaña nueva</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 text-center">
            Zero-Trust RBAC: Solo cuentas con <code className="text-neutral-300">role = &apos;admin&apos;</code> o
            opción <code className="text-neutral-300">Admin del Plan</code> activa pueden ingresar.
          </p>
        </div>
      </main>

      <footer className="max-w-3xl w-full mx-auto text-center text-[11px] text-neutral-500 border-t border-neutral-900 pt-4">
        Lab Studio Admin Console (lab-studio-admin) · Conectado en vivo vía Firestore al Aula Educativo
      </footer>
    </div>
  );
};
