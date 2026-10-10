import type { Currency } from './common'

export interface SettingsResponse {
  displayCurrency: Currency
  initialDate: string
}

export interface UpdateSettingsRequest {
  displayCurrency?: Currency
  initialDate?: string
}

export interface ExchangeRateHistoryEntry {
  date: string
  rates: Record<string, number>
}
