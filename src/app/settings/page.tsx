'use client';

import { useState } from 'react';
import { useFinanceStore } from '@/lib/zustand-store';
import { exportSnapshot, importSnapshot, saveCompany } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default function SettingsPage() {
  const company         = useFinanceStore(s => s.company);
  const setCompany      = useFinanceStore(s => s.setCompany);
  const initialized     = useFinanceStore(s => s.initialized);
  const accounts        = useFinanceStore(s => s.accounts);
  const transactions    = useFinanceStore(s => s.transactions);
  const receivables     = useFinanceStore(s => s.receivables);
  const payables        = useFinanceStore(s => s.payables);

  const [form, setForm] = useState({
    name: '',
    taxId: '',
    address: '',
    responsible: '',
    fiscalYearStart: 1,
    email: '',
  });
  const [hydrated, setHydrated] = useState(false);

  // 從 store 同步 form（初次載入）
  if (company && !hydrated) {
    setForm({
      name: company.name || '',
      taxId: company.taxId || '',
      address: company.address || '',
      responsible: company.responsible || '',
      fiscalYearStart: company.fiscalYearStart || 1,
      email: company.email || '',
    });
    setHydrated(true);
  }

  async function handleSaveCompany() {
    if (!form.name.trim()) return alert('請輸入公司名稱');
    // 統編驗證（SPEC §10.4 COMPANY_001）
    if (form.taxId && !/^\d{8}$/.test(form.taxId)) {
      return alert('統編格式錯誤：須為 8 位數字');
    }
    const id = await saveCompany(form);
    setCompany({
      id, name: form.name, taxId: form.taxId, address: form.address,
      responsible: form.responsible, fiscalYearStart: form.fiscalYearStart,
      email: form.email, updatedAt: Date.now(),
    });
    alert('✅ 公司資料已儲存');
  }

  async function handleExportJson() {
    const snap = await exportSnapshot();
    const blob = new Blob([snap], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const today = formatDate(Date.now());
    a.download = `finance-backup-${today}.json`;
    a.click();
  }

  async function handleImportJson(file: File) {
    if (!confirm('匯入會覆蓋目前所有資料，確定？')) return;
    const text = await file.text();
    try {
      await importSnapshot(text);
      alert('✅ 匯入成功，重新整理中...');
      window.location.reload();
    } catch (err) {
      alert('❌ 匯入失敗：' + (err as Error).message);
    }
  }

  async function handleDangerReset() {
    if (!confirm('⚠️ 真的要清空所有資料？此操作無法復原')) return;
    if (!confirm('請再次確認')) return;
    const Dexie = (await import('dexie')).default;
    const db = new Dexie('FinanceTrackerDB');
    db.close();
    // 重新打開清空
    const { getDB } = await import('@/lib/db');
    const realDb = getDB();
    await realDb.delete();
    window.location.reload();
  }

  if (!initialized) return <div style={{ color: 'var(--muted)' }}>載入中...</div>;

  return (
    <div className="space-y-6">
      {/* F-001 公司基本資料 */}
      <div className="card space-y-3">
        <h3 className="font-semibold">🏢 公司基本資料（F-001）</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>公司名稱 *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>統編（8 位數字）</label>
            <input className="input" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} maxLength={8} />
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>負責人</label>
            <input className="input" value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs" style={{ color: 'var(--muted)' }}>公司地址</label>
            <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>會計年度起始月</label>
            <select className="select" value={form.fiscalYearStart} onChange={e => setForm({ ...form, fiscalYearStart: parseInt(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>應收提醒 email</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
          </div>
        </div>
        <button onClick={handleSaveCompany} className="btn btn-primary">💾 儲存公司資料</button>
      </div>

      {/* F-009 JSON 匯出匯入 */}
      <div className="card space-y-3">
        <h3 className="font-semibold">📦 資料備份（F-009）</h3>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          匯出目前所有資料（公司、{accounts.length} 個帳戶、{transactions.length} 筆交易、{receivables.length} 筆應收、{payables.length} 筆應付）。
        </p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExportJson} className="btn btn-secondary">📥 匯出 JSON</button>
          <label className="btn btn-secondary cursor-pointer">
            📤 匯入 JSON
            <input type="file" accept=".json,application/json" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportJson(f); e.target.value = ''; }} />
          </label>
        </div>
      </div>

      {/* 危險區 */}
      <div className="card space-y-3 border-l-4" style={{ borderLeftColor: '#ef4444' }}>
        <h3 className="font-semibold text-red-700">⚠️ 危險操作</h3>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>清空所有資料並重置（無法復原，建議先匯出備份）</p>
        <button onClick={handleDangerReset} className="btn btn-danger">🗑️ 清空所有資料</button>
      </div>

      {/* RWD 測試提示 */}
      <div className="card text-sm space-y-2">
        <h3 className="font-semibold">📱 響應式測試</h3>
        <p style={{ color: 'var(--muted)' }}>SPEC §3.1 F-010 規定 RWD 三斷點：375 / 768 / 1440 px。</p>
        <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--muted)' }}>
          <li>375 px（手機）：側邊欄隱藏、單欄 layout、icon-only navigation</li>
          <li>768 px（平板）：側邊欄可見、雙欄 layout</li>
          <li>1440 px（桌機）：完整三欄 layout、TopBar 含 GitHub 連結</li>
        </ul>
      </div>

      <div className="card text-sm space-y-2">
        <h3 className="font-semibold">ℹ️ 關於</h3>
        <p style={{ color: 'var(--muted)' }}>Finance Tracker v2.2.1 · 純前端 SPA · Next.js 14 + TypeScript + Dexie.js (IndexedDB) + Recharts + jsPDF + PapaParse</p>
        <p style={{ color: 'var(--muted)' }}>GitHub: <a href="https://github.com/openclawsean024-create/finance-tracker" target="_blank" rel="noopener" style={{ color: 'var(--primary)' }}>openclawsean024-create/finance-tracker</a></p>
      </div>
    </div>
  );
}
