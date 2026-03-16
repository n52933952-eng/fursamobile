import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Animated, Image, SafeAreaView,
} from 'react-native'
import { colors, spacing, radius, font } from '../../theme'
import { useLang } from '../../context/LanguageContext'

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function WelcomeScreen({ navigation }: any) {
  const { isArabic, lang, toggleLang } = useLang()

  // Entrance animations
  const fadeIn  = useRef(new Animated.Value(0)).current
  const slideUp = useRef(new Animated.Value(50)).current
  const illustrationScale = useRef(new Animated.Value(0.88)).current

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

  btnPrimary:     { width: '100%', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginBottom: spacing.sm },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: font.base },

  btnSecondary:     { width: '100%', borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  btnSecondaryText: { color: colors.text, fontWeight: '700', fontSize: font.base },
})
