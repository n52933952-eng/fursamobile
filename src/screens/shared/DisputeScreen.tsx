import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useLang } from '../../context/LanguageContext'
import { createDisputeAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

const REASONS_EN = [
  'Work not delivered',
  'Quality does not match description',
  'Freelancer stopped responding',
  'Client not releasing payment',
  'Project scope changed without agreement',
  'Deliverable not as agreed',
  'Other',
]

const REASONS_AR = [
  'العمل لم يُسلَّم',
  'الجودة لا تتطابق مع الوصف',
  'المستقل توقف عن الرد',
  'العميل لا يُحرر الدفعة',
  'نطاق المشروع تغيّر دون اتفاق',
  'المُسلَّم لا يتوافق مع ما تم الاتفاق عليه',
  'أخرى',
]

export default function DisputeScreen() {
  const navigation = useNavigation<any>()
  const route      = useRoute<any>()
  const { projectId, projectTitle } = route.params || {}
  const { isArabic, toggleLang, lang } = useLang()

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [details, setDetails]         = useState('')
  const [loading, setLoading]         = useState(false)

  const reasons = isArabic ? REASONS_AR : REASONS_EN
  const canSubmit = selectedIdx !== null
  const dir = isArabic ? 'right' as const : 'left' as const

  const handleSubmit = async () => {
    if (selectedIdx === null) return
    // Always submit English reason to the backend
    const reasonEn = REASONS_EN[selectedIdx]
    const fullReason = details.trim() ? `${reasonEn}: ${details.trim()}` : reasonEn

    Alert.alert(
      isArabic ? 'رفع نزاع؟' : 'File Dispute?',
      isArabic
        ? 'سيتم إخطار فريق الإدارة لمراجعة قضيتك. سيُصنَّف المشروع كـ"متنازع عليه".'
        : 'This will notify the admin team to review your case. The project will be marked as disputed.',
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isArabic ? 'تقديم' : 'Submit', style: 'destructive', onPress: async () => {
          setLoading(true)
          try {
            await createDisputeAPI({ projectId, reason: fullReason })
            Alert.alert(
              isArabic ? '⚠️ تم رفع النزاع' : '⚠️ Dispute Filed',
              isArabic
                ? 'سيراجع فريقنا قضيتك ويتواصل معك خلال 24 ساعة.'
                : 'Our team will review your case and get back to you within 24 hours.',
              [{ text: isArabic ? 'موافق' : 'OK', onPress: () => navigation.goBack() }]
            )
          } catch (e: any) {
            Alert.alert(
              isArabic ? 'خطأ' : 'Error',
              e?.response?.data?.error || 'Failed to file dispute'
            )
          }
          setLoading(false)
        }},
      ]
    )
  }

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          ⚠️ {isArabic ? 'رفع نزاع' : 'File a Dispute'}
        </Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Warning banner ── */}
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.warningTitle, { textAlign: dir }]}>
              {isArabic ? 'هذا إجراء خطير' : 'This is a serious action'}
            </Text>
            <Text style={[styles.warningText, { textAlign: dir }]}>
              {isArabic
                ? 'رفع النزاع سيوقف المشروع ويُخطر فريق الإدارة. يرجى محاولة حل المشكلة مباشرةً أولاً.'
                : 'Filing a dispute will pause the project and notify our admin team. Please try resolving the issue directly first.'}
            </Text>
          </View>
        </View>

        {/* ── Project box ── */}
        {projectTitle && (
          <View style={styles.projectBox}>
            <Text style={[styles.fieldLabel, { textAlign: dir }]}>
              {isArabic ? 'المشروع' : 'Project'}
            </Text>
            <Text style={[styles.projectName, { textAlign: dir }]}>{projectTitle}</Text>
          </View>
        )}

        {/* ── Reason selection ── */}
        <Text style={[styles.fieldLabel, { textAlign: dir }]}>
          {isArabic ? 'اختر سبباً *' : 'Select a Reason *'}
        </Text>
        <View style={styles.reasonsList}>
          {reasons.map((r, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.reasonRow, selectedIdx === i && styles.reasonRowSelected,
                isArabic && { flexDirection: 'row-reverse' }]}
              onPress={() => setSelectedIdx(i)}
            >
              <View style={[styles.radio, selectedIdx === i && styles.radioSelected]}>
                {selectedIdx === i && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.reasonText, selectedIdx === i && styles.reasonTextSelected, { textAlign: dir }]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Extra details ── */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.md, textAlign: dir }]}>
          {isArabic ? 'تفاصيل إضافية (اختياري)' : 'Additional Details (optional)'}
        </Text>
        <TextInput
          style={[styles.textarea, { textAlign: dir }]}
          placeholder={isArabic ? 'أضف سياقاً إضافياً حول المشكلة...' : 'Provide more context about the issue...'}
          placeholderTextColor={colors.textDim}
          multiline
          value={details}
          onChangeText={setDetails}
          textAlignVertical="top"
        />

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.submitBtnText}>
                ⚠️ {isArabic ? 'تقديم النزاع' : 'Submit Dispute'}
              </Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.cardDark },
  backBtn:     { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  backArrow:   { color: colors.text, fontSize: font.lg, lineHeight: 22 },
  headerTitle: { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center' },
  langBtn:     { backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },

  content: { padding: spacing.md },

  warningBanner: {
    flexDirection: 'row', gap: spacing.sm,
    backgroundColor: colors.error + '15',
    borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.error + '30',
    marginBottom: spacing.md,
  },
  warningIcon:  { fontSize: 24 },
  warningTitle: { color: colors.error, fontWeight: '700', fontSize: font.base, marginBottom: 4 },
  warningText:  { color: colors.textMuted, fontSize: font.sm, lineHeight: 18 },

  projectBox:  { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  projectName: { color: colors.text, fontWeight: '700', fontSize: font.base },
  fieldLabel:  { color: colors.textMuted, fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },

  reasonsList:       { gap: spacing.xs },
  reasonRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  reasonRowSelected: { borderColor: colors.error + '60', backgroundColor: colors.error + '10' },
  radio:             { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioSelected:     { borderColor: colors.error },
  radioInner:        { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  reasonText:        { color: colors.textMuted, fontSize: font.base, flex: 1 },
  reasonTextSelected:{ color: colors.text, fontWeight: '600' },

  textarea: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.base, borderWidth: 1, borderColor: colors.border, height: 120 },

  submitBtn:         { backgroundColor: colors.error, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: '#fff', fontWeight: '800', fontSize: font.base },
})
