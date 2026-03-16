import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import {
  getProjectAPI, getProposalsAPI, acceptProposalAPI, submitProposalAPI,
} from '../../api'
import { colors, spacing, radius, font } from '../../theme'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  open:          colors.info,
  'in-progress': colors.warning,
  completed:     colors.success,
  cancelled:     colors.error,
  disputed:      colors.error,
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`
}

// ─── Proposal Card ───────────────────────────────────────────────────────────

function ProposalCard({ proposal, onAccept, isClient }: { proposal: any; onAccept: (id: string, bid: number) => void; isClient: boolean }) {
  const fl = proposal.freelancerId || {}
  return (
    <View style={styles.proposalCard}>
      <View style={styles.proposalHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{(fl.username || 'F')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.proposalName}>{fl.username || 'Freelancer'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.starText}>⭐</Text>
            <Text style={styles.ratingText}>{fl.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.dimText}> · {fl.totalProjects || 0} projects</Text>
          </View>
        </View>
        <View>
          <Text style={styles.bidAmount}>${proposal.bid}</Text>
          <Text style={styles.deliveryText}>{proposal.deliveryTime} days</Text>
        </View>
      </View>

      <Text style={styles.coverLetter} numberOfLines={3}>{proposal.coverLetter}</Text>

      {fl.skills?.length > 0 && (
        <View style={styles.skillsRow}>
          {fl.skills.slice(0, 3).map((s: string) => (
            <View key={s} style={styles.skillChip}>
              <Text style={styles.skillText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {isClient && proposal.status === 'pending' && (
        <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(proposal._id, proposal.bid)}>
          <Text style={styles.acceptBtnText}>✅ Accept This Bid</Text>
        </TouchableOpacity>
      )}

      {proposal.status === 'accepted' && (
        <View style={styles.acceptedBadge}>
          <Text style={styles.acceptedBadgeText}>✅ Accepted</Text>
        </View>
      )}
    </View>
  )
}

// ─── Bid Modal ───────────────────────────────────────────────────────────────

function BidModal({ projectId, visible, onClose, onSubmit }: any) {
  const [bid, setBid]             = useState('')
  const [deliveryTime, setDelivery] = useState('')
  const [coverLetter, setCover]   = useState('')
  const [loading, setLoading]     = useState(false)

  const submit = async () => {
    if (!bid || !deliveryTime || !coverLetter.trim()) {
      return Alert.alert('Missing Info', 'Please fill all fields.')
    }
    setLoading(true)
    await onSubmit({ bid: Number(bid), deliveryTime: Number(deliveryTime), coverLetter })
    setLoading(false)
    setBid(''); setDelivery(''); setCover('')
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Submit Your Bid</Text>

          <Text style={styles.fieldLabel}>Bid Amount ($)</Text>
          <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor={colors.textDim}
            keyboardType="numeric" value={bid} onChangeText={setBid} />

          <Text style={styles.fieldLabel}>Delivery Time (days)</Text>
          <TextInput style={styles.input} placeholder="e.g. 7" placeholderTextColor={colors.textDim}
            keyboardType="numeric" value={deliveryTime} onChangeText={setDelivery} />

          <Text style={styles.fieldLabel}>Cover Letter</Text>
          <TextInput style={[styles.input, styles.textarea]}
            placeholder="Describe why you're the best fit..." placeholderTextColor={colors.textDim}
            multiline value={coverLetter} onChangeText={setCover} />

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit Bid</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const { user }   = useAuth()
  const navigation = useNavigation<any>()
  const route      = useRoute<any>()
  const { projectId } = route.params || {}
  const isClient   = user?.role === 'client'

  const [project, setProject]     = useState<any>(null)
  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [bidModal, setBidModal]   = useState(false)
  const [myProposal, setMyProposal] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      const [pRes, propRes] = await Promise.all([
        getProjectAPI(projectId),
        isClient ? getProposalsAPI(projectId) : Promise.resolve({ data: [] }),
      ])
      setProject(pRes.data)
      const list = Array.isArray(propRes.data) ? propRes.data : []
      setProposals(list)
      if (!isClient) {
        const mine = list.find((p: any) => p.freelancerId?._id === user?._id || p.freelancerId === user?._id)
        setMyProposal(mine || null)
      }
    } catch {}
    setLoading(false)
  }, [projectId, isClient])

  useEffect(() => { load() }, [load])

  const handleAccept = async (proposalId: string, bidAmount: number) => {
    Alert.alert(
      'Accept Bid?',
      `Accepting will:\n• Lock $${bidAmount} from your wallet into escrow\n• Start the project\n• Create a contract\n\nMake sure your wallet has at least $${bidAmount}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept & Lock Funds', style: 'default', onPress: async () => {
          try {
            await acceptProposalAPI(proposalId)
            Alert.alert('🎉 Contract Created!', `$${bidAmount} has been locked in escrow. The project is now in progress.`)
            load()
          } catch (e: any) {
            const errMsg = e?.response?.data?.error || 'Failed to accept'
            if (errMsg.includes('Insufficient')) {
              Alert.alert('💳 Insufficient Balance', errMsg + '\n\nGo to Wallet → Add Funds to top up.')
            } else {
              Alert.alert('Error', errMsg)
            }
          }
        }},
      ]
    )
  }

  const handleBid = async (formData: any) => {
    try {
      await submitProposalAPI({ projectId, ...formData })
      Alert.alert('✅ Bid Submitted!', 'Your proposal was sent to the client.')
      setBidModal(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to submit bid')
    }
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  if (!project) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Project not found</Text>
    </View>
  )

  const isInProgress = project.status === 'in-progress'
  const statusColor  = statusColors[project.status] || colors.info

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Project Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Project Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{project.status}</Text>
            </View>
            <View style={[styles.categoryBadge]}>
              <Text style={styles.categoryText}>{project.category}</Text>
            </View>
          </View>

          <Text style={styles.projectTitle}>{project.title}</Text>
          <Text style={styles.projectDesc}>{project.description}</Text>

          {/* Budget & deadline */}
          <View style={styles.metaGrid}>
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>💰 Budget</Text>
              <Text style={styles.metaValue}>
                {project.budgetType === 'fixed'
                  ? `$${project.budget}`
                  : `$${project.budget}/hr`}
              </Text>
            </View>
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>📅 Posted</Text>
              <Text style={styles.metaValue}>{timeAgo(project.createdAt)}</Text>
            </View>
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>📋 Proposals</Text>
              <Text style={styles.metaValue}>{proposals.length || project.proposalCount || 0}</Text>
            </View>
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>⏱ Deadline</Text>
              <Text style={styles.metaValue}>{project.deadline ? `${project.deadline} days` : 'Open'}</Text>
            </View>
          </View>

          {/* Skills */}
          {project.skills?.length > 0 && (
            <View style={styles.skillsSection}>
              <Text style={styles.sectionLabel}>Required Skills</Text>
              <View style={styles.skillsRow}>
                {project.skills.map((s: string) => (
                  <View key={s} style={styles.skillChip}>
                    <Text style={styles.skillText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Freelancer actions */}
        {!isClient && project.status === 'open' && (
          <View style={styles.actionSection}>
            {!myProposal ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setBidModal(true)}>
                <Text style={styles.primaryBtnText}>💼 Submit Your Bid</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.myBidBanner}>
                <Text style={styles.myBidTitle}>Your Bid Status: {myProposal.status}</Text>
                <Text style={styles.myBidSub}>Amount: ${myProposal.bid} · {myProposal.deliveryTime} days</Text>
              </View>
            )}
          </View>
        )}

        {/* View Contract button */}
        {isInProgress && (
          <TouchableOpacity style={styles.contractBtn}
            onPress={() => navigation.navigate('ContractScreen', { projectId })}>
            <Text style={styles.contractBtnText}>📄 View Contract & Milestones →</Text>
          </TouchableOpacity>
        )}

        {/* Proposals section (client only) */}
        {isClient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Bids Received ({proposals.length})
            </Text>
            {proposals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No bids yet. Share your project to get more freelancers!</Text>
              </View>
            ) : (
              proposals.map(p => (
                <ProposalCard key={p._id} proposal={p}
                  isClient={isClient}
                  onAccept={handleAccept} />
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <BidModal
        projectId={projectId}
        visible={bidModal}
        onClose={() => setBidModal(false)}
        onSubmit={handleBid}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textMuted, fontSize: font.base },

  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.cardDark },
  backBtn:     { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  backArrow:   { color: colors.text, fontSize: font.lg, lineHeight: 22 },
  headerTitle: { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center' },

  infoCard:  { margin: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  statusText:    { fontSize: font.sm, fontWeight: '700', textTransform: 'capitalize' },
  categoryBadge: { backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  categoryText:  { color: colors.primary, fontSize: font.sm, fontWeight: '600' },

  projectTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: spacing.sm, lineHeight: 28 },
  projectDesc:  { color: colors.textMuted, fontSize: font.base, lineHeight: 22, marginBottom: spacing.md },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaBox:  { width: '47%', backgroundColor: colors.cardDark, borderRadius: radius.md, padding: spacing.sm },
  metaLabel:{ color: colors.textDim, fontSize: font.sm },
  metaValue:{ color: colors.text, fontWeight: '700', fontSize: font.base, marginTop: 2 },

  skillsSection: { marginTop: spacing.md },
  sectionLabel:  { color: colors.textMuted, fontSize: font.sm, fontWeight: '600', marginBottom: spacing.xs },
  skillsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  skillChip:     { backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  skillText:     { color: colors.primary, fontSize: font.sm, fontWeight: '600' },

  actionSection: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  primaryBtn:    { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  primaryBtnText:{ color: '#fff', fontWeight: '800', fontSize: font.base },
  myBidBanner:   { backgroundColor: colors.success + '22', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.success + '44' },
  myBidTitle:    { color: colors.success, fontWeight: '700', fontSize: font.base, textTransform: 'capitalize' },
  myBidSub:      { color: colors.textMuted, fontSize: font.sm, marginTop: 4 },

  contractBtn:     { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.info + '22', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.info + '44' },
  contractBtnText: { color: colors.info, fontWeight: '700', fontSize: font.base },

  section:      { marginHorizontal: spacing.md },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: spacing.md },

  proposalCard:   { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  proposalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatarCircle:   { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#fff', fontSize: font.lg, fontWeight: '800' },
  proposalName:   { color: colors.text, fontWeight: '700', fontSize: font.base },
  starText:       { fontSize: 12 },
  ratingText:     { color: colors.warning, fontWeight: '700', fontSize: font.sm },
  dimText:        { color: colors.textDim, fontSize: font.sm },
  bidAmount:      { color: colors.success, fontWeight: '800', fontSize: font.lg, textAlign: 'right' },
  deliveryText:   { color: colors.textDim, fontSize: font.sm, textAlign: 'right' },
  coverLetter:    { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginBottom: spacing.sm },
  acceptBtn:      { backgroundColor: colors.success, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  acceptBtnText:  { color: '#fff', fontWeight: '700', fontSize: font.sm },
  acceptedBadge:  { backgroundColor: colors.success + '22', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.success + '44' },
  acceptedBadgeText: { color: colors.success, fontWeight: '700', fontSize: font.sm },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { color: colors.textMuted, fontSize: font.base, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: colors.cardDark, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalTitle:   { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: spacing.md },
  fieldLabel:   { color: colors.textMuted, fontSize: font.sm, fontWeight: '600', marginBottom: 6, marginTop: spacing.sm },
  input:        { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.base, borderWidth: 1, borderColor: colors.border },
  textarea:     { height: 100, textAlignVertical: 'top' },
  modalBtns:    { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn:    { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelBtnText:{ color: colors.textMuted, fontWeight: '700' },
  submitBtn:    { flex: 2, backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center' },
  submitBtnText:{ color: '#fff', fontWeight: '800' },
})
