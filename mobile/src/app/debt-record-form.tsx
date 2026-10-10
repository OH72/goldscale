import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { usePeople } from '@/api/use-people'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { useCreateDebtRecord, useUpdateDebtRecord } from '@/api/use-debt-records'
import { PickerModal, MultiPickerModal } from '@/components/picker-modal'
import { toSubunits, fromSubunits } from '@/lib/currency'
import { toISODate } from '@/lib/date'
import type { DebtRecordResponse, DebtType } from '@/types/debt'
import type { Currency } from '@/types/common'

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']

export default function DebtRecordFormScreen() {
  const params = useLocalSearchParams<{ id?: string; editData?: string }>()
  const editRecord: DebtRecordResponse | null = params.editData
    ? JSON.parse(params.editData)
    : null
  const isEdit = !!editRecord

  const { data: people } = usePeople()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const createMutation = useCreateDebtRecord()
  const updateMutation = useUpdateDebtRecord()

  const [personId, setPersonId] = useState('')
  const [type, setType] = useState<DebtType>('DEBT')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('UAH')
  const [categoryId, setCategoryId] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))

  const [personPickerOpen, setPersonPickerOpen] = useState(false)
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)

  useEffect(() => {
    if (editRecord) {
      setPersonId(editRecord.personId)
      setType(editRecord.type)
      setAmount(fromSubunits(editRecord.amount).toFixed(2))
      setCurrency(editRecord.currency)
      setCategoryId(editRecord.categoryId ?? '')
      setSelectedTagIds(editRecord.tagIds ?? [])
      setDescription(editRecord.description ?? '')
      setDate(editRecord.date)
    }
  }, [editRecord])

  function handleSubmit() {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    if (!personId) return

    const tagIds = selectedTagIds.length > 0 ? selectedTagIds : undefined

    if (isEdit && editRecord) {
      updateMutation.mutate(
        {
          id: editRecord.id,
          data: {
            personId,
            type,
            amount: toSubunits(parsedAmount),
            currency,
            categoryId: categoryId || null,
            tagIds,
            description: description || null,
            date,
          },
        },
        { onSuccess: () => router.back() },
      )
    } else {
      createMutation.mutate(
        {
          personId,
          type,
          amount: toSubunits(parsedAmount),
          currency,
          categoryId: categoryId || null,
          tagIds,
          description: description || null,
          date,
        },
        { onSuccess: () => router.back() },
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const selectedPerson = people?.find((p) => p.id === personId)

  const filteredCategories = (categories ?? [])
    .filter((c) => c.type === 'EXPENSE' || c.type === 'BOTH')
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
      {/* Type */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-2">Type</Text>
        <View className="flex-row gap-2">
          {(['DEBT', 'LOAN'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className={`flex-1 rounded-lg py-2.5 ${type === t ? 'bg-primary' : 'bg-card border border-border'}`}
            >
              <Text className={`text-center text-sm font-medium ${type === t ? 'text-white' : 'text-foreground'}`}>
                {t === 'DEBT' ? 'Debt (I owe)' : 'Loan (They owe)'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Person */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-1">Person</Text>
        <Pressable
          onPress={() => setPersonPickerOpen(true)}
          className="border border-border rounded-lg px-3 py-2.5 bg-card"
        >
          <Text className={personId ? 'text-foreground' : 'text-muted-foreground'}>
            {selectedPerson?.name ?? 'Select person'}
          </Text>
        </Pressable>
      </View>

      {/* Amount */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-1">Amount</Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#94a3b8"
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

      {/* Category */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-1">Category (optional)</Text>
        <Pressable
          onPress={() => setCategoryPickerOpen(true)}
          className="border border-border rounded-lg px-3 py-2.5 bg-card"
        >
          <Text className={categoryId ? 'text-foreground' : 'text-muted-foreground'}>
            {categoryId
              ? (filteredCategories.find((c) => c.id === categoryId)?.name ?? 'Select category')
              : 'Select category'}
          </Text>
        </Pressable>
      </View>

      {/* Tags */}
      {tags && tags.length > 0 && (
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
        disabled={isPending || !personId || !amount}
        className={`rounded-lg py-3 ${isPending || !personId || !amount ? 'bg-muted' : 'bg-primary'}`}
      >
        <Text className={`text-center font-medium ${isPending || !personId || !amount ? 'text-muted-foreground' : 'text-white'}`}>
          {isPending ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Text>
      </Pressable>

      {/* Picker Modals */}
      <PickerModal
        visible={personPickerOpen}
        onClose={() => setPersonPickerOpen(false)}
        title="Person"
        items={(people ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ id: p.id, label: p.name }))}
        selectedId={personId}
        onSelect={setPersonId}
      />

      <PickerModal
        visible={currencyPickerOpen}
        onClose={() => setCurrencyPickerOpen(false)}
        title="Currency"
        items={CURRENCIES.map((c) => ({ id: c, label: c }))}
        selectedId={currency}
        onSelect={(id) => { if (id) setCurrency(id as Currency) }}
        searchable={false}
      />

      <PickerModal
        visible={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="Category"
        items={filteredCategories.map((c) => ({ id: c.id, label: c.name }))}
        selectedId={categoryId}
        onSelect={setCategoryId}
        allowNone
        noneLabel="No category"
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
