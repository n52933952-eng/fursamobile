import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  StatusBar,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import { getMessagesAPI, sendMessageAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

type Message = {
  _id?: string
  senderId: string
  text: string
  createdAt: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ item, isMine, showTime, showAvatar, recipientInitial }: {
  item: Message; isMine: boolean; showTime: boolean; showAvatar: boolean; recipientInitial: string
}) {
  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      {/* Recipient avatar (left side, only for received) */}
      {!isMine && (
        <View style={[styles.msgAvatar, { opacity: showAvatar ? 1 : 0 }]}>
          <Text style={styles.msgAvatarText}>{recipientInitial}</Text>
        </View>
      )}

      <View style={[styles.bubbleCol, isMine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
        </View>
        {showTime && (
          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
        )}
      </View>

      {/* Spacer for sent messages so they don't stretch full width */}
      {isMine && <View style={{ width: 44 }} />}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessageScreen() {
  const { user }     = useAuth()
  const navigation   = useNavigation<any>()
  const route        = useRoute<any>()
  const { recipientId, recipientName, recipientRole } = route.params || {}
  const { socket }   = useSocket()
  const { isArabic, lang, toggleLang } = useLang()

  const [messages, setMessages]     = useState<Message[]>([])
  const [loading, setLoading]       = useState(true)
  const [text, setText]             = useState('')
  const [sending, setSending]       = useState(false)
  const flatListRef                 = useRef<FlatList>(null)
  const inputRef                    = useRef<TextInput>(null)

  // ── Load history ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!recipientId) { setLoading(false); return }
    try {
      const { data } = await getMessagesAPI(recipientId)
      setMessages(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }, [recipientId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  // ── Real-time incoming ────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const handler = (msg: Message) => {
      if (msg.senderId === recipientId) {
        setMessages(prev => [...prev, msg])
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80)
      }
    }
    socket.on('newMessage', handler)
    return () => { socket.off('newMessage', handler) }
  }, [socket, recipientId])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150)
    }
  }, [messages.length])

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const msgText = text.trim()
    if (!msgText || !recipientId || sending) return

    setText('')
    setSending(true)

    const optimistic: Message = {
      senderId:  user?._id || '',
      text:      msgText,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80)

    try {
      const { data } = await sendMessageAPI({ recipientId, text: msgText })
      socket?.emit('sendMessage', {
        recipientId,
        senderId: user?._id,
        text:     msgText,
        createdAt: optimistic.createdAt,
      })
      setMessages(prev => [...prev.slice(0, -1), data])
    } catch {
      // revert optimistic
      setMessages(prev => prev.slice(0, -1))
    }
    setSending(false)
  }

  const recipientInitial = (recipientName || '?')[0]?.toUpperCase()
  const placeholder = isArabic ? 'اكتب رسالة...' : 'Type a message...'
  const textDir = isArabic ? 'right' as const : 'left' as const

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === user?._id
    const nextMsg = messages[index + 1]
    const showTime    = !nextMsg || nextMsg.senderId !== item.senderId ||
      new Date(nextMsg.createdAt).getTime() - new Date(item.createdAt).getTime() > 5 * 60 * 1000
    const showAvatar  = !nextMsg || nextMsg.senderId !== item.senderId
    return (
      <MessageBubble
        item={item}
        isMine={isMine}
        showTime={showTime}
        showAvatar={showAvatar}
        recipientInitial={recipientInitial}
      />
    )
  }

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{recipientInitial}</Text>
          </View>

          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.headerName} numberOfLines={1}>{recipientName || 'Chat'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerStatus}>
                {recipientRole ? `${recipientRole} · ` : ''}Online
              </Text>
            </View>
          </View>

          {/* Right icons */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={{ fontSize: 18 }}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={{ fontSize: 18 }}>⋮</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Messages ────────────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item, i) => item._id || `msg_${i}`}
            contentContainerStyle={styles.msgList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <View style={styles.emptyChatBubble}>
                  <Text style={{ fontSize: 40 }}>👋</Text>
                </View>
                <Text style={styles.emptyChatTitle}>
                  {isArabic ? `ابدأ محادثة مع ${recipientName}` : `Start a conversation with ${recipientName}`}
                </Text>
                <Text style={styles.emptyChatSub}>
                  {isArabic ? 'رسائلك آمنة ومشفرة' : 'Your messages are private & secure'}
                </Text>
              </View>
            }
          />
        )}

        {/* ── Input Bar ───────────────────────────────────────────────────── */}
        <View style={styles.inputBar}>
          {/* AR/EN mini toggle */}
          <TouchableOpacity style={styles.langMini} onPress={toggleLang}>
            <Text style={styles.langMiniText}>{lang.toUpperCase()}</Text>
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { textAlign: textDir }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textDim}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            returnKeyType="default"
            blurOnSubmit={false}
          />

          {/* Emoji */}
          <TouchableOpacity style={styles.iconActionBtn}>
            <Text style={{ fontSize: 20 }}>😊</Text>
          </TouchableOpacity>

          {/* Attachment */}
          <TouchableOpacity style={styles.iconActionBtn}>
            <Text style={{ fontSize: 20 }}>📎</Text>
          </TouchableOpacity>

          {/* Send */}
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={styles.sendIcon}>▶</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.cardDark, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0 },
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 44 : 12, paddingBottom: 14, paddingHorizontal: spacing.md, backgroundColor: colors.cardDark, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  backArrow:       { color: colors.text, fontSize: font.xl, fontWeight: '300', lineHeight: 24 },
  headerAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary + '60' },
  headerAvatarText:{ color: 'white', fontWeight: '800', fontSize: font.base },
  headerName:      { color: colors.text, fontWeight: '700', fontSize: font.base },
  onlineDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  headerStatus:    { color: colors.textMuted, fontSize: 11 },
  iconBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msgList:    { paddingHorizontal: spacing.sm, paddingVertical: spacing.md, paddingBottom: 12 },

  // Message rows
  row:      { flexDirection: 'row', marginBottom: 3, paddingHorizontal: 4 },
  rowMine:  { flexDirection: 'row-reverse' },
  rowOther: {},

  msgAvatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8, alignSelf: 'flex-end', marginBottom: 4 },
  msgAvatarText: { color: 'white', fontWeight: '800', fontSize: 12 },

  bubbleCol: { maxWidth: '72%' },
  bubble:    { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine:  { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText:     { color: colors.text, fontSize: font.base, lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  timeText: { color: colors.textDim, fontSize: 10, marginTop: 3, marginHorizontal: 4, marginBottom: 4 },

  // Empty
  emptyChat:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: spacing.lg },
  emptyChatBubble: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  emptyChatTitle:  { color: colors.text, fontSize: font.base, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyChatSub:    { color: colors.textMuted, fontSize: font.sm, textAlign: 'center' },

  // Input bar
  inputBar:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: spacing.sm, paddingVertical: 10, backgroundColor: colors.cardDark, borderTopWidth: 1, borderTopColor: colors.border },
  langMini:       { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-end', marginBottom: 2 },
  langMiniText:   { color: colors.primary, fontSize: 10, fontWeight: '800' },
  textInput:      { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, color: colors.text, fontSize: font.base, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, maxHeight: 120, minHeight: 42 },
  iconActionBtn:  { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  sendBtn:        { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  sendBtnDisabled:{ opacity: 0.4 },
  sendIcon:       { color: 'white', fontSize: 16, marginLeft: 2 },
})
