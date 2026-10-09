import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { queryKeys } from './query-keys'
import type { ExchangeRateHistoryEntry } from '@/types/settings'

export function useLatestRates() {
  return useQuery({
    queryKey: ['exchange-rates', 'latest'],
    queryFn: () => api.get<Record<string, number>>('/exchange-rates/latest'),
  })
}

export function useExchangeRateHistory(filters: { from: string; to: string }) {
  return useQuery({
    queryKey: queryKeys.dashboard.exchangeRateHistory(filters),
    queryFn: () =>
      api.get<ExchangeRateHistoryEntry[]>(
        `/exchange-rates/history?from=${filters.from}&to=${filters.to}`,
      ),
  })
}
