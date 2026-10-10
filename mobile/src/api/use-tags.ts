import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'

export interface TagResponse {
  id: string
  name: string
  createdAt: string
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => api.get<TagResponse[]>('/tags'),
  })
}

export function useCreateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) =>
      api.post<TagResponse>('/tags', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
    onError: (error: Error) => {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Failed to create tag')
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
    onError: (error: Error) => {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Failed to delete tag')
    },
  })
}
