import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { StoreInitializer } from '@/components/StoreInitializer';

export const metadata: Metadata = {
  title: 'Finance Tracker — 公司財務報表 + 流動資產',
  description: '多帳戶整合 + CSV 自動匯入 + 12 種自動分類 + 一鍵 PDF 月報表',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <StoreInitializer />
        <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <TopBar />
            <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
