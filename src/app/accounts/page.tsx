'use client';

import { useState } from 'react';
import { useFinanceStore } from '@/lib/zustand-store';
import {
  ACCOUNT_TYPE_LABELS, ACCOUNT_COLOR_PALETTE,
  AccountType, BankFormat,
} from '@/lib/db';
import { addAccount, deleteAccount, updateAccount } from '@/lib/data';
import { formatNTD } from '@/lib/utils';

const TYPE_OPTIONS: AccountType[] = ['bank', 'cash', 'digital_wallet', 'other'];

const BANK_FORMATS: Array<{ value: string; label: string }> = [
  { value: '',            label: '—' },
  { value: 'taishin',     label: '台新銀行' },
  { value: 'cathay',      label: '國泰世華' },
  { value: 'ctbc',        label: '中國信託' },
  { value: 'esun',        label: '玉山銀行' },
  { value: 'fubon',       label: '台北富邦' },
  { value: 'sinhwa',      label: '永豐銀行' },
  { value: 'first',       label: '第一銀行' },
  { value: 'taishinmega', label: '兆豐銀行' },
];

export default function AccountsPage() {
  const accounts = useFinanceStore(s => s.accounts);
  const setAccounts = useFinanceStore(s => s.setAccounts);
  const transactions = useFinanceStore(s => s.transactions);
  const initialized = useFinanceStore(s => s.initialized);

  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'bank' as AccountType,
    balance: 0,
    currency: 'NTD',
    bankFormat: '' as BankFormat | '',
    color: ACCOUNT_COLOR_PALETTE[0],
  });

  async function reload() {
    const all = await (await import('@/lib/data')).listAccounts();
    setAccounts(all);
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('請輸入帳戶名稱');
    await addAccount({
      name: form.name,
      type: form.type,
      balance: Number(form.balance) || 0,
      currency: form.currency,
      bankFormat: form.bankFormat || undefined,
      color: form.color,
    });
    setForm({ ...form, name: '', balance: 0 });
    setShowForm(false);
    await reload();
  }

  async function handleDelete(id: number) {
    if (!confirm('刪除帳戶會一併刪除其交易，確定？')) return;
    await deleteAccount(id);
    await reload();
  }

  async function handleUpdate(id: number, field: 'balance' | 'name', value: number | string) {
    await updateAccount(id, { [field]: value } as any);
    await reload();
  }

  if (!initialized) return <div style={{ color: 'var(--muted)' }}>載入中...</div>;

  const totalBalance = accounts.reduce((a, x) => a + (x.balance || 0), 0);
  const txCountByAccount = transactions.reduce<Record<number, number>>((acc, t) => {
    acc[t.accountId] = (acc[t.accountId] || 0) + 1; return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>多帳戶管理（F-001 / F-002）</div>
          <div className="text-xl font-semibold mt-1">總現金水位：{formatNTD(totalBalance)}</div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn btn-primary text-sm">
          {showForm ? '取消' : '+ 新增帳戶'}
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <h3 className="font-semibold">新增帳戶</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>帳戶名稱</label>
              <input className="input" placeholder="例：台新銀行" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>類型</label>
              <select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as AccountType })}>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>初始餘額</label>
              <input className="input" type="number" value={form.balance}
                onChange={e => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>幣別</label>
              <input className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>對應銀行 CSV 格式</label>
              <select className="select" value={form.bankFormat || ''}
                onChange={e => setForm({ ...form, bankFormat: (e.target.value || '') as BankFormat | '' })}>
                {BANK_FORMATS.map(b => <option key={b.value} value={b.value || ''}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>標籤顏色</label>
              <div className="flex gap-2 mt-2">
                {ACCOUNT_COLOR_PALETTE.map(c => (
                  <button key={c} type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    style={{ background: c, width: 24, height: 24, borderRadius: 12, border: form.color === c ? '3px solid #000' : '3px solid transparent' }}
                    aria-label={c} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn btn-primary">儲存</button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary">取消</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-4">帳戶清單（{accounts.length}）</h3>
        {accounts.length === 0 ? (
          <div className="py-6" style={{ color: 'var(--muted)' }}>尚無帳戶，請新增。</div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>帳戶名稱</th>
                  <th>類型</th>
                  <th>餘額</th>
                  <th>幣別</th>
                  <th>銀行格式</th>
                  <th>交易數</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td><span className="w-3 h-3 inline-block rounded-full" style={{ background: a.color || '#64748b' }} /></td>
                    <td>
                      {editing === a.id ? (
                        <input className="input" defaultValue={a.name}
                          onBlur={e => handleUpdate(a.id!, 'name', e.target.value)} />
                      ) : (
                        a.name
                      )}
                    </td>
                    <td><span className="badge badge-blue">{ACCOUNT_TYPE_LABELS[a.type]}</span></td>
                    <td>
                      {editing === a.id ? (
                        <input className="input" type="number" defaultValue={a.balance}
                          onBlur={e => handleUpdate(a.id!, 'balance', parseFloat(e.target.value) || 0)} />
                      ) : (
                        <span className="font-semibold">{formatNTD(a.balance || 0)}</span>
                      )}
                    </td>
                    <td>{a.currency}</td>
                    <td className="text-xs">{BANK_FORMATS.find(f => f.value === a.bankFormat)?.label || '—'}</td>
                    <td>{txCountByAccount[a.id!] || 0}</td>
                    <td>
                      <button onClick={() => setEditing(editing === a.id ? null : a.id!)} className="text-xs mr-2" style={{ color: 'var(--primary)' }}>編輯</button>
                      <button onClick={() => handleDelete(a.id!)} className="text-xs" style={{ color: 'var(--danger)' }}>刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
