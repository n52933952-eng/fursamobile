import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import t, { Lang } from '../i18n/translations'

type LanguageContextType = {
  lang: Lang
  isArabic: boolean
  toggleLang: () => void
  tr: typeof t['en']     // translation object — same shape for both langs
}

const LanguageContext = createContext<LanguageContextType>({
  lang:      'en',
  isArabic:  false,
  toggleLang: () => {},
  tr:         t.en,
})

export const useLang = () => useContext(LanguageContext)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem('appLang').then(saved => {
      if (saved === 'ar' || saved === 'en') setLang(saved)
    })
  }, [])

  const toggleLang = async () => {
    const next: Lang = lang === 'en' ? 'ar' : 'en'
    setLang(next)
    await AsyncStorage.setItem('appLang', next)
  }

  const isArabic = lang === 'ar'
  const tr       = t[lang]

  return (
    <LanguageContext.Provider value={{ lang, isArabic, toggleLang, tr }}>
      {children}
    </LanguageContext.Provider>
  )
}
