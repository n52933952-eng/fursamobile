import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import { getConversationsAPI, searchUsersAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Conversation Card ────────────────────────────────────────────────────────

function ConversationCard({ conv, currentUserId, onPress }: {
  conv: any; currentUserId: string; onPress: () => void
}) {
  const lastMsg  = conv.lastMessage || conv.messages?.[conv.messages.length - 1]
  const other    = conv.participants?.find((p: any) => p._id !== currentUserId) || conv.otherUser
  const initials = (other?.username || '?')[0]?.toUpperCase()

  return (
    <TouchableOpacity style={styles.convCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.convAvatar}>
        <Text style={styles.convAvatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.convRow}>
          <Text style={styles.convName} numberOfLines={1}>{other?.username || 'User'}</Text>
          {lastMsg?.createdAt && (
            <Text style={styles.convTime}>{timeAgo(lastMsg.createdAt)}</Text>
          )}
        </View>
        <Text style={styles.convLastMsg} numberOfLines={1}>
          {lastMsg?.text || 'Start a conversation...'}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── User Search Result Card ──────────────────────────────────────────────────

function UserCard({ user: u, onPress }: { user: any; onPress: () => void }) {
  const initials = (u.username || '?')[0]?.toUpperCase()
  return (
    <TouchableOpacity style={styles.userCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.convAvatar, { backgroundColor: u.role === 'client' ? colors.info : colors.primary }]}>
        <Text style={styles.convAvatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.convName}>{u.username}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.roleBadge, { backgroundColor: u.role === 'client' ? colors.info + '22' : colors.primary + '22' }]}>
            <Text style={[styles.roleText, { color: u.role === 'client' ? colors.info : colors.primary }]}>
              {u.role === 'client' ? '👤 Client' : '💼 Freelancer'}
            </Text>
          </View>
          {u.rating > 0 && (
            <Text style={styles.convTime}>⭐ {u.rating.toFixed(1)}</Text>
          )}
        </View>
      </View>
      <Text style={styles.startChat}>Message →</Text>
    </TouchableOpacity>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { user }   = useAuth()
  const navigation = useNavigation<any>()
  const { socket, markMessagesRead } = useSocket()
  const { tr, isArabic } = useLang()
  const dir = isArabic ? 'right' as const : 'left' as const

  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')

  // User search results (for new conversations)
  const [userResults, setUserResults]   = useState<any[]>([])
  const [searching, setSearching]       = useState(false)
  const searchTimer                     = useRef<any>(null)

  // ── Load conversations ─────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await getConversationsAPI()
      const list = Array.isArray(data) ? data.map((c: any) => ({
        ...c,
        _currentUserId: user?._id,
      })) : []
      setConversations(list)
    } catch {}
    setLoading(false)
  }, [user])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Clear unread badge on focus
  useFocusEffect(useCallback(() => {
    markMessagesRead()
  }, [markMessagesRead]))

  // Real-time: refresh conversation list on new message
  useEffect(() => {
    if (!socket) return
    const handler = () => { fetchConversations() }
    socket.on('newMessage', handler)
    return () => { socket.off('newMessage', handler) }
  }, [socket, fetchConversations])

  // ── Search logic ──────────────────────────────────────────────────────────
  // Debounce user search — only calls backend after 400ms of no typing
  useEffect(() => {
    if (!search.trim()) {
      setUserResults([])
      setSearching(false)
      return
    }

    clearTimeout(searchTimer.current)
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await searchUsersAPI(search.trim())
        setUserResults(Array.isArray(data) ? data : [])
      } catch {
        setUserResults([])
      }
      setSearching(false)
    }, 400)

    return () => clearTimeout(searchTimer.current)
  }, [search])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchConversations()
    setRefreshing(false)
  }

  // Filter existing conversations that match the search
  const filteredConvs = search.trim()
    ? conversations.filter(c => {
        const other = c.participants?.find((p: any) => p._id !== user?._id) || c.otherUser
        return other?.username?.toLowerCase().includes(search.toLowerCase())
      })
    : conversations

  // Exclude users already in conversations from search results (no duplicates)
  const existingUserIds = new Set(
    conversations.map(c => {
      const other = c.participants?.find((p: any) => p._id !== user?._id) || c.otherUser
      return other?._id
    })
  )
  const newUsers = userResults.filter(u => !existingUserIds.has(u._id))

  const openConversation = (conv: any) => {
    const other = conv.participants?.find((p: any) => p._id !== user?._id) || conv.otherUser
    navigation.navigate('MessageScreen', {
      recipientId:   other?._id,
      recipientName: other?.username || 'User',
    })
  }

  const openNewChat = (u: any) => {
    setSearch('')
    navigation.navigate('MessageScreen', {
      recipientId:   u._id,
      recipientName: u.username,
    })
  }

  const isSearching = search.trim().length > 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { textAlign: dir }]}>{tr.messages}</Text>
          {conversations.length > 0 && !isSearching && (
            <Text style={styles.headerSub}>
              {conversations.length} {conversations.length !== 1 ? tr.conversationsPlural : tr.conversations}
            </Text>
          )}
        </View>
      </View>

      {/* Search box */}
      <View style={styles.searchRow}>
        <Text style={{ color: colors.textMuted, marginRight: 8, fontSize: 16 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { textAlign: dir }]}
          placeholder={tr.searchConversations}
          placeholderTextColor={colors.textDim}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* ── Existing conversations ─────────────────────────────────────── */}
          {filteredConvs.length > 0 && (
            <View>
              {isSearching && (
                <Text style={styles.sectionLabel}>Conversations</Text>
              )}
              {filteredConvs.map((conv, i) => (
                <ConversationCard
                  key={conv._id || i}
                  conv={conv}
                  currentUserId={user?._id || ''}
                  onPress={() => openConversation(conv)}
                />
              ))}
            </View>
          )}

          {/* ── New users from backend search ─────────────────────────────── */}
          {isSearching && (
            <View>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>{tr.startNewChat}</Text>
                {searching && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
              </View>

              {newUsers.length > 0 ? (
                newUsers.map(u => (
                  <UserCard key={u._id} user={u} onPress={() => openNewChat(u)} />
                ))
              ) : !searching ? (
                <View style={styles.noResults}>
                  <Text style={[styles.noResultsText, { textAlign: 'center' }]}>
                    {tr.noUsersFound} "{search}"
                  </Text>
                  <Text style={styles.noResultsSub}>{tr.tryDifferentName}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── Empty state (not searching) ───────────────────────────────── */}
          {!isSearching && filteredConvs.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 56, marginBottom: 16 }}>💬</Text>
              <Text style={styles.emptyText}>{tr.noConversations}</Text>
              <Text style={styles.emptySubText}>{tr.noConversationsMsg}</Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },

  header:      { paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.cardDark },
  headerTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  headerSub:   { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },

  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, margin: spacing.md, borderRadius: radius.lg, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: font.base, paddingVertical: 12 },
  clearBtn:    { padding: 6 },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  sectionLabel:{ color: colors.textDim, fontSize: font.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },

  // Existing conversation row
  convCard:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  convAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  convAvatarText: { color: 'white', fontWeight: '800', fontSize: font.lg },
  convRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName:       { color: colors.text, fontWeight: '700', fontSize: font.base, flex: 1 },
  convTime:       { color: colors.textDim, fontSize: font.sm, marginLeft: 8 },
  convLastMsg:    { color: colors.textMuted, fontSize: font.sm },

  // New user card
  userCard:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  roleBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  roleText:    { fontSize: 11, fontWeight: '700' },
  startChat:   { color: colors.primary, fontSize: font.sm, fontWeight: '700' },

  noResults:    { alignItems: 'center', paddingVertical: 24, paddingHorizontal: spacing.lg },
  noResultsText:{ color: colors.text, fontWeight: '600', fontSize: font.base, textAlign: 'center' },
  noResultsSub: { color: colors.textMuted, fontSize: font.sm, marginTop: 4 },

  emptyState:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.lg },
  emptyText:    { color: colors.text, fontSize: font.lg, fontWeight: '700', marginBottom: 8 },
  emptySubText: { color: colors.textMuted, fontSize: font.base, textAlign: 'center', lineHeight: 22 },
})
