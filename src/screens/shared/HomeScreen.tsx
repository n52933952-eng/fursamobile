import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
  TextInput, RefreshControl, Modal, Alert, ActivityIndicator, Animated,
  Keyboard,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import {
  getMyProjectsAPI, getProjectsAPI, submitProposalAPI, getMyProposalsAPI,
} from '../../api'
import { colors, spacing, radius, font } from '../../theme'
import { PROJECT_CATEGORIES } from '../../constants/projectCategories'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  open:             colors.info,
  'in-progress':    colors.warning,
  completed:        colors.success,
  cancelled:        colors.error,
  disputed:         colors.error,
}

function daysLeft(deadline: string, isArabic: boolean) {
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (isArabic) return d > 0 ? `${d} يوم` : 'انتهى'
  return d > 0 ? `${d}d left` : 'Due'
}

function greeting(isArabic: boolean) {
  const h = new Date().getHours()
  if (isArabic) {
    if (h < 12) return 'صباح الخير'
    if (h < 17) return 'مساء الخير'
    return 'مساء النور'
  }
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── AR/EN Language Toggle ────────────────────────────────────────────────────

function LangToggle() {
  const { lang, toggleLang, isArabic } = useLang()
  return (
    <View style={styles.langToggle}>
      <Text style={[styles.langLabel, !isArabic && styles.langLabelActive]}>EN</Text>
      <Switch
        value={isArabic}
        onValueChange={toggleLang}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={isArabic ? colors.primary : colors.textMuted}
        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
      />
      <Text style={[styles.langLabel, isArabic && styles.langLabelActive]}>AR</Text>
    </View>
  )
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = ['All', ...PROJECT_CATEGORIES] as string[]

// ─── Freelancer Project Card (compact, for Recommended) ──────────────────────

function RecommendedCard({ project, onBid, onPress, isArabic, matchScore }: {
  project: any; onBid: (p: any) => void; onPress: () => void
  isArabic: boolean; matchScore: number
}) {
  const dir = isArabic ? 'right' as const : 'left' as const
  return (
    <TouchableOpacity style={styles.recCard} onPress={onPress} activeOpacity={0.85}>
      {/* Match badge */}
      {matchScore > 0 && (
        <View style={styles.matchBadge}>
          <Text style={styles.matchBadgeText}>
            {matchScore}% {isArabic ? 'تطابق' : 'match'}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        {/* Category icon */}
        <View style={styles.recCatIcon}>
          <Text style={{ fontSize: 20 }}>{categoryIcon(project.category)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.recTitle, { textAlign: dir }]} numberOfLines={2}>
            {project.title}
          </Text>
          <View style={styles.recMeta}>
            <View style={[styles.catPill, { alignSelf: isArabic ? 'flex-end' : 'flex-start' }]}>
              <Text style={styles.catPillText}>{project.category}</Text>
            </View>
            <Text style={styles.recBudget}>💰 ${project.budget}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.recDesc, { textAlign: dir }]} numberOfLines={2}>
        {project.description}
      </Text>

      {/* Skills needed */}
      {project.skills?.length > 0 && (
        <View style={[styles.skillsRow, { justifyContent: isArabic ? 'flex-end' : 'flex-start' }]}>
          {project.skills.slice(0, 3).map((s: string) => (
            <View key={s} style={styles.skillChip}>
              <Text style={styles.skillText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.recFooter}>
        <View style={styles.recStats}>
          <Text style={styles.recStat}>👥 {project.proposals?.length ?? 0}</Text>
          <Text style={styles.recStat}>⏰ {daysLeft(project.deadline, isArabic)}</Text>
          {project.clientId?.username && (
            <Text style={styles.recStat}>
              👤 {project.clientId.username}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.bidBtn}
          onPress={(e) => { e.stopPropagation?.(); onBid(project) }}
        >
          <Text style={styles.bidBtnText}>
            💼 {isArabic ? 'قدم عرضاً' : 'Place Bid'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

// ─── Freelancer Browse card (horizontal compact) ──────────────────────────────

function BrowseCard({ project, onBid, onPress, isArabic }: {
  project: any; onBid: (p: any) => void; onPress: () => void; isArabic: boolean
}) {
  const dir = isArabic ? 'right' as const : 'left' as const
  return (
    <TouchableOpacity style={styles.browseCard} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.browseCatIcon}>
          <Text style={{ fontSize: 18 }}>{categoryIcon(project.category)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.browseTitle, { textAlign: dir }]} numberOfLines={1}>
            {project.title}
          </Text>
          <View style={styles.browseMeta}>
            <Text style={styles.browseBudget}>💰 ${project.budget}</Text>
            <Text style={styles.browseStat}>· {project.proposals?.length ?? 0} {isArabic ? 'عروض' : 'bids'}</Text>
            <Text style={styles.browseStat}>· {daysLeft(project.deadline, isArabic)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bidBtnSm}
          onPress={(e) => { e.stopPropagation?.(); onBid(project) }}
        >
          <Text style={styles.bidBtnSmText}>{isArabic ? 'قدّم' : 'Bid'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

function categoryIcon(cat: string) {
  const icons: Record<string, string> = {
    Design: '🎨', Development: '💻', Writing: '✍️', Marketing: '📣',
    Video: '🎬', Translation: '🌐', Data: '📊', Other: '📌',
  }
  return icons[cat] || '💼'
}

// ─── Client Project card ──────────────────────────────────────────────────────

function ClientProjectCard({ project, onPress, isArabic, tr }: {
  project: any; onPress: () => void; isArabic: boolean; tr: any
}) {
  const sc  = statusColor[project.status] || colors.info
  const dir = isArabic ? 'right' as const : 'left' as const
  return (
    <TouchableOpacity style={styles.clientCard} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <Text style={[styles.clientCardTitle, { textAlign: dir, flex: 1, marginRight: 8 }]} numberOfLines={1}>
          {project.title}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: sc + '22', borderColor: sc + '55' }]}>
          <Text style={[styles.statusPillText, { color: sc }]}>{project.status}</Text>
        </View>
      </View>
      <Text style={[styles.clientCardDesc, { textAlign: dir }]} numberOfLines={2}>{project.description}</Text>
      <View style={styles.clientCardMeta}>
        <Text style={styles.metaText}>💰 ${project.budget}</Text>
        <Text style={styles.metaText}>📋 {project.proposals?.length ?? 0} {tr.bids}</Text>
        <Text style={styles.metaText}>⏰ {daysLeft(project.deadline, isArabic)}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── Bid Modal ────────────────────────────────────────────────────────────────

function BidModal({ project, visible, onClose, onSubmit, isArabic, tr }: {
  project: any; visible: boolean; onClose: () => void
  onSubmit: (data: any) => Promise<void>; isArabic: boolean; tr: any
}) {
  const [coverLetter, setCoverLetter] = useState('')
  const [bid, setBid]                 = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [loading, setLoading]           = useState(false)
  const dir = isArabic ? 'right' as const : 'left' as const

  const handleSubmit = async () => {
    if (!coverLetter.trim() || !bid || !deliveryTime) {
      Alert.alert(
        isArabic ? 'بيانات ناقصة' : 'Missing Info',
        isArabic ? 'يرجى ملء جميع الحقول.' : 'Please fill all fields.'
      )
      return
    }
    setLoading(true)
    await onSubmit({ coverLetter, bid: parseFloat(bid), deliveryTime: parseInt(deliveryTime, 10) })
    setLoading(false)
    setCoverLetter(''); setBid(''); setDeliveryTime('')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={[styles.modalTitle, { textAlign: dir }]}>
            💼 {isArabic ? 'قدم عرضك' : 'Submit Your Bid'}
          </Text>
          {project && (
            <Text style={[styles.modalSubtitle, { textAlign: dir }]} numberOfLines={2}>
              {project.title}
            </Text>
          )}

          <Text style={[styles.inputLabel, { textAlign: dir }]}>{tr.coverLetter}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={isArabic ? 'اشرح لماذا أنت الأنسب...' : "Why are you the best fit?"}
            placeholderTextColor={colors.textDim}
            value={coverLetter} onChangeText={setCoverLetter}
            multiline textAlign={dir}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { textAlign: dir }]}>{tr.bidAmount}</Text>
              <TextInput style={styles.input}
                placeholder="$250" placeholderTextColor={colors.textDim}
                value={bid} onChangeText={setBid} keyboardType="numeric" textAlign={dir} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { textAlign: dir }]}>{tr.deliveryTime}</Text>
              <TextInput style={styles.input}
                placeholder={isArabic ? '7 أيام' : '7 days'} placeholderTextColor={colors.textDim}
                value={deliveryTime} onChangeText={setDeliveryTime} keyboardType="numeric" textAlign={dir} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: colors.cardDark }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: colors.textMuted }]}>{tr.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 2 }]} onPress={handleSubmit} disabled={loading}>
              {loading
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.btnText}>{isArabic ? 'إرسال العرض' : 'Submit Bid'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { user }    = useAuth()
  const { socket, unreadNotifications } = useSocket()
  const { tr, isArabic, lang } = useLang()
  const navigation  = useNavigation<any>()
  const isClient    = user?.role === 'client'
  const dir         = isArabic ? 'right' as const : 'left' as const

  const [projects,    setProjects]    = useState<any[]>([])
  const [myProposals, setMyProposals] = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category,    setCategory]    = useState('All')
  const freelancerInterested = (user as any)?.interestedCategories || []
  const freelancerChips = [
    'All',
    ...(Array.isArray(freelancerInterested) && freelancerInterested.length > 0
      ? freelancerInterested
      : CATEGORIES.filter(c => c !== 'All')
    ),
  ]
  const [bidTarget,   setBidTarget]   = useState<any>(null)
  const [showAllBrowse, setShowAllBrowse] = useState(false)

  // Animated greeting banner
  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start()
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      if (isClient) {
        const { data } = await getMyProjectsAPI()
        setProjects(Array.isArray(data) ? data : [])
      } else {
        const params: any = {}
        if (debouncedSearch) params.search = debouncedSearch
        if (category !== 'All') params.category = category
        const [projRes, propRes] = await Promise.all([
          getProjectsAPI(params),
          getMyProposalsAPI(),
        ])
        setProjects(Array.isArray(projRes.data) ? projRes.data : [])
        setMyProposals(Array.isArray(propRes.data) ? propRes.data : [])
      }
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [isClient, debouncedSearch, category])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 420)
    return () => clearTimeout(id)
  }, [searchInput])

  const runSearchNow = useCallback(() => {
    Keyboard.dismiss()
    setDebouncedSearch(searchInput.trim())
  }, [searchInput])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!socket) return
    const handler = () => fetchAll()
    socket.on('proposalReceived', handler)
    socket.on('proposalAccepted', handler)
    socket.on('newProject', handler)
    socket.on('openProjectsChanged', handler)
    socket.on('clientProjectsChanged', handler)
    socket.on('projectUpdated', handler)
    return () => {
      socket.off('proposalReceived', handler)
      socket.off('proposalAccepted', handler)
      socket.off('newProject', handler)
      socket.off('openProjectsChanged', handler)
      socket.off('clientProjectsChanged', handler)
      socket.off('projectUpdated', handler)
    }
  }, [socket, fetchAll])

  const onRefresh = async () => { setRefreshing(true); await fetchAll() }

  const handleBidSubmit = async (formData: any) => {
    if (!bidTarget) return
    try {
      await submitProposalAPI({ projectId: bidTarget._id, ...formData })
      Alert.alert('✅', isArabic ? 'تم إرسال عرضك بنجاح!' : 'Bid submitted successfully!')
      setBidTarget(null)
      fetchAll()
    } catch (e: any) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', e?.response?.data?.error || 'Failed')
    }
  }

  // ── Freelancer: compute recommended (skill-matched) vs browse ────────────
  const userSkills: string[] = (user?.skills || []).map((s: string) => s.toLowerCase())

  const getMatchScore = (project: any) => {
    if (userSkills.length === 0) return 0
    const projSkills = (project.skills || []).map((s: string) => s.toLowerCase())
    const matches = projSkills.filter((s: string) => userSkills.includes(s))
    return Math.round((matches.length / Math.max(projSkills.length, 1)) * 100)
  }

  const recommendedProjects = projects
    .map(p => ({ ...p, _matchScore: getMatchScore(p) }))
    .filter(p => p._matchScore > 0)
    .sort((a, b) => b._matchScore - a._matchScore)
    .slice(0, 4)

  const recommendedIds = new Set(recommendedProjects.map(p => p._id))
  const browseProjects = projects.filter(p => !recommendedIds.has(p._id))

  // ── Freelancer stats ─────────────────────────────────────────────────────
  const activeBids   = myProposals.filter(p => p.status === 'pending').length
  const wonBids      = myProposals.filter(p => p.status === 'accepted').length
  const totalEarned  = user?.totalEarned ?? 0
  const rating       = user?.rating ?? 0

  // ── Client stats ─────────────────────────────────────────────────────────
  const clientStats = {
    total:     projects.length,
    active:    projects.filter(p => p.status === 'in-progress').length,
    open:      projects.filter(p => p.status === 'open').length,
    completed: projects.filter(p => p.status === 'completed').length,
  }

  // Fixed header height: absolute bar + ScrollView paddingTop — layout below won’t jump on EN/AR toggle
  const headerPadTop = Math.max(insets.top, 6) + 4
  const HEADER_ROW_H = 64 // fixed slot: up to 2-line greeting + username (no reflow below)
  const headerTotalHeight = headerPadTop + HEADER_ROW_H + spacing.sm

  return (
    <View style={styles.container}>

      {/* ── Header: absolute slots (greeting vs actions) — stable height for scroll content ── */}
      <View style={[styles.headerAbsolute, { height: headerTotalHeight }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.headerGreetingAbs,
            {
              top: headerPadTop,
              opacity: fadeAnim,
              ...(isArabic
                ? { right: spacing.md, left: undefined }
                : { left: spacing.md, right: undefined }),
            },
          ]}
        >
          <Text style={[styles.greetingText, { textAlign: dir }]} numberOfLines={2}>
            {greeting(isArabic)} 👋
          </Text>
          <Text style={[styles.username, { textAlign: dir }]} numberOfLines={1} ellipsizeMode="tail">
            {user?.username} {isClient
              ? (isArabic ? '(عميل)' : '(Client)')
              : (isArabic ? '(مستقل)' : '(Freelancer)')
            }
          </Text>
        </Animated.View>

        <View
          style={[
            styles.headerActionsAbs,
            {
              top: headerPadTop,
              flexDirection: isArabic ? 'row-reverse' : 'row',
              ...(isArabic
                ? { left: spacing.md, right: undefined }
                : { right: spacing.md, left: undefined }),
            },
          ]}
        >
          <LangToggle />
          <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('NotificationsScreen')}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {unreadNotifications > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.avatarCircle}>
            <Text style={{ color: 'white', fontWeight: '800', fontSize: font.base }}>
              {user?.username?.[0]?.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerTotalHeight }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {/* ── AI Assistant (all users) ───────────────────────────────────── */}
        <TouchableOpacity
          style={styles.aiAssistantBanner}
          onPress={() => navigation.navigate('AIAssistantScreen')}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 28 }}>✨</Text>
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={[styles.findFreelancerTitle, { textAlign: dir }]}>{tr.aiAssistant}</Text>
            <Text style={[styles.findFreelancerSub, { textAlign: dir }]}>{tr.aiAssistantSub}</Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 22 }}>›</Text>
        </TouchableOpacity>

        {/* ══════════════════════════════════════════════════════════════════
            FREELANCER VIEW
        ══════════════════════════════════════════════════════════════════ */}
        {!isClient && (
          <>
            {/* ── Freelancer Stats ── */}
            {/* One row: all four stats (no wrap — frees space for search below) */}
            <View style={styles.flStatsGrid}>
              <View style={[styles.flStatCard, styles.flStatCardEarn, { borderColor: colors.primary + '44' }]}>
                <Text style={[styles.flStatBig, styles.flStatBigCompact, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  ${totalEarned.toLocaleString()}
                </Text>
                <Text style={styles.flStatLabel} numberOfLines={2}>
                  {isArabic ? 'إجمالي الأرباح' : 'Total Earned'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.flStatCard}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={isArabic ? 'عرض التقييمات والمراجعات' : 'View ratings and reviews'}
                onPress={() => navigation.navigate('ReviewsScreen', {
                  freelancerId:   user?._id,
                  freelancerName: user?.username,
                })}
              >
                <Text style={[styles.flStatBig, styles.flStatBigCompact, { color: colors.warning }]}>
                  ★ {rating.toFixed(1)}
                </Text>
                <Text style={styles.flStatLabel} numberOfLines={1}>{isArabic ? 'التقييم' : 'Rating'}</Text>
                <Text style={styles.flStatTapHint} numberOfLines={1}>
                  {isArabic ? 'تفاصيل' : 'Details'}
                </Text>
              </TouchableOpacity>
              <View style={styles.flStatCard}>
                <Text style={[styles.flStatBig, styles.flStatBigCompact, { color: colors.info }]}>{activeBids}</Text>
                <Text style={styles.flStatLabel} numberOfLines={2}>{isArabic ? 'عروض نشطة' : 'Active Bids'}</Text>
              </View>
              <View style={styles.flStatCard}>
                <Text style={[styles.flStatBig, styles.flStatBigCompact, { color: colors.primary }]}>{wonBids}</Text>
                <Text style={styles.flStatLabel} numberOfLines={2}>{isArabic ? 'مشاريع رابحة' : 'Won'}</Text>
              </View>
            </View>

            {/* ── Search & Filters ── */}
            <View style={styles.searchSection}>
              <View style={[styles.searchBox, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
                <Text style={{ color: colors.textMuted, marginHorizontal: 10, fontSize: 16 }}>🔍</Text>
                <TextInput
                  style={[styles.searchInput, { textAlign: dir }]}
                  placeholder={tr.searchPlaceholder}
                  placeholderTextColor={colors.textDim}
                  value={searchInput}
                  onChangeText={setSearchInput}
                  returnKeyType="search"
                  onSubmitEditing={runSearchNow}
                />
                <TouchableOpacity onPress={runSearchNow} style={styles.searchGoBtn} accessibilityRole="button">
                  <Text style={styles.searchGoBtnText}>🔍</Text>
                </TouchableOpacity>
                {searchInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setSearchInput(''); setDebouncedSearch('') }}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ color: colors.textMuted }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Category chips */}
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={{ marginTop: 10 }}
                contentContainerStyle={{ gap: 8, paddingRight: spacing.md }}
              >
                {freelancerChips.map(cat => {
                  const label = cat === 'All' ? tr.allCategories : cat
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catChip, category === cat && styles.catChipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.catChipText, category === cat && { color: 'white' }]}>
                        {cat !== 'All' && categoryIcon(cat) + ' '}{label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
            ) : projects.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                  {isArabic ? 'لا توجد مشاريع تطابق بحثك' : 'No projects match your search'}
                </Text>
              </View>
            ) : (
              <>
                {/* ── 🔥 Recommended for You ── */}
                {recommendedProjects.length > 0 && (
                  <View style={styles.section}>
                    <View style={[styles.sectionHeader, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
                      <Text style={styles.sectionTitle}>
                        🔥 {isArabic ? 'موصى لك' : 'Recommended for You'}
                      </Text>
                      <Text style={styles.sectionSub}>
                        {isArabic ? 'مطابق لمهاراتك' : 'Matched to your skills'}
                      </Text>
                    </View>

                    {recommendedProjects.map(p => (
                      <RecommendedCard
                        key={p._id}
                        project={p}
                        isArabic={isArabic}
                        matchScore={p._matchScore}
                        onBid={setBidTarget}
                        onPress={() => navigation.navigate('ProjectDetailScreen', { projectId: p._id })}
                      />
                    ))}
                  </View>
                )}

                {/* ── 📋 Browse All Projects ── */}
                {browseProjects.length > 0 && (
                  <View style={[styles.section, { marginTop: recommendedProjects.length > 0 ? 0 : 4 }]}>
                    <View style={[styles.sectionHeader, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
                      <Text style={styles.sectionTitle}>
                        📋 {isArabic ? 'تصفح المشاريع' : 'Browse All Projects'}
                      </Text>
                      <Text style={styles.sectionCount}>
                        {browseProjects.length} {isArabic ? 'مشروع' : 'projects'}
                      </Text>
                    </View>

                    {(showAllBrowse ? browseProjects : browseProjects.slice(0, 6)).map(p => (
                      <BrowseCard
                        key={p._id}
                        project={p}
                        isArabic={isArabic}
                        onBid={setBidTarget}
                        onPress={() => navigation.navigate('ProjectDetailScreen', { projectId: p._id })}
                      />
                    ))}

                    {browseProjects.length > 6 && (
                      <TouchableOpacity
                        style={styles.showMoreBtn}
                        onPress={() => setShowAllBrowse(!showAllBrowse)}
                      >
                        <Text style={styles.showMoreText}>
                          {showAllBrowse
                            ? (isArabic ? '▲ عرض أقل' : '▲ Show Less')
                            : (isArabic ? `▼ عرض كل ${browseProjects.length} مشروع` : `▼ Show all ${browseProjects.length} projects`)}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* If no skill-based recommendations, show all as Browse */}
                {recommendedProjects.length === 0 && browseProjects.length === 0 && projects.length > 0 && (
                  <View style={styles.section}>
                    <View style={[styles.sectionHeader, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
                      <Text style={styles.sectionTitle}>
                        📋 {isArabic ? 'جميع المشاريع' : 'All Projects'}
                      </Text>
                      <Text style={styles.sectionCount}>{projects.length}</Text>
                    </View>
                    {projects.map(p => (
                      <BrowseCard
                        key={p._id}
                        project={p}
                        isArabic={isArabic}
                        onBid={setBidTarget}
                        onPress={() => navigation.navigate('ProjectDetailScreen', { projectId: p._id })}
                      />
                    ))}
                  </View>
                )}

                {/* Add skills prompt if no recommendations and user has no skills */}
                {recommendedProjects.length === 0 && userSkills.length === 0 && (
                  <TouchableOpacity
                    style={styles.addSkillsBanner}
                    onPress={() => navigation.navigate('Profile')}
                  >
                    <Text style={styles.addSkillsIcon}>🎯</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.addSkillsTitle, { textAlign: dir }]}>
                        {isArabic ? 'أضف مهاراتك' : 'Add Your Skills'}
                      </Text>
                      <Text style={[styles.addSkillsSub, { textAlign: dir }]}>
                        {isArabic
                          ? 'لنوصي لك بمشاريع تناسب خبرتك'
                          : 'Get personalized project recommendations'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.primary, fontSize: 20 }}>›</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CLIENT VIEW
        ══════════════════════════════════════════════════════════════════ */}
        {isClient && (
          <>
            {/* ── Client Stats ── */}
            <View style={styles.statsRow}>
              {[
                { label: tr.total,  value: clientStats.total,     color: colors.info },
                { label: tr.open,   value: clientStats.open,      color: colors.primary },
                { label: tr.active, value: clientStats.active,    color: colors.warning },
                { label: tr.done,   value: clientStats.completed, color: colors.success },
              ].map(s => (
                <View key={s.label} style={styles.statCard}>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { textAlign: 'center' }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* ── Find Freelancers banner ── */}
            <TouchableOpacity
              style={styles.findFreelancerBanner}
              onPress={() => navigation.navigate('FreelancerSearchScreen')}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 28 }}>🔍</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.findFreelancerTitle, { textAlign: dir }]}>
                  {isArabic ? 'ابحث عن مستقلين' : 'Find Freelancers'}
                </Text>
                <Text style={[styles.findFreelancerSub, { textAlign: dir }]}>
                  {isArabic
                    ? 'تصفح أفضل المستقلين وتواصل معهم مباشرة'
                    : 'Browse top talent and start a conversation'}
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 22 }}>›</Text>
            </TouchableOpacity>

            {/* ── Post a project shortcut ── */}
            <TouchableOpacity
              style={styles.postBanner}
              onPress={() => navigation.navigate('Post')}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 28 }}>✏️</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.findFreelancerTitle, { textAlign: dir }]}>
                  {isArabic ? 'انشر مشروعاً جديداً' : 'Post a New Project'}
                </Text>
                <Text style={[styles.findFreelancerSub, { textAlign: dir }]}>
                  {isArabic ? 'استقطب أفضل المستقلين لمشروعك' : 'Attract top freelancers for your project'}
                </Text>
              </View>
              <Text style={{ color: colors.success, fontSize: 22 }}>›</Text>
            </TouchableOpacity>

            {/* ── My Projects ── */}
            <Text style={[styles.sectionTitle2, { textAlign: dir, marginHorizontal: spacing.md }]}>
              {tr.myProjects} ({projects.length})
            </Text>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
            ) : projects.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📂</Text>
                <Text style={[styles.emptyText, { textAlign: 'center' }]}>{tr.noProjectsYet}</Text>
                <Text style={[styles.emptySubText, { textAlign: 'center' }]}>{tr.noProjectsMsg}</Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: 40 }}>
                {projects.map(p => (
                  <ClientProjectCard
                    key={p._id} project={p} tr={tr} isArabic={isArabic}
                    onPress={() => navigation.navigate('ProjectDetailScreen', { projectId: p._id })}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BidModal
        visible={!!bidTarget}
        project={bidTarget}
        onClose={() => setBidTarget(null)}
        onSubmit={handleBidSubmit}
        isArabic={isArabic}
        tr={tr}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header — absolute overlay; ScrollView uses paddingTop = same total height (no layout shift on RTL)
  headerAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 8,
    backgroundColor: colors.cardDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerGreetingAbs: {
    position: 'absolute',
    width: '46%',
    maxWidth: 210,
  },
  headerActionsAbs: {
    position: 'absolute',
    alignItems: 'center',
    gap: 4,
  },
  greetingText: { color: colors.text, fontSize: font.lg, fontWeight: '800', lineHeight: 22 },
  username:     { color: colors.textMuted, fontSize: font.sm, marginTop: 1 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  // Lang toggle
  langToggle:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border, gap: 2 },
  langLabel:       { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  langLabelActive: { color: colors.primary },

  // Bell
  bellBtn:      { position: 'relative', width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  bellBadge:    { position: 'absolute', top: -2, right: -2, backgroundColor: colors.error, borderRadius: radius.full, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  bellBadgeText:{ color: '#fff', fontSize: 9, fontWeight: '800' },

  // ── FREELANCER STATS ────────────────────────────────────────────────────────
  flStatsGrid:     { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  flStatCard:      { flex: 1, minWidth: 0, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  flStatCardEarn:  { flex: 1.15 },
  flStatBig:       { fontSize: font.lg, fontWeight: '900', marginBottom: 2 },
  flStatBigCompact:{ fontSize: font.md, fontWeight: '900' },
  flStatLabel:     { color: colors.textDim, fontSize: 9, textAlign: 'center', lineHeight: 12 },
  flStatTapHint:   { color: colors.primary, fontSize: 8, fontWeight: '700', textAlign: 'center', marginTop: 1, opacity: 0.9 },

  // AI Assistant entry
  aiAssistantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: colors.info + '14',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.info + '44',
  },

  // Search
  searchSection: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  searchInput:   { flex: 1, color: colors.text, fontSize: font.base, paddingVertical: 12 },
  searchGoBtn:   { paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },
  searchGoBtnText:{ fontSize: 18 },

  // Category chips
  catChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText:   { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },

  // Section headers
  section:       { paddingHorizontal: spacing.md, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionTitle:  { color: colors.text, fontSize: font.lg, fontWeight: '800' },
  sectionTitle2: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: spacing.sm, marginTop: 4 },
  sectionSub:    { color: colors.textDim, fontSize: font.sm },
  sectionCount:  { color: colors.primary, fontSize: font.sm, fontWeight: '700' },

  // ── RECOMMENDED CARDS ────────────────────────────────────────────────────────
  recCard:      { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border, position: 'relative' },
  matchBadge:   { position: 'absolute', top: 10, right: 10, backgroundColor: colors.success + '20', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.success + '40' },
  matchBadgeText:{ color: colors.success, fontSize: 11, fontWeight: '700' },
  recCatIcon:   { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '30' },
  recTitle:     { color: colors.text, fontWeight: '700', fontSize: font.base, lineHeight: 20 },
  recMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  catPill:      { backgroundColor: colors.info + '18', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.info + '30' },
  catPillText:  { color: colors.info, fontSize: 11, fontWeight: '600' },
  recBudget:    { color: colors.success, fontWeight: '700', fontSize: font.sm },
  recDesc:      { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginTop: 8, marginBottom: 8 },
  skillsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  skillChip:    { backgroundColor: colors.primary + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: colors.primary + '30' },
  skillText:    { color: colors.primary, fontSize: 11, fontWeight: '600' },
  recFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recStats:     { flexDirection: 'row', gap: 10 },
  recStat:      { color: colors.textDim, fontSize: 12 },
  bidBtn:       { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  bidBtnText:   { color: 'white', fontWeight: '700', fontSize: font.sm },

  // ── BROWSE CARDS ─────────────────────────────────────────────────────────────
  browseCard:    { backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  browseCatIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.cardDark, alignItems: 'center', justifyContent: 'center' },
  browseTitle:   { color: colors.text, fontWeight: '700', fontSize: font.sm },
  browseMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  browseBudget:  { color: colors.success, fontWeight: '700', fontSize: font.sm },
  browseStat:    { color: colors.textDim, fontSize: font.sm },
  bidBtnSm:      { backgroundColor: colors.primary + '20', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.primary + '44' },
  bidBtnSmText:  { color: colors.primary, fontWeight: '700', fontSize: font.sm },

  showMoreBtn:  { backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  showMoreText: { color: colors.primary, fontWeight: '700', fontSize: font.sm },

  // Add skills banner
  addSkillsBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.warning + '12', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.warning + '44', gap: 10 },
  addSkillsIcon:   { fontSize: 28 },
  addSkillsTitle:  { color: colors.text, fontWeight: '800', fontSize: font.base },
  addSkillsSub:    { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },

  // ── CLIENT STATS ──────────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue:{ fontSize: font.lg, fontWeight: '800' },
  statLabel:{ color: colors.textMuted, fontSize: 10, marginTop: 2 },

  // Find Freelancers / Post banners (client)
  findFreelancerBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: 10, backgroundColor: colors.primary + '14', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '44' },
  findFreelancerTitle:  { color: colors.primary, fontWeight: '800', fontSize: font.base },
  findFreelancerSub:    { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  postBanner:           { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.success + '12', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.success + '33' },

  // Client project cards
  clientCard:      { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  clientCardTitle: { color: colors.text, fontSize: font.base, fontWeight: '700' },
  clientCardDesc:  { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginBottom: 10 },
  clientCardMeta:  { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  statusPill:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  statusPillText:  { fontSize: 11, fontWeight: '700' },
  metaText:        { color: colors.textDim, fontSize: font.sm },

  // Empty
  emptyState:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.xl },
  emptyIcon:    { fontSize: 56, marginBottom: 16 },
  emptyText:    { color: colors.text, fontSize: font.lg, fontWeight: '700', marginBottom: 8 },
  emptySubText: { color: colors.textMuted, fontSize: font.base, lineHeight: 22 },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 44 },
  modalTitle:    { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.md },
  inputLabel:    { color: colors.textMuted, fontSize: font.sm, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input:         { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: font.base, paddingHorizontal: spacing.md, paddingVertical: 12 },
  textarea:      { height: 100, textAlignVertical: 'top' },
  btn:           { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  btnText:       { color: 'white', fontWeight: '700', fontSize: font.base },
})
