import { useState, useMemo } from 'react'
import { View, Text, FlatList, Pressable, Alert, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useAccounts, useUpdateAccount, useDeleteAccount } from '@/api/use-accounts'
import { useSettings } from '@/api/use-settings'
import { useFilterStore } from '@/stores/filter-store'
import { formatCurrency } from '@/lib/currency'
import { PickerModal } from '@/components/picker-modal'
import type { AccountResponse } from '@/types/account'
import type { Currency } from '@/types/common'

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']

export default function AccountsScreen() {
  const { data: accounts, isLoading, refetch } = useAccounts()
  const { data: settings } = useSettings()
  const displayCurrency = settings?.displayCurrency
  const updateMutation = useUpdateAccount()
  const deleteMutation = useDeleteAccount()
  const { currencyFilter, sortField, sortDir } = useFilterStore((s) => s.accounts)
  const setAccounts = useFilterStore((s) => s.setAccounts)
  const resetAccounts = useFilterStore((s) => s.resetAccounts)
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const hasActiveFilters = currencyFilter !== '' || sortField !== 'name' || sortDir !== 'asc'

  const filteredAccounts = useMemo(() => {
    let list = accounts ?? []
    if (currencyFilter) list = list.filter((a) => a.currency === currencyFilter)
    if (sortField) {
      const dir = sortDir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => {
        if (sortField === 'name') return a.name.localeCompare(b.name) * dir
        if (sortField === 'converted') {
          const x = a.balanceInDisplayCurrency
          const y = b.balanceInDisplayCurrency
          if (x === null && y === null) return 0
          if (x === null) return 1
          if (y === null) return -1
          return (x - y) * dir
        }
        return (a.balance - b.balance) * dir
      })
    }
    return list
  }, [accounts, currencyFilter, sortField, sortDir])

  function handleDelete(account: AccountResponse) {
    Alert.alert('Delete Account', `Delete "${account.name}"? All related transactions will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(account.id) },
    ])
  }

  function toggleActive(account: AccountResponse) {
    updateMutation.mutate({
      id: account.id,
      data: { name: account.name, currency: account.currency, active: !account.active, color: account.color },
    })
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  return (
    <View className="flex-1 bg-background">
      {/* Filters */}
      <View className="flex-row flex-wrap gap-2 px-4 py-2">
        <Pressable onPress={() => setCurrencyPickerOpen(true)} className="bg-card border border-border rounded-lg px-2.5 py-1.5">
          <Text className="text-xs text-foreground">{currencyFilter || 'All currencies'}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (sortField === 'name') setAccounts({ sortField: 'balance', sortDir: 'desc' })
            else if (sortField === 'balance') setAccounts({ sortField: 'converted', sortDir: 'desc' })
            else setAccounts({ sortField: 'name', sortDir: 'asc' })
          }}
          className="bg-card border border-border rounded-lg px-2.5 py-1.5"
        >
          <Text className="text-xs text-foreground">
            Sort: {sortField ?? 'name'} {sortDir}
          </Text>
        </Pressable>
        {hasActiveFilters && (
          <Pressable onPress={resetAccounts} className="bg-muted rounded-lg px-2.5 py-1.5">
            <Text className="text-xs text-muted-foreground">Reset</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={filteredAccounts}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-24"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item: account }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/account-form', params: { id: account.id, editData: JSON.stringify(account) } })}
            onLongPress={() => handleDelete(account)}
            className={`bg-card border border-border rounded-lg px-3 py-3 mb-2 ${!account.active ? 'opacity-60' : ''}`}
          >
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2 flex-1">
                {account.color && <View className="w-3 h-3 rounded-full" style={{ backgroundColor: account.color }} />}
                <Text className="font-medium text-foreground">{account.name}</Text>
                {!account.active && (
                  <View className="bg-muted rounded px-1.5 py-0.5">
                    <Text className="text-xs text-muted-foreground">Inactive</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => toggleActive(account)} className="px-2">
                <Text className={`text-lg ${account.active ? 'text-primary' : 'text-muted-foreground'}`}>
                  {account.active ? '[x]' : '[ ]'}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-foreground">{formatCurrency(account.balance, account.currency)}</Text>
              {displayCurrency && account.balanceInDisplayCurrency !== null ? (
                <Text className="text-sm text-muted-foreground">{formatCurrency(account.balanceInDisplayCurrency, displayCurrency)}</Text>
              ) : (
                <Text className="text-sm text-muted-foreground">-</Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="py-12">
            <Text className="text-center text-muted-foreground">{isLoading ? 'Loading...' : 'No accounts yet'}</Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        onPress={() => router.push('/account-form')}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>

      <PickerModal
        visible={currencyPickerOpen}
        onClose={() => setCurrencyPickerOpen(false)}
        title="Currency"
        items={CURRENCIES.map((c) => ({ id: c, label: c }))}
        selectedId={currencyFilter}
        onSelect={(id) => setAccounts({ currencyFilter: (id || '') as Currency | '' })}
        searchable={false}
        allowNone
        noneLabel="All currencies"
      />
    </View>
  )
}
