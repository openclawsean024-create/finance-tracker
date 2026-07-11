'use client';

import { Account } from '@/lib/db';

interface Props {
  accounts: Account[];
  value: number | '';
  onChange: (v: number) => void;
  placeholder?: string;
}

export function AccountPicker({ accounts, value, onChange, placeholder = '選擇帳戶' }: Props) {
  return (
    <select className="select" value={value} onChange={e => onChange(parseInt(e.target.value, 10))}>
      <option value="">{placeholder}</option>
      {accounts.map(a => (
        <option key={a.id} value={a.id}>{a.name}（{a.currency}）</option>
      ))}
    </select>
  );
}
