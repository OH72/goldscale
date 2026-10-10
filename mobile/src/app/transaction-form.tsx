import { useState, useEffect, useMemo } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { useCreateTransaction, useUpdateTransaction } from '@/api/use-transactions'
import { PickerModal, MultiPickerModal } from '@/components/picker-modal'
import { toSubunits, fromSubunits } from '@/lib/currency'
import { toISODate } from '@/lib/date'
import type { TransactionResponse } from '@/types/transaction'
import type { TransactionType } from '@/types/common'

export default function TransactionFormScreen() {
  const params = useLocalSearchParams<{ id?: string; editData?: string; defaultAccountId?: string }>()
  const editTransaction: TransactionResponse | null = params.editData
    ? JSON.parse(params.editData)
    : null
  const isEdit = !!editTransaction
  const isInitialBalance = editTransaction?.type === 'INITIAL_BALANCE'

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()

  const [txnType, setTxnType] = useState<TransactionType>(editTransaction?.type ?? 'EXPENSE')
  const [amount, setAmount] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [targetAccountId, setTargetAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const [accountPickerOpen, setAccountPickerOpen] = useState(false)
  const [targetAccountPickerOpen, setTargetAccountPickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)

  useEffect(() => {
    if (editTransaction) {
      setTxnType(editTransaction.type)
      setAmount(fromSubunits(editTransaction.amount).toFixed(2))
      setTargetAmount(editTransaction.targetAmount ? fromSubunits(editTransaction.targetAmount).toFixed(2) : '')
      setAccountId(editTransaction.accountId)
      setTargetAccountId(editTransaction.targetAccountId ?? '')
      setCategoryId(editTransaction.categoryId ?? '')
      setDescription(editTransaction.description ?? '')
      setDate(editTransaction.date)
      setSelectedTagIds(editTransaction.tagIds ?? [])
    } else {
      const defaultId = params.defaultAccountId ?? accounts?.find((a) => a.active)?.id ?? accounts?.[0]?.id ?? ''
      setAccountId(defaultId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTransaction, accounts])

  const filteredCategories = useMemo(() =>
    (categories ?? []).filter((c) =>
      txnType === 'INCOME'
        ? c.type === 'INCOME' || c.type === 'BOTH'
        : c.type === 'EXPENSE' || c.type === 'BOTH',
    ).sort((a, b) => a.name.localeCompare(b.name)),
    [categories, txnType],
  )

  const selectedAccount = accounts?.find((a) => a.id === accountId)
  const selectedTargetAccount = accounts?.find((a) => a.id === targetAccountId)
  const isCrossCurrency = txnType === 'TRANSFER' && selectedAccount && selectedTargetAccount && selectedAccount.currency !== selectedTargetAccount.currency

  function handleSubmit() {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      Alert.alert('Error', 'Amount must be >= 0')
      return
    }
    if (!accountId) {
      Alert.alert('Error', 'Account is required')
      return
    }
    if (txnType !== 'TRANSFER' && txnType !== 'INITIAL_BALANCE' && !categoryId) {
      Alert.alert('Error', 'Category is required')
      return
    }

    const tagIds = selectedTagIds.length > 0 ? selectedTagIds : null

    if (isEdit && editTransaction) {
      const parsedTarget = targetAmount ? parseFloat(targetAmount) : null
      updateMutation.mutate(
        {
          id: editTransaction.id,
          data: {
            amount: toSubunits(parsedAmount),
            categoryId: categoryId || null,
            date,
            description: description || null,
            targetAmount: txnType === 'TRANSFER' && parsedTarget ? toSubunits(parsedTarget) : null,
            accountId,
            targetAccountId: targetAccountId || null,
            tagIds,
          },
        },
        { onSuccess: () => router.back() },
      )
      return
    }

    if (txnType === 'TRANSFER') {
      if (!targetAccountId) {
        Alert.alert('Error', 'Target account is required for transfers')
        return
      }
      const parsedTarget = targetAmount ? parseFloat(targetAmount) : parsedAmount
      createMutation.mutate(
        {
          type: 'TRANSFER',
          sourceAccountId: accountId,
          targetAccountId,
          amount: toSubunits(parsedAmount),
          targetAmount: toSubunits(parsedTarget),
          date,
          description: description || null,
          tagIds,
        },
        { onSuccess: () => router.back() },
      )
    } else {
      createMutation.mutate(
        {
          type: txnType as 'INCOME' | 'EXPENSE',
          accountId,
          amount: toSubunits(parsedAmount),
          categoryId: categoryId!,
          date,
          description: description || null,
          tagIds,
        },
        { onSuccess: () => router.back() },
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
      {/* Type tabs (only for new, non-initial-balance) */}
      {!isEdit && !isInitialBalance && (
        <View className="flex-row gap-1 mb-4">
          {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTxnType(t); setCategoryId('') }}
              className={`flex-1 rounded-lg py-2 ${txnType === t ? 'bg-primary' : 'bg-card border border-border'}`}
            >
              <Text className={`text-center text-sm font-medium ${txnType === t ? 'text-white' : 'text-foreground'}`}>
                {t === 'EXPENSE' ? 'Expense' : t === 'INCOME' ? 'Income' : 'Transfer'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Account */}
      {!isInitialBalance && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">
            {txnType === 'TRANSFER' ? 'Source Account' : 'Account'}
          </Text>
          <Pressable
            onPress={() => setAccountPickerOpen(true)}
            className="border border-border rounded-lg px-3 py-2.5 bg-card flex-row items-center gap-2"
          >
            {selectedAccount?.color && <View className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAccount.color }} />}
            <Text className="text-foreground flex-1">
              {selectedAccount ? `${selectedAccount.name} (${selectedAccount.currency})` : 'Select account'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Target Account (transfer) */}
      {txnType === 'TRANSFER' && !isInitialBalance && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">Target Account</Text>
          <Pressable
            onPress={() => setTargetAccountPickerOpen(true)}
            className="border border-border rounded-lg px-3 py-2.5 bg-card flex-row items-center gap-2"
          >
            {selectedTargetAccount?.color && <View className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTargetAccount.color }} />}
            <Text className="text-foreground flex-1">
              {selectedTargetAccount ? `${selectedTargetAccount.name} (${selectedTargetAccount.currency})` : 'Select target'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Amount */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-1">
          Amount{selectedAccount ? ` (${selectedAccount.currency})` : ''}
        </Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* Target Amount (cross-currency transfer) */}
      {txnType === 'TRANSFER' && (isCrossCurrency || isEdit) && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">
            Target Amount{selectedTargetAccount ? ` (${selectedTargetAccount.currency})` : ''}
          </Text>
          <TextInput
            className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
            value={targetAmount}
            onChangeText={setTargetAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
          />
        </View>
      )}

      {/* Category (income/expense) */}
      {!isInitialBalance && txnType !== 'TRANSFER' && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">Category</Text>
          <Pressable
            onPress={() => setCategoryPickerOpen(true)}
            className="border border-border rounded-lg px-3 py-2.5 bg-card"
          >
            <Text className={categoryId ? 'text-foreground' : 'text-muted-foreground'}>
              {categoryId ? (filteredCategories.find((c) => c.id === categoryId)?.name ?? 'Select category') : 'Select category'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Date */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-1">Date</Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* Tags */}
      {!isInitialBalance && tags && tags.length > 0 && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">Tags</Text>
          <Pressable
            onPress={() => setTagPickerOpen(true)}
            className="border border-border rounded-lg px-3 py-2.5 bg-card"
          >
            {selectedTagIds.length === 0 ? (
              <Text className="text-muted-foreground">Select tags</Text>
            ) : (
              <View className="flex-row flex-wrap gap-1">
                {selectedTagIds.map((id) => {
                  const tag = tags.find((t) => t.id === id)
                  return tag ? (
                    <View key={id} className="bg-muted rounded px-2 py-0.5">
                      <Text className="text-xs text-foreground">{tag.name}</Text>
                    </View>
                  ) : null
                })}
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* Description */}
      {!isInitialBalance && (
        <View className="mb-6">
          <Text className="text-sm font-medium text-foreground mb-1">Description</Text>
          <TextInput
            className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            placeholderTextColor="#94a3b8"
          />
        </View>
      )}

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={isPending}
        className={`rounded-lg py-3 ${isPending ? 'bg-muted' : 'bg-primary'}`}
      >
        <Text className={`text-center font-medium ${isPending ? 'text-muted-foreground' : 'text-white'}`}>
          {isPending ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Text>
      </Pressable>

      {/* Picker Modals */}
      <PickerModal
        visible={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        title={txnType === 'TRANSFER' ? 'Source Account' : 'Account'}
        items={(accounts ?? [])
          .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
          .map((a) => ({
            id: a.id,
            label: `${a.name} (${a.currency})${!a.active ? ' (inactive)' : ''}`,
          }))}
        selectedId={accountId}
        onSelect={setAccountId}
      />

      <PickerModal
        visible={targetAccountPickerOpen}
        onClose={() => setTargetAccountPickerOpen(false)}
        title="Target Account"
        items={(accounts ?? [])
          .filter((a) => a.id !== accountId)
          .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
          .map((a) => ({
            id: a.id,
            label: `${a.name} (${a.currency})${!a.active ? ' (inactive)' : ''}`,
          }))}
        selectedId={targetAccountId}
        onSelect={setTargetAccountId}
      />

      <PickerModal
        visible={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="Category"
        items={filteredCategories.map((c) => ({ id: c.id, label: c.name }))}
        selectedId={categoryId}
        onSelect={setCategoryId}
      />

      <MultiPickerModal
        visible={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        title="Tags"
        items={(tags ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, label: t.name }))}
        selectedIds={selectedTagIds}
        onToggle={(id) => {
          setSelectedTagIds((prev) =>
            prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
          )
        }}
      />
    </ScrollView>
  )
}
