import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import { getConversationsAPI, searchUsersAPI, getSupportAdminAPI } from '../../api'
import { colors, spacing, radius, font, screenHeaderPaddingTop } from '../../theme'

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

function ConversationCard({ conv, currentUserId, onPress, isArabic, dir }: {
  conv: any; currentUserId: string; onPress: () => void
  isArabic: boolean
  dir: 'left' | 'right'
}) {
  const lastMsg  = conv.lastMessage || conv.messages?.[conv.messages.length - 1]
  const other    = conv.participants?.find((p: any) => p._id !== currentUserId) || conv.otherUser
  const initials = (other?.username || '?')[0]?.toUpperCase()
  const rowDir = isArabic ? 'row-reverse' as const : 'row' as const

  return (
    <TouchableOpacity
      style={[styles.convCard, { flexDirection: rowDir }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.convAvatar}>
        <Text style={styles.convAvatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={[styles.convRow, { flexDirection: rowDir }]}>
          <Text style={[styles.convName, { textAlign: dir }]} numberOfLines={1}>{other?.username || 'User'}</Text>
          {lastMsg?.createdAt && (
            <Text style={styles.convTime}>{timeAgo(lastMsg.createdAt)}</Text>
          )}
        </View>
        <Text style={[styles.convLastMsg, { textAlign: dir }]} numberOfLines={1}>
          {lastMsg?.text || (isArabic ? 'ابدأ المحادثة...' : 'Start a conversation...')}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── User Search Result Card ──────────────────────────────────────────────────

function UserCard({ user: u, onPress, isArabic, dir, tapLabel }: { user: any; onPress: () => void; isArabic: boolean; dir: 'left' | 'right'; tapLabel: string }) {
  const initials = (u.username || '?')[0]?.toUpperCase()
  const rowDir = isArabic ? 'row-reverse' as const : 'row' as const
  const roleLabel = u.role === 'client'
    ? (isArabic ? '👤 عميل' : '👤 Client')
    : (isArabic ? '💼 مستقل' : '💼 Freelancer')
  return (
    <TouchableOpacity style={[styles.userCard, { flexDirection: rowDir }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.convAvatar, { backgroundColor: u.role === 'client' ? colors.info : colors.primary }]}>
        <Text style={styles.convAvatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.convName, { textAlign: dir }]}>{u.username}</Text>
        <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <View style={[styles.roleBadge, { backgroundColor: u.role === 'client' ? colors.info + '22' : colors.primary + '22' }]}>
            <Text style={[styles.roleText, { color: u.role === 'client' ? colors.info : colors.primary }]}>
              {roleLabel}
            </Text>
          </View>
          {u.rating > 0 && (
            <Text style={styles.convTime}>⭐ {u.rating.toFixed(1)}</Text>
          )}
        </View>
      </View>
      <Text style={[styles.startChat, { textAlign: dir }]}>{tapLabel}</Text>
    </TouchableOpacity>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
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
    const onNew = () => { fetchConversations() }
    const onDeleted = () => { fetchConversations() }
    socket.on('newMessage', onNew)
    socket.on('messageDeleted', onDeleted)
    return () => {
      socket.off('newMessage', onNew)
      socket.off('messageDeleted', onDeleted)
    }
  }, [socket, fetchConversations])

  const openSupportChat = async () => {
    try {
      const { data } = await getSupportAdminAPI()
      const admin = data as { _id: string; username?: string; role?: string }
      if (!admin?._id) {
        Alert.alert(isArabic ? 'تنبيه' : 'Notice', tr.supportUnavailable)
        return
      }
      navigation.navigate('MessageScreen', {
        recipientId:   admin._id,
        recipientName: admin.username || 'Support',
        recipientRole: admin.role || 'admin',
      })
    } catch {
      Alert.alert(isArabic ? 'خطأ' : 'Error', tr.supportUnavailable)
    }
  }

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
      <View style={[styles.header, { paddingTop: screenHeaderPaddingTop(insets.top), paddingBottom: spacing.sm }]}>
        <View>
          <Text style={[styles.headerTitle, { textAlign: dir }]}>{tr.messages}</Text>
          {conversations.length > 0 && !isSearching && (
            <Text style={[styles.headerSub, { textAlign: dir }]}>
              {conversations.length} {conversations.length !== 1 ? tr.conversationsPlural : tr.conversations}
            </Text>
          )}
        </View>
      </View>

      {user?.role !== 'admin' && (
        <TouchableOpacity
          style={[styles.supportBanner, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}
          onPress={openSupportChat}
          activeOpacity={0.75}
        >
          <Text style={styles.supportBannerIcon}>💬</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.supportBannerTitle, { textAlign: dir }]}>{tr.contactSupport}</Text>
            <Text style={[styles.supportBannerSub, { textAlign: dir }]}>{tr.contactSupportSub}</Text>
          </View>
          <Text style={styles.supportBannerChev}>{isArabic ? '←' : '→'}</Text>
        </TouchableOpacity>
      )}

      {/* Search box */}
      <View style={[styles.searchRow, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
        <Text style={{ color: colors.textMuted, fontSize: 16, marginHorizontal: 4 }}>🔍</Text>
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
                <Text style={[styles.sectionLabel, { textAlign: dir }, isArabic && styles.sectionLabelAr]}>
                  {tr.existingConversations}
                </Text>
              )}
              {filteredConvs.map((conv, i) => (
                <ConversationCard
                  key={conv._id || i}
                  conv={conv}
                  currentUserId={user?._id || ''}
                  onPress={() => openConversation(conv)}
                  isArabic={isArabic}
                  dir={dir}
                />
              ))}
            </View>
          )}

          {/* ── New users from backend search ─────────────────────────────── */}
          {isSearching && (
            <View>
              <View style={[styles.sectionRow, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.sectionLabel, { textAlign: dir, flex: 1 }, isArabic && styles.sectionLabelAr]}>
                  {tr.startNewChat}
                </Text>
                {searching && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={isArabic ? { marginRight: 8 } : { marginLeft: 8 }}
                  />
                )}
              </View>

              {newUsers.length > 0 ? (
                newUsers.map(u => (
                  <UserCard
                    key={u._id}
                    user={u}
                    onPress={() => openNewChat(u)}
                    isArabic={isArabic}
                    dir={dir}
                    tapLabel={tr.tapToMessage}
                  />
                ))
              ) : !searching ? (
                <View style={styles.noResults}>
                  <Text style={[styles.noResultsText, { textAlign: dir }]}>
                    {tr.noUsersFound} "{search}"
                  </Text>
                  <Text style={[styles.noResultsSub, { textAlign: dir }]}>{tr.tryDifferentName}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── Empty state (not searching) ───────────────────────────────── */}
          {!isSearching && filteredConvs.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 56, marginBottom: 16 }}>💬</Text>
              <Text style={[styles.emptyText, { textAlign: dir }]}>{tr.noConversations}</Text>
              <Text style={[styles.emptySubText, { textAlign: dir }]}>{tr.noConversationsMsg}</Text>
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

  header:      { paddingHorizontal: spacing.md, backgroundColor: colors.cardDark },
  headerTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  headerSub:   { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },

  supportBanner:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary + '55' },
  supportBannerIcon:{ fontSize: 22 },
  supportBannerTitle:{ color: colors.text, fontWeight: '800', fontSize: font.sm },
  supportBannerSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  supportBannerChev:{ color: colors.primary, fontSize: font.lg, fontWeight: '700' },

  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, margin: spacing.md, borderRadius: radius.lg, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: font.base, paddingVertical: 12 },
  clearBtn:    { padding: 6 },

  sectionRow:  { alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  sectionLabel:{ color: colors.textDim, fontSize: font.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionLabelAr:{ textTransform: 'none', letterSpacing: 0 },

  // Existing conversation row
  convCard:       { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  convAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  convAvatarText: { color: 'white', fontWeight: '800', fontSize: font.lg },
  convRow:        { justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 },
  convName:       { color: colors.text, fontWeight: '700', fontSize: font.base, flex: 1 },
  convTime:       { color: colors.textDim, fontSize: font.sm, flexShrink: 0 },
  convLastMsg:    { color: colors.textMuted, fontSize: font.sm },

  // New user card
  userCard:    { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  roleBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  roleText:    { fontSize: 11, fontWeight: '700' },
  startChat:   { color: colors.primary, fontSize: font.sm, fontWeight: '700', flexShrink: 0, maxWidth: 88 },

  noResults:    { alignItems: 'center', paddingVertical: 24, paddingHorizontal: spacing.lg },
  noResultsText:{ color: colors.text, fontWeight: '600', fontSize: font.base, textAlign: 'center' },
  noResultsSub: { color: colors.textMuted, fontSize: font.sm, marginTop: 4 },

  emptyState:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.lg },
  emptyText:    { color: colors.text, fontSize: font.lg, fontWeight: '700', marginBottom: 8 },
  emptySubText: { color: colors.textMuted, fontSize: font.base, textAlign: 'center', lineHeight: 22 },
})
