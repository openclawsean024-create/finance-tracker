'use client';

import { useState } from 'react';
import { useFinanceStore } from '@/lib/zustand-store';
import {
  addReceivable, addPayable, deleteReceivable, deletePayable,
  updateReceivable, updatePayable,
} from '@/lib/data';
import { formatNTD, formatDate, daysBetween } from '@/lib/utils';

type Tab = 'receivable' | 'payable';

export default function ReceivablesPage() {
  const receivables = useFinanceStore(s => s.receivables);
  const payables    = useFinanceStore(s => s.payables);
  const company     = useFinanceStore(s => s.company);
  const setReceivables = useFinanceStore(s => s.setReceivables);
  const setPayables    = useFinanceStore(s => s.setPayables);
  const initialized  = useFinanceStore(s => s.initialized);

  const [tab, setTab] = useState<Tab>('receivable');
  const [showForm, setShowForm] = useState(false);
  const today = formatDate(Date.now());
  const [form, setForm] = useState({
    party: '',
    amount: 0,
    dueDate: today,
    description: '',
    reminderDaysBefore: 7,
  });

  async function reload() {
    setReceivables(await (await import('@/lib/data')).listReceivables());
    setPayables(await (await import('@/lib/data')).listPayables());
  }

  async function handleAdd() {
    if (!form.party.trim()) return alert('請輸入對方名稱');
    if (form.amount <= 0) return alert('金額須大於 0');
    const due = new Date(form.dueDate).getTime();
    if (tab === 'receivable') {
      await addReceivable({
        customerName: form.party,
        amount: form.amount,
        dueDate: due,
        description: form.description,
        reminderDaysBefore: form.reminderDaysBefore,
      });
    } else {
      await addPayable({
        vendorName: form.party,
        amount: form.amount,
        dueDate: due,
        description: form.description,
        reminderDaysBefore: form.reminderDaysBefore,
      });
    }
    setForm({ ...form, party: '', amount: 0, description: '' });
    setShowForm(false);
    await reload();
  }

  async function markPaid(id: number, kind: Tab) {
    if (kind === 'receivable') {
      await updateReceivable(id, { status: 'paid', paidDate: Date.now() });
    } else {
      await updatePayable(id, { status: 'paid', paidDate: Date.now() });
    }
    await reload();
  }

  async function handleDelete(id: number, kind: Tab) {
    if (!confirm('確定刪除？')) return;
    if (kind === 'receivable') await deleteReceivable(id); else await deletePayable(id);
    await reload();
  }

  if (!initialized) return <div style={{ color: 'var(--muted)' }}>載入中...</div>;

  const recPending = receivables.filter(r => r.status !== 'paid');
  const recPaid    = receivables.filter(r => r.status === 'paid');
  const payPending = payables.filter(p => p.status !== 'paid');
  const payPaid    = payables.filter(p => p.status === 'paid');

  // 到期提醒清單（7 天內）
  const now = Date.now();
  const upcoming = [...recPending, ...payPending].filter(x => {
    const days = daysBetween(now, x.dueDate);
    return days >= -30 && days <= (x.reminderDaysBefore || 7);
  }).sort((a, b) => a.dueDate - b.dueDate);

  function exportIcs() {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Finance Tracker//zh-TW//EN'];
    for (const r of receivables) {
      const d = formatDate(r.dueDate).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', `UID:ar-${r.id}@finance-tracker`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:📥 應收 ${r.customerName} ${formatNTD(r.amount)}`, 'END:VEVENT');
    }
    for (const p of payables) {
      const d = formatDate(p.dueDate).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', `UID:ap-${p.id}@finance-tracker`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:📤 應付 ${p.vendorName} ${formatNTD(p.amount)}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finance-reminders.ics`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>應收帳款 / 應付帳款（F-005）</div>
            <div className="text-base mt-1">
              待收 <b style={{ color: '#10b981' }}>{formatNTD(recPending.reduce((a, x) => a + x.amount, 0))}</b> · 待付 <b style={{ color: '#ef4444' }}>{formatNTD(payPending.reduce((a, x) => a + x.amount, 0))}</b>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportIcs} className="btn btn-secondary text-sm">📅 匯出 ICS</button>
            <button onClick={() => setShowForm(s => !s)} className="btn btn-primary text-sm">
              {showForm ? '取消' : '+ 新增'}
            </button>
          </div>
        </div>
        {company?.email && (
          <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
            💡 提醒將寄至 <b>{company.email}</b>（v2 連接 Resend，v1 顯示於「到期前 N 天」面板 + ICS）
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="card border-l-4" style={{ borderLeftColor: '#f59e0b' }}>
          <h3 className="font-semibold mb-3">⏰ 即將到期（{upcoming.length}）</h3>
          <div className="space-y-2">
            {upcoming.slice(0, 10).map(x => {
              const days = daysBetween(now, x.dueDate);
              const isReceivable = 'customerName' in x;
              return (
                <div key={`${isReceivable ? 'r' : 'p'}-${x.id}`} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--background)' }}>
                  <div>
                    <span className="badge mr-2" style={{ background: isReceivable ? '#d1fae5' : '#fee2e2' }}>
                      {isReceivable ? '📥 應收' : '📤 應付'}
                    </span>
                    <span className="font-medium">{isReceivable ? (x as any).customerName : (x as any).vendorName}</span>
                    <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>{formatDate(x.dueDate)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{formatNTD(x.amount)}</span>
                    <span className="ml-2 text-xs" style={{ color: days < 0 ? '#ef4444' : days <= 3 ? '#f59e0b' : 'var(--muted)' }}>
                      {days < 0 ? `已逾期 ${-days} 天` : days === 0 ? '今天' : `剩 ${days} 天`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setTab('receivable')} className={`btn text-sm ${tab === 'receivable' ? 'btn-primary' : 'btn-secondary'}`}>應收</button>
            <button onClick={() => setTab('payable')}    className={`btn text-sm ${tab === 'payable'    ? 'btn-primary' : 'btn-secondary'}`}>應付</button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>{tab === 'receivable' ? '客戶名稱' : '供應商名稱'}</label>
              <input className="input" value={form.party} onChange={e => setForm({ ...form, party: e.target.value })} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>金額</label>
              <input className="input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>到期日</label>
              <input className="input" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>提醒（到期前幾天）</label>
              <input className="input" type="number" value={form.reminderDaysBefore} onChange={e => setForm({ ...form, reminderDaysBefore: parseInt(e.target.value) || 7 })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs" style={{ color: 'var(--muted)' }}>備註</label>
              <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn btn-primary">儲存</button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary">取消</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-3">📥 待收帳款（{recPending.length}）</h3>
        {recPending.length === 0 ? (
          <div className="py-4 text-sm" style={{ color: 'var(--muted)' }}>無待收帳款</div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>客戶</th><th>金額</th><th>到期</th><th>狀態</th><th></th></tr></thead>
              <tbody>
                {recPending.map(r => {
                  const days = daysBetween(now, r.dueDate);
                  return (
                    <tr key={r.id}>
                      <td>{r.customerName}<div className="text-xs" style={{ color: 'var(--muted)' }}>{r.description}</div></td>
                      <td className="font-semibold">{formatNTD(r.amount)}</td>
                      <td>{formatDate(r.dueDate)}<div className="text-xs" style={{ color: days < 0 ? '#ef4444' : 'var(--muted)' }}>{days >= 0 ? `剩 ${days} 天` : `逾期 ${-days} 天`}</div></td>
                      <td><span className={`badge ${r.status === 'overdue' ? 'badge-red' : 'badge-yellow'}`}>{r.status === 'overdue' ? '逾期' : '待收'}</span></td>
                      <td>
                        <button onClick={() => markPaid(r.id!, 'receivable')} className="text-xs mr-2" style={{ color: '#10b981' }}>標記已收</button>
                        <button onClick={() => handleDelete(r.id!, 'receivable')} className="text-xs" style={{ color: 'var(--danger)' }}>刪除</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">📤 待付帳款（{payPending.length}）</h3>
        {payPending.length === 0 ? (
          <div className="py-4 text-sm" style={{ color: 'var(--muted)' }}>無待付帳款</div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>供應商</th><th>金額</th><th>到期</th><th>狀態</th><th></th></tr></thead>
              <tbody>
                {payPending.map(p => {
                  const days = daysBetween(now, p.dueDate);
                  return (
                    <tr key={p.id}>
                      <td>{p.vendorName}<div className="text-xs" style={{ color: 'var(--muted)' }}>{p.description}</div></td>
                      <td className="font-semibold">{formatNTD(p.amount)}</td>
                      <td>{formatDate(p.dueDate)}<div className="text-xs" style={{ color: days < 0 ? '#ef4444' : 'var(--muted)' }}>{days >= 0 ? `剩 ${days} 天` : `逾期 ${-days} 天`}</div></td>
                      <td><span className={`badge ${p.status === 'overdue' ? 'badge-red' : 'badge-yellow'}`}>{p.status === 'overdue' ? '逾期' : '待付'}</span></td>
                      <td>
                        <button onClick={() => markPaid(p.id!, 'payable')} className="text-xs mr-2" style={{ color: '#10b981' }}>標記已付</button>
                        <button onClick={() => handleDelete(p.id!, 'payable')} className="text-xs" style={{ color: 'var(--danger)' }}>刪除</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(recPaid.length + payPaid.length) > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">📜 已結清記錄（{recPaid.length + payPaid.length}）</summary>
          <div className="mt-3 space-y-1 text-sm">
            {recPaid.map(r => (
              <div key={r.id} className="flex justify-between">
                <span>✅ {r.customerName} — {formatDate(r.paidDate || r.dueDate)}</span>
                <span className="font-semibold" style={{ color: '#10b981' }}>{formatNTD(r.amount)}</span>
              </div>
            ))}
            {payPaid.map(p => (
              <div key={p.id} className="flex justify-between">
                <span>✅ {p.vendorName} — {formatDate(p.paidDate || p.dueDate)}</span>
                <span className="font-semibold" style={{ color: '#10b981' }}>{formatNTD(p.amount)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
