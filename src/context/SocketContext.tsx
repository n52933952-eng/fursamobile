import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
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

type SocketContextType = {
  socket: Socket | null
  notifications: AppNotification[]
  unreadNotifications: number
  unreadMessages: number
  markNotificationsRead: () => void
  markMessagesRead: () => void
  addNotification: (n: AppNotification) => void
}

const SocketContext = createContext<SocketContextType>({
  socket:              null,
  notifications:       [],
  unreadNotifications: 0,
  unreadMessages:      0,
  markNotificationsRead: () => {},
  markMessagesRead:      () => {},
  addNotification:       () => {},
})

export const useSocket = () => useContext(SocketContext)

// ─── Provider ────────────────────────────────────────────────────────────────

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [socket, setSocket]             = useState<Socket | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)

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
      return
    }

    const sock = io(BASE_URL, {
      query: { userId: user._id, role: user.role },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    })

    setSocket(sock)

    sock.on('connect', () => {
      console.log('[Socket] Connected:', sock.id)
    })

    // ── Notification from any backend controller ──────────────────────────
    sock.on('newNotification', (notification: AppNotification) => {
      setNotifications(prev => {
        // avoid duplicate if DB fetch already loaded it
        if (prev.some(n => n._id === notification._id)) return prev
        return [{ ...notification, read: false }, ...prev]
      })
    })

    // ── New chat message — increment unread badge ─────────────────────────
    sock.on('newMessage', () => {
      setUnreadMessages(prev => prev + 1)
    })

    // ── Client: someone bid on their project ──────────────────────────────
    sock.on('proposalReceived', (data: any) => {
      setNotifications(prev => [{
        _id: `pr_${Date.now()}`,
        type: 'proposal',
        title: '📋 New Bid Received',
        body: `A freelancer submitted a bid on your project`,
        read: false,
        createdAt: new Date().toISOString(),
        ...data,
      }, ...prev])
    })

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

    return () => { sock.disconnect() }
  }, [user?._id])

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    // persist to DB in background
    import('../api').then(({ markReadAPI }) => markReadAPI().catch(() => {}))
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
      markNotificationsRead,
      markMessagesRead,
      addNotification,
    }}>
      {children}
    </SocketContext.Provider>
  )
}
