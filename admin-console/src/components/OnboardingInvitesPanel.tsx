/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OnboardingInvitesPanel: Control de Registros, Invitaciones (/userInvites) e Ingresos Recientes.
 */

import React, { useMemo, useState } from 'react';
import {
  adminRevokeUserInvite,
  type UserInviteEntry,
  type UserProfileDoc
} from '../lib/adminCloudSync';
import { getLabAppUrl } from '../lib/planCatalog';
import {
  UserPlus,
  MailCheck,
  Clock,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  LogIn
} from 'lucide-react';

interface OnboardingInvitesPanelProps {
  users: UserProfileDoc[];
  invites: UserInviteEntry[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenCreateUser: () => void;
  onInspectUser: (uid: string) => void;
  onStatus: (msg: string) => void;
  onError: (err: string) => void;
}

function formatDateValue(ts: unknown): string {
  if (!ts) return 'Reciente';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  if (typeof ts === 'number') {
    return new Date(ts).toLocaleDateString('es-ES');
  }
  return 'Sincronizado';
}

export const OnboardingInvitesPanel: React.FC<OnboardingInvitesPanelProps> = ({
  users,
  invites,
  loading,
  onRefresh,
  onOpenCreateUser,
  onInspectUser,
  onStatus,
  onError
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'claimed'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const labUrl = getLabAppUrl();

  const stats = useMemo(() => {
    const pendingInvites = invites.filter(i => i.status === 'pending').length;
    const claimedInvites = invites.filter(i => i.status === 'claimed').length;
    const realAccounts = users.filter(u => !u.isManualPlaceholder && !u.uid.startsWith('manual_')).length;
    const manualPlaceholders = users.length - realAccounts;
    return { pendingInvites, claimedInvites, realAccounts, manualPlaceholders };
  }, [invites, users]);

  const filteredInvites = useMemo(() => {
    if (filterStatus === 'all') return invites;
    return invites.filter(i => i.status === filterStatus);
  }, [invites, filterStatus]);

  const recentRealUsers = useMemo(() => {
    return [...users]
      .filter(u => !u.isManualPlaceholder && !u.uid.startsWith('manual_'))
      .slice(0, 12);
  }, [users]);

  const handleCopyInstructions = async (inv: UserInviteEntry) => {
    const resolvedLabUrl = labUrl.startsWith('http') ? labUrl : `${window.location.origin}${labUrl}`;
    const msg = `Hola ${inv.displayName}, tu acceso a Allin School (${inv.planTier.toUpperCase()}) está listo. Entra en ${resolvedLabUrl} usando tu cuenta Google (${inv.email}) y tu plan se activará automáticamente.`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2500);
      onStatus(`Instrucciones de acceso copiadas para ${inv.email}.`);
    } catch {
      onError('No se pudo copiar al portapapeles.');
    }
  };

