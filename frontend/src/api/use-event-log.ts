import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from './client'
import { queryKeys } from './query-keys'
import type { PageResponse } from '@/types/common'
import type { EventLogResponse, EventLogFilters } from '@/types/event-log'

function buildParams(filters: EventLogFilters): string {
  const params = new URLSearchParams()
  if (filters.entityType) params.set('entityType', filters.entityType)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  params.set('page', String(filters.page))
  params.set('size', String(filters.size))
  return params.toString()
}

export function useEventLog(filters: EventLogFilters) {
  return useQuery({
    queryKey: queryKeys.eventLog.list(filters),
    queryFn: () =>
      api.get<PageResponse<EventLogResponse>>(`/audit?${buildParams(filters)}`),
    placeholderData: keepPreviousData,
  })
}
