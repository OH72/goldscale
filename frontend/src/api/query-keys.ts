import type { TransactionFilters } from '@/types/transaction'

export const queryKeys = {
  accounts: {
    all: ['accounts'] as const,
    detail: (id: string) => ['accounts', id] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (filters: TransactionFilters) =>
      ['transactions', 'list', filters] as const,
    detail: (id: string) => ['transactions', id] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  tags: {
    all: ['tags'] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  people: {
    all: ['people'] as const,
  },
  debtRecords: {
    all: ['debtRecords'] as const,
    list: (filters: unknown) => ['debtRecords', 'list', filters] as const,
    detail: (id: string) => ['debtRecords', id] as const,
    summary: ['debtRecords', 'summary'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    expensesByCategory: (filters: unknown) => ['dashboard', 'expenses-by-category', filters] as const,
    incomeVsExpenses: (filters: unknown) => ['dashboard', 'income-vs-expenses', filters] as const,
    expenseTrend: (filters: unknown) => ['dashboard', 'expense-trend', filters] as const,
    exchangeRateHistory: (filters: unknown) => ['dashboard', 'exchange-rate-history', filters] as const,
  },
} as const
