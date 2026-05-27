import React from 'react';
import { MentionUser } from '@/hooks/useMentionInput';

interface Props {
  users: MentionUser[];
  query: string;
  selectedIdx: number;
  onSelect: (user: MentionUser) => void;
}

export function MentionDropdown({ users, query, selectedIdx, onSelect }: Props) {
  const filtered = users
    .filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 7);

  if (!filtered.length) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
      <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border bg-secondary/30">
        Mention
      </div>
      {filtered.map((user, i) => (
        <button
          key={user.id}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
            i === selectedIdx
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-secondary text-foreground'
          }`}
          onMouseDown={e => { e.preventDefault(); onSelect(user); }}
        >
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {user.name[0]?.toUpperCase()}
          </div>
          <span className="font-medium truncate">@{user.name}</span>
        </button>
      ))}
    </div>
  );
}
