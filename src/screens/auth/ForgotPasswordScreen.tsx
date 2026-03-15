import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius, font } from '../../theme'
import api from '../../api'

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Please enter your email'); return }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>نسيت كلمة المرور؟{'\n'}Enter your email to receive a reset link</Text>

      {sent ? (
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✉️</Text>
          <Text style={styles.successTitle}>Email Sent!</Text>
          <Text style={styles.successText}>
            Check your inbox for the password reset link.{'\n'}تحقق من بريدك الإلكتروني
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Email / البريد الإلكتروني</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.textDim}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Send Reset Link / إرسال رابط</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flexGrow: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
  back:         { marginBottom: spacing.lg },
  backText:     { color: colors.primary, fontSize: font.base },
  title:        { color: colors.text, fontSize: font.xxl, fontWeight: '800', textAlign: 'center' },
  subtitle:     { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', marginBottom: spacing.xl, marginTop: spacing.xs, lineHeight: 22 },
  card:         { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  label:        { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.xs },
  inputBox:     { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  input:        { color: colors.text, fontSize: font.base, paddingVertical: 14 },
  btn:          { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: font.base },
  successBox:   { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  successIcon:  { fontSize: 56, marginBottom: spacing.md },
  successTitle: { color: colors.success, fontSize: font.xl, fontWeight: '800', marginBottom: spacing.sm },
  successText:  { color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
})
