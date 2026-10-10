import { View, Text, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'

const MENU_ITEMS = [
  { title: 'Accounts', subtitle: 'Manage bank accounts', route: '/(tabs)/more/accounts' as const },
  { title: 'Categories', subtitle: 'Income & expense categories', route: '/(tabs)/more/categories' as const },
  { title: 'Tags', subtitle: 'Transaction labels', route: '/(tabs)/more/tags' as const },
  { title: 'People', subtitle: 'Debt & loan contacts', route: '/(tabs)/more/people' as const },
  { title: 'Settings', subtitle: 'Currency, backup & restore', route: '/(tabs)/more/settings' as const },
]

export default function MoreScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      {MENU_ITEMS.map((item) => (
        <Pressable
          key={item.title}
          onPress={() => router.push(item.route)}
          className="bg-card border border-border rounded-lg px-4 py-4 mb-2 flex-row items-center justify-between"
        >
          <View>
            <Text className="text-base font-medium text-foreground">{item.title}</Text>
            <Text className="text-sm text-muted-foreground">{item.subtitle}</Text>
          </View>
          <Text className="text-muted-foreground">{'>'}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}
