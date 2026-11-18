/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BillingRevenuePanel: Módulo de Ingresos, Pagos, Facturación y MRR (D3.js + Firestore).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  adminCreateBillingTransaction,
  adminUpdateBillingStatus,
  type BillingPaymentMethod,
  type BillingStatus,
  type BillingTransactionEntry,
  type UserProfileDoc
} from '../lib/adminCloudSync';
import type { PlanTier } from '../lib/planCatalog';
import {
  DollarSign,
  Plus,
  Download,
  CreditCard,
  Clock,
  CheckCircle2,
  RotateCcw,
  X,
  TrendingUp,
  Search
} from 'lucide-react';

interface BillingRevenuePanelProps {
  users: UserProfileDoc[];
  transactions: BillingTransactionEntry[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onUserPlanSynced: () => Promise<void>;
  onStatus: (msg: string) => void;
  onError: (err: string) => void;
}

const DEFAULT_PRICES_USD: Record<PlanTier, number> = {
  free: 0,
  pro: 29,
  elite: 79
};

export const BillingRevenuePanel: React.FC<BillingRevenuePanelProps> = ({
  users,
  transactions,
  loading,
  onRefresh,
  onUserPlanSynced,
  onStatus,
  onError
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BillingStatus>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTxId, setBusyTxId] = useState<string | null>(null);

  // Modal Form State
  const [selectedUserUid, setSelectedUserUid] = useState<string>('');
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [planTier, setPlanTier] = useState<PlanTier>('pro');
  const [amountUsd, setAmountUsd] = useState<number>(29);
  const [paymentMethod, setPaymentMethod] = useState<BillingPaymentMethod>('Stripe');
  const [txStatus, setTxStatus] = useState<BillingStatus>('paid');
  const [billingPeriod, setBillingPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [referenceCode, setReferenceCode] = useState('');
  const [notes, setNotes] = useState('');
  const [alsoActivatePlan, setAlsoActivatePlan] = useState(true);

  const revenueChartRef = useRef<SVGSVGElement | null>(null);

  const metrics = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const paidTxs = transactions.filter(t => t.status === 'paid');
    const totalCollectedUsd = Math.round(paidTxs.reduce((s, t) => s + t.amountUsd, 0) * 100) / 100;
    const monthRevenueUsd =
      Math.round(
        paidTxs.filter(t => t.billingPeriod === currentMonth).reduce((s, t) => s + t.amountUsd, 0) * 100
      ) / 100;
    const pendingUsd =
      Math.round(
        transactions.filter(t => t.status === 'pending').reduce((s, t) => s + t.amountUsd, 0) * 100
      ) / 100;
    const activePro = users.filter(u => u.planActive && u.planTier === 'pro').length;
    const activeElite = users.filter(u => u.planActive && u.planTier === 'elite').length;
    const estimatedMrr = activePro * DEFAULT_PRICES_USD.pro + activeElite * DEFAULT_PRICES_USD.elite;

    return {
      totalCollectedUsd,
      monthRevenueUsd,
      pendingUsd,
      estimatedMrr,
      paidCount: paidTxs.length,
      activePaidUsers: activePro + activeElite
    };
  }, [transactions, users]);

