// Dexie.js (IndexedDB) schema + CRUD 實作（SPEC §4.3 + ADR-001）
import Dexie, { Table } from 'dexie';

export type AccountType = 'bank' | 'cash' | 'digital_wallet' | 'other';
export type BankFormat = 'taishin' | 'cathay' | 'ctbc' | 'esun' | 'fubon' | 'sinhwa' | 'first' | 'taishinmega' | null;

export type TxCategory =
  | 'salary'        // 薪資
  | 'rent'          // 租金
  | 'revenue'       // 營收
  | 'purchase'      // 進貨
  | 'utilities'     // 水電
  | 'internet'      // 網路
  | 'tax'           // 稅務
  | 'interest'      // 利息
  | 'fee'           // 手續費
  | 'refund'        // 退款
  | 'personal'      // 個人
  | 'other';        // 其他

export interface Company {
  id?: number;
  name: string;
  taxId?: string;          // 統編（8 位數字）
  address?: string;
  responsible?: string;    // 負責人
  fiscalYearStart: number; // 會計年度起始月（1-12）
  email?: string;          // 應收提醒 email
  updatedAt: number;
}

export interface Account {
  id?: number;
  name: string;        // 台新銀行 / 國泰銀行 / 現金 / PayPal / Stripe / Line Pay
  type: AccountType;
  balance: number;
  currency: string;    // 預設 NTD
  bankFormat?: BankFormat;
  color?: string;      // 卡片顏色
  createdAt: number;
}

export interface Transaction {
  id?: number;
  accountId: number;
  date: number;        // timestamp
  description: string;
  amount: number;      // 正=收入  負=支出
  category: TxCategory;
  isAutoCategorized: boolean;
  notes?: string;
  isTransfer?: boolean;          // 跨帳戶轉帳（內部抵銷）
  transferPairId?: number;       // 配對交易 ID
  createdAt: number;
}

export type ApStatus = 'pending' | 'paid' | 'overdue';

export interface Receivable {
  id?: number;
  customerName: string;
  amount: number;
  dueDate: number;
  description?: string;
  status: ApStatus;
  paidDate?: number;
  reminderDaysBefore?: number;   // 預設 7
  createdAt: number;
}

export interface Payable {
  id?: number;
  vendorName: string;
  amount: number;
  dueDate: number;
  description?: string;
  status: ApStatus;
  paidDate?: number;
  reminderDaysBefore?: number;
  createdAt: number;
}

export interface MonthlyReportRecord {
  id?: number;
  yearMonth: string;   // "2026-07"
  totalRevenue: number;
  totalExpense: number;
  netCashFlow: number;
  generatedAt: number;
}

// 12 種自動分類關鍵字規則（SPEC §3.1 F-004 / ADR-003）
export const CATEGORY_KEYWORDS: Record<TxCategory, string[]> = {
  salary:    ['薪資', '薪水', '工資', 'payroll', 'salary', 'wage', 'payroll'],
  rent:      ['租金', '房租', '租賃', 'rent', 'lease'],
  revenue:   ['營業收入', '客戶付款', '匯入款項', '收款', 'revenue', 'income', 'sales', 'payment received', 'stripe payout', 'paypal received'],
  purchase:  ['進貨', '採購', '商品', '原料', 'purchase', 'merchandise', 'inventory', 'supplier'],
  utilities: ['水費', '電費', '瓦斯', '水電', '台電', '自來水', 'utility', 'electric', 'water', 'power'],
  internet:  ['網路', '中華電信', '遠傳', '台哥大', 'internet', 'broadband', 'telecom'],
  tax:       ['稅', '稅款', '營業稅', '所得稅', '扣繳', 'tax', 'vat'],
  interest:  ['利息', 'interest'],
  fee:       ['手續費', '跨行', '轉帳費', 'fee', 'charge', 'service fee'],
  refund:    ['退款', '退費', '折讓', 'refund', 'rebate'],
  personal:  ['個人', '私人', 'personal', 'family'],
  other:     [],
};

export const CATEGORY_LABELS: Record<TxCategory, string> = {
  salary:    '薪資',
  rent:      '租金',
  revenue:   '營收',
  purchase:  '進貨',
  utilities: '水電',
  internet:  '網路',
  tax:       '稅務',
  interest:  '利息',
  fee:       '手續費',
  refund:    '退款',
  personal:  '個人',
  other:     '其他',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank:           '銀行帳戶',
  cash:           '現金',
  digital_wallet: '數位錢包',
  other:          '其他',
};

export const ACCOUNT_COLOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

class FinanceDB extends Dexie {
  companies!: Table<Company, number>;
  accounts!: Table<Account, number>;
  transactions!: Table<Transaction, number>;
  receivables!: Table<Receivable, number>;
  payables!: Table<Payable, number>;
  reports!: Table<MonthlyReportRecord, number>;

  constructor() {
    super('FinanceTrackerDB');
    this.version(1).stores({
      companies:     '++id, name, taxId, updatedAt',
      accounts:      '++id, name, type, currency, createdAt',
      transactions:  '++id, accountId, date, category, isTransfer, transferPairId, createdAt, [accountId+date]',
      receivables:   '++id, customerName, dueDate, status, createdAt',
      payables:      '++id, vendorName, dueDate, status, createdAt',
      reports:       '++id, yearMonth',
    });
  }
}

// 在伺服器端（SSR）建立一個假 DB，避免 Next.js 編譯時炸掉
const isBrowser = typeof window !== 'undefined';
let _db: FinanceDB | null = null;

// SSR sentinel：避免在沒有 IndexedDB 的 Node 環境直接 new FinanceDB() 引爆
const SSR_SENTINEL: any = new Proxy({}, {
  get() {
    if (typeof window === 'undefined') {
      throw new Error('[FinanceDB] IndexedDB is not available during SSR. Call from useEffect.');
    }
    return undefined;
  },
});

export function getDB(): FinanceDB {
  if (!isBrowser) return SSR_SENTINEL as FinanceDB;
  if (!_db) _db = new FinanceDB();
  return _db;
}

// 自動分類（ADR-003：規則式 + 可手動覆寫）
export function autoCategorize(description: string): TxCategory {
  const text = description.toLowerCase();
  // 依序匹配，第一個命中即為分類
  const order: TxCategory[] = [
    'revenue', 'salary', 'rent', 'purchase', 'utilities',
    'internet', 'tax', 'interest', 'fee', 'refund', 'personal',
  ];
  for (const cat of order) {
    const kws = CATEGORY_KEYWORDS[cat];
    for (const kw of kws) {
      if (text.includes(kw.toLowerCase())) return cat;
    }
  }
  return 'other';
}
