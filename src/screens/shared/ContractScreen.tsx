import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useLang } from '../../context/LanguageContext'
import {
  getContractAPI, getMilestonesAPI, requestReviewAPI,
  releasePaymentAPI, markProjectCompleteAPI,
} from '../../api'
import { colors, spacing, radius, font, screenHeaderPaddingTop } from '../../theme'

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Status config ─────────────────────────────────────────────────────────────
const projectStatusCfg: Record<string, { color: string; icon: string; en: string; ar: string }> = {
  'open':             { color: colors.info,    icon: '📂', en: 'Open',              ar: 'مفتوح' },
  'in-progress':      { color: colors.warning, icon: '🔧', en: 'In Progress',       ar: 'جاري العمل' },
  'pending-approval': { color: '#9F7AEA',      icon: '✋', en: 'Pending Review',    ar: 'قيد المراجعة' },
  'completed':        { color: colors.success, icon: '✅', en: 'Completed',          ar: 'مكتمل' },
  'disputed':         { color: colors.error,   icon: '⚠️', en: 'Disputed',           ar: 'متنازع عليه' },
}

const milestoneCfg: Record<string, { color: string; icon: string; en: string; ar: string }> = {
  pending:  { color: colors.textDim, icon: '⏳', en: 'Pending',      ar: 'قيد الانتظار' },
  review:   { color: colors.warning, icon: '🔍', en: 'Under Review', ar: 'قيد المراجعة' },
  released: { color: colors.success, icon: '✅', en: 'Paid',          ar: 'تم الدفع' },
}

