import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useCreateAccount, useUpdateAccount } from '@/api/use-accounts'
import { PickerModal } from '@/components/picker-modal'
import { toSubunits, fromSubunits } from '@/lib/currency'
import type { AccountResponse } from '@/types/account'
import type { Currency } from '@/types/common'

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

export default function AccountFormScreen() {
  const params = useLocalSearchParams<{ id?: string; editData?: string }>()
  const editAccount: AccountResponse | null = params.editData
    ? JSON.parse(params.editData)
    : null
  const isEdit = !!editAccount

  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()

  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('UAH')
  const [initialBalance, setInitialBalance] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false)

  useEffect(() => {
    if (editAccount) {
      setName(editAccount.name)
      setCurrency(editAccount.currency)
      setColor(editAccount.color)
    }
  }, [editAccount])

  function handleSubmit() {
    if (!name.trim()) return

    if (isEdit && editAccount) {
      updateMutation.mutate(
        {
          id: editAccount.id,
          data: { name: name.trim(), currency, active: editAccount.active, color },
        },
        { onSuccess: () => router.back() },
      )
    } else {
      const balance = parseFloat(initialBalance) || 0
      createMutation.mutate(
        { name: name.trim(), currency, initialBalance: toSubunits(balance), color },
        { onSuccess: () => router.back() },
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
      {/* Name */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-1">Name</Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
          value={name}
          onChangeText={setName}
          placeholder="Account name"
          placeholderTextColor="#94a3b8"
          autoFocus
        />
      </View>

      {/* Currency */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-1">Currency</Text>
        <Pressable
          onPress={() => setCurrencyPickerOpen(true)}
          className="border border-border rounded-lg px-3 py-2.5 bg-card"
        >
          <Text className="text-foreground">{currency}</Text>
        </Pressable>
      </View>

      {/* Initial Balance (create only) */}
      {!isEdit && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">Initial Balance</Text>
          <TextInput
            className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
            value={initialBalance}
            onChangeText={setInitialBalance}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
          />
        </View>
      )}

      {/* Color */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-foreground mb-2">Color</Text>
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => setColor(null)}
            className={`w-8 h-8 rounded-full items-center justify-center border ${color === null ? 'border-primary border-2' : 'border-border'} bg-muted`}
          >
            {color === null && <Text className="text-xs text-foreground">-</Text>}
          </Pressable>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              className={`w-8 h-8 rounded-full ${color === c ? 'border-2 border-foreground' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </View>
      </View>

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={isPending || !name.trim()}
        className={`rounded-lg py-3 ${isPending || !name.trim() ? 'bg-muted' : 'bg-primary'}`}
      >
        <Text className={`text-center font-medium ${isPending || !name.trim() ? 'text-muted-foreground' : 'text-white'}`}>
          {isPending ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Text>
      </Pressable>

      <PickerModal
        visible={currencyPickerOpen}
        onClose={() => setCurrencyPickerOpen(false)}
        title="Currency"
        items={CURRENCIES.map((c) => ({ id: c, label: c }))}
        selectedId={currency}
        onSelect={(id) => { if (id) setCurrency(id as Currency) }}
        searchable={false}
      />
    </ScrollView>
  )
}
