import { useAuthStore } from '@/stores/auth-store'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

function getAuthHeaders(): Record<string, string> {
  const { username, password } = useAuthStore.getState()
  const encoded = btoa(`${username}:${password}`)
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${encoded}`,
  }
}

function getBaseUrl(): string {
  const { baseUrl } = useAuthStore.getState()
  // Remove trailing slash
  return baseUrl.replace(/\/+$/, '')
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}/api${path}`
  const response = await fetch(url, {
    headers: getAuthHeaders(),
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ApiError(response.status, error.message ?? 'Request failed')
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  deleteWithBody: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'DELETE', body: JSON.stringify(body) }),
  getRaw: async (path: string): Promise<Response> => {
    const url = `${getBaseUrl()}/api${path}`
    const { username, password } = useAuthStore.getState()
    const encoded = btoa(`${username}:${password}`)
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${encoded}` },
    })
    if (!response.ok) {
      throw new ApiError(response.status, 'Request failed')
    }
    return response
  },
  postForm: async <T>(path: string, body: FormData): Promise<T> => {
    const url = `${getBaseUrl()}/api${path}`
    const { username, password } = useAuthStore.getState()
    const encoded = btoa(`${username}:${password}`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${encoded}` },
      body,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new ApiError(response.status, error.message ?? 'Request failed')
    }
    return response.json()
  },
}
