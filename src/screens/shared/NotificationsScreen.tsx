import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, SafeAreaView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import { getNotificationsAPI, markReadAPI, markOneReadAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = 'proposal' | 'payment' | 'project' | 'message' | 'dispute' | 'default'

const typeConfig: Record<NotifType | string, {
  icon: string; color: string; bgColor: string; filterKey: string
}> = {
  proposal: { icon: '🔔', color: '#4299E1', bgColor: '#4299E120', filterKey: 'projects' },
  payment:  { icon: '💵', color: '#48BB78', bgColor: '#48BB7820', filterKey: 'payments' },
  project:  { icon: '💼', color: '#FF6B35', bgColor: '#FF6B3520', filterKey: 'projects' },
  message:  { icon: '💬', color: '#4299E1', bgColor: '#4299E120', filterKey: 'messages' },
  dispute:  { icon: '⚠️', color: '#FC8181', bgColor: '#FC818120', filterKey: 'projects' },
  default:  { icon: '🔔', color: '#8899AA', bgColor: '#8899AA20', filterKey: 'projects' },
}

// ─── Time formatter (bilingual) ───────────────────────────────────────────────

function isMongoObjectId(id: string) {
  return /^[a-fA-F0-9]{24}$/.test(String(id))
}

function timeAgo(iso: string, isArabic: boolean) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hrs   = Math.floor(mins / 60)
  const days  = Math.floor(hrs / 24)

  if (isArabic) {
    if (mins < 1)  return 'الآن'
    if (mins < 60) return `منذ ${mins} دقيقة`
    if (hrs  < 24) return `منذ ${hrs} ساعة`
    if (days === 1) return 'أمس'
    return `منذ ${days} أيام`
  }
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins} min ago`
  if (hrs  < 24) return `${hrs}h ago`
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotifRow({ notif, isArabic, onRead }: {
  notif: any; isArabic: boolean; onRead: (id: string) => void
}) {
  const cfg    = typeConfig[notif.type] || typeConfig.default
  const unread = !notif.read
  const dir    = isArabic ? 'right' as const : 'left' as const

  // Bilingual title: show type label + original title
  const typeLabel: Record<string, string> = {
    proposal: isArabic ? 'عرض جديد' : 'New Proposal',
    payment:  isArabic ? 'تم الدفع'  : 'Payment Released',
    project:  isArabic ? 'مشروع جديد': 'New Project Match',
    message:  isArabic ? 'رسالة جديدة': 'New Message from',
    dispute:  isArabic ? 'نزاع'       : 'Dispute Update',
    default:  isArabic ? 'إشعار'      : 'Notification',
  }
  const label = typeLabel[notif.type] || typeLabel.default
  const time  = timeAgo(notif.createdAt, isArabic)

  // Initial letter for avatar
  const initial = notif.senderId?.username?.[0]?.toUpperCase() || '?'

  return (
    <TouchableOpacity
      style={[styles.row, unread && styles.rowUnread]}
      onPress={() => { if (unread) onRead(notif._id) }}
      activeOpacity={0.75}
    >
      {/* Icon ring with avatar inside */}
      <View style={[styles.iconRing, { backgroundColor: cfg.bgColor, borderColor: cfg.color + '40' }]}>
        <Text style={styles.iconEmoji}>{cfg.icon}</Text>
        <View style={[styles.avatarDot, { backgroundColor: cfg.color }]}>
          <Text style={styles.avatarDotText}>{initial}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.typeLabel, { color: cfg.color }]}>{label}</Text>
              {notif.title && notif.title !== label && (
                <Text style={[styles.titleDetail, { color: unread ? colors.text : colors.textMuted }]} numberOfLines={1}>
                  {' '}{notif.title}
                </Text>
              )}
            </View>
            <Text style={[styles.rowBody, { textAlign: dir }]} numberOfLines={2}>{notif.body}</Text>
          </View>
          {unread && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
        </View>
        <Text style={[styles.rowTime, { textAlign: dir }]}>{time}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',      labelEn: 'All',      labelAr: 'الكل' },
  { key: 'projects', labelEn: 'Projects', labelAr: 'المشاريع' },
  { key: 'payments', labelEn: 'Payments', labelAr: 'الدفع' },
  { key: 'messages', labelEn: 'Messages', labelAr: 'الرسائل' },
]

export default function NotificationsScreen() {
  const navigation = useNavigation<any>()
  const { notifications: liveNotifs, markNotificationsRead, markOneNotificationRead } = useSocket()
  const { isArabic, lang, toggleLang } = useLang()

  const [dbNotifs, setDbNotifs]         = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await getNotificationsAPI()
      setDbNotifs(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  // Merge DB + live socket notifications
  const merged = useMemo(() => {
    const map = new Map<string, any>()
    dbNotifs.forEach(n => map.set(n._id, n))
    liveNotifs.forEach(n => { if (!map.has(n._id)) map.set(n._id, n) })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [dbNotifs, liveNotifs])

  // Filter by active tab
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return merged
    return merged.filter(n => {
      const cfg = typeConfig[n.type] || typeConfig.default
      return cfg.filterKey === activeFilter
    })
  }, [merged, activeFilter])

  const unreadCount = merged.filter(n => !n.read).length

  const handleMarkAllRead = async () => {
    try {
      await markReadAPI()
      markNotificationsRead()
      setDbNotifs(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
  }

  const handleMarkOne = (id: string) => {
    const sid = String(id)
    markOneNotificationRead(sid)
    setDbNotifs(prev => prev.map(n => (String(n._id) === sid ? { ...n, read: true } : n)))
    if (isMongoObjectId(sid)) {
      markOneReadAPI(sid).catch(() => {})
    }
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  const dir = isArabic ? 'right' as const : 'left' as const

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { textAlign: dir }]}>
            {isArabic ? 'الإشعارات' : 'Notifications'}
          </Text>
          {!isArabic && <Text style={styles.headerSub}>الإشعارات</Text>}
          {isArabic  && <Text style={styles.headerSub}>Notifications</Text>}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>
              {isArabic ? 'حدد الكل كمقروء' : 'Mark all read'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter Tabs ────────────────────────────────────────────────── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}
      >
        {FILTERS.map(f => {
          const active = activeFilter === f.key
          const label  = isArabic ? f.labelAr : f.labelEn
          const count  = f.key === 'all' ? merged.filter(n => !n.read).length
            : filtered.filter(n => !n.read && (typeConfig[n.type]?.filterKey === f.key)).length
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && { color: colors.primary }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Notification List ──────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchNotifs() }}
            tintColor={colors.primary}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>
              {isArabic ? 'أنت على اطلاع بكل شيء!' : 'All caught up!'}
            </Text>
            <Text style={styles.emptyText}>
              {isArabic ? 'لا توجد إشعارات بعد.' : 'You have no notifications yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map(n => (
              <NotifRow key={n._id} notif={n} isArabic={isArabic} onRead={handleMarkOne} />
            ))}
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Bottom Language Toggle ─────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={toggleLang}>
          <Text style={styles.bottomLangText}>
            {lang === 'en' ? 'English | ' : ''}
            <Text style={lang === 'ar' ? styles.bottomLangActive : styles.bottomLangMuted}>العربية</Text>
            {lang === 'ar' ? ' | English' : ''}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  backBtn:     { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  backArrow:   { color: colors.text, fontSize: font.lg, lineHeight: 22 },
  headerTitle: { color: colors.text, fontSize: font.xxl, fontWeight: '900' },
  headerSub:   { color: colors.textMuted, fontSize: font.sm },
  markAllText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },

  // Filter tabs
  tabsScroll:  { maxHeight: 52, flexGrow: 0 },
  tabsRow:     { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs, flexDirection: 'row' },
  tab:         { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, gap: 6 },
  tabActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:     { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },
  tabTextActive:{ color: '#fff', fontWeight: '700' },
  tabBadge:    { backgroundColor: colors.border, borderRadius: radius.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeActive:{ backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText:{ color: colors.textMuted, fontSize: 10, fontWeight: '700' },

  // List
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: spacing.xs },

  // Notification row
  row:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs, gap: spacing.sm },
  rowUnread: { borderColor: colors.primary + '35', backgroundColor: colors.primary + '07' },

  iconRing:    { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, position: 'relative' },
  iconEmoji:   { fontSize: 22 },
  avatarDot:   { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.bg },
  avatarDotText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  rowTop:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 3 },
  titleRow:  { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  typeLabel: { fontWeight: '800', fontSize: font.base },
  titleDetail: { fontSize: font.sm, fontWeight: '600', flexShrink: 1 },
  rowBody:   { color: colors.textDim, fontSize: font.sm, lineHeight: 18, marginTop: 2 },
  rowTime:   { color: colors.textDim, fontSize: 11, marginTop: 4 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, marginTop: 6, flexShrink: 0 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon:  { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  emptyText:  { color: colors.textMuted, fontSize: font.base, marginTop: 6 },

  // Bottom bar
  bottomBar:      { paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.cardDark },
  bottomLangText: { color: colors.textMuted, fontSize: font.sm },
  bottomLangActive: { color: colors.text, fontWeight: '700' },
  bottomLangMuted:  { color: colors.textMuted },
})
