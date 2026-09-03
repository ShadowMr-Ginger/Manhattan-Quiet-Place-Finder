import {
  apiRequest,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './api'

const USER_KEY = 'hushhub_user'

function clearStoredUser() {
  localStorage.removeItem(USER_KEY)
}

export function getSession() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function validateSession() {
  if (!getAccessToken()) {
    clearStoredUser()
    return null
  }

  try {
    const user = await apiRequest('/auth/me')
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    return user
  } catch {
    clearAccessToken()
    clearStoredUser()
    return null
  }
}

export async function login(email, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setAccessToken(data.accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return data.user
}

export async function signup(name, email, password) {
  // Returns { message } — user must verify email before logging in
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

export function logout() {
  clearAccessToken()
  clearStoredUser()
  apiRequest('/auth/logout', { method: 'POST' }).catch(() => {})
}

export async function forgotPassword(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token, newPassword) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  })
}

export async function verifyEmail(token) {
  return apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`)
}

export async function resendVerification(email) {
  return apiRequest('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}