// ─── Payment Flow Banner ────────────────────────────────────────────────────────
function PaymentFlowBanner({ status, amount, isArabic }: {
  status: string; amount: number; isArabic: boolean
}) {
  const steps = isArabic
    ? ['💳 العميل يدفع', '🔒 احتجاز ضمان', '✅ الإدارة تراجع', '💸 يُحوَّل للمستقل']
    : ['💳 Client pays', '🔒 Escrow hold', '✅ Admin reviews', '💸 Freelancer paid']

  const activeStep =
    status === 'open'             ? 0 :
    status === 'in-progress'      ? 1 :
    status === 'pending-approval' ? 2 :
    status === 'completed'        ? 3 : 1

  return (
    <View style={flowStyles.box}>
      <Text style={[flowStyles.title, { textAlign: isArabic ? 'right' : 'left' }]}>
        {isArabic ? `💰 تدفق المدفوعات — $${amount}` : `💰 Payment Flow — $${amount}`}
      </Text>
      <View style={flowStyles.row}>
        {steps.map((step, i) => (
          <View key={i} style={flowStyles.stepWrap}>
            <View style={[flowStyles.dot, i <= activeStep && flowStyles.dotActive, i === activeStep && flowStyles.dotCurrent]} />
            {i < steps.length - 1 && (
              <View style={[flowStyles.line, i < activeStep && flowStyles.lineActive]} />
            )}
            <Text style={[flowStyles.stepLabel, i <= activeStep && flowStyles.stepLabelActive, i === activeStep && { color: colors.primary }]}>
              {step}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const flowStyles = StyleSheet.create({
  box:          { marginHorizontal: spacing.md, marginBottom: 12, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  title:        { color: colors.text, fontWeight: '800', fontSize: font.base, marginBottom: 14 },
  row:          { flexDirection: 'row', alignItems: 'flex-start' },
  stepWrap:     { flex: 1, alignItems: 'center', position: 'relative' },
  dot:          { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border, marginBottom: 6 },
  dotActive:    { backgroundColor: colors.success },
  dotCurrent:   { backgroundColor: colors.primary, width: 14, height: 14, borderRadius: 7 },
  line:         { position: 'absolute', top: 6, left: '50%', right: '-50%', height: 2, backgroundColor: colors.border },
  lineActive:   { backgroundColor: colors.success },
  stepLabel:    { color: colors.textDim, fontSize: 9, textAlign: 'center', lineHeight: 13 },
  stepLabelActive: { color: colors.textMuted },
})

// ─── Milestone Card ─────────────────────────────────────────────────────────────
function MilestoneCard({ milestone, isClient, onAction, actionLoading, isArabic }: {
  milestone: any; isClient: boolean; isArabic: boolean; actionLoading: string | null
  onAction: (id: string, action: 'review' | 'release') => void
}) {
  const sc  = milestoneCfg[milestone.status] || milestoneCfg.pending
  const dir = isArabic ? 'right' as const : 'left' as const
  const isLoading = actionLoading === milestone._id

  return (
    <View style={[mStyles.card, milestone.status === 'released' && mStyles.cardReleased]}>
      <View style={mStyles.cardHeader}>
        <Text style={[mStyles.title, { flex: 1, textAlign: dir }]} numberOfLines={2}>{milestone.title}</Text>
        <View style={[mStyles.badge, { backgroundColor: sc.color + '20', borderColor: sc.color + '55' }]}>
          <Text style={[mStyles.badgeText, { color: sc.color }]}>
            {sc.icon} {isArabic ? sc.ar : sc.en}
          </Text>
        </View>
      </View>

      {milestone.description && (
        <Text style={[mStyles.desc, { textAlign: dir }]}>{milestone.description}</Text>
      )}

      <View style={mStyles.footer}>
        <Text style={mStyles.amount}>${milestone.amount?.toLocaleString()}</Text>
        {milestone.dueDate && (
          <Text style={mStyles.due}>
            📅 {isArabic ? 'الموعد' : 'Due'}: {formatDate(milestone.dueDate)}
          </Text>
        )}
      </View>

      {/* Freelancer: submit for review when pending */}
      {!isClient && milestone.status === 'pending' && (
        <TouchableOpacity
          style={mStyles.reviewBtn}
          onPress={() => onAction(milestone._id, 'review')}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color={colors.warning} size="small" />
            : <Text style={mStyles.reviewBtnText}>
                📤 {isArabic ? 'تقديم للمراجعة' : 'Submit for Review'}
              </Text>
          }
        </TouchableOpacity>
      )}

      {/* Client: release payment when in review */}
      {isClient && milestone.status === 'review' && (
        <TouchableOpacity
          style={mStyles.releaseBtn}
          onPress={() => onAction(milestone._id, 'release')}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={mStyles.releaseBtnText}>
                💸 {isArabic ? 'تحرير الدفعة' : 'Release Payment'}
              </Text>
          }
        </TouchableOpacity>
      )}
    </View>
  )
}

const mStyles = StyleSheet.create({
  card:         { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardReleased: { borderColor: colors.success + '55', backgroundColor: colors.success + '06' },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  title:        { color: colors.text, fontWeight: '700', fontSize: font.base },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  badgeText:    { fontSize: 11, fontWeight: '700' },
  desc:         { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginBottom: 8 },
  footer:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  amount:       { color: colors.success, fontWeight: '900', fontSize: font.lg },
  due:          { color: colors.textDim, fontSize: font.sm },
  reviewBtn:    { marginTop: 10, backgroundColor: colors.warning + '22', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.warning + '44' },
  reviewBtnText:{ color: colors.warning, fontWeight: '700', fontSize: font.sm },
  releaseBtn:   { marginTop: 10, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  releaseBtnText:{ color: '#fff', fontWeight: '700', fontSize: font.sm },
})

// ─── Main Screen ────────────────────────────────────────────────────────────────
export default function ContractScreen() {
  const insets = useSafeAreaInsets()
  const { user }   = useAuth()
  const { socket } = useSocket()
  const { isArabic, lang, toggleLang } = useLang()
  const navigation = useNavigation<any>()
  const route      = useRoute<any>()
  const { projectId } = route.params || {}
  const isClient   = user?.role === 'client'
  const dir        = isArabic ? 'right' as const : 'left' as const

  const [contract,      setContract]      = useState<any>(null)
  const [milestones,    setMilestones]    = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [completing,    setCompleting]    = useState(false)

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
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

  useEffect(() => {
    if (!socket) return
    const handler = () => load()
    socket.on('paymentReleased', handler)
    socket.on('projectComplete', handler)
    return () => { socket.off('paymentReleased', handler); socket.off('projectComplete', handler) }
  }, [socket, load])

  const handleAction = async (milestoneId: string, action: 'review' | 'release') => {
    const title = action === 'release'
      ? (isArabic ? 'تحرير الدفعة؟' : 'Release Payment?')
      : (isArabic ? 'تقديم للمراجعة؟' : 'Submit for Review?')
    const msg = action === 'release'
      ? (isArabic ? 'هل تريد تحرير الدفعة لهذه المرحلة؟ لا يمكن التراجع.' : 'Release payment for this milestone? This cannot be undone.')
      : (isArabic ? 'هل تريد تقديم هذه المرحلة للمراجعة؟' : 'Submit this milestone for client review?')

    Alert.alert(title, msg, [
      { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: isArabic ? 'تأكيد' : 'Confirm', onPress: async () => {
        setActionLoading(milestoneId)
        try {
          if (action === 'review') await requestReviewAPI(milestoneId)
          else                     await releasePaymentAPI(milestoneId)
          load()
        } catch (e: any) {
          Alert.alert(isArabic ? 'خطأ' : 'Error', e?.response?.data?.error || 'Action failed')
        }
        setActionLoading(null)
      }},
    ])
  }

  const handleMarkComplete = () => {
    const amount = contract?.amount || 0
    Alert.alert(
      isArabic ? 'تأكيد إنهاء المشروع' : 'Mark Project Complete?',
      isArabic
        ? `سيتم:\n• تحويل $${amount} من ضمان العميل → الإدارة\n• ستُرسَل الأموال لمحفظتك بعد موافقة الإدارة`
        : `This will:\n• Move $${amount} from client escrow → admin\n• Admin will review and release funds to your wallet`,
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isArabic ? 'تقديم للموافقة' : 'Submit for Approval', onPress: async () => {
          setCompleting(true)
          try {
            await markProjectCompleteAPI(projectId)
            Alert.alert(
              isArabic ? '✅ تم التقديم!' : '✅ Submitted!',
              isArabic
                ? `تم تقديم عملك للمراجعة. سيتم تحويل $${amount} لمحفظتك بعد موافقة الإدارة.`
                : `Your work has been submitted for admin review.\n$${amount} will be released to your wallet once approved.`
            )
            load()
          } catch (e: any) {
            Alert.alert(isArabic ? 'خطأ' : 'Error', e?.response?.data?.error || 'Failed')
          }
          setCompleting(false)
        }},
      ]
    )
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  if (!contract) return (
    <View style={styles.center}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>📄</Text>
      <Text style={styles.errorText}>{isArabic ? 'العقد غير موجود' : 'Contract not found'}</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>
          {isArabic ? '← رجوع' : '← Go Back'}
        </Text>
      </TouchableOpacity>
    </View>
  )

  const project  = contract.projectId
  const client   = contract.clientId
  const fl       = contract.freelancerId
  const projStatus = project?.status || 'in-progress'
  const statusCfg  = projectStatusCfg[projStatus] || projectStatusCfg['in-progress']

  // ── Financials — use contract.amount as fallback if no milestones ─────────
  const contractAmount  = contract.amount || 0
  const totalAmount     = milestones.length > 0
    ? milestones.reduce((s, m) => s + (m.amount || 0), 0)
    : contractAmount
  const releasedAmount  = milestones.filter(m => m.status === 'released')
    .reduce((s, m) => s + (m.amount || 0), 0)
  const pendingAmount   = totalAmount - releasedAmount

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: screenHeaderPaddingTop(insets.top), paddingBottom: spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isArabic ? '📄 العقد' : '📄 Contract'}
        </Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.primary} />}
      >

        {/* ── Project title + status ── */}
        <View style={styles.projectHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.projectTitle, { textAlign: dir }]} numberOfLines={2}>
              {project?.title || (isArabic ? 'مشروع' : 'Project')}
            </Text>
            {project?.category && (
              <View style={[styles.catChip, { alignSelf: isArabic ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.catText}>{project.category}</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '22', borderColor: statusCfg.color + '55' }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>
              {statusCfg.icon} {isArabic ? statusCfg.ar : statusCfg.en}
            </Text>
          </View>
        </View>

        {/* ── Parties ── */}
        <View style={styles.partiesCard}>
          <View style={styles.party}>
            <View style={[styles.partyAvatar, { backgroundColor: colors.info }]}>
              <Text style={styles.partyAvatarText}>{(client?.username || 'C')[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.partyRole}>{isArabic ? 'عميل' : 'Client'}</Text>
            <Text style={styles.partyName}>{client?.username || '—'}</Text>
          </View>
          <View style={styles.vsCol}>
            <Text style={styles.vs}>↔</Text>
            <Text style={styles.contractId}>#{contract._id?.slice(-6)?.toUpperCase()}</Text>
          </View>
          <View style={styles.party}>
            <View style={[styles.partyAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.partyAvatarText}>{(fl?.username || 'F')[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.partyRole}>{isArabic ? 'مستقل' : 'Freelancer'}</Text>
            <Text style={styles.partyName}>{fl?.username || '—'}</Text>
          </View>
        </View>

        {/* ── Key details row ── */}
        <View style={styles.detailsRow}>
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>📅 {isArabic ? 'الموعد' : 'Deadline'}</Text>
            <Text style={styles.detailValue}>{formatDate(contract.deadline)}</Text>
          </View>
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>📅 {isArabic ? 'تاريخ البدء' : 'Started'}</Text>
            <Text style={styles.detailValue}>{formatDate(contract.createdAt)}</Text>
          </View>
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>📋 {isArabic ? 'المراحل' : 'Milestones'}</Text>
            <Text style={[styles.detailValue, { color: colors.primary }]}>{milestones.length}</Text>
          </View>
        </View>

        {/* ── Terms ── */}
        {contract.terms && (
          <View style={styles.termsBox}>
            <Text style={[styles.termsTitle, { textAlign: dir }]}>
              📝 {isArabic ? 'شروط العقد' : 'Contract Terms'}
            </Text>
            <Text style={[styles.termsText, { textAlign: dir }]}>{contract.terms}</Text>
          </View>
        )}

        {/* ── Financial summary ── */}
        <View style={styles.finRow}>
          <View style={styles.finBox}>
            <Text style={styles.finLabel}>{isArabic ? 'إجمالي' : 'Total'}</Text>
            <Text style={[styles.finValue, { color: colors.text }]}>${totalAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.finBox}>
            <Text style={styles.finLabel}>{isArabic ? 'محرر' : 'Released'}</Text>
            <Text style={[styles.finValue, { color: colors.success }]}>${releasedAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.finBox}>
            <Text style={styles.finLabel}>{isArabic ? 'متبقي' : 'Remaining'}</Text>
            <Text style={[styles.finValue, { color: colors.warning }]}>${pendingAmount.toLocaleString()}</Text>
          </View>
        </View>

        {/* ── Payment flow ── */}
        <PaymentFlowBanner status={projStatus} amount={contractAmount} isArabic={isArabic} />

        {/* ── Milestones ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: dir }]}>
            🏁 {isArabic ? `المراحل (${milestones.length})` : `Milestones (${milestones.length})`}
          </Text>

          {milestones.length === 0 ? (
            <View style={styles.emptyMilestones}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
              <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                {isArabic ? 'لم يتم تحديد مراحل بعد' : 'No milestones set yet'}
              </Text>
              <Text style={[styles.emptySub, { textAlign: 'center' }]}>
                {isArabic
                  ? 'المبلغ الإجمالي للعقد هو $' + contractAmount
                  : `The full contract amount is $${contractAmount}`}
              </Text>
            </View>
          ) : (
            milestones.map(m => (
              <MilestoneCard
                key={m._id}
                milestone={m}
                isClient={isClient}
                isArabic={isArabic}
                onAction={handleAction}
                actionLoading={actionLoading}
              />
            ))
          )}
        </View>

        {/* ── Freelancer: Mark Complete ── */}
        {!isClient && projStatus === 'in-progress' && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleMarkComplete}
            disabled={completing}
          >
            {completing
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={styles.completeBtnText}>
                  🏁 {isArabic ? 'تمييز المشروع كمكتمل' : 'Mark Project as Complete'}
                </Text>
            }
          </TouchableOpacity>
        )}

        {/* ── Freelancer: pending approval banner ── */}
        {!isClient && projStatus === 'pending-approval' && (
          <View style={styles.pendingBanner}>
            <Text style={[styles.pendingBannerText, { textAlign: 'center' }]}>
              ✋ {isArabic
                ? 'في انتظار مراجعة الإدارة وتحرير مبلغك'
                : 'Waiting for admin to review and release your payment'}
            </Text>
          </View>
        )}

        {/* ── Client: Rate freelancer ── */}
        {isClient && projStatus === 'completed' && fl && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => navigation.navigate('ReviewsScreen', {
              freelancerId:   fl._id,
              freelancerName: fl.username,
              projectId,
              showReviewForm: true,
            })}
          >
            <Text style={styles.rateBtnText}>
              ⭐ {isArabic ? 'قيّم المستقل' : 'Rate the Freelancer'}
            </Text>
            <Text style={styles.rateBtnSub}>
              {isArabic
                ? `شاركنا تجربتك مع ${fl.username}`
                : `Share your experience with ${fl.username}`}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Completed banner ── */}
        {projStatus === 'completed' && (
          <View style={styles.completedBanner}>
            <Text style={[styles.completedBannerText, { textAlign: 'center' }]}>
              ✅ {isArabic
                ? 'اكتمل المشروع! تم تحرير المبلغ للمستقل.'
                : 'Project completed! Payment has been released to the freelancer.'}
            </Text>
          </View>
        )}

        {/* ── Dispute ── */}
        {projStatus !== 'completed' && (
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() => navigation.navigate('DisputeScreen', { projectId, projectTitle: project?.title })}
          >
            <Text style={styles.disputeBtnText}>
              ⚠️ {isArabic ? 'رفع نزاع' : 'File a Dispute'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textMuted, fontSize: font.base, textAlign: 'center' },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.cardDark, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:     { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  backArrow:   { color: colors.text, fontSize: font.lg },
  headerTitle: { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: '800' },
  langBtn:     { backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },

  // Project header
  projectHeader: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: 8, gap: 10 },
  projectTitle:  { color: colors.text, fontSize: font.xl, fontWeight: '900', lineHeight: 28 },
  catChip:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.info + '18', borderWidth: 1, borderColor: colors.info + '40', marginTop: 6 },
  catText:       { color: colors.info, fontSize: 11, fontWeight: '600' },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, flexShrink: 0 },
  statusText:    { fontSize: 12, fontWeight: '700' },

  // Parties
  partiesCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, marginHorizontal: spacing.md, borderRadius: radius.lg, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  party:         { flex: 1, alignItems: 'center' },
  partyAvatar:   { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  partyAvatarText: { color: '#fff', fontWeight: '800', fontSize: font.lg },
  partyRole:     { color: colors.textDim, fontSize: 10, marginBottom: 2 },
  partyName:     { color: colors.text, fontWeight: '700', fontSize: font.sm, textAlign: 'center' },
  vsCol:         { alignItems: 'center', paddingHorizontal: 8 },
  vs:            { color: colors.textDim, fontSize: font.xl },
  contractId:    { color: colors.textDim, fontSize: 10, marginTop: 2 },

  // Details row
  detailsRow: { flexDirection: 'row', marginHorizontal: spacing.md, gap: 8, marginBottom: 10 },
  detailBox:  { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  detailLabel:{ color: colors.textDim, fontSize: 10, marginBottom: 4, textAlign: 'center' },
  detailValue:{ color: colors.text, fontWeight: '700', fontSize: font.sm, textAlign: 'center' },

  // Terms
  termsBox:   { marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  termsTitle: { color: colors.text, fontWeight: '700', fontSize: font.base, marginBottom: 6 },
  termsText:  { color: colors.textMuted, fontSize: font.sm, lineHeight: 20 },

  // Financials
  finRow:  { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: 10, gap: 8 },
  finBox:  { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  finLabel:{ color: colors.textDim, fontSize: 11, marginBottom: 4 },
  finValue:{ fontSize: font.xl, fontWeight: '900' },

  // Milestones
  section:       { marginHorizontal: spacing.md, marginBottom: 10 },
  sectionTitle:  { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: 12 },
  emptyMilestones:{ alignItems: 'center', paddingVertical: 24, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emptyText:     { color: colors.text, fontWeight: '700', fontSize: font.base },
  emptySub:      { color: colors.textMuted, fontSize: font.sm, marginTop: 4 },

  // Buttons
  completeBtn:     { marginHorizontal: spacing.md, marginBottom: 10, backgroundColor: colors.success, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  completeBtnText: { color: '#fff', fontWeight: '800', fontSize: font.base },

  pendingBanner:     { marginHorizontal: spacing.md, marginBottom: 10, backgroundColor: '#9F7AEA18', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: '#9F7AEA44' },
  pendingBannerText: { color: '#B794F4', fontWeight: '700', fontSize: font.sm },

  rateBtn:         { marginHorizontal: spacing.md, marginBottom: 10, backgroundColor: colors.warning + '18', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1.5, borderColor: colors.warning + '55' },
  rateBtnText:     { color: colors.warning, fontWeight: '800', fontSize: font.base },
  rateBtnSub:      { color: colors.textMuted, fontSize: font.sm, marginTop: 3 },

  completedBanner:     { marginHorizontal: spacing.md, marginBottom: 10, backgroundColor: colors.success + '15', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.success + '30' },
  completedBannerText: { color: colors.success, fontWeight: '700', fontSize: font.sm },

  disputeBtn:     { marginHorizontal: spacing.md, marginBottom: 10, backgroundColor: colors.error + '12', borderRadius: radius.lg, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '30' },
  disputeBtnText: { color: colors.error, fontWeight: '700', fontSize: font.sm },
})
