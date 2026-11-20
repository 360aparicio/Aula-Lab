/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AdminDashboard (Allin Studio Admin · allin-studio-admin):
 * Consola SaaS Completa con Arquitectura de Barra Lateral + 7 Secciones Lógicas Claras:
 * 1. Inicio (Resumen Ejecutivo + Acciones Rápidas)
 * 2. Usuarios y Permisos (Altas Manuales, Planes, Acciones Masivas, Inspector SM-2/ELO)
 * 3. Registros e Invitaciones (/userInvites + Ingresos Recientes)
 * 4. Ingresos y Facturación (/billingTransactions + D3 Revenue + MRR)
 * 5. Planes, Secciones y Beneficios (/planConfigs en vivo)
 * 6. Soporte y Anuncios en Vivo (/platformAnnouncements + /supportTickets)
 * 7. Analítica D3, Backend Express (/api/admin/system-info) y Auditoría Inmutable (/adminAuditLogs)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import {
  fetchAllUsersForAdmin,
  fetchUserDetailsForAdmin,
  adminUpdateUserPlan,
  fetchAdminAuditLogs,
  fetchDatabaseUsageMetricsForAdmin,
  fetchUserInvitesForAdmin,
  fetchBillingTransactionsForAdmin,
  fetchAnnouncementsForAdmin,
  fetchSupportTicketsForAdmin,
  computeMonthlyCohorts,
  defaultEvaluationStats,
  BOOTSTRAPPED_ADMIN_EMAIL,
  adminCreateOrUpdateManualUser,
  adminDeleteManualUser,
  type UserProfileDoc,
  type AdminUserDetails,
  type AdminAuditLogEntry,
  type DatabaseUsageMetrics,
  type UserInviteEntry,
  type BillingTransactionEntry,
  type PlatformAnnouncementEntry,
  type SupportTicketEntry,
  type DifficultyLevel,
  type UserRole
} from '../lib/adminCloudSync';
import {
  getDefaultPlanPermissions,
  getLabAppUrl,
  type PlanPermissions,
  type PlanTier
} from '../lib/planCatalog';
import { useAdminAuth } from '../context/AdminAuthContext';
import { PlanCatalogManager } from './PlanCatalogManager';
import { BillingRevenuePanel } from './BillingRevenuePanel';
import { OnboardingInvitesPanel } from './OnboardingInvitesPanel';
import { SupportAnnouncementsPanel } from './SupportAnnouncementsPanel';
import { MarketStudyAdminPanel } from './MarketStudyAdminPanel';
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  X,
  Crown,
  AlertTriangle,
  Brain,
  ClipboardCheck,
  Compass,
  ExternalLink,
  BarChart3,
  Globe,
  Activity,
  FileText,
  Download,
  RotateCcw,
  CheckSquare,
  Square,
  GraduationCap,
  Database,
  Server,
  KeyRound,
  HardDrive,
  UserPlus,
  Trash2,
  Layers,
  LogOut,
  DollarSign,
  MailCheck,
  LifeBuoy,
  ArrowRight,
  FlaskConical
} from 'lucide-react';

type AdminSection =
  | 'overview'
  | 'users'
  | 'onboarding'
  | 'billing'
  | 'plans'
  | 'support'
  | 'study'
  | 'system';

interface SolverMetaRule {
  id: string;
  topic: string;
  street: string;
  texture: string;
  recommendedAction: string;
  sizingPctPot: number;
  gtoFrequencyPct: number;
  exploitativeAdjustment: string;
}

interface SolverMetaState {
  version: string;
  totalUserSamplesLearned: number;
  internetQuerySummary: string;
  rules: SolverMetaRule[];
}

interface ServerRuntimeInfo {
  status: string;
  service: string;
  nodeVersion?: string;
  uptimeSeconds?: number;
  memoryRssMB?: number;
  env?: string;
  geminiConfigured?: boolean;
  firebaseProjectId?: string;
  firestoreDatabaseId?: string;
  latencyMs: number;
}

const EDUCATIONAL_LEVELS_META: Array<{ level: DifficultyLevel; name: string }> = [
  { level: 1, name: 'Nivel 1 · Cimientos Sólidos (NL2–NL5)' },
  { level: 2, name: 'Nivel 2 · Regulares Low-Stakes (NL10–NL25)' },
  { level: 3, name: 'Nivel 3 · Mid-Stakes Nash (NL50)' },
  { level: 4, name: 'Nivel 4 · High-Stakes & Élite (NL100+)' }
];

const PERMISSION_ITEMS: Array<{ key: keyof PlanPermissions; short: string; label: string; desc: string }> = [
  { key: 'labPro', short: 'Lab', label: 'Laboratorio Pro', desc: 'Árbol Nash completo, rangos 13×13 y Práctica multi-calle' },
  { key: 'webBrain', short: 'Web', label: 'Cerebro Web', desc: 'Sincronización con meta-reglas de internet y coach adaptativo' },
  { key: 'unlimitedEval', short: 'Eval', label: 'Eval. Ilimitadas', desc: 'Exámenes sin límite diario en Niveles 1–4, Temas y Spots' },
  { key: 'pdfExport', short: 'PDF', label: 'Exportar PDF', desc: 'Descarga de reportes de progreso y Manual 6-Max en PDF' },
  { key: 'planAdmin', short: 'Admin', label: 'Admin del Plan', desc: 'Permite cambiar entre Vista Usuario y Panel Administrador' }
];

const NAV_SECTIONS: Array<{ id: AdminSection; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Inicio', hint: 'Resumen y guía rápida', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'users', label: 'Usuarios', hint: 'Cuentas y permisos', icon: <Users className="w-4 h-4" /> },
  { id: 'onboarding', label: 'Registros e Ingresos', hint: 'Invitaciones y altas', icon: <MailCheck className="w-4 h-4" /> },
  { id: 'billing', label: 'Ingresos y Pagos', hint: 'MRR, cobros y CSV', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'plans', label: 'Planes y Secciones', hint: 'Catálogo en vivo', icon: <Layers className="w-4 h-4" /> },
  { id: 'support', label: 'Soporte y Anuncios', hint: 'Avisos y tickets', icon: <LifeBuoy className="w-4 h-4" /> },
  { id: 'study', label: 'Estudio 300', hint: 'Flag, FISH/REG/NIT, NPS', icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'system', label: 'Analítica y Backend', hint: 'D3, BD, API y logs', icon: <BarChart3 className="w-4 h-4" /> }
];

function formatAuditTimestamp(ts: unknown): string {
  if (!ts) return 'Reciente';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleString('es-ES');
  }
  if (typeof ts === 'number') {
    return new Date(ts).toLocaleString('es-ES');
  }
  return 'Sincronizado';
}

