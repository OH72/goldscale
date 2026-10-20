export interface EventLogResponse {
  id: string
  action: string
  entityType: string
  entityId: string | null
  description: string
  timestamp: string
}

export interface EventLogFilters {
  entityType?: string
  startDate?: string
  endDate?: string
  page: number
  size: number
}
