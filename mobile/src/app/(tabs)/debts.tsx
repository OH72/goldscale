import { useState, useMemo } from 'react'
import { View, Text, FlatList, Pressable, Alert, TextInput, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useDebtRecords, useDeleteDebtRecord, useToggleDebtStatus, useRemovePayment } from '@/api/use-debt-records'
import { usePeople } from '@/api/use-people'
import { useFilterStore } from '@/stores/filter-store'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { PickerModal } from '@/components/picker-modal'
import type { DebtRecordResponse, DebtType, DebtStatus } from '@/types/debt'

export default function DebtsScreen() {
  const { data: people } = usePeople()
  const { personId, type, status, search } = useFilterStore((s) => s.debts)
  const setDebts = useFilterStore((s) => s.setDebts)
  const resetDebts = useFilterStore((s) => s.resetDebts)

  const serverFilters = useMemo(() => {
    const f: { personId?: string; type?: DebtType; status?: DebtStatus } = {}
    if (personId) f.personId = personId
    if (type !== 'ALL') f.type = type
    if (status !== 'ALL') f.status = status
    return f
  }, [personId, type, status])

  const { data: records, isLoading, refetch } = useDebtRecords(serverFilters)
  const deleteMutation = useDeleteDebtRecord()
  const toggleStatusMutation = useToggleDebtStatus()
  const removePaymentMutation = useRemovePayment()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [personPickerOpen, setPersonPickerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const hasActiveFilters = personId !== '' || type !== 'ALL' || status !== 'ALL' || search !== ''

  const filteredRecords = useMemo(() => {
    if (!records) return []
    if (!search) return records
    const q = search.toLowerCase()
    return records.filter((r) => r.description?.toLowerCase().includes(q))
  }, [records, search])

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDelete(record: DebtRecordResponse) {
    Alert.alert('Delete Record', `Delete this ${record.type === 'DEBT' ? 'debt' : 'loan'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(record.id) },
    ])
  }

  function handleRemovePayment(recordId: string, paymentId: string) {
    Alert.alert('Remove Payment', 'The covered amount will be recalculated.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePaymentMutation.mutate({ recordId, paymentId }) },
    ])
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  function renderRecord({ item: record }: { item: DebtRecordResponse }) {
    const expanded = expandedIds.has(record.id)
    const coveragePercent = record.amount > 0 ? Math.round((record.coveredAmount / record.amount) * 100) : 0

    return (
      <View className="bg-card border border-border rounded-lg mb-2 overflow-hidden">
        <Pressable onPress={() => toggleExpand(record.id)} className="px-3 py-3">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center gap-2 flex-1">
              <Text className="text-foreground">{expanded ? 'v' : '>'}</Text>
              <Text className="font-medium text-foreground">{record.personName}</Text>
              <View className={`px-2 py-0.5 rounded ${record.type === 'DEBT' ? 'bg-red-100' : 'bg-green-100'}`}>
                <Text className={`text-xs font-medium ${record.type === 'DEBT' ? 'text-red-700' : 'text-green-700'}`}>
                  {record.type === 'DEBT' ? 'Debt' : 'Loan'}
                </Text>
              </View>
              <View className={`px-2 py-0.5 rounded ${record.status === 'OPEN' ? 'bg-amber-100' : 'bg-green-100'}`}>
                <Text className={`text-xs font-medium ${record.status === 'OPEN' ? 'text-amber-700' : 'text-green-700'}`}>
                  {record.status}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-foreground">{formatCurrency(record.amount, record.currency)}</Text>
            <Text className="text-xs text-muted-foreground">{formatDate(record.date)}</Text>
          </View>

          {/* Progress bar */}
          <View className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <View className="h-full bg-primary rounded-full" style={{ width: `${coveragePercent}%` }} />
          </View>
          <Text className="text-xs text-muted-foreground mt-1">
            {formatCurrency(record.coveredAmount, record.currency)} / {formatCurrency(record.amount, record.currency)} ({coveragePercent}%)
          </Text>

          {record.description && (
            <Text className="text-xs text-muted-foreground mt-1" numberOfLines={1}>{record.description}</Text>
          )}
        </Pressable>

        {expanded && (
          <View className="border-t border-border px-3 py-2">
            {/* Actions */}
            <View className="flex-row gap-2 mb-2">
              <Pressable
                onPress={() => router.push({ pathname: '/payment-form', params: { recordId: record.id, remaining: String(record.remainingAmount), currency: record.currency } })}
                className="bg-primary rounded px-3 py-1.5"
              >
                <Text className="text-white text-xs font-medium">Add Payment</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/debt-record-form', params: { id: record.id, editData: JSON.stringify(record) } })}
                className="bg-muted rounded px-3 py-1.5"
              >
                <Text className="text-foreground text-xs">Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => toggleStatusMutation.mutate(record.id)}
                className="bg-muted rounded px-3 py-1.5"
              >
                <Text className="text-foreground text-xs">{record.status === 'OPEN' ? 'Close' : 'Reopen'}</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(record)} className="bg-red-50 rounded px-3 py-1.5">
                <Text className="text-destructive text-xs">Delete</Text>
              </Pressable>
            </View>

            {/* Payments */}
            {record.payments.length > 0 ? (
              <View>
                <Text className="text-xs font-medium text-muted-foreground mb-1">Payments ({record.payments.length})</Text>
                {record.payments.map((payment) => (
                  <View key={payment.id} className="flex-row items-center justify-between bg-muted/50 rounded px-2 py-1.5 mb-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-medium text-foreground">{formatCurrency(payment.amount, record.currency)}</Text>
                      <Text className="text-xs text-muted-foreground">{formatDate(payment.date)}</Text>
                      {payment.description && <Text className="text-xs text-muted-foreground">{payment.description}</Text>}
                    </View>
                    <Pressable onPress={() => handleRemovePayment(record.id, payment.id)}>
                      <Text className="text-destructive text-xs">X</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-muted-foreground">No payments yet</Text>
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      {/* Filters */}
      <View className="px-4 pt-2 pb-1">
        <View className="flex-row flex-wrap gap-2 mb-2">
          <Pressable onPress={() => setPersonPickerOpen(true)} className="bg-card border border-border rounded-lg px-2.5 py-1.5">
            <Text className="text-xs text-foreground">
              {personId ? (people?.find((p) => p.id === personId)?.name ?? 'Person') : 'Person'}
            </Text>
          </Pressable>

          {(['ALL', 'DEBT', 'LOAN'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setDebts({ type: t })}
              className={`rounded-lg px-2.5 py-1.5 ${type === t ? 'bg-primary' : 'bg-card border border-border'}`}
            >
              <Text className={`text-xs ${type === t ? 'text-white' : 'text-foreground'}`}>
                {t === 'ALL' ? 'All' : t === 'DEBT' ? 'Debts' : 'Loans'}
              </Text>
            </Pressable>
          ))}

          {(['ALL', 'OPEN', 'CLOSED'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setDebts({ status: s })}
              className={`rounded-lg px-2.5 py-1.5 ${status === s ? 'bg-primary' : 'bg-card border border-border'}`}
            >
              <Text className={`text-xs ${status === s ? 'text-white' : 'text-foreground'}`}>
                {s === 'ALL' ? 'All' : s}
              </Text>
            </Pressable>
          ))}

          {hasActiveFilters && (
            <Pressable onPress={resetDebts} className="bg-muted rounded-lg px-2.5 py-1.5">
              <Text className="text-xs text-muted-foreground">Reset</Text>
            </Pressable>
          )}
        </View>

        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-foreground bg-card text-sm"
          placeholder="Search description..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={(v) => setDebts({ search: v })}
        />
      </View>

      <FlatList
        data={filteredRecords}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-2 pb-24"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View className="py-12">
            <Text className="text-center text-muted-foreground">{isLoading ? 'Loading...' : 'No records found'}</Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        onPress={() => router.push('/debt-record-form')}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>

      <PickerModal
        visible={personPickerOpen}
        onClose={() => setPersonPickerOpen(false)}
        title="Person"
        items={(people ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ id: p.id, label: p.name }))}
        selectedId={personId}
        onSelect={(id) => setDebts({ personId: id || '' })}
        allowNone
        noneLabel="All people"
      />
    </View>
  )
}
