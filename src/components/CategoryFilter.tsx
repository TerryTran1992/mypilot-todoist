import { Category } from '../types';
import Icon from './Icon';

const CATEGORIES: Category[] = ['work', 'personal', 'family', 'health', 'learning'];

const CATEGORY_COLORS: Record<Category, { active: string; dot: string }> = {
  work: { active: 'bg-sky-900/80 text-sky-200 border-sky-800', dot: 'bg-sky-400' },
  personal: { active: 'bg-purple-900/80 text-purple-200 border-purple-800', dot: 'bg-purple-400' },
  family: { active: 'bg-rose-900/80 text-rose-200 border-rose-800', dot: 'bg-rose-400' },
  health: { active: 'bg-emerald-900/80 text-emerald-200 border-emerald-800', dot: 'bg-emerald-400' },
  learning: { active: 'bg-amber-900/80 text-amber-200 border-amber-800', dot: 'bg-amber-400' },
};

type Props = {
  value: Category | null;
  onChange: (value: Category | null) => void;
};

export default function CategoryFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon name="filter" size={12} className="text-zinc-500 shrink-0" />
      {CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(value === c ? null : c)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full cursor-pointer capitalize transition-all duration-200 ${
            value === c
              ? `${CATEGORY_COLORS[c].active} border shadow-sm`
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-raised border border-transparent'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_COLORS[c].dot}`} />
          {c}
        </button>
      ))}
    </div>
  );
}
