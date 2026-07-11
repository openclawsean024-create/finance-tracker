// Zustand store：UI 狀態 + 快取資料
import { create } from 'zustand';
import { Account, Company, Payable, Receivable, Transaction } from './db';

interface FinanceUIState {
  // 快取
  company: Company | null;
  accounts: Account[];
  transactions: Transaction[];
  receivables: Receivable[];
  payables: Payable[];

  // 設定
  initialized: boolean;

  // actions
  setCompany(c: Company | null): void;
  setAccounts(a: Account[]): void;
  setTransactions(t: Transaction[]): void;
  setReceivables(r: Receivable[]): void;
  setPayables(p: Payable[]): void;
  setInitialized(b: boolean): void;

  refreshAll(): Promise<void>;
}

export const useFinanceStore = create<FinanceUIState>((set, get) => ({
  company: null,
  accounts: [],
  transactions: [],
  receivables: [],
  payables: [],
  initialized: false,

  setCompany: (c) => set({ company: c }),
  setAccounts: (a) => set({ accounts: a }),
  setTransactions: (t) => set({ transactions: t }),
  setReceivables: (r) => set({ receivables: r }),
  setPayables: (p) => set({ payables: p }),
  setInitialized: (b) => set({ initialized: b }),

  refreshAll: async () => {
    // 由 client-only 元件負責呼叫
  },
}));
