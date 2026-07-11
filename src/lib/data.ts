// 高階 CRUD 動作（IndexedDB + 業務邏輯）
// 包含：跨帳戶轉帳自動偵測 + 抵銷、營收/支出動態計算、應收狀態自動更新
import {
  Company, Account, Transaction, Receivable, Payable,
  getDB, autoCategorize, AccountType, BankFormat, TxCategory,
} from './db';

const db = () => getDB();

/* ========== Company ========== */
export async function getCompany(): Promise<Company | null> {
  const first = await db().companies.toArray();
  return first[0] || null;
}

export async function saveCompany(input: Omit<Company, 'id' | 'updatedAt'>): Promise<number> {
  const existing = await getCompany();
  const now = Date.now();
  const data: Company = { ...input, updatedAt: now };
  if (existing?.id) {
    await db().companies.update(existing.id, data);
    return existing.id;
  }
  return await db().companies.add(data);
}

/* ========== Accounts ========== */
export async function listAccounts(): Promise<Account[]> {
  return await db().accounts.orderBy('createdAt').toArray();
}

export async function getAccount(id: number): Promise<Account | undefined> {
  return await db().accounts.get(id);
}

export async function addAccount(input: Omit<Account, 'id' | 'createdAt' | 'balance'> & { balance?: number }): Promise<number> {
  const data: Account = {
    name: input.name,
    type: input.type,
    currency: input.currency || 'NTD',
    balance: input.balance ?? 0,
    bankFormat: input.bankFormat,
    color: input.color,
    createdAt: Date.now(),
  };
  return await db().accounts.add(data);
}

export async function updateAccount(id: number, patch: Partial<Account>): Promise<void> {
  await db().accounts.update(id, patch);
}

export async function deleteAccount(id: number): Promise<void> {
  await db().transactions.where('accountId').equals(id).delete();
  await db().accounts.delete(id);
}

/* ========== Transactions ========== */
export async function listTransactions(): Promise<Transaction[]> {
  return await db().transactions.orderBy('date').reverse().toArray();
}

export async function addTransaction(input: Omit<Transaction, 'id' | 'createdAt'>): Promise<number> {
  const data: Transaction = { ...input, createdAt: Date.now() };
  const id = await db().transactions.add(data);
  // 更新帳戶餘額
  const account = await getAccount(input.accountId);
  if (account?.id) {
    await updateAccount(account.id, { balance: (account.balance || 0) + input.amount });
  }
  // 跨帳戶轉帳偵測（SPEC §2.3）
  await detectTransfer(id, input);
  return id;
}

export async function updateTransaction(id: number, patch: Partial<Transaction>): Promise<void> {
  const old = await db().transactions.get(id);
  if (!old) return;
  await db().transactions.update(id, patch);
  // 重新計算帳戶餘額
  const account = await getAccount(old.accountId);
  if (account?.id) {
    const newAmount = patch.amount ?? old.amount;
    const diff = newAmount - old.amount;
    if (diff !== 0) {
      await updateAccount(account.id, { balance: (account.balance || 0) + diff });
    }
  }
}

export async function deleteTransaction(id: number): Promise<void> {
  const t = await db().transactions.get(id);
  if (!t) return;
  await db().transactions.delete(id);
  const account = await getAccount(t.accountId);
  if (account?.id) {
    await updateAccount(account.id, { balance: (account.balance || 0) - t.amount });
  }
}

// 跨帳戶轉帳自動偵測（AC-010）：
// 規則：同一天、金額絕對值相同、一正一負、描述包含「轉帳/transfer/轉入」
export async function detectTransfer(newId: number, t: Omit<Transaction, 'id' | 'createdAt'>): Promise<void> {
  if (t.amount === 0) return;
  const desc = t.description.toLowerCase();
  const isTransferKw = /轉帳|轉入|轉出|transfer|remit/.test(desc);
  if (!isTransferKw) return;

  const sameDayStart = new Date(t.date);
  sameDayStart.setHours(0, 0, 0, 0);
  const sameDayEnd = new Date(t.date);
  sameDayEnd.setHours(23, 59, 59, 999);

  const candidates = await db().transactions
    .where('date').between(sameDayStart.getTime(), sameDayEnd.getTime())
    .toArray();

  for (const c of candidates) {
    if (c.id === newId) continue;
    if (c.accountId === t.accountId) continue;
    if (Math.abs(c.amount + t.amount) > 0.01) continue;   // 互為相反數
    if (c.isTransfer) continue;
    // 找到配對
    await db().transactions.update(newId, { isTransfer: true });
    await db().transactions.update(c.id!, { isTransfer: true, transferPairId: newId });
    return;
  }
}

/* ========== Receivables / Payables ========== */
export async function listReceivables(): Promise<Receivable[]> {
  return await db().receivables.orderBy('dueDate').toArray();
}
export async function listPayables(): Promise<Payable[]> {
  return await db().payables.orderBy('dueDate').toArray();
}

export async function addReceivable(input: Omit<Receivable, 'id' | 'createdAt' | 'status'> & { status?: Receivable['status'] }): Promise<number> {
  return await db().receivables.add({ ...input, status: input.status || 'pending', createdAt: Date.now() });
}
export async function addPayable(input: Omit<Payable, 'id' | 'createdAt' | 'status'> & { status?: Payable['status'] }): Promise<number> {
  return await db().payables.add({ ...input, status: input.status || 'pending', createdAt: Date.now() });
}

export async function updateReceivable(id: number, patch: Partial<Receivable>): Promise<void> {
  await db().receivables.update(id, patch);
}
export async function updatePayable(id: number, patch: Partial<Payable>): Promise<void> {
  await db().payables.update(id, patch);
}

export async function deleteReceivable(id: number): Promise<void> { await db().receivables.delete(id); }
export async function deletePayable(id: number): Promise<void> { await db().payables.delete(id); }

// 把超過到期日的 pending 標記為 overdue
export async function refreshApStatuses(): Promise<void> {
  const today = Date.now();
  const rs = await db().receivables.toArray();
  for (const r of rs) {
    if (r.status === 'pending' && r.dueDate < today) {
      await db().receivables.update(r.id!, { status: 'overdue' });
    }
  }
  const ps = await db().payables.toArray();
  for (const p of ps) {
    if (p.status === 'pending' && p.dueDate < today) {
      await db().payables.update(p.id!, { status: 'overdue' });
    }
  }
}

/* ========== JSON snapshot ========== */
export async function exportSnapshot(): Promise<string> {
  const snapshot = {
    version: 1,
    exportedAt: Date.now(),
    company: await getCompany(),
    accounts: await db().accounts.toArray(),
    transactions: await db().transactions.toArray(),
    receivables: await db().receivables.toArray(),
    payables: await db().payables.toArray(),
  };
  return JSON.stringify(snapshot, null, 2);
}

export async function importSnapshot(json: string): Promise<void> {
  const snap = JSON.parse(json);
  await db().transaction('rw', db().companies, db().accounts, db().transactions, db().receivables, db().payables, async () => {
    await db().companies.clear();
    await db().accounts.clear();
    await db().transactions.clear();
    await db().receivables.clear();
    await db().payables.clear();

    if (snap.company) await db().companies.add(snap.company);
    for (const a of snap.accounts || []) await db().accounts.add(a);
    for (const t of snap.transactions || []) await db().transactions.add(t);
    for (const r of snap.receivables || []) await db().receivables.add(r);
    for (const p of snap.payables || []) await db().payables.add(p);
  });
}
