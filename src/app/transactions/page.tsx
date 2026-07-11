'use client';

import { useMemo, useState } from 'react';
import { useFinanceStore } from '@/lib/zustand-store';
import {
  CATEGORY_LABELS, Transaction, TxCategory,
} from '@/lib/db';
import {
  addTransaction, updateTransaction, deleteTransaction,
} from '@/lib/data';
import { parseCsv, autoFillCategory } from '@/lib/csv';
import { CategoryPicker } from '@/components/CategoryPicker';
import { AccountPicker } from '@/components/AccountPicker';
import { formatNTD, formatDate } from '@/lib/utils';
import { autoCategorize } from '@/lib/db';

export default function TransactionsPage() {
  const accounts       = useFinanceStore(s => s.accounts);
  const transactions   = useFinanceStore(s => s.transactions);
  const setTransactions = useFinanceStore(s => s.setTransactions);
  const initialized    = useFinanceStore(s => s.initialized);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: formatDate(Date.now()),
    accountId: (accounts[0]?.id ?? '') as number | '',
    description: '',
    amount: 0,
    category: 'other' as TxCategory,
    notes: '',
  });

  const [searchQ, setSearchQ] = useState('');
  const [filterCat, setFilterCat] = useState<TxCategory | 'all'>('all');
  const [filterAcc, setFilterAcc] = useState<number | 'all'>('all');
  const [csvReport, setCsvReport] = useState<{ bank: string; rows: number; inserted: number } | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterCat !== 'all' && t.category !== filterCat) return false;
      if (filterAcc !== 'all' && t.accountId !== filterAcc) return false;
      if (searchQ && !t.description.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });
  }, [transactions, searchQ, filterCat, filterAcc]);

  async function reload() {
    const { listTransactions } = await import('@/lib/data');
    setTransactions(await listTransactions());
  }

  async function handleAdd() {
    if (!form.accountId) return alert('請選擇帳戶');
    if (!form.description.trim()) return alert('請輸入描述');
    if (!form.amount) return alert('請輸入金額（正值=收入，負值=支出）');
    await addTransaction({
      accountId: form.accountId as number,
      date: new Date(form.date).getTime(),
      description: form.description,
      amount: Number(form.amount),
      category: form.category,
      isAutoCategorized: false,
      notes: form.notes,
    });
    setForm({ ...form, description: '', amount: 0, notes: '' });
    setShowForm(false);
    await reload();
  }

  async function handleChangeCategory(id: number, cat: TxCategory) {
    await updateTransaction(id, { category: cat, isAutoCategorized: false });
    await reload();
  }

  async function handleDelete(id: number) {
    if (!confirm('確定刪除？')) return;
    await deleteTransaction(id);
    await reload();
  }

  async function handleImportCsv(file: File) {
    const text = await file.text();
    const result = parseCsv(text);
    if (result.rows.length === 0) {
      alert('CSV 解析失敗，請確認格式。');
      return;
    }
    // 用第一個匹配此銀行格式的帳戶
    const account = accounts.find(a => a.bankFormat === result.bank) || accounts[0];
    if (!account?.id) {
      alert('請先建立帳戶再匯入 CSV。');
      return;
    }
    const enriched = autoFillCategory(result.rows);
    let count = 0;
    for (const r of enriched) {
      await addTransaction({
        accountId: account.id!,
        date: new Date(r.date).getTime(),
        description: r.description,
        amount: r.amount,
        category: r.category,
        isAutoCategorized: true,
      });
      count++;
    }
    setCsvReport({ bank: result.bankName, rows: result.rows.length, inserted: count });
    await reload();
  }

  if (!initialized) return <div style={{ color: 'var(--muted)' }}>載入中...</div>;

  const totalIn  = filtered.filter(t => t.amount > 0 && !t.isTransfer).reduce((a, t) => a + t.amount, 0);
  const totalOut = filtered.filter(t => t.amount < 0 && !t.isTransfer).reduce((a, t) => a + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>交易 CRUD + CSV 自動匯入（F-002 / F-003 / F-004）</div>
            <div className="text-base mt-1">
              共 <b>{filtered.length}</b> 筆 · 收入 <span style={{ color: '#10b981' }}>{formatNTD(totalIn)}</span> · 支出 <span style={{ color: '#ef4444' }}>{formatNTD(totalOut)}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <label className="btn btn-secondary cursor-pointer text-sm">
              📤 匯入 CSV
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImportCsv(f); e.target.value = ''; }} />
            </label>
            <button onClick={() => setShowForm(s => !s)} className="btn btn-primary text-sm">
              {showForm ? '取消' : '+ 手動新增'}
            </button>
          </div>
        </div>

        {csvReport && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: '#ecfdf5', color: '#065f46' }}>
            ✅ 已從 <b>{csvReport.bank}</b> CSV 匯入 <b>{csvReport.inserted}</b> / {csvReport.rows} 筆交易（自動 12 種分類）
          </div>
        )}
      </div>

      {showForm && (
        <div className="card space-y-3">
          <h3 className="font-semibold">手動新增交易（F-002）</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>日期</label>
              <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>帳戶</label>
              <AccountPicker accounts={accounts} value={form.accountId}
                onChange={v => setForm({ ...form, accountId: v })} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>金額（正=收入 / 負=支出）</label>
              <input type="number" className="input" value={form.amount}
                onChange={e => {
                  const amt = parseFloat(e.target.value) || 0;
                  setForm({ ...form, amount: amt, category: amt >= 0 ? 'revenue' : form.category });
                }} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs" style={{ color: 'var(--muted)' }}>描述（輸入時自動建議 12 種分類）</label>
              <input className="input" value={form.description} placeholder="例：客戶 ABC 匯款"
                onChange={e => {
                  const desc = e.target.value;
                  setForm(f => ({ ...f, description: desc }));
                }}
                onBlur={e => {
                  // 失焦時自動建議分類（不覆蓋使用者手動選擇）
                  if (!form.description.trim()) return;
                  setForm(f => f.category === 'other' ? { ...f, category: autoCategorize(f.description) } : f);
                }} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>分類（12 種）</label>
              <CategoryPicker value={form.category} onChange={c => setForm({ ...form, category: c })} />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs" style={{ color: 'var(--muted)' }}>備註</label>
              <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn btn-primary">新增</button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary">取消</button>
          </div>
        </div>
      )}

      {/* 篩選區 */}
      <div className="card">
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="🔍 搜尋描述..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          <select className="select" value={filterCat} onChange={e => setFilterCat(e.target.value as any)}>
            <option value="all">全部分類</option>
            {(Object.entries(CATEGORY_LABELS) as [TxCategory, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select className="select" value={filterAcc} onChange={e => setFilterAcc(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}>
            <option value="all">全部帳戶</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {/* 交易列表 */}
      <div className="card">
        <h3 className="font-semibold mb-3">交易清單</h3>
        {filtered.length === 0 ? (
          <div className="py-8 text-center" style={{ color: 'var(--muted)' }}>
            尚無交易。點「+ 手動新增」或「匯入 CSV」開始建立。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>帳戶</th>
                  <th>描述</th>
                  <th>分類（可手動調整 · F-004）</th>
                  <th>金額</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map(t => {
                  const acc = accounts.find(a => a.id === t.accountId);
                  return (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td className="text-xs">{acc?.name || '?'}</td>
                      <td className="max-w-[280px] truncate">{t.description}{t.isTransfer && <span className="badge badge-yellow ml-1">內部轉帳</span>}</td>
                      <td>
                        <CategoryPicker value={t.category} onChange={c => handleChangeCategory(t.id!, c)} />
                      </td>
                      <td className="font-semibold whitespace-nowrap" style={{ color: t.amount >= 0 ? '#10b981' : '#ef4444' }}>
                        {t.amount >= 0 ? '+' : ''}{formatNTD(t.amount)}
                      </td>
                      <td>
                        <button onClick={() => handleDelete(t.id!)} className="text-xs" style={{ color: 'var(--danger)' }}>刪除</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div className="text-center py-3 text-xs" style={{ color: 'var(--muted)' }}>
                共 {filtered.length} 筆，僅顯示前 200 筆。請用篩選器縮小範圍。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
