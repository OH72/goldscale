import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
      toast.success('Tag created')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create tag')
    },
  })
}

export function useUpdateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) =>
      api.put<TagResponse>(`/tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      toast.success('Tag updated')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update tag')
    },
  })
}

export function useMergeTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      api.post(`/tags/${sourceId}/merge`, { targetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      toast.success('Tags merged')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to merge tags')
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      toast.success('Tag deleted')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete tag')
    },
  })
}
