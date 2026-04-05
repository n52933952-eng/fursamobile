import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native'
import { launchCamera, launchImageLibrary } from 'react-native-image-picker'
import type { Asset } from 'react-native-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { updateProfileAPI, aiExtractSkillsAPI, getSupportAdminAPI, uploadProfileAvatarAPI, resolveServerAssetUrl } from '../../api'
import { colors, spacing, radius, font, screenHeaderPaddingTop } from '../../theme'
import ProjectCategoryPicker from '../../components/ProjectCategoryPicker'

const SKILLS_OPTIONS = [
  'React', 'React Native', 'Node.js', 'Python', 'UI/UX', 'Figma',
  'Graphic Design', 'Video Editing', 'Copywriting', 'SEO', 'Marketing',
  'Data Analysis', 'Translation', 'Excel', 'PHP', 'Laravel',
]

const roleColor: Record<string, string> = {
  client:     colors.success,
  freelancer: colors.info,
  admin:      colors.warning,
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { user, updateUser, logout } = useAuth()
  const navigation = useNavigation<any>()
  const { tr, isArabic } = useLang()
  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [bio, setBio]                 = useState(user?.bio || '')
  const [country, setCountry]         = useState((user as any)?.country || '')
  const [skills, setSkills]           = useState<string[]>(user?.skills || [])
  const [skillInput, setSkillInput]   = useState('')
  const [aiSkillLoading, setAiSkillLoading] = useState(false)
  const [interestedCategories, setInterestedCategories] = useState<string[]>(
    (user as any)?.interestedCategories || []
  )
  const [avatarUploading, setAvatarUploading] = useState(false)

  const canChangeAvatar = user?.role === 'client' || user?.role === 'freelancer'
  const avatarUri = resolveServerAssetUrl(user?.profilePic)

  useEffect(() => {
    setBio(user?.bio || '')
    setCountry((user as any)?.country || '')
    setSkills(user?.skills || [])
    setInterestedCategories((user as any)?.interestedCategories || [])
  }, [user])

  const toggleSkill = (s: string) => {
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const addCustomSkill = () => {
    const s = skillInput.trim()
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s])
    setSkillInput('')
  }

  const openSupportChat = async () => {
    try {
      const { data } = await getSupportAdminAPI()
      const admin = data as { _id: string; username?: string; role?: string }
      if (!admin?._id) {
        Alert.alert(isArabic ? 'تنبيه' : 'Notice', tr.supportUnavailable)
        return
      }
      navigation.navigate('MessageScreen', {
        recipientId:   admin._id,
        recipientName: admin.username || 'Support',
        recipientRole: admin.role || 'admin',
      })
    } catch {
      Alert.alert(isArabic ? 'خطأ' : 'Error', tr.supportUnavailable)
    }
  }

  const handleAiExtractSkills = async () => {
    if (!bio.trim()) {
      Alert.alert(isArabic ? 'تنبيه' : 'Tip', isArabic ? 'أدخل نبذتك أولاً ثم اضغط الزر' : 'Write your bio first, then tap this button')
      return
    }
    setAiSkillLoading(true)
    try {
      const { data } = await aiExtractSkillsAPI({ bio, portfolioText: bio })
      const extracted: string[] = data.skills || []
      const newOnes = extracted.filter((s: string) => !skills.includes(s))
      if (newOnes.length === 0) {
        Alert.alert(isArabic ? 'لا جديد' : 'Up to date', isArabic ? 'لديك بالفعل كل المهارات المقترحة!' : 'You already have all the suggested skills!')
      } else {
        Alert.alert(
          isArabic ? '🤖 مهارات مقترحة' : '🤖 Suggested Skills',
          `${isArabic ? 'تم اكتشاف:' : 'Detected:'} ${newOnes.join(', ')}\n\n${isArabic ? 'هل تريد إضافتها؟' : 'Add these to your profile?'}`,
          [
            { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
            { text: isArabic ? 'إضافة الكل' : 'Add All', onPress: () => setSkills(prev => [...new Set([...prev, ...newOnes])]) },
          ]
        )
      }
    } catch {
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل استخراج المهارات' : 'AI skill extraction failed')
    }
    setAiSkillLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await updateProfileAPI({ bio, country, skills, interestedCategories })
      updateUser(data)
      setEditing(false)
      Alert.alert('✅ Saved', 'Profile updated successfully.')
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update profile')
    }
    setSaving(false)
  }

  const dir = isArabic ? 'right' as const : 'left' as const

  const handleLogout = () => {
    Alert.alert(tr.logout, tr.logoutConfirm, [
      { text: tr.cancel, style: 'cancel' },
      { text: tr.logout, style: 'destructive', onPress: () => logout() },
    ])
  }

  const uploadPickedAsset = async (asset: Asset) => {
    if (!asset.uri) return
    setAvatarUploading(true)
    try {
      const form = new FormData()
      const name = asset.fileName || `avatar_${Date.now()}.jpg`
      let type = asset.type || 'image/jpeg'
      if (type === 'image/jpg') type = 'image/jpeg'
      form.append('avatar', { uri: asset.uri, name, type } as any)
      const { data } = await uploadProfileAvatarAPI(form)
      updateUser(data as any)
      Alert.alert('✅', tr.avatarUpdated)
    } catch (e: any) {
      const serverMsg =
        typeof e?.response?.data?.error === 'string' ? e.response.data.error : ''
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        serverMsg || e?.message || tr.avatarUploadFailed,
      )
    }
    setAvatarUploading(false)
  }

  const pickFromLibrary = () => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, maxWidth: 1600, maxHeight: 1600, quality: 0.88 },
      (res) => {
        if (res.didCancel || res.errorCode) return
        const a = res.assets?.[0]
        if (a) void uploadPickedAsset(a)
      },
    )
  }

  const pickFromCamera = () => {
    launchCamera(
      { mediaType: 'photo', cameraType: 'back', maxWidth: 1600, maxHeight: 1600, quality: 0.88 },
      (res) => {
        if (res.didCancel || res.errorCode) return
        const a = res.assets?.[0]
        if (a) void uploadPickedAsset(a)
      },
    )
  }

  const onAvatarPress = () => {
    if (!canChangeAvatar || avatarUploading) return
    Alert.alert(tr.changeProfilePhoto, tr.changeProfilePhotoHint, [
      { text: tr.chooseFromGallery, onPress: pickFromLibrary },
      { text: tr.takePhoto, onPress: pickFromCamera },
      { text: tr.cancel, style: 'cancel' },
    ])
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() || '??'
  const rc = roleColor[user?.role || 'client']

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: screenHeaderPaddingTop(insets.top), paddingBottom: spacing.sm }]}>
        <Text style={[styles.headerTitle, { textAlign: dir }]}>{tr.myProfile}</Text>
        <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
          {saving
            ? <ActivityIndicator color={colors.primary} />
            : <Text style={styles.editBtn}>{editing ? `${tr.saveChanges} ✓` : `${tr.editProfile} ✏️`}</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar & Info */}
        <View style={styles.avatarSection}>
          {canChangeAvatar ? (
            <TouchableOpacity
              style={styles.avatar}
              onPress={onAvatarPress}
              activeOpacity={0.85}
              disabled={avatarUploading}
              accessibilityRole="button"
              accessibilityLabel={tr.tapToChangePhoto}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              {avatarUploading && (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
          )}
          {canChangeAvatar && (
            <Text style={[styles.avatarHint, { textAlign: 'center' }]}>{tr.tapToChangePhoto}</Text>
          )}
          <Text style={styles.username}>{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {/* Debug (remove later): helps verify which Mongo _id the app is using */}
          <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, fontSize: 12 }}>
            _id: {user?._id}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: rc + '22', borderColor: rc + '55' }]}>
            <Text style={[styles.roleText, { color: rc }]}>
              {user?.role === 'freelancer' ? '🛠 Freelancer' : '💼 Client'}
            </Text>
          </View>
        </View>

        {/* Stats — freelancers can tap Rating to open evaluations screen */}
        <View style={styles.statsRow}>
          {user?.role === 'freelancer' ? (
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? 'عرض التقييمات والمراجعات' : 'View ratings and reviews'}
              onPress={() => navigation.navigate('ReviewsScreen', {
                freelancerId:   user?._id,
                freelancerName: user?.username,
              })}
            >
              <Text style={[styles.statValue, { color: colors.warning }]}>
                ★ {(user?.rating ?? 0).toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={styles.statTapHint}>{isArabic ? 'اضغط ←' : 'View →'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                ★ {(user?.rating ?? 0).toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          )}
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.info }]}>{user?.totalProjects ?? 0}</Text>
            <Text style={styles.statLabel}>Projects</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>${user?.totalEarned ?? 0}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>

        {/* Reviews / evaluations (freelancers: full breakdown; clients: if they ever have reviews) */}
        <TouchableOpacity
          style={styles.reviewsBtn}
          onPress={() => navigation.navigate('ReviewsScreen', {
            freelancerId:   user?._id,
            freelancerName: user?.username,
          })}
        >
          <Text style={styles.reviewsBtnText}>
            ⭐ {user?.role === 'freelancer'
              ? (isArabic ? 'تقييماتي وتعليقات العملاء' : 'My ratings & client reviews')
              : (isArabic ? 'التقييمات والمراجعات' : 'Ratings & Reviews')}
          </Text>
          <Text style={styles.reviewsBtnCount}>
            {(user as any)?.totalReviews ?? 0} {isArabic ? 'تقييم' : 'reviews'} →
          </Text>
        </TouchableOpacity>

        {user?.role !== 'admin' && (
          <TouchableOpacity
            style={styles.supportRow}
            onPress={openSupportChat}
            activeOpacity={0.75}
          >
            <Text style={styles.supportRowTitle}>💬 {tr.contactSupport}</Text>
            <Text style={[styles.supportRowSub, { textAlign: dir }]}>{tr.contactSupportSub}</Text>
            <Text style={[styles.supportRowGo, { textAlign: isArabic ? 'left' : 'right' }]}>{tr.messageSupportTeam} →</Text>
          </TouchableOpacity>
        )}

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio / نبذة عنك</Text>
          {editing ? (
            <TextInput
              style={[styles.input, styles.textarea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell clients about yourself..."
              placeholderTextColor={colors.textDim}
              multiline
              numberOfLines={4}
            />
          ) : (
            <Text style={styles.bioText}>{bio || 'No bio added yet.'}</Text>
          )}
        </View>

        {/* Country */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Country / الدولة</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="e.g. Saudi Arabia"
              placeholderTextColor={colors.textDim}
            />
          ) : (
            <Text style={styles.bioText}>{country || 'Not specified'}</Text>
          )}
        </View>

        {/* Project categories (feed for freelancers; posting prefs for clients) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isArabic ? 'فئات المشاريع' : 'Project categories'}
          </Text>
          <Text style={[styles.bioText, { marginBottom: spacing.sm }]}>
            {user?.role === 'freelancer'
              ? (isArabic
                ? 'المشاريع المفتوحة في الرئيسية تقتصر على هذه الفئات. اترك الكل فارغاً من التعديل لعرض كل الفئات.'
                : 'Open projects on Home are limited to these. Clear all chips and save to see every category.')
              : (isArabic
                ? 'نفس فئات نشر المشروع — يمكنك تعديل اهتماماتك هنا.'
                : 'Same as when posting a project — adjust your focus areas here.')}
          </Text>
          {editing ? (
            <ProjectCategoryPicker
              selected={interestedCategories}
              onChange={setInterestedCategories}
              isArabic={isArabic}
            />
          ) : interestedCategories.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {interestedCategories.map((c) => (
                <View key={c} style={styles.catPill}>
                  <Text style={styles.catPillText}>{c}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.bioText}>
              {user?.role === 'freelancer'
                ? (isArabic ? 'جميع فئات المشاريع (لا يوجد تصفية)' : 'All project categories (no filter)')
                : (isArabic ? 'لم تُحدد فئات بعد — عدّل الملف لإضافتها' : 'No categories yet — tap Edit to add')}
            </Text>
          )}
        </View>

        {/* Skills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills / المهارات</Text>

          {editing && (
            <>
              {/* AI Skill Extractor */}
              <TouchableOpacity
                style={[styles.aiSkillBtn, aiSkillLoading && { opacity: 0.6 }]}
                onPress={handleAiExtractSkills}
                disabled={aiSkillLoading}
              >
                {aiSkillLoading
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={styles.aiSkillBtnText}>
                      🤖 {isArabic ? 'استخرج مهاراتي من نبذتي بالذكاء الاصطناعي' : 'AI: Extract Skills from My Bio'}
                    </Text>
                }
              </TouchableOpacity>

              <View style={styles.skillInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder="Add custom skill..."
                  placeholderTextColor={colors.textDim}
                  onSubmitEditing={addCustomSkill}
                />
                <TouchableOpacity style={styles.addSkillBtn} onPress={addCustomSkill}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>＋</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.skillGrid}>
                {SKILLS_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.skillChip, skills.includes(s) && styles.skillChipActive]}
                    onPress={() => toggleSkill(s)}
                  >
                    <Text style={[styles.skillChipText, skills.includes(s) && { color: 'white' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.skillGrid}>
            {skills.length === 0 ? (
              <Text style={styles.bioText}>No skills added yet.</Text>
            ) : skills.map(s => (
              <View key={s} style={[styles.skillChip, styles.skillChipActive]}>
                <Text style={[styles.skillChipText, { color: 'white' }]}>{s}</Text>
                {editing && (
                  <TouchableOpacity onPress={() => setSkills(prev => prev.filter(x => x !== s))} style={{ marginLeft: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>🚪 {tr.logout}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.cardDark },
  headerTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  editBtn:     { color: colors.primary, fontWeight: '700', fontSize: font.base },

  avatarSection:{ alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.lg, backgroundColor: colors.cardDark },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs, overflow: 'hidden' },
  avatarImage:  { width: '100%', height: '100%' },
  avatarLoading:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  avatarHint:   { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  avatarText:   { color: 'white', fontSize: font.xxl, fontWeight: '900' },
  username:     { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  email:        { color: colors.textMuted, fontSize: font.sm, marginTop: 2, marginBottom: spacing.sm },
  roleBadge:    { paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  roleText:     { fontSize: font.sm, fontWeight: '700' },

  statsRow:   { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  statCard:   { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue:  { fontSize: font.lg, fontWeight: '800' },
  statLabel:  { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  statTapHint:{ color: colors.primary, fontSize: 10, fontWeight: '700', marginTop: 4 },

  reviewsBtn:      { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  reviewsBtnText:  { color: colors.text, fontWeight: '700', fontSize: font.base },
  reviewsBtnCount: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },

  supportRow:    { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14, borderWidth: 1, borderColor: colors.primary + '44' },
  supportRowTitle:{ color: colors.text, fontWeight: '800', fontSize: font.base, marginBottom: 4 },
  supportRowSub:  { color: colors.textMuted, fontSize: font.sm, marginBottom: 8 },
  supportRowGo:   { color: colors.primary, fontSize: font.sm, fontWeight: '700' },

  section:      { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: font.base, fontWeight: '700', marginBottom: spacing.sm },
  bioText:      { color: colors.textMuted, fontSize: font.base, lineHeight: 22 },

  input:        { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: font.base, paddingHorizontal: spacing.md, paddingVertical: 12 },
  textarea:     { height: 100, textAlignVertical: 'top' },

  aiSkillBtn:     { backgroundColor: colors.info, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center', marginBottom: spacing.sm },
  aiSkillBtnText: { color: 'white', fontWeight: '700', fontSize: font.sm },

  skillInputRow:{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  addSkillBtn:  { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  skillGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  skillChip:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  skillChipActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  skillChipText:{ color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },

  catPill:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary + '44' },
  catPillText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },

  logoutBtn:  { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.error + '44', borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: colors.error, fontSize: font.base, fontWeight: '700' },
})
