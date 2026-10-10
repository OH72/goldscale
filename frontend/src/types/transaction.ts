import type { TransactionType, Currency } from './common'

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
  tagIds: string[] | null
  tagNames: string[] | null
  createdAt: string
}

export interface CreateIncomeRequest {
  type: 'INCOME'
  accountId: string
  amount: number
  categoryId: string
  date: string
  description: string | null
  tagIds: string[] | null
}

export interface CreateExpenseRequest {
  type: 'EXPENSE'
  accountId: string
  amount: number
  categoryId: string
  date: string
  description: string | null
  tagIds: string[] | null
}

export interface CreateTransferRequest {
  type: 'TRANSFER'
  sourceAccountId: string
  targetAccountId: string
  amount: number
  targetAmount: number
  date: string
  description: string | null
  tagIds: string[] | null
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
  accountId: string | null
  targetAccountId: string | null
  tagIds: string[] | null
}

export interface TransactionFilters {
  accountId?: string
  type?: TransactionType
  categoryId?: string
  tagId?: string
  startDate?: string
  endDate?: string
  search?: string
  sort?: string
  page: number
  size: number
}

export interface DashboardResponse {
  recentTransactions: TransactionResponse[]
  totalNetWorth: number
  displayCurrency: Currency
}

export interface GroupExpenseResponse {
  id: string
  name: string
  amount: number
}

export interface IncomeVsExpenseResponse {
  period: string
  income: number
  expense: number
  net: number
}

export interface IncomeVsExpenseResult {
  priorNet: number
  months: IncomeVsExpenseResponse[]
}

export interface ExpenseTrendResponse {
  period: string
  groups: GroupExpenseResponse[]
}

export interface AuditResponse {
  accountId: string
  storedBalance: number
  calculatedBalance: number
  match: boolean
}
