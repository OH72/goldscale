import type { Currency } from './common'

export interface AccountResponse {
  id: string
  name: string
  currency: Currency
  balance: number
  active: boolean
  createdAt: string
}

export interface CreateAccountRequest {
  name: string
  currency: Currency
  initialBalance: number
}

export interface UpdateAccountRequest {
  name: string
  currency: Currency
  active: boolean
}
