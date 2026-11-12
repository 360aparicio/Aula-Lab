/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AdminDashboard: Plataforma Completa de Administración SaaS/Academia (V3.3 Pro).
 * - Gestión de Usuarios, Planes (Free/Pro/Elite), Roles RBAC, Acciones Masivas & CSV
 * - Inspector Completo de Perfil (Niveles 1-4, XP, ELO, Categorías, SM-2, Fugas >5% EV)
 * - Analítica Global D3.js (Distribución de Niveles & Planes, Fugas Globales, Banco 720+)
 * - Cerebro Web & Salud del Servidor (/api/health + sync-internet)
 * - Registro de Auditoría Inmutable en Firestore (/adminAuditLogs)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import {
  fetchAllUsersForAdmin,
  fetchUserDetailsForAdmin,
  adminUpdateUserPlan,
  fetchAdminAuditLogs,
  fetchDatabaseUsageMetricsForAdmin,
  computeMonthlyCohorts,
  getDefaultPlanPermissions,
  defaultEvaluationStats,
  BOOTSTRAPPED_ADMIN_EMAIL,
  adminCreateOrUpdateManualUser,
  adminDeleteManualUser,
  type UserProfileDoc,
  type AdminUserDetails,
  type AdminAuditLogEntry,
  type DatabaseUsageMetrics,
  type PlanPermissions,
  type PlanTier,
  type UserRole
} from '../lib/cloudSync';
import { getBankCountsByMode, EDUCATIONAL_LEVELS, type DifficultyLevel } from '../engine/evaluationBank';
import { SolverMetaUpdater, type SolverMetaState } from '../engine/solverMetaUpdater';
import { useAuth } from '../context/AuthContext';
import {
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
  ArrowLeft,
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
  Trash2
} from 'lucide-react';

type AdminSubTab = 'users' | 'analytics' | 'system' | 'audit';

