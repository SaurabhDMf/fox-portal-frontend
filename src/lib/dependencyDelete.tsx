import { useEffect, useState } from 'react';
import { AlertTriangle, X, ExternalLink, Loader2 } from 'lucide-react';
import api from './api';
import toast from 'react-hot-toast';

/**
 * Centralized helper for delete actions that may have FK dependencies.
 *
 * Backend contract:
 *   - 200 → success (optional `warning` string in response body)
 *   - 409 → blocked by dependencies. Body shape:
 *       {
 *         message?: string,
 *         dependencies: { invoices?: number, leads?: number, projects?: number, ... },
 *         hint?: string
 *       }
 *     Re-call with `?force=true` (appends to URL) to bypass.
 */

export type DependencyMap = Record<string, number>;

export interface DependencyDeleteOptions {
  /** Base URL with NO query string. e.g. `/clients/abc-123` */
  url: string;
  /** Friendly entity label, used in the modal title — e.g. "client", "project". */
  entityType?: string;
  /** Friendly entity name to show — e.g. "Acme Corp". */
  entityName?: string;
  /** Map of dependency key → click handler (e.g. open a list view). Optional. */
  onViewDependency?: Partial<Record<string, () => void>>;
  /** Friendly labels for dependency keys. Defaults to title-cased key. */
  dependencyLabels?: Partial<Record<string, string>>;
  /** Confirm message used by the standard pre-flight confirm prompt. */
  confirmMessage?: string;
  /** Skip the standard pre-flight confirm (useful when the caller already showed one). */
  skipPreConfirm?: boolean;
}

type Listener = (
  payload: {
    entityType: string;
    entityName?: string;
    dependencies: DependencyMap;
    dependencyLabels: Partial<Record<string, string>>;
    onViewDependency?: Partial<Record<string, () => void>>;
    message?: string;
  },
  resolve: (force: boolean) => void
) => void;

let listener: Listener | null = null;

function showDependencyModal(
  payload: Parameters<Listener>[0]
): Promise<boolean> {
  return new Promise((resolve) => {
    if (listener) {
      listener(payload, resolve);
    } else {
      // Fallback: native confirm with a summary line.
      const summary = Object.entries(payload.dependencies)
        .filter(([, n]) => Number(n) > 0)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ');
      resolve(
        window.confirm(
          `${payload.entityType} has dependencies: ${summary}. Deactivate anyway?`
        )
      );
    }
  });
}

/**
 * Perform a delete with dependency-aware fallback. Returns the final response
 * data (success path) or throws if the user cancels / the server still rejects.
 */
export async function dependencyDelete(opts: DependencyDeleteOptions) {
  const {
    url,
    entityType = 'item',
    entityName,
    onViewDependency,
    dependencyLabels = {},
    confirmMessage,
    skipPreConfirm = false,
  } = opts;

  // First attempt — let the api interceptor show the standard confirm,
  // unless the caller said it already confirmed.
  const config: any = { skipConfirm: skipPreConfirm };
  if (confirmMessage) config.confirmMessage = confirmMessage;

  try {
    const res = await api.delete(url, config);
    if (res?.data?.warning) {
      toast.success(res.data.message || `${entityType} deleted`, {
        icon: '⚠️',
      });
      toast(res.data.warning, { duration: 5000 });
    } else {
      toast.success(res?.data?.message || `${entityType} deleted`);
    }
    return res?.data;
  } catch (err: any) {
    if (err?.response?.status !== 409) throw err;

    const body = err.response.data || {};
    const deps: DependencyMap = body.dependencies || {};
    const hasAny = Object.values(deps).some((n) => Number(n) > 0);
    if (!hasAny) {
      toast.error(body.message || 'Cannot delete: has dependencies');
      throw err;
    }

    const force = await showDependencyModal({
      entityType,
      entityName,
      dependencies: deps,
      dependencyLabels,
      onViewDependency,
      message: body.message,
    });
    if (!force) {
      // User chose Cancel — silent.
      throw new Error('cancelled');
    }

    // Re-call with ?force=true
    const sep = url.includes('?') ? '&' : '?';
    const res = await api.delete(`${url}${sep}force=true`, {
      skipConfirm: true,
    } as any);
    if (res?.data?.warning) {
      toast.success(res.data.message || `${entityType} deleted`, {
        icon: '⚠️',
      });
      toast(res.data.warning, { duration: 5000 });
    } else {
      toast.success(res?.data?.message || `${entityType} deactivated`);
    }
    return res?.data;
  }
}

/** Mounted once at the app root (alongside ConfirmDialogHost). */
export function DependencyDeleteHost() {
  const [state, setState] = useState<{
    open: boolean;
    payload?: Parameters<Listener>[0];
    resolve?: (force: boolean) => void;
  }>({ open: false });

  const [forcing, setForcing] = useState(false);

  useEffect(() => {
    listener = (payload, resolve) => {
      setForcing(false);
      setState({ open: true, payload, resolve });
    };
    return () => {
      listener = null;
    };
  }, []);

  const close = (force: boolean) => {
    state.resolve?.(force);
    setState({ open: false });
  };

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open]);

  if (!state.open || !state.payload) return null;

  const {
    entityType,
    entityName,
    dependencies,
    dependencyLabels,
    onViewDependency,
    message,
  } = state.payload;

  const entries = Object.entries(dependencies).filter(
    ([, n]) => Number(n) > 0
  );

  const formatLabel = (key: string, count: number) => {
    const base =
      dependencyLabels[key] ||
      key
        .split('_')
        .map((w) => w[0]?.toUpperCase() + w.slice(1))
        .join(' ');
    // Pluralize when count !== 1 if the label doesn't already end in s
    if (count === 1 || /s$/i.test(base)) return base;
    return base + 's';
  };

  // Human sentence summary
  const summary = entries
    .map(([k, n]) => `${n} ${formatLabel(k, n).toLowerCase()}`)
    .join(', ');

  return (
    <div
      className="fixed inset-0 z-[201] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={() => !forcing && close(false)}
    >
      <div
        className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Cannot delete this {entityType}
              </h2>
              {entityName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entityName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => !forcing && close(false)}
            className="p-1 rounded-md hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {message ||
            `This ${entityType} has ${summary}. Deactivating will keep the related records intact but mark it as inactive.`}
        </p>

        <div className="rounded-lg border border-border bg-secondary/40 divide-y divide-border">
          {entries.map(([key, count]) => {
            const handler = onViewDependency?.[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">{count}</span>{' '}
                  <span className="text-muted-foreground">
                    {formatLabel(key, count)}
                  </span>
                </span>
                {handler ? (
                  <button
                    onClick={() => {
                      handler();
                      close(false);
                    }}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View {formatLabel(key, count).toLowerCase()}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={() => close(false)}
            disabled={forcing}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary disabled:opacity-50"
            autoFocus
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setForcing(true);
              close(true);
            }}
            disabled={forcing}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 inline-flex items-center gap-2"
          >
            {forcing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Deactivate anyway
          </button>
        </div>
      </div>
    </div>
  );
}
