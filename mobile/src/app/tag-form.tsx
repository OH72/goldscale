import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useCreateTag } from '@/api/use-tags'

export default function TagFormScreen() {
  const createMutation = useCreateTag()
  const [name, setName] = useState('')

  function handleSubmit() {
    if (!name.trim()) return

    createMutation.mutate(
      { name: name.trim() },
      { onSuccess: () => router.back() },
    )
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
      {/* Name */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-foreground mb-1">Name</Text>
        <TextInput
          className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
          value={name}
          onChangeText={setName}
          placeholder="Tag name"
          placeholderTextColor="#94a3b8"
          autoFocus
        />
      </View>

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={createMutation.isPending || !name.trim()}
        className={`rounded-lg py-3 ${createMutation.isPending || !name.trim() ? 'bg-muted' : 'bg-primary'}`}
      >
        <Text className={`text-center font-medium ${createMutation.isPending || !name.trim() ? 'text-muted-foreground' : 'text-white'}`}>
          {createMutation.isPending ? 'Creating...' : 'Create'}
        </Text>
      </Pressable>
    </ScrollView>
  )
}
