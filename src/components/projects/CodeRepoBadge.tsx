import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

const OPTIONS = [
  { value: 'not_pushed', label: 'Not Pushed', cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  { value: 'pushed', label: 'Pushed', cls: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  { value: 'conflict', label: 'Conflict', cls: 'bg-red-500/15 text-red-700 dark:text-red-400' },
];

interface Props {
  value?: string | null;
  onChange: (val: string | null) => void;
}

export default function CodeRepoBadge({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = OPTIONS.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(!open); }}
        className="focus:outline-none"
      >
        {current ? (
          <Badge variant="secondary" className={`text-[10px] cursor-pointer ${current.cls}`}>
            {current.label}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-32 rounded-lg border border-border bg-popover shadow-md py-1 right-0">
          {OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={e => { e.stopPropagation(); onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors ${value === o.value ? 'font-medium' : ''}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${o.value === 'pushed' ? 'bg-green-500' : o.value === 'not_pushed' ? 'bg-orange-500' : 'bg-red-500'}`} />
              {o.label}
            </button>
          ))}
          <div className="border-t border-border my-1" />
          <button
            onClick={e => { e.stopPropagation(); onChange(null); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
