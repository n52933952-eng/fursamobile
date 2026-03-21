import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, Modal,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useLang } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { searchFreelancersAPI, sendMessageAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

// ─── Skill chips ──────────────────────────────────────────────────────────────
const SKILLS = ['All', 'React', 'Node.js', 'Design', 'Python', 'Flutter', 'Writing', 'SEO', 'Video', 'Marketing']

function StarRow({ rating }: { rating: number }) {
  const r = Math.round(rating * 2) / 2
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: 11, color: i <= r ? '#FBBF24' : colors.textDim }}>★</Text>
      ))}
    </View>
  )
}

// ─── Freelancer Card ──────────────────────────────────────────────────────────
function FreelancerCard({ freelancer, onMessage, onProfile, onViewReviews, isArabic }: {
  freelancer: any
  onMessage: () => void
  onProfile: () => void
  onViewReviews: () => void
  isArabic: boolean
}) {
  const dir = isArabic ? 'right' as const : 'left' as const
  const initial = freelancer.username?.[0]?.toUpperCase() || '?'
  const avatarColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
  const color = avatarColors[freelancer.username?.charCodeAt(0) % avatarColors.length] || colors.primary
  const rev = freelancer.totalReviews ?? 0
  const proj = freelancer.totalProjects ?? 0

  return (
    <TouchableOpacity style={styles.card} onPress={onProfile} activeOpacity={0.85}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.cardName, { textAlign: dir }]}>{freelancer.username}</Text>
          <Text style={[styles.cardBio, { textAlign: dir }]} numberOfLines={1}>
            {freelancer.bio || (isArabic ? 'مستقل محترف' : 'Professional Freelancer')}
          </Text>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onViewReviews}
            accessibilityRole="button"
            accessibilityLabel={isArabic ? 'عرض التقييمات والمراجعات' : 'View ratings and reviews'}
          >
            <View style={[styles.ratingRow, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
              <StarRow rating={freelancer.rating ?? 0} />
              <Text style={styles.ratingText}>{(freelancer.rating ?? 0).toFixed(1)}</Text>
              <Text style={styles.projectsText}>
                · {rev} {isArabic ? 'تقييم' : 'reviews'}
              </Text>
              <Text style={styles.projectsText}>
                · {proj} {isArabic ? 'مشروع' : 'projects'}
              </Text>
            </View>
            <Text style={styles.ratingTapHint}>
              {isArabic ? 'اضغط لعرض التقييمات التفصيلية' : 'Tap for full ratings & reviews'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Country badge */}
        {freelancer.country && (
          <View style={styles.countryBadge}>
            <Text style={styles.countryText}>{freelancer.country}</Text>
          </View>
        )}
      </View>

      {/* Skills */}
      {freelancer.skills?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={styles.skillsRow}>
            {freelancer.skills.slice(0, 5).map((s: string, i: number) => (
              <View key={i} style={styles.skillChip}>
                <Text style={styles.skillText}>{s}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.msgBtn]} onPress={onMessage}>
          <Text style={styles.msgBtnText}>💬 {isArabic ? 'مراسلة' : 'Message'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.profileBtn]} onPress={onProfile}>
          <Text style={styles.profileBtnText}>👤 {isArabic ? 'الملف الشخصي' : 'View Profile'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function ProfileModal({ freelancer, visible, onClose, onMessage, onViewReviews, isArabic }: {
  freelancer: any; visible: boolean; onClose: () => void; onMessage: () => void; onViewReviews: () => void; isArabic: boolean
}) {
  if (!freelancer) return null
  const dir = isArabic ? 'right' as const : 'left' as const
  const initial = freelancer.username?.[0]?.toUpperCase() || '?'
  const avatarColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
  const color = avatarColors[freelancer.username?.charCodeAt(0) % avatarColors.length] || colors.primary

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40, maxHeight: '80%' }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Avatar + name */}
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={[styles.avatar, { width: 72, height: 72, borderRadius: 36, backgroundColor: color, marginBottom: 10 }]}>
                <Text style={[styles.avatarText, { fontSize: 30 }]}>{initial}</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '800' }}>{freelancer.username}</Text>
              {freelancer.country && <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2 }}>📍 {freelancer.country}</Text>}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => { onClose(); onViewReviews() }}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, flexWrap: 'wrap' }}
              >
                <StarRow rating={freelancer.rating ?? 0} />
                <Text style={{ color: colors.warning, fontWeight: '700' }}>{(freelancer.rating ?? 0).toFixed(1)}</Text>
                <Text style={{ color: colors.textDim }}>
                  · {freelancer.totalReviews ?? 0} {isArabic ? 'تقييم' : 'reviews'}
                </Text>
                <Text style={{ color: colors.textDim }}>
                  · {freelancer.totalProjects ?? 0} {isArabic ? 'مشروع' : 'projects'}
                </Text>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                  {isArabic ? ' ← عرض' : 'View →'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bio */}
            {freelancer.bio && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ color: colors.textMuted, fontSize: font.sm, fontWeight: '700', marginBottom: 4, textAlign: dir }}>{isArabic ? 'نبذة' : 'About'}</Text>
                <Text style={{ color: colors.text, fontSize: font.base, lineHeight: 22, textAlign: dir }}>{freelancer.bio}</Text>
              </View>
            )}

            {/* Skills */}
            {freelancer.skills?.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ color: colors.textMuted, fontSize: font.sm, fontWeight: '700', marginBottom: 8, textAlign: dir }}>{isArabic ? 'المهارات' : 'Skills'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {freelancer.skills.map((s: string, i: number) => (
                    <View key={i} style={styles.skillChip}>
                      <Text style={styles.skillText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Buttons */}
            <View style={{ gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.actionBtn, styles.msgBtn]} onPress={() => { onClose(); onMessage() }}>
                <Text style={styles.msgBtnText}>💬 {isArabic ? 'ابدأ محادثة' : 'Start Chat'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F59E0B18', borderWidth: 1, borderColor: '#F59E0B55' }]}
                onPress={() => { onClose(); onViewReviews() }}
              >
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: font.sm }}>
                  ⭐ {isArabic ? 'عرض التقييمات' : 'View Ratings & Reviews'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.profileBtn]} onPress={onClose}>
                <Text style={styles.profileBtnText}>{isArabic ? 'إغلاق' : 'Close'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FreelancerSearchScreen() {
  const navigation = useNavigation<any>()
  const { user }   = useAuth()
  const { isArabic, lang, toggleLang } = useLang()
  const dir = isArabic ? 'right' as const : 'left' as const

  const [query, setQuery]           = useState('')
  const [skill, setSkill]           = useState('All')
  const [results, setResults]       = useState<any[]>([])
  const [loading, setLoading]       = useState(false)
  const [searched, setSearched]     = useState(false)
  const [profileOf, setProfileOf]   = useState<any>(null)

  const doSearch = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    try {
      const params: any = {}
      if (query.trim()) params.query = query.trim()
      if (skill !== 'All') params.skill = skill
      const { data } = await searchFreelancersAPI(params)
      setResults(Array.isArray(data) ? data : [])
    } catch {
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل البحث' : 'Search failed')
    }
    setLoading(false)
  }, [query, skill, isArabic])

  // Auto-search when skill changes
  const handleSkill = (s: string) => {
    setSkill(s)
    setSearched(false)
    setResults([])
  }

  const handleMessage = (freelancer: any) => {
    navigation.navigate('MessageScreen', {
      recipientId:   freelancer._id,
      recipientName: freelancer.username,
    })
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.cardDark} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.primary, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isArabic ? '🔍 ابحث عن مستقلين' : '🔍 Find Freelancers'}
        </Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
          <Text style={{ color: colors.textMuted, marginHorizontal: 10 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { textAlign: dir }]}
            placeholder={isArabic ? 'اسم المستقل أو التخصص...' : 'Search by name or skill...'}
            placeholderTextColor={colors.textDim}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={doSearch}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false) }} style={{ padding: 6 }}>
              <Text style={{ color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={doSearch}>
          <Text style={styles.searchBtnText}>{isArabic ? 'بحث' : 'Search'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Skill filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, paddingRight: 20 }}
      >
        {SKILLS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, skill === s && styles.chipActive]}
            onPress={() => handleSkill(s)}
          >
            <Text style={[styles.chipText, skill === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Results ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>{isArabic ? 'جاري البحث...' : 'Searching...'}</Text>
          </View>
        ) : !searched ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>🧑‍💻</Text>
            <Text style={[styles.emptyTitle, { textAlign: 'center' }]}>
              {isArabic ? 'ابحث عن أفضل المستقلين' : 'Discover Top Freelancers'}
            </Text>
            <Text style={[styles.emptySubtitle, { textAlign: 'center' }]}>
              {isArabic
                ? 'اكتب اسماً أو اختر تخصصاً ثم اضغط بحث'
                : 'Type a name or pick a skill, then tap Search'}
            </Text>
            {/* Tips */}
            <View style={styles.tipsBox}>
              {[
                isArabic ? '⭐ تصفية حسب التقييم' : '⭐ Filter by rating',
                isArabic ? '🛠 اختر التخصص المطلوب' : '🛠 Browse by skill',
                isArabic ? '💬 ابدأ محادثة مباشرة' : '💬 Start a chat directly',
                isArabic ? '📋 راجع ملف المستقل' : '📋 View full profile',
              ].map((tip, i) => (
                <Text key={i} style={styles.tipText}>{tip}</Text>
              ))}
            </View>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
            <Text style={[styles.emptyTitle, { textAlign: 'center' }]}>
              {isArabic ? 'لم يُعثر على مستقلين' : 'No freelancers found'}
            </Text>
            <Text style={[styles.emptySubtitle, { textAlign: 'center' }]}>
              {isArabic ? 'جرب كلمة بحث مختلفة' : 'Try a different search term'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.resultCount, { textAlign: dir }]}>
              {isArabic ? `${results.length} نتيجة` : `${results.length} result${results.length !== 1 ? 's' : ''} found`}
            </Text>
            {results.map(f => (
              <FreelancerCard
                key={f._id}
                freelancer={f}
                isArabic={isArabic}
                onMessage={() => handleMessage(f)}
                onProfile={() => setProfileOf(f)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <ProfileModal
        freelancer={profileOf}
        visible={!!profileOf}
        onClose={() => setProfileOf(null)}
        onMessage={() => profileOf && handleMessage(profileOf)}
        onViewReviews={() => profileOf && navigation.navigate('ReviewsScreen', {
          freelancerId:   profileOf._id,
          freelancerName: profileOf.username,
        })}
        isArabic={isArabic}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 14, paddingHorizontal: spacing.md, backgroundColor: colors.cardDark, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  headerTitle: { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: '800' },
  langBtn:     { backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },

  searchWrap: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.cardDark, gap: 10 },
  searchBox:  { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, height: 44 },
  searchInput:{ flex: 1, color: colors.text, fontSize: font.base, paddingHorizontal: 4 },
  searchBtn:  { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 18, justifyContent: 'center', height: 44 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },

  chipScroll: { maxHeight: 46, backgroundColor: colors.cardDark, paddingVertical: 6 },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:   { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  resultCount: { color: colors.textMuted, fontSize: font.sm, marginBottom: 12 },

  card:       { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start' },
  avatar:     { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: font.xl },
  cardName:   { color: colors.text, fontWeight: '800', fontSize: font.base },
  cardBio:    { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  ratingRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4, flexWrap: 'wrap' },
  ratingText:     { color: colors.warning, fontSize: font.sm, fontWeight: '700', marginLeft: 2 },
  projectsText:   { color: colors.textDim, fontSize: font.sm },
  ratingTapHint:  { color: colors.primary, fontSize: 10, fontWeight: '600', marginTop: 4 },
  countryBadge: { backgroundColor: colors.cardDark, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  countryText: { color: colors.textMuted, fontSize: 11 },

  skillsRow:  { flexDirection: 'row', gap: 6 },
  skillChip:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary + '40' },
  skillText:  { color: colors.primary, fontSize: 11, fontWeight: '600' },

  cardActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn:   { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  msgBtn:      { backgroundColor: colors.primary },
  msgBtnText:  { color: '#fff', fontWeight: '700', fontSize: font.sm },
  profileBtn:  { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  profileBtnText: { color: colors.text, fontWeight: '700', fontSize: font.sm },

  center:       { alignItems: 'center', paddingVertical: 40 },
  loadingText:  { color: colors.textMuted, marginTop: 12, fontSize: font.base },
  emptyTitle:   { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: 8 },
  emptySubtitle:{ color: colors.textMuted, fontSize: font.base, maxWidth: 280 },

  tipsBox:  { marginTop: 24, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, width: '100%', gap: 10, borderWidth: 1, borderColor: colors.border },
  tipText:  { color: colors.textMuted, fontSize: font.base },
})
