import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { getMyProposalsAPI } from '../../api'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { colors, spacing, radius, font, screenHeaderPaddingTop } from '../../theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeAgoAr(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'اليوم'
  if (days === 1) return 'أمس'
  if (days < 7)  return `منذ ${days} أيام`
  return new Date(iso).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { key: 'active',    labelEn: 'Active',    labelAr: 'نشطة',    icon: '⏳', color: colors.warning },
  { key: 'accepted',  labelEn: 'Won',       labelAr: 'مقبولة',  icon: '🏆', color: colors.success },
  { key: 'completed', labelEn: 'Completed', labelAr: 'منجزة',   icon: '✅', color: colors.info   },
  { key: 'rejected',  labelEn: 'Rejected',  labelAr: 'مرفوضة', icon: '❌', color: colors.error   },
]

// ─── Bid Card ─────────────────────────────────────────────────────────────────

function BidCard({
  proposal, onPressContract, onPressProject, isArabic,
}: {
  proposal: any
  onPressContract: () => void
  onPressProject: () => void
  isArabic: boolean
}) {
  const dir        = isArabic ? 'right' as const : 'left' as const
  const project    = proposal.projectId || {}
  const status     = proposal.status    // pending / accepted / rejected
  const projStatus = project.status     // open / in-progress / completed / pending-approval
  const isAccepted = status === 'accepted'
  const isRejected = status === 'rejected'
  const isCompleted= projStatus === 'completed'
  const isPending  = projStatus === 'pending-approval'

  const clientInitial = (project.clientId?.username || '?')[0].toUpperCase()
  const avatarColors  = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899']
  const avatarColor   = avatarColors[(project.clientId?.username || 'A').charCodeAt(0) % avatarColors.length]

  return (
    <View style={[styles.card, isAccepted && styles.cardAccepted, isRejected && styles.cardRejected]}>

      {/* ── Top: client + time ── */}
      <View style={[styles.cardTop, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
        <View style={[styles.clientAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.clientAvatarText}>{clientInitial}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: isArabic ? 0 : 10, marginRight: isArabic ? 10 : 0 }}>
          <Text style={[styles.clientName, { textAlign: dir }]} numberOfLines={1}>
            {project.clientId?.username || (isArabic ? 'عميل' : 'Client')}
          </Text>
          <Text style={[styles.timeAgo, { textAlign: dir }]}>
            {isArabic ? timeAgoAr(proposal.createdAt) : timeAgo(proposal.createdAt)}
          </Text>
        </View>
        {/* Status badge */}
        <View style={[
          styles.statusBadge,
          { backgroundColor: isAccepted ? colors.success + '22' : isRejected ? colors.error + '22' : colors.warning + '22',
            borderColor:      isAccepted ? colors.success + '55' : isRejected ? colors.error + '55' : colors.warning + '55' },
        ]}>
          <Text style={[styles.statusText, {
            color: isAccepted ? colors.success : isRejected ? colors.error : colors.warning,
          }]}>
            {isAccepted ? (isArabic ? '🏆 مقبول' : '🏆 Won')
             : isRejected ? (isArabic ? '❌ مرفوض' : '❌ Rejected')
             : (isArabic ? '⏳ في الانتظار' : '⏳ Pending')}
          </Text>
        </View>
      </View>

      {/* ── Project title + category ── */}
      <Text style={[styles.projectTitle, { textAlign: dir }]} numberOfLines={2}>
        {project.title || (isArabic ? 'مشروع' : 'Project')}
      </Text>
      {project.category && (
        <View style={[styles.catChip, { alignSelf: isArabic ? 'flex-end' : 'flex-start' }]}>
          <Text style={styles.catText}>{project.category}</Text>
        </View>
      )}

      {/* ── Cover letter preview ── */}
      {proposal.coverLetter && (
        <Text style={[styles.coverLetter, { textAlign: dir }]} numberOfLines={2}>
          "{proposal.coverLetter}"
        </Text>
      )}

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{isArabic ? 'عرضي' : 'My Bid'}</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>${proposal.bid?.toLocaleString()}</Text>
        </View>
        <View style={[styles.statDivider]} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{isArabic ? 'المدة' : 'Delivery'}</Text>
          <Text style={styles.statValue}>{proposal.deliveryTime} {isArabic ? 'يوم' : 'days'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{isArabic ? 'ميزانية' : 'Budget'}</Text>
          <Text style={styles.statValue}>${project.budget?.toLocaleString() ?? '—'}</Text>
        </View>
      </View>

      {/* ── Project status progress strip ── */}
      {isAccepted && (
        <View style={styles.progressStrip}>
          {['Hired', 'In Progress', isPending ? 'Review' : 'In Progress', 'Completed'].map((step, i) => {
            const steps    = ['open', 'in-progress', 'pending-approval', 'completed']
            const stepIdx  = steps.indexOf(projStatus)
            const done     = i <= stepIdx
            const labels   = isArabic
              ? ['تم التعيين', 'جاري العمل', 'مراجعة', 'منجز']
              : ['Hired', 'Working', 'Review', 'Done']
            return (
              <View key={i} style={styles.progressStep}>
                <View style={[styles.progressDot, done && styles.progressDotDone]} />
                <Text style={[styles.progressLabel, done && { color: colors.success }]}>{labels[i]}</Text>
                {i < 3 && <View style={[styles.progressLine, done && i < stepIdx && styles.progressLineDone]} />}
              </View>
            )
          })}
        </View>
      )}

      {/* ── Action Buttons ── */}
      <View style={[styles.actions, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
        {isAccepted && !isCompleted && (
          <TouchableOpacity style={[styles.actionBtn, styles.contractBtn]} onPress={onPressContract}>
            <Text style={styles.contractBtnText}>
              {isArabic ? '📄 عرض العقد' : '📄 View Contract'}
            </Text>
          </TouchableOpacity>
        )}
        {isCompleted && (
          <TouchableOpacity style={[styles.actionBtn, styles.completedBtn]} onPress={onPressContract}>
            <Text style={styles.completedBtnText}>
              {isArabic ? '✅ مكتمل — عرض العقد' : '✅ Completed — View Contract'}
            </Text>
          </TouchableOpacity>
        )}
        {!isAccepted && !isRejected && (
          <TouchableOpacity style={[styles.actionBtn, styles.viewBtn]} onPress={onPressProject}>
            <Text style={styles.viewBtnText}>
              {isArabic ? '🔎 عرض المشروع' : '🔎 View Project'}
            </Text>
          </TouchableOpacity>
        )}
        {isRejected && (
          <TouchableOpacity style={[styles.actionBtn, styles.viewBtn]} onPress={onPressProject}>
            <Text style={styles.viewBtnText}>
              {isArabic ? '🔎 عرض المشروع' : '🔎 View Project'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab, isArabic }: { tab: string; isArabic: boolean }) {
  const configs: Record<string, { icon: string; en: string; ar: string; subEn: string; subAr: string }> = {
    active:    { icon: '⏳', en: 'No active bids',    ar: 'لا توجد عروض نشطة',    subEn: 'Browse projects and submit your first proposal', subAr: 'تصفح المشاريع وقدم أول عرض لك' },
    accepted:  { icon: '🏆', en: 'No won bids yet',   ar: 'لم تفز بأي عرض بعد',   subEn: 'Keep bidding — your next win is coming!',         subAr: 'استمر في تقديم العروض — فوزك القادم قريب!' },
    completed: { icon: '✅', en: 'No completed work',  ar: 'لا توجد أعمال منجزة',  subEn: 'Completed projects will appear here',             subAr: 'ستظهر المشاريع المنجزة هنا' },
    rejected:  { icon: '💪', en: 'No rejections',     ar: 'لا توجد رفضيات',       subEn: 'Great! All your bids are still active',           subAr: 'ممتاز! كل عروضك لا تزال نشطة' },
  }
  const c = configs[tab] || configs.active
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 56, marginBottom: 14 }}>{c.icon}</Text>
      <Text style={styles.emptyTitle}>{isArabic ? c.ar : c.en}</Text>
      <Text style={styles.emptySub}>{isArabic ? c.subAr : c.subEn}</Text>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MyBidsScreen() {
  const insets       = useSafeAreaInsets()
  const { socket }   = useSocket()
  const { isArabic, lang, toggleLang } = useLang()
  const navigation   = useNavigation<any>()
  const dir          = isArabic ? 'right' as const : 'left' as const
  const { user }     = useAuth()

  const [proposals, setProposals]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab]   = useState('active')

  // Toast
  const [toast, setToast]    = useState<string | null>(null)
  const toastOpacity         = useRef(new Animated.Value(0)).current

  const showToast = (msg: string) => {
    setToast(msg)
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setToast(null))
  }

  const fetchProposals = useCallback(async () => {
    try {
      if (!user?._id) return
      const { data } = await getMyProposalsAPI()
      setProposals(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [user?._id])

  useEffect(() => {
    // Reset to avoid showing stale data from a previous user session
    if (!user?._id) {
      setLoading(true)
      setProposals([])
      return
    }
    setLoading(true)
    setProposals([])
    fetchProposals()
  }, [fetchProposals, user?._id])

  useEffect(() => {
    if (!socket) return
    const handler = (data: any) => {
      showToast(`🎉 ${isArabic ? 'تم قبول عرضك!' : 'Your bid was accepted!'} — ${data.projectTitle || ''}`)
      setProposals(prev =>
        prev.map(p => p._id === data.proposalId ? { ...p, status: 'accepted' } : p)
      )
      setActiveTab('accepted')
    }
    socket.on('proposalAccepted', handler)
    return () => { socket.off('proposalAccepted', handler) }
  }, [socket, isArabic])

  const onRefresh = () => { setRefreshing(true); fetchProposals() }

  // Tab counts
  const counts = {
    active:    proposals.filter(p => p.status === 'pending').length,
    accepted:  proposals.filter(p => p.status === 'accepted' && p.projectId?.status !== 'completed').length,
    completed: proposals.filter(p => p.projectId?.status === 'completed').length,
    rejected:  proposals.filter(p => p.status === 'rejected').length,
  }

  // Filtered list for current tab
  const filtered = proposals.filter(p => {
    if (activeTab === 'active')    return p.status === 'pending'
    if (activeTab === 'accepted')  return p.status === 'accepted' && p.projectId?.status !== 'completed'
    if (activeTab === 'completed') return p.projectId?.status === 'completed'
    if (activeTab === 'rejected')  return p.status === 'rejected'
    return true
  })

  const goContract = (p: any) => {
    const projectId = p.projectId?._id || p.projectId
    if (projectId) navigation.navigate('ContractScreen', { projectId })
  }

  const goProject = (p: any) => {
    const projectId = p.projectId?._id || p.projectId
    if (projectId) navigation.navigate('ProjectDetailScreen', { projectId })
  }

  return (
    <View style={styles.container}>

      {/* Toast */}
      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: screenHeaderPaddingTop(insets.top), paddingBottom: spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { textAlign: dir }]}>
            {isArabic ? '📋 عروضي' : '📋 My Bids'}
          </Text>
          <Text style={[styles.headerSub, { textAlign: dir }]}>
            {proposals.length} {isArabic ? 'عرض مقدم' : 'proposals submitted'}
          </Text>
        </View>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          const count    = counts[tab.key as keyof typeof counts]
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && { borderBottomColor: tab.color, borderBottomWidth: 2.5 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, isActive && { color: tab.color, fontWeight: '800' }]}>
                {isArabic ? tab.labelAr : tab.labelEn}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: tab.color }]}>
                  <Text style={styles.tabBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        >
          {filtered.length === 0 ? (
            <EmptyState tab={activeTab} isArabic={isArabic} />
          ) : (
            filtered.map((p, i) => (
              <BidCard
                key={p._id || i}
                proposal={p}
                isArabic={isArabic}
                onPressContract={() => goContract(p)}
                onPressProject={() => goProject(p)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.cardDark, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  headerSub:   { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  langBtn:     { backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },

  // Tab bar
  tabBar:     { flexDirection: 'row', backgroundColor: colors.cardDark, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:        { flex: 1, alignItems: 'center', paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 4, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabLabel:   { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },
  tabBadge:   { minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Card
  card:         { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardAccepted: { borderColor: colors.success + '55', backgroundColor: colors.success + '06' },
  cardRejected: { borderColor: colors.error + '33', opacity: 0.8 },

  cardTop:       { alignItems: 'center', marginBottom: 10, gap: 0 },
  clientAvatar:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { color: '#fff', fontWeight: '800', fontSize: font.base },
  clientName:    { color: colors.text, fontWeight: '700', fontSize: font.base },
  timeAgo:       { color: colors.textDim, fontSize: 11, marginTop: 1 },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  statusText:    { fontSize: 11, fontWeight: '800' },

  projectTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: 6, lineHeight: 24 },
  catChip:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.info + '18', borderWidth: 1, borderColor: colors.info + '40', marginBottom: 8 },
  catText:      { color: colors.info, fontSize: 11, fontWeight: '600' },
  coverLetter:  { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, fontStyle: 'italic', marginBottom: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: colors.border },

  statsRow:    { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.lg, padding: 10, marginBottom: 12 },
  statBox:     { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel:   { color: colors.textDim, fontSize: 11, marginBottom: 2 },
  statValue:   { color: colors.text, fontWeight: '800', fontSize: font.base },

  // Progress strip
  progressStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, marginBottom: 12 },
  progressStep:  { flex: 1, alignItems: 'center', position: 'relative', flexDirection: 'column' },
  progressDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginBottom: 4 },
  progressDotDone: { backgroundColor: colors.success },
  progressLine:  { position: 'absolute', top: 5, left: '50%', right: '-50%', height: 2, backgroundColor: colors.border, zIndex: -1 },
  progressLineDone: { backgroundColor: colors.success },
  progressLabel: { color: colors.textDim, fontSize: 9, textAlign: 'center' },

  // Action buttons
  actions:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn:   { flex: 1, paddingVertical: 11, borderRadius: radius.md, alignItems: 'center' },
  contractBtn: { backgroundColor: colors.primary },
  contractBtnText: { color: '#fff', fontWeight: '800', fontSize: font.sm },
  completedBtn:{ backgroundColor: colors.success },
  completedBtnText: { color: '#fff', fontWeight: '800', fontSize: font.sm },
  viewBtn:     { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  viewBtnText: { color: colors.text, fontWeight: '700', fontSize: font.sm },

  // Empty state
  empty:      { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  emptySub:   { color: colors.textMuted, fontSize: font.base, textAlign: 'center', lineHeight: 22 },

  // Toast
  toast:     { position: 'absolute', top: 100, alignSelf: 'center', zIndex: 999, backgroundColor: colors.success, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  toastText: { color: '#fff', fontWeight: '700', fontSize: font.sm },
})
