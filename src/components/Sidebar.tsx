'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',             label: '儀表板',     icon: '📊' },
  { href: '/accounts',     label: '帳戶',       icon: '🏦' },
  { href: '/transactions', label: '交易',       icon: '💳' },
  { href: '/receivables',  label: '應收應付',   icon: '📋' },
  { href: '/reports',      label: '報表',       icon: '📈' },
  { href: '/settings',     label: '設定',       icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex flex-col w-56 border-r" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: 'var(--primary)' }}>FT</div>
          <div>
            <div className="font-semibold text-sm">Finance Tracker</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>公司財務報表</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(n => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: active ? 'var(--primary)' : 'transparent',
                color: active ? '#fff' : 'var(--foreground)',
                fontWeight: active ? 600 : 400,
              }}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-xs" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
        <div>v2.2.1 · 純前端 SPA</div>
        <div className="mt-1">IndexedDB 儲存</div>
      </div>
    </aside>
  );
}
