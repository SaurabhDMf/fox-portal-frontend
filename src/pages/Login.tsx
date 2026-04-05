import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, ChevronRight } from 'lucide-react';
import ThemeLogo from '@/components/ThemeLogo';

const demoAccounts = [
  { label: 'Company Admin', email: 'company.admin@company.com', role: 'admin' },
  { label: 'Sales Manager', email: 'alex.kim@company.com', role: 'sales_manager' },
  { label: 'Sales Rep', email: 'lisa.monroe@company.com', role: 'sales_rep' },
];

export default function Login() {
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
      const res = await api.post('/auth/login', { email, password });
      const data = res.data;
      setAuth(data);
      toast.success(`Welcome back, ${data.user?.full_name || 'User'}!`);
      setTimeout(() => {
        const path = useAuthStore.getState().getRedirectPath();
        navigate(path);
      }, 100);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account: typeof demoAccounts[0]) => {
    setEmail(account.email);
    setPassword('Admin123!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <ThemeLogo className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Fox Portal</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign In <ChevronRight className="h-4 w-4" /></>}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-xs text-muted-foreground text-center mb-3">Quick login with demo accounts</p>
          <div className="grid gap-2">
            {demoAccounts.map((acc) => (
              <button key={acc.email} onClick={() => fillDemo(acc)}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/50 border border-border hover:border-primary/30 transition-all text-sm group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">{acc.label[0]}</div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">{acc.label}</div>
                    <div className="text-xs text-muted-foreground">{acc.email}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
