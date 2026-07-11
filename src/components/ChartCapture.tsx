'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { CATEGORY_LABELS, TxCategory } from '@/lib/db';
import { formatNTD } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/pdf';

interface BarProps {
  data: Array<{ month: string; revenue: number; expense: number }>;
}

interface PieProps {
  data: Array<{ name: string; value: number; color: string; cat: TxCategory }>;
}

export const BarChartCapture = forwardRef<HTMLDivElement, BarProps>(({ data }, ref) => {
  const internalRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => internalRef.current as HTMLDivElement);
  return (
    <div ref={internalRef} style={{ background: '#fff', padding: 8, width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" style={{ fontSize: 11 }} />
          <YAxis style={{ fontSize: 11 }} />
          <Tooltip formatter={(v: any) => formatNTD(Number(v))} />
          <Legend />
          <Bar dataKey="revenue" name="營收" fill="#10b981" />
          <Bar dataKey="expense" name="支出" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
BarChartCapture.displayName = 'BarChartCapture';

export const PieChartCapture = forwardRef<HTMLDivElement, PieProps>(({ data }, ref) => {
  const internalRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => internalRef.current as HTMLDivElement);
  return (
    <div ref={internalRef} style={{ background: '#fff', padding: 8, width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
            {data.map((c, i) => <Cell key={i} fill={c.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => formatNTD(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});
PieChartCapture.displayName = 'PieChartCapture';

// 給 categories series 加上顏色
export function withCategoryColors(entries: Array<[TxCategory, number]>) {
  return entries.filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, v], i) => ({ name: CATEGORY_LABELS[cat], value: v, cat, color: CHART_COLORS[i % CHART_COLORS.length] }));
}