  const filteredTxs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactions.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.userName.toLowerCase().includes(q) ||
        t.userEmail.toLowerCase().includes(q) ||
        t.referenceCode.toLowerCase().includes(q) ||
        t.paymentMethod.toLowerCase().includes(q)
      );
    });
  }, [transactions, searchTerm, statusFilter]);

  useEffect(() => {
    if (!revenueChartRef.current) return;
    const svg = d3.select(revenueChartRef.current);
    svg.selectAll('*').remove();

    // Build last 6 months series
    const now = new Date();
    const months: Array<{ period: string; label: string; pro: number; elite: number }> = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
      const paidMonth = transactions.filter(t => t.status === 'paid' && t.billingPeriod === period);
      const pro = paidMonth.filter(t => t.planTier === 'pro').reduce((s, t) => s + t.amountUsd, 0);
      const elite = paidMonth.filter(t => t.planTier === 'elite').reduce((s, t) => s + t.amountUsd, 0);
      months.push({ period, label, pro, elite });
    }

    const width = 520;
    const height = 220;
    const margin = { top: 20, right: 20, bottom: 32, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(months.map(m => m.label)).range([0, innerW]).padding(0.35);
    const maxTotal = Math.max(100, d3.max(months, m => m.pro + m.elite) || 100);
    const y = d3.scaleLinear().domain([0, maxTotal]).nice().range([innerH, 0]);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('fill', '#a3a3a3')
      .style('font-size', '10px');

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => `$${d}`))
      .selectAll('text')
      .attr('fill', '#a3a3a3')
      .style('font-size', '10px');

    g.selectAll('.domain, .tick line').attr('stroke', '#262626');

    g.selectAll('.bar-pro')
      .data(months)
      .enter()
      .append('rect')
      .attr('x', d => x(d.label) || 0)
      .attr('y', d => y(d.pro))
      .attr('width', x.bandwidth())
      .attr('height', d => Math.max(0, innerH - y(d.pro)))
      .attr('rx', 3)
      .attr('fill', '#3b82f6');

    g.selectAll('.bar-elite')
      .data(months)
      .enter()
      .append('rect')
      .attr('x', d => x(d.label) || 0)
      .attr('y', d => y(d.pro + d.elite))
      .attr('width', x.bandwidth())
      .attr('height', d => Math.max(0, y(d.pro) - y(d.pro + d.elite)))
      .attr('rx', 3)
      .attr('fill', '#f59e0b');

    g.selectAll('.rev-lbl')
      .data(months)
      .enter()
      .append('text')
      .attr('x', d => (x(d.label) || 0) + x.bandwidth() / 2)
      .attr('y', d => y(d.pro + d.elite) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e5e5e5')
      .style('font-size', '10px')
      .style('font-family', 'monospace')
      .style('font-weight', '700')
      .text(d => (d.pro + d.elite > 0 ? `$${Math.round(d.pro + d.elite)}` : ''));
  }, [transactions]);

  const handleOpenModal = () => {
    const firstUser = users[0];
    setSelectedUserUid(firstUser?.uid || '');
    setCustomEmail(firstUser?.email || '');
    setCustomName(firstUser?.displayName || '');
    setPlanTier('pro');
    setAmountUsd(DEFAULT_PRICES_USD.pro);
    setPaymentMethod('Stripe');
    setTxStatus('paid');
    setBillingPeriod(new Date().toISOString().slice(0, 7));
    setReferenceCode(`INV-${Date.now().toString().slice(-6)}`);
    setNotes('');
    setAlsoActivatePlan(true);
    setShowAddModal(true);
  };

  const handleSelectUser = (uid: string) => {
    setSelectedUserUid(uid);
    const found = users.find(u => u.uid === uid);
    if (found) {
      setCustomEmail(found.email);
      setCustomName(found.displayName);
      if (found.planTier === 'elite' || found.planTier === 'pro') {
        setPlanTier(found.planTier);
        setAmountUsd(DEFAULT_PRICES_USD[found.planTier]);
      }
    }
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customEmail.includes('@')) {
      onError('Ingresa un correo electrónico válido para registrar el pago.');
      return;
    }
    setSaving(true);
    try {
      await adminCreateBillingTransaction({
        userUid: selectedUserUid || `ext_${Date.now()}`,
        userEmail: customEmail,
        userName: customName || customEmail.split('@')[0],
        planTier,
        amountUsd,
        paymentMethod,
        status: txStatus,
        billingPeriod,
        referenceCode,
        notes,
        alsoActivatePlan
      });
      setShowAddModal(false);
      await onRefresh();
      if (alsoActivatePlan) {
        await onUserPlanSynced();
      }
      onStatus(`Pago de $${amountUsd} USD (${planTier.toUpperCase()}) registrado correctamente.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeTxStatus = async (tx: BillingTransactionEntry, nextStatus: BillingStatus) => {
    setBusyTxId(tx.id);
    try {
      await adminUpdateBillingStatus(tx, nextStatus);
      await onRefresh();
      onStatus(`Estado de factura ${tx.referenceCode || tx.id} cambiado a ${nextStatus.toUpperCase()}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del pago.');
    } finally {
      setBusyTxId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Periodo', 'Usuario', 'Email', 'Plan', 'MontoUSD', 'Metodo', 'Estado', 'Referencia', 'Notas'];
    const rows = filteredTxs.map(t => [
      t.id,
      t.billingPeriod,
      `"${t.userName.replace(/"/g, '""')}"`,
      t.userEmail,
      t.planTier.toUpperCase(),
      t.amountUsd,
      t.paymentMethod,
      t.status.toUpperCase(),
      t.referenceCode,
      `"${t.notes.replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `allin-studio-ingresos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onStatus(`Exportadas ${filteredTxs.length} transacciones a CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Header + Dummy-Friendly Explanation */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Ingresos, Pagos y Facturación SaaS</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Registra pagos recibidos (Stripe, Transferencia, PayPal o Efectivo), controla renovaciones mensuales y activa el plan del alumno automáticamente al confirmar su cobro.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-xl font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exportar Contabilidad CSV</span>
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Pago / Renovación</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 block">MRR Activo Estimado (Suscripciones)</span>
          <strong className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">
            ${metrics.estimatedMrr.toLocaleString('en-US')} USD
          </strong>
          <span className="text-[11px] text-neutral-500">{metrics.activePaidUsers} cuentas Pro/Elite activas</span>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 block">Cobrado Este Mes</span>
          <strong className="text-2xl font-bold text-blue-400 font-mono mt-1 block">
            ${metrics.monthRevenueUsd.toLocaleString('en-US')} USD
          </strong>
          <span className="text-[11px] text-neutral-500">Periodo {new Date().toISOString().slice(0, 7)}</span>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 block">Total Histórico Cobrado</span>
          <strong className="text-2xl font-bold text-white font-mono mt-1 block">
            ${metrics.totalCollectedUsd.toLocaleString('en-US')} USD
          </strong>
          <span className="text-[11px] text-neutral-500">{metrics.paidCount} facturas confirmadas</span>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-neutral-400 block">Por Cobrar / Pendiente</span>
          <strong className="text-2xl font-bold text-amber-300 font-mono mt-1 block">
            ${metrics.pendingUsd.toLocaleString('en-US')} USD
          </strong>
          <span className="text-[11px] text-neutral-500">Pagos en espera de verificación</span>
        </div>
      </div>

      {/* D3 Chart + Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Ingresos Mensuales por Plan (D3.js · Últimos 6 Meses)</span>
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-400">
              <span className="text-blue-400">Azul = Pro</span>
              <span>·</span>
              <span className="text-amber-400">Ámbar = Elite</span>
            </div>
          </div>
          <svg ref={revenueChartRef} className="w-full h-56" />
        </div>

        <div className="lg:col-span-4 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-400" />
            <span>Guía Rápida de Cobros</span>
          </h3>
          <ol className="space-y-2.5 text-neutral-300 leading-relaxed">
            <li>
              <strong className="text-white">1. Cobro confirmado:</strong> Pulsa <em>Registrar Pago</em>, elige al alumno y marca <strong>Activar plan automáticamente</strong>.
            </li>
            <li>
              <strong className="text-white">2. Renovación pendiente:</strong> Si un alumno promete pago, regístralo como <em>Pendiente</em> y cámbialo a <em>Pagado</em> con 1 clic al recibirlo.
            </li>
            <li>
              <strong className="text-white">3. Auditoría inmutable:</strong> Las facturas nunca se borran; si hay devolución, cambia su estado a <em>Reembolsado</em>.
            </li>
          </ol>
        </div>
      </div>

      {/* Filter & Ledger Table */}
      <div className="space-y-3">
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between text-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por alumno, correo, referencia o método..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-neutral-500 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | BillingStatus)}
              className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
            >
              <option value="all">Todos los Estados</option>
              <option value="paid">Solo Pagados</option>
              <option value="pending">Solo Pendientes</option>
              <option value="refunded">Solo Reembolsados</option>
            </select>
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 font-semibold">
                  <th className="py-3 px-4">Alumno</th>
                  <th className="py-3 px-4 font-mono">Periodo</th>
                  <th className="py-3 px-4 font-mono">Plan</th>
                  <th className="py-3 px-4 font-mono">Monto</th>
                  <th className="py-3 px-4">Método / Ref</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Cambiar Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-400">
                      Cargando libro contable desde Firestore...
                    </td>
                  </tr>
                ) : filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center space-y-2">
                      <div className="text-neutral-400">No hay pagos registrados todavía.</div>
                      <button
                        type="button"
                        onClick={handleOpenModal}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
                      >
                        Registrar Primer Pago
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map(tx => (
                    <tr key={tx.id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{tx.userName}</div>
                        <div className="text-[11px] text-neutral-400">{tx.userEmail}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-300">{tx.billingPeriod}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-300 uppercase">{tx.planTier}</td>
                      <td className="py-3 px-4 font-mono font-bold text-white">${tx.amountUsd.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <div className="text-neutral-200 font-medium">{tx.paymentMethod}</div>
                        {tx.referenceCode && (
                          <div className="text-[10px] font-mono text-neutral-500">{tx.referenceCode}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {tx.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pagado
                          </span>
                        ) : tx.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                            <Clock className="w-3.5 h-3.5" /> Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                            <RotateCcw className="w-3.5 h-3.5" /> Reembolsado
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {tx.status !== 'paid' && (
                            <button
                              type="button"
                              disabled={busyTxId === tx.id}
                              onClick={() => void handleChangeTxStatus(tx, 'paid')}
                              className="px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 rounded-lg font-semibold cursor-pointer"
                            >
                              Confirmar Pago
                            </button>
                          )}
                          {tx.status === 'paid' && (
                            <button
                              type="button"
                              disabled={busyTxId === tx.id}
                              onClick={() => void handleChangeTxStatus(tx, 'refunded')}
                              className="px-2.5 py-1 bg-neutral-900 hover:bg-rose-950 border border-neutral-800 hover:border-rose-700 text-neutral-300 hover:text-rose-200 rounded-lg font-semibold cursor-pointer"
                            >
                              Reembolsar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={(e) => void handleCreateTx(e)}
            className="max-w-lg w-full bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-xs"
          >
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
              <div>
                <h3 className="text-sm font-bold text-white">Registrar Pago / Renovación</h3>
                <p className="text-[11px] text-neutral-400">
                  Asienta un ingreso contable y sincroniza la suscripción del alumno.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              {users.length > 0 && (
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Seleccionar Alumno Registrado</label>
                  <select
                    value={selectedUserUid}
                    onChange={(e) => handleSelectUser(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName} ({u.email}) — {u.planTier.toUpperCase()}
                      </option>
                    ))}
                    <option value="">-- Otro correo externo --</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Nombre del Alumno</label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Correo del Alumno</label>
                  <input
                    type="email"
                    required
                    maxLength={160}
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Plan</label>
                  <select
                    value={planTier}
                    onChange={(e) => {
                      const nextTier = e.target.value as PlanTier;
                      setPlanTier(nextTier);
                      setAmountUsd(DEFAULT_PRICES_USD[nextTier]);
                    }}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  >
                    <option value="free">FREE</option>
                    <option value="pro">PRO</option>
                    <option value="elite">ELITE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Monto (USD)</label>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step="0.01"
                    required
                    value={amountUsd}
                    onChange={(e) => setAmountUsd(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Periodo (Mes)</label>
                  <input
                    type="month"
                    required
                    value={billingPeriod}
                    onChange={(e) => setBillingPeriod(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as BillingPaymentMethod)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Stripe">Stripe / Tarjeta</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Cortesía">Cortesía / Beca</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Estado del Cobro</label>
                  <select
                    value={txStatus}
                    onChange={(e) => setTxStatus(e.target.value as BillingStatus)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="paid">Pagado (Confirmado)</option>
                    <option value="pending">Pendiente de Verificación</option>
                    <option value="refunded">Reembolsado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Referencia / Recibo</label>
                  <input
                    type="text"
                    maxLength={64}
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    placeholder="Ej: INV-90421"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-300 font-semibold block">Notas Internas</label>
                  <input
                    type="text"
                    maxLength={240}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Renovación mensual..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoActivatePlan}
                  onChange={(e) => setAlsoActivatePlan(e.target.checked)}
                  className="accent-blue-500 w-4 h-4"
                />
                <span className="text-blue-200 font-medium">
                  Activar y actualizar automáticamente el plan del usuario en el Aula al guardar
                </span>
              </label>
            </div>

            <div className="p-4 border-t border-neutral-800 bg-neutral-900/40 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-xl font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Transacción'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
