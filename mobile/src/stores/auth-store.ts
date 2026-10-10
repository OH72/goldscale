import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const KEYS = {
  baseUrl: 'goldscale_base_url',
  username: 'goldscale_username',
  password: 'goldscale_password',
}

interface AuthState {
  baseUrl: string
  username: string
  password: string
  isConfigured: boolean
  isLoaded: boolean
  load: () => Promise<void>
  save: (baseUrl: string, username: string, password: string) => Promise<void>
  clear: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  baseUrl: '',
  username: '',
  password: '',
  isConfigured: false,
  isLoaded: false,

  load: async () => {
    const baseUrl = await SecureStore.getItemAsync(KEYS.baseUrl)
    const username = await SecureStore.getItemAsync(KEYS.username)
    const password = await SecureStore.getItemAsync(KEYS.password)
    const isConfigured = !!(baseUrl && username && password)
    set({ baseUrl: baseUrl ?? '', username: username ?? '', password: password ?? '', isConfigured, isLoaded: true })
  },

  save: async (baseUrl: string, username: string, password: string) => {
    await SecureStore.setItemAsync(KEYS.baseUrl, baseUrl)
    await SecureStore.setItemAsync(KEYS.username, username)
    await SecureStore.setItemAsync(KEYS.password, password)
    set({ baseUrl, username, password, isConfigured: true })
  },

  clear: async () => {
    await SecureStore.deleteItemAsync(KEYS.baseUrl)
    await SecureStore.deleteItemAsync(KEYS.username)
    await SecureStore.deleteItemAsync(KEYS.password)
    set({ baseUrl: '', username: '', password: '', isConfigured: false })
  },
}))
