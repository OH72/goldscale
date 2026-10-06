const API_BASE = '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa('admin:admin')}`,
    },
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
  postForm: <T>(path: string, body: FormData): Promise<T> =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa('admin:admin')}`,
      },
      body,
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new ApiError(response.status, error.message ?? 'Request failed')
      }
      return response.json()
    }),
}
