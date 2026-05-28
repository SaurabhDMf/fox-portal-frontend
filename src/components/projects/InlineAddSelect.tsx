import { useState } from 'react';
import { Plus } from 'lucide-react';

interface OptionItem {
  name: string;
  color?: string;
}

interface Props {
  value: string;
  options: string[];
  /** Optional color-enriched options — if provided, color dots are shown */
  colorOptions?: OptionItem[];
  onChange: (v: string) => void;
  onAdd: (name: string) => void;
  placeholder?: string;
  className?: string;
}

export default function InlineAddSelect({ value, options, colorOptions, onChange, onAdd, placeholder = 'Select...', className = '' }: Props) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const getColor = (name: string) => colorOptions?.find(o => o.name === name)?.color;

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (trimmed && !options.includes(trimmed)) {
      onAdd(trimmed);
      onChange(trimmed);
    }
    setNewValue('');
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-1">
        <input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="New option..."
          className={`flex-1 px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 ${className}`}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
        />
        <button onClick={handleAdd} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">Add</button>
        <button onClick={() => setAdding(false)} className="px-2 py-1 rounded bg-secondary text-xs">✕</button>
      </div>
    );
  }

  const selectedColor = getColor(value);

  return (
    <div className="flex gap-1 items-center">
      <div className="relative flex-1">
        {selectedColor && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: selectedColor }} />
        )}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full ${selectedColor ? 'pl-5' : 'pl-2'} pr-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none ${className}`}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <button onClick={() => setAdding(true)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Add new option">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
