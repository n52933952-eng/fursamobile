import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius, font } from '../../theme'
import { registerAPI } from '../../api'
import { useLang } from '../../context/LanguageContext'
import ProjectCategoryPicker from '../../components/ProjectCategoryPicker'

export default function RegisterScreen({ navigation }: any) {
  const [form, setForm]         = useState({
    username: '', email: '', password: '', role: '', interestedCategories: [] as string[],
  })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const { tr, isArabic, lang, toggleLang } = useLang()

  const textDir = isArabic ? 'right' as const : 'left' as const
  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const roles = [
    { id: 'client',     label: tr.client,     desc: tr.clientDesc,     icon: '💼' },
    { id: 'freelancer', label: tr.freelancer,  desc: tr.freelancerDesc, icon: '🚀' },
  ]

  const handleRegister = async () => {
    if (!form.username || !form.email || !form.password || !form.role) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'يرجى ملء جميع الحقول واختيار دور' : 'Please fill all fields and select a role'
      )
      return
    }
    if (form.role === 'freelancer' && form.interestedCategories.length === 0) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'اختر فئة مشروع واحدة على الأقل (مثل التصميم أو البرمجة)' : 'Pick at least one category (e.g. Design, Development)'
      )
      return
    }
    setLoading(true)
    try {
      const { data } = await registerAPI(form)
      // Go to OTP screen, pass user data & token to use after verification
      navigation.navigate('OTP', {
        email:    form.email,
        userData: data,
        token:    data.token || '',
      })
    } catch (err: any) {
      Alert.alert(
        isArabic ? 'فشل التسجيل' : 'Registration Failed',
        err.response?.data?.error || (isArabic ? 'حدث خطأ ما' : 'Something went wrong')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Lang toggle */}
      <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
        <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { textAlign: 'center' }]}>{tr.createAccount}</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>{tr.joinFursa}</Text>

      {/* Role Selection */}
      <Text style={[styles.label, { textAlign: textDir }]}>{tr.iAmA}</Text>
      <View style={styles.roleRow}>
        {roles.map(r => (
          <TouchableOpacity
            key={r.id}
            style={[styles.roleCard, form.role === r.id && styles.roleCardActive]}
            onPress={() => set('role', r.id)}
          >
            <Text style={styles.roleIcon}>{r.icon}</Text>
            <Text style={[styles.roleLabel, form.role === r.id && styles.roleLabelActive]}>
              {r.label}
            </Text>
            <Text style={[styles.roleDesc, { textAlign: 'center' }]}>{r.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Project categories (same list as posting a project) */}
      {form.role === 'freelancer' ? (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[styles.label, { textAlign: textDir }]}>
            {isArabic ? 'مجالات اهتمامك' : 'Your project categories'}
          </Text>
          <Text style={[styles.hint, { textAlign: textDir }]}>
            {form.role === 'freelancer'
              ? (isArabic
                ? 'سترى في الرئيسية المشاريع المفتوحة في هذه الفئات فقط. يمكنك تعديلها لاحقاً من الملف الشخصي.'
                : 'Your home feed shows open projects in these categories. You can change this anytime in Profile.')
              : (isArabic
                ? 'يساعدنا على تخصيص تجربتك عند نشر المشاريع. يمكنك تعديلها لاحقاً من الملف الشخصي.'
                : 'Helps personalize your experience when you post projects. Edit anytime in Profile.')}
          </Text>
          <ProjectCategoryPicker
            selected={form.interestedCategories}
            onChange={(interestedCategories) => setForm((f) => ({ ...f, interestedCategories }))}
            isArabic={isArabic}
          />
        </View>
      ) : null}

      {/* Fields */}
      <View style={styles.card}>
        <Text style={[styles.label, { textAlign: textDir }]}>{tr.username}</Text>
        <View style={styles.inputBox}>
          <TextInput
            style={[styles.input, { textAlign: textDir }]}
            placeholder={tr.enterUsername}
            placeholderTextColor={colors.textDim}
            value={form.username}
            onChangeText={v => set('username', v)}
            autoCapitalize="none"
          />
        </View>

        <Text style={[styles.label, { textAlign: textDir }]}>{tr.email}</Text>
        <View style={styles.inputBox}>
          <TextInput
            style={[styles.input, { textAlign: textDir }]}
            placeholder={tr.enterEmail}
            placeholderTextColor={colors.textDim}
            value={form.email}
            onChangeText={v => set('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Text style={[styles.label, { textAlign: textDir }]}>{tr.password}</Text>
        <View style={styles.inputBox}>
          <TextInput
            style={[styles.input, { flex: 1, textAlign: textDir }]}
            placeholder={tr.createPassword}
            placeholderTextColor={colors.textDim}
            value={form.password}
            onChangeText={v => set('password', v)}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: spacing.xs }}>
            <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{tr.createAccount}</Text>}
        </TouchableOpacity>

        <View style={styles.row}>
          <Text style={styles.mutedText}>{tr.alreadyAccount} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>{tr.signIn}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
  langBtn:      { alignSelf: 'flex-end', backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  langBtnText:  { color: colors.primary, fontSize: font.sm, fontWeight: '800' },
  title:    { color: colors.text, fontSize: font.xxl, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.lg, marginTop: spacing.xs },
  label:    { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.xs, marginTop: spacing.sm },
  roleRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  roleCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,107,53,0.08)' },
  roleIcon:       { fontSize: 28, marginBottom: spacing.xs },
  roleLabel:      { color: colors.textMuted, fontWeight: '700', fontSize: font.base, marginBottom: 4 },
  roleLabelActive:{ color: colors.primary },
  roleDesc:       { color: colors.textDim, fontSize: 11 },
  hint:           { color: colors.textDim, fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  input:   { color: colors.text, fontSize: font.base, paddingVertical: 14, flex: 1 },
  btn:     { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
  row:     { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  mutedText: { color: colors.textMuted, fontSize: font.sm },
  linkText:  { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
})
