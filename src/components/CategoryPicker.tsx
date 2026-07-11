'use client';

import { CATEGORY_LABELS, TxCategory } from '@/lib/db';

interface Props {
  value: TxCategory;
  onChange: (v: TxCategory) => void;
  categories?: TxCategory[];
}

const ALL_CATS: TxCategory[] = [
  'salary', 'rent', 'revenue', 'purchase',
  'utilities', 'internet', 'tax', 'interest',
  'fee', 'refund', 'personal', 'other',
];

export function CategoryPicker({ value, onChange, categories = ALL_CATS }: Props) {
  return (
    <select className="select" value={value} onChange={e => onChange(e.target.value as TxCategory)}>
      {categories.map(c => (
        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
      ))}
    </select>
  );
}
