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
    byType: (type: string) => ['categories', type] as const,
  },
  dashboard: ['dashboard'] as const,
} as const
