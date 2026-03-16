import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
  TextInput, RefreshControl, Modal, Alert, ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import { getMyProjectsAPI, getProjectsAPI, submitProposalAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  open:          colors.info,
  'in-progress': colors.warning,
  completed:     colors.success,
  cancelled:     colors.error,
  disputed:      colors.error,
}

function daysLeft(deadline: string) {
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  return d > 0 ? `${d}d` : 'Due'
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  )
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

// ─── Client Project card ──────────────────────────────────────────────────────

function ClientProjectCard({ project, onPress }: { project: any; onPress: () => void }) {
  const { tr, isArabic } = useLang()
  const sc = statusColor[project.status] || colors.info
  const dir = isArabic ? 'right' as const : 'left' as const
  return (
    <TouchableOpacity style={styles.projectCard} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={[styles.projectTitle, { textAlign: dir }]} numberOfLines={1}>{project.title}</Text>
        <Badge text={project.status} color={sc} />
      </View>
      <Text style={[styles.projectDesc, { textAlign: dir }]} numberOfLines={2}>{project.description}</Text>
      <View style={styles.projectMeta}>
        <Text style={styles.metaText}>💰 ${project.budget}</Text>
        <Text style={styles.metaText}>📋 {project.proposals?.length ?? 0} {tr.bids}</Text>
        <Text style={styles.metaText}>⏰ {daysLeft(project.deadline)}</Text>
      </View>
      <Text style={[styles.tapHint, { textAlign: isArabic ? 'left' : 'right' }]}>{tr.tapDetails}</Text>
    </TouchableOpacity>
  )
}

// ─── Freelancer Project card ──────────────────────────────────────────────────

