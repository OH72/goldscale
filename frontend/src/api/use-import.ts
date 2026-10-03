import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'
import { toast } from 'sonner'
import type {
  ImportPreviewResponse,
  ImportConfirmRequest,
  ImportConfirmResponse,
} from '@/types/import'

export function useImportPreview() {
  return useMutation({
    mutationFn: ({ file, accountId }: { file: File; accountId: string }) => {
      const form = new FormData()
      form.append('file', file)
      form.append('accountId', accountId)
      return api.postForm<ImportPreviewResponse>('/import/preview', form)
    },
  })
}

export function useImportConfirm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ImportConfirmRequest) =>
      api.post<ImportConfirmResponse>('/import/confirm', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      const msg =
        data.skipped > 0
          ? `Imported ${data.imported} transactions (${data.skipped} duplicates skipped)`
          : `Imported ${data.imported} transactions`
      toast.success(msg)
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Import failed')
    },
  })
}
