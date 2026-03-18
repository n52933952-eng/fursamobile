import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Animated, Image, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native'
import { colors, spacing, radius, font } from '../../theme'
import { useLang } from '../../context/LanguageContext'
import { GoogleSignin } from '../config/firebase'
import auth from '@react-native-firebase/auth'
import { googleSignInAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function WelcomeScreen({ navigation }: any) {
  const { isArabic, lang, toggleLang } = useLang()
  const { login } = useAuth()
  const [googleLoading, setGoogleLoading] = useState(false)

  // Entrance animations
  const fadeIn  = useRef(new Animated.Value(0)).current
  const slideUp = useRef(new Animated.Value(50)).current
  const illustrationScale = useRef(new Animated.Value(0.88)).current

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true)
      await GoogleSignin.hasPlayServices()
      const result = await GoogleSignin.signIn()

      if (result.type === 'cancelled' || !result.data) {
        setGoogleLoading(false)
        return
      }

      const idToken = result.data.idToken
      if (!idToken) throw new Error('No idToken received')

      const googleCredential = auth.GoogleAuthProvider.credential(idToken)
      await auth().signInWithCredential(googleCredential)
      const firebaseUser = auth().currentUser
      if (!firebaseUser) throw new Error('Firebase user not found')

      const payload = {
        email:      firebaseUser.email,
        name:       firebaseUser.displayName || result.data.user?.name,
        googleId:   firebaseUser.uid,
        profilePic: firebaseUser.photoURL || result.data.user?.photo || '',
      }

      // Try signing in without role — backend returns error if new user
      try {
        const { data } = await googleSignInAPI(payload)
        await AsyncStorage.setItem('token', data.token)
        login(data)
      } catch (e: any) {
        if (e?.response?.data?.error === 'role_required') {
          // New user — ask for role
          navigation.navigate('RoleSelect', { googlePayload: payload })
        } else {
          throw e
        }
      }
    } catch (error: any) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert(
          isArabic ? 'خطأ في تسجيل الدخول' : 'Sign-In Error',
          error.message || 'Google Sign-In failed'
        )
      }
    }
    setGoogleLoading(false)
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1,  duration: 900,  delay: 150, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0,  friction: 8,    delay: 200, useNativeDriver: true }),
      Animated.spring(illustrationScale, { toValue: 1, friction: 7, delay: 100, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Language toggle ────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.langToggle} onPress={toggleLang}>
          <Text style={[styles.langOption, lang === 'en' && styles.langOptionActive]}>English</Text>
          <Text style={styles.langDivider}> | </Text>
          <Text style={[styles.langOption, lang === 'ar' && styles.langOptionActive]}>العربية</Text>
        </TouchableOpacity>
      </View>

      {/* ── Illustration ───────────────────────────────────────────────── */}
      <Animated.View style={[
        styles.illustrationBox,
        { opacity: fadeIn, transform: [{ scale: illustrationScale }] }
      ]}>
        <Image
          source={require('../../assets/fursa_illustration.png')}
          style={styles.illustration}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Text + Buttons ─────────────────────────────────────────────── */}
      <Animated.View style={[styles.bottom, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

        {isArabic ? (
          <>
            <Text style={[styles.taglineMain, { textAlign: 'center' }]}>
              {'اعثر على أفضل المستقلين\nوالمشاريع المدهشة هنا.'}
            </Text>
            <Text style={styles.taglineSub}>Find top freelancers & amazing projects.</Text>
          </>
        ) : (
          <>
            <Text style={[styles.taglineMain, { textAlign: 'center' }]}>
              {'Find top freelancers &\namazing projects here.'}
            </Text>
            <Text style={styles.taglineSub}>اعثر على أفضل المستقلين والمشاريع المدهشة هنا.</Text>
          </>
        )}

        {/* Google Sign-In */}
        <TouchableOpacity
          style={styles.btnGoogle}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          activeOpacity={0.85}
        >
          {googleLoading ? (
            <ActivityIndicator color="#333" size="small" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.btnGoogleText}>
                {isArabic ? 'متابعة مع Google' : 'Continue with Google'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{isArabic ? 'أو' : 'or'}</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.btnPrimaryText}>
            {isArabic ? 'ابدأ الآن / Get Started' : 'Get Started / ابدأ الآن'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnSecondaryText}>
            {isArabic ? 'تسجيل الدخول / Sign In' : 'Sign In / تسجيل الدخول'}
          </Text>
        </TouchableOpacity>

      </Animated.View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  topBar:           { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  langToggle:       { flexDirection: 'row', alignItems: 'center' },
  langOption:       { color: colors.textMuted, fontSize: font.sm },
  langOptionActive: { color: colors.text, fontWeight: '700' },
  langDivider:      { color: colors.textDim, fontSize: font.sm },

  illustrationBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  illustration:    { width: '100%', height: '100%' },

  bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },

  taglineMain: { color: colors.text, fontSize: font.xxl, fontWeight: '900', lineHeight: 34, marginBottom: 8, textAlign: 'center' },
  taglineSub:  { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', lineHeight: 18, marginBottom: spacing.xl },

  // Google button
  btnGoogle:     { width: '100%', flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: '#E0E0E0', gap: 10 },
  googleIcon:    { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  btnGoogleText: { color: '#333', fontWeight: '700', fontSize: font.base },

  // Divider
  dividerRow:  { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textDim, fontSize: font.sm },

  btnPrimary:     { width: '100%', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginBottom: spacing.sm },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: font.base },

  btnSecondary:     { width: '100%', borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  btnSecondaryText: { color: colors.text, fontWeight: '700', fontSize: font.base },
})
