import { useState, useCallback } from 'react'
import { View, Text, FlatList, Pressable, Alert, TextInput, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useTransactions, useDeleteTransaction } from '@/api/use-transactions'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { PickerModal } from '@/components/picker-modal'
import type { TransactionResponse, TransactionFilters } from '@/types/transaction'
import type { TransactionType } from '@/types/common'

const TYPE_COLORS: Record<TransactionType, string> = {
  INCOME: 'bg-green-100 text-green-700',
  EXPENSE: 'bg-red-100 text-red-700',
  TRANSFER: 'bg-blue-100 text-blue-700',
  INITIAL_BALANCE: 'bg-gray-100 text-gray-700',
}

const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  INITIAL_BALANCE: 'Init Bal',
}

export default function TransactionsScreen() {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const deleteMutation = useDeleteTransaction()

  const [accountId, setAccountId] = useState<string | undefined>()
  const [type, setType] = useState<TransactionType | undefined>()
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [tagId, setTagId] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<string | undefined>()
  const [page, setPage] = useState(0)

  const [accountPickerOpen, setAccountPickerOpen] = useState(false)
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const filters: TransactionFilters = {
    accountId,
    type,
    categoryId,
    tagId,
    search: search || undefined,
    sort,
    page,
    size: 20,
  }

  const { data, isLoading, error, refetch } = useTransactions(filters)

  function handleDelete(txn: TransactionResponse) {
    Alert.alert('Delete Transaction', 'The account balance will be adjusted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(txn.id) },
    ])
  }

  function handleEdit(txn: TransactionResponse) {
    router.push({
      pathname: '/transaction-form',
      params: { id: txn.id, editData: JSON.stringify(txn) },
    })
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  function renderAmount(txn: TransactionResponse) {
    const account = accounts?.find((a) => a.id === txn.accountId)
    const currency = account?.currency ?? 'UAH'

    if (txn.type === 'TRANSFER' && txn.targetAmount) {
      const targetAccount = accounts?.find((a) => a.id === txn.targetAccountId)
      const targetCurrency = targetAccount?.currency ?? currency
      return (
        <View>
          <Text className="text-sm font-medium text-foreground text-right">{formatCurrency(txn.amount, currency)}</Text>
          <Text className="text-xs text-muted-foreground text-right">
            {'-> '}{formatCurrency(txn.targetAmount, targetCurrency)}
          </Text>
        </View>
      )
    }

    const prefix = txn.type === 'INCOME' ? '+' : txn.type === 'EXPENSE' ? '-' : ''
    const color = txn.type === 'INCOME' ? 'text-green-600' : txn.type === 'EXPENSE' ? 'text-red-600' : 'text-foreground'
    return <Text className={`text-sm font-medium text-right ${color}`}>{prefix}{formatCurrency(txn.amount, currency)}</Text>
  }

  function renderItem({ item: txn }: { item: TransactionResponse }) {
    const account = accounts?.find((a) => a.id === txn.accountId)
    return (
      <Pressable
        onPress={() => handleEdit(txn)}
        onLongPress={() => {
          if (txn.type !== 'INITIAL_BALANCE') handleDelete(txn)
        }}
        className="bg-card border border-border rounded-lg px-3 py-3 mb-2"
      >
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-1 mr-2">
            <View className="flex-row items-center gap-2 mb-1">
              <View className={`px-2 py-0.5 rounded ${TYPE_COLORS[txn.type] ?? 'bg-gray-100'}`}>
                <Text className="text-xs font-medium">{TYPE_LABELS[txn.type] ?? txn.type}</Text>
              </View>
              <Text className="text-xs text-muted-foreground">{formatDate(txn.date)}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              {account?.color && <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: account.color }} />}
              <Text className="text-sm text-foreground" numberOfLines={1}>{txn.accountName}</Text>
              {txn.type === 'TRANSFER' && txn.targetAccountName && (
                <Text className="text-xs text-muted-foreground">{'-> '}{txn.targetAccountName}</Text>
              )}
            </View>
          </View>
          {renderAmount(txn)}
        </View>

        {(txn.categoryName || txn.description || (txn.tagNames && txn.tagNames.length > 0)) && (
          <View className="mt-1">
            {txn.categoryName && <Text className="text-xs text-muted-foreground">{txn.categoryName}</Text>}
            {txn.description && <Text className="text-xs text-muted-foreground" numberOfLines={1}>{txn.description}</Text>}
            {txn.tagNames && txn.tagNames.length > 0 && (
              <View className="flex-row flex-wrap gap-1 mt-1">
                {txn.tagNames.map((name) => (
                  <View key={name} className="bg-muted rounded px-1.5 py-0.5">
                    <Text className="text-[10px] text-muted-foreground">{name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </Pressable>
    )
  }

  const totalPages = data?.totalPages ?? 0

  return (
    <View className="flex-1 bg-background">
      {/* Search */}
      <View className="px-4 pt-2">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-foreground bg-card text-sm"
          placeholder="Search..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={(v) => { setSearch(v); setPage(0) }}
        />
      </View>

      {/* Filter chips */}
      <View className="flex-row flex-wrap gap-2 px-4 py-2">
        <Pressable onPress={() => setAccountPickerOpen(true)} className="bg-card border border-border rounded-lg px-2.5 py-1.5">
          <Text className="text-xs text-foreground">
            {accountId ? (accounts?.find((a) => a.id === accountId)?.name ?? 'Account') : 'Account'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setTypePickerOpen(true)} className="bg-card border border-border rounded-lg px-2.5 py-1.5">
          <Text className="text-xs text-foreground">{type ? TYPE_LABELS[type] : 'Type'}</Text>
        </Pressable>
        <Pressable onPress={() => setCategoryPickerOpen(true)} className="bg-card border border-border rounded-lg px-2.5 py-1.5">
          <Text className="text-xs text-foreground">
            {categoryId ? (categories?.find((c) => c.id === categoryId)?.name ?? 'Category') : 'Category'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setTagPickerOpen(true)} className="bg-card border border-border rounded-lg px-2.5 py-1.5">
          <Text className="text-xs text-foreground">
            {tagId ? (tags?.find((t) => t.id === tagId)?.name ?? 'Tag') : 'Tag'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!sort) setSort('date,desc')
            else if (sort === 'date,desc') setSort('date,asc')
            else if (sort === 'date,asc') setSort('amount,desc')
            else if (sort === 'amount,desc') setSort('amount,asc')
            else setSort(undefined)
          }}
          className="bg-card border border-border rounded-lg px-2.5 py-1.5"
        >
          <Text className="text-xs text-foreground">{sort ? `Sort: ${sort}` : 'Sort'}</Text>
        </Pressable>
        {(accountId || type || categoryId || tagId || search || sort) && (
          <Pressable
            onPress={() => { setAccountId(undefined); setType(undefined); setCategoryId(undefined); setTagId(undefined); setSearch(''); setSort(undefined); setPage(0) }}
            className="bg-muted rounded-lg px-2.5 py-1.5"
          >
            <Text className="text-xs text-muted-foreground">Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Transaction List */}
      <FlatList
        data={data?.content ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View className="py-12">
            <Text className="text-center text-muted-foreground">{isLoading ? 'Loading...' : 'No transactions'}</Text>
          </View>
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-sm text-muted-foreground">
                Page {(data?.number ?? 0) + 1} / {totalPages}
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className={`px-3 py-1 rounded border border-border ${page === 0 ? 'opacity-30' : ''}`}
                >
                  <Text className="text-foreground">{'<'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  className={`px-3 py-1 rounded border border-border ${page >= totalPages - 1 ? 'opacity-30' : ''}`}
                >
                  <Text className="text-foreground">{'>'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <Pressable
        onPress={() => router.push({ pathname: '/transaction-form', params: { defaultAccountId: accountId ?? '' } })}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>

      {/* Picker Modals */}
      <PickerModal
        visible={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        title="Account"
        items={(accounts ?? []).sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)).map((a) => ({ id: a.id, label: `${a.name}${!a.active ? ' (inactive)' : ''}` }))}
        selectedId={accountId}
        onSelect={(id) => { setAccountId(id || undefined); setPage(0) }}
        allowNone
        noneLabel="All accounts"
      />

      <PickerModal
        visible={typePickerOpen}
        onClose={() => setTypePickerOpen(false)}
        title="Type"
        items={[
          { id: 'INCOME', label: 'Income' },
          { id: 'EXPENSE', label: 'Expense' },
          { id: 'TRANSFER', label: 'Transfer' },
        ]}
        selectedId={type}
        onSelect={(id) => { setType((id || undefined) as TransactionType | undefined); setPage(0) }}
        searchable={false}
        allowNone
        noneLabel="All types"
      />

      <PickerModal
        visible={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="Category"
        items={(categories ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }))}
        selectedId={categoryId}
        onSelect={(id) => { setCategoryId(id || undefined); setPage(0) }}
        allowNone
        noneLabel="All categories"
      />

      <PickerModal
        visible={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        title="Tag"
        items={(tags ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, label: t.name }))}
        selectedId={tagId}
        onSelect={(id) => { setTagId(id || undefined); setPage(0) }}
        allowNone
        noneLabel="All tags"
      />
    </View>
  )
}
