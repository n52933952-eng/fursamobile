import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLang } from '../../context/LanguageContext'
import { createProjectAPI, aiDescriptionAPI, aiPricingAPI } from '../../api'
import { colors, spacing, radius, font, screenHeaderPaddingTop } from '../../theme'
import { PROJECT_CATEGORIES } from '../../constants/projectCategories'

const CATEGORIES = [...PROJECT_CATEGORIES]
const SKILLS_LIST = ['React', 'Node.js', 'Python', 'UI/UX', 'Figma', 'Photoshop', 'SEO', 'WordPress', 'Laravel', 'Mobile', 'Android', 'iOS']

// ─── AI Price Suggestion Banner ───────────────────────────────────────────────
function PriceSuggestion({ suggestion, onUse, onDismiss, isArabic }: {
  suggestion: { min: number; max: number; recommended: number; reason: string }
  onUse: (n: number) => void; onDismiss: () => void; isArabic: boolean
}) {
  return (
    <View style={pStyles.box}>
      <View style={pStyles.header}>
        <Text style={pStyles.title}>🤖 {isArabic ? 'اقتراح ذكي للسعر' : 'AI Smart Pricing'}</Text>
        <TouchableOpacity onPress={onDismiss}><Text style={{ color: colors.textDim, fontSize: 18 }}>✕</Text></TouchableOpacity>
      </View>
      <View style={pStyles.rangeRow}>
        <View style={pStyles.rangeItem}>
          <Text style={pStyles.rangeLabel}>{isArabic ? 'الحد الأدنى' : 'Min'}</Text>
          <Text style={[pStyles.rangeVal, { color: colors.info }]}>${suggestion.min}</Text>
        </View>
        <View style={pStyles.rangeMid}>
          <Text style={pStyles.rangeLabel}>{isArabic ? 'الموصى به' : 'Recommended'}</Text>
          <Text style={[pStyles.rangeVal, { color: colors.success, fontSize: font.xl }]}>${suggestion.recommended}</Text>
        </View>
        <View style={pStyles.rangeItem}>
          <Text style={pStyles.rangeLabel}>{isArabic ? 'الحد الأقصى' : 'Max'}</Text>
          <Text style={[pStyles.rangeVal, { color: colors.warning }]}>${suggestion.max}</Text>
        </View>
      </View>
      {suggestion.reason && (
        <Text style={pStyles.reason}>💡 {suggestion.reason}</Text>
      )}
      <TouchableOpacity style={pStyles.useBtn} onPress={() => onUse(suggestion.recommended)}>
        <Text style={pStyles.useBtnText}>{isArabic ? `استخدم $${suggestion.recommended}` : `Use $${suggestion.recommended}`}</Text>
      </TouchableOpacity>
    </View>
  )
}

