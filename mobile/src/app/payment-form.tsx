import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAddPayment } from '@/api/use-debt-records'
import { toSubunits, fromSubunits } from '@/lib/currency'
import { toISODate } from '@/lib/date'

export default function PaymentFormScreen() {
  const params = useLocalSearchParams<{ recordId: string; remaining: string; currency: string }>()
  const recordId = params.recordId
  const remaining = params.remaining ? fromSubunits(parseInt(params.remaining, 10)) : 0
  const currency = params.currency ?? ''

  const addPaymentMutation = useAddPayment()

  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : '')
  const [date, setDate] = useState(toISODate(new Date()))
  const [description, setDescription] = useState('')

  function handleSubmit() {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    if (!recordId) return

    addPaymentMutation.mutate(
      {
        recordId,
        data: {
          amount: toSubunits(parsedAmount),
          date,
          description: description || null,
        },
      },
      { onSuccess: () => router.back() },
    )
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
      {remaining > 0 && (
        <View className="bg-muted rounded-lg px-3 py-2 mb-4">
          <Text className="text-sm text-muted-foreground">
            Remaining: {remaining.toFixed(2)} {currency}
          </Text>
        </View>
      )}

      {/* Amount */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-1">
          Amount{currency ? ` (${currency})` : ''}
        </Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#94a3b8"
          autoFocus
        />
      </View>

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

      {/* Description */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-foreground mb-1">Description (optional)</Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={addPaymentMutation.isPending || !amount}
        className={`rounded-lg py-3 ${addPaymentMutation.isPending || !amount ? 'bg-muted' : 'bg-primary'}`}
      >
        <Text className={`text-center font-medium ${addPaymentMutation.isPending || !amount ? 'text-muted-foreground' : 'text-white'}`}>
          {addPaymentMutation.isPending ? 'Adding...' : 'Add Payment'}
        </Text>
      </Pressable>
    </ScrollView>
  )
}
