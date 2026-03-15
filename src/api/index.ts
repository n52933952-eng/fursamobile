import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

// For Android emulator use 10.0.2.2, for real device use your PC's local IP
// e.g. http://192.168.1.X:5000
export const BASE_URL = 'https://fursa-uvx1.onrender.com'

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api

// Auth
export const loginAPI       = (data: object)         => api.post('/auth/login', data)
export const registerAPI    = (data: object)         => api.post('/auth/signup', data)
export const logoutAPI      = ()                     => api.post('/auth/logout')

// Projects
export const getProjectsAPI = (params?: object)      => api.get('/project', { params })
export const getProjectAPI  = (id: string)           => api.get(`/project/${id}`)
export const createProjectAPI = (data: object)       => api.post('/project', data)

// Proposals
export const submitProposalAPI = (data: object)      => api.post('/proposal', data)
export const getProposalsAPI   = (projectId: string) => api.get(`/proposal/${projectId}`)
export const acceptProposalAPI = (id: string)        => api.put(`/proposal/${id}/accept`)

// Profile
export const getProfileAPI    = (id: string)         => api.get(`/user/${id}`)
export const updateProfileAPI = (data: object)       => api.put('/user/update', data)

// Messages
export const getConversationsAPI = ()                => api.get('/message/conversations')
export const getMessagesAPI      = (id: string)      => api.get(`/message/${id}`)
export const sendMessageAPI      = (data: object)    => api.post('/message/send', data)

// Wallet
export const getWalletAPI        = ()                => api.get('/wallet')
export const getTransactionsAPI  = ()                => api.get('/wallet/transactions')

// Notifications
export const getNotificationsAPI = ()                => api.get('/notification')
export const markReadAPI         = (id: string)      => api.put(`/notification/${id}/read`)

// Reviews
export const createReviewAPI     = (data: object)    => api.post('/review', data)
export const getReviewsAPI       = (id: string)      => api.get(`/review/${id}`)

// Disputes
export const createDisputeAPI    = (data: object)    => api.post('/dispute', data)