  const handleRevoke = async (inv: UserInviteEntry) => {
    setBusyId(inv.id);
    try {
      await adminRevokeUserInvite(inv);
      await onRefresh();
      onStatus(`Invitación de ${inv.email} revocada.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo revocar la invitación.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MailCheck className="w-5 h-5 text-cyan-400" />
            <span>Registros, Invitaciones e Ingresos de Alumnos</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Supervisa quién fue invitado manualmente, quién ya reclamó su cuenta con Google al entrar por primera vez y qué nuevos jugadores acaban de ingresar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-xl font-semibold cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreateUser}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Pre-Registrar Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 block">Cuentas Google Activas</span>
          <strong className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">{stats.realAccounts}</strong>
          <span className="text-[11px] text-neutral-500">Verificadas con Google Sign-In</span>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 block">Invitaciones Pendientes</span>
          <strong className="text-2xl font-bold text-amber-300 font-mono mt-1 block">{stats.pendingInvites}</strong>
          <span className="text-[11px] text-neutral-500">Esperando primer inicio de sesión</span>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 block">Invitaciones Reclamadas</span>
          <strong className="text-2xl font-bold text-blue-400 font-mono mt-1 block">{stats.claimedInvites}</strong>
          <span className="text-[11px] text-neutral-500">Activadas automáticamente al entrar</span>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 block">Flujo de Alta</span>
          <strong className="text-sm font-bold text-white mt-2 block">100% Automático</strong>
          <span className="text-[11px] text-neutral-500">Sin contraseñas manuales</span>
        </div>
      </div>

      {/* Dummy Guide Strip */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-white">Paso 1 · Pre-registra el correo</div>
          <p className="text-neutral-400 leading-relaxed">
            Pulsa <strong>Pre-Registrar Nuevo Usuario</strong>, escribe su Gmail y define su plan (Free, Pro o Elite).
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-white">Paso 2 · Envía su mensaje de bienvenida</div>
          <p className="text-neutral-400 leading-relaxed">
            Usa el botón <strong>Copiar Acceso</strong> en la tabla inferior para enviarle el enlace del Aula Educativo por WhatsApp o correo.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-white">Paso 3 · Activación instantánea al entrar</div>
          <p className="text-neutral-400 leading-relaxed">
            Apenas entre con Google, la invitación pasa de <em>Pendiente</em> a <em>Ya ingresó</em> y hereda su plan sin intervención manual.
          </p>
        </div>
      </div>

      {/* Invites Table */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <h3 className="text-sm font-bold text-white">Registro de Invitaciones (/userInvites)</h3>
          <div className="flex items-center gap-1 p-1 bg-neutral-900 rounded-lg">
            {(['all', 'pending', 'claimed'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  filterStatus === st ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {st === 'all' ? 'Todas' : st === 'pending' ? 'Pendientes' : 'Ya Ingresaron'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/70 text-neutral-400 font-semibold">
                <th className="py-3 px-4">Jugador Invitado</th>
                <th className="py-3 px-4 font-mono">Plan / Estado</th>
                <th className="py-3 px-4">Estado de Ingreso</th>
                <th className="py-3 px-4 font-mono">Actualizado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {filteredInvites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-500">
                    No hay invitaciones en esta vista. Usa "Pre-Registrar Nuevo Usuario" para crear una.
                  </td>
                </tr>
              ) : (
                filteredInvites.map(inv => (
                  <tr key={inv.id} className="hover:bg-neutral-900/40">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{inv.displayName}</div>
                      <div className="text-[11px] text-neutral-400">{inv.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="font-bold text-blue-300 uppercase">{inv.planTier}</span>
                      <span className="text-neutral-500"> · {inv.planActive ? 'Activo' : 'Pausado'}</span>
                    </td>
                    <td className="py-3 px-4">
                      {inv.status === 'claimed' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ya ingresó con Google
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
                          <Clock className="w-3.5 h-3.5" /> Pendiente de 1er login
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-400">{formatDateValue(inv.updatedAt)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleCopyInstructions(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-lg font-semibold cursor-pointer"
                        >
                          {copiedId === inv.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                          <span>{copiedId === inv.id ? 'Copiado' : 'Copiar Acceso'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === inv.id}
                          onClick={() => void handleRevoke(inv)}
                          title="Revocar invitación"
                          className="p-1.5 bg-neutral-900 hover:bg-rose-950 border border-neutral-800 hover:border-rose-700 text-neutral-400 hover:text-rose-300 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Authenticated Users */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LogIn className="w-4 h-4 text-emerald-400" />
            <span>Alumnos con Ingreso Verificado en la Plataforma ({recentRealUsers.length})</span>
          </h3>
          <span className="text-[11px] text-neutral-500">Clic en "Ver Perfil" para revisar ELO y SM-2</span>
        </div>

        {recentRealUsers.length === 0 ? (
          <p className="text-neutral-500 py-4 text-center">Sin ingresos Google verificados aún.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentRealUsers.map(u => (
              <div key={u.uid} className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">{u.displayName}</div>
                  <div className="text-[11px] text-neutral-400 truncate">{u.email}</div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    {u.planTier.toUpperCase()} · ELO {u.elo} · Nivel {u.evaluationStats?.unlockedLevel ?? 1}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onInspectUser(u.uid)}
                  className="px-2.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-blue-300 rounded-lg font-semibold shrink-0 cursor-pointer"
                >
                  Ver Perfil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
