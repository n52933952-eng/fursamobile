import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, ActivityIndicator, Alert, Image,
} from 'react-native'
import { colors, spacing, radius, font } from '../../theme'
import { loginAPI } from '../../api'
import { getFriendlyApiError } from '../../utils/networkErrors'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()
  const { tr, isArabic, lang, toggleLang } = useLang()

  const textDir = isArabic ? 'right' as const : 'left' as const

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(tr.email, isArabic ? 'يرجى إدخال البريد وكلمة المرور' : 'Please enter email and password')
      return
    }
    setLoading(true)
    try {
      const { data } = await loginAPI({ email, password })
      await login(data, data.token || '')
    } catch (err: any) {
      Alert.alert(
        isArabic ? 'فشل تسجيل الدخول' : 'Login Failed',
        getFriendlyApiError(err, isArabic, isArabic ? 'بيانات غير صحيحة' : 'Invalid credentials')
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

      {/* Logo */}
      <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />

      {/* Card */}
      <View style={styles.card}>
        <Text style={[styles.title, { textAlign: 'center' }]}>{tr.welcomeBack}</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>{tr.loginSubtitle}</Text>

        <Text style={[styles.label, { textAlign: textDir }]}>{tr.email}</Text>
        <View style={styles.inputBox}>
          <TextInput
            style={[styles.input, { textAlign: textDir }]}
            placeholder={tr.enterEmail}
            placeholderTextColor={colors.textDim}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Text style={[styles.label, { textAlign: textDir }]}>{tr.password}</Text>
        <View style={styles.inputBox}>
          <TextInput
            style={[styles.input, { flex: 1, textAlign: textDir }]}
            placeholder={tr.enterPassword}
            placeholderTextColor={colors.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          style={[styles.forgotRow, isArabic && { alignItems: 'flex-start' }]}
        >
          <Text style={styles.forgotText}>{tr.forgotPassword}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{tr.signIn}</Text>}
        </TouchableOpacity>

        <View style={styles.row}>
          <Text style={styles.mutedText}>{tr.noAccount} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>{tr.signup}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  langBtn:     { position: 'absolute', top: 52, right: spacing.lg, backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },
  logo:    { width: 160, height: 160, marginBottom: spacing.md },
  card:    { width: '100%', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title:   { color: colors.text, fontSize: font.xxl, fontWeight: '800' },
  subtitle:{ color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.lg, marginTop: spacing.xs },
  label:   { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.xs, marginTop: spacing.sm },
  inputBox:{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  input:   { color: colors.text, fontSize: font.base, paddingVertical: 14, flex: 1 },
  eyeBtn:  { padding: spacing.xs },
  eyeText: { fontSize: 16 },
  forgotRow: { alignItems: 'flex-end', marginTop: spacing.xs, marginBottom: spacing.md },
  forgotText:{ color: colors.primary, fontSize: font.sm },
  btn:     { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.xs },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
  row:     { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  mutedText:{ color: colors.textMuted, fontSize: font.sm },
  linkText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
})
