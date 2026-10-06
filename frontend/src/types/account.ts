import type { Currency } from './common'

export interface AccountResponse {
  id: string
  name: string
  currency: Currency
  balance: number
  active: boolean
  color: string | null
  createdAt: string
}

export interface CreateAccountRequest {
  name: string
  currency: Currency
  initialBalance: number
  color: string | null
}

export interface UpdateAccountRequest {
  name: string
  currency: Currency
  active: boolean
  color: string | null
}
