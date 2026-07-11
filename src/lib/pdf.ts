// PDF 月報表產生（SPEC §3.1 F-008 / ADR-004：jsPDF 純前端）
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Account, Company, Payable, Receivable, Transaction, CATEGORY_LABELS,
} from './db';
import { formatNTD, formatDate, monthRange, currentYearMonth } from './utils';

interface ReportData {
  company: Company | null;
  yearMonth: string;
  accounts: Account[];
  transactions: Transaction[];
  receivables: Receivable[];
  payables: Payable[];
  chartBarEl?: HTMLElement | null;       // 月度 bar chart
  chartPieEl?: HTMLElement | null;       // 分類 pie chart
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a855f7', '#84cc16', '#64748b'];

async function captureChart(el: HTMLElement | null | undefined): Promise<string | null> {
  if (!el) return null;
  const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 1.5 });
  return canvas.toDataURL('image/png');
}

export async function generateMonthlyPdf(data: ReportData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const M = 15;
  let y = 20;

  // 公司抬頭
  if (data.company) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.company.name || 'Finance Tracker', M, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (data.company.taxId) { doc.text(`Tax ID: ${data.company.taxId}`, M, y); y += 4; }
    if (data.company.address) { doc.text(data.company.address, M, y); y += 4; }
    if (data.company.responsible) { doc.text(`Resp.: ${data.company.responsible}`, M, y); y += 4; }
  }

  // 標題
  y += 2;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Monthly Report — ${data.yearMonth}`, M, y);
  y += 4;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 8;

  // KPI 五指標
  const { start, end } = monthRange(data.yearMonth);
  const monthTx = data.transactions.filter(t => t.date >= start && t.date <= end);
  const revenue  = monthTx.filter(t => t.amount > 0 && !t.isTransfer).reduce((a, t) => a + t.amount, 0);
  const expense  = monthTx.filter(t => t.amount < 0 && !t.isTransfer).reduce((a, t) => a + Math.abs(t.amount), 0);
  const net      = revenue - expense;
  const cashBal  = data.accounts.reduce((a, x) => a + (x.balance || 0), 0);
  const pendingAR = data.receivables.filter(r => r.status !== 'paid').reduce((a, x) => a + x.amount, 0);
  const pendingAP = data.payables.filter(p => p.status !== 'paid').reduce((a, x) => a + x.amount, 0);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Metrics', M, y); y += 4;
  doc.setFont('helvetica', 'normal');
  const kpiLines = [
    `Revenue (本月營收):        ${formatNTD(revenue)}`,
    `Expense (本月支出):        ${formatNTD(expense)}`,
    `Net Cash Flow (淨現金流):  ${formatNTD(net)}`,
    `Cash on Hand (現金水位):   ${formatNTD(cashBal)}`,
    `Pending Receivables (待收): ${formatNTD(pendingAR)}`,
    `Pending Payables (待付):    ${formatNTD(pendingAP)}`,
  ];
  for (const line of kpiLines) {
    doc.text(line, M, y); y += 5;
  }

  // 月度現金流圖
  if (data.chartBarEl) {
    doc.addPage();
    y = 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Cash Flow (Monthly Bars)', M, y); y += 6;
    const img = await captureChart(data.chartBarEl);
    if (img) {
      const ratio = data.chartBarEl.clientWidth / data.chartBarEl.clientHeight;
      const maxW = W - 2 * M;
      const maxH = 100;
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      doc.addImage(img, 'PNG', M, y, w, h);
      y += h + 6;
    }
  }

  // 分類 pie chart
  if (data.chartPieEl) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    if (y > 200) { doc.addPage(); y = 20; }
    doc.text('Expense / Category (Pie)', M, y); y += 6;
    const img = await captureChart(data.chartPieEl);
    if (img) {
      const ratio = data.chartPieEl.clientWidth / data.chartPieEl.clientHeight;
      const maxW = W - 2 * M;
      const maxH = 100;
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      doc.addImage(img, 'PNG', M, y, w, h);
      y += h + 6;
    }
  }

  // 12 種分類表
  if (y > 220) { doc.addPage(); y = 20; }
  const catMap: Record<string, number> = {};
  for (const t of monthTx) {
    if (t.isTransfer) continue;
    const v = Math.abs(t.amount);
    catMap[t.category] = (catMap[t.category] || 0) + v;
  }
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('12-Category Breakdown', M, y); y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  for (const [cat, v] of cats) {
    const label = (CATEGORY_LABELS as any)[cat] || cat;
    doc.text(`${label.padEnd(14)} ${formatNTD(v)}`, M, y); y += 4.5;
  }

  // 應收應付表
  if (data.receivables.length + data.payables.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Accounts Receivable / Payable', M, y); y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Receivables (應收):', M, y); y += 4;
    doc.setFont('helvetica', 'normal');
    for (const r of data.receivables) {
      doc.text(`  ${r.customerName.padEnd(20)} ${r.status.padEnd(8)} due ${formatDate(r.dueDate)} ${formatNTD(r.amount)}`, M, y); y += 4;
    }
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Payables (應付):', M, y); y += 4;
    doc.setFont('helvetica', 'normal');
    for (const p of data.payables) {
      doc.text(`  ${p.vendorName.padEnd(20)} ${p.status.padEnd(8)} due ${formatDate(p.dueDate)} ${formatNTD(p.amount)}`, M, y); y += 4;
    }
  }

  // 損益表（簡化版）
  doc.addPage();
  y = 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Profit & Loss (Simplified)', M, y); y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const plLines = [
    `Total Revenue                          ${formatNTD(revenue)}`,
    `Total Expense                          ${formatNTD(expense)}`,
    `----------------------------------------`,
    `Net Profit / (Loss)                    ${formatNTD(net)}`,
    ``,
    `Cash on Hand (All Accounts)            ${formatNTD(cashBal)}`,
    `Pending Receivables                    ${formatNTD(pendingAR)}`,
    `Pending Payables                       ${formatNTD(pendingAP)}`,
    `----------------------------------------`,
    `Projected Liquidity                    ${formatNTD(cashBal + pendingAR - pendingAP)}`,
  ];
  for (const line of plLines) { doc.text(line, M, y); y += 6; }

  // 免責聲明
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('This report is auto-generated from Finance Tracker for internal cash-flow management only.', M, 280);
  doc.text('Not a certified GAAP/IFRS accounting statement. Please consult a CPA for official filings.', M, 285);

  return doc;
}

export async function generateMonthlyPdfBlob(data: ReportData): Promise<Blob> {
  const doc = await generateMonthlyPdf(data);
  return doc.output('blob');
}

export async function downloadMonthlyPdf(data: ReportData) {
  const doc = await generateMonthlyPdf(data);
  doc.save(`monthly-report-${data.yearMonth}.pdf`);
}

export { CHART_COLORS };
