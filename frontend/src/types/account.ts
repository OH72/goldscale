import type { Currency } from './common'

export interface AccountResponse {
  id: string
  name: string
  currency: Currency
  balance: number
  createdAt: string
  updatedAt: string
}

export interface CreateAccountRequest {
  name: string
  currency: Currency
  initialBalance: number
}

export interface UpdateAccountRequest {
  name: string
}
