'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/':             '儀表板',
  '/accounts':     '帳戶管理',
  '/transactions': '交易記錄',
  '/receivables':  '應收應付管理',
  '/reports':      '月報表',
  '/settings':     '設定',
};

export function TopBar() {
  const pathname = usePathname();
  const key = Object.keys(TITLES).find(k => k === '/' ? pathname === '/' : pathname.startsWith(k)) || '/';
  const title = TITLES[key];

  return (
    <header className="border-b" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between p-4 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3">
          <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
        </div>
        <div className="mobile-only flex items-center gap-2 text-sm">
          <Link href="/accounts" className="px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>帳戶</Link>
          <Link href="/transactions" className="px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>交易</Link>
        </div>
        <div className="desktop-only flex items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
          <Link href="https://github.com/openclawsean024-create/finance-tracker" target="_blank" rel="noopener">GitHub</Link>
          <span>·</span>
          <span>v2.2.1</span>
        </div>
      </div>
    </header>
  );
}
