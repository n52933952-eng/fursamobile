import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { DeviceEventEmitter } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getAuth, signOut as firebaseSignOut } from '@react-native-firebase/auth'
import { GoogleSignin } from '../config/firebase'
import { setupPushNotifications } from '../config/fcm'
import { SESSION_ORPHAN_USER_EVENT } from '../api/authSession'
import { decodeJwtUserId } from '../utils/jwtPayload'

interface User {
  _id: string
  username: string
  email: string
  role: 'client' | 'freelancer' | 'admin'
  profilePic?: string
  bio?: string
  skills?: string[]
  /** Categories you work in / post about — used to filter freelancer project feed. */
  interestedCategories?: string[]
  rating?: number
  totalProjects?: number
  totalEarned?: number
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (userData: User, token: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (data: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]     = useState<User | null>(null)
  const [token, setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restore = async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem('token'),
        ])
        if (
          storedUser &&
          storedToken &&
          typeof storedToken === 'string' &&
          storedToken.length >= 10
        ) {
          let parsed: User & { id?: string }
          try {
            parsed = JSON.parse(storedUser)
          } catch {
            await AsyncStorage.multiRemove(['user', 'token'])
            setLoading(false)
            return
          }
          const rawId = parsed._id ?? parsed.id
          if (!rawId) {
            await AsyncStorage.multiRemove(['user', 'token'])
            setLoading(false)
            return
          }
          const normalized: User = { ...parsed, _id: String(rawId) }
          const jwtUid = decodeJwtUserId(storedToken)
          if (jwtUid && jwtUid !== normalized._id) {
            await AsyncStorage.multiRemove(['user', 'token'])
            setLoading(false)
            return
          }
          setUser(normalized)
          setToken(storedToken)
          // Keep disk copy aligned (e.g. older builds saved `id` only)
          await AsyncStorage.setItem('user', JSON.stringify(normalized))
          // Re-register FCM after cold start — otherwise token is never sent until next login
          setupPushNotifications(storedToken).catch(() => {})
        }
      } catch {
        try {
          await AsyncStorage.multiRemove(['user', 'token'])
        } catch {
          /* ignore */
        }
      }
      setLoading(false)
    }
    restore()
  }, [])

  const login = async (userData: User, tkn: string) => {
    if (!tkn || typeof tkn !== 'string' || tkn.length < 10) {
      throw new Error('Server did not return a valid session token. Try again or use email login.')
    }
    const rawId = userData._id ?? (userData as User & { id?: string }).id
    if (!rawId) {
      throw new Error('Server user profile is missing an id. Check API / MongoDB.')
    }
    const normalized: User = { ...userData, _id: String(rawId) }
    const jwtUid = decodeJwtUserId(tkn)
    if (jwtUid && jwtUid !== normalized._id) {
      throw new Error('Token does not match your profile. Please sign in with Google again.')
    }
    await Promise.all([
      AsyncStorage.setItem('user', JSON.stringify(normalized)),
      AsyncStorage.setItem('token', tkn),
    ])
    setUser(normalized)
    setToken(tkn)
    // Pass JWT explicitly — FCM save runs async after permission; avoids 401 without Bearer
    setupPushNotifications(tkn).catch(() => {})
  }

  const logout = useCallback(async () => {
    try {
      await GoogleSignin.signOut()
    } catch {
      /* not signed in with Google */
    }
    try {
      await firebaseSignOut(getAuth())
    } catch {
      /* ignore */
    }
    await Promise.all([
      AsyncStorage.removeItem('user'),
      AsyncStorage.removeItem('token'),
    ])
    setUser(null)
    setToken(null)
  }, [])

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SESSION_ORPHAN_USER_EVENT, () => {
      logout()
    })
    return () => sub.remove()
  }, [logout])

  const updateUser = (data: Partial<User>) => {
    if (!user) return
    const updated = { ...user, ...data }
    setUser(updated)
    AsyncStorage.setItem('user', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
