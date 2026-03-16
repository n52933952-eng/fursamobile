import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Alert, Keyboard,
} from 'react-native'
import { colors, spacing, radius, font } from '../../theme'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'

const CORRECT_CODE = '1234'
const RESEND_SECONDS = 59

export default function OTPScreen({ navigation, route }: any) {
  const { email = '', userData, token = '' } = route.params || {}
  const { login }                             = useAuth()
  const { tr, isArabic, lang, toggleLang }    = useLang()

  const [digits, setDigits]           = useState(['', '', '', ''])
  const [loading, setLoading]         = useState(false)
  const [timer, setTimer]             = useState(RESEND_SECONDS)
  const [canResend, setCanResend]     = useState(false)
  const inputRefs                     = useRef<(TextInput | null)[]>([null, null, null, null])

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) { setCanResend(true); return }
    const id = setInterval(() => setTimer(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  // ── Focus first input on mount ─────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 400)
  }, [])

  // ── Handle digit input ─────────────────────────────────────────────────────
  const handleChange = (val: string, idx: number) => {
    // Only allow single digit
    const cleaned = val.replace(/[^0-9]/g, '').slice(-1)
    const next = [...digits]
    next[idx] = cleaned
    setDigits(next)

    if (cleaned && idx < 3) {
      inputRefs.current[idx + 1]?.focus()
    }
    if (!cleaned && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  // ── Verify ─────────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = digits.join('')
    if (code.length < 4) {
      Alert.alert('', isArabic ? 'يرجى إدخال الرمز كاملاً' : 'Please enter the full code')
      return
    }
    if (code !== CORRECT_CODE) {
      Alert.alert('', tr.invalidCode)
      setDigits(['', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
      return
    }
    setLoading(true)
    try {
      await login(userData, token)
    } catch {
      Alert.alert('', isArabic ? 'حدث خطأ، حاول مجدداً' : 'Something went wrong, please try again')
    }
    setLoading(false)
  }

  const handleResend = () => {
    if (!canResend) return
    setDigits(['', '', '', ''])
    setTimer(RESEND_SECONDS)
    setCanResend(false)
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }

  const padTime = (n: number) => String(n).padStart(2, '0')
  const filled  = digits.every(d => d !== '')

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Lang toggle */}
      <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
        <Text style={styles.langBtnText}>{lang === 'en' ? 'AR' : 'EN'}</Text>
      </TouchableOpacity>

      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Text style={{ fontSize: 36 }}>✉️</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{tr.verifyCode}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{tr.enterOtp}</Text>
        <Text style={styles.emailText}>
          {tr.codeSentTo}{'\n'}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>

        {/* OTP inputs */}
        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={ref => { inputRefs.current[i] = ref }}
              style={[styles.otpBox, d && styles.otpBoxFilled]}
              value={d}
              onChangeText={val => handleChange(val, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              caretHidden
              textAlign="center"
            />
          ))}
        </View>

        {/* Resend */}
        <View style={styles.resendRow}>
          <TouchableOpacity onPress={handleResend} disabled={!canResend}>
            <Text style={[styles.resendText, !canResend && styles.resendDisabled]}>
              {tr.didntReceive}
            </Text>
          </TouchableOpacity>
          {!canResend && (
            <Text style={styles.timerText}> 00:{padTime(timer)}</Text>
          )}
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.btn, (!filled || loading) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={!filled || loading}
        >
          <Text style={styles.btnText}>{tr.verify}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  langBtn:     { position: 'absolute', top: 52, right: spacing.lg, backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, zIndex: 10 },
  langBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '800' },

  backBtn:   { position: 'absolute', top: 52, left: spacing.lg, zIndex: 10, padding: 4 },
  backArrow: { color: colors.text, fontSize: font.xl, fontWeight: '300' },

  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingBottom: 40 },

  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },

  title:    { color: colors.text, fontSize: font.xxl, fontWeight: '800', textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', marginBottom: spacing.xs },
  emailText:      { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
  emailHighlight: { color: colors.primary, fontWeight: '700' },

  otpRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  otpBox: {
    width: 60, height: 68, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border,
    color: colors.text, fontSize: 28, fontWeight: '800', textAlign: 'center',
  },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: 'rgba(255,107,53,0.08)' },

  resendRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  resendText:    { color: colors.primary, fontSize: font.sm, fontWeight: '600', textDecorationLine: 'underline' },
  resendDisabled:{ color: colors.textDim, textDecorationLine: 'none' },
  timerText:     { color: colors.textMuted, fontSize: font.sm },

  btn:        { width: '100%', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:{ opacity: 0.4 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: font.base },
})
