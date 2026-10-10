import { View, ActivityIndicator, Text, RefreshControl, ScrollView } from 'react-native'
import type { ReactNode } from 'react'

interface ScreenWrapperProps {
  children: ReactNode
  isLoading?: boolean
  error?: Error | null
  onRefresh?: () => void
  isRefreshing?: boolean
  scrollable?: boolean
}

export function ScreenWrapper({
  children,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
  scrollable = true,
}: ScreenWrapperProps) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <Text className="text-destructive text-center">{error.message}</Text>
      </View>
    )
  }

  if (scrollable) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4 pb-8"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing ?? false} onRefresh={onRefresh} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    )
  }

  return (
    <View className="flex-1 bg-background">
      {children}
    </View>
  )
}