function FreelancerProjectCard({ project, onBid, onPress }: {
  project: any; onBid: (p: any) => void; onPress: () => void
}) {
  const { tr, isArabic } = useLang()
  const dir = isArabic ? 'right' as const : 'left' as const
  return (
    <TouchableOpacity style={styles.projectCard} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={[styles.projectTitle, { textAlign: dir }]} numberOfLines={1}>{project.title}</Text>
        <Badge text={project.category} color={colors.info} />
      </View>
      <Text style={[styles.projectDesc, { textAlign: dir }]} numberOfLines={2}>{project.description}</Text>
      <View style={styles.projectMeta}>
        <Text style={styles.metaText}>💰 ${project.budget}</Text>
        <Text style={styles.metaText}>📋 {project.proposals?.length ?? 0} {tr.bids}</Text>
        <Text style={styles.metaText}>⏰ {daysLeft(project.deadline)}</Text>
      </View>
      {project.clientId?.username && (
        <Text style={[styles.postedBy, { textAlign: dir }]}>{tr.postedBy} {project.clientId.username}</Text>
      )}
      <TouchableOpacity style={styles.bidBtn} onPress={(e) => { e.stopPropagation?.(); onBid(project) }}>
        <Text style={styles.bidBtnText}>💼 {tr.placeBid}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

// ─── Bid Modal ────────────────────────────────────────────────────────────────

function BidModal({ project, visible, onClose, onSubmit }: {
  project: any; visible: boolean; onClose: () => void; onSubmit: (data: any) => Promise<void>
}) {
  const { tr, isArabic } = useLang()
  const [coverLetter, setCoverLetter] = useState('')
  const [bid, setBid]                 = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [loading, setLoading]         = useState(false)
  const dir = isArabic ? 'right' as const : 'left' as const

  const handleSubmit = async () => {
    if (!coverLetter.trim() || !bid || !deliveryTime) {
      Alert.alert(tr.cancel, 'Please fill all fields.')
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
          <Text style={[styles.modalTitle, { textAlign: dir }]}>{tr.submitBid}</Text>
          {project && <Text style={[styles.modalSubtitle, { textAlign: dir }]} numberOfLines={2}>{project.title}</Text>}

          <Text style={[styles.inputLabel, { textAlign: dir }]}>{tr.coverLetter}</Text>
          <TextInput style={[styles.input, styles.textarea]} placeholder="..." placeholderTextColor={colors.textDim}
            value={coverLetter} onChangeText={setCoverLetter} multiline textAlign={dir} />

          <Text style={[styles.inputLabel, { textAlign: dir }]}>{tr.bidAmount}</Text>
          <TextInput style={styles.input} placeholder="e.g. 250" placeholderTextColor={colors.textDim}
            value={bid} onChangeText={setBid} keyboardType="numeric" textAlign={dir} />

          <Text style={[styles.inputLabel, { textAlign: dir }]}>{tr.deliveryTime}</Text>
          <TextInput style={styles.input} placeholder="e.g. 7" placeholderTextColor={colors.textDim}
            value={deliveryTime} onChangeText={setDeliveryTime} keyboardType="numeric" textAlign={dir} />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: colors.cardDark }]} onPress={onClose}>
              <Text style={styles.btnText}>{tr.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>{tr.submitBid}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Design', 'Development', 'Writing', 'Marketing', 'Video', 'Translation', 'Data']

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user }    = useAuth()
  const { socket, unreadNotifications } = useSocket()
  const { tr, isArabic, lang } = useLang()
  const navigation  = useNavigation<any>()
  const isClient    = user?.role === 'client'
  const dir         = isArabic ? 'right' as const : 'left' as const

  const [projects, setProjects]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')
  const [category, setCategory]     = useState('All')
  const [bidTarget, setBidTarget]   = useState<any>(null)

  const fetchProjects = useCallback(async () => {
    try {
      if (isClient) {
        const { data } = await getMyProjectsAPI()
        setProjects(Array.isArray(data) ? data : [])
      } else {
        const params: any = {}
        if (search) params.search = search
        if (category !== 'All') params.category = category
        const { data } = await getProjectsAPI(params)
        setProjects(Array.isArray(data) ? data : [])
      }
    } catch {}
    setLoading(false)
  }, [isClient, search, category])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // NOTE: Do NOT clear notification badges here — user must visit NotificationsScreen to clear them

  useEffect(() => {
    if (!socket) return
    const handler = () => { fetchProjects() }
    socket.on('proposalReceived', handler)
    socket.on('proposalAccepted', handler)
    return () => { socket.off('proposalReceived', handler); socket.off('proposalAccepted', handler) }
  }, [socket, fetchProjects])

  const onRefresh = async () => { setRefreshing(true); await fetchProjects(); setRefreshing(false) }

  const handleBidSubmit = async (formData: any) => {
    if (!bidTarget) return
    try {
      await submitProposalAPI({ projectId: bidTarget._id, ...formData })
      Alert.alert('✅', tr.submitBid)
      setBidTarget(null)
      fetchProjects()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed')
    }
  }

  const stats = {
    total:     projects.length,
    active:    projects.filter(p => p.status === 'in-progress').length,
    open:      projects.filter(p => p.status === 'open').length,
    completed: projects.filter(p => p.status === 'completed').length,
  }

  return (
    <View style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { textAlign: dir }]}>
            {isClient ? tr.myDashboard : tr.findWork}
          </Text>
          <Text style={[styles.username, { textAlign: dir }]}>
            {user?.username}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* AR / EN toggle */}
          <LangToggle />

          {/* Bell */}
          <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('NotificationsScreen')}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {unreadNotifications > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarCircle}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: font.lg }}>
              {user?.username?.[0]?.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Stats row ──────────────────────────────────────────────────── */}
        {isClient ? (
          <View style={styles.statsRow}>
            {[
              { label: tr.total,  value: stats.total,     color: colors.info },
              { label: tr.open,   value: stats.open,      color: colors.primary },
              { label: tr.active, value: stats.active,    color: colors.warning },
              { label: tr.done,   value: stats.completed, color: colors.success },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { textAlign: 'center' }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.statsRow}>
            {[
              { label: tr.earned,   value: `$${user?.totalEarned ?? 0}`, color: colors.success },
              { label: tr.rating,   value: `★ ${(user?.rating ?? 0).toFixed(1)}`, color: colors.warning },
              { label: tr.projects, value: user?.totalProjects ?? 0, color: colors.info },
            ].map(s => (
              <View key={s.label} style={[styles.statCard, { flex: 1 }]}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { textAlign: 'center' }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Find Freelancers (client only) ────────────────────────────── */}
        {isClient && (
          <TouchableOpacity
            style={styles.findFreelancerBanner}
            onPress={() => navigation.navigate('FreelancerSearchScreen')}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.findFreelancerTitle, { textAlign: dir }]}>
                {isArabic ? '🔍 ابحث عن مستقلين' : '🔍 Find Freelancers'}
              </Text>
              <Text style={[styles.findFreelancerSub, { textAlign: dir }]}>
                {isArabic ? 'تصفح أفضل المستقلين وتواصل معهم مباشرة' : 'Browse top talent and start a conversation'}
              </Text>
            </View>
            <Text style={{ fontSize: 28 }}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Search bar (freelancer only) ───────────────────────────────── */}
        {!isClient && (
          <View style={styles.searchSection}>
            {/* Search row with filter icon */}
            <View style={[styles.searchBox, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
              <Text style={{ color: colors.textMuted, marginHorizontal: 8 }}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { textAlign: dir }]}
                placeholder={tr.searchPlaceholder}
                placeholderTextColor={colors.textDim}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                onSubmitEditing={fetchProjects}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 6 }}>
                  <Text style={{ color: colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              )}
              <View style={styles.filterDivider} />
              <TouchableOpacity style={styles.filterBtn}>
                <Text style={{ fontSize: 18 }}>⚙️</Text>
              </TouchableOpacity>
            </View>

            {/* Filters label */}
            <Text style={[styles.filtersLabel, { textAlign: dir }]}>{tr.filters}</Text>

            {/* Category chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catScroll}
              contentContainerStyle={{ gap: 8, paddingRight: spacing.md }}
            >
              {CATEGORIES.map(cat => {
                const label = cat === 'All' ? tr.allCategories : cat
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, category === cat && styles.catChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catChipText, category === cat && { color: 'white' }]}>{label}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Section title ──────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { textAlign: dir }]}>
          {isClient
            ? `${tr.myProjects} (${projects.length})`
            : `${tr.browseProjects} (${projects.length})`
          }
        </Text>

        {/* ── Project list ───────────────────────────────────────────────── */}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
        ) : projects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{isClient ? '📂' : '🔍'}</Text>
            <Text style={[styles.emptyText, { textAlign: 'center' }]}>
              {isClient ? tr.noProjectsYet : tr.noProjectsFreelancer}
            </Text>
            <Text style={[styles.emptySubText, { textAlign: 'center' }]}>
              {isClient ? tr.noProjectsMsg : ''}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: 100 }}>
            {isClient
              ? projects.map(p => (
                  <ClientProjectCard key={p._id} project={p}
                    onPress={() => navigation.navigate('ProjectDetailScreen', { projectId: p._id })} />
                ))
              : projects.map(p => (
                  <FreelancerProjectCard key={p._id} project={p}
                    onBid={setBidTarget}
                    onPress={() => navigation.navigate('ProjectDetailScreen', { projectId: p._id })} />
                ))
            }
          </View>
        )}
      </ScrollView>

      <BidModal visible={!!bidTarget} project={bidTarget} onClose={() => setBidTarget(null)} onSubmit={handleBidSubmit} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 56, paddingBottom: spacing.md, backgroundColor: colors.cardDark, gap: spacing.sm },
  greeting:     { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  username:     { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  // Lang toggle
  langToggle:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border, gap: 2 },
  langLabel:       { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  langLabelActive: { color: colors.primary },

  // Bell
  bellBtn:      { position: 'relative', width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  bellBadge:    { position: 'absolute', top: -2, right: -2, backgroundColor: colors.error, borderRadius: radius.full, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  bellBadgeText:{ color: '#fff', fontSize: 9, fontWeight: '800' },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue:{ fontSize: font.lg, fontWeight: '800' },
  statLabel:{ color: colors.textMuted, fontSize: 10, marginTop: 2 },

  // Search section
  searchSection: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  searchInput:   { flex: 1, color: colors.text, fontSize: font.base, paddingVertical: 12 },
  filterDivider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4 },
  filterBtn:     { paddingHorizontal: 10, paddingVertical: 8 },
  filtersLabel:  { color: colors.textMuted, fontSize: font.sm, fontWeight: '700', marginBottom: 8 },

  catScroll:     { marginBottom: 4 },
  catChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText:   { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },

  // Find Freelancers banner (client)
  findFreelancerBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.primary + '18', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '55', gap: 10 },
  findFreelancerTitle:  { color: colors.primary, fontWeight: '800', fontSize: font.base },
  findFreelancerSub:    { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },

  // Section title
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700', paddingHorizontal: spacing.md, marginBottom: spacing.sm },

  // Cards
  projectCard:  { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  projectTitle: { color: colors.text, fontSize: font.base, fontWeight: '700', flex: 1, marginRight: 8 },
  projectDesc:  { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginBottom: 10 },
  projectMeta:  { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  metaText:     { color: colors.textDim, fontSize: font.sm },
  postedBy:     { color: colors.textDim, fontSize: font.sm, marginTop: 6 },
  tapHint:      { color: colors.primary, fontSize: 11, marginTop: 6 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  badgeText:    { fontSize: font.sm, fontWeight: '600' },
  bidBtn:       { marginTop: 12, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  bidBtnText:   { color: 'white', fontWeight: '700', fontSize: font.base },

  // Empty
  emptyState:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.xl },
  emptyIcon:    { fontSize: 56, marginBottom: 16 },
  emptyText:    { color: colors.text, fontSize: font.lg, fontWeight: '700', marginBottom: 8 },
  emptySubText: { color: colors.textMuted, fontSize: font.base, lineHeight: 22 },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40 },
  modalTitle:    { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.md },
  inputLabel:    { color: colors.textMuted, fontSize: font.sm, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input:         { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: font.base, paddingHorizontal: spacing.md, paddingVertical: 12 },
  textarea:      { height: 100, textAlignVertical: 'top' },
  btn:           { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  btnText:       { color: 'white', fontWeight: '700', fontSize: font.base },
})
