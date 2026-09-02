import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const inputCls =
  'w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

const TIMEZONES = [
  'Asia/Kolkata (UTC+5:30)', 'Asia/Dubai (UTC+4:00)', 'Asia/Singapore (UTC+8:00)',
  'Europe/London (UTC+0:00)', 'America/New_York (UTC-5:00)', 'America/Los_Angeles (UTC-8:00)',
];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const LANGUAGES = ['English (US)', 'English (UK)', 'Hindi'];

type FormState = {
  name: string;
  timezone: string;
  date_format: string;
  language: string;
  compact_ui: boolean;
};

export default function GeneralSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({
    name: '', timezone: TIMEZONES[0], date_format: DATE_FORMATS[0], language: LANGUAGES[0], compact_ui: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/company').then(r => r.data?.data ?? r.data ?? {}),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name || '',
      timezone: data.timezone || TIMEZONES[0],
      date_format: data.date_format || DATE_FORMATS[0],
      language: data.language || LANGUAGES[0],
      compact_ui: !!data.compact_ui,
    });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => api.put('/company', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('General settings saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Could not save'),
  });

  if (isLoading) return <div className="glass-card p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="glass-card p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Organisation</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Applies across every module in the portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Organisation name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Timezone</label>
          <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} className={inputCls}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date format</label>
          <select value={form.date_format} onChange={e => setForm(f => ({ ...f, date_format: e.target.value }))} className={inputCls}>
            {DATE_FORMATS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Language</label>
          <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className={inputCls}>
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors">
        <div>
          <div className="text-sm font-medium">Compact interface</div>
          <div className="text-xs text-muted-foreground">Tighter spacing across tables and lists</div>
        </div>
        <button
          onClick={() => setForm(f => ({ ...f, compact_ui: !f.compact_ui }))}
          className={`relative w-10 h-5 rounded-full transition-colors ${form.compact_ui ? 'bg-primary' : 'bg-secondary border border-border'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.compact_ui ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {saveMut.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