const pStyles = StyleSheet.create({
  box:       { backgroundColor: '#0F2840', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: colors.info + '55' },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:     { color: colors.info, fontWeight: '800', fontSize: font.base },
  rangeRow:  { flexDirection: 'row', marginBottom: 10 },
  rangeItem: { flex: 1, alignItems: 'center' },
  rangeMid:  { flex: 1.3, alignItems: 'center', backgroundColor: colors.success + '15', borderRadius: radius.md, paddingVertical: 6 },
  rangeLabel:{ color: colors.textMuted, fontSize: 11, marginBottom: 3 },
  rangeVal:  { fontWeight: '800', fontSize: font.lg },
  reason:    { color: colors.textMuted, fontSize: font.sm, lineHeight: 18, marginBottom: 10 },
  useBtn:    { backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  useBtnText:{ color: 'white', fontWeight: '700', fontSize: font.base },
})

// ─── AI Description Modal ─────────────────────────────────────────────────────
function AiDescModal({ visible, result, onUse, onClose, isArabic }: {
  visible: boolean; result: string; onUse: (text: string) => void; onClose: () => void; isArabic: boolean
}) {
  // Parse EN/AR from the result text
  const enMatch = result.match(/EN:\s*([\s\S]*?)(?:AR:|$)/i)
  const arMatch = result.match(/AR:\s*([\s\S]*?)$/i)
  const enText = enMatch?.[1]?.trim() || result
  const arText = arMatch?.[1]?.trim() || ''

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40 }}>
          <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: 4 }}>
            ✨ {isArabic ? 'وصف مقترح من الذكاء الاصطناعي' : 'AI-Generated Description'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sm, marginBottom: 14 }}>
            {isArabic ? 'اختر اللغة التي تريد استخدامها' : 'Choose which version to use'}
          </Text>
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {enText ? (
              <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.info, fontWeight: '700', marginBottom: 6 }}>🇬🇧 English</Text>
                <Text style={{ color: colors.text, lineHeight: 22 }}>{enText}</Text>
                <TouchableOpacity
                  style={{ marginTop: 10, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => { onUse(enText); onClose() }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>{isArabic ? 'استخدم الإنجليزية' : 'Use English Version'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {arText ? (
              <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.warning, fontWeight: '700', marginBottom: 6 }}>🇸🇦 العربية</Text>
                <Text style={{ color: colors.text, lineHeight: 22, textAlign: 'right' }}>{arText}</Text>
                <TouchableOpacity
                  style={{ marginTop: 10, backgroundColor: colors.warning, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => { onUse(arText); onClose() }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>استخدم العربية</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
          <TouchableOpacity
            style={{ marginTop: 14, backgroundColor: colors.cardDark, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' }}
            onPress={onClose}
          >
            <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{isArabic ? 'إلغاء' : 'Cancel'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PostProjectScreen() {
  const insets = useSafeAreaInsets()
  const { isArabic, lang, toggleLang } = useLang()
  const dir = isArabic ? 'right' as const : 'left' as const

  const [title, setTitle]           = useState('')
  const [description, setDesc]      = useState('')
  const [category, setCategory]     = useState('')
  const [budgetType, setBudgetType] = useState<'fixed' | 'hourly'>('fixed')
  const [budget, setBudget]         = useState('')
  const [daysToDeadline, setDays]   = useState('14')
  const [skills, setSkills]         = useState<string[]>([])
  const [customSkill, setCustomSkill] = useState('')
  const [saving, setSaving]         = useState(false)

  // AI states
  const [aiDescLoading, setAiDescLoading]   = useState(false)
  const [aiPriceLoading, setAiPriceLoading] = useState(false)
  const [aiDescResult, setAiDescResult]     = useState('')
  const [showDescModal, setShowDescModal]   = useState(false)
  const [priceSuggestion, setPriceSuggestion] = useState<any>(null)

  const toggleSkill = (s: string) =>
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const addCustomSkill = () => {
    const s = customSkill.trim()
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s])
    setCustomSkill('')
  }

  // ── AI: Generate description ──────────────────────────────────────────────
  const handleAiDescription = async () => {
    if (!title.trim() && !category) {
      Alert.alert(isArabic ? 'تنبيه' : 'Tip', isArabic ? 'أدخل عنواناً أو اختر فئة أولاً' : 'Enter a title or select a category first')
      return
    }
    setAiDescLoading(true)
    try {
      const { data } = await aiDescriptionAPI({ keywords: title || category, category: category || 'General' })
      setAiDescResult(data.description || '')
      setShowDescModal(true)
    } catch (err: any) {
      const serverMsg = err?.response?.data?.error
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        typeof serverMsg === 'string' && serverMsg.length > 0
          ? serverMsg
          : (isArabic ? 'فشل توليد الوصف. تحقق من الاتصال وGROQ_API_KEY على السيرفر.' : 'AI description failed. Check server GROQ_API_KEY and try again.'),
      )
    }
    setAiDescLoading(false)
  }

  // ── AI: Suggest price ─────────────────────────────────────────────────────
  const handleAiPricing = async () => {
    if (!category) {
      Alert.alert(isArabic ? 'تنبيه' : 'Tip', isArabic ? 'اختر الفئة أولاً' : 'Please select a category first')
      return
    }
    setAiPriceLoading(true)
    try {
      const { data } = await aiPricingAPI({
        category,
        description: description || title || 'General project',
        skills,
      })
      setPriceSuggestion(data)
    } catch (err: any) {
      const serverMsg = err?.response?.data?.error
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        typeof serverMsg === 'string' && serverMsg.length > 0
          ? serverMsg
          : (isArabic ? 'فشل اقتراح السعر' : 'Smart pricing failed. Please try again.'),
      )
    }
    setAiPriceLoading(false)
  }

  const handleSubmit = async () => {
    if (!title.trim())       { Alert.alert('Missing', isArabic ? 'أدخل عنوان المشروع' : 'Please enter a project title.'); return }
    if (!description.trim()) { Alert.alert('Missing', isArabic ? 'أضف وصفاً للمشروع' : 'Please add a description.'); return }
    if (!category)           { Alert.alert('Missing', isArabic ? 'اختر الفئة' : 'Please select a category.'); return }
    if (!budget || parseFloat(budget) <= 0) { Alert.alert('Missing', isArabic ? 'أدخل ميزانية صحيحة' : 'Please enter a valid budget.'); return }

    setSaving(true)
    try {
      const deadline = new Date(Date.now() + parseInt(daysToDeadline, 10) * 86400000).toISOString()
      await createProjectAPI({ title, description, category, budgetType, budget: parseFloat(budget), deadline, skills })
      Alert.alert('✅', isArabic ? 'تم نشر المشروع! يمكن للمستقلين الآن التقدم.' : 'Project posted! Freelancers can now apply.', [
        { text: 'OK', onPress: () => {
          setTitle(''); setDesc(''); setCategory(''); setBudget(''); setSkills([]); setPriceSuggestion(null)
        }},
      ])
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to post project')
    }
    setSaving(false)
  }

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: screenHeaderPaddingTop(insets.top), paddingBottom: spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { textAlign: dir }]}>
            {isArabic ? '➕ أضف مشروعاً' : '➕ Post a Project'}
          </Text>
          <Text style={[styles.headerSub, { textAlign: dir }]}>
            {isArabic ? 'ابحث عن المستقل المناسب لعملك' : 'Find the right freelancer for your job'}
          </Text>
        </View>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>

          {/* ── AI Banner ── */}
          <View style={styles.aiBanner}>
            <Text style={{ fontSize: 24 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiBannerTitle}>{isArabic ? 'مدعوم بالذكاء الاصطناعي' : 'AI-Powered Assistant'}</Text>
              <Text style={styles.aiBannerSub}>{isArabic ? 'اكتب العنوان أولاً ثم اضغط على أزرار الذكاء الاصطناعي' : 'Fill the title first, then use AI buttons below'}</Text>
            </View>
          </View>

          {/* ── Title ── */}
          <Text style={[styles.label, { textAlign: dir }]}>
            {isArabic ? 'عنوان المشروع *' : 'Project Title *'}
          </Text>
          <TextInput
            style={[styles.input, { textAlign: dir }]}
            placeholder={isArabic ? 'مثال: تصميم واجهة تطبيق جوال' : 'e.g. Design a mobile app UI'}
            placeholderTextColor={colors.textDim}
            value={title}
            onChangeText={setTitle}
          />

          {/* ── Description + AI ── */}
          <View style={[styles.labelRow, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.label, { marginTop: 0, flex: 1, textAlign: dir }]}>
              {isArabic ? 'الوصف *' : 'Description *'}
            </Text>
            <TouchableOpacity
              style={[styles.aiBtn, aiDescLoading && { opacity: 0.6 }]}
              onPress={handleAiDescription}
              disabled={aiDescLoading}
            >
              {aiDescLoading
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.aiBtnText}>✨ {isArabic ? 'اكتب بالذكاء الاصطناعي' : 'AI Write'}</Text>
              }
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, styles.textarea, { textAlign: dir }]}
            placeholder={isArabic ? 'صف المشروع بالتفصيل...' : 'Describe the project in detail...'}
            placeholderTextColor={colors.textDim}
            value={description}
            onChangeText={setDesc}
            multiline
            numberOfLines={5}
          />

          {/* ── Category ── */}
          <Text style={[styles.label, { textAlign: dir }]}>
            {isArabic ? 'الفئة *' : 'Category *'}
          </Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && { color: 'white' }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Budget Type ── */}
          <Text style={[styles.label, { textAlign: dir }]}>
            {isArabic ? 'نوع الميزانية' : 'Budget Type'}
          </Text>
          <View style={styles.toggleRow}>
            {(['fixed', 'hourly'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.toggleBtn, budgetType === t && styles.toggleBtnActive, { flex: 1 }]}
                onPress={() => setBudgetType(t)}
              >
                <Text style={[styles.toggleText, budgetType === t && { color: 'white' }]}>
                  {t === 'fixed'
                    ? (isArabic ? '📌 سعر ثابت' : '📌 Fixed Price')
                    : (isArabic ? '⏱ بالساعة' : '⏱ Hourly Rate')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Budget + AI Pricing ── */}
          <View style={[styles.labelRow, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.label, { marginTop: 0, flex: 1, textAlign: dir }]}>
              {isArabic ? 'الميزانية ($) *' : 'Budget ($) *'}
            </Text>
            <TouchableOpacity
              style={[styles.aiBtn, { backgroundColor: colors.info }, aiPriceLoading && { opacity: 0.6 }]}
              onPress={handleAiPricing}
              disabled={aiPriceLoading}
            >
              {aiPriceLoading
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.aiBtnText}>💡 {isArabic ? 'اقتراح ذكي' : 'Smart Price'}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* AI Price suggestion */}
          {priceSuggestion && (
            <PriceSuggestion
              suggestion={priceSuggestion}
              onUse={(n) => { setBudget(String(n)); setPriceSuggestion(null) }}
              onDismiss={() => setPriceSuggestion(null)}
              isArabic={isArabic}
            />
          )}

          <TextInput
            style={[styles.input, { textAlign: dir }]}
            placeholder={budgetType === 'fixed'
              ? (isArabic ? 'مثال: 500' : 'e.g. 500')
              : (isArabic ? 'مثال: 25 في الساعة' : 'e.g. 25 per hour')}
            placeholderTextColor={colors.textDim}
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
          />

          {/* ── Deadline ── */}
          <Text style={[styles.label, { textAlign: dir }]}>
            {isArabic ? 'الموعد النهائي' : 'Deadline'}
          </Text>
          <View style={styles.chipRow}>
            {[7, 14, 30, 60].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, daysToDeadline === String(d) && styles.chipActive]}
                onPress={() => setDays(String(d))}
              >
                <Text style={[styles.chipText, daysToDeadline === String(d) && { color: 'white' }]}>
                  {d} {isArabic ? 'يوم' : 'days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: 8, textAlign: dir }]}
            placeholder={isArabic ? 'أو أدخل عدد الأيام...' : 'Or enter custom days...'}
            placeholderTextColor={colors.textDim}
            value={daysToDeadline}
            onChangeText={setDays}
            keyboardType="numeric"
          />

          {/* ── Skills ── */}
          <Text style={[styles.label, { textAlign: dir }]}>
            {isArabic ? 'المهارات المطلوبة' : 'Required Skills'}
          </Text>
          <View style={styles.skillInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: dir }]}
              placeholder={isArabic ? 'أضف مهارة مخصصة...' : 'Add custom skill...'}
              placeholderTextColor={colors.textDim}
              value={customSkill}
              onChangeText={setCustomSkill}
              onSubmitEditing={addCustomSkill}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustomSkill}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: font.lg }}>＋</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {SKILLS_LIST.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, skills.includes(s) && styles.chipActive]}
                onPress={() => toggleSkill(s)}
              >
                <Text style={[styles.chipText, skills.includes(s) && { color: 'white' }]}>{s}</Text>
              </TouchableOpacity>
            ))}
            {skills.filter(s => !SKILLS_LIST.includes(s)).map(s => (
              <TouchableOpacity key={s} style={[styles.chip, styles.chipActive]} onPress={() => toggleSkill(s)}>
                <Text style={[styles.chipText, { color: 'white' }]}>{s} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Summary preview ── */}
          {(title || budget) && (
            <View style={styles.previewCard}>
              <Text style={[styles.previewTitle, { textAlign: dir }]}>📋 {isArabic ? 'ملخص' : 'Summary'}</Text>
              {title     && <Text style={[styles.previewRow, { textAlign: dir }]}>{isArabic ? 'العنوان' : 'Title'}: {title}</Text>}
              {category  && <Text style={[styles.previewRow, { textAlign: dir }]}>{isArabic ? 'الفئة' : 'Category'}: {category}</Text>}
              {budget    && <Text style={[styles.previewRow, { textAlign: dir }]}>{isArabic ? 'الميزانية' : 'Budget'}: ${budget} ({budgetType})</Text>}
              <Text style={[styles.previewRow, { textAlign: dir }]}>{isArabic ? 'الموعد' : 'Deadline'}: {isArabic ? `خلال ${daysToDeadline} يوم` : `in ${daysToDeadline} days`}</Text>
              {skills.length > 0 && <Text style={[styles.previewRow, { textAlign: dir }]}>{isArabic ? 'المهارات' : 'Skills'}: {skills.join(', ')}</Text>}
            </View>
          )}

          {/* ── Submit ── */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={saving}>
            {saving
              ? <ActivityIndicator color="white" />
              : <Text style={styles.submitText}>🚀 {isArabic ? 'نشر المشروع' : 'Post Project'}</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* AI Description Modal */}
      <AiDescModal
        visible={showDescModal}
        result={aiDescResult}
        onUse={(text) => setDesc(text)}
        onClose={() => setShowDescModal(false)}
        isArabic={isArabic}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.cardDark, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  headerSub:   { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  langBtn:     { backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },

  // AI banner
  aiBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '15', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: 12, borderWidth: 1, borderColor: colors.primary + '40' },
  aiBannerTitle:{ color: colors.primary, fontWeight: '800', fontSize: font.base },
  aiBannerSub:  { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },

  form:        { padding: spacing.md },
  labelRow:    { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: 6, gap: 8 },
  label:       { color: colors.textMuted, fontSize: font.sm, fontWeight: '700', marginBottom: 6, marginTop: spacing.md, letterSpacing: 0.5 },
  input:       { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: font.base, paddingHorizontal: spacing.md, paddingVertical: 13 },
  textarea:    { height: 120, textAlignVertical: 'top' },

  aiBtn:       { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  aiBtnText:   { color: 'white', fontWeight: '700', fontSize: font.sm },

  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:    { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },

  toggleRow:       { flexDirection: 'row', gap: 10 },
  toggleBtn:       { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText:      { color: colors.textMuted, fontWeight: '700', fontSize: font.base },

  skillInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addBtn:        { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },

  previewCard:  { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  previewTitle: { color: colors.text, fontWeight: '700', marginBottom: 8 },
  previewRow:   { color: colors.textMuted, fontSize: font.sm, lineHeight: 22 },

  submitBtn:   { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg },
  submitText:  { color: 'white', fontWeight: '800', fontSize: font.lg },
})