const PERMISSION_ITEMS: Array<{ key: keyof PlanPermissions; short: string; label: string; desc: string }> = [
  { key: 'labPro', short: 'Lab', label: 'Laboratorio Pro', desc: 'Acceso completo al árbol GTO, rangos 13x13 y Práctica multi-calle' },
  { key: 'webBrain', short: 'Web', label: 'Cerebro Web', desc: 'Sincronización con meta-reglas de internet y coach adaptativo' },
  { key: 'unlimitedEval', short: 'Eval', label: 'Eval. Ilimitadas', desc: 'Exámenes sin límite en Niveles 1-4, Temas Fijos y Spots' },
  { key: 'pdfExport', short: 'PDF', label: 'Exportar PDF', desc: 'Descarga de reportes técnicos de progreso y auditoría' },
  { key: 'planAdmin', short: 'Admin', label: 'Admin del Plan', desc: 'Única opción que permite configurar el sistema y administrar cuentas/planes' }
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
  const { user: currentUser, returnToMainEntry, switchScreenMode } = useAuth();

  const [subTab, setSubTab] = useState<AdminSubTab>('users');
  const [users, setUsers] = useState<UserProfileDoc[]>([]);
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

  // Filters & Multi-Select
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

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // System & Web Brain
  const [healthResult, setHealthResult] = useState<{ status: string; service: string; latencyMs: number } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(false);
  const [metaState, setMetaState] = useState<SolverMetaState>(() => SolverMetaUpdater.getInstance().getState());
  const [syncTopic, setSyncTopic] = useState('NL2-NL100 6-Max GTO trends C-bet and 3-bet defense 2025');
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

  const bankCounts = useMemo(() => getBankCountsByMode(), []);
  const instantCohortSummary = useMemo(() => computeMonthlyCohorts(users), [users]);

  const showSuccess = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 4500);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchAllUsersForAdmin();
      setUsers(list);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error cargando lista de usuarios.');
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
      const logs = await fetchAdminAuditLogs(50);
      setAuditLogs(logs);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudieron cargar los registros de auditoría.');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const checkServerHealth = useCallback(async () => {
    setCheckingHealth(true);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthResult({
        status: String(data?.status || 'ok'),
        service: String(data?.service || 'lab-studio'),
        latencyMs: Math.round(performance.now() - t0)
      });
    } catch {
      setHealthResult({
        status: 'offline',
        service: 'lab-studio',
        latencyMs: 0
      });
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (subTab === 'audit') {
      void loadAuditLogs();
    } else if (subTab === 'system') {
      void checkServerHealth();
      void SolverMetaUpdater.getInstance().fetchFromServer().then(setMetaState);
    } else if (subTab === 'analytics') {
      void loadDbMetrics(users);
    }
  }, [subTab, users, loadAuditLogs, checkServerHealth, loadDbMetrics]);

  const kpis = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.planActive).length;
    const inactive = total - active;
    const paid = users.filter(u => u.planTier === 'pro' || u.planTier === 'elite').length;
    const totalMistakes = users.reduce((sum, u) => sum + (u.totalMistakes || 0), 0);
    const avgElo = total > 0 ? Math.round(users.reduce((sum, u) => sum + (u.elo || 1200), 0) / total) : 1200;
    return { total, active, inactive, paid, totalMistakes, avgElo };
  }, [users]);

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

  // Render D3.js Analytics Charts when analytics tab is active
  useEffect(() => {
    if (subTab !== 'analytics') return;

    // Chart 1: Student Level Distribution (1..4)
    if (levelChartRef.current) {
      const svg = d3.select(levelChartRef.current);
      svg.selectAll('*').remove();

      const levelCounts = [1, 2, 3, 4].map(lvl => ({
        label: `Nivel ${lvl}`,
        count: users.filter(u => (u.evaluationStats?.unlockedLevel || 1) === lvl).length
      }));

      const width = 420;
      const height = 210;
      const margin = { top: 20, right: 16, bottom: 32, left: 36 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const g = svg
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand().domain(levelCounts.map(d => d.label)).range([0, innerW]).padding(0.32);
      const maxVal = Math.max(2, d3.max(levelCounts, d => d.count) || 2);
      const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '11px');

      g.append('g')
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '11px');

      g.selectAll('.domain, .tick line').attr('stroke', '#262626');

      const colors = ['#60a5fa', '#34d399', '#fbbf24', '#c084fc'];
      g.selectAll('rect')
        .data(levelCounts)
        .enter()
        .append('rect')
        .attr('x', d => x(d.label) || 0)
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => Math.max(2, innerH - y(d.count)))
        .attr('rx', 6)
        .attr('fill', (_, i) => colors[i % colors.length]);

      g.selectAll('.val-label')
        .data(levelCounts)
        .enter()
        .append('text')
        .attr('x', d => (x(d.label) || 0) + x.bandwidth() / 2)
        .attr('y', d => y(d.count) - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e5e5e5')
        .style('font-size', '11px')
        .style('font-weight', '700')
        .text(d => d.count);
    }

    // Chart 2: Plan Tier Distribution
    if (planChartRef.current) {
      const svg = d3.select(planChartRef.current);
      svg.selectAll('*').remove();

      const planCounts = [
        { label: 'FREE', count: users.filter(u => u.planTier === 'free' && u.planActive).length, color: '#737373' },
        { label: 'PRO', count: users.filter(u => u.planTier === 'pro' && u.planActive).length, color: '#3b82f6' },
        { label: 'ELITE', count: users.filter(u => u.planTier === 'elite' && u.planActive).length, color: '#f59e0b' },
        { label: 'INACTIVOS', count: users.filter(u => !u.planActive).length, color: '#f43f5e' }
      ];

      const width = 420;
      const height = 210;
      const margin = { top: 20, right: 16, bottom: 32, left: 36 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const g = svg
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand().domain(planCounts.map(d => d.label)).range([0, innerW]).padding(0.32);
      const maxVal = Math.max(2, d3.max(planCounts, d => d.count) || 2);
      const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '11px');

      g.append('g')
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '11px');

      g.selectAll('.domain, .tick line').attr('stroke', '#262626');

      g.selectAll('rect')
        .data(planCounts)
        .enter()
        .append('rect')
        .attr('x', d => x(d.label) || 0)
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => Math.max(2, innerH - y(d.count)))
        .attr('rx', 6)
        .attr('fill', d => d.color);

      g.selectAll('.val-label')
        .data(planCounts)
        .enter()
        .append('text')
        .attr('x', d => (x(d.label) || 0) + x.bandwidth() / 2)
        .attr('y', d => y(d.count) - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e5e5e5')
        .style('font-size', '11px')
        .style('font-weight', '700')
        .text(d => d.count);
    }

    const cohorts = dbMetrics?.monthlyCohorts || instantCohortSummary.cohorts;

    // Chart 3: User Growth (Cumulative Area+Line + Monthly Signups Bars)
    if (growthChartRef.current) {
      const svg = d3.select(growthChartRef.current);
      svg.selectAll('*').remove();

      const width = 440;
      const height = 220;
      const margin = { top: 22, right: 20, bottom: 32, left: 38 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const g = svg
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const xBand = d3.scaleBand().domain(cohorts.map(d => d.label)).range([0, innerW]).padding(0.35);
      const maxUsers = Math.max(3, d3.max(cohorts, d => d.cumulativeUsers) || 3);
      const y = d3.scaleLinear().domain([0, maxUsers]).nice().range([innerH, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xBand))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '10px');

      g.append('g')
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '10px');

      g.selectAll('.domain, .tick line').attr('stroke', '#262626');

      // New signups bars
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

      const area = d3
        .area<typeof cohorts[0]>()
        .x(d => (xBand(d.label) || 0) + xBand.bandwidth() / 2)
        .y0(innerH)
        .y1(d => y(d.cumulativeUsers))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(cohorts)
        .attr('fill', 'rgba(59, 130, 246, 0.16)')
        .attr('d', area);

      const line = d3
        .line<typeof cohorts[0]>()
        .x(d => (xBand(d.label) || 0) + xBand.bandwidth() / 2)
        .y(d => y(d.cumulativeUsers))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(cohorts)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2.5)
        .attr('d', line);

      g.selectAll('.growth-dot')
        .data(cohorts)
        .enter()
        .append('circle')
        .attr('cx', d => (xBand(d.label) || 0) + xBand.bandwidth() / 2)
        .attr('cy', d => y(d.cumulativeUsers))
        .attr('r', 4)
        .attr('fill', '#60a5fa')
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5);

      g.selectAll('.growth-label')
        .data(cohorts)
        .enter()
        .append('text')
        .attr('x', d => (xBand(d.label) || 0) + xBand.bandwidth() / 2)
        .attr('y', d => y(d.cumulativeUsers) - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e5e5e5')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .text(d => d.cumulativeUsers);
    }

    // Chart 4: Monthly Retention Rate (%) with 70% SLA Benchmark Line
    if (retentionChartRef.current) {
      const svg = d3.select(retentionChartRef.current);
      svg.selectAll('*').remove();

      const width = 440;
      const height = 220;
      const margin = { top: 22, right: 20, bottom: 32, left: 40 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const g = svg
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const xBand = d3.scaleBand().domain(cohorts.map(d => d.label)).range([0, innerW]).padding(0.25);
      const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xBand))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '10px');

      g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '10px');

      g.selectAll('.domain, .tick line').attr('stroke', '#262626');

      // 70% Target benchmark line
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', y(70))
        .attr('y2', y(70))
        .attr('stroke', '#f59e0b')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.8);

      g.append('text')
        .attr('x', innerW - 2)
        .attr('y', y(70) - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#fbbf24')
        .style('font-size', '9px')
        .text('Objetivo 70%');

      const area = d3
        .area<typeof cohorts[0]>()
        .x(d => (xBand(d.label) || 0) + xBand.bandwidth() / 2)
        .y0(innerH)
        .y1(d => y(d.retentionPct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(cohorts)
        .attr('fill', 'rgba(16, 185, 129, 0.16)')
        .attr('d', area);

      const line = d3
        .line<typeof cohorts[0]>()
        .x(d => (xBand(d.label) || 0) + xBand.bandwidth() / 2)
        .y(d => y(d.retentionPct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(cohorts)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2.5)
        .attr('d', line);

      g.selectAll('.ret-dot')
        .data(cohorts)
        .enter()
        .append('circle')
        .attr('cx', d => (xBand(d.label) || 0) + xBand.bandwidth() / 2)
        .attr('cy', d => y(d.retentionPct))
        .attr('r', 4)
        .attr('fill', '#34d399')
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5);

      g.selectAll('.ret-label')
        .data(cohorts)
        .enter()
        .append('text')
        .attr('x', d => (xBand(d.label) || 0) + xBand.bandwidth() / 2)
        .attr('y', d => Math.max(12, y(d.retentionPct) - 8))
        .attr('text-anchor', 'middle')
        .attr('fill', '#6ee7b7')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .text(d => `${d.retentionPct}%`);
    }

    // Chart 5: Firestore Database Usage per Collection (Horizontal Bars)
    if (dbUsageChartRef.current) {
      const svg = d3.select(dbUsageChartRef.current);
      svg.selectAll('*').remove();

      const cols = dbMetrics?.collections || [
        { collection: 'users', label: 'Perfiles (/users)', documents: users.length, estimatedKB: Math.round(users.length * 1.8 * 10) / 10 },
        { collection: 'sm2Items', label: 'Repasos SM-2 (/sm2Items)', documents: 0, estimatedKB: 0 },
        { collection: 'mistakes', label: 'Fugas >5% EV (/mistakes)', documents: 0, estimatedKB: 0 },
        { collection: 'adminAuditLogs', label: 'Auditoría (/adminAuditLogs)', documents: 0, estimatedKB: 0 }
      ];

      const width = 460;
      const height = 210;
      const margin = { top: 14, right: 86, bottom: 26, left: 155 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const g = svg
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const yBand = d3.scaleBand().domain(cols.map(c => c.label)).range([0, innerH]).padding(0.32);
      const maxDocs = Math.max(4, d3.max(cols, c => c.documents) || 4);
      const x = d3.scaleLinear().domain([0, maxDocs]).nice().range([0, innerW]);

      g.append('g')
        .call(d3.axisLeft(yBand))
        .selectAll('text')
        .attr('fill', '#d4d4d4')
        .style('font-size', '10px');

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('d')))
        .selectAll('text')
        .attr('fill', '#a3a3a3')
        .style('font-size', '10px');

      g.selectAll('.domain, .tick line').attr('stroke', '#262626');

      const barColors = ['#3b82f6', '#06b6d4', '#f43f5e', '#a855f7'];

      g.selectAll('.db-bar')
        .data(cols)
        .enter()
        .append('rect')
        .attr('y', d => yBand(d.label) || 0)
        .attr('x', 0)
        .attr('height', yBand.bandwidth())
        .attr('width', d => Math.max(4, x(d.documents)))
        .attr('rx', 5)
        .attr('fill', (_, i) => barColors[i % barColors.length]);

      g.selectAll('.db-val')
        .data(cols)
        .enter()
        .append('text')
        .attr('x', d => Math.max(4, x(d.documents)) + 6)
        .attr('y', d => (yBand(d.label) || 0) + yBand.bandwidth() / 2 + 4)
        .attr('fill', '#e5e5e5')
        .style('font-size', '10px')
        .style('font-family', 'monospace')
        .style('font-weight', '700')
        .text(d => `${d.documents} docs (${d.estimatedKB} KB)`);
    }
  }, [subTab, users, dbMetrics, instantCohortSummary]);

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
      showSuccess(
        `Plan de ${target.displayName || target.email} ${nextActive ? 'ACTIVADO' : 'DESACTIVADO'} correctamente.`
      );
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
          detail: `Plan cambiado de ${target.planTier.toUpperCase()} a ${newTier.toUpperCase()} con permisos estándar del tier${keepsAdmin ? ' (mantiene Admin del Plan)' : ''}`
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
      showSuccess(`Plan de ${target.displayName || target.email} actualizado a ${newTier.toUpperCase()}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar el nivel de plan.');
    } finally {
      setBusyUid(null);
    }
  };

  const isProtectedPrimaryAdmin = (target: UserProfileDoc) =>
    target.uid === currentUser?.uid || target.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

  const handleTogglePermission = async (target: UserProfileDoc, permKey: keyof PlanPermissions) => {
    const currentPerms = target.planPermissions || getDefaultPlanPermissions(target.planTier, target.role === 'admin');
    const nextValue = !currentPerms[permKey];

    if (permKey === 'planAdmin' && !nextValue && isProtectedPrimaryAdmin(target)) {
      setErrorMsg('Por seguridad, no puedes revocar tu propia opción de Administrador ni la del Admin principal.');
      return;
    }

    setBusyUid(target.uid);
    setErrorMsg(null);
    const nextPerms: PlanPermissions = {
      ...currentPerms,
      [permKey]: nextValue
    };
    const nextRole: UserRole | undefined = permKey === 'planAdmin' ? (nextValue ? 'admin' : 'user') : undefined;
    const meta = PERMISSION_ITEMS.find(p => p.key === permKey);
    try {
      await adminUpdateUserPlan(
        target.uid,
        {
          planPermissions: nextPerms,
          ...(nextRole ? { role: nextRole } : {})
        },
        {
          targetLabel: target.email || target.displayName,
          action: permKey === 'planAdmin' ? (nextValue ? 'PLAN_ADMIN_GRANTED' : 'PLAN_ADMIN_REVOKED') : 'PLAN_PERMISSION_UPDATED',
          detail:
            permKey === 'planAdmin'
              ? `Opción "Admin del Plan" ${nextValue ? 'OTORGADA (configuración y administración de cuentas habilitada)' : 'REVOCADA (cuenta restringida solo a uso)'}`
              : `Permiso "${meta?.label || permKey}" marcado ${nextValue ? 'HABILITADO' : 'BLOQUEADO'}`
        }
      );
      setUsers(prev =>
        prev.map(u =>
          u.uid === target.uid
            ? { ...u, planPermissions: nextPerms, ...(nextRole ? { role: nextRole } : {}) }
            : u
        )
      );
      if (selectedDetails?.profile.uid === target.uid) {
        setSelectedDetails(prev =>
          prev
            ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  planPermissions: nextPerms,
                  ...(nextRole ? { role: nextRole } : {})
                }
              }
            : null
        );
      }
      showSuccess(
        `Permiso ${meta?.label || permKey} ${nextValue ? 'habilitado' : 'desactivado'} para ${target.displayName || target.email}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar el permiso de suscripción.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleRole = async (target: UserProfileDoc) => {
    if (isProtectedPrimaryAdmin(target)) {
      setErrorMsg('No puedes degradar tu propio rol de Administrador ni el del Admin principal.');
      return;
    }
    const nextRole: UserRole = target.role === 'admin' ? 'user' : 'admin';
    const currentPerms = target.planPermissions || getDefaultPlanPermissions(target.planTier, target.role === 'admin');
    const nextPerms: PlanPermissions = {
      ...currentPerms,
      planAdmin: nextRole === 'admin'
    };
    setBusyUid(target.uid);
    setErrorMsg(null);
    try {
      await adminUpdateUserPlan(
        target.uid,
        { role: nextRole, planPermissions: nextPerms },
        {
          targetLabel: target.email || target.displayName,
          action: nextRole === 'admin' ? 'ROLE_PROMOTED_ADMIN' : 'ROLE_SET_USER',
          detail: `Rol RBAC y Admin del Plan actualizado a ${nextRole.toUpperCase()}`
        }
      );
      setUsers(prev =>
        prev.map(u => (u.uid === target.uid ? { ...u, role: nextRole, planPermissions: nextPerms } : u))
      );
      if (selectedDetails?.profile.uid === target.uid) {
        setSelectedDetails(prev =>
          prev ? { ...prev, profile: { ...prev.profile, role: nextRole, planPermissions: nextPerms } } : null
        );
      }
      showSuccess(`Rol de ${target.displayName || target.email} actualizado a ${nextRole.toUpperCase()}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar el rol del usuario.');
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
          detail: 'Reiniciado ELO a 1200 y progreso de Niveles Educativos (Nivel 1, 0 XP)'
        }
      );
      setUsers(prev =>
        prev.map(u => (u.uid === target.uid ? { ...u, elo: 1200, evaluationStats: freshEval } : u))
      );
      showSuccess(`Progreso y ELO reiniciados para ${target.displayName || target.email}.`);
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
      showSuccess(`${targets.length} usuario(s) actualizados a ${active ? 'ACTIVO' : 'INACTIVO'}.`);
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
      showSuccess(`${targets.length} usuario(s) asignados al plan ${bulkTier.toUpperCase()}.`);
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
      setErrorMsg('Selecciona al menos una cuenta no protegida para cambiar su opción Administrador.');
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
            detail: `Acción masiva: opción Administrador en Plan ${grant ? 'OTORGADA' : 'REVOCADA'}`
          }
        );
      }
      setUsers(prev =>
        prev.map(u => {
          const np = updatedMap.get(u.uid);
          return np ? { ...u, role: nextRole, planPermissions: np } : u;
        })
      );
      showSuccess(
        `${targets.length} cuenta(s) actualizadas: opción Administrador ${grant ? 'HABILITADA' : 'REVOCADA'}.`
      );
      setSelectedUids([]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error aplicando opción de Administrador en masa.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'UID',
      'Nombre',
      'Email',
      'Rol',
      'Plan',
      'Activo',
      'ELO',
      'Dominio%',
      'NivelEducativo',
      'XP',
      'MejorNota%',
      'ExamenesAprobados',
      'ExamenesTotales',
      'TemaDebil',
      'Decisiones',
      'Fugas>5%EV'
    ];
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
      u.evaluationStats?.bestScorePct ?? 0,
      u.evaluationStats?.passedCount ?? 0,
      u.evaluationStats?.examsTaken ?? 0,
      `"${(u.evaluationStats?.weakestCategory || 'Sin datos').replace(/"/g, '""')}"`,
      u.totalDecisions,
      u.totalMistakes
    ]);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab-studio-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess(`Exportados ${filteredUsers.length} perfiles en CSV.`);
  };

  const handleInspectUser = async (targetUid: string) => {
    setLoadingDetailsUid(targetUid);
    setErrorMsg(null);
    try {
      const details = await fetchUserDetailsForAdmin(targetUid);
      setSelectedDetails(details);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cargar el detalle del usuario.');
    } finally {
      setLoadingDetailsUid(null);
    }
  };

  const handleSyncInternetMeta = async () => {
    setSyncingInternet(true);
    setErrorMsg(null);
    const res = await SolverMetaUpdater.getInstance().syncWithInternet(syncTopic);
    setMetaState(res.state);
    if (res.ok) {
      showSuccess('Reglas del Meta y Laboratorio actualizadas desde internet.');
    } else if (res.error) {
      setErrorMsg(res.error);
    }
    setSyncingInternet(false);
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

  const handleNewUserTierChange = (tier: PlanTier) => {
    setNewUserTier(tier);
    setNewUserPerms(prev => getDefaultPlanPermissions(tier, prev.planAdmin));
  };

  const handleCreateManualUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) {
      setErrorMsg('Ingresa un correo Google válido para registrar al usuario.');
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
      await loadUsers();
      setShowAddUserModal(false);
      showSuccess(
        res.isExistingRealUser
          ? `Cuenta existente (${newUserEmail.trim().toLowerCase()}) actualizada correctamente.`
          : `Usuario pre-registrado (${newUserEmail.trim().toLowerCase()}). Al iniciar sesión con Google recibirá su plan automáticamente.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo agregar al usuario manualmente.');
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
      showSuccess(`Registro manual de ${target.email} eliminado.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el registro manual.');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Hero */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">
                Centro de Administración Integral · Lab Studio V3.4
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/40">
                RBAC Zero-Trust
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Control total de suscriptores, alta manual de usuarios, opción Administrador en el plan, permisos
              granulares, analítica D3 de crecimiento/retención/BD y bitácora de auditoría.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenAddUserModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Agregar Usuario</span>
          </button>
          <button
            type="button"
            onClick={() => switchScreenMode('user')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>Ir a Plataforma de Uso</span>
          </button>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={() => void returnToMainEntry()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Entrada Principal</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" /> Usuarios
          </span>
          <strong className="text-2xl font-bold text-white font-mono tabular-nums mt-1 block">{kpis.total}</strong>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Activos
          </span>
          <strong className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-1 block">{kpis.active}</strong>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-400" /> Inactivos
          </span>
          <strong className="text-2xl font-bold text-rose-400 font-mono tabular-nums mt-1 block">{kpis.inactive}</strong>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-400" /> Pro / Elite
          </span>
          <strong className="text-2xl font-bold text-amber-300 font-mono tabular-nums mt-1 block">{kpis.paid}</strong>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-cyan-400" /> ELO Promedio
          </span>
          <strong className="text-2xl font-bold text-cyan-300 font-mono tabular-nums mt-1 block">{kpis.avgElo}</strong>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Fugas Globales
          </span>
          <strong className="text-2xl font-bold text-white font-mono tabular-nums mt-1 block">{kpis.totalMistakes}</strong>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3 text-xs">
        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            subTab === 'users'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuarios, Planes y Acciones Masivas</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('analytics')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            subTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analítica D3 y Banco 720+</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('system')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            subTab === 'system'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Cerebro Web y Salud Servidor</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('audit')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            subTab === 'audit'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Auditoría Inmutable</span>
        </button>
      </div>

      {/* Banners */}
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

      {/* SUBTAB 1: USERS & PLANS */}
      {subTab === 'users' && (
        <div className="space-y-4">
          {/* Search & Filters + CSV */}
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
                <option value="inactive">Solo Inactivos</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'user')}
                className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
              >
                <option value="all">Todos los Roles</option>
                <option value="admin">Admins del Plan</option>
                <option value="user">Solo Uso (Usuarios)</option>
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
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-xl font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddUserModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Nuevo Usuario</span>
              </button>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedUids.length > 0 && (
            <div className="bg-blue-950/30 border border-blue-500/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="font-bold text-blue-200">
                {selectedUids.length} usuario(s) seleccionado(s)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkActivate(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Activar Seleccionados
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkActivate(false)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Desactivar Seleccionados
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkAdminOption(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Otorgar Admin Plan
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkAdminOption(false)}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Revocar Admin
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

          {/* Users Table */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 font-semibold">
                    <th className="py-3.5 px-3 w-10">
                      <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        className="text-neutral-400 hover:text-white cursor-pointer"
                        title="Seleccionar todos"
                      >
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
                    <th className="py-3.5 px-3">Permisos Suscripción</th>
                    <th className="py-3.5 px-3">Rol</th>
                    <th className="py-3.5 px-3 font-mono">Nivel / XP</th>
                    <th className="py-3.5 px-3 font-mono">ELO / Exámenes</th>
                    <th className="py-3.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-neutral-400">
                        Cargando perfiles desde Firestore...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-neutral-400">
                        No se encontraron usuarios con estos filtros.
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
                          <td className="py-3.5 px-3">
                            <button
                              type="button"
                              onClick={() => toggleSelectUid(u.uid)}
                              className="text-neutral-400 hover:text-white cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 px-3">
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
                                  <span className="truncate max-w-[140px]">{u.displayName}</span>
                                  {(u.isManualPlaceholder || u.uid.startsWith('manual_')) && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-600/50 shrink-0">
                                      Pre-registrado
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-neutral-400 truncate max-w-[190px]">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <select
                              aria-label={`Plan de ${u.displayName}`}
                              value={u.planTier}
                              disabled={isBusy}
                              onChange={(e) => void handleChangePlanTier(u, e.target.value as PlanTier)}
                              className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-white font-mono text-xs outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
                            >
                              <option value="free">FREE</option>
                              <option value="pro">PRO</option>
                              <option value="elite">ELITE</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-3">
                            <button
                              type="button"
                              disabled={isBusy || (isSelf && u.role === 'admin')}
                              onClick={() => void handleTogglePlanActive(u)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-bold text-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                u.planActive
                                  ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/60'
                                  : 'bg-rose-950/60 border-rose-600/60 text-rose-300 hover:bg-rose-900/60'
                              }`}
                            >
                              {u.planActive ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Activo</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Inactivo</span>
                                </>
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 px-3">
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
                                    title={`${item.label}: ${item.desc} (${lockedAdminSelf ? 'Protegido' : 'Clic para alternar'})`}
                                    onClick={() => void handleTogglePermission(u, item.key)}
                                    className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                      enabled
                                        ? isPlanAdminBtn
                                          ? 'bg-amber-950/80 border-amber-500/70 text-amber-300 hover:bg-amber-900/70'
                                          : 'bg-blue-950/70 border-blue-500/60 text-blue-300 hover:bg-blue-900/60'
                                        : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                                    }`}
                                  >
                                    {enabled ? '✓' : '×'} {item.short}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <button
                              type="button"
                              disabled={isBusy || isProtectedAdmin}
                              onClick={() => void handleToggleRole(u)}
                              title={isProtectedAdmin ? 'Cuenta Administradora principal protegida' : 'Clic para alternar rol User / Admin del Plan'}
                              className={`px-2 py-1 rounded-lg border font-mono text-[11px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                u.role === 'admin'
                                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-blue-500/40'
                              }`}
                            >
                              {u.role.toUpperCase()}
                            </button>
                          </td>

                          <td className="py-3.5 px-3 font-mono tabular-nums">
                            <div className="text-cyan-300 font-bold">Nivel {studentLvl}</div>
                            <div className="text-neutral-500 text-[11px]">{studentXp} XP</div>
                          </td>

                          <td className="py-3.5 px-3 font-mono tabular-nums">
                            <div className="text-white font-bold">{u.elo} ELO</div>
                            <div className="text-emerald-400 text-[11px]">
                              {u.evaluationStats?.bestScorePct ?? 0}% ({u.evaluationStats?.passedCount ?? 0}/{u.evaluationStats?.examsTaken ?? 0})
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {(u.isManualPlaceholder || u.uid.startsWith('manual_')) && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteManualUser(u)}
                                  disabled={isBusy}
                                  title="Eliminar usuario manual pendiente"
                                  className="p-1.5 bg-neutral-900 hover:bg-rose-950 border border-neutral-800 hover:border-rose-600 text-neutral-400 hover:text-rose-300 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleResetProgress(u)}
                                disabled={isBusy}
                                title="Reiniciar ELO y Nivel Educativo"
                                className="p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-amber-300 rounded-lg cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleInspectUser(u.uid)}
                                disabled={loadingDetailsUid === u.uid}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/50 text-blue-300 rounded-lg font-semibold transition-colors cursor-pointer"
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

      {/* SUBTAB 2: D3 ANALYTICS, GROWTH, RETENTION & DATABASE USAGE */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          {/* Firestore Database Telemetry Strip */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white">
                  Métricas de Crecimiento, Retención y Uso de Base de Datos (Firestore)
                </h2>
              </div>
              <button
                type="button"
                disabled={loadingDbMetrics}
                onClick={() => void loadDbMetrics(users)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDbMetrics ? 'animate-spin' : ''}`} />
                <span>{loadingDbMetrics ? 'Analizando BD...' : 'Actualizar Métricas BD'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                <span className="text-neutral-400 block">Documentos Totales BD</span>
                <strong className="text-2xl text-blue-400 mt-1 block">
                  {dbMetrics ? dbMetrics.totalDocuments : users.length}
                </strong>
                <span className="text-[10px] text-neutral-500">4 colecciones activas</span>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                <span className="text-neutral-400 block">Huella / Cuota Firestore</span>
                <strong className="text-2xl text-cyan-300 mt-1 block">
                  {dbMetrics ? `${dbMetrics.estimatedStorageKB} KB` : '...'}
                </strong>
                <span className="text-[10px] text-neutral-500">Límite Free Tier: 1.04 GB</span>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                <span className="text-neutral-400 block">Retención Mensual Promedio</span>
                <strong className="text-2xl text-emerald-400 mt-1 block">
                  {dbMetrics ? dbMetrics.avgRetentionPct : instantCohortSummary.avgRetentionPct}%
                </strong>
                <span className="text-[10px] text-neutral-500">Meta plataforma: ≥ 70%</span>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                <span className="text-neutral-400 block">Latencia Consulta BD</span>
                <strong className="text-2xl text-amber-300 mt-1 block">
                  {dbMetrics ? `${dbMetrics.latencyMs} ms` : '...'}
                </strong>
                <span className="text-[10px] text-neutral-500">Lectura paralela multi-colección</span>
              </div>
            </div>
          </div>

          {/* Primary D3 Charts: Growth & Retention */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Crecimiento de Usuarios (D3.js · Últimos 6 Meses)</span>
                </h3>
                <span className="text-[10px] font-mono text-neutral-400">Barras = Altas · Línea = Total</span>
              </div>
              <svg ref={growthChartRef} className="w-full h-56" />
            </div>

            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Tasa de Retención Mensual % (D3.js)</span>
                </h3>
                <span className="text-[10px] font-mono text-amber-300">Objetivo SLA: 70%</span>
              </div>
              <svg ref={retentionChartRef} className="w-full h-56" />
            </div>
          </div>

          {/* Secondary D3 Charts: DB Usage, Levels & Plans */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Uso por Colección Firestore (D3.js)</span>
              </h3>
              <svg ref={dbUsageChartRef} className="w-full h-52" />
            </div>

            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-cyan-400" />
                <span>Alumnos por Nivel Educativo (D3.js)</span>
              </h3>
              <svg ref={levelChartRef} className="w-full h-52" />
            </div>

            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Distribución de Planes (D3.js)</span>
              </h3>
              <svg ref={planChartRef} className="w-full h-52" />
            </div>
          </div>

          {/* Question Bank Telemetry */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">
                  Auditoría del Banco Educativo Sin Repetición
                </h2>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-700/50">
                Total: {bankCounts.total} preguntas únicas · 0 colisiones
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                <span className="text-neutral-400 block">Evaluación por Niveles (NL2–NL100)</span>
                <strong className="text-2xl text-blue-400 mt-1 block">{bankCounts.levels} preguntas</strong>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                <span className="text-neutral-400 block">Temas Fijos Troncales</span>
                <strong className="text-2xl text-emerald-400 mt-1 block">{bankCounts.fixed} preguntas</strong>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                <span className="text-neutral-400 block">Spots Personalizables</span>
                <strong className="text-2xl text-amber-300 mt-1 block">{bankCounts.variable} preguntas</strong>
              </div>
            </div>
          </div>

          {/* Global Weakest Topics Leaderboard */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Ranking Global de Temas con Menor Precisión (Toda la Plataforma)</span>
            </h3>
            {globalCategorySummary.length === 0 ? (
              <p className="text-xs text-neutral-500">Aún no hay suficientes respuestas globales registradas.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
                {globalCategorySummary.slice(0, 9).map(item => (
                  <div key={item.category} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-white font-bold truncate">{item.category}</div>
                      <div className="text-[10px] text-neutral-500">{item.correct}/{item.attempts} aciertos globales</div>
                    </div>
                    <span className={`font-bold shrink-0 ${item.accuracy >= 75 ? 'text-emerald-400' : item.accuracy >= 55 ? 'text-amber-300' : 'text-rose-400'}`}>
                      {item.accuracy}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: SYSTEM HEALTH & WEB META BRAIN */}
      {subTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Server Health Card */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>Estado del Servidor Express &amp; API</span>
                </h3>
                <button
                  type="button"
                  onClick={() => void checkServerHealth()}
                  disabled={checkingHealth}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200 rounded-lg cursor-pointer"
                >
                  {checkingHealth ? 'Midiendo...' : 'Ping /api/health'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="text-neutral-500 block">Estado</span>
                  <strong className={healthResult?.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}>
                    {healthResult?.status?.toUpperCase() || '...'}
                  </strong>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="text-neutral-500 block">Latencia</span>
                  <strong className="text-blue-400">{healthResult?.latencyMs ?? 0} ms</strong>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="text-neutral-500 block">Muestras Web</span>
                  <strong className="text-cyan-300">{metaState.totalUserSamplesLearned}</strong>
                </div>
              </div>
            </div>

            {/* Live Internet Sync Control */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>Sincronización Manual del Cerebro Web</span>
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={syncTopic}
                  onChange={(e) => setSyncTopic(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => void handleSyncInternetMeta()}
                  disabled={syncingInternet}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60 shrink-0"
                >
                  {syncingInternet ? 'Sincronizando...' : 'Actualizar Meta Web'}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {metaState.internetQuerySummary}
              </p>
            </div>
          </div>

          {/* Active Rules */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Reglas Activas en Motor Adaptativo ({metaState.rules.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {metaState.rules.map(rule => (
                <div key={rule.id} className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{rule.topic}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                      {rule.street.toUpperCase()} · {rule.gtoFrequencyPct}%
                    </span>
                  </div>
                  <div className="text-emerald-300 font-semibold">{rule.recommendedAction}</div>
                  <p className="text-[11px] text-neutral-400">{rule.exploitativeAdjustment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: IMMUTABLE AUDIT LOGS */}
      {subTab === 'audit' && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Bitácora de Auditoría Administrativa (Firestore Inmutable)</span>
            </h3>
            <button
              type="button"
              onClick={() => void loadAuditLogs()}
              disabled={loadingLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200 rounded-lg cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Recargar</span>
            </button>
          </div>

          {loadingLogs ? (
            <p className="text-xs text-neutral-400 py-6 text-center">Cargando registros de auditoría...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-xs text-neutral-500 py-6 text-center">
              Sin acciones registradas aún. Cualquier cambio de plan, rol o reinicio de progreso quedará grabado aquí de forma inmutable.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {auditLogs.map(log => (
                <div key={log.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                        {log.action}
                      </span>
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
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 uppercase">
                      {selectedDetails.profile.planTier} · {selectedDetails.profile.planActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Nivel {selectedDetails.profile.evaluationStats.unlockedLevel} · {selectedDetails.profile.evaluationStats.xp} XP
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{selectedDetails.profile.email}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetails(null)}
                className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                aria-label="Cerrar panel de detalle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Overview Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="text-neutral-500 block">ELO Quiz / Trainer</span>
                  <strong className="text-lg text-white tabular-nums">{selectedDetails.profile.elo}</strong>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="text-neutral-500 block">Dominio Global</span>
                  <strong className="text-lg text-blue-400 tabular-nums">{selectedDetails.profile.masteryScore}%</strong>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="text-neutral-500 block flex items-center gap-1">
                    <ClipboardCheck className="w-3 h-3 text-emerald-400" /> Exámenes
                  </span>
                  <strong className="text-lg text-emerald-400 tabular-nums">
                    {selectedDetails.profile.evaluationStats.bestScorePct}% ({selectedDetails.profile.evaluationStats.passedCount}/{selectedDetails.profile.evaluationStats.examsTaken})
                  </strong>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="text-neutral-500 block flex items-center gap-1">
                    <Compass className="w-3 h-3 text-cyan-400" /> Hitos Carrera
                  </span>
                  <strong className="text-lg text-cyan-300 tabular-nums">
                    {selectedDetails.profile.roadmapDoneIds.length} / 16
                  </strong>
                </div>
              </div>

              {/* Individual Plan & Permission Controls Inside Inspector */}
              <div className="p-4 bg-neutral-900/70 border border-blue-500/30 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <KeyRound className="w-4 h-4 text-blue-400" />
                    <span>Gestión Individual de Suscripción y Permisos</span>
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
                      {selectedDetails.profile.planActive ? 'Plan Activo (Desactivar)' : 'Plan Inactivo (Activar)'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PERMISSION_ITEMS.map(item => {
                    const perms = selectedDetails.profile.planPermissions || getDefaultPlanPermissions(selectedDetails.profile.planTier, selectedDetails.profile.role === 'admin');
                    const enabled = perms[item.key];
                    const lockedAdminSelf = item.key === 'planAdmin' && isProtectedPrimaryAdmin(selectedDetails.profile) && enabled;
                    const isPlanAdminItem = item.key === 'planAdmin';
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={busyUid === selectedDetails.profile.uid || lockedAdminSelf}
                        onClick={() => void handleTogglePermission(selectedDetails.profile, item.key)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                          enabled
                            ? isPlanAdminItem
                              ? 'bg-amber-950/30 border-amber-500/60 text-white hover:bg-amber-950/50'
                              : 'bg-blue-950/30 border-blue-500/50 text-white hover:bg-blue-950/50'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>{item.label}</span>
                            {isPlanAdminItem && (
                              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/50">
                                Sistema + Cuentas
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</div>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold shrink-0 ${
                            enabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                          }`}
                        >
                          {enabled ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Educational Profile Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="text-[11px] text-neutral-500 block">Nivel Actual de Estudio</span>
                  <strong className="text-white">
                    {EDUCATIONAL_LEVELS.find(l => l.level === selectedDetails.profile.evaluationStats.unlockedLevel)?.name || 'Nivel 1'}
                  </strong>
                </div>
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-xl">
                  <span className="text-[11px] text-emerald-400 block">Punto Más Fuerte</span>
                  <strong className="text-emerald-200">{selectedDetails.profile.evaluationStats.strongestCategory}</strong>
                </div>
                <div className="p-3 bg-rose-950/20 border border-rose-900/50 rounded-xl">
                  <span className="text-[11px] text-rose-400 block">Prioridad de Repaso</span>
                  <strong className="text-rose-200">{selectedDetails.profile.evaluationStats.weakestCategory}</strong>
                </div>
              </div>

              {/* Category Stats */}
              <div className="space-y-2">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Rendimiento por Categoría (Academia + Evaluaciones)
                </h4>
                {Object.keys(selectedDetails.profile.categoryStats).length === 0 &&
                Object.keys(selectedDetails.profile.evaluationStats.categoryPerf).length === 0 ? (
                  <p className="text-neutral-500">Sin estadísticas de categorías registradas aún.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 font-mono">
                    {Object.entries({
                      ...selectedDetails.profile.categoryStats,
                      ...selectedDetails.profile.evaluationStats.categoryPerf
                    }).map(([cat, stat]) => {
                      const pct = stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0;
                      return (
                        <div key={cat} className="p-2.5 bg-neutral-900/80 border border-neutral-800 rounded-lg flex items-center justify-between">
                          <span className="text-neutral-300 truncate">{cat}</span>
                          <span className={`font-bold tabular-nums ${pct >= 75 ? 'text-emerald-400' : pct >= 55 ? 'text-amber-300' : 'text-rose-400'}`}>
                            {pct}% ({stat.correct}/{stat.attempts})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SM-2 Items */}
              <div className="space-y-2">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-blue-400" />
                  <span>Tarjetas SM-2 Sincronizadas ({selectedDetails.sm2Items.length})</span>
                </h4>
                {selectedDetails.sm2Items.length === 0 ? (
                  <p className="text-neutral-500">Sin tarjetas SM-2 en la nube.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedDetails.sm2Items.map(item => (
                      <div key={item.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white truncate">{item.title}</span>
                          <span className="font-mono text-[10px] text-blue-300 shrink-0">
                            {item.intervalDays}d · EF {item.easeFactor}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {item.category} · Reps: {item.repetitions}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mistakes >5% EV */}
              <div className="space-y-2">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Fugas Críticas Capturadas &gt;5% EV ({selectedDetails.mistakes.length})</span>
                </h4>
                {selectedDetails.mistakes.length === 0 ? (
                  <p className="text-neutral-500">Sin errores críticos registrados.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDetails.mistakes.map(m => (
                      <div key={m.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white">{m.scenarioTitle} ({m.heroCombo})</span>
                          <span className="font-mono text-rose-400 font-bold">-{m.evLossPercentOfPot}% EV</span>
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Jugada: <span className="text-rose-300">{m.chosenAction}</span> → Óptima:{' '}
                          <span className="text-emerald-300">{m.bestAction}</span>
                        </div>
                        <p className="text-[11px] text-neutral-300">{m.prescriptiveFix}</p>
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
                  <h3 className="text-sm font-bold text-white">Agregar Usuario Manualmente</h3>
                  <p className="text-[11px] text-neutral-400">
                    Pre-registra cuentas con su plan y permisos antes de su primer acceso con Google.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                aria-label="Cerrar modal nuevo usuario"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
                <label className="text-neutral-300 font-semibold block">Correo Google Autorizado</label>
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
                <div className="space-y-1.5">
                  <label className="text-neutral-300 font-semibold block">Plan Asignado</label>
                  <select
                    value={newUserTier}
                    onChange={(e) => handleNewUserTierChange(e.target.value as PlanTier)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  >
                    <option value="free">FREE</option>
                    <option value="pro">PRO</option>
                    <option value="elite">ELITE</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-neutral-300 font-semibold block">Estado de Acceso</label>
                  <button
                    type="button"
                    onClick={() => setNewUserActive(prev => !prev)}
                    className={`w-full px-3 py-2 rounded-xl border font-bold transition-colors cursor-pointer ${
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
                    const isAdminOpt = item.key === 'planAdmin';
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setNewUserPerms(prev => ({
                            ...prev,
                            [item.key]: !prev[item.key]
                          }))
                        }
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          checked
                            ? isAdminOpt
                              ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                              : 'bg-blue-950/40 border-blue-500/60 text-blue-200'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        <span className="font-semibold">{item.label}</span>
                        <span className="font-mono text-[10px] font-bold">
                          {checked ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 bg-neutral-900/70 border border-neutral-800 rounded-xl p-3 leading-relaxed">
                Al guardar, la cuenta aparecerá en tu tabla de usuarios. Cuando esa persona entre con su correo Google,
                heredará automáticamente este plan, estado y permisos (listo para integrarse con auto-registro futuro).
              </p>
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
    </div>
  );
};
