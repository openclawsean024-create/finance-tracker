// CSV 銀行格式解析器（SPEC §3.1 F-003）
// 支援 8 家銀行：台新 / 國泰 / 中信 / 玉山 / 富邦 / 永豐 / 第一 / 兆豐
import Papa from 'papaparse';
import { autoCategorize, BankFormat, TxCategory } from './db';

export interface ParsedRow {
  date: string;          // YYYY-MM-DD
  description: string;
  amount: number;        // 正=收入  負=支出
  raw: Record<string, string>;
}

export interface CsvParseResult {
  bank: BankFormat | 'unknown';
  bankName: string;
  rows: ParsedRow[];
  errors: string[];
}

// 各家銀行 CSV header 偵測特徵
const BANK_SIGNATURES: Array<{
  bank: BankFormat;
  name: string;
  match: (headers: string[]) => boolean;
}> = [
  {
    bank: 'taishin',  // 台新
    name: '台新銀行',
    match: (h) => h.some(x => /交易日|交易日期/.test(x)) && h.some(x => /提款金額|存入金額|金額/.test(x)) && h.some(x => /提存備註|備註/.test(x)),
  },
  {
    bank: 'cathay',   // 國泰世華
    name: '國泰世華',
    match: (h) => h.some(x => /交易日|交易日期/.test(x)) && (h.some(x => /支出金額|存入金額/.test(x)) || h.some(x => /支出|存入/.test(x))),
  },
  {
    bank: 'ctbc',     // 中信
    name: '中國信託',
    match: (h) => h.some(x => /交易日|交易日期/.test(x)) && h.some(x => /提款|支出/.test(x)) && h.some(x => /存入|收入/.test(x)),
  },
  {
    bank: 'esun',     // 玉山
    name: '玉山銀行',
    match: (h) => h.some(x => /交易日/.test(x)) && h.some(x => /提款金額/.test(x)) && h.some(x => /存入金額/.test(x)),
  },
  {
    bank: 'fubon',    // 富邦
    name: '台北富邦',
    match: (h) => h.some(x => /交易日|日期/.test(x)) && h.some(x => /支出金額/.test(x)) && h.some(x => /存入金額/.test(x)),
  },
  {
    bank: 'sinhwa',   // 永豐
    name: '永豐銀行',
    match: (h) => h.some(x => /交易日/.test(x)) && h.some(x => /支出|提款/.test(x)) && h.some(x => /存入|匯入/.test(x)),
  },
  {
    bank: 'first',    // 第一銀行
    name: '第一銀行',
    match: (h) => h.some(x => /交易日期/.test(x)) && h.some(x => /支出金額/.test(x)) && h.some(x => /存入金額/.test(x)) && h.some(x => /交易內容|摘要/.test(x)),
  },
  {
    bank: 'taishinmega', // 兆豐
    name: '兆豐銀行',
    match: (h) => h.some(x => /交易日|交易日期/.test(x)) && h.some(x => /支出/.test(x)) && h.some(x => /存入/.test(x)) && h.some(x => /備註|摘要/.test(x)),
  },
];

export function detectBank(headers: string[]): { bank: BankFormat; name: string } | null {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const sig of BANK_SIGNATURES) {
    if (sig.match(lower)) return { bank: sig.bank, name: sig.name };
  }
  return null;
}

// 把各種日期格式統一為 YYYY-MM-DD
function normalizeDate(raw: string): string {
  const s = raw.trim().replace(/\//g, '-');
  // 113/07/01 (民國)
  const m = /^(\d{2,3})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    let y = parseInt(m[1], 10);
    if (y < 200) y += 1911;          // 民國 → 西元
    const mm = m[2].padStart(2, '0');
    const dd = m[3].padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  // 2026/07/01
  const m2 = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m2) {
    return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  }
  return s;
}

function toNumber(s: string): number {
  if (!s) return 0;
  const clean = s.replace(/[,NT$ \t]/g, '').trim();
  return parseFloat(clean) || 0;
}

// 找 headers 中的「日期 / 描述 / 金額(支出) / 金額(存入)」index
function findCol(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    for (const p of patterns) {
      if (p.test(h)) return i;
    }
  }
  return -1;
}

export function parseCsv(content: string): CsvParseResult {
  const errors: string[] = [];
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => `Row ${e.row}: ${e.message}`));
  }

  const headers = result.meta.fields || [];

  // 偵測銀行
  const detected = detectBank(headers);
  let bank: BankFormat | 'unknown' = 'unknown';
  let bankName = '未知銀行（自訂映射）';

  if (detected) {
    bank = detected.bank;
    bankName = detected.name;
  }

  const idxDate = findCol(headers, [/交易日/, /交易日期/, /^日期/, /date/]);
  const idxDesc = findCol(headers, [/提存備註/, /備註/, /摘要/, /說明/, /remark/, /description/, /memo/]);
  const idxOut  = findCol(headers, [/提款金額/, /支出金額/, /支出/, /提款/, /withdraw/, /debit/, /out/]);
  const idxIn   = findCol(headers, [/存入金額/, /存入/, /收入/, /匯入/, /deposit/, /credit/, /in/]);
  const idxAmt  = findCol(headers, [/^金額/, /amount/, /金額$/]);

  const rows: ParsedRow[] = [];
  for (const r of result.data) {
    // 把 row 攤平成 array，方便用 index 讀
    const arr = headers.map(h => (r[h] || '').toString());
    const dateRaw = idxDate >= 0 ? arr[idxDate] : Object.values(r)[0] || '';
    const desc    = idxDesc >= 0 ? arr[idxDesc] : Object.values(r).slice(1).join(' ');
    const outAmt  = idxOut >= 0 ? toNumber(arr[idxOut]) : 0;
    const inAmt   = idxIn  >= 0 ? toNumber(arr[idxIn])  : 0;

    let amount: number;
    if (idxAmt >= 0 && (outAmt === 0 && inAmt === 0)) {
      // 單一金額欄位時，負值視為支出
      amount = toNumber(arr[idxAmt]);
    } else {
      amount = inAmt - outAmt;        // 正=收入  負=支出
    }

    if (!dateRaw || amount === 0) continue;

    rows.push({
      date: normalizeDate(dateRaw),
      description: (desc || '').trim(),
      amount,
      raw: r,
    });
  }

  return { bank, bankName, rows, errors };
}

export function autoFillCategory(rows: ParsedRow[]): Array<ParsedRow & { category: TxCategory }> {
  return rows.map(r => ({ ...r, category: autoCategorize(r.description) }));
}
