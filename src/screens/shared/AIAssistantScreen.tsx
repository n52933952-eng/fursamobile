import React, { useCallback, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLang } from '../../context/LanguageContext'
import { aiChatAPI, type AiChatMessage } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

//
type Row = AiChatMessage & { id: string }

let idSeq = 0
function nextId() {
  idSeq += 1
  return `m-${idSeq}`
}

export default function AIAssistantScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { tr, isArabic } = useLang()
  const dir = isArabic ? 'right' : 'left'

  /** Conversation only (welcome is UI-only so the AI API always starts with a user message). */
  const [rows, setRows] = useState<Row[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<FlatList<Row>>(null)

  const toApiMessages = useCallback((list: Row[]): AiChatMessage[] => {
    return list.map(({ role, content }) => ({ role, content }))
  }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userRow: Row = { id: nextId(), role: 'user', content: text }
    const nextRows = [...rows, userRow]
    setInput('')
    setRows(nextRows)
    setLoading(true)

    const payload = toApiMessages(nextRows)

    try {
      const { data } = await aiChatAPI(payload)
      const reply = typeof data?.reply === 'string' ? data.reply : ''
      if (!reply) throw new Error('empty')
      setRows((prev) => [...prev, { id: nextId(), role: 'assistant', content: reply }])
    } catch (e: any) {
      const msg = e?.response?.data?.error || tr.aiError
      Alert.alert(isArabic ? 'تنبيه' : 'Notice', String(msg))
      setRows((prev) => prev.filter((r) => r.id !== userRow.id))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  const renderItem = ({ item }: { item: Row }) => {
    const isUser = item.role === 'user'
    return (
      <View
        style={[
          styles.bubbleWrap,
          isUser ? styles.bubbleWrapUser : styles.bubbleWrapAi,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAi,
          ]}
        >
          <Text style={[styles.bubbleText, { textAlign: dir }, isUser && styles.bubbleTextUser]}>
            {item.content}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>{isArabic ? '→' : '←'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { textAlign: dir }]}>{tr.aiAssistant}</Text>
          <Text style={[styles.headerSub, { textAlign: dir }]} numberOfLines={2}>
            {tr.aiAssistantSub}
          </Text>
        </View>
        <Text style={styles.headerEmoji}>✨</Text>
      </View>

      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.welcomeBubble}>
            <Text style={[styles.bubbleText, { textAlign: dir }]}>{tr.aiWelcome}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {loading && (
        <View style={styles.thinkingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.thinkingText}>{tr.aiThinking}</Text>
        </View>
      )}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={[styles.input, { textAlign: dir }]}
          placeholder={tr.aiPlaceholder}
          placeholderTextColor={colors.textDim}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={4000}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>{tr.aiSend}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.cardDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  headerTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800' },
  headerSub: { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  headerEmoji: { fontSize: 26 },

  listContent: { padding: spacing.md, paddingBottom: spacing.lg },

  bubbleWrap: { marginBottom: 10, maxWidth: '100%' },
  bubbleWrapUser: { alignSelf: 'flex-end' },
  bubbleWrapAi: { alignSelf: 'flex-start' },

  bubble: {
    maxWidth: '92%',
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bubbleAi: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  bubbleText: { color: colors.text, fontSize: font.base, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },

  welcomeBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },

  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
  },
  thinkingText: { color: colors.textMuted, fontSize: font.sm },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    backgroundColor: colors.cardDark,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: font.base,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: font.sm },
})
