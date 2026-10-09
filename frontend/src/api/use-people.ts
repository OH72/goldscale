import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'
import type { OffsetResponse, PersonResponse, PersonSortField, SortDirection } from '@/types/debt'

export function usePeople(
  sortBy: PersonSortField = 'NAME',
  direction: SortDirection = 'ASC',
) {
  return useQuery({
    queryKey: [...queryKeys.people.all, sortBy, direction],
    queryFn: () =>
      api.get<PersonResponse[]>(`/people?sortBy=${sortBy}&direction=${direction}`),
    placeholderData: keepPreviousData,
  })
}

export function useCreatePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) =>
      api.post<PersonResponse>('/people', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all })
      toast.success('Person created')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create person')
    },
  })
}

export function useUpdatePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) =>
      api.put<PersonResponse>(`/people/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all })
      toast.success('Person updated')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update person')
    },
  })
}

export function useDeletePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/people/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all })
      toast.success('Person deleted')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete person')
    },
  })
}

export function useOffsetPreview(personId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.people.all, 'offset', personId],
    queryFn: () => api.get<OffsetResponse>(`/people/${personId}/offset`),
    enabled: !!personId,
  })
}

export function useOffsetPerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (personId: string) =>
      api.post<OffsetResponse>(`/people/${personId}/offset`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.summary })
      toast.success('Debts and loans offset')
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to offset')
    },
  })
}
