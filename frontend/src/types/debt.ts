import type { Currency } from './common'

export type DebtType = 'DEBT' | 'LOAN'
export type DebtStatus = 'OPEN' | 'CLOSED'

export interface PersonResponse {
  id: string
  name: string
  createdAt: string
  totalDebt: number
  totalLoan: number
  net: number
  canOffset: boolean
}

export interface OffsetAllocation {
  recordId: string
  description: string | null
  date: string
  remainingBefore: number
  amount: number
  remainingAfter: number
}

export interface OffsetCurrencyEntry {
  currency: Currency
  amount: number
  debts: OffsetAllocation[]
  loans: OffsetAllocation[]
}

export interface OffsetResponse {
  personId: string
  personName: string
  currencies: OffsetCurrencyEntry[]
}

export type PersonSortField = 'NAME' | 'TOTAL_DEBT' | 'TOTAL_LOAN' | 'NET'
export type SortDirection = 'ASC' | 'DESC'

export interface PaymentResponse {
  id: string
  amount: number
  date: string
  description: string | null
  createdAt: string
}

export interface DebtRecordResponse {
  id: string
  personId: string
  personName: string
  type: DebtType
  amount: number
  coveredAmount: number
  remainingAmount: number
  currency: Currency
  categoryId: string | null
  categoryName: string | null
  description: string | null
  date: string
  status: DebtStatus
  payments: PaymentResponse[]
  createdAt: string
  updatedAt: string
}

export interface DebtSummaryEntry {
  personId: string
  personName: string
  totalDebt: number
  totalLoan: number
  net: number
}

export interface DebtSummaryResponse {
  displayCurrency: Currency
  entries: DebtSummaryEntry[]
}

export interface CreateDebtRecordRequest {
  personId: string
  type: DebtType
  amount: number
  currency: Currency
  categoryId?: string | null
  description?: string | null
  date: string
}

export interface UpdateDebtRecordRequest {
  personId?: string
  type?: DebtType
  amount: number
  currency: Currency
  categoryId?: string | null
  description?: string | null
  date: string
}

export interface AddPaymentRequest {
  amount: number
  date: string
  description?: string | null
}
