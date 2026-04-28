import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ',
};

export function useCompanyCurrency() {
  const { data } = useQuery({
    queryKey: ['company-settings-currency'],
    queryFn: () => api.get('/company').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const companyCurrency: string = data?.currency || 'USD';
  const currencySymbol = (code?: string) => SYMBOLS[code || companyCurrency] || companyCurrency;
  return { companyCurrency, currencySymbol };
}
