import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'
import type {
  CategoryResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@/types/category'

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => api.get<CategoryResponse[]>('/categories'),
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCategoryRequest) =>
      api.post<CategoryResponse>('/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      toast.success('Category created')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create category')
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateCategoryRequest
    }) => api.put<CategoryResponse>(`/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      toast.success('Category updated')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update category')
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      toast.success('Category deleted')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete category')
    },
  })
}

export function useMergeCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      api.post(`/categories/${sourceId}/merge`, { targetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      toast.success('Categories merged')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to merge categories')
    },
  })
}

export function useBulkDeleteCategories() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api.deleteWithBody('/categories', ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      toast.success('Categories deleted')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete categories')
    },
  })
}
