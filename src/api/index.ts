import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { emitOrphanSession } from './authSession'

// For Android emulator use 10.0.2.2, for real device use your PC's local IP
// e.g. http://192.168.1.X:5000
export const BASE_URL = 'https://fursa-uvx1.onrender.com'

/** Render cold start is often ~1–3 min (varies). 3 min covers most wakes without waiting forever on a real failure. */
export const API_TIMEOUT_MS = 180_000 // 3 minutes

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

// Public auth routes — never send an old Bearer (avoids confusing the server / stale sessions)
function isPublicAuthPath(url: string | undefined) {
  if (!url) return false
  const path = url.split('?')[0]
  return (
    path === '/auth/login' ||
    path === '/auth/signup' ||
    path === '/auth/google' ||
    path === '/auth/forgot-password' ||
    path.startsWith('/auth/reset-password')
  )
}

function getExistingAuthorization(config: { headers?: any }): string | undefined {
  const h = config.headers
  if (!h) return undefined
  if (typeof h.get === 'function') return h.get('Authorization') || h.get('authorization')
  return h.Authorization || h.authorization
}

function getBearerFromConfig(config: any): string {
  if (!config?.headers) return ''
  const h = config.headers
  let raw: unknown
  if (typeof h.toJSON === 'function') {
    try {
      const j = h.toJSON()
      raw = j.Authorization ?? j.authorization
    } catch {
      /* ignore */
    }
  }
  if (raw == null && typeof h.get === 'function') {
    raw = h.get('Authorization') ?? h.get('authorization')
  }
  if (raw == null && typeof h === 'object') {
    raw = (h as any).Authorization ?? (h as any).authorization
  }
  if (typeof raw !== 'string') return ''
  return raw.replace(/^Bearer\s+/i, '').trim()
}

function getErrorMessage(err: any): string {
  const d = err.response?.data
  if (typeof d?.error === 'string') return d.error
  if (typeof d === 'string') return d
  return ''
}

// Attach token to authenticated requests only (don't override explicit Bearer from callers e.g. FCM right after login)
api.interceptors.request.use(async (config) => {
  if (!isPublicAuthPath(config.url)) {
    if (!getExistingAuthorization(config)) {
      const token = await AsyncStorage.getItem('token')
      if (token) config.headers.Authorization = `Bearer ${token}`
    }
  } else {
    delete config.headers.Authorization
  }
  return config
})

/**
 * Only when verifyToken says this exact JWT's user id is missing from MongoDB.
 * Clears ghost tokens (e.g. old DB) so the user can Google sign-in again for a fresh id.
 * Does NOT clear on generic 401 / Invalid token (avoids random logouts).
 */
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status
    const msg = getErrorMessage(err)
    if (status !== 401 || !msg.includes('User not found')) {
      return Promise.reject(err)
    }

    const sent = getBearerFromConfig(err.config)
    const stored = (await AsyncStorage.getItem('token')) || ''
    if (sent && stored && sent !== stored) {
      return Promise.reject(err)
    }
    if (!stored) {
      return Promise.reject(err)
    }

    await AsyncStorage.multiRemove(['user', 'token'])
    emitOrphanSession()
    return Promise.reject(err)
  }
)

export default api

// Auth
export const loginAPI          = (data: object)      => api.post('/auth/login', data)
export const registerAPI       = (data: object)      => api.post('/auth/signup', data)
export const logoutAPI         = ()                  => api.post('/auth/logout')
export const googleSignInAPI   = (data: object)      => api.post('/auth/google', data)
/** @param accessToken optional JWT — pass from login() so the first save works before AsyncStorage is read reliably */
export const saveFcmTokenAPI = (fcmDeviceToken: string, accessToken?: string | null) =>
  api.put(
    '/user/fcm-token',
    { token: fcmDeviceToken },
    accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined
  )

// Projects
export const getProjectsAPI = (params?: object)      => api.get('/project', { params })
export const getProjectAPI  = (id: string)           => api.get(`/project/${id}`)
export const createProjectAPI = (data: object)       => api.post('/project', data)

// Proposals
export const submitProposalAPI = (data: object)      => api.post('/proposal', data)
export const getProposalsAPI   = (projectId: string) => api.get(`/proposal/${projectId}`)
export const acceptProposalAPI = (id: string)        => api.put(`/proposal/accept/${id}`)

// Profile
export const getProfileAPI      = (id: string)       => api.get(`/user/${id}`)
export const updateProfileAPI   = (data: object)     => api.put('/user/update', data)
export const searchUsersAPI       = (query: string)    => api.get('/user/search-chat', { params: { query } })
export const searchFreelancersAPI = (params: object)   => api.get('/user/search', { params })

// Messages
export const getConversationsAPI = ()                => api.get('/message/conversations')
export const getMessagesAPI      = (id: string)      => api.get(`/message/${id}`)
export const sendMessageAPI      = (data: object)    => api.post('/message', data)

// Wallet
export const getWalletAPI        = ()                => api.get('/wallet')
export const getTransactionsAPI  = ()                => api.get('/wallet/transactions')
export const depositAPI          = (amount: number)  => api.post('/wallet/deposit', { amount })
export const withdrawAPI         = (amount: number)  => api.post('/wallet/withdraw', { amount })

/** Wallet top-up via PayTabs (hosted checkout); balance updates after return / callback */
export const createPaytabsPaymentAPI = (amount: number) =>
  api.post('/payments/paytabs/create-payment', { amount })

// My projects (client)
export const getMyProjectsAPI    = ()                => api.get('/project/my')

// My proposals (freelancer)
export const getMyProposalsAPI   = ()                => api.get('/proposal/my')

// Notifications
export const getNotificationsAPI = ()                => api.get('/notification')
export const markReadAPI         = (id?: string)     => api.put(`/notification/read`)  // marks all read
export const markOneReadAPI      = (id: string)      => api.put(`/notification/${id}/read`)

// Milestones
export const getMilestonesAPI    = (projectId: string) => api.get(`/milestone/${projectId}`)
export const requestReviewAPI    = (id: string)        => api.put(`/milestone/review/${id}`)
export const releasePaymentAPI   = (id: string)        => api.put(`/milestone/release/${id}`)
export const createMilestonesAPI = (data: object)      => api.post('/milestone', data)

// Contract
export const getContractAPI           = (projectId: string) => api.get(`/contract/project/${projectId}`)
export const markProjectCompleteAPI   = (projectId: string) => api.post(`/project/${projectId}/complete`)
export const adminReleasePaymentAPI   = (projectId: string) => api.post(`/project/${projectId}/admin-release`)

// Reviews
export const createReviewAPI     = (data: object)    => api.post('/review', data)
export const getReviewsAPI       = (id: string)      => api.get(`/review/${id}`)

// Disputes
export const createDisputeAPI    = (data: object)    => api.post('/dispute', data)
export const getMyDisputesAPI    = ()                 => api.get('/dispute/my')

// AI suggestions
export const aiDescriptionAPI    = (data: object)    => api.post('/ai/description', data)
export const aiPricingAPI        = (data: object)    => api.post('/ai/pricing', data)
export const aiExtractSkillsAPI  = (data: object)    => api.post('/ai/skills', data)
export const aiMatchAPI          = (projectId: string) => api.get(`/ai/match/${projectId}`)
