import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, ActivityIndicator, Alert, Image,
} from 'react-native'
import { colors, spacing, radius, font } from '../../theme'
import { loginAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password')
      return
    }
    setLoading(true)
    try {
      const { data } = await loginAPI({ email, password })
      await login(data, data.token || '')
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.error || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Logo */}
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>تسجيل الدخول إلى حسابك</Text>

        {/* Email */}
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

        {/* Password */}
        <Text style={styles.label}>Password / كلمة المرور</Text>
        <View style={styles.inputBox}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Enter your password"
            placeholderTextColor={colors.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Forgot */}
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotRow}>
          <Text style={styles.forgotText}>Forgot Password? / نسيت كلمة المرور؟</Text>
        </TouchableOpacity>

        {/* Button */}
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Sign In / تسجيل الدخول</Text>
          }
        </TouchableOpacity>

        {/* Register */}
        <View style={styles.row}>
          <Text style={styles.mutedText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Sign Up / إنشاء حساب</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: spacing.md,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: font.xxl,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: font.sm,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    color: colors.text,
    fontSize: font.base,
    paddingVertical: 14,
    flex: 1,
  },
  eyeBtn: { padding: spacing.xs },
  eyeText: { fontSize: 16 },
  forgotRow: { alignItems: 'flex-end', marginTop: spacing.xs, marginBottom: spacing.md },
  forgotText: { color: colors.primary, fontSize: font.sm },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  mutedText: { color: colors.textMuted, fontSize: font.sm },
  linkText:  { color: colors.primary,   fontSize: font.sm, fontWeight: '700' },
})
