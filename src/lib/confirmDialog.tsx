import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Listener = (opts: ConfirmOptions, resolve: (ok: boolean) => void) => void;

let listener: Listener | null = null;

/**
 * Imperative confirmation prompt. Returns a Promise<boolean>.
 * If no host is mounted, defaults to native window.confirm.
 */
export function confirmAction(opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (listener) {
      listener(opts, resolve);
    } else {
      const ok = window.confirm(opts.description || opts.title || 'Are you sure?');
      resolve(ok);
    }
  });
}

/** Convenience for delete confirmations */
export function confirmDelete(description = 'This action cannot be undone.'): Promise<boolean> {
  return confirmAction({
    title: 'Delete this item?',
    description,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    destructive: true,
  });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<{
    open: boolean;
    opts: ConfirmOptions;
    resolve?: (ok: boolean) => void;
  }>({ open: false, opts: {} });

  useEffect(() => {
    listener = (opts, resolve) => setState({ open: true, opts, resolve });
    return () => { listener = null; };
  }, []);

  const close = (ok: boolean) => {
    state.resolve?.(ok);
    setState((s) => ({ ...s, open: false, resolve: undefined }));
  };

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open]);

  if (!state.open) return null;

  const {
    title = 'Are you sure?',
    description = 'This action cannot be undone.',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = true,
  } = state.opts;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
         onClick={() => close(false)}>
      <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <button onClick={() => close(false)} className="p-1 rounded-md hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary"
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => close(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all ${
              destructive
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
