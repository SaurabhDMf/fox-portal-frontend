import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, ChevronRight, Users, Briefcase } from 'lucide-react';
import { initPushNotifications } from '@/lib/pushNotifications';
import ThemeLogo from '@/components/ThemeLogo';

type LoginMode = 'team' | 'client';

export default function Login() {
  const [mode, setMode] = useState<LoginMode>('team');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      // Client tile uses portal-login; Team tile uses regular login
      const endpoint = mode === 'client' ? '/auth/portal-login' : '/auth/login';
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
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Login mode tiles */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setMode('team')}
            className={`p-4 rounded-xl border text-left transition-all ${mode === 'team' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border bg-secondary hover:border-primary/50'}`}
          >
            <Briefcase className={`h-5 w-5 mb-2 ${mode === 'team' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="text-sm font-semibold">Team</div>
            <div className="text-xs text-muted-foreground">Staff & admins</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('client')}
            className={`p-4 rounded-xl border text-left transition-all ${mode === 'client' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border bg-secondary hover:border-primary/50'}`}
          >
            <Users className={`h-5 w-5 mb-2 ${mode === 'client' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="text-sm font-semibold">Client</div>
            <div className="text-xs text-muted-foreground">Portal access</div>
          </button>
        </div>

        <form onSubmit={handleLogin} className="glass-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="you@company.com" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign In as {mode === 'client' ? 'Client' : 'Team'} <ChevronRight className="h-4 w-4" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
