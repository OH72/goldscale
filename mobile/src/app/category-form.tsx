import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useCreateCategory, useUpdateCategory } from '@/api/use-categories'
import type { CategoryResponse } from '@/types/category'
import type { CategoryType } from '@/types/common'

export default function CategoryFormScreen() {
  const params = useLocalSearchParams<{ id?: string; editData?: string }>()
  const editCategory: CategoryResponse | null = params.editData
    ? JSON.parse(params.editData)
    : null
  const isEdit = !!editCategory

  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()

  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('EXPENSE')

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name)
      setType(editCategory.type)
    }
  }, [editCategory])

  function handleSubmit() {
    if (!name.trim()) return

    if (isEdit && editCategory) {
      updateMutation.mutate(
        { id: editCategory.id, data: { name: name.trim(), type, icon: null } },
        { onSuccess: () => router.back() },
      )
    } else {
      createMutation.mutate(
        { name: name.trim(), type, icon: null },
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
          placeholder="Category name"
          placeholderTextColor="#94a3b8"
          autoFocus
        />
      </View>

      {/* Type */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-foreground mb-2">Type</Text>
        <View className="flex-row gap-2">
          {(['EXPENSE', 'INCOME', 'BOTH'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className={`flex-1 rounded-lg py-2.5 ${type === t ? 'bg-primary' : 'bg-card border border-border'}`}
            >
              <Text className={`text-center text-sm font-medium ${type === t ? 'text-white' : 'text-foreground'}`}>
                {t === 'EXPENSE' ? 'Expense' : t === 'INCOME' ? 'Income' : 'Both'}
              </Text>
            </Pressable>
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
    </ScrollView>
  )
}
