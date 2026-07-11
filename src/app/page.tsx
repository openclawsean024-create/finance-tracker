'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from 'recharts';
import { useFinanceStore } from '@/lib/zustand-store';
import { CATEGORY_LABELS, TxCategory } from '@/lib/db';
import { formatNTD, monthRange, currentYearMonth, daysBetween } from '@/lib/utils';
import Link from 'next/link';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a855f7', '#84cc16', '#64748b'];

export default function DashboardPage() {
  const initialized  = useFinanceStore(s => s.initialized);
  const accounts     = useFinanceStore(s => s.accounts);
  const transactions = useFinanceStore(s => s.transactions);
  const receivables  = useFinanceStore(s => s.receivables);
  const payables     = useFinanceStore(s => s.payables);
  const company      = useFinanceStore(s => s.company);

  const ym = currentYearMonth();
  const { start, end } = monthRange(ym);

  const monthTx = useMemo(
    () => transactions.filter(t => t.date >= start && t.date <= end),
    [transactions, start, end]
  );
  const totalRevenue  = monthTx.filter(t => t.amount > 0 && !t.isTransfer).reduce((a, t) => a + t.amount, 0);
  const totalExpense  = monthTx.filter(t => t.amount < 0 && !t.isTransfer).reduce((a, t) => a + Math.abs(t.amount), 0);
  const netCashFlow   = totalRevenue - totalExpense;
  const cashBalance   = accounts.reduce((a, x) => a + (x.balance || 0), 0);
  const totalReceivables = receivables.filter(r => r.status !== 'paid').reduce((a, x) => a + x.amount, 0);
  const totalPayables    = payables.filter(p => p.status !== 'paid').reduce((a, x) => a + x.amount, 0);

  // 最近 6 個月現金流（SPEC AC-007 趨勢圖）
  const cashFlowSeries = useMemo(() => {
    const arr: Array<{ month: string; revenue: number; expense: number }> = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const { start: s, end: e } = monthRange(ymd);
      const txs = transactions.filter(t => t.date >= s && t.date <= e && !t.isTransfer);
      const rev = txs.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0);
      const exp = txs.filter(t => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);
      arr.push({ month: ymd, revenue: rev, expense: exp });
    }
    return arr;
  }, [transactions]);

  // 本月分類分析（pie chart）
  const categorySeries = useMemo(() => {
    const map: Record<TxCategory, number> = {} as any;
    for (const t of monthTx) {
      if (t.isTransfer) continue;
      const v = Math.abs(t.amount);
      map[t.category] = (map[t.category] || 0) + v;
    }
    return (Object.entries(map) as [TxCategory, number][])
      .filter(([_, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, v], i) => ({ name: CATEGORY_LABELS[cat], value: v, cat, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [monthTx]);

  // 最近 5 筆交易
  const recent = transactions.slice(0, 5);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--muted)' }}>載入中...</div>
      </div>
    );
  }

  const today = Date.now();

  return (
    <div className="space-y-6">
      {/* 公司 + 月份概要 */}
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>{company?.name || '尚未設定公司'}</div>
          <div className="text-xl font-semibold mt-1">{ym} 月報概覽</div>
        </div>
        <Link href="/reports" className="btn btn-primary text-sm">📈 前往月報表</Link>
      </div>

      {/* 5 大指標（SPEC AC-007） */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="本月營收" value={formatNTD(totalRevenue)} color="#10b981" icon="📈" />
        <MetricCard label="本月支出" value={formatNTD(totalExpense)} color="#ef4444" icon="📉" />
        <MetricCard label="淨現金流" value={formatNTD(netCashFlow)} color={netCashFlow >= 0 ? '#10b981' : '#ef4444'} icon="💰" />
        <MetricCard label="現金水位" value={formatNTD(cashBalance)} color="#3b82f6" icon="🏦" />
        <MetricCard label="應收帳款" value={formatNTD(totalReceivables)} color="#f59e0b" icon="📥" />
      </div>

      {/* 圖表區 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">近 6 個月現金流</h3>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>單位 NTD</span>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={cashFlowSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" style={{ fontSize: 11 }} />
                <YAxis style={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatNTD(Number(v))} />
                <Legend />
                <Bar dataKey="revenue" name="營收" fill="#10b981" />
                <Bar dataKey="expense" name="支出" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">本月 12 種分類分析</h3>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{categorySeries.length} 種</span>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            {categorySeries.length === 0 ? (
              <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)' }}>
                本月尚無交易，前往「交易」頁面新增或匯入
              </div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categorySeries} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {categorySeries.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatNTD(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 帳戶一覽 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">帳戶餘額（{accounts.length}）</h3>
          <Link href="/accounts" className="text-sm" style={{ color: 'var(--primary)' }}>管理帳戶 →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {accounts.map(a => (
            <div key={a.id} className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: a.color || '#64748b' }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{a.name}</span>
              </div>
              <div className="text-base font-semibold">{formatNTD(a.balance || 0)}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{a.currency}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 應收應付與最近交易 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4">近期應收帳款</h3>
          {receivables.length === 0 ? (
            <div className="text-sm py-4" style={{ color: 'var(--muted)' }}>無資料</div>
          ) : (
            <div className="space-y-2">
              {receivables.filter(r => r.status !== 'paid').slice(0, 5).map(r => {
                const days = daysBetween(today, r.dueDate);
                return (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--background)' }}>
                    <div>
                      <div className="text-sm font-medium">{r.customerName}</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        到期 {new Date(r.dueDate).toLocaleDateString('zh-TW')}
                        {days >= 0 ? `（剩 ${days} 天）` : `（已逾期 ${-days} 天）`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{formatNTD(r.amount)}</div>
                      <span className={`badge ${r.status === 'overdue' ? 'badge-red' : 'badge-yellow'}`}>
                        {r.status === 'overdue' ? '逾期' : '待收'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">最近交易</h3>
          {recent.length === 0 ? (
            <div className="text-sm py-4" style={{ color: 'var(--muted)' }}>
              尚無交易。前往「交易」頁面 <Link href="/transactions" style={{ color: 'var(--primary)' }}>新增交易</Link> 或從 CSV 匯入。
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(t => {
                const acc = accounts.find(a => a.id === t.accountId);
                return (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--background)' }}>
                    <div>
                      <div className="text-sm font-medium truncate max-w-[220px]">{t.description || '—'}</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {new Date(t.date).toLocaleDateString('zh-TW')} · {acc?.name || '?'} · {CATEGORY_LABELS[t.category]}
                      </div>
                    </div>
                    <div className={`font-semibold text-sm ${t.amount >= 0 ? '' : ''}`}
                      style={{ color: t.amount >= 0 ? '#10b981' : '#ef4444' }}>
                      {t.amount >= 0 ? '+' : ''}{formatNTD(t.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* public 警示：應付帳款 */}
      {payables.filter(p => p.status !== 'paid').length > 0 && (
        <div className="card border-l-4" style={{ borderLeftColor: '#ef4444' }}>
          <h3 className="font-semibold mb-2 text-red-700">⚠️ 待付帳款（{formatNTD(totalPayables)}）</h3>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {payables.filter(p => p.status !== 'paid').slice(0, 6).map(p => (
              <div key={p.id} className="flex justify-between p-2 rounded" style={{ background: 'var(--background)' }}>
                <span>{p.vendorName}</span>
                <span className="font-semibold">{formatNTD(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div className="text-lg md:text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
