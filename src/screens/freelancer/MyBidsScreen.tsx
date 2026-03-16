import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { getMyProposalsAPI } from '../../api'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import { colors, spacing, radius, font } from '../../theme'

const statusConfig: Record<string, { color: string; icon: string; label: string }> = {
  pending:  { color: colors.warning, icon: '⏳', label: 'Pending' },
  accepted: { color: colors.success, icon: '✅', label: 'Accepted' },
  rejected: { color: colors.error,   icon: '❌', label: 'Rejected' },
}

const projectStatusColor: Record<string, string> = {
  open:          colors.info,
  'in-progress': colors.warning,
  completed:     colors.success,
  cancelled:     colors.error,
}

function BidCard({ proposal, onPress }: { proposal: any; onPress?: () => void }) {
  const sc  = statusConfig[proposal.status] || statusConfig.pending
  const psc = projectStatusColor[proposal.projectId?.status] || colors.info

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Project title + status */}
      <View style={styles.cardHeader}>
        <Text style={styles.projectTitle} numberOfLines={2}>
          {proposal.projectId?.title || 'Unknown Project'}
        </Text>
        <View style={[styles.badge, { backgroundColor: sc.color + '22', borderColor: sc.color + '55' }]}>
          <Text style={[styles.badgeText, { color: sc.color }]}>{sc.icon} {sc.label}</Text>
        </View>
      </View>

      {/* Category */}
      {proposal.projectId?.category && (
        <View style={[styles.catBadge, { backgroundColor: colors.info + '22' }]}>
          <Text style={[styles.catText, { color: colors.info }]}>{proposal.projectId.category}</Text>
        </View>
      )}

      {/* Cover letter preview */}
      {proposal.coverLetter && (
        <Text style={styles.coverLetter} numberOfLines={3}>{proposal.coverLetter}</Text>
      )}

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>My Bid</Text>
          <Text style={[styles.metaValue, { color: colors.primary }]}>${proposal.bid?.toLocaleString()}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Delivery</Text>
          <Text style={styles.metaValue}>{proposal.deliveryTime} days</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Project Budget</Text>
          <Text style={styles.metaValue}>${proposal.projectId?.budget?.toLocaleString() ?? '—'}</Text>
        </View>
      </View>

      {/* Project status */}
      <View style={styles.projectStatusRow}>
        <Text style={styles.metaLabel}>Project: </Text>
        <View style={[styles.badge, { backgroundColor: psc + '22', borderColor: psc + '44' }]}>
          <Text style={[styles.badgeText, { color: psc }]}>{proposal.projectId?.status || 'open'}</Text>
        </View>
        <Text style={styles.dateText}>
          {new Date(proposal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      {/* Accepted banner */}
      {proposal.status === 'accepted' && (
        <View style={styles.acceptedBanner}>
          <Text style={styles.acceptedText}>🎉 Accepted! Tap to view contract →</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function MyBidsScreen() {
  const { socket, markNotificationsRead } = useSocket()
  const { tr, isArabic } = useLang()
  const navigation = useNavigation<any>()
  const dir = isArabic ? 'right' as const : 'left' as const
  const [proposals, setProposals]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter]         = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const [toast, setToast]           = useState<string | null>(null)
  const toastOpacity = React.useRef(new Animated.Value(0)).current

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
      const { data } = await getMyProposalsAPI()
      setProposals(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchProposals() }, [fetchProposals])

  // Real-time: when a bid is accepted, refresh and show toast
  useEffect(() => {
    if (!socket) return
    const handler = (data: any) => {
      showToast(`🎉 Your bid was accepted for: ${data.projectTitle || 'a project'}!`)
      // Update the matching proposal status locally for instant feedback
      setProposals(prev =>
        prev.map(p =>
          p._id === data.proposalId ? { ...p, status: 'accepted' } : p
        )
      )
      markNotificationsRead()
    }
    socket.on('proposalAccepted', handler)
    return () => { socket.off('proposalAccepted', handler) }
  }, [socket])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchProposals()
    setRefreshing(false)
  }

  const filtered = filter === 'all' ? proposals : proposals.filter(p => p.status === filter)

  const counts = {
    all:      proposals.length,
    pending:  proposals.filter(p => p.status === 'pending').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    rejected: proposals.filter(p => p.status === 'rejected').length,
  }

  return (
    <View style={styles.container}>
      {/* Real-time toast notification */}
      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { textAlign: dir }]}>{tr.myBidsTitle}</Text>
        <Text style={[styles.headerSub, { textAlign: dir }]}>{proposals.length} {tr.bidsSubtitle}</Text>
      </View>

      {/* Stats strip */}
      <View style={styles.statsRow}>
        {[
          { key: 'all',      label: 'All',      color: colors.info },
          { key: 'pending',  label: 'Pending',  color: colors.warning },
          { key: 'accepted', label: 'Accepted', color: colors.success },
          { key: 'rejected', label: 'Rejected', color: colors.error },
        ].map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.statChip, filter === s.key && { backgroundColor: s.color + '22', borderColor: s.color }]}
            onPress={() => setFilter(s.key as any)}
          >
            <Text style={[styles.statCount, { color: s.color }]}>{counts[s.key as keyof typeof counts]}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 56, marginBottom: 16 }}>📋</Text>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? `${tr.noBids}\n${tr.noBidsMsg}`
                  : `No ${filter} bids`}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((p, i) => (
                <BidCard
                  key={p._id || i}
                  proposal={p}
                  onPress={() => {
                    const projectId = p.projectId?._id || p.projectId
                    if (p.status === 'accepted' && projectId) {
                      navigation.navigate('ContractScreen', { projectId })
                    } else if (projectId) {
                      navigation.navigate('ProjectDetailScreen', { projectId })
                    }
                  }}
                />
              ))}
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  header:      { paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.cardDark },
  headerTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  headerSub:   { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },

  statsRow:  { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statChip:  { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statCount: { fontSize: font.xl, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  list:        { padding: spacing.md },

  card:        { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  projectTitle:{ color: colors.text, fontSize: font.base, fontWeight: '700', flex: 1 },
  badge:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  catBadge:    { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, marginBottom: 8 },
  catText:     { fontSize: font.sm, fontWeight: '600' },
  coverLetter: { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginBottom: 12 },

  metaRow:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: 4 },
  metaItem:  { flex: 1, alignItems: 'center' },
  metaLabel: { color: colors.textDim, fontSize: 11 },
  metaValue: { color: colors.text, fontWeight: '700', fontSize: font.base, marginTop: 2 },

  projectStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 4 },
  dateText:         { color: colors.textDim, fontSize: font.sm, marginLeft: 'auto' },

  acceptedBanner: { backgroundColor: colors.success + '22', borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.success + '44' },
  acceptedText:   { color: colors.success, fontSize: font.sm, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText:  { color: colors.textMuted, fontSize: font.base, textAlign: 'center', lineHeight: 24 },

  toast:      {
    position: 'absolute', top: 100, alignSelf: 'center', zIndex: 999,
    backgroundColor: colors.success, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  toastText:  { color: '#fff', fontWeight: '700', fontSize: font.sm },
})
