import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, ChevronRight, Users, Briefcase } from 'lucide-react';
import { initPushNotifications } from '@/lib/pushNotifications';
import ThemeLogo from '@/components/ThemeLogo';

type LoginMode = 'team' | 'client';

export default function Login({ mode = 'team' }: { mode?: LoginMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const isClient = mode === 'client';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
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
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <ThemeLogo className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Fox Portal</h1>
          <div className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl border ${isClient ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary'}`}>
            {isClient
              ? <><Users className="h-4 w-4 text-primary" /><span className="text-sm font-semibold text-primary">Client Portal</span></>
              : <><Briefcase className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold text-foreground">Team Login</span></>
            }
          </div>
          <p className="text-muted-foreground text-xs mt-2">
            {isClient ? 'Sign in to view your invoices, projects & support tickets' : 'Staff, admins and managers sign in here'}
          </p>
        </div>

        <form onSubmit={handleLogin} className="glass-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <>{isClient ? 'Sign In to Client Portal' : 'Sign In'} <ChevronRight className="h-4 w-4" /></>
            }
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {isClient
            ? <><a href="/login" className="underline underline-offset-2 hover:text-foreground transition-colors">Team / Staff login</a></>
            : <><a href="/client-login" className="underline underline-offset-2 hover:text-foreground transition-colors">Client portal login</a></>
          }
        </p>
      </div>
    </div>
  );
}
