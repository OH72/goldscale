import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'
import type { PageResponse } from '@/types/common'
import type {
  TransactionResponse,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionFilters,
} from '@/types/transaction'

function buildParams(filters: TransactionFilters): string {
  const params = new URLSearchParams()
  if (filters.accountId) params.set('accountId', filters.accountId)
  if (filters.type) params.set('type', filters.type)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  if (filters.tagId) params.set('tagId', filters.tagId)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.sort) params.set('sort', filters.sort)
  params.set('page', String(filters.page))
  params.set('size', String(filters.size))
  return params.toString()
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: () =>
      api.get<PageResponse<TransactionResponse>>(
        `/transactions?${buildParams(filters)}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTransactionRequest) =>
      api.post<TransactionResponse>('/transactions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      toast.success('Transaction created')
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to create transaction',
      )
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateTransactionRequest
    }) => api.put<TransactionResponse>(`/transactions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      toast.success('Transaction updated')
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to update transaction',
      )
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      toast.success('Transaction deleted')
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to delete transaction',
      )
    },
  })
}
