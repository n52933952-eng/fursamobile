import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import io, { Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { BASE_URL, getNotificationsAPI } from '../api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppNotification = {
  _id: string
  type: 'proposal' | 'payment' | 'project' | 'message' | 'dispute' | string
  title: string
  body: string
  read: boolean
  createdAt: string
}

/** Same shape as server `getOnlineUsers` payload */
export type OnlineUserEntry = { userId: string; onlineAt: number }

type SocketContextType = {
  socket: Socket | null
  notifications: AppNotification[]
  unreadNotifications: number
  unreadMessages: number
  /** User ids currently connected to the socket server (web + mobile) */
  onlineUsers: OnlineUserEntry[]
  markNotificationsRead: () => void
  markOneNotificationRead: (id: string) => void
  markMessagesRead: () => void
  addNotification: (n: AppNotification) => void
}

const SocketContext = createContext<SocketContextType>({
  socket:              null,
  notifications:       [],
  unreadNotifications: 0,
  unreadMessages:      0,
  onlineUsers:         [],
  markNotificationsRead: () => {},
  markOneNotificationRead: () => {},
  markMessagesRead:      () => {},
  addNotification:       () => {},
})

export const useSocket = () => useContext(SocketContext)

// ─── Provider ────────────────────────────────────────────────────────────────

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [socket, setSocket]             = useState<Socket | null>(null)
  const socketRef                       = useRef<Socket | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserEntry[]>([])

  const unreadNotifications = notifications.filter(n => !n.read).length

  // ── Fetch existing notifications from DB on login ─────────────────────────
  useEffect(() => {
    if (!user?._id) {
      setNotifications([])
      setUnreadMessages(0)
      return
    }
    getNotificationsAPI()
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setNotifications(data.map((n: AppNotification) => ({ ...n })))
        }
      })
      .catch(() => {})
  }, [user?._id])

  useEffect(() => {
    if (!user?._id) {
      // User logged out — disconnect
      setSocket(prev => { prev?.disconnect(); return null })
      socketRef.current = null
      setOnlineUsers([])
      return
    }

    const sock = io(BASE_URL, {
      query: { userId: user._id, role: user.role },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    })

    socketRef.current = sock
    setSocket(sock)

    sock.on('connect', () => {
      console.log('[Socket] Connected:', sock.id)
    })

    sock.on('getOnlineUsers', (users: unknown) => {
      if (!Array.isArray(users)) return
      const next: OnlineUserEntry[] = users.map((u: any) => ({
        userId: String(u?.userId ?? ''),
        onlineAt: typeof u?.onlineAt === 'number' ? u.onlineAt : 0,
      })).filter(e => e.userId.length > 0)
      setOnlineUsers(next)
    })

    // ── Notification from any backend controller ──────────────────────────
    sock.on('newNotification', (notification: AppNotification) => {
      setNotifications(prev => {
        const nid = notification._id != null ? String(notification._id) : ''
        if (nid && prev.some(n => String(n._id) === nid)) return prev
        return [{ ...notification, read: false }, ...prev]
      })
    })

    // ── New chat message — increment unread badge ─────────────────────────
    sock.on('newMessage', () => {
      setUnreadMessages(prev => prev + 1)
    })

    // ── Client: bid received — real row comes from `newNotification` (REST). This is only a refetch signal for screens that listen on socket.
    // Refetch signals for Home / detail screens (notification row is `newNotification` above)
    sock.on('proposalReceived', () => {})

    // ── Freelancer: their bid was accepted ────────────────────────────────
    sock.on('proposalAccepted', (data: any) => {
      setNotifications(prev => [{
        _id: `pa_${Date.now()}`,
        type: 'proposal',
        title: '🎉 Bid Accepted!',
        body: `Your bid was accepted for: ${data.projectTitle || 'a project'}`,
        read: false,
        createdAt: new Date().toISOString(),
        ...data,
      }, ...prev])
    })

    // ── Freelancer: payment released from milestone ───────────────────────
    sock.on('paymentReleased', (data: any) => {
      setNotifications(prev => [{
        _id: `pay_${Date.now()}`,
        type: 'payment',
        title: '💰 Payment Received!',
        body: `$${data.amount} released for: ${data.milestoneTitle || 'a milestone'}`,
        read: false,
        createdAt: new Date().toISOString(),
        ...data,
      }, ...prev])
    })

    // ── Milestone submitted for review (client) ───────────────────────────
    sock.on('milestoneReviewRequested', (data: any) => {
      setNotifications(prev => [{
        _id: `mr_${Date.now()}`,
        type: 'project',
        title: '🔍 Milestone Ready for Review',
        body: data.body || 'Freelancer submitted work for review',
        read: false,
        createdAt: new Date().toISOString(),
      }, ...prev])
    })

    sock.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    return () => {
      sock.off('getOnlineUsers')
      socketRef.current = null
      sock.disconnect()
    }
  }, [user?._id])

  /**
   * While in background, many devices keep the WebSocket open, so the server still
   * lists the user as online. Disconnect explicitly so admin "Online" matches reality.
   * Reconnect when the app returns to the foreground.
   */
  useEffect(() => {
    if (!user?._id) return

    const onAppState = (next: AppStateStatus) => {
      const s = socketRef.current
      if (!s) return
      if (next === 'active') {
        if (!s.connected) s.connect()
      } else if (next === 'background') {
        s.disconnect()
      }
    }

    const sub = AppState.addEventListener('change', onAppState)
    return () => sub.remove()
  }, [user?._id])

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    // persist to DB in background
    import('../api').then(({ markReadAPI }) => markReadAPI().catch(() => {}))
  }

  const markOneNotificationRead = (id: string) => {
    const sid = String(id)
    setNotifications(prev =>
      prev.map(n => (String(n._id) === sid ? { ...n, read: true } : n)),
    )
  }

  const markMessagesRead = () => setUnreadMessages(0)

  const addNotification = (n: AppNotification) =>
    setNotifications(prev => [n, ...prev])

  return (
    <SocketContext.Provider value={{
      socket,
      notifications,
      unreadNotifications,
      unreadMessages,
      onlineUsers,
      markNotificationsRead,
      markOneNotificationRead,
      markMessagesRead,
      addNotification,
    }}>
      {children}
    </SocketContext.Provider>
  )
}