export const AdminDashboard: React.FC = () => {
  const { user: currentUser, signOutAdmin, getIdToken } = useAdminAuth();
  const labUrl = getLabAppUrl();

  const [section, setSection] = useState<AdminSection>('overview');
  const [users, setUsers] = useState<UserProfileDoc[]>([]);
  const [invites, setInvites] = useState<UserInviteEntry[]>([]);
  const [transactions, setTransactions] = useState<BillingTransactionEntry[]>([]);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncementEntry[]>([]);
  const [tickets, setTickets] = useState<SupportTicketEntry[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  // Manual User Creation Modal
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [creatingManualUser, setCreatingManualUser] = useState<boolean>(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserTier, setNewUserTier] = useState<PlanTier>('pro');
  const [newUserActive, setNewUserActive] = useState<boolean>(true);
  const [newUserPerms, setNewUserPerms] = useState<PlanPermissions>(() => getDefaultPlanPermissions('pro', false));

  // User Filters & Multi-Select
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | PlanTier>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | DifficultyLevel>('all');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [bulkTier, setBulkTier] = useState<PlanTier>('pro');

  // User Inspector Modal
  const [selectedDetails, setSelectedDetails] = useState<AdminUserDetails | null>(null);
  const [loadingDetailsUid, setLoadingDetailsUid] = useState<string | null>(null);

  // Audit Logs & Backend Runtime
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [runtimeInfo, setRuntimeInfo] = useState<ServerRuntimeInfo | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(false);
  const [metaState, setMetaState] = useState<SolverMetaState>({
    version: '1.0.0-admin',
    totalUserSamplesLearned: 42,
    internetQuerySummary: 'Base Nash 6-Max conectada.',
    rules: []
  });
  const [syncTopic, setSyncTopic] = useState('NL2-NL100 6-Max Nash trends C-bet and 3-bet defense');
  const [syncingInternet, setSyncingInternet] = useState<boolean>(false);

  // Database Usage & Growth Metrics
  const [dbMetrics, setDbMetrics] = useState<DatabaseUsageMetrics | null>(null);
  const [loadingDbMetrics, setLoadingDbMetrics] = useState<boolean>(false);

  // D3 Refs
  const levelChartRef = useRef<SVGSVGElement | null>(null);
  const planChartRef = useRef<SVGSVGElement | null>(null);
  const growthChartRef = useRef<SVGSVGElement | null>(null);
  const retentionChartRef = useRef<SVGSVGElement | null>(null);
  const dbUsageChartRef = useRef<SVGSVGElement | null>(null);

  const instantCohortSummary = useMemo(() => computeMonthlyCohorts(users), [users]);

  const showSuccess = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const loadAllCoreData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [userList, inviteList, txList, annList, ticketList] = await Promise.all([
        fetchAllUsersForAdmin(),
        fetchUserInvitesForAdmin().catch(() => [] as UserInviteEntry[]),
        fetchBillingTransactionsForAdmin().catch(() => [] as BillingTransactionEntry[]),
        fetchAnnouncementsForAdmin().catch(() => [] as PlatformAnnouncementEntry[]),
        fetchSupportTicketsForAdmin().catch(() => [] as SupportTicketEntry[])
      ]);
      setUsers(userList);
      setInvites(inviteList);
      setTransactions(txList);
      setAnnouncements(annList);
      setTickets(ticketList);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error cargando datos administrativos desde Firestore.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDbMetrics = useCallback(async (userList: UserProfileDoc[]) => {
    setLoadingDbMetrics(true);
    try {
      const metrics = await fetchDatabaseUsageMetricsForAdmin(userList);
      setDbMetrics(metrics);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudieron leer métricas de uso de Firestore.');
    } finally {
      setLoadingDbMetrics(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const logs = await fetchAdminAuditLogs(60);
      setAuditLogs(logs);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudieron cargar los registros de auditoría.');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const checkServerDiagnostics = useCallback(async () => {
    setCheckingHealth(true);
    const t0 = performance.now();
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/admin/system-info', { headers });
      if (res.ok) {
        const data = await res.json();
        setRuntimeInfo({
          status: String(data?.status || 'ok'),
          service: String(data?.service || 'allin-studio-admin'),
          nodeVersion: data?.nodeVersion,
          uptimeSeconds: data?.uptimeSeconds,
          memoryRssMB: data?.memoryRssMB,
          env: data?.env,
          geminiConfigured: Boolean(data?.geminiConfigured),
          firebaseProjectId: data?.firebaseProjectId,
          firestoreDatabaseId: data?.firestoreDatabaseId,
          latencyMs: Math.round(performance.now() - t0)
        });
      } else {
        const hRes = await fetch('/api/health');
        const hData = await hRes.json();
        setRuntimeInfo({
          status: String(hData?.status || 'ok'),
          service: String(hData?.service || 'allin-studio-admin'),
          latencyMs: Math.round(performance.now() - t0)
        });
      }
    } catch {
      setRuntimeInfo({
        status: 'offline',
        service: 'allin-studio-admin',
        latencyMs: 0
      });
    } finally {
      setCheckingHealth(false);
    }
  }, [getIdToken]);

  const fetchSolverMetaFromServer = useCallback(async () => {
    try {
      const res = await fetch('/api/solver/meta');
      if (res.ok) {
        const data = (await res.json()) as SolverMetaState;
        if (data && Array.isArray(data.rules)) {
          setMetaState(data);
        }
      }
    } catch {
      // Static-only fallback
    }
  }, []);

  useEffect(() => {
    void loadAllCoreData();
  }, [loadAllCoreData]);

  useEffect(() => {
    if (section === 'system') {
      void loadAuditLogs();
      void checkServerDiagnostics();
      void fetchSolverMetaFromServer();
      void loadDbMetrics(users);
    } else if (section === 'overview') {
      void checkServerDiagnostics();
    }
  }, [section, users, loadAuditLogs, checkServerDiagnostics, fetchSolverMetaFromServer, loadDbMetrics]);

  const kpis = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.planActive).length;
    const inactive = total - active;
    const proActive = users.filter(u => u.planActive && u.planTier === 'pro').length;
    const eliteActive = users.filter(u => u.planActive && u.planTier === 'elite').length;
    const estimatedMrr = proActive * 29 + eliteActive * 79;
    const collectedUsd = transactions.filter(t => t.status === 'paid').reduce((s, t) => s + t.amountUsd, 0);
    const pendingInvites = invites.filter(i => i.status === 'pending').length;
    const openTickets = tickets.filter(t => t.status !== 'resolved').length;
    const totalMistakes = users.reduce((sum, u) => sum + (u.totalMistakes || 0), 0);
    const avgElo = total > 0 ? Math.round(users.reduce((sum, u) => sum + (u.elo || 1200), 0) / total) : 1200;

    return {
      total,
      active,
      inactive,
      paidUsers: proActive + eliteActive,
      estimatedMrr,
      collectedUsd: Math.round(collectedUsd * 100) / 100,
      pendingInvites,
      openTickets,
      totalMistakes,
      avgElo
    };
  }, [users, transactions, invites, tickets]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter(u => {
      if (planFilter !== 'all' && u.planTier !== planFilter) return false;
      if (statusFilter === 'active' && !u.planActive) return false;
      if (statusFilter === 'inactive' && u.planActive) return false;
      const isUserPlanAdmin = u.role === 'admin' || u.planPermissions?.planAdmin === true;
      if (roleFilter === 'admin' && !isUserPlanAdmin) return false;
      if (roleFilter === 'user' && isUserPlanAdmin) return false;
      const lvl = u.evaluationStats?.unlockedLevel || 1;
      if (levelFilter !== 'all' && lvl !== levelFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [users, searchTerm, planFilter, statusFilter, roleFilter, levelFilter]);

  const globalCategorySummary = useMemo(() => {
    const agg: Record<string, { attempts: number; correct: number }> = {};
    for (const u of users) {
      for (const [cat, stat] of Object.entries(u.categoryStats || {})) {
        if (!agg[cat]) agg[cat] = { attempts: 0, correct: 0 };
        agg[cat].attempts += stat.attempts || 0;
        agg[cat].correct += stat.correct || 0;
      }
      for (const [cat, stat] of Object.entries(u.evaluationStats?.categoryPerf || {})) {
        if (!agg[cat]) agg[cat] = { attempts: 0, correct: 0 };
        agg[cat].attempts += stat.attempts || 0;
        agg[cat].correct += stat.correct || 0;
      }
    }
    return Object.entries(agg)
      .map(([category, stat]) => ({
        category,
        attempts: stat.attempts,
        correct: stat.correct,
        accuracy: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [users]);

  // Render D3.js Charts for Analytics & Overview
  useEffect(() => {
    if (section !== 'system' && section !== 'overview') return;

    const cohorts = dbMetrics?.monthlyCohorts || instantCohortSummary.cohorts;

    if (growthChartRef.current) {
      const svg = d3.select(growthChartRef.current);
      svg.selectAll('*').remove();

      const width = 440;
      const height = 210;
      const margin = { top: 22, right: 20, bottom: 30, left: 36 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const g = svg
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const xBand = d3.scaleBand().domain(cohorts.map(d => d.label)).range([0, innerW]).padding(0.35);
      const maxUsers = Math.max(3, d3.max(cohorts, d => d.cumulativeUsers) || 3);
      const y = d3.scaleLinear().domain([0, maxUsers]).nice().range([innerH, 0]);

      g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xBand)).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '10px');
      g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d'))).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '10px');
      g.selectAll('.domain, .tick line').attr('stroke', '#262626');

      g.selectAll('.new-bar')
        .data(cohorts)
        .enter()
        .append('rect')
        .attr('x', d => xBand(d.label) || 0)
        .attr('y', d => y(d.newUsers))
        .attr('width', xBand.bandwidth())
        .attr('height', d => Math.max(2, innerH - y(d.newUsers)))
        .attr('rx', 4)
        .attr('fill', '#1d4ed8')
        .attr('opacity', 0.45);

      const area = d3.area<typeof cohorts[0]>().x(d => (xBand(d.label) || 0) + xBand.bandwidth() / 2).y0(innerH).y1(d => y(d.cumulativeUsers)).curve(d3.curveMonotoneX);
      g.append('path').datum(cohorts).attr('fill', 'rgba(59, 130, 246, 0.16)').attr('d', area);

      const line = d3.line<typeof cohorts[0]>().x(d => (xBand(d.label) || 0) + xBand.bandwidth() / 2).y(d => y(d.cumulativeUsers)).curve(d3.curveMonotoneX);
      g.append('path').datum(cohorts).attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2.5).attr('d', line);

      g.selectAll('.growth-dot').data(cohorts).enter().append('circle').attr('cx', d => (xBand(d.label) || 0) + xBand.bandwidth() / 2).attr('cy', d => y(d.cumulativeUsers)).attr('r', 4).attr('fill', '#60a5fa').attr('stroke', '#000').attr('stroke-width', 1.5);
      g.selectAll('.growth-label').data(cohorts).enter().append('text').attr('x', d => (xBand(d.label) || 0) + xBand.bandwidth() / 2).attr('y', d => y(d.cumulativeUsers) - 8).attr('text-anchor', 'middle').attr('fill', '#e5e5e5').style('font-size', '10px').style('font-weight', '700').text(d => d.cumulativeUsers);
    }

    if (retentionChartRef.current) {
      const svg = d3.select(retentionChartRef.current);
      svg.selectAll('*').remove();

      const width = 440;
      const height = 210;
      const margin = { top: 22, right: 20, bottom: 30, left: 40 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const g = svg.attr('viewBox', `0 0 ${width} ${height}`).append('g').attr('transform', `translate(${margin.left},${margin.top})`);
      const xBand = d3.scaleBand().domain(cohorts.map(d => d.label)).range([0, innerW]).padding(0.25);
      const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

      g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xBand)).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '10px');
      g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`)).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '10px');
      g.selectAll('.domain, .tick line').attr('stroke', '#262626');

      g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', y(70)).attr('y2', y(70)).attr('stroke', '#f59e0b').attr('stroke-dasharray', '4 4').attr('stroke-width', 1.2).attr('opacity', 0.8);
      g.append('text').attr('x', innerW - 2).attr('y', y(70) - 4).attr('text-anchor', 'end').attr('fill', '#fbbf24').style('font-size', '9px').text('Meta 70%');

      const area = d3.area<typeof cohorts[0]>().x(d => (xBand(d.label) || 0) + xBand.bandwidth() / 2).y0(innerH).y1(d => y(d.retentionPct)).curve(d3.curveMonotoneX);
      g.append('path').datum(cohorts).attr('fill', 'rgba(16, 185, 129, 0.16)').attr('d', area);

      const line = d3.line<typeof cohorts[0]>().x(d => (xBand(d.label) || 0) + xBand.bandwidth() / 2).y(d => y(d.retentionPct)).curve(d3.curveMonotoneX);
      g.append('path').datum(cohorts).attr('fill', 'none').attr('stroke', '#10b981').attr('stroke-width', 2.5).attr('d', line);

      g.selectAll('.ret-dot').data(cohorts).enter().append('circle').attr('cx', d => (xBand(d.label) || 0) + xBand.bandwidth() / 2).attr('cy', d => y(d.retentionPct)).attr('r', 4).attr('fill', '#34d399').attr('stroke', '#000').attr('stroke-width', 1.5);
      g.selectAll('.ret-label').data(cohorts).enter().append('text').attr('x', d => (xBand(d.label) || 0) + xBand.bandwidth() / 2).attr('y', d => Math.max(12, y(d.retentionPct) - 8)).attr('text-anchor', 'middle').attr('fill', '#6ee7b7').style('font-size', '10px').style('font-weight', '700').text(d => `${d.retentionPct}%`);
    }

    if (section !== 'system') return;

    if (levelChartRef.current) {
      const svg = d3.select(levelChartRef.current);
      svg.selectAll('*').remove();
      const levelCounts = [1, 2, 3, 4].map(lvl => ({
        label: `Nivel ${lvl}`,
        count: users.filter(u => (u.evaluationStats?.unlockedLevel || 1) === lvl).length
      }));
      const width = 420;
      const height = 200;
      const margin = { top: 20, right: 16, bottom: 30, left: 36 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;
      const g = svg.attr('viewBox', `0 0 ${width} ${height}`).append('g').attr('transform', `translate(${margin.left},${margin.top})`);
      const x = d3.scaleBand().domain(levelCounts.map(d => d.label)).range([0, innerW]).padding(0.32);
      const maxVal = Math.max(2, d3.max(levelCounts, d => d.count) || 2);
      const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]);
      g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x)).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '11px');
      g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d'))).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '11px');
      g.selectAll('.domain, .tick line').attr('stroke', '#262626');
      const colors = ['#60a5fa', '#34d399', '#fbbf24', '#c084fc'];
      g.selectAll('rect').data(levelCounts).enter().append('rect').attr('x', d => x(d.label) || 0).attr('y', d => y(d.count)).attr('width', x.bandwidth()).attr('height', d => Math.max(2, innerH - y(d.count))).attr('rx', 6).attr('fill', (_, i) => colors[i % colors.length]);
      g.selectAll('.val-label').data(levelCounts).enter().append('text').attr('x', d => (x(d.label) || 0) + x.bandwidth() / 2).attr('y', d => y(d.count) - 5).attr('text-anchor', 'middle').attr('fill', '#e5e5e5').style('font-size', '11px').style('font-weight', '700').text(d => d.count);
    }

    if (planChartRef.current) {
      const svg = d3.select(planChartRef.current);
      svg.selectAll('*').remove();
      const planCounts = [
        { label: 'FREE', count: users.filter(u => u.planTier === 'free' && u.planActive).length, color: '#737373' },
        { label: 'PRO', count: users.filter(u => u.planTier === 'pro' && u.planActive).length, color: '#3b82f6' },
        { label: 'ELITE', count: users.filter(u => u.planTier === 'elite' && u.planActive).length, color: '#f59e0b' },
        { label: 'PAUSADOS', count: users.filter(u => !u.planActive).length, color: '#f43f5e' }
      ];
      const width = 420;
      const height = 200;
      const margin = { top: 20, right: 16, bottom: 30, left: 36 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;
      const g = svg.attr('viewBox', `0 0 ${width} ${height}`).append('g').attr('transform', `translate(${margin.left},${margin.top})`);
      const x = d3.scaleBand().domain(planCounts.map(d => d.label)).range([0, innerW]).padding(0.32);
      const maxVal = Math.max(2, d3.max(planCounts, d => d.count) || 2);
      const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]);
      g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x)).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '11px');
      g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d'))).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '11px');
      g.selectAll('.domain, .tick line').attr('stroke', '#262626');
      g.selectAll('rect').data(planCounts).enter().append('rect').attr('x', d => x(d.label) || 0).attr('y', d => y(d.count)).attr('width', x.bandwidth()).attr('height', d => Math.max(2, innerH - y(d.count))).attr('rx', 6).attr('fill', d => d.color);
      g.selectAll('.val-label').data(planCounts).enter().append('text').attr('x', d => (x(d.label) || 0) + x.bandwidth() / 2).attr('y', d => y(d.count) - 5).attr('text-anchor', 'middle').attr('fill', '#e5e5e5').style('font-size', '11px').style('font-weight', '700').text(d => d.count);
    }

    if (dbUsageChartRef.current) {
      const svg = d3.select(dbUsageChartRef.current);
      svg.selectAll('*').remove();
      const cols = dbMetrics?.collections || [
        { collection: 'users', label: 'Perfiles (/users)', documents: users.length, estimatedKB: Math.round(users.length * 1.8 * 10) / 10 },
        { collection: 'planConfigs', label: 'Planes (/planConfigs)', documents: 3, estimatedKB: 3.6 }
      ];
      const width = 460;
      const height = 240;
      const margin = { top: 12, right: 92, bottom: 26, left: 175 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;
      const g = svg.attr('viewBox', `0 0 ${width} ${height}`).append('g').attr('transform', `translate(${margin.left},${margin.top})`);
      const yBand = d3.scaleBand().domain(cols.map(c => c.label)).range([0, innerH]).padding(0.28);
      const maxDocs = Math.max(4, d3.max(cols, c => c.documents) || 4);
      const x = d3.scaleLinear().domain([0, maxDocs]).nice().range([0, innerW]);
      g.append('g').call(d3.axisLeft(yBand)).selectAll('text').attr('fill', '#d4d4d4').style('font-size', '10px');
      g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('d'))).selectAll('text').attr('fill', '#a3a3a3').style('font-size', '10px');
      g.selectAll('.domain, .tick line').attr('stroke', '#262626');
      const barColors = ['#3b82f6', '#06b6d4', '#f43f5e', '#f59e0b', '#10b981', '#22c55e', '#8b5cf6', '#ec4899', '#64748b'];
      g.selectAll('.db-bar').data(cols).enter().append('rect').attr('y', d => yBand(d.label) || 0).attr('x', 0).attr('height', yBand.bandwidth()).attr('width', d => Math.max(4, x(d.documents))).attr('rx', 4).attr('fill', (_, i) => barColors[i % barColors.length]);
      g.selectAll('.db-val').data(cols).enter().append('text').attr('x', d => Math.max(4, x(d.documents)) + 6).attr('y', d => (yBand(d.label) || 0) + yBand.bandwidth() / 2 + 4).attr('fill', '#e5e5e5').style('font-size', '9.5px').style('font-family', 'monospace').style('font-weight', '700').text(d => `${d.documents} (${d.estimatedKB} KB)`);
    }
  }, [section, users, dbMetrics, instantCohortSummary]);

  const isProtectedPrimaryAdmin = (target: UserProfileDoc) =>
    target.uid === currentUser?.uid || target.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

  const handleTogglePlanActive = async (target: UserProfileDoc) => {
    if (target.uid === currentUser?.uid && target.role === 'admin') {
      setErrorMsg('Por seguridad, no puedes desactivar tu propia cuenta administradora.');
      return;
    }
    const nextActive = !target.planActive;
    setBusyUid(target.uid);
    setErrorMsg(null);
    try {
      await adminUpdateUserPlan(
        target.uid,
        { planActive: nextActive },
        {
          targetLabel: target.email || target.displayName,
          action: nextActive ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED',
          detail: `Plan cambiado a ${nextActive ? 'ACTIVO' : 'INACTIVO'} (${target.planTier.toUpperCase()})`
        }
      );
      setUsers(prev => prev.map(u => (u.uid === target.uid ? { ...u, planActive: nextActive } : u)));
      if (selectedDetails?.profile.uid === target.uid) {
        setSelectedDetails(prev => (prev ? { ...prev, profile: { ...prev.profile, planActive: nextActive } } : null));
      }
      showSuccess(`Plan de ${target.displayName || target.email} ${nextActive ? 'ACTIVADO' : 'PAUSADO'}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar el estado del plan.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleChangePlanTier = async (target: UserProfileDoc, newTier: PlanTier) => {
    setBusyUid(target.uid);
    setErrorMsg(null);
    const keepsAdmin = target.role === 'admin' || target.planPermissions?.planAdmin === true;
    const nextPermissions = getDefaultPlanPermissions(newTier, keepsAdmin);
    try {
      await adminUpdateUserPlan(
        target.uid,
        { planTier: newTier, planPermissions: nextPermissions },
        {
          targetLabel: target.email || target.displayName,
          action: 'PLAN_TIER_CHANGED',
          detail: `Plan cambiado de ${target.planTier.toUpperCase()} a ${newTier.toUpperCase()}`
        }
      );
      setUsers(prev =>
        prev.map(u => (u.uid === target.uid ? { ...u, planTier: newTier, planPermissions: nextPermissions } : u))
      );
      if (selectedDetails?.profile.uid === target.uid) {
        setSelectedDetails(prev =>
          prev ? { ...prev, profile: { ...prev.profile, planTier: newTier, planPermissions: nextPermissions } } : null
        );
      }
      showSuccess(`Plan de ${target.displayName || target.email} cambiado a ${newTier.toUpperCase()}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar el plan.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleTogglePermission = async (target: UserProfileDoc, permKey: keyof PlanPermissions) => {
    const currentPerms = target.planPermissions || getDefaultPlanPermissions(target.planTier, target.role === 'admin');
    const nextValue = !currentPerms[permKey];
    if (permKey === 'planAdmin' && !nextValue && isProtectedPrimaryAdmin(target)) {
      setErrorMsg('Por seguridad, no puedes revocar tu propio permiso de Administrador.');
      return;
    }

    setBusyUid(target.uid);
    setErrorMsg(null);
    const nextPerms: PlanPermissions = { ...currentPerms, [permKey]: nextValue };
    const nextRole: UserRole | undefined = permKey === 'planAdmin' ? (nextValue ? 'admin' : 'user') : undefined;
    const meta = PERMISSION_ITEMS.find(p => p.key === permKey);
    try {
      await adminUpdateUserPlan(
        target.uid,
        { planPermissions: nextPerms, ...(nextRole ? { role: nextRole } : {}) },
        {
          targetLabel: target.email || target.displayName,
          action: permKey === 'planAdmin' ? (nextValue ? 'PLAN_ADMIN_GRANTED' : 'PLAN_ADMIN_REVOKED') : 'PLAN_PERMISSION_UPDATED',
          detail: `Permiso "${meta?.label || permKey}" marcado ${nextValue ? 'ON' : 'OFF'}`
        }
      );
      setUsers(prev =>
        prev.map(u =>
          u.uid === target.uid ? { ...u, planPermissions: nextPerms, ...(nextRole ? { role: nextRole } : {}) } : u
        )
      );
      if (selectedDetails?.profile.uid === target.uid) {
        setSelectedDetails(prev =>
          prev
            ? { ...prev, profile: { ...prev.profile, planPermissions: nextPerms, ...(nextRole ? { role: nextRole } : {}) } }
            : null
        );
      }
      showSuccess(`Permiso ${meta?.label || permKey} actualizado para ${target.displayName}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar el permiso.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleRole = async (target: UserProfileDoc) => {
    if (isProtectedPrimaryAdmin(target)) {
      setErrorMsg('Cuenta Administradora principal protegida.');
      return;
    }
    const nextRole: UserRole = target.role === 'admin' ? 'user' : 'admin';
    const currentPerms = target.planPermissions || getDefaultPlanPermissions(target.planTier, target.role === 'admin');
    const nextPerms: PlanPermissions = { ...currentPerms, planAdmin: nextRole === 'admin' };
    setBusyUid(target.uid);
    setErrorMsg(null);
    try {
      await adminUpdateUserPlan(
        target.uid,
        { role: nextRole, planPermissions: nextPerms },
        {
          targetLabel: target.email || target.displayName,
          action: nextRole === 'admin' ? 'ROLE_PROMOTED_ADMIN' : 'ROLE_SET_USER',
          detail: `Rol actualizado a ${nextRole.toUpperCase()}`
        }
      );
      setUsers(prev =>
        prev.map(u => (u.uid === target.uid ? { ...u, role: nextRole, planPermissions: nextPerms } : u))
      );
      showSuccess(`Rol de ${target.displayName} cambiado a ${nextRole.toUpperCase()}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar el rol.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleResetProgress = async (target: UserProfileDoc) => {
    setBusyUid(target.uid);
    setErrorMsg(null);
    const freshEval = defaultEvaluationStats();
    try {
      await adminUpdateUserPlan(
        target.uid,
        { elo: 1200, evaluationStats: freshEval },
        {
          targetLabel: target.email || target.displayName,
          action: 'PROGRESS_RESET',
          detail: 'Reiniciado ELO a 1200 y Niveles Educativos (Nivel 1, 0 XP)'
        }
      );
      setUsers(prev =>
        prev.map(u => (u.uid === target.uid ? { ...u, elo: 1200, evaluationStats: freshEval } : u))
      );
      showSuccess(`Progreso reiniciado para ${target.displayName}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo reiniciar el progreso.');
    } finally {
      setBusyUid(null);
    }
  };

  const toggleSelectUid = (uid: string) => {
    setSelectedUids(prev => (prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]));
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredUsers.map(u => u.uid);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedUids.includes(id));
    if (allSelected) {
      setSelectedUids(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedUids(Array.from(new Set([...selectedUids, ...filteredIds])));
    }
  };

  const handleBulkActivate = async (active: boolean) => {
    const targets = users.filter(
      u => selectedUids.includes(u.uid) && !(u.uid === currentUser?.uid && u.role === 'admin')
    );
    if (targets.length === 0) return;
    setBulkBusy(true);
    setErrorMsg(null);
    try {
      for (const t of targets) {
        await adminUpdateUserPlan(
          t.uid,
          { planActive: active },
          {
            targetLabel: t.email || t.displayName,
            action: active ? 'BULK_ACTIVATED' : 'BULK_DEACTIVATED',
            detail: `Acción masiva: plan marcado ${active ? 'ACTIVO' : 'INACTIVO'}`
          }
        );
      }
      const targetIds = new Set(targets.map(t => t.uid));
      setUsers(prev => prev.map(u => (targetIds.has(u.uid) ? { ...u, planActive: active } : u)));
      showSuccess(`${targets.length} usuario(s) actualizados.`);
      setSelectedUids([]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error en actualización masiva.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkTier = async () => {
    const targets = users.filter(u => selectedUids.includes(u.uid));
    if (targets.length === 0) return;
    setBulkBusy(true);
    setErrorMsg(null);
    try {
      for (const t of targets) {
        await adminUpdateUserPlan(
          t.uid,
          { planTier: bulkTier },
          {
            targetLabel: t.email || t.displayName,
            action: 'BULK_TIER_CHANGED',
            detail: `Acción masiva: plan asignado a ${bulkTier.toUpperCase()}`
          }
        );
      }
      const targetIds = new Set(targets.map(t => t.uid));
      setUsers(prev => prev.map(u => (targetIds.has(u.uid) ? { ...u, planTier: bulkTier } : u)));
      showSuccess(`${targets.length} usuario(s) movidos al plan ${bulkTier.toUpperCase()}.`);
      setSelectedUids([]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error asignando planes en masa.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkAdminOption = async (grant: boolean) => {
    const targets = users.filter(u => selectedUids.includes(u.uid) && !isProtectedPrimaryAdmin(u));
    if (targets.length === 0) {
      setErrorMsg('Selecciona al menos una cuenta no protegida.');
      return;
    }
    setBulkBusy(true);
    setErrorMsg(null);
    const nextRole: UserRole = grant ? 'admin' : 'user';
    try {
      const updatedMap = new Map<string, PlanPermissions>();
      for (const t of targets) {
        const basePerms = t.planPermissions || getDefaultPlanPermissions(t.planTier, t.role === 'admin');
        const nextPerms: PlanPermissions = { ...basePerms, planAdmin: grant };
        updatedMap.set(t.uid, nextPerms);
        await adminUpdateUserPlan(
          t.uid,
          { role: nextRole, planPermissions: nextPerms },
          {
            targetLabel: t.email || t.displayName,
            action: grant ? 'BULK_ADMIN_PLAN_GRANTED' : 'BULK_ADMIN_PLAN_REVOKED',
            detail: `Acción masiva: Admin ${grant ? 'OTORGADO' : 'REVOCADO'}`
          }
        );
      }
      setUsers(prev =>
        prev.map(u => {
          const np = updatedMap.get(u.uid);
          return np ? { ...u, role: nextRole, planPermissions: np } : u;
        })
      );
      showSuccess(`${targets.length} cuenta(s) actualizadas.`);
      setSelectedUids([]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error aplicando cambios en masa.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportUsersCsv = () => {
    const header = ['UID', 'Nombre', 'Email', 'Rol', 'Plan', 'Activo', 'ELO', 'Dominio%', 'Nivel', 'XP', 'Decisiones', 'Fugas'];
    const rows = filteredUsers.map(u => [
      u.uid,
      `"${(u.displayName || '').replace(/"/g, '""')}"`,
      u.email,
      u.role,
      u.planTier,
      u.planActive ? 'SI' : 'NO',
      u.elo,
      u.masteryScore,
      u.evaluationStats?.unlockedLevel ?? 1,
      u.evaluationStats?.xp ?? 0,
      u.totalDecisions,
      u.totalMistakes
    ]);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `allin-school-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess(`Exportados ${filteredUsers.length} usuarios en CSV.`);
  };

  const handleInspectUser = async (targetUid: string) => {
    setLoadingDetailsUid(targetUid);
    setErrorMsg(null);
    try {
      const details = await fetchUserDetailsForAdmin(targetUid);
      setSelectedDetails(details);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cargar el perfil.');
    } finally {
      setLoadingDetailsUid(null);
    }
  };

  const handleSyncInternetMeta = async () => {
    setSyncingInternet(true);
    setErrorMsg(null);
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/solver/sync-internet', {
        method: 'POST',
        headers,
        body: JSON.stringify({ topic: syncTopic })
      });
      const payload = await res.json();
      if (!res.ok) {
        setErrorMsg(payload?.error || 'No se pudo completar la sincronización.');
      } else {
        setMetaState(payload as SolverMetaState);
        showSuccess('Reglas del Meta y Laboratorio actualizadas desde internet.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error de red al consultar internet.');
    } finally {
      setSyncingInternet(false);
    }
  };

  const handleOpenAddUserModal = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserTier('pro');
    setNewUserActive(true);
    setNewUserPerms(getDefaultPlanPermissions('pro', false));
    setErrorMsg(null);
    setShowAddUserModal(true);
  };

  const handleCreateManualUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) {
      setErrorMsg('Ingresa un correo Google válido.');
      return;
    }
    setCreatingManualUser(true);
    setErrorMsg(null);
    try {
      const res = await adminCreateOrUpdateManualUser({
        email: newUserEmail,
        displayName: newUserName || newUserEmail.split('@')[0],
        planTier: newUserTier,
        planActive: newUserActive,
        planPermissions: newUserPerms,
        role: newUserPerms.planAdmin ? 'admin' : 'user'
      });
      await loadAllCoreData();
      setShowAddUserModal(false);
      showSuccess(
        res.isExistingRealUser
          ? `Cuenta existente (${newUserEmail.trim().toLowerCase()}) actualizada.`
          : `Usuario pre-registrado (${newUserEmail.trim().toLowerCase()}). Al entrar con Google recibirá su plan al instante.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo agregar al usuario.');
    } finally {
      setCreatingManualUser(false);
    }
  };

  const handleDeleteManualUser = async (target: UserProfileDoc) => {
    if (!target.isManualPlaceholder && !target.uid.startsWith('manual_')) return;
    setBusyUid(target.uid);
    setErrorMsg(null);
    try {
      await adminDeleteManualUser(target.uid, target.email);
      setUsers(prev => prev.filter(u => u.uid !== target.uid));
      showSuccess(`Pre-registro de ${target.email} eliminado.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el pre-registro.');
    } finally {
      setBusyUid(null);
    }
  };

  const activeNavMeta = NAV_SECTIONS.find(s => s.id === section) || NAV_SECTIONS[0];

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col lg:flex-row">
      {/* LEFT SAAS SIDEBAR (260px Desktop) */}
      <aside className="w-full lg:w-64 bg-neutral-950 border-b lg:border-b-0 lg:border-r border-neutral-800 shrink-0 flex flex-col">
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">Allin Studio Admin</div>
              <div className="text-[11px] text-neutral-400 font-mono">Allin School · SaaS</div>
            </div>
          </div>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible flex-1">
          {NAV_SECTIONS.map(item => {
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20'
                    : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-neutral-400'}>{item.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs leading-tight">{item.label}</div>
                  <div className={`text-[10px] hidden lg:block ${isActive ? 'text-blue-100' : 'text-neutral-500'}`}>
                    {item.hint}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800 hidden lg:block space-y-2 text-xs">
          <button
            type="button"
            onClick={handleOpenAddUserModal}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Usuario</span>
          </button>
        </div>
      </aside>

      {/* RIGHT WORKSPACE COLUMN */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* TOP HEADER WITH BREADCRUMB & EXCLUSIVE ADMIN <-> USER PROFILE SWITCHER */}
        <header className="px-5 py-3.5 bg-neutral-950 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Administración</span>
            <span className="text-neutral-600">/</span>
            <span className="font-bold text-white">{activeNavMeta.label}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs">
            {/* Exclusive Admin Profile Mode Switcher (Admin <-> User) */}
            <div
              className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl"
              title="Solo visible en tu perfil administrador"
            >
              <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold whitespace-nowrap">
                Modo Admin
              </span>
              <button
                type="button"
                onClick={() => window.location.assign(labUrl)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 font-semibold whitespace-nowrap transition-colors cursor-pointer"
              >
                <span>Cambiar a Usuario</span>
              </button>
              <a
                href={labUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir Aula en pestaña nueva"
                aria-label="Abrir Aula en pestaña nueva"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Admin'}
                    className="w-6 h-6 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-300 font-bold">
                    A
                  </div>
                )}
                <span className="text-neutral-200 font-semibold max-w-[160px] truncate">
                  {currentUser.email}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => void loadAllCoreData()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-semibold rounded-xl cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-rose-950 border border-neutral-800 hover:border-rose-700 text-neutral-300 hover:text-rose-200 font-semibold rounded-xl cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </header>

        {/* MAIN VIEWPORT */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {statusMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700 rounded-xl text-xs text-emerald-200 flex items-center justify-between">
              <span>{statusMsg}</span>
              <button type="button" onClick={() => setStatusMsg(null)} className="text-emerald-300 hover:text-white cursor-pointer">
                Cerrar
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-700 rounded-xl text-xs text-rose-200 flex items-center justify-between">
              <span className="break-all">{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-300 hover:text-white ml-4 cursor-pointer shrink-0">
                Cerrar
              </button>
            </div>
          )}

          {/* SECTION 1: OVERVIEW (PARA DUMMIES COMMAND CENTER) */}
          {section === 'overview' && (
            <div className="space-y-6">
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold text-white">Centro de Mando Administrativo</h1>
                  <p className="text-xs text-neutral-400">
                    Gestiona toda tu academia desde aquí en lenguaje simple: crea alumnos, controla cobros, activa planes y ajusta qué módulos ven en el Aula.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenAddUserModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Nuevo Usuario</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('billing')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Registrar Pago</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('plans')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-semibold rounded-xl cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Configurar Planes</span>
                  </button>
                </div>
              </div>

              {/* 6 Primary Business KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                  <span className="text-neutral-400 block">MRR Estimado</span>
                  <strong className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">
                    ${kpis.estimatedMrr}
                  </strong>
                  <span className="text-[11px] text-neutral-500">{kpis.paidUsers} pagos activos</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                  <span className="text-neutral-400 block">Ingresos Registrados</span>
                  <strong className="text-2xl font-bold text-blue-400 font-mono mt-1 block">
                    ${kpis.collectedUsd}
                  </strong>
                  <span className="text-[11px] text-neutral-500">Cobros confirmados</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                  <span className="text-neutral-400 block">Alumnos Totales</span>
                  <strong className="text-2xl font-bold text-white font-mono mt-1 block">{kpis.total}</strong>
                  <span className="text-[11px] text-neutral-500">{kpis.active} activos · {kpis.inactive} pausados</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                  <span className="text-neutral-400 block">Invitaciones Pendientes</span>
                  <strong className="text-2xl font-bold text-amber-300 font-mono mt-1 block">{kpis.pendingInvites}</strong>
                  <span className="text-[11px] text-neutral-500">Esperando 1er login</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                  <span className="text-neutral-400 block">Tickets Abiertos</span>
                  <strong className="text-2xl font-bold text-rose-400 font-mono mt-1 block">{kpis.openTickets}</strong>
                  <span className="text-[11px] text-neutral-500">Soporte pendiente</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                  <span className="text-neutral-400 block">Backend API</span>
                  <strong className={`text-lg font-bold font-mono mt-2 block ${runtimeInfo?.status === 'ok' ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {runtimeInfo ? `${runtimeInfo.status.toUpperCase()} (${runtimeInfo.latencyMs}ms)` : 'Conectando...'}
                  </strong>
                </div>
              </div>

              {/* Dummy-Friendly Workflow Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => setSection('users')}
                  className="bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-2xl p-5 text-left space-y-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">1. Gestionar Usuarios</span>
                    <ArrowRight className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-neutral-400 leading-relaxed">
                    Crea cuentas nuevas, activa o pausa planes con 1 clic y revisa el nivel educativo y tarjetas SM-2 de cada jugador.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSection('billing')}
                  className="bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-2xl p-5 text-left space-y-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">2. Controlar Pagos e Ingresos</span>
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-neutral-400 leading-relaxed">
                    Asienta pagos por Stripe, Transferencia o PayPal. Al guardar un cobro confirmado, el plan del alumno se activa al instante.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSection('plans')}
                  className="bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-2xl p-5 text-left space-y-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">3. Personalizar Planes y Beneficios</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-neutral-400 leading-relaxed">
                    Elige qué secciones del Aula ven los planes Free, Pro y Elite, define límites diarios y publica beneficios en vivo.
                  </p>
                </button>
              </div>

              {/* D3 Quick Growth & Retention Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>Crecimiento de Alumnos (D3.js)</span>
                    </h3>
                    <span className="text-[11px] font-mono text-neutral-400">Últimos 6 meses</span>
                  </div>
                  <svg ref={growthChartRef} className="w-full h-52" />
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Retención Mensual % (D3.js)</span>
                    </h3>
                    <span className="text-[11px] font-mono text-amber-300">
                      Promedio: {instantCohortSummary.avgRetentionPct}%
                    </span>
                  </div>
                  <svg ref={retentionChartRef} className="w-full h-52" />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: USERS & PERMISSIONS */}
          {section === 'users' && (
            <div className="space-y-4">
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between text-xs">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, correo o UID..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-neutral-500 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as 'all' | PlanTier)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Todos los Planes</option>
                    <option value="free">Plan Free</option>
                    <option value="pro">Plan Pro</option>
                    <option value="elite">Plan Elite</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Todos los Estados</option>
                    <option value="active">Solo Activos</option>
                    <option value="inactive">Solo Pausados</option>
                  </select>

                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'user')}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Todos los Roles</option>
                    <option value="admin">Solo Admins</option>
                    <option value="user">Solo Alumnos</option>
                  </select>

                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as DifficultyLevel))}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Todos los Niveles</option>
                    <option value={1}>Nivel 1 (NL2-5)</option>
                    <option value={2}>Nivel 2 (NL10-25)</option>
                    <option value={3}>Nivel 3 (NL50)</option>
                    <option value={4}>Nivel 4 (NL100+)</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleExportUsersCsv}
                    className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-xl font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenAddUserModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Crear Usuario</span>
                  </button>
                </div>
              </div>

              {selectedUids.length > 0 && (
                <div className="bg-blue-950/30 border border-blue-500/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="font-bold text-blue-200">{selectedUids.length} usuario(s) seleccionado(s)</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void handleBulkActivate(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Activar
                    </button>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void handleBulkActivate(false)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Pausar
                    </button>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void handleBulkAdminOption(true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Otorgar Admin
                    </button>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void handleBulkAdminOption(false)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Quitar Admin
                    </button>
                    <div className="flex items-center gap-1.5 pl-2 border-l border-blue-500/30">
                      <select
                        value={bulkTier}
                        onChange={(e) => setBulkTier(e.target.value as PlanTier)}
                        className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-white font-mono"
                      >
                        <option value="free">FREE</option>
                        <option value="pro">PRO</option>
                        <option value="elite">ELITE</option>
                      </select>
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={() => void handleBulkTier()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        Aplicar Plan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 font-semibold">
                        <th className="py-3.5 px-3 w-10">
                          <button type="button" onClick={toggleSelectAllFiltered} className="text-neutral-400 hover:text-white cursor-pointer">
                            {filteredUsers.length > 0 && filteredUsers.every(u => selectedUids.includes(u.uid)) ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-3.5 px-3">Usuario / Correo</th>
                        <th className="py-3.5 px-3">Plan</th>
                        <th className="py-3.5 px-3">Estado</th>
                        <th className="py-3.5 px-3">Permisos</th>
                        <th className="py-3.5 px-3">Rol</th>
                        <th className="py-3.5 px-3 font-mono">Nivel / XP</th>
                        <th className="py-3.5 px-3 font-mono">ELO</th>
                        <th className="py-3.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {loading && users.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-neutral-400">
                            Cargando usuarios desde Firestore...
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-neutral-400">
                            No hay usuarios que coincidan con estos filtros.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(u => {
                          const isBusy = busyUid === u.uid;
                          const isSelf = u.uid === currentUser?.uid;
                          const isSelected = selectedUids.includes(u.uid);
                          const studentLvl = u.evaluationStats?.unlockedLevel ?? 1;
                          const studentXp = u.evaluationStats?.xp ?? 0;
                          const perms = u.planPermissions || getDefaultPlanPermissions(u.planTier, u.role === 'admin');
                          const isProtectedAdmin = isProtectedPrimaryAdmin(u);

                          return (
                            <tr key={u.uid} className={`hover:bg-neutral-900/40 transition-colors ${isSelected ? 'bg-blue-950/15' : ''}`}>
                              <td className="py-3 px-3">
                                <button type="button" onClick={() => toggleSelectUid(u.uid)} className="text-neutral-400 hover:text-white cursor-pointer">
                                  {isSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                                </button>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2.5">
                                  {u.photoURL ? (
                                    <img
                                      src={u.photoURL}
                                      alt={u.displayName}
                                      className="w-8 h-8 rounded-full border border-neutral-700 object-cover shrink-0"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-neutral-300 shrink-0">
                                      {(u.displayName || 'J').slice(0, 1)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-bold text-white flex items-center gap-1.5">
                                      <span className="truncate max-w-[150px]">{u.displayName}</span>
                                      {(u.isManualPlaceholder || u.uid.startsWith('manual_')) && (
                                        <span className="text-[10px] font-mono text-cyan-300">· Pre-registrado</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">{u.email}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <select
                                  value={u.planTier}
                                  disabled={isBusy}
                                  onChange={(e) => void handleChangePlanTier(u, e.target.value as PlanTier)}
                                  className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-white font-mono text-xs outline-none cursor-pointer"
                                >
                                  <option value="free">FREE</option>
                                  <option value="pro">PRO</option>
                                  <option value="elite">ELITE</option>
                                </select>
                              </td>

                              <td className="py-3 px-3">
                                <button
                                  type="button"
                                  disabled={isBusy || (isSelf && u.role === 'admin')}
                                  onClick={() => void handleTogglePlanActive(u)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-xs cursor-pointer disabled:opacity-50 ${
                                    u.planActive
                                      ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                                      : 'bg-rose-950/60 border-rose-600/60 text-rose-300'
                                  }`}
                                >
                                  {u.planActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                  <span>{u.planActive ? 'Activo' : 'Pausado'}</span>
                                </button>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex flex-wrap gap-1 max-w-[215px]">
                                  {PERMISSION_ITEMS.map(item => {
                                    const enabled = perms[item.key];
                                    const lockedAdminSelf = item.key === 'planAdmin' && isProtectedAdmin && enabled;
                                    const isPlanAdminBtn = item.key === 'planAdmin';
                                    return (
                                      <button
                                        key={item.key}
                                        type="button"
                                        disabled={isBusy || lockedAdminSelf}
                                        title={item.desc}
                                        onClick={() => void handleTogglePermission(u, item.key)}
                                        className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold cursor-pointer disabled:opacity-50 ${
                                          enabled
                                            ? isPlanAdminBtn
                                              ? 'bg-amber-950/80 border-amber-500/70 text-amber-300'
                                              : 'bg-blue-950/70 border-blue-500/60 text-blue-300'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                                        }`}
                                      >
                                        {enabled ? '✓' : '×'} {item.short}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <button
                                  type="button"
                                  disabled={isBusy || isProtectedAdmin}
                                  onClick={() => void handleToggleRole(u)}
                                  className={`px-2 py-1 rounded-lg border font-mono text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                                    u.role === 'admin'
                                      ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                                      : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                                  }`}
                                >
                                  {u.role.toUpperCase()}
                                </button>
                              </td>

                              <td className="py-3 px-3 font-mono">
                                <div className="text-cyan-300 font-bold">Nivel {studentLvl}</div>
                                <div className="text-neutral-500 text-[11px]">{studentXp} XP</div>
                              </td>

                              <td className="py-3 px-3 font-mono">
                                <div className="text-white font-bold">{u.elo}</div>
                              </td>

                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {(u.isManualPlaceholder || u.uid.startsWith('manual_')) && (
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteManualUser(u)}
                                      disabled={isBusy}
                                      title="Eliminar pre-registro manual"
                                      className="p-1.5 bg-neutral-900 hover:bg-rose-950 border border-neutral-800 text-neutral-400 hover:text-rose-300 rounded-lg cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void handleResetProgress(u)}
                                    disabled={isBusy}
                                    title="Reiniciar ELO y Nivel"
                                    className="p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-amber-300 rounded-lg cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleInspectUser(u.uid)}
                                    disabled={loadingDetailsUid === u.uid}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-blue-300 rounded-lg font-semibold cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{loadingDetailsUid === u.uid ? '...' : 'Perfil'}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: ONBOARDING & INVITES */}
          {section === 'onboarding' && (
            <OnboardingInvitesPanel
              users={users}
              invites={invites}
              loading={loading}
              onRefresh={loadAllCoreData}
              onOpenCreateUser={handleOpenAddUserModal}
              onInspectUser={(uid) => void handleInspectUser(uid)}
              onStatus={(msg) => showSuccess(msg)}
              onError={(err) => setErrorMsg(err)}
            />
          )}

          {/* SECTION 4: BILLING & REVENUE */}
          {section === 'billing' && (
            <BillingRevenuePanel
              users={users}
              transactions={transactions}
              loading={loading}
              onRefresh={loadAllCoreData}
              onUserPlanSynced={loadAllCoreData}
              onStatus={(msg) => showSuccess(msg)}
              onError={(err) => setErrorMsg(err)}
            />
          )}

          {/* SECTION 5: PLAN CATALOG MANAGER */}
          {section === 'plans' && (
            <PlanCatalogManager
              onStatus={(msg) => showSuccess(msg)}
              onError={(err) => setErrorMsg(err)}
            />
          )}

          {/* SECTION 6: SUPPORT & LIVE ANNOUNCEMENTS */}
          {section === 'support' && (
            <SupportAnnouncementsPanel
              users={users}
              announcements={announcements}
              tickets={tickets}
              onRefresh={loadAllCoreData}
              onStatus={(msg) => showSuccess(msg)}
              onError={(err) => setErrorMsg(err)}
            />
          )}

          {/* SECTION 6B: MARKET STUDY V1 (FEATURE FLAG & COHORTS) */}
          {section === 'study' && (
            <MarketStudyAdminPanel
              onStatus={(msg) => showSuccess(msg)}
              onError={(err) => setErrorMsg(err)}
            />
          )}

          {/* SECTION 7: ANALYTICS D3, BACKEND RUNTIME & AUDIT LOGS */}
          {section === 'system' && (
            <div className="space-y-6">
              {/* Firestore Usage KPIs */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-sm font-bold text-white">
                      Uso Real de Base de Datos Firestore y Latencia
                    </h2>
                  </div>
                  <button
                    type="button"
                    disabled={loadingDbMetrics}
                    onClick={() => void loadDbMetrics(users)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200 rounded-lg cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDbMetrics ? 'animate-spin' : ''}`} />
                    <span>{loadingDbMetrics ? 'Analizando BD...' : 'Actualizar Métricas BD'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <span className="text-neutral-400 block">Documentos Totales</span>
                    <strong className="text-2xl text-blue-400 mt-1 block">
                      {dbMetrics ? dbMetrics.totalDocuments : users.length}
                    </strong>
                    <span className="text-[10px] text-neutral-500">9 colecciones compartidas</span>
                  </div>
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <span className="text-neutral-400 block">Almacenamiento Estimado</span>
                    <strong className="text-2xl text-cyan-300 mt-1 block">
                      {dbMetrics ? `${dbMetrics.estimatedStorageKB} KB` : '...'}
                    </strong>
                    <span className="text-[10px] text-neutral-500">Cuota Spark: 1.04 GB</span>
                  </div>
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <span className="text-neutral-400 block">Retención Promedio</span>
                    <strong className="text-2xl text-emerald-400 mt-1 block">
                      {dbMetrics ? dbMetrics.avgRetentionPct : instantCohortSummary.avgRetentionPct}%
                    </strong>
                    <span className="text-[10px] text-neutral-500">Meta SLA: 70%</span>
                  </div>
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <span className="text-neutral-400 block">Latencia Firestore</span>
                    <strong className="text-2xl text-amber-300 mt-1 block">
                      {dbMetrics ? `${dbMetrics.latencyMs} ms` : '...'}
                    </strong>
                    <span className="text-[10px] text-neutral-500">Lectura multi-colección</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>Crecimiento de Usuarios (D3.js)</span>
                  </h3>
                  <svg ref={growthChartRef} className="w-full h-52" />
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Retención Mensual % (D3.js)</span>
                  </h3>
                  <svg ref={retentionChartRef} className="w-full h-52" />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>Uso por Colección</span>
                  </h3>
                  <svg ref={dbUsageChartRef} className="w-full h-56" />
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-cyan-400" />
                    <span>Alumnos por Nivel</span>
                  </h3>
                  <svg ref={levelChartRef} className="w-full h-56" />
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Distribución de Planes</span>
                  </h3>
                  <svg ref={planChartRef} className="w-full h-56" />
                </div>
              </div>

              {/* Express Backend Runtime Diagnostics + Web Brain */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-emerald-400" />
                      <span>Backend Express &amp; Firebase Auth</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => void checkServerDiagnostics()}
                      disabled={checkingHealth}
                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-lg cursor-pointer"
                    >
                      {checkingHealth ? 'Verificando...' : 'Ping Admin API'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block">Estado</span>
                      <strong className={runtimeInfo?.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}>
                        {runtimeInfo?.status?.toUpperCase() || '...'}
                      </strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block">Latencia API</span>
                      <strong className="text-blue-400">{runtimeInfo?.latencyMs ?? 0} ms</strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block">Gemini AI Key</span>
                      <strong className={runtimeInfo?.geminiConfigured ? 'text-emerald-400' : 'text-amber-300'}>
                        {runtimeInfo?.geminiConfigured ? 'CONFIGURADA' : 'FALTA KEY'}
                      </strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block">Node.js</span>
                      <strong className="text-white">{runtimeInfo?.nodeVersion || 'v22'}</strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block">Memoria RSS</span>
                      <strong className="text-cyan-300">{runtimeInfo?.memoryRssMB ?? 0} MB</strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block">Uptime</span>
                      <strong className="text-neutral-200">{runtimeInfo?.uptimeSeconds ?? 0}s</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span>Sincronización Cerebro Web (Gemini Search)</span>
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={syncTopic}
                      onChange={(e) => setSyncTopic(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSyncInternetMeta()}
                      disabled={syncingInternet}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer disabled:opacity-60 shrink-0"
                    >
                      {syncingInternet ? 'Sincronizando...' : 'Actualizar Meta'}
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">{metaState.internetQuerySummary}</p>
                </div>
              </div>

              {/* Global Weakest Topics */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Temas con Menor Precisión Global ({globalCategorySummary.length})</span>
                </h3>
                {globalCategorySummary.length === 0 ? (
                  <p className="text-neutral-500">Aún no hay suficientes evaluaciones globales.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono">
                    {globalCategorySummary.slice(0, 9).map(item => (
                      <div key={item.category} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-white font-bold truncate">{item.category}</div>
                          <div className="text-[10px] text-neutral-500">{item.correct}/{item.attempts} aciertos</div>
                        </div>
                        <span className={`font-bold shrink-0 ${item.accuracy >= 75 ? 'text-emerald-400' : item.accuracy >= 55 ? 'text-amber-300' : 'text-rose-400'}`}>
                          {item.accuracy}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Immutable Audit Logs */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Bitácora de Auditoría Administrativa (Inmutable)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => void loadAuditLogs()}
                    disabled={loadingLogs}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-lg cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                    <span>Recargar</span>
                  </button>
                </div>

                {loadingLogs ? (
                  <p className="text-neutral-400 py-4 text-center">Cargando registros...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-neutral-500 py-4 text-center">Sin acciones registradas aún.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {auditLogs.map(log => (
                      <div key={log.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-blue-400">{log.action}</span>
                            <span className="text-neutral-600">·</span>
                            <span className="font-bold text-white">{log.targetLabel}</span>
                            <span className="text-neutral-500 text-[11px]">por {log.actorEmail}</span>
                          </div>
                          <p className="text-[11px] text-neutral-300">{log.detail}</p>
                        </div>
                        <div className="text-[11px] font-mono text-neutral-500 shrink-0">
                          {formatAuditTimestamp(log.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detailed User Inspector Modal */}
          {selectedDetails && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="max-w-4xl w-full bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-5 border-b border-neutral-800 flex items-center justify-between gap-4 bg-neutral-900/50">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectedDetails.profile.photoURL ? (
                      <img
                        src={selectedDetails.profile.photoURL}
                        alt={selectedDetails.profile.displayName}
                        className="w-11 h-11 rounded-full border border-blue-500/50 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-blue-600/20 flex items-center justify-center font-bold text-blue-300">
                        {(selectedDetails.profile.displayName || 'U').slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white truncate">{selectedDetails.profile.displayName}</h3>
                        <span className="text-[11px] font-mono text-blue-300 uppercase">
                          · {selectedDetails.profile.planTier} · {selectedDetails.profile.planActive ? 'ACTIVO' : 'PAUSADO'}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 truncate">{selectedDetails.profile.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDetails(null)}
                    className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block">ELO Entrenador</span>
                      <strong className="text-lg text-white">{selectedDetails.profile.elo}</strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block">Dominio Global</span>
                      <strong className="text-lg text-blue-400">{selectedDetails.profile.masteryScore}%</strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block flex items-center gap-1">
                        <ClipboardCheck className="w-3 h-3 text-emerald-400" /> Exámenes
                      </span>
                      <strong className="text-lg text-emerald-400">
                        {selectedDetails.profile.evaluationStats.bestScorePct}% ({selectedDetails.profile.evaluationStats.passedCount}/{selectedDetails.profile.evaluationStats.examsTaken})
                      </strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-neutral-500 block flex items-center gap-1">
                        <Compass className="w-3 h-3 text-cyan-400" /> Hitos Carrera
                      </span>
                      <strong className="text-lg text-cyan-300">{selectedDetails.profile.roadmapDoneIds.length} / 16</strong>
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-900/70 border border-blue-500/30 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <KeyRound className="w-4 h-4 text-blue-400" />
                        <span>Suscripción y Permisos Individuales</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedDetails.profile.planTier}
                          disabled={busyUid === selectedDetails.profile.uid}
                          onChange={(e) => void handleChangePlanTier(selectedDetails.profile, e.target.value as PlanTier)}
                          className="bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs outline-none"
                        >
                          <option value="free">Plan FREE</option>
                          <option value="pro">Plan PRO</option>
                          <option value="elite">Plan ELITE</option>
                        </select>
                        <button
                          type="button"
                          disabled={
                            busyUid === selectedDetails.profile.uid ||
                            (selectedDetails.profile.uid === currentUser?.uid && selectedDetails.profile.role === 'admin')
                          }
                          onClick={() => void handleTogglePlanActive(selectedDetails.profile)}
                          className={`px-3 py-1 rounded-lg border font-bold text-xs cursor-pointer disabled:opacity-50 ${
                            selectedDetails.profile.planActive
                              ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                              : 'bg-rose-950 border-rose-600 text-rose-300'
                          }`}
                        >
                          {selectedDetails.profile.planActive ? 'Activo (Pausar)' : 'Pausado (Activar)'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {PERMISSION_ITEMS.map(item => {
                        const perms = selectedDetails.profile.planPermissions || getDefaultPlanPermissions(selectedDetails.profile.planTier, selectedDetails.profile.role === 'admin');
                        const enabled = perms[item.key];
                        const lockedAdminSelf = item.key === 'planAdmin' && isProtectedPrimaryAdmin(selectedDetails.profile) && enabled;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            disabled={busyUid === selectedDetails.profile.uid || lockedAdminSelf}
                            onClick={() => void handleTogglePermission(selectedDetails.profile, item.key)}
                            className={`p-3 rounded-xl border text-left flex items-start justify-between gap-3 cursor-pointer disabled:opacity-60 ${
                              enabled ? 'bg-blue-950/30 border-blue-500/50 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-xs">{item.label}</div>
                              <div className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</div>
                            </div>
                            <span className={`font-mono text-[10px] font-bold ${enabled ? 'text-emerald-400' : 'text-neutral-500'}`}>
                              {enabled ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-[11px] text-neutral-500 block">Nivel Actual</span>
                      <strong className="text-white">
                        {EDUCATIONAL_LEVELS_META.find(l => l.level === selectedDetails.profile.evaluationStats.unlockedLevel)?.name || 'Nivel 1'}
                      </strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-[11px] text-emerald-400 block">Punto Fuerte</span>
                      <strong className="text-emerald-200">{selectedDetails.profile.evaluationStats.strongestCategory}</strong>
                    </div>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <span className="text-[11px] text-rose-400 block">Prioridad Repaso</span>
                      <strong className="text-rose-200">{selectedDetails.profile.evaluationStats.weakestCategory}</strong>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-blue-400" />
                      <span>Tarjetas SM-2 ({selectedDetails.sm2Items.length})</span>
                    </h4>
                    {selectedDetails.sm2Items.length === 0 ? (
                      <p className="text-neutral-500">Sin tarjetas SM-2 registradas.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedDetails.sm2Items.map(item => (
                          <div key={item.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                            <div className="font-bold text-white truncate">{item.title}</div>
                            <div className="text-[11px] text-neutral-400">
                              {item.category} · {item.intervalDays}d · EF {item.easeFactor}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual User Creation Modal */}
          {showAddUserModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <form
                onSubmit={(e) => void handleCreateManualUser(e)}
                className="max-w-lg w-full bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-xs"
              >
                <div className="p-5 border-b border-neutral-800 flex items-center justify-between gap-3 bg-neutral-900/50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Crear / Pre-Registrar Usuario</h3>
                      <p className="text-[11px] text-neutral-400">
                        Define el plan y permisos antes de que el alumno entre con Google.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-neutral-300 font-semibold block">Nombre del Jugador</label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Ej: Carlos Mendoza"
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-neutral-300 font-semibold block">Correo Google</label>
                    <input
                      type="email"
                      required
                      maxLength={160}
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="jugador@gmail.com"
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-neutral-300 font-semibold block">Plan Asignado</label>
                      <select
                        value={newUserTier}
                        onChange={(e) => {
                          const tier = e.target.value as PlanTier;
                          setNewUserTier(tier);
                          setNewUserPerms(prev => getDefaultPlanPermissions(tier, prev.planAdmin));
                        }}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                      >
                        <option value="free">FREE</option>
                        <option value="pro">PRO</option>
                        <option value="elite">ELITE</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-neutral-300 font-semibold block">Estado de Acceso</label>
                      <button
                        type="button"
                        onClick={() => setNewUserActive(prev => !prev)}
                        className={`w-full px-3 py-2 rounded-xl border font-bold cursor-pointer ${
                          newUserActive
                            ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                            : 'bg-rose-950/60 border-rose-600/60 text-rose-300'
                        }`}
                      >
                        {newUserActive ? '✓ Plan Activo' : '× Plan Pausado'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-neutral-300 font-semibold block">Permisos del Plan</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PERMISSION_ITEMS.map(item => {
                        const checked = newUserPerms[item.key];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setNewUserPerms(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                            className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 cursor-pointer ${
                              checked
                                ? 'bg-blue-950/40 border-blue-500/60 text-blue-200'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                            }`}
                          >
                            <span className="font-semibold">{item.label}</span>
                            <span className="font-mono text-[10px] font-bold">{checked ? 'ON' : 'OFF'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-neutral-800 bg-neutral-900/40 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-xl font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creatingManualUser}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer disabled:opacity-60"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{creatingManualUser ? 'Guardando...' : 'Guardar Usuario'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
