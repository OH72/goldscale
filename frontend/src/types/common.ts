export type Currency = 'UAH' | 'USD' | 'EUR' | 'PLN' | 'GBP'

export type TransactionType = 'INITIAL_BALANCE' | 'INCOME' | 'EXPENSE' | 'TRANSFER'

export type CategoryType = 'INCOME' | 'EXPENSE'

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
