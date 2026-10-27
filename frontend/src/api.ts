const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const TOKEN_KEY = 'recoverlens.auth.token'

type ApiErrorBody = {
  detail?: string | Array<{ msg?: string; loc?: unknown[] }>
  message?: string
}

export type BackendRole = 'patient' | 'clinician'

export type AuthenticatedUser = {
  id: number
  email: string
  role: BackendRole
  patient_id?: number | null
  display_name?: string | null
  is_active?: boolean
}

type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

async function readError(response: Response): Promise<string> {
  let body: ApiErrorBody | null = null
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    // Non-JSON responses are handled by the status fallback below.
  }
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item) => item.msg || 'Invalid request').join('; ')
  }
  if (typeof body?.detail === 'string') return body.detail
  if (body?.message) return body.message
  return `Request failed (${response.status} ${response.statusText})`
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const activeToken = token === undefined ? getAuthToken() : token
  if (activeToken) headers.set('Authorization', `Bearer ${activeToken}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new Error(`Cannot reach the RecoverLens API at ${API_BASE_URL}. Start the FastAPI server and check VITE_API_BASE_URL.`)
  }

  if (!response.ok) throw new Error(await readError(response))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY)
}

export function saveAuthToken(token: string, rememberMe: boolean): void {
  window.localStorage.removeItem(TOKEN_KEY)
  window.sessionStorage.removeItem(TOKEN_KEY)
  const store = rememberMe ? window.localStorage : window.sessionStorage
  store.setItem(TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
  window.sessionStorage.removeItem(TOKEN_KEY)
}

export async function getCurrentUser(token = getAuthToken()): Promise<AuthenticatedUser> {
  if (!token) throw new Error('Your session has expired. Please sign in again.')
  return apiRequest<AuthenticatedUser>('/auth/me', { method: 'GET' }, token)
}

export async function signIn(email: string, password: string): Promise<{ token: string; user: AuthenticatedUser }> {
  const response = await apiRequest<TokenResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    null,
  )
  const user = await getCurrentUser(response.access_token)
  if (user.role === 'patient' && !user.patient_id) {
    throw new Error('This patient account is not linked to a patient record. Ask the administrator to link it.')
  }
  return { token: response.access_token, user }
}

export async function signUpPatient(
  displayName: string,
  email: string,
  password: string,
): Promise<{ token: string; user: AuthenticatedUser }> {
  const response = await apiRequest<TokenResponse>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName.trim(), email: email.trim().toLowerCase(), password }),
    },
    null,
  )
  const user = await getCurrentUser(response.access_token)
  if (user.role !== 'patient' || !user.patient_id) {
    throw new Error('Registration succeeded but the returned account is not linked to a patient record. Contact support before continuing.')
  }
  return { token: response.access_token, user }
}

export function roleForLoginUI(role: BackendRole): 'patient' | 'physiotherapist' {
  return role === 'clinician' ? 'physiotherapist' : 'patient'
}

export function nameFromEmail(email: string): string {
  const localPart = email.split('@')[0] || 'Patient'
  return localPart
    .replace(/[._+-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}
