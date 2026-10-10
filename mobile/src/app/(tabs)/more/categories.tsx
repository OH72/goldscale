import { useState, useMemo } from 'react'
import { View, Text, FlatList, Pressable, Alert, TextInput, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useCategories, useDeleteCategory, useBulkDeleteCategories } from '@/api/use-categories'
import { useFilterStore } from '@/stores/filter-store'
import type { CategoryResponse } from '@/types/category'
import type { CategoryType } from '@/types/common'

const TYPE_LABELS: Record<CategoryType, string> = { INCOME: 'Income', EXPENSE: 'Expense', BOTH: 'Both' }
const TYPE_COLORS: Record<CategoryType, string> = {
  INCOME: 'bg-green-100 text-green-700',
  EXPENSE: 'bg-red-100 text-red-700',
  BOTH: 'bg-blue-100 text-blue-700',
}

export default function CategoriesScreen() {
  const { data: categories, isLoading, refetch } = useCategories()
  const deleteMutation = useDeleteCategory()
  const bulkDeleteMutation = useBulkDeleteCategories()
  const { typeFilter, search } = useFilterStore((s) => s.categories)
  const setCategories = useFilterStore((s) => s.setCategories)
  const resetCategories = useFilterStore((s) => s.resetCategories)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  const hasActiveFilters = typeFilter !== 'ALL' || search !== ''

  const sorted = useMemo(() =>
    [...(categories ?? [])]
      .filter((c) => typeFilter === 'ALL' || c.type === typeFilter)
      .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, typeFilter, search])

  function handleDelete(cat: CategoryResponse) {
    Alert.alert('Delete Category', `Delete "${cat.name}"? Fails if transactions reference it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(cat.id) },
    ])
  }

  function handleBulkDelete() {
    Alert.alert('Delete Categories', `Delete ${selectedIds.size} selected?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        bulkDeleteMutation.mutate(Array.from(selectedIds), {
          onSuccess: () => setSelectedIds(new Set()),
        })
      }},
    ])
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  return (
    <View className="flex-1 bg-background">
      {/* Type filter tabs */}
      <View className="flex-row gap-1 px-4 pt-2">
        {(['ALL', 'EXPENSE', 'INCOME', 'BOTH'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => { setCategories({ typeFilter: t }); setSelectedIds(new Set()) }}
            className={`rounded-lg px-2.5 py-1.5 ${typeFilter === t ? 'bg-primary' : 'bg-card border border-border'}`}
          >
            <Text className={`text-xs ${typeFilter === t ? 'text-white' : 'text-foreground'}`}>
              {t === 'ALL' ? `All (${categories?.length ?? 0})` : `${TYPE_LABELS[t]} (${categories?.filter((c) => c.type === t).length ?? 0})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      <View className="px-4 py-2 flex-row items-center gap-2">
        <TextInput
          className="flex-1 border border-border rounded-lg px-3 py-2 text-foreground bg-card text-sm"
          placeholder="Search categories..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={(v) => setCategories({ search: v })}
        />
        {hasActiveFilters && (
          <Pressable onPress={() => { resetCategories(); setSelectedIds(new Set()) }} className="bg-muted rounded-lg px-2.5 py-1.5">
            <Text className="text-xs text-muted-foreground">Reset</Text>
          </Pressable>
        )}
      </View>

      {selectedIds.size > 0 && (
        <Pressable onPress={handleBulkDelete} className="mx-4 mb-2 bg-destructive rounded-lg px-3 py-2">
          <Text className="text-white text-sm font-medium text-center">Delete selected ({selectedIds.size})</Text>
        </Pressable>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-24"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item: cat }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/category-form', params: { id: cat.id, editData: JSON.stringify(cat) } })}
            onLongPress={() => toggleSelect(cat.id)}
            className={`bg-card border rounded-lg px-3 py-3 mb-1 flex-row items-center justify-between ${selectedIds.has(cat.id) ? 'border-primary' : 'border-border'}`}
          >
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => toggleSelect(cat.id)} className="mr-1">
                <View className={`w-5 h-5 rounded border items-center justify-center ${selectedIds.has(cat.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                  {selectedIds.has(cat.id) && <Text className="text-white text-xs font-bold">{'✓'}</Text>}
                </View>
              </Pressable>
              <Text className="font-medium text-foreground">{cat.name}</Text>
              <View className={`px-2 py-0.5 rounded ${TYPE_COLORS[cat.type]}`}>
                <Text className="text-xs font-medium">{TYPE_LABELS[cat.type]}</Text>
              </View>
            </View>
            <Pressable onPress={() => handleDelete(cat)}>
              <Text className="text-muted-foreground text-lg">{'...'}</Text>
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="py-12">
            <Text className="text-center text-muted-foreground">{isLoading ? 'Loading...' : 'No categories yet'}</Text>
          </View>
        }
      />

      <Pressable
        onPress={() => router.push('/category-form')}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>
    </View>
  )
}
