import { useState } from 'react'
import { View, Text, FlatList, Pressable, Alert, Modal, ScrollView, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { usePeople, useDeletePerson, useOffsetPreview, useOffsetPerson } from '@/api/use-people'
import { useDebtSummary } from '@/api/use-debt-records'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import type { PersonResponse, PersonSortField, SortDirection, OffsetAllocation } from '@/types/debt'

export default function PeopleScreen() {
  const [sortBy, setSortBy] = useState<PersonSortField>('NAME')
  const [direction, setDirection] = useState<SortDirection>('ASC')
  const { data: people, isLoading, refetch } = usePeople(sortBy, direction)
  const { data: debtSummary } = useDebtSummary()
  const displayCurrency = debtSummary?.displayCurrency ?? ''
  const deleteMutation = useDeletePerson()
  const [refreshing, setRefreshing] = useState(false)

  const [offsetTarget, setOffsetTarget] = useState<PersonResponse | null>(null)
  const offsetPreview = useOffsetPreview(offsetTarget?.id ?? null)
  const offsetMutation = useOffsetPerson()

  function toggleSort(field: PersonSortField) {
    if (field === sortBy) {
      setDirection((d) => (d === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortBy(field)
      setDirection(field === 'NAME' ? 'ASC' : 'DESC')
    }
  }

  function handleDelete(person: PersonResponse) {
    Alert.alert('Delete Person', `Delete "${person.name}"? Fails if they have open records.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(person.id) },
    ])
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  return (
    <View className="flex-1 bg-background">
      {/* Sort buttons */}
      <View className="flex-row flex-wrap gap-1 px-4 pt-2 pb-1">
        {(['NAME', 'TOTAL_DEBT', 'TOTAL_LOAN', 'NET'] as const).map((field) => {
          const labels: Record<PersonSortField, string> = { NAME: 'Name', TOTAL_DEBT: 'I owe', TOTAL_LOAN: 'They owe', NET: 'Net' }
          const active = sortBy === field
          return (
            <Pressable
              key={field}
              onPress={() => toggleSort(field)}
              className={`rounded-lg px-2.5 py-1.5 ${active ? 'bg-primary' : 'bg-card border border-border'}`}
            >
              <Text className={`text-xs ${active ? 'text-white' : 'text-foreground'}`}>
                {labels[field]}{active ? (direction === 'ASC' ? ' ^' : ' v') : ''}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <FlatList
        data={people ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-2 pb-24"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item: person }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/person-form', params: { id: person.id, editData: JSON.stringify(person) } })}
            onLongPress={() => handleDelete(person)}
            className="bg-card border border-border rounded-lg px-3 py-3 mb-2"
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="font-medium text-foreground flex-1">{person.name}</Text>
              {person.canOffset && (
                <Pressable
                  onPress={() => setOffsetTarget(person)}
                  className="bg-muted rounded px-2 py-1 mr-2"
                >
                  <Text className="text-xs text-foreground">Offset</Text>
                </Pressable>
              )}
            </View>
            <View className="flex-row items-center gap-4">
              {person.totalDebt > 0 && (
                <Text className="text-sm text-red-600">
                  I owe: {formatCurrency(person.totalDebt, displayCurrency)}
                </Text>
              )}
              {person.totalLoan > 0 && (
                <Text className="text-sm text-green-600">
                  They owe: {formatCurrency(person.totalLoan, displayCurrency)}
                </Text>
              )}
              {person.net !== 0 && (
                <Text className={`text-sm font-medium ${person.net > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Net: {person.net > 0 ? '+' : ''}{formatCurrency(person.net, displayCurrency)}
                </Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="py-12">
            <Text className="text-center text-muted-foreground">{isLoading ? 'Loading...' : 'No people yet'}</Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        onPress={() => router.push('/person-form')}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>

      {/* Offset Modal */}
      <Modal visible={!!offsetTarget} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOffsetTarget(null)}>
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <Text className="text-lg font-semibold text-foreground">Offset: {offsetTarget?.name}</Text>
            <Pressable onPress={() => setOffsetTarget(null)}>
              <Text className="text-primary font-medium">Close</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4" contentContainerClassName="pb-8">
            {offsetPreview.isLoading && (
              <Text className="text-sm text-muted-foreground">Loading preview...</Text>
            )}

            {offsetPreview.data && offsetPreview.data.currencies.length === 0 && (
              <Text className="text-sm text-muted-foreground">Nothing to offset anymore.</Text>
            )}

            {offsetPreview.data?.currencies.map((entry) => (
              <View key={entry.currency} className="border border-border rounded-lg p-3 mb-3">
                <Text className="text-sm font-medium text-foreground mb-2">
                  {formatCurrency(entry.amount, entry.currency)} will be offset
                </Text>
                <AllocationList title="I owe (debts)" allocations={entry.debts} currency={entry.currency} />
                <AllocationList title="They owe (loans)" allocations={entry.loans} currency={entry.currency} />
              </View>
            ))}

            <Text className="text-xs text-muted-foreground mt-2 mb-4">
              Oldest records are covered first. A payment is added to each record, and fully covered records are closed.
              Amounts in different currencies are not offset.
            </Text>

            <Pressable
              onPress={() => {
                if (offsetTarget) {
                  offsetMutation.mutate(offsetTarget.id, {
                    onSuccess: () => setOffsetTarget(null),
                  })
                }
              }}
              disabled={offsetMutation.isPending || !offsetPreview.data || offsetPreview.data.currencies.length === 0}
              className={`rounded-lg py-3 ${
                offsetMutation.isPending || !offsetPreview.data || offsetPreview.data.currencies.length === 0
                  ? 'bg-muted' : 'bg-primary'
              }`}
            >
              <Text className={`text-center font-medium ${
                offsetMutation.isPending || !offsetPreview.data || offsetPreview.data.currencies.length === 0
                  ? 'text-muted-foreground' : 'text-white'
              }`}>
                {offsetMutation.isPending ? 'Offsetting...' : 'Confirm offset'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

function AllocationList({ title, allocations, currency }: { title: string; allocations: OffsetAllocation[]; currency: string }) {
  if (allocations.length === 0) return null
  return (
    <View className="mb-2">
      <Text className="text-xs font-medium text-muted-foreground mb-1">{title}</Text>
      {allocations.map((a) => (
        <View key={a.recordId} className="bg-muted/50 rounded px-2 py-1.5 mb-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-foreground" numberOfLines={1}>
              {formatDate(a.date)}{a.description ? ` - ${a.description}` : ''}
            </Text>
            <Text className="text-sm font-medium text-foreground ml-2">
              -{formatCurrency(a.amount, currency)}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            {formatCurrency(a.remainingBefore, currency)} {'->'} {a.remainingAfter === 0 ? 'closed' : formatCurrency(a.remainingAfter, currency)}
          </Text>
        </View>
      ))}
    </View>
  )
}
