import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useCreatePerson, useUpdatePerson } from '@/api/use-people'
import type { PersonResponse } from '@/types/debt'

export default function PersonFormScreen() {
  const params = useLocalSearchParams<{ id?: string; editData?: string }>()
  const editPerson: PersonResponse | null = params.editData
    ? JSON.parse(params.editData)
    : null
  const isEdit = !!editPerson

  const createMutation = useCreatePerson()
  const updateMutation = useUpdatePerson()

  const [name, setName] = useState('')

  useEffect(() => {
    if (editPerson) {
      setName(editPerson.name)
    }
  }, [editPerson])

  function handleSubmit() {
    if (!name.trim()) return

    if (isEdit && editPerson) {
      updateMutation.mutate(
        { id: editPerson.id, data: { name: name.trim() } },
        { onSuccess: () => router.back() },
      )
    } else {
      createMutation.mutate(
        { name: name.trim() },
        { onSuccess: () => router.back() },
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
      {/* Name */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-foreground mb-1">Name</Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
          value={name}
          onChangeText={setName}
          placeholder="Person name"
          placeholderTextColor="#94a3b8"
          autoFocus
        />
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
