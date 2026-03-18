import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { setupPushNotifications } from '../config/fcm'

interface User {
  _id: string
  username: string
  email: string
  role: 'client' | 'freelancer' | 'admin'
  profilePic?: string
  bio?: string
  skills?: string[]
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
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser))
          setToken(storedToken)
        }
      } catch {}
      setLoading(false)
    }
    restore()
  }, [])

  const login = async (userData: User, tkn: string) => {
    await Promise.all([
      AsyncStorage.setItem('user', JSON.stringify(userData)),
      AsyncStorage.setItem('token', tkn),
    ])
    setUser(userData)
    setToken(tkn)
    // Register FCM token so the server can send push notifications to this device
    setupPushNotifications().catch(() => {})
  }

  const logout = async () => {
    await Promise.all([
      AsyncStorage.removeItem('user'),
      AsyncStorage.removeItem('token'),
    ])
    setUser(null)
    setToken(null)
  }

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
