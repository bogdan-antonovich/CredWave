import { config } from '@/config/env'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Import lazily to avoid circular dependency at module init time
  const { useAuthStore } = await import('@/stores/auth.store')
  const auth = useAuthStore()
  return auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  if (res.ok) return res.json() as Promise<T>
  const text = await res.text().catch(() => res.statusText)
  throw new ApiError(res.status, text)
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  }

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    const { useAuthStore } = await import('@/stores/auth.store')
    const auth = useAuthStore()
    const refreshed = await auth.refresh()

    if (refreshed) {
      const retryHeaders = await getAuthHeaders()
      const retry = await fetch(`${config.apiUrl}${path}`, {
        method,
        headers: {
          ...retryHeaders,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      return handleResponse<T>(retry)
    }

    auth.logout()
    return Promise.reject(new ApiError(401, 'Session expired'))
  }

  return handleResponse<T>(res)
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
