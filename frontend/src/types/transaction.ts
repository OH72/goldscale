import type { TransactionType } from './common'
import type { AccountResponse } from './account'

export interface TransactionResponse {
  id: string
  type: TransactionType
  accountId: string
  accountName: string | null
  targetAccountId: string | null
  targetAccountName: string | null
  categoryId: string | null
  categoryName: string | null
  amount: number
  targetAmount: number | null
  exchangeRate: number | null
  description: string | null
  date: string
  createdAt: string
}

export interface CreateIncomeRequest {
  type: 'INCOME'
  accountId: string
  amount: number
  categoryId: string
  date: string
  description: string | null
}

export interface CreateExpenseRequest {
  type: 'EXPENSE'
  accountId: string
  amount: number
  categoryId: string
  date: string
  description: string | null
}

export interface CreateTransferRequest {
  type: 'TRANSFER'
  sourceAccountId: string
  targetAccountId: string
  amount: number
  targetAmount: number
  date: string
  description: string | null
}

export type CreateTransactionRequest =
  | CreateIncomeRequest
  | CreateExpenseRequest
  | CreateTransferRequest

export interface UpdateTransactionRequest {
  amount: number
  categoryId: string | null
  date: string
  description: string | null
  targetAmount: number | null
}

export interface TransactionFilters {
  accountId?: string
  type?: TransactionType
  categoryId?: string
  startDate?: string
  endDate?: string
  page: number
  size: number
}

export interface DashboardResponse {
  accounts: AccountResponse[]
  recentTransactions: TransactionResponse[]
}

export interface AuditResponse {
  accountId: string
  storedBalance: number
  calculatedBalance: number
  match: boolean
}
