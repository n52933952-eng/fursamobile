import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { googleSignInAPI } from '../../api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, spacing, radius, font } from '../../theme'
import ProjectCategoryPicker from '../../components/ProjectCategoryPicker'

export default function RoleSelectScreen() {
  const navigation         = useNavigation<any>()
  const route              = useRoute<any>()
  const { login }          = useAuth()
  const { isArabic }       = useLang()
  const [role, setRole]    = useState<'client' | 'freelancer' | null>(null)
  const [interestedCategories, setInterestedCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Passed from WelcomeScreen / LoginScreen after Google sign-in
  const { googlePayload } = route.params || {}

  const handleConfirm = async () => {
    if (!role) return
    if (role === 'freelancer' && interestedCategories.length === 0) {
      Alert.alert(
        isArabic ? 'تنبيه' : 'Almost there',
        isArabic ? 'اختر فئة واحدة على الأقل أدناه' : 'Pick at least one project category below'
      )
      return
    }
    setLoading(true)
    try {
      await AsyncStorage.multiRemove(['user', 'token'])
      const { data } = await googleSignInAPI({ ...googlePayload, role, interestedCategories })
      const { token, ...userData } = data
      await login(userData, token)
    } catch (e: any) {
      const err = e?.response?.data?.error
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        err === 'categories_required'
          ? (isArabic ? 'اختر فئة واحدة على الأقل' : 'Select at least one category')
          : (err || 'Failed to complete sign-in')
      )
    }
    setLoading(false)
  }

  const dir = isArabic ? 'right' as const : 'left' as const

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>فُرصة</Text>
        <Text style={[styles.title, { textAlign: 'center' }]}>
          {isArabic ? 'مرحباً بك! 👋' : 'Welcome! 👋'}
        </Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          {isArabic
            ? 'آخر خطوة — أخبرنا، كيف ستستخدم التطبيق؟'
            : 'One last step — how will you use Fursa?'}
        </Text>
      </View>

      {/* Role options */}
      <View style={styles.options}>
        <TouchableOpacity
          style={[styles.optionCard, role === 'client' && styles.optionCardActive]}
          onPress={() => setRole('client')}
          activeOpacity={0.85}
        >
          <Text style={styles.optionIcon}>💼</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, { textAlign: dir }]}>
              {isArabic ? 'أنا عميل' : 'I am a Client'}
            </Text>
            <Text style={[styles.optionDesc, { textAlign: dir }]}>
              {isArabic
                ? 'أنشر مشاريع، أوظّف مستقلين، وأُنجز أعمالي'
                : 'Post projects, hire freelancers, get work done'}
            </Text>
          </View>
          <View style={[styles.radioCircle, role === 'client' && styles.radioCircleActive]}>
            {role === 'client' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, role === 'freelancer' && styles.optionCardActive]}
          onPress={() => setRole('freelancer')}
          activeOpacity={0.85}
        >
          <Text style={styles.optionIcon}>🚀</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, { textAlign: dir }]}>
              {isArabic ? 'أنا مستقل' : 'I am a Freelancer'}
            </Text>
            <Text style={[styles.optionDesc, { textAlign: dir }]}>
              {isArabic
                ? 'أعرض خدماتي، أقدّم على مشاريع، وأربح'
                : 'Offer services, bid on projects, earn money'}
            </Text>
          </View>
          <View style={[styles.radioCircle, role === 'freelancer' && styles.radioCircleActive]}>
            {role === 'freelancer' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>
      </View>

      {role === 'freelancer' ? (
        <View style={styles.catBlock}>
          <Text style={[styles.catTitle, { textAlign: dir }]}>
            {isArabic ? 'مجالات المشاريع' : 'Project categories'}
          </Text>
          <Text style={[styles.catHint, { textAlign: dir }]}>
            {role === 'freelancer'
              ? (isArabic
                ? 'ستظهر لك في الرئيسية مشاريع هذه الفئات فقط.'
                : 'Your home feed will list open jobs in these categories.')
              : (isArabic
                ? 'نفس الفئات عند نشر مشروع. يمكنك تغييرها لاحقاً من الملف الشخصي.'
                : 'Same categories as when posting a project. Edit anytime in Profile.')}
          </Text>
          <ProjectCategoryPicker
            selected={interestedCategories}
            onChange={setInterestedCategories}
            isArabic={isArabic}
          />
        </View>
      ) : null}

      {/* Confirm button */}
      <TouchableOpacity
        style={[
          styles.confirmBtn,
          (!role || (role === 'freelancer' && interestedCategories.length === 0)) && styles.confirmBtnDisabled,
        ]}
        onPress={handleConfirm}
        disabled={!role || (role === 'freelancer' && interestedCategories.length === 0) || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.confirmBtnText}>
              {isArabic ? 'ابدأ الآن →' : "Let's Go →"}
            </Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 40 },

  header: { alignItems: 'center', marginBottom: spacing.xl },
  logo:   { fontSize: 42, fontWeight: '900', color: colors.primary, marginBottom: 16 },
  title:  { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: font.base, lineHeight: 22 },

  options: { gap: 14, marginBottom: spacing.xl },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 2, borderColor: colors.border,
  },
  optionCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '0D' },
  optionIcon:  { fontSize: 32 },
  optionTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: 4 },
  optionDesc:  { color: colors.textMuted, fontSize: font.sm, lineHeight: 18 },

  radioCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleActive: { borderColor: colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },

  confirmBtn: {
    backgroundColor: colors.primary, borderRadius: radius.xl,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: font.lg },

  catBlock:  { marginBottom: spacing.lg },
  catTitle:  { color: colors.text, fontSize: font.base, fontWeight: '800', marginBottom: 6 },
  catHint:   { color: colors.textMuted, fontSize: font.sm, lineHeight: 20, marginBottom: spacing.sm },
})
