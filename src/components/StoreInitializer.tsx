'use client';

import { useEffect } from 'react';
import { useFinanceStore } from '@/lib/zustand-store';
import {
  getCompany, listAccounts, listTransactions,
  listReceivables, listPayables, refreshApStatuses, saveCompany,
} from '@/lib/data';

// 第一次載入時，自動建立一筆示範公司 + 範例帳戶（避免新使用者空白畫面）
const DEMO_COMPANY = {
  name: '示範工作室',
  taxId: '',
  address: '台北市信義區',
  responsible: '負責人',
  fiscalYearStart: 1,
  email: '',
};

const DEMO_ACCOUNTS = [
  { name: '台新銀行', type: 'bank' as const, balance: 0, currency: 'NTD', bankFormat: 'taishin' as const, color: '#3b82f6' },
  { name: '國泰世華', type: 'bank' as const, balance: 0, currency: 'NTD', bankFormat: 'cathay' as const,  color: '#10b981' },
  { name: '現金',     type: 'cash' as const, balance: 0, currency: 'NTD', color: '#f59e0b' },
  { name: 'PayPal',   type: 'digital_wallet' as const, balance: 0, currency: 'NTD', bankFormat: 'cathay' as const, color: '#8b5cf6' },
  { name: 'Stripe',   type: 'digital_wallet' as const, balance: 0, currency: 'NTD', color: '#ec4899' },
  { name: 'LINE Pay', type: 'digital_wallet' as const, balance: 0, currency: 'NTD', color: '#14b8a6' },
];

import { addAccount } from '@/lib/data';

async function ensureSeedData() {
  const company = await getCompany();
  if (!company) {
    await saveCompany(DEMO_COMPANY);
  }
  const accounts = await listAccounts();
  if (accounts.length === 0) {
    for (const a of DEMO_ACCOUNTS) {
      await addAccount(a);
    }
  }
}

export function StoreInitializer() {
  const setCompany     = useFinanceStore(s => s.setCompany);
  const setAccounts    = useFinanceStore(s => s.setAccounts);
  const setTransactions = useFinanceStore(s => s.setTransactions);
  const setReceivables = useFinanceStore(s => s.setReceivables);
  const setPayables    = useFinanceStore(s => s.setPayables);
  const setInitialized = useFinanceStore(s => s.setInitialized);

  useEffect(() => {
    (async () => {
      await ensureSeedData();
      await refreshApStatuses();
      const c = await getCompany();
      const a = await listAccounts();
      const t = await listTransactions();
      const r = await listReceivables();
      const p = await listPayables();
      setCompany(c);
      setAccounts(a);
      setTransactions(t);
      setReceivables(r);
      setPayables(p);
      setInitialized(true);
    })().catch(err => {
      console.error('StoreInitializer failed', err);
      setInitialized(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
