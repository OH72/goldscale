import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { queryKeys } from './query-keys'
import type {
  DashboardResponse,
  GroupExpenseResponse,
  IncomeVsExpenseResult,
  ExpenseTrendResponse,
} from '@/types/transaction'

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: () => api.get<DashboardResponse>('/dashboard'),
  })
}

interface ChartFilters {
  from: string
  to: string
  accountIds?: string[]
  categoryIds?: string[]
  tagIds?: string[]
  types?: string[]
  groupBy?: string
}

function buildChartParams(filters: ChartFilters): URLSearchParams {
  const params = new URLSearchParams({ from: filters.from, to: filters.to })
  for (const id of filters.accountIds ?? []) params.append('accountIds', id)
  for (const id of filters.categoryIds ?? []) params.append('categoryIds', id)
  for (const id of filters.tagIds ?? []) params.append('tagIds', id)
  for (const t of filters.types ?? []) params.append('types', t)
  if (filters.groupBy) params.set('groupBy', filters.groupBy)
  return params
}

export function useExpensesByCategory(filters: ChartFilters) {
  return useQuery({
    queryKey: queryKeys.dashboard.expensesByCategory(filters),
    queryFn: () =>
      api.get<GroupExpenseResponse[]>(
        `/dashboard/expenses-by-category?${buildChartParams(filters)}`,
      ),
  })
}

export function useIncomeVsExpenses(filters: ChartFilters) {
  return useQuery({
    queryKey: queryKeys.dashboard.incomeVsExpenses(filters),
    queryFn: () =>
      api.get<IncomeVsExpenseResult>(
        `/dashboard/income-vs-expenses?${buildChartParams(filters)}`,
      ),
  })
}

export function useExpenseTrend(filters: ChartFilters) {
  return useQuery({
    queryKey: queryKeys.dashboard.expenseTrend(filters),
    queryFn: () =>
      api.get<ExpenseTrendResponse[]>(
        `/dashboard/expense-trend?${buildChartParams(filters)}`,
      ),
  })
}
