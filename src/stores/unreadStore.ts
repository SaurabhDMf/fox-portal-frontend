import { create } from 'zustand';

// Maps notification type → sidebar module key
export const typeToModule: Record<string, string> = {
  task:    'projects',
  mention: 'chat',
  message: 'chat',
  lead:    'crm',
  invoice: 'invoicing',
  payroll: 'payroll',
  leave:   'payroll',
  ticket:  'tickets',
  email:   'email',
};

interface UnreadState {
  counts: Record<string, number>;
  bump:     (module: string) => void;
  clear:    (module: string) => void;
  setCount: (module: string, n: number) => void;
  setAll:   (all: Record<string, number>) => void;
}

export const useUnreadStore = create<UnreadState>((set) => ({
  counts: {},
  bump:     (module) => set((s) => ({ counts: { ...s.counts, [module]: (s.counts[module] || 0) + 1 } })),
  clear:    (module) => set((s) => ({ counts: { ...s.counts, [module]: 0 } })),
  setCount: (module, n) => set((s) => ({ counts: { ...s.counts, [module]: n } })),
  setAll:   (all) => set({ counts: all }),
}));
