import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
  SafeAreaView,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { getReviewsAPI, createReviewAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ rating, size = 16, interactive = false, onRate }: {
  rating: number; size?: number; interactive?: boolean; onRate?: (r: number) => void
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity
          key={i}
          disabled={!interactive}
          onPress={() => onRate?.(i)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: size, color: i <= rating ? '#F6C90E' : colors.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Rating bar row ───────────────────────────────────────────────────────────

function RatingBar({ star, pct }: { star: number; pct: number }) {
  const barWidth = `${pct}%` as any
  return (
    <View style={styles.barRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', width: 24 }}>
        <Text style={styles.barStar}>{star}</Text>
        <Text style={{ color: '#F6C90E', fontSize: 11 }}> ★</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: barWidth }]} />
      </View>
      <Text style={styles.barPct}>{pct}%</Text>
    </View>
  )
}

// ─── Individual review card ───────────────────────────────────────────────────

function ReviewCard({ review, isArabic }: { review: any; isArabic: boolean }) {
  const [helpful, setHelpful] = useState(review.helpfulCount || 0)
  const [voted, setVoted]     = useState(false)
  const dir = isArabic ? 'right' as const : 'left' as const

  const date = new Date(review.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
  const initial = (review.reviewerId?.username || '?')[0].toUpperCase()

  const onHelpful = () => {
    if (voted) return
    setHelpful((h: number) => h + 1)
    setVoted(true)
  }

  return (
    <View style={styles.reviewCard}>
      {/* Reviewer header */}
      <View style={styles.reviewerRow}>
        <View style={styles.reviewerAvatar}>
          <Text style={styles.reviewerAvatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reviewerName, { textAlign: dir }]}>
            {review.reviewerId?.username || 'Anonymous'}
          </Text>
          <Text style={[styles.reviewDate, { textAlign: dir }]}>{date}</Text>
        </View>
        <Stars rating={review.rating} size={14} />
      </View>

      {/* Review text */}
      <Text style={[styles.reviewText, { textAlign: dir }]}>{review.comment}</Text>

      {/* Helpful */}
      <View style={styles.helpfulRow}>
        <TouchableOpacity
          style={[styles.helpfulBtn, voted && styles.helpfulBtnVoted]}
          onPress={onHelpful}
        >
          <Text style={[styles.helpfulText, voted && { color: colors.primary }]}>
            {isArabic ? `مفيد / Helpful  👍` : `Helpful / مفيد  👍`}
          </Text>
        </TouchableOpacity>
        {helpful > 0 && (
          <View style={styles.helpfulCount}>
            <Text style={styles.helpfulCountText}>{helpful}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Leave Review Modal ───────────────────────────────────────────────────────

function LeaveReviewModal({ visible, onClose, onSubmit, isArabic }: {
  visible: boolean; onClose: () => void
  onSubmit: (rating: number, comment: string) => Promise<void>; isArabic: boolean
}) {
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) { Alert.alert('', isArabic ? 'يرجى اختيار تقييم' : 'Please select a rating'); return }
    if (!comment.trim()) { Alert.alert('', isArabic ? 'يرجى كتابة تعليق' : 'Please write a comment'); return }
    setLoading(true)
    await onSubmit(rating, comment.trim())
    setLoading(false)
    setRating(0)
    setComment('')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>
            {isArabic ? 'اترك تقييماً / Leave a Review' : 'Leave a Review / اترك تقييماً'}
          </Text>

          <Text style={styles.modalLabel}>{isArabic ? 'التقييم العام' : 'Overall Rating'}</Text>
          <View style={{ marginBottom: spacing.md }}>
            <Stars rating={rating} size={36} interactive onRate={setRating} />
          </View>

          <Text style={styles.modalLabel}>{isArabic ? 'تعليقك' : 'Your Review'}</Text>
          <TextInput
            style={styles.modalInput}
            placeholder={isArabic ? 'اكتب تجربتك مع هذا المستقل...' : 'Share your experience with this freelancer...'}
            placeholderTextColor={colors.textDim}
            value={comment} onChangeText={setComment}
            multiline numberOfLines={4}
            textAlign={isArabic ? 'right' : 'left'}
            textAlignVertical="top"
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.cardDark, flex: 1 }]} onPress={onClose}>
              <Text style={styles.modalBtnText}>{isArabic ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={handleSubmit} disabled={loading}
            >
              {loading ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.modalBtnText}>{isArabic ? 'إرسال' : 'Submit'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReviewsScreen() {
  const navigation         = useNavigation<any>()
  const route              = useRoute<any>()
  const { user }           = useAuth()
  const { isArabic, lang, toggleLang } = useLang()

  const { freelancerId, freelancerName, projectId, showReviewForm } = route.params || {}
  const isOwnProfile   = !freelancerId || freelancerId === user?._id
  const canLeaveReview = user?.role === 'client' && !isOwnProfile

  const [reviews, setReviews]       = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal]   = useState(!!showReviewForm)

  const targetId = freelancerId || user?._id

  const fetchReviews = useCallback(async () => {
    try {
      const { data } = await getReviewsAPI(targetId)
      setReviews(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [targetId])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const handleSubmitReview = async (rating: number, comment: string) => {
    try {
      await createReviewAPI({ revieweeId: freelancerId, projectId, rating, comment })
      setShowModal(false)
      Alert.alert('✅', isArabic ? 'تم إرسال تقييمك بنجاح!' : 'Review submitted successfully!')
      fetchReviews()
    } catch (e: any) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', e?.response?.data?.error || 'Failed to submit review')
    }
  }

  // ── Compute stats ──────────────────────────────────────────────────────────
  const totalReviews  = reviews.length
  const avgRating     = totalReviews > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews
    : 0
  const roundedAvg    = Math.round(avgRating * 10) / 10

  const starCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct:   totalReviews > 0
      ? Math.round((reviews.filter(r => r.rating === star).length / totalReviews) * 100)
      : 0,
  }))

  const dir = isArabic ? 'right' as const : 'left' as const

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { textAlign: dir }]}>
            {isArabic ? 'التقييمات' : 'Ratings & Reviews'}
          </Text>
          <Text style={styles.headerSub}>
            {isArabic ? 'Ratings & Reviews' : 'التقييمات'}
          </Text>
        </View>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReviews() }} tintColor={colors.primary} />}
      >

        {/* ── Rating Summary ──────────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          {/* Big number + stars */}
          <View style={styles.summaryTop}>
            <View style={styles.summaryLeft}>
              <Text style={styles.avgNumber}>{roundedAvg.toFixed(1)}</Text>
              <Stars rating={Math.round(avgRating)} size={28} />
              <Text style={styles.totalText}>
                {totalReviews} {isArabic ? 'تقييم' : 'reviews'}
              </Text>
            </View>
            {/* Bars */}
            <View style={styles.summaryRight}>
              {starCounts.map(s => (
                <RatingBar key={s.star} star={s.star} pct={s.pct} />
              ))}
            </View>
          </View>
        </View>

        {/* ── Reviews header ──────────────────────────────────────────── */}
        <View style={styles.reviewsHeader}>
          <Text style={[styles.reviewsTitle, { textAlign: dir }]}>
            {isArabic ? 'تعليقات العملاء' : 'Customer Reviews'}
          </Text>
          <Text style={[styles.reviewsSubtitle, { textAlign: dir }]}>
            {isArabic ? 'Customer Reviews /' : 'تعليقات العملاء /'}
          </Text>
        </View>

        {/* ── Review Cards ────────────────────────────────────────────── */}
        {reviews.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 44 }}>⭐</Text>
            <Text style={styles.emptyTitle}>
              {isArabic ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
            </Text>
            <Text style={styles.emptyText}>
              {isArabic ? 'كن أول من يُقيّم' : 'Be the first to leave a review'}
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((r, i) => (
              <ReviewCard key={r._id || i} review={r} isArabic={isArabic} />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Leave Review button (clients only, on other's profile) ──────── */}
      {canLeaveReview && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.leaveBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.leaveBtnIcon}>★ </Text>
            <Text style={styles.leaveBtnText}>
              {isArabic ? 'اترك تقييم / Leave Review' : 'Leave Review / اترك تقييم'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <LeaveReviewModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmitReview}
        isArabic={isArabic}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.cardDark, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:     { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  backArrow:   { color: colors.text, fontSize: font.lg, lineHeight: 22 },
  headerTitle: { color: colors.text, fontSize: font.xl, fontWeight: '900' },
  headerSub:   { color: colors.textMuted, fontSize: font.sm },
  langBtn:     { backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },

  // Summary card
  summaryCard: { margin: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  summaryTop:  { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  summaryLeft: { alignItems: 'center', minWidth: 90 },
  avgNumber:   { color: colors.text, fontSize: 56, fontWeight: '900', lineHeight: 60, letterSpacing: -2 },
  totalText:   { color: colors.textMuted, fontSize: font.sm, marginTop: 4 },
  summaryRight:{ flex: 1, gap: 5 },

  // Bars
  barRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  barStar: { color: colors.textMuted, fontSize: 11, width: 10 },
  barBg:   { flex: 1, height: 7, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#F6C90E', borderRadius: radius.full },
  barPct:  { color: colors.textMuted, fontSize: 10, width: 28, textAlign: 'right' },

  // Reviews header
  reviewsHeader:   { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  reviewsTitle:    { color: colors.text, fontSize: font.lg, fontWeight: '800' },
  reviewsSubtitle: { color: colors.textMuted, fontSize: font.sm },

  // Review cards
  reviewsList: { paddingHorizontal: spacing.md, gap: spacing.sm },
  reviewCard:  { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },

  reviewerRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  reviewerAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  reviewerAvatarText:{ color: '#fff', fontWeight: '800', fontSize: font.base },
  reviewerName:      { color: colors.text, fontWeight: '700', fontSize: font.base },
  reviewDate:        { color: colors.textMuted, fontSize: font.sm },
  reviewText:        { color: colors.text, fontSize: font.base, lineHeight: 22, marginBottom: spacing.sm },

  helpfulRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  helpfulBtn:      { backgroundColor: colors.bg, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
  helpfulBtnVoted: { borderColor: colors.primary + '60', backgroundColor: colors.primary + '10' },
  helpfulText:     { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },
  helpfulCount:    { backgroundColor: colors.primary, borderRadius: radius.full, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  helpfulCountText:{ color: '#fff', fontSize: 11, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 30 },
  emptyTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.sm },
  emptyText:  { color: colors.textMuted, fontSize: font.base, marginTop: 4 },

  // Bottom bar
  bottomBar:   { paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.cardDark, borderTopWidth: 1, borderTopColor: colors.border },
  leaveBtn:    { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  leaveBtnIcon:{ color: '#fff', fontSize: font.base },
  leaveBtnText:{ color: '#fff', fontWeight: '800', fontSize: font.base },

  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40 },
  modalTitle:  { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: spacing.md, textAlign: 'center' },
  modalLabel:  { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.xs, marginTop: spacing.sm },
  modalInput:  { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: font.base, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 100 },
  modalBtn:    { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  modalBtnText:{ color: '#fff', fontWeight: '700', fontSize: font.base },
})
