import { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/stores/auth-store'

export default function LoginScreen() {
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const save = useAuthStore((s) => s.save)

  async function handleConnect() {
    if (!baseUrl.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Error', 'All fields are required')
      return
    }

    setLoading(true)
    try {
      const cleanUrl = baseUrl.trim().replace(/\/+$/, '')
      const encoded = btoa(`${username.trim()}:${password}`)
      const response = await fetch(`${cleanUrl}/api/settings`, {
        headers: {
          Authorization: `Basic ${encoded}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          Alert.alert('Error', 'Invalid credentials')
        } else {
          Alert.alert('Error', `Connection failed (${response.status})`)
        }
        return
      }

      await save(cleanUrl, username.trim(), password)
      router.replace('/(tabs)')
    } catch (e) {
      Alert.alert('Error', 'Could not connect to server. Check the URL and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-foreground text-center mb-2">GoldScale</Text>
        <Text className="text-muted-foreground text-center mb-8">Connect to your server</Text>

        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">Server URL</Text>
          <TextInput
            className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
            placeholder="http://192.168.1.100:8080"
            placeholderTextColor="#94a3b8"
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-1">Username</Text>
          <TextInput
            className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
            placeholder="admin"
            placeholderTextColor="#94a3b8"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-foreground mb-1">Password</Text>
          <TextInput
            className="border border-border rounded-lg px-3 py-2.5 text-foreground bg-card"
            placeholder="password"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <Pressable
          onPress={handleConnect}
          disabled={loading}
          className={`rounded-lg py-3 items-center ${loading ? 'bg-primary/50' : 'bg-primary'}`}
        >
          <Text className="text-primary-foreground font-semibold text-base">
            {loading ? 'Connecting...' : 'Save & Connect'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
