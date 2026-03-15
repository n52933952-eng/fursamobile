import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius, font } from '../../theme'
import { registerAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'

const roles = [
  { id: 'client',     label: 'Client',     labelAr: 'عميل',     desc: 'Post projects & hire freelancers',    icon: '💼' },
  { id: 'freelancer', label: 'Freelancer', labelAr: 'مستقل',    desc: 'Find work & offer your services',     icon: '🚀' },
]

export default function RegisterScreen({ navigation }: any) {
  const [form, setForm]         = useState({ username: '', email: '', password: '', role: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleRegister = async () => {
    if (!form.username || !form.email || !form.password || !form.role) {
      Alert.alert('Error', 'Please fill all fields and select a role')
      return
    }
    setLoading(true)
    try {
      const { data } = await registerAPI(form)
      await login(data, data.token || '')
    } catch (err: any) {
      Alert.alert('Registration Failed', err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>إنشاء حساب جديد في فرصة</Text>

      {/* Role Selection */}
      <Text style={styles.label}>I am a... / أنا...</Text>
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
            <Text style={[styles.roleLabelAr, form.role === r.id && { color: colors.primary }]}>
              {r.labelAr}
            </Text>
            <Text style={styles.roleDesc}>{r.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fields */}
      <View style={styles.card}>
        <Text style={styles.label}>Username / اسم المستخدم</Text>
        <View style={styles.inputBox}>
          <TextInput style={styles.input} placeholder="Enter username"
            placeholderTextColor={colors.textDim} value={form.username}
            onChangeText={v => set('username', v)} autoCapitalize="none" />
        </View>

        <Text style={styles.label}>Email / البريد الإلكتروني</Text>
        <View style={styles.inputBox}>
          <TextInput style={styles.input} placeholder="Enter email"
            placeholderTextColor={colors.textDim} value={form.email}
            onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <Text style={styles.label}>Password / كلمة المرور</Text>
        <View style={styles.inputBox}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Create password"
            placeholderTextColor={colors.textDim} value={form.password}
            onChangeText={v => set('password', v)} secureTextEntry={!showPass} />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: spacing.xs }}>
            <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Create Account / إنشاء الحساب</Text>
          }
        </TouchableOpacity>

        <View style={styles.row}>
          <Text style={styles.mutedText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Sign In / تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, backgroundColor: colors.bg,
    padding: spacing.lg, paddingTop: spacing.xl,
  },
  title:    { color: colors.text, fontSize: font.xxl, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', marginBottom: spacing.lg, marginTop: spacing.xs },
  label:    { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.xs, marginTop: spacing.sm },
  roleRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,107,53,0.08)' },
  roleIcon:       { fontSize: 28, marginBottom: spacing.xs },
  roleLabel:      { color: colors.textMuted, fontWeight: '700', fontSize: font.base },
  roleLabelActive:{ color: colors.primary },
  roleLabelAr:    { color: colors.textDim, fontSize: font.sm, marginBottom: spacing.xs },
  roleDesc:       { color: colors.textDim, fontSize: 11, textAlign: 'center' },
  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
  input:   { color: colors.text, fontSize: font.base, paddingVertical: 14, flex: 1 },
  btn:     { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
  row:     { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  mutedText: { color: colors.textMuted, fontSize: font.sm },
  linkText:  { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
})
