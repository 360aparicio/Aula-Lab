/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SupportAnnouncementsPanel: Comunicados Globales en Vivo (/platformAnnouncements)
 * y Centro de Tickets / Soporte de Alumnos (/supportTickets).
 */

import React, { useState } from 'react';
import {
  adminCreateAnnouncement,
  adminCreateSupportTicket,
  adminDeleteAnnouncement,
  adminDeleteSupportTicket,
  adminToggleAnnouncementActive,
  adminUpdateSupportTicket,
  type AnnouncementSeverity,
  type AnnouncementTargetPlan,
  type PlatformAnnouncementEntry,
  type SupportTicketEntry,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type UserProfileDoc
} from '../lib/adminCloudSync';
import {
  Megaphone,
  LifeBuoy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save
} from 'lucide-react';

interface SupportAnnouncementsPanelProps {
  users: UserProfileDoc[];
  announcements: PlatformAnnouncementEntry[];
  tickets: SupportTicketEntry[];
  onRefresh: () => Promise<void>;
  onStatus: (msg: string) => void;
  onError: (err: string) => void;
}

export const SupportAnnouncementsPanel: React.FC<SupportAnnouncementsPanelProps> = ({
  users,
  announcements,
  tickets,
  onRefresh,
  onStatus,
  onError
}) => {
  // Announcement Form
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annSeverity, setAnnSeverity] = useState<AnnouncementSeverity>('info');
  const [annTargetPlan, setAnnTargetPlan] = useState<AnnouncementTargetPlan>('all');
  const [savingAnn, setSavingAnn] = useState(false);

  // Ticket Form
  const [ticketUserUid, setTicketUserUid] = useState(users[0]?.uid || '');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketCat, setTicketCat] = useState<TicketCategory>('Acceso');
  const [ticketPrio, setTicketPrio] = useState<TicketPriority>('medium');
  const [savingTicket, setSavingTicket] = useState(false);

  // Inline Ticket Notes Editor
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;
    setSavingAnn(true);
    try {
      await adminCreateAnnouncement({
        title: annTitle,
        message: annMessage,
        severity: annSeverity,
        targetPlan: annTargetPlan,
        active: true
      });
      setAnnTitle('');
      setAnnMessage('');
      await onRefresh();
      onStatus('Anuncio publicado en vivo en el Aula Educativo.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo publicar el anuncio.');
    } finally {
      setSavingAnn(false);
    }
  };

  const handleToggleAnn = async (ann: PlatformAnnouncementEntry) => {
    setBusyId(ann.id);
    try {
      await adminToggleAnnouncementActive(ann);
      await onRefresh();
      onStatus(`Anuncio "${ann.title}" ${ann.active ? 'pausado' : 'activado'}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error cambiando estado del anuncio.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteAnn = async (ann: PlatformAnnouncementEntry) => {
    setBusyId(ann.id);
    try {
      await adminDeleteAnnouncement(ann);
      await onRefresh();
      onStatus(`Anuncio "${ann.title}" eliminado.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error eliminando anuncio.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDesc.trim()) return;
    const found = users.find(u => u.uid === ticketUserUid) || users[0];
    setSavingTicket(true);
    try {
      await adminCreateSupportTicket({
        userUid: found?.uid || 'system_note',
        userEmail: found?.email || 'soporte@labstudio.app',
        userName: found?.displayName || 'Nota Interna',
        subject: ticketSubject,
        description: ticketDesc,
        category: ticketCat,
        priority: ticketPrio
      });
      setTicketSubject('');
      setTicketDesc('');
      await onRefresh();
      onStatus('Ticket de soporte registrado.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo crear el ticket.');
    } finally {
      setSavingTicket(false);
    }
  };

  const handleSaveTicketState = async (
    ticket: SupportTicketEntry,
    nextStatus: TicketStatus,
    nextPriority: TicketPriority
  ) => {
    setBusyId(ticket.id);
    try {
      const notes = editingNotes[ticket.id] ?? ticket.adminNotes;
      await adminUpdateSupportTicket(ticket, {
        status: nextStatus,
        priority: nextPriority,
        adminNotes: notes
      });
      await onRefresh();
      onStatus(`Ticket "${ticket.subject}" actualizado.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo actualizar el ticket.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTicket = async (ticket: SupportTicketEntry) => {
    setBusyId(ticket.id);
    try {
      await adminDeleteSupportTicket(ticket);
      await onRefresh();
      onStatus(`Ticket "${ticket.subject}" eliminado.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo eliminar el ticket.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT: LIVE PLATFORM ANNOUNCEMENTS */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-blue-400" />
              <span>Anuncios en Vivo al Aula Educativo</span>
            </h2>
            <p className="text-neutral-400 mt-0.5">
              Publica avisos, novedades o promociones que aparecen en tiempo real en la pantalla de tus estudiantes.
            </p>
          </div>

          <form onSubmit={(e) => void handlePublishAnnouncement(e)} className="space-y-3 p-4 bg-neutral-900/70 border border-neutral-800 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-neutral-300 font-semibold block">Título del Aviso</label>
                <input
                  type="text"
                  required
                  maxLength={90}
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Ej: Nuevos Spots 3-Bet Disponibles"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Audiencia</label>
                  <select
                    value={annTargetPlan}
                    onChange={(e) => setAnnTargetPlan(e.target.value as AnnouncementTargetPlan)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-2 text-white outline-none"
                  >
                    <option value="all">Todos los Planes</option>
                    <option value="free">Solo Free</option>
                    <option value="pro">Solo Pro</option>
                    <option value="elite">Solo Elite</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Tipo</label>
                  <select
                    value={annSeverity}
                    onChange={(e) => setAnnSeverity(e.target.value as AnnouncementSeverity)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-2 text-white outline-none"
                  >
                    <option value="info">Informativo</option>
                    <option value="success">Novedad / Éxito</option>
                    <option value="warning">Aviso Importante</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold block">Mensaje Visible para el Estudiante</label>
              <textarea
                required
                rows={2}
                maxLength={300}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Escribe un mensaje claro y directo..."
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingAnn}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{savingAnn ? 'Publicando...' : 'Publicar Anuncio en Vivo'}</span>
            </button>
          </form>

          <div className="space-y-2.5">
            {announcements.length === 0 ? (
              <p className="text-neutral-500 py-4 text-center">No hay anuncios creados todavía.</p>
            ) : (
              announcements.map(ann => (
                <div key={ann.id} className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{ann.title}</span>
                        <span className="font-mono text-[10px] text-neutral-400">
                          · {ann.targetPlan.toUpperCase()} · {ann.active ? 'VISIBLE' : 'PAUSADO'}
                        </span>
                      </div>
                      <p className="text-neutral-300 mt-1">{ann.message}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === ann.id}
                        onClick={() => void handleToggleAnn(ann)}
                        className="p-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg cursor-pointer"
                        title={ann.active ? 'Pausar anuncio' : 'Activar anuncio'}
                      >
                        {ann.active ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-500" />}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === ann.id}
                        onClick={() => void handleDeleteAnn(ann)}
                        className="p-1.5 bg-neutral-950 hover:bg-rose-950 border border-neutral-800 hover:border-rose-700 text-neutral-400 hover:text-rose-300 rounded-lg cursor-pointer"
                        title="Eliminar anuncio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: SUPPORT TICKETS */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-emerald-400" />
              <span>Soporte y Tickets de Alumnos</span>
            </h2>
            <p className="text-neutral-400 mt-0.5">
              Atiende solicitudes enviadas desde el Aula Educativo o registra notas de seguimiento por alumno.
            </p>
          </div>

          <form onSubmit={(e) => void handleCreateTicket(e)} className="space-y-3 p-4 bg-neutral-900/70 border border-neutral-800 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-neutral-300 font-semibold block">Alumno</label>
                <select
                  value={ticketUserUid}
                  onChange={(e) => setTicketUserUid(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-2 text-white outline-none"
                >
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName}
                    </option>
                  ))}
                  {users.length === 0 && <option value="system_note">General</option>}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-neutral-300 font-semibold block">Categoría</label>
                <select
                  value={ticketCat}
                  onChange={(e) => setTicketCat(e.target.value as TicketCategory)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-2 text-white outline-none"
                >
                  <option value="Acceso">Acceso / Cuenta</option>
                  <option value="Pagos">Pagos / Plan</option>
                  <option value="Duda Técnica">Duda Técnica</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-neutral-300 font-semibold block">Prioridad</label>
                <select
                  value={ticketPrio}
                  onChange={(e) => setTicketPrio(e.target.value as TicketPriority)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-2 text-white outline-none"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>

            <input
              type="text"
              required
              maxLength={120}
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Asunto breve (ej: Activar plan Pro tras transferencia)"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white outline-none"
            />

            <textarea
              required
              rows={2}
              maxLength={600}
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
              placeholder="Detalle de la solicitud o seguimiento..."
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-xl px-3 py-2 text-white outline-none resize-none"
            />

            <button
              type="submit"
              disabled={savingTicket}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{savingTicket ? 'Guardando...' : 'Crear Ticket de Seguimiento'}</span>
            </button>
          </form>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {tickets.length === 0 ? (
              <p className="text-neutral-500 py-4 text-center">Sin tickets de soporte pendientes.</p>
            ) : (
              tickets.map(t => {
                const noteDraft = editingNotes[t.id] ?? t.adminNotes;
                return (
                  <div key={t.id} className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">{t.subject}</div>
                        <div className="text-[11px] text-neutral-400">
                          {t.userName} ({t.userEmail}) · {t.category} · Prioridad {t.priority.toUpperCase()}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] flex items-center gap-1 shrink-0">
                        {t.status === 'resolved' ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resuelto
                          </span>
                        ) : t.status === 'in_progress' ? (
                          <span className="text-blue-400 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> En Curso
                          </span>
                        ) : (
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Abierto
                          </span>
                        )}
                      </span>
                    </div>

                    <p className="text-neutral-300">{t.description}</p>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        maxLength={400}
                        value={noteDraft}
                        onChange={(e) => setEditingNotes(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Respuesta / Nota administrativa..."
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.status !== 'resolved' && (
                          <button
                            type="button"
                            disabled={busyId === t.id}
                            onClick={() => void handleSaveTicketState(t, 'resolved', t.priority)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer"
                          >
                            Resolver
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => void handleSaveTicketState(t, t.status === 'open' ? 'in_progress' : t.status, t.priority)}
                          className="p-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-blue-300 rounded-lg cursor-pointer"
                          title="Guardar nota"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => void handleDeleteTicket(t)}
                          className="p-1.5 bg-neutral-950 hover:bg-rose-950 border border-neutral-800 hover:border-rose-700 text-neutral-400 hover:text-rose-300 rounded-lg cursor-pointer"
                          title="Eliminar ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
