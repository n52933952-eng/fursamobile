import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { getContractAPI, getMilestonesAPI, requestReviewAPI, releasePaymentAPI, createMilestonesAPI, markProjectCompleteAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

const milestoneStatusConfig: Record<string, { color: string; icon: string; label: string }> = {
  pending:  { color: colors.textDim, icon: '⏳', label: 'Pending' },
  review:   { color: colors.warning, icon: '🔍', label: 'Under Review' },
  released: { color: colors.success, icon: '✅', label: 'Paid' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Milestone Card ───────────────────────────────────────────────────────────

function MilestoneCard({ milestone, isClient, onAction }: {
  milestone: any
  isClient: boolean
  onAction: (id: string, action: 'review' | 'release') => void
}) {
  const sc = milestoneStatusConfig[milestone.status] || milestoneStatusConfig.pending

  return (
    <View style={[styles.milestoneCard, milestone.status === 'released' && styles.milestoneReleased]}>
      <View style={styles.milestoneHeader}>
        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
        <View style={[styles.mStatusBadge, { backgroundColor: sc.color + '20', borderColor: sc.color }]}>
          <Text style={[styles.mStatusText, { color: sc.color }]}>{sc.icon} {sc.label}</Text>
        </View>
      </View>

      {milestone.description && (
        <Text style={styles.milestoneDesc}>{milestone.description}</Text>
      )}

      <View style={styles.milestoneFooter}>
        <Text style={styles.milestoneAmount}>${milestone.amount}</Text>
        {milestone.dueDate && (
          <Text style={styles.milestoneDue}>Due: {formatDate(milestone.dueDate)}</Text>
        )}
      </View>

      {/* Freelancer: submit for review when pending */}
      {!isClient && milestone.status === 'pending' && (
        <TouchableOpacity style={styles.reviewBtn} onPress={() => onAction(milestone._id, 'review')}>
          <Text style={styles.reviewBtnText}>📤 Submit for Review</Text>
        </TouchableOpacity>
      )}

      {/* Client: release payment when milestone is in review */}
      {isClient && milestone.status === 'review' && (
        <TouchableOpacity style={styles.releaseBtn} onPress={() => onAction(milestone._id, 'release')}>
          <Text style={styles.releaseBtnText}>💸 Release Payment</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ContractScreen() {
  const { user }   = useAuth()
  const { socket } = useSocket()
  const navigation = useNavigation<any>()
  const route      = useRoute<any>()
  const { projectId } = route.params || {}
  const isClient   = user?.role === 'client'

  const [contract, setContract]   = useState<any>(null)
  const [milestones, setMilestones] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [cRes, mRes] = await Promise.all([
        getContractAPI(projectId),
        getMilestonesAPI(projectId),
      ])
      setContract(cRes.data)
      setMilestones(Array.isArray(mRes.data) ? mRes.data : [])
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  // Real-time: refresh milestones when payment is released
  useEffect(() => {
    if (!socket) return
    const handler = () => { load() }
    socket.on('paymentReleased', handler)
    return () => { socket.off('paymentReleased', handler) }
  }, [socket, load])

  const handleAction = async (milestoneId: string, action: 'review' | 'release') => {
    const confirmMsg = action === 'release'
      ? 'Release payment for this milestone? This cannot be undone.'
      : 'Submit this milestone for client review?'

    Alert.alert(
      action === 'release' ? 'Release Payment?' : 'Submit for Review?',
      confirmMsg,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'default', onPress: async () => {
          setActionLoading(milestoneId)
          try {
            if (action === 'review') await requestReviewAPI(milestoneId)
            else                     await releasePaymentAPI(milestoneId)
            load()
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'Action failed')
          }
          setActionLoading(null)
        }},
      ]
    )
  }

  const onRefresh = () => { setRefreshing(true); load() }

  const handleMarkComplete = () => {
    const contractAmount = contract?.amount || 0
    Alert.alert(
      'Mark Project as Complete?',
      `This will:\n• Move $${contractAmount} from client escrow → admin holding\n• Admin will review and release payment to you\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit for Approval', style: 'default', onPress: async () => {
          setCompleting(true)
          try {
            await markProjectCompleteAPI(projectId)
            Alert.alert(
              '✅ Submitted!',
              `Your work has been submitted for admin review.\n$${contractAmount} is now held by admin and will be released to your wallet once approved.`
            )
            load()
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'Failed to submit project')
          }
          setCompleting(false)
        }},
      ]
    )
  }

  // Totals
  const totalAmount   = milestones.reduce((s, m) => s + (m.amount || 0), 0)
  const releasedAmount= milestones.filter(m => m.status === 'released').reduce((s, m) => s + (m.amount || 0), 0)
  const pendingAmount = totalAmount - releasedAmount

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  if (!contract) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Contract not found</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
        <Text style={[styles.errorText, { color: colors.primary }]}>← Go Back</Text>
      </TouchableOpacity>
    </View>
  )

  const project = contract.projectId
  const client  = contract.clientId
  const fl      = contract.freelancerId

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Contract</Text>
        <TouchableOpacity
          style={styles.disputeIconBtn}
          onPress={() => navigation.navigate('DisputeScreen', { projectId, projectTitle: project?.title })}>
          <Text style={{ fontSize: 18 }}>⚠️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Contract Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.projectTitle}>{project?.title || 'Project'}</Text>
          <Text style={styles.terms}>{contract.terms}</Text>

          <View style={styles.partiesRow}>
            <View style={styles.party}>
              <View style={[styles.partyAvatar, { backgroundColor: colors.info }]}>
                <Text style={styles.partyAvatarText}>{(client?.username || 'C')[0].toUpperCase()}</Text>
              </View>
              <Text style={styles.partyLabel}>Client</Text>
              <Text style={styles.partyName}>{client?.username || 'Client'}</Text>
            </View>
            <Text style={styles.vs}>↔</Text>
            <View style={styles.party}>
              <View style={[styles.partyAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.partyAvatarText}>{(fl?.username || 'F')[0].toUpperCase()}</Text>
              </View>
              <Text style={styles.partyLabel}>Freelancer</Text>
              <Text style={styles.partyName}>{fl?.username || 'Freelancer'}</Text>
            </View>
          </View>

          <View style={styles.deadline}>
            <Text style={styles.deadlineLabel}>📅 Deadline</Text>
            <Text style={styles.deadlineValue}>{formatDate(contract.deadline)}</Text>
          </View>
        </View>

        {/* Financial Summary */}
        <View style={styles.finRow}>
          <View style={styles.finBox}>
            <Text style={styles.finLabel}>Total</Text>
            <Text style={[styles.finValue, { color: colors.text }]}>${totalAmount}</Text>
          </View>
          <View style={styles.finBox}>
            <Text style={styles.finLabel}>Released</Text>
            <Text style={[styles.finValue, { color: colors.success }]}>${releasedAmount}</Text>
          </View>
          <View style={styles.finBox}>
            <Text style={styles.finLabel}>Pending</Text>
            <Text style={[styles.finValue, { color: colors.warning }]}>${pendingAmount}</Text>
          </View>
        </View>

        {/* Milestones */}
        <View style={styles.milestonesSection}>
          <Text style={styles.sectionTitle}>
            Milestones ({milestones.length})
          </Text>

          {milestones.length === 0 ? (
            <View style={styles.emptyMilestones}>
              <Text style={styles.emptyText}>No milestones have been set yet.</Text>
              {isClient && (
                <TouchableOpacity
                  style={styles.addMilestoneBtn}
                  onPress={() => navigation.navigate('AddMilestonesScreen', { projectId, contractAmount: contract.amount })}
                >
                  <Text style={styles.addMilestoneBtnText}>+ Add Milestones</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            milestones.map(m => (
              <MilestoneCard
                key={m._id}
                milestone={m}
                isClient={isClient}
                onAction={handleAction}
              />
            ))
          )}
        </View>

        {/* Freelancer: mark project complete */}
        {!isClient && (contract?.projectId?.status === 'in-progress' || project?.status === 'in-progress') && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleMarkComplete}
            disabled={completing}
          >
            {completing
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={styles.completeBtnText}>🏁 Mark Project as Complete</Text>
            }
          </TouchableOpacity>
        )}

        {/* Pending-approval banner for freelancer */}
        {!isClient && project?.status === 'pending-approval' && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>
              ✋ Waiting for admin to review and release your payment
            </Text>
          </View>
        )}

        {/* Client: Rate Freelancer when project is completed */}
        {isClient && project?.status === 'completed' && fl && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => navigation.navigate('ReviewsScreen', {
              freelancerId:   fl._id,
              freelancerName: fl.username,
              projectId:      projectId,
              showReviewForm: true,
            })}
          >
            <Text style={styles.rateBtnText}>⭐ Rate the Freelancer</Text>
            <Text style={styles.rateBtnSub}>Share your experience with {fl.username}</Text>
          </TouchableOpacity>
        )}

        {/* Client: project completed banner */}
        {project?.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerText}>
              ✅ Project completed! Payment has been released to the freelancer.
            </Text>
          </View>
        )}

        {/* Dispute button */}
        {project?.status !== 'completed' && (
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() => navigation.navigate('DisputeScreen', { projectId, projectTitle: project?.title })}
          >
            <Text style={styles.disputeBtnText}>⚠️ File a Dispute</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textMuted, fontSize: font.base },

  header:       { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.cardDark },
  backBtn:      { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  backArrow:    { color: colors.text, fontSize: font.lg, lineHeight: 22 },
  headerTitle:  { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center' },
  disputeIconBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.error + '22', alignItems: 'center', justifyContent: 'center' },

  summaryCard:  { margin: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  projectTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: spacing.xs },
  terms:        { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginBottom: spacing.md },

  partiesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  party:      { alignItems: 'center', flex: 1 },
  partyAvatar:{ width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  partyAvatarText: { color: '#fff', fontWeight: '800', fontSize: font.base },
  partyLabel: { color: colors.textDim, fontSize: 11 },
  partyName:  { color: colors.text, fontWeight: '700', fontSize: font.sm },
  vs:         { color: colors.textDim, fontSize: font.xl, fontWeight: '300' },

  deadline:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  deadlineLabel: { color: colors.textMuted, fontSize: font.sm },
  deadlineValue: { color: colors.text, fontWeight: '700', fontSize: font.sm },

  finRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  finBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  finLabel: { color: colors.textDim, fontSize: font.sm },
  finValue: { fontSize: font.lg, fontWeight: '800', marginTop: 2 },

  milestonesSection: { marginHorizontal: spacing.md },
  sectionTitle:      { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: spacing.md },

  milestoneCard:     { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  milestoneReleased: { borderColor: colors.success + '44', backgroundColor: colors.success + '0a' },
  milestoneHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  milestoneTitle:    { color: colors.text, fontWeight: '700', fontSize: font.base, flex: 1 },
  mStatusBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  mStatusText:       { fontSize: 11, fontWeight: '700' },
  milestoneDesc:     { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginBottom: spacing.sm },
  milestoneFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  milestoneAmount:   { color: colors.success, fontWeight: '800', fontSize: font.lg },
  milestoneDue:      { color: colors.textDim, fontSize: font.sm },

  reviewBtn:     { backgroundColor: colors.warning + '22', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', marginTop: spacing.sm, borderWidth: 1, borderColor: colors.warning + '44' },
  reviewBtnText: { color: colors.warning, fontWeight: '700', fontSize: font.sm },
  releaseBtn:    { backgroundColor: colors.success, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  releaseBtnText:{ color: '#fff', fontWeight: '700', fontSize: font.sm },

  emptyMilestones:  { alignItems: 'center', paddingVertical: 30 },
  emptyText:        { color: colors.textMuted, fontSize: font.base, textAlign: 'center' },
  addMilestoneBtn:  { marginTop: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.lg },
  addMilestoneBtnText: { color: '#fff', fontWeight: '700' },

  rateBtn:         { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.warning + '18', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1.5, borderColor: colors.warning + '55' },
  rateBtnText:     { color: colors.warning, fontWeight: '800', fontSize: font.base },
  rateBtnSub:      { color: colors.textMuted, fontSize: font.sm, marginTop: 3 },

  completedBanner: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.success + '15', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.success + '30' },
  completedBannerText: { color: colors.success, fontWeight: '700', fontSize: font.sm, textAlign: 'center' },

  disputeBtn:     { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.error + '15', borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '30' },
  disputeBtnText: { color: colors.error, fontWeight: '700', fontSize: font.sm },

  completeBtn:     { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.success, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  completeBtnText: { color: '#fff', fontWeight: '800', fontSize: font.base },
  pendingBanner:   { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.warning + '18', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.warning + '44', alignItems: 'center' },
  pendingBannerText: { color: colors.warning, fontWeight: '600', fontSize: font.sm, textAlign: 'center' },
})
