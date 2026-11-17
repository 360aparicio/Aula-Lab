/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SupportTicketModal: Canal directo para que los estudiantes envíen consultas o solicitudes
 * de soporte a /supportTickets y vean respuestas del Administrador en vivo.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LifeBuoy, X, Send, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  submitStudentSupportTicket,
  fetchMySupportTickets,
  type StudentSupportTicket
} from '../lib/cloudSync';

interface SupportTicketModalProps {
  open: boolean;
  onClose: () => void;
}

export const SupportTicketModal: React.FC<SupportTicketModalProps> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<StudentSupportTicket['category']>('Duda Técnica');
  const [priority, setPriority] = useState<StudentSupportTicket['priority']>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<StudentSupportTicket[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const list = await fetchMySupportTickets(user);
      setMyTickets(list);
    } catch {
      // Non-blocking
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && user) {
      void loadTickets();
    }
  }, [open, user, loadTickets]);

  if (!open || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await submitStudentSupportTicket(user, { subject, description, category, priority });
      setSubject('');
      setDescription('');
      setSuccessMsg('Ticket enviado correctamente al equipo Administrador.');
      await loadTickets();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo enviar el ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-2xl w-full bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-xs my-6">
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between gap-3 bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Centro de Ayuda y Tickets</h2>
              <p className="text-[11px] text-neutral-400">
                Envía dudas de acceso, pagos o estrategia directamente a Administración.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-neutral-300 font-semibold block">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as StudentSupportTicket['category'])}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="Duda Técnica">Duda Técnica</option>
                  <option value="Acceso">Acceso / Plan</option>
                  <option value="Pagos">Pagos / Renovación</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-neutral-300 font-semibold block">Prioridad</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as StudentSupportTicket['priority'])}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Normal</option>
                  <option value="high">Alta (Urgente)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold block">Asunto</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: Solicitar activación de módulo Árbol & Lab Pro"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-white outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold block">Detalle de tu consulta</label>
              <textarea
                required
                minLength={4}
                maxLength={600}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explica brevemente qué necesitas o el spot donde requieres apoyo..."
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-white outline-none resize-none"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200">{errorMsg}</div>
            )}
            {successMsg && (
              <div className="p-2.5 bg-emerald-950/70 border border-emerald-700 rounded-xl text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Enviando...' : 'Enviar Ticket'}</span>
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Mis Tickets Recientes ({myTickets.length})</h3>
              <button
                type="button"
                onClick={() => void loadTickets()}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingList ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            {myTickets.length === 0 ? (
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 text-center">
                Aún no has enviado tickets de soporte.
              </div>
            ) : (
              <div className="space-y-2">
                {myTickets.map(t => (
                  <div key={t.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{t.subject}</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                          t.status === 'resolved'
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
                            : t.status === 'in_progress'
                            ? 'bg-amber-950/70 text-amber-300 border-amber-600/50'
                            : 'bg-blue-950/70 text-blue-300 border-blue-600/50'
                        }`}
                      >
                        {t.status === 'resolved' ? 'Resuelto' : t.status === 'in_progress' ? 'En Proceso' : 'Abierto'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">{t.description}</p>
                    {t.adminNotes ? (
                      <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-700/40 text-emerald-200 text-[11px]">
                        <strong className="font-semibold">Respuesta Admin:</strong> {t.adminNotes}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                        <Clock className="w-3 h-3" />
                        <span>En espera de respuesta del equipo administrativo</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
