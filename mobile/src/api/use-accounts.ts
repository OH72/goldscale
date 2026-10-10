import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'
import type {
  AccountResponse,
  CreateAccountRequest,
  UpdateAccountRequest,
} from '@/types/account'

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.all,
    queryFn: () => api.get<AccountResponse[]>('/accounts'),
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAccountRequest) =>
      api.post<AccountResponse>('/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
    },
    onError: (error: Error) => {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Failed to create account')
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountRequest }) =>
      api.put<AccountResponse>(`/accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
    },
    onError: (error: Error) => {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Failed to update account')
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
    },
    onError: (error: Error) => {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Failed to delete account')
    },
  })
}
