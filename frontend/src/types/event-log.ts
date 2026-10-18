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
  page: number
  size: number
}
