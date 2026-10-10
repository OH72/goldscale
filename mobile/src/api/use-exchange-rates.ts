import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { queryKeys } from './query-keys'
import type { ExchangeRateHistoryEntry } from '@/types/settings'

export function useExchangeRateHistory(filters: { from: string; to: string }) {
  return useQuery({
    queryKey: queryKeys.dashboard.exchangeRateHistory(filters),
    queryFn: () =>
      api.get<ExchangeRateHistoryEntry[]>(
        `/exchange-rates/history?from=${filters.from}&to=${filters.to}`,
      ),
  })
}
