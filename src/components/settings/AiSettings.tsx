import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2, Trash2, Sparkles } from 'lucide-react';

const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

type AiSettingsResponse = {
  configured: boolean;
  // Which source the running server is actually using — a key in the database
  // overrides ANTHROPIC_API_KEY in the VPS .env.
  source: 'database' | 'environment' | null;
  masked: string | null;
};

export default function AiSettings() {
  const qc = useQueryClient();
  const [key, setKey] = useState('');
  const [reveal, setReveal] = useState(false);

  const { data, isLoading } = useQuery<AiSettingsResponse>({
    queryKey: ['superadmin-ai-settings'],
    queryFn: async () => (await api.get('/superadmin/ai-settings')).data,
  });

  const saveMut = useMutation({
    mutationFn: async () => (await api.put('/superadmin/ai-settings', { anthropic_api_key: key.trim() })).data,
    onSuccess: () => {
      toast.success('API key saved — AI follow-up picks it up on the next run');
      setKey('');
      qc.invalidateQueries({ queryKey: ['superadmin-ai-settings'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Could not save the key'),
  });

  // Tests the key that's typed in the box if there is one, otherwise the stored
  // key — so it can be verified both before saving and after.
  const testMut = useMutation({
    mutationFn: async () =>
      (await api.post('/superadmin/ai-settings/test',
        key.trim() ? { anthropic_api_key: key.trim() } : {})).data,
    onSuccess: (r: any) => toast.success(`Key works — ${r.model} replied "${r.reply}"`),
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Test failed'),
  });

  const removeMut = useMutation({
    mutationFn: async () => (await api.delete('/superadmin/ai-settings')).data,
    onSuccess: () => {
      toast.success('Stored key removed');
      qc.invalidateQueries({ queryKey: ['superadmin-ai-settings'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Could not remove the key'),
  });

  const busy = saveMut.isPending || testMut.isPending || removeMut.isPending;

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="font-semibold text-sm">Anthropic API key</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Powers AI follow-up drafts in the shared inbox. Visible to super admins only —
            the key is encrypted before it is stored and is never shown again after saving.
          </p>
        </div>
      </div>

      {/* Current status */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
        </div>
      ) : data?.configured ? (
        <div className="flex items-start gap-2 text-xs rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-px" />
          <div className="text-emerald-800 dark:text-emerald-300">
            <p className="font-medium">Configured — <code>{data.masked}</code></p>
            <p className="opacity-80 mt-0.5">
              {data.source === 'database'
                ? 'Set here in the panel. Overrides any ANTHROPIC_API_KEY on the server.'
                : 'Coming from ANTHROPIC_API_KEY on the server. Saving a key here will take over.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-xs rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-px" />
          <div className="text-amber-800 dark:text-amber-300">
            <p className="font-medium">Not configured</p>
            <p className="opacity-80 mt-0.5">AI follow-up will stay switched off until a key is saved.</p>
          </div>
        </div>
      )}

      {/* Key entry */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          {data?.configured ? 'Replace key' : 'API key'}
        </label>
        <div className="relative">
          <input
            type={reveal ? 'text' : 'password'}
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="sk-ant-api03-…"
            autoComplete="off"
            spellCheck={false}
            className={`${inputCls} pr-10 font-mono`}
          />
          <button
            type="button"
            onClick={() => setReveal(v => !v)}
            aria-label={reveal ? 'Hide key' : 'Show key'}
            className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 p-1 text-muted-foreground hover:text-foreground">
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Create one at console.anthropic.com → API keys.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => saveMut.mutate()}
          disabled={busy || !key.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
          {saveMut.isPending ? 'Saving…' : 'Save key'}
        </button>

        <button
          onClick={() => testMut.mutate()}
          disabled={busy || (!key.trim() && !data?.configured)}
          className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary disabled:opacity-50 flex items-center gap-1.5">
          {testMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {testMut.isPending ? 'Testing…' : key.trim() ? 'Test this key' : 'Test saved key'}
        </button>

        {data?.source === 'database' && (
          <button
            onClick={() => removeMut.mutate()}
            disabled={busy}
            className="ml-auto px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-red-500 disabled:opacity-50 flex items-center gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      <div className="border-t border-border pt-4 text-[11px] text-muted-foreground space-y-1">
        <p className="font-medium text-xs text-foreground">After saving, AI follow-up still needs:</p>
        <p>• <strong>AI follow-up</strong> switched on for the inbox (Shared Inbox → Inbox Settings)</p>
        <p>• A <strong>delay</strong> set — e.g. 4 hours</p>
        <p>• The thread <strong>assigned to someone</strong> — unassigned threads are never followed up, and the delay counts from the moment of assignment</p>
      </div>
    </div>
  );
}
