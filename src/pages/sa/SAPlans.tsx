import { useQuery } from '@tanstack/react-query';
import { saLocalService } from '@/lib/saLocalService';
import { CreditCard, Check } from 'lucide-react';

const planFeatures: Record<string, string[]> = {
  trial: ['5 Users', '100 Leads', 'Basic CRM', '14 Day Trial'],
  starter: ['10 Users', '500 Leads', 'CRM + Invoicing', 'Email Support'],
  pro: ['50 Users', 'Unlimited Leads', 'Full Suite', 'Priority Support'],
  enterprise: ['Unlimited Users', 'Unlimited Everything', 'Custom Integrations', 'Dedicated Support'],
};
const planPrices: Record<string, string> = { trial: 'Free', starter: '$29/mo', pro: '$79/mo', enterprise: '$199/mo' };

export default function SAPlans() {
  const { data = [] } = useQuery({
    queryKey: ['sa-plans'],
    queryFn: () => saLocalService.getPlans(),
  });

  const plansArr = ['trial', 'starter', 'pro', 'enterprise'];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Subscription Plans</h1><p className="page-subtitle">Plan overview and distribution</p></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plansArr.map((plan) => {
          const d = (Array.isArray(data) ? data : []).find((p: any) => p.name?.toLowerCase() === plan);
          return (
            <div key={plan} className={`glass-card-hover p-5 space-y-4 ${plan === 'pro' ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold capitalize">{plan}</h3>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{planPrices[plan]}</div>
              <div className="text-xs text-muted-foreground">{d?.org_count ?? 0} organizations</div>
              <div className="space-y-2">
                {planFeatures[plan].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 text-success" /><span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
