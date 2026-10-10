import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { api, ApiError } from './client'
import { queryKeys } from './query-keys'
import { useAuthStore } from '@/stores/auth-store'

export function useBackupDownload() {
  return useMutation({
    mutationFn: async () => {
      const { baseUrl, username, password } = useAuthStore.getState()
      const encoded = btoa(`${username}:${password}`)
      const url = `${baseUrl.replace(/\/+$/, '')}/api/backup`
      const filename = `goldscale-backup-${new Date().toISOString().slice(0, 10)}.zip`
      const fileUri = `${FileSystem.documentDirectory}${filename}`

      const result = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Basic ${encoded}` },
      })

      if (result.status !== 200) {
        throw new ApiError(result.status, 'Backup download failed')
      }

      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/zip',
          dialogTitle: 'Save Backup',
        })
      } else {
        Alert.alert('Saved', `Backup saved to ${fileUri}`)
      }
    },
    onError: (error: Error) => {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Backup failed')
    },
  })
}

export function useBackupRestore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fileUri: string) => {
      const { baseUrl, username, password } = useAuthStore.getState()
      const encoded = btoa(`${username}:${password}`)
      const url = `${baseUrl.replace(/\/+$/, '')}/api/backup/restore`

      const result = await FileSystem.uploadAsync(url, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: { Authorization: `Basic ${encoded}` },
      })

      if (result.status !== 200) {
        const body = JSON.parse(result.body || '{}')
        throw new ApiError(result.status, body.message ?? 'Restore failed')
      }

      return JSON.parse(result.body) as { message: string; collections: Record<string, number> }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.debtRecords.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      Alert.alert('Success', data.message)
    },
    onError: (error: Error) => {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Restore failed')
    },
  })
}
