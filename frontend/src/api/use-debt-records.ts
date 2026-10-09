import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'
import type {
  DebtRecordResponse,
  DebtSummaryResponse,
  CreateDebtRecordRequest,
  UpdateDebtRecordRequest,
  AddPaymentRequest,
  DebtType,
  DebtStatus,
} from '@/types/debt'

interface DebtRecordFilters {
  personId?: string
  type?: DebtType
  status?: DebtStatus
}

function buildQueryString(filters?: DebtRecordFilters): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  if (filters.personId) params.append('personId', filters.personId)
  if (filters.type) params.append('type', filters.type)
  if (filters.status) params.append('status', filters.status)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useDebtRecords(filters?: DebtRecordFilters) {
  return useQuery({
    queryKey: queryKeys.debtRecords.list(filters ?? {}),
    queryFn: () =>
      api.get<DebtRecordResponse[]>(`/debt-records${buildQueryString(filters)}`),
  })
}

export function useDebtRecord(id: string) {
  return useQuery({
    queryKey: queryKeys.debtRecords.detail(id),
    queryFn: () => api.get<DebtRecordResponse>(`/debt-records/${id}`),
    enabled: !!id,
  })
}

export function useCreateDebtRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDebtRecordRequest) =>
      api.post<DebtRecordResponse>('/debt-records', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.summary })
      toast.success('Record created')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create record')
    },
  })
}

export function useUpdateDebtRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDebtRecordRequest }) =>
      api.put<DebtRecordResponse>(`/debt-records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.summary })
      toast.success('Record updated')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update record')
    },
  })
}

export function useDeleteDebtRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/debt-records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.summary })
      toast.success('Record deleted')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete record')
    },
  })
}

export function useAddPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: AddPaymentRequest }) =>
      api.post<DebtRecordResponse>(`/debt-records/${recordId}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.summary })
      toast.success('Payment added')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to add payment')
    },
  })
}

export function useRemovePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, paymentId }: { recordId: string; paymentId: string }) =>
      api.delete(`/debt-records/${recordId}/payments/${paymentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.summary })
      toast.success('Payment removed')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to remove payment')
    },
  })
}

export function useToggleDebtStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.put<DebtRecordResponse>(`/debt-records/${id}/toggle-status`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.summary })
      toast.success('Status toggled')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to toggle status')
    },
  })
}

export function useDebtSummary() {
  return useQuery({
    queryKey: queryKeys.debtRecords.summary,
    queryFn: () => api.get<DebtSummaryResponse>('/debt-records/summary'),
  })
}
