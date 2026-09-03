const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
const TOKEN_KEY = 'hushhub_access_token'
const LANGUAGE_KEY = 'hushhub_language'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function apiRequest(path, options = {}) {
  const token = getAccessToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const language = localStorage.getItem(LANGUAGE_KEY)
  if (language) {
    headers['Accept-Language'] = language
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      const detail = body.detail ?? body.message
      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail)) {
        message = detail.map((item) => item.msg ?? JSON.stringify(item)).join(', ')
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return null

  const text = await response.text()
  if (!text) return null
  return JSON.parse(text)
}
