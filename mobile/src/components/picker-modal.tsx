import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, Modal } from 'react-native'

interface PickerItem {
  id: string
  label: string
  subtitle?: string
}

interface PickerModalProps {
  visible: boolean
  onClose: () => void
  title: string
  items: PickerItem[]
  selectedId?: string
  onSelect: (id: string) => void
  searchable?: boolean
  allowNone?: boolean
  noneLabel?: string
}

export function PickerModal({
  visible,
  onClose,
  title,
  items,
  selectedId,
  onSelect,
  searchable = true,
  allowNone = false,
  noneLabel = 'None',
}: PickerModalProps) {
  const [search, setSearch] = useState('')

  const filtered = searchable && search
    ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : items

  function handleSelect(id: string) {
    onSelect(id)
    setSearch('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">{title}</Text>
          <Pressable onPress={() => { setSearch(''); onClose() }}>
            <Text className="text-primary font-medium">Done</Text>
          </Pressable>
        </View>

        {searchable && (
          <View className="px-4 py-2">
            <TextInput
              className="border border-border rounded-lg px-3 py-2 text-foreground bg-card"
              placeholder="Search..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            allowNone ? (
              <Pressable
                onPress={() => handleSelect('')}
                className={`px-4 py-3 border-b border-border ${selectedId === '' ? 'bg-accent' : ''}`}
              >
                <Text className="text-foreground">{noneLabel}</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item.id)}
              className={`px-4 py-3 border-b border-border ${selectedId === item.id ? 'bg-accent' : ''}`}
            >
              <Text className="text-foreground">{item.label}</Text>
              {item.subtitle && (
                <Text className="text-sm text-muted-foreground">{item.subtitle}</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="py-8">
              <Text className="text-center text-muted-foreground">No items found</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Modal>
  )
}

interface MultiPickerModalProps {
  visible: boolean
  onClose: () => void
  title: string
  items: PickerItem[]
  selectedIds: string[]
  onToggle: (id: string) => void
  searchable?: boolean
}

export function MultiPickerModal({
  visible,
  onClose,
  title,
  items,
  selectedIds,
  onToggle,
  searchable = true,
}: MultiPickerModalProps) {
  const [search, setSearch] = useState('')

  const filtered = searchable && search
    ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">{title}</Text>
          <Pressable onPress={() => { setSearch(''); onClose() }}>
            <Text className="text-primary font-medium">Done</Text>
          </Pressable>
        </View>

        {searchable && (
          <View className="px-4 py-2">
            <TextInput
              className="border border-border rounded-lg px-3 py-2 text-foreground bg-card"
              placeholder="Search..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id)
            return (
              <Pressable
                onPress={() => onToggle(item.id)}
                className={`px-4 py-3 border-b border-border flex-row items-center ${isSelected ? 'bg-accent' : ''}`}
              >
                <View className={`w-5 h-5 rounded border mr-3 items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                  {isSelected && <Text className="text-white text-xs font-bold">{'✓'}</Text>}
                </View>
                <Text className="text-foreground flex-1">{item.label}</Text>
              </Pressable>
            )
          }}
          ListEmptyComponent={
            <View className="py-8">
              <Text className="text-center text-muted-foreground">No items found</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Modal>
  )
}
