import { useState, RefObject } from 'react';

export interface MentionUser { id: string; name: string; }

export function useMentionInput(
  value: string,
  setValue: (v: string) => void,
  inputRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>
) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState('');
  const [anchorPos, setAnchorPos] = useState(0);
  const [idx, setIdx] = useState(0);

  const detect = (text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const m = before.match(/@(\w*)$/);
    if (m) { setActive(true); setQuery(m[1]); setAnchorPos(cursor - m[0].length); setIdx(0); }
    else setActive(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    detect(v, e.target.selectionStart ?? v.length);
  };

  const selectUser = (user: MentionUser) => {
    const el = inputRef.current as HTMLTextAreaElement | null;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, anchorPos);
    const after = value.slice(cursor);
    const next = `${before}@${user.name} ${after}`;
    setValue(next);
    setActive(false);
    requestAnimationFrame(() => {
      if (el) {
        const pos = anchorPos + user.name.length + 2;
        el.setSelectionRange(pos, pos);
        el.focus();
      }
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    filteredCount: number,
    passThrough?: (e: React.KeyboardEvent) => void
  ) => {
    if (active && filteredCount > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, filteredCount - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Escape') { e.preventDefault(); setActive(false); return; }
    }
    passThrough?.(e);
  };

  return { active, query, idx, setIdx, selectUser, handleChange, handleKeyDown, close: () => setActive(false) };
}
