import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/auth-store'

export default function Index() {
  const isConfigured = useAuthStore((s) => s.isConfigured)

  if (!isConfigured) {
    return <Redirect href="/login" />
  }

  return <Redirect href="/(tabs)" />
}
