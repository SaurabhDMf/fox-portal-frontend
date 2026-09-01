import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, Lock, Mail,
  ShieldCheck, Sparkles, AlertCircle, Users, Briefcase,
} from 'lucide-react';
import { initPushNotifications } from '@/lib/pushNotifications';

type LoginMode = 'team' | 'client';

const TEAM_HIGHLIGHTS = [
  { icon: Sparkles, title: 'One workspace', desc: 'CRM, shared inbox, invoicing and chat under a single login.' },
  { icon: ShieldCheck, title: 'Granular access', desc: 'Group-level permissions control every module and feature.' },
  { icon: KeyRound, title: 'Encrypted vault', desc: 'Team credentials stored safely with password health tracking.' },
];

const CLIENT_HIGHLIGHTS = [
  { icon: Sparkles, title: 'Everything in one place', desc: 'Invoices, projects and support tickets, together.' },
  { icon: ShieldCheck, title: 'Your data, protected', desc: 'Only you and your assigned team can see your account.' },
  { icon: KeyRound, title: 'Direct support', desc: 'Message your team straight from the portal.' },
];

export default function Login({ mode = 'team' }: { mode?: LoginMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [caps, setCaps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const isClient = mode === 'client';
  const highlights = isClient ? CLIENT_HIGHLIGHTS : TEAM_HIGHLIGHTS;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const strength = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setError(null);
    setLoading(true);
    try {
      const endpoint = isClient ? '/auth/portal-login' : '/auth/login';
      const res = await api.post(endpoint, { email, password });
      const data = res.data;
      setAuth(data);
      toast.success(`Welcome back, ${data.user?.full_name || 'User'}!`);
      initPushNotifications();
      setTimeout(() => {
        const path = useAuthStore.getState().getRedirectPath();
        navigate(path);
      }, 100);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_minmax(0,1fr)]">
        {/* ---------- brand panel ---------- */}
        <aside className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
          <div
            className="pointer-events-none absolute -left-24 -top-24 size-[520px] rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary)), transparent 65%)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-40 -right-24 size-[460px] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary)), transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          <div className="relative flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-sm font-bold">FX</span>
            <span className="text-lg font-semibold tracking-tight">Fox Portal</span>
          </div>

          <div className="relative max-w-md">
            <h1 className="text-4xl font-black leading-[1.1] tracking-tight xl:text-5xl">
              {isClient ? 'Everything about your project, in one place.' : 'Run the whole agency from one calm workspace.'}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-background/70">
              {isClient
                ? 'Invoices, project status and support — connected and always up to date.'
                : 'Leads, conversations, invoices and credentials — connected, permissioned and searchable.'}
            </p>

            <div className="mt-10 space-y-3">
              {highlights.map((h) => (
                <div
                  key={h.title}
                  className="group flex items-start gap-3 rounded-xl border border-background/10 bg-background/[0.04] p-3.5 backdrop-blur transition hover:border-background/25 hover:bg-background/[0.08]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/25 text-background transition group-hover:bg-primary/40">
                    <h.icon className="size-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{h.title}</div>
                    <div className="text-xs text-background/60">{h.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-3 text-xs text-background/50">
            <ShieldCheck className="size-4" /> Data encrypted at rest · Role-based access control
          </div>
        </aside>

        {/* ---------- form panel ---------- */}
        <main className="flex flex-col px-6 py-8 sm:px-10">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">FX</span>
            <span className="text-base font-semibold">Fox Portal</span>
          </div>

          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
            <div className={`inline-flex items-center gap-2 mb-6 self-start px-3 py-1.5 rounded-full border text-xs font-semibold ${isClient ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-secondary text-foreground'}`}>
              {isClient ? <Users className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
              {isClient ? 'Client Portal' : 'Team Login'}
            </div>

            <form onSubmit={handleLogin} noValidate>
              <h2 className="text-3xl font-black tracking-tight">Welcome back</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {isClient ? 'Sign in to view your invoices, projects & support tickets.' : 'Sign in to your Fox Portal workspace.'}
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Work email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(null); }}
                      placeholder="you@company.com"
                      className="w-full rounded-xl bg-secondary py-3 pl-10 pr-10 text-sm border border-border outline-none transition focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    />
                    {emailValid && (
                      <Check className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-emerald-500" />
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="text-xs font-semibold text-muted-foreground">Password</label>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="password"
                      type={show ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}
                      placeholder="••••••••"
                      className="w-full rounded-xl bg-secondary py-3 pl-10 pr-11 text-sm border border-border outline-none transition focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex h-1 flex-1 gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className={`h-full flex-1 rounded-full transition-colors ${
                              i < strength
                                ? strength <= 2 ? 'bg-destructive' : strength === 3 ? 'bg-amber-500' : 'bg-emerald-500'
                                : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {strength <= 2 ? 'Weak' : strength === 3 ? 'Fair' : 'Strong'}
                      </span>
                    </div>
                  )}
                  {caps && (
                    <p className="mt-1.5 text-[11px] font-medium text-amber-600">Caps Lock is on</p>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-muted-foreground">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={remember}
                    onClick={() => setRemember((v) => !v)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${remember ? 'bg-primary' : 'bg-muted border border-border'}`}
                  >
                    <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${remember ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  Keep me signed in on this device
                </label>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive border border-destructive/20">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {loading ? 'Signing in…' : (isClient ? 'Sign In to Client Portal' : 'Sign In')}
                {!loading && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
              </button>

              <p className="mt-5 text-center text-xs text-muted-foreground">
                {isClient
                  ? <a href="/login" className="font-medium text-primary hover:underline">Team / Staff login</a>
                  : <a href="/client-login" className="font-medium text-primary hover:underline">Client portal login</a>}
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
