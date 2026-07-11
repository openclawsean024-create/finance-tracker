'use client';

import { useMemo, useRef, useState } from 'react';
import { useFinanceStore } from '@/lib/zustand-store';
import { CATEGORY_LABELS, TxCategory } from '@/lib/db';
import { formatNTD, monthRange, currentYearMonth } from '@/lib/utils';
import { downloadMonthlyPdf } from '@/lib/pdf';
import { BarChartCapture, PieChartCapture, withCategoryColors } from '@/components/ChartCapture';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function ReportsPage() {
  const company      = useFinanceStore(s => s.company);
  const accounts     = useFinanceStore(s => s.accounts);
  const transactions = useFinanceStore(s => s.transactions);
  const receivables  = useFinanceStore(s => s.receivables);
  const payables     = useFinanceStore(s => s.payables);
  const initialized  = useFinanceStore(s => s.initialized);

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [downloading, setDownloading] = useState(false);
  const barRef  = useRef<HTMLDivElement>(null);
  const pieRef  = useRef<HTMLDivElement>(null);

  const { start, end } = monthRange(yearMonth);
  const monthTx = useMemo(
    () => transactions.filter(t => t.date >= start && t.date <= end),
    [transactions, start, end]
  );

  const revenue = monthTx.filter(t => t.amount > 0 && !t.isTransfer).reduce((a, t) => a + t.amount, 0);
  const expense = monthTx.filter(t => t.amount < 0 && !t.isTransfer).reduce((a, t) => a + Math.abs(t.amount), 0);
  const net     = revenue - expense;

  const cashBal    = accounts.reduce((a, x) => a + (x.balance || 0), 0);
  const pendingAR  = receivables.filter(r => r.status !== 'paid').reduce((a, x) => a + x.amount, 0);
  const pendingAP  = payables.filter(p => p.status !== 'paid').reduce((a, x) => a + x.amount, 0);

  const last6Months = useMemo(() => {
    const arr: Array<{ month: string; revenue: number; expense: number }> = [];
    const base = new Date(yearMonth + '-01');
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
  }, [transactions, yearMonth]);

  const dailySeries = useMemo(() => {
    const map: Record<string, { day: string; revenue: number; expense: number }> = {};
    for (let day = 1; day <= 31; day++) {
      map[String(day).padStart(2, '0')] = { day: String(day).padStart(2, '0'), revenue: 0, expense: 0 };
    }
    for (const t of monthTx) {
      if (t.isTransfer) continue;
      const d = new Date(t.date);
      const day = String(d.getDate()).padStart(2, '0');
      if (t.amount > 0) map[day].revenue += t.amount;
      else map[day].expense += Math.abs(t.amount);
    }
    return Object.values(map);
  }, [monthTx]);

  const categoryPie = useMemo(
    () => withCategoryColors(
      (Object.entries(
        monthTx.filter(t => !t.isTransfer).reduce((acc: any, t) => {
          const v = Math.abs(t.amount);
          acc[t.category] = (acc[t.category] || 0) + v;
          return acc;
        }, {})
      ) as [TxCategory, number][])
    ),
    [monthTx]
  );

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadMonthlyPdf({
        company, yearMonth, accounts, transactions, receivables, payables,
        chartBarEl: barRef.current, chartPieEl: pieRef.current,
      });
    } catch (err) {
      console.error(err);
      alert('PDF 產生失敗：' + (err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  if (!initialized) return <div style={{ color: 'var(--muted)' }}>載入中...</div>;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>月報表（F-006 / F-007）</div>
          <h2 className="text-xl font-semibold mt-1">{yearMonth} 月報表</h2>
        </div>
        <div className="flex gap-2 items-center">
          <input type="month" className="input" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
          <button onClick={handleDownloadPdf} disabled={downloading} className="btn btn-primary text-sm whitespace-nowrap">
            {downloading ? '產生中...' : '📄 下載 PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="本月營收" value={formatNTD(revenue)} color="#10b981" />
        <KPI label="本月支出" value={formatNTD(expense)} color="#ef4444" />
        <KPI label="淨現金流" value={formatNTD(net)} color={net >= 0 ? '#10b981' : '#ef4444'} />
        <KPI label="現金水位" value={formatNTD(cashBal)} color="#3b82f6" />
        <KPI label="待收" value={formatNTD(pendingAR)} color="#f59e0b" />
        <KPI label="待付" value={formatNTD(pendingAP)} color="#ef4444" />
      </div>

      {/* 圖表區：共兩張 chart 給 PDF 截圖用 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-3">近 6 個月現金流（Bar）</h3>
          <BarChartCapture ref={barRef} data={last6Months} />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">本月 12 種分類（Pie）</h3>
          {categoryPie.length === 0 ? (
            <div className="flex items-center justify-center h-64" style={{ color: 'var(--muted)' }}>
              本月尚無資料
            </div>
          ) : (
            <PieChartCapture ref={pieRef} data={categoryPie} />
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">本月每日收支（Line）</h3>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" style={{ fontSize: 11 }} />
              <YAxis style={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatNTD(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="日營收" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expense" name="日支出" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">12 種分類細項</h3>
        <table>
          <thead><tr><th>分類</th><th>金額</th><th>占比</th></tr></thead>
          <tbody>
            {categoryPie.length === 0 ? (
              <tr><td colSpan={3} className="py-4 text-center" style={{ color: 'var(--muted)' }}>無資料</td></tr>
            ) : categoryPie.map(c => (
              <tr key={c.cat}>
                <td>{c.name}</td>
                <td className="font-semibold">{formatNTD(c.value)}</td>
                <td>{((c.value / (revenue + expense)) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card text-xs" style={{ color: 'var(--muted)' }}>
        📌 本報表為內部現金流管理用途，非 GAAP / IFRS 會計報表（SPEC ADR-006）。
        稅務申報請交由會計師事務所辦理（SPEC ADR-005）。
      </div>
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card">
      <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
