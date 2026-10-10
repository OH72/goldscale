import { useState, useMemo } from 'react'
import { View, Text, FlatList, Pressable, Alert, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useTags, useDeleteTag } from '@/api/use-tags'

export default function TagsScreen() {
  const { data: tags, isLoading, refetch } = useTags()
  const deleteMutation = useDeleteTag()
  const [refreshing, setRefreshing] = useState(false)

  const sorted = useMemo(
    () => [...(tags ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  )

  function handleDelete(tag: { id: string; name: string }) {
    Alert.alert('Delete Tag', `Delete "${tag.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(tag.id) },
    ])
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-2 pb-24"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item: tag }) => (
          <View className="bg-card border border-border rounded-lg px-3 py-3 mb-1 flex-row items-center justify-between">
            <View className="bg-muted rounded px-2.5 py-1">
              <Text className="text-sm text-foreground font-medium">{tag.name}</Text>
            </View>
            <Pressable onPress={() => handleDelete(tag)}>
              <Text className="text-muted-foreground text-lg">{'...'}</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View className="py-12">
            <Text className="text-center text-muted-foreground">{isLoading ? 'Loading...' : 'No tags yet'}</Text>
          </View>
        }
      />

      <Pressable
        onPress={() => router.push('/tag-form')}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>
    </View>
  )
}
