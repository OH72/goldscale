import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'
import { toast } from 'sonner'

export function useBackupDownload() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/backup', {
        headers: {
          Authorization: `Basic ${btoa('admin:admin')}`,
        },
      })
      if (!response.ok) {
        throw new ApiError(response.status, 'Backup download failed')
      }
      const blob = await response.blob()
      const filename =
        response.headers
          .get('Content-Disposition')
          ?.match(/filename="(.+)"/)?.[1] ?? 'goldscale-backup.zip'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success('Backup downloaded'),
    onError: (error: Error) =>
      toast.error(error instanceof ApiError ? error.message : 'Backup failed'),
  })
}

export function useBackupRestore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.postForm<{ message: string; collections: Record<string, number> }>(
        '/backup/restore',
        form,
      )
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      toast.success(data.message)
    },
    onError: (error: Error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'Restore failed',
      ),
  })
}
