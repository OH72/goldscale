import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert, TextInput } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useSettings, useUpdateSettings } from '@/api/use-settings'
import { useBackupDownload, useBackupRestore } from '@/api/use-backup'
import { useAuthStore } from '@/stores/auth-store'
import { PickerModal } from '@/components/picker-modal'
import { router } from 'expo-router'
import type { Currency } from '@/types/common'

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']

export default function SettingsScreen() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const downloadMutation = useBackupDownload()
  const restoreMutation = useBackupRestore()
  const clearAuth = useAuthStore((s) => s.clear)

  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false)
  const [dateValue, setDateValue] = useState('')

  function handleCurrencyChange(currency: string) {
    if (currency) {
      updateSettings.mutate({ displayCurrency: currency as Currency })
    }
  }

  function handleDateChange(text: string) {
    setDateValue(text)
    // Validate format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      updateSettings.mutate({ initialDate: text })
    }
  }

  async function handleRestore() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    })

    if (result.canceled || !result.assets?.[0]) return

    Alert.alert(
      'Restore Backup',
      'This will replace ALL current data with the backup. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => restoreMutation.mutate(result.assets[0].uri),
        },
      ],
    )
  }

  function handleLogout() {
    Alert.alert('Disconnect', 'Remove server connection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          clearAuth()
          router.replace('/login')
        },
      },
    ])
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12">
      {/* General */}
      <View className="bg-card border border-border rounded-lg p-4 mb-4">
        <Text className="text-base font-semibold text-foreground mb-1">General</Text>
        <Text className="text-sm text-muted-foreground mb-4">
          Dashboard currency and the starting date for "All Time" filter.
        </Text>

        {isLoading ? (
          <Text className="text-sm text-muted-foreground">Loading...</Text>
        ) : (
          <View className="gap-4">
            <View>
              <Text className="text-sm font-medium text-foreground mb-1">Display Currency</Text>
              <Pressable
                onPress={() => setCurrencyPickerOpen(true)}
                className="border border-border rounded-lg px-3 py-2.5 bg-background"
              >
                <Text className="text-foreground">{settings?.displayCurrency ?? 'UAH'}</Text>
              </Pressable>
            </View>

            <View>
              <Text className="text-sm font-medium text-foreground mb-1">Initial Date</Text>
              <TextInput
                className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-background"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                value={dateValue || settings?.initialDate || '2022-01-01'}
                onChangeText={handleDateChange}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        )}
      </View>

      {/* Backup */}
      <View className="bg-card border border-border rounded-lg p-4 mb-4">
        <Text className="text-base font-semibold text-foreground mb-1">Export Backup</Text>
        <Text className="text-sm text-muted-foreground mb-3">
          Download a full backup of all data as a ZIP file.
        </Text>
        <Pressable
          onPress={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          className={`rounded-lg py-2.5 ${downloadMutation.isPending ? 'bg-muted' : 'bg-primary'}`}
        >
          <Text className={`text-center font-medium ${downloadMutation.isPending ? 'text-muted-foreground' : 'text-white'}`}>
            {downloadMutation.isPending ? 'Downloading...' : 'Download Backup'}
          </Text>
        </Pressable>
      </View>

      {/* Restore */}
      <View className="bg-card border border-border rounded-lg p-4 mb-4">
        <Text className="text-base font-semibold text-foreground mb-1">Restore from Backup</Text>
        <Text className="text-sm text-muted-foreground mb-3">
          Upload a backup ZIP to replace all current data.
        </Text>
        <Pressable
          onPress={handleRestore}
          disabled={restoreMutation.isPending}
          className={`rounded-lg py-2.5 ${restoreMutation.isPending ? 'bg-muted' : 'bg-destructive'}`}
        >
          <Text className={`text-center font-medium ${restoreMutation.isPending ? 'text-muted-foreground' : 'text-white'}`}>
            {restoreMutation.isPending ? 'Restoring...' : 'Restore from Backup'}
          </Text>
        </Pressable>
      </View>

      {/* Disconnect */}
      <View className="bg-card border border-border rounded-lg p-4">
        <Text className="text-base font-semibold text-foreground mb-1">Server Connection</Text>
        <Text className="text-sm text-muted-foreground mb-3">
          Disconnect from the current server.
        </Text>
        <Pressable onPress={handleLogout} className="rounded-lg py-2.5 bg-muted">
          <Text className="text-center font-medium text-destructive">Disconnect</Text>
        </Pressable>
      </View>

      <PickerModal
        visible={currencyPickerOpen}
        onClose={() => setCurrencyPickerOpen(false)}
        title="Display Currency"
        items={CURRENCIES.map((c) => ({ id: c, label: c }))}
        selectedId={settings?.displayCurrency ?? 'UAH'}
        onSelect={handleCurrencyChange}
        searchable={false}
      />
    </ScrollView>
  )
}
