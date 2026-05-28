import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const SYMBOLS: Record<string, string> = {
  INR: '₹',  USD: '$',    EUR: '€',   GBP: '£',   AED: 'د.إ',
  AUD: 'A$', CAD: 'C$',  SGD: 'S$',  NZD: 'NZ$', HKD: 'HK$',
  CHF: 'Fr', JPY: '¥',   CNY: '¥',   MYR: 'RM',  ZAR: 'R',
  BRL: 'R$', MXN: '$',   SEK: 'kr',  NOK: 'kr',  DKK: 'kr',
};

export function useCompanyCurrency() {
  const { data } = useQuery({
    queryKey: ['company-settings-currency'],
    queryFn: () => api.get('/company').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const companyCurrency: string = data?.currency || 'USD';
  // Use per-invoice code when provided; fall back to company currency; if code unknown show it as prefix
  const currencySymbol = (code?: string) => {
    const c = code || companyCurrency;
    return SYMBOLS[c] ?? (c + ' ');
  };
  return { companyCurrency, currencySymbol };
}
