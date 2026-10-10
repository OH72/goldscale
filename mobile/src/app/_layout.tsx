import '../../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function RootLayout() {
  const load = useAuthStore((s) => s.load)
  const isLoaded = useAuthStore((s) => s.isLoaded)

  useEffect(() => {
    load()
  }, [load])

  if (!isLoaded) return null

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction-form"
          options={{ presentation: 'modal', headerShown: true, title: 'Transaction' }}
        />
        <Stack.Screen
          name="account-form"
          options={{ presentation: 'modal', headerShown: true, title: 'Account' }}
        />
        <Stack.Screen
          name="category-form"
          options={{ presentation: 'modal', headerShown: true, title: 'Category' }}
        />
        <Stack.Screen
          name="debt-record-form"
          options={{ presentation: 'modal', headerShown: true, title: 'Debt Record' }}
        />
        <Stack.Screen
          name="payment-form"
          options={{ presentation: 'modal', headerShown: true, title: 'Payment' }}
        />
        <Stack.Screen
          name="person-form"
          options={{ presentation: 'modal', headerShown: true, title: 'Person' }}
        />
        <Stack.Screen
          name="tag-form"
          options={{ presentation: 'modal', headerShown: true, title: 'Tag' }}
        />
      </Stack>
    </QueryClientProvider>
  )
}
