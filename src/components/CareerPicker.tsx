// CareerPicker — single-select chips (Full Stack, IT, Writing, …)
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { FREELANCER_CAREERS } from '../constants/freelancerCareers'
import { colors, spacing, radius, font } from '../theme'

type Props = {
  value: string
  onChange: (career: string) => void
  disabled?: boolean
  isArabic: boolean
}

export default function CareerPicker({ value, onChange, disabled, isArabic }: Props) {
  const dir = isArabic ? 'right' as const : 'left' as const

  return (
    <View style={[styles.wrap, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
      {FREELANCER_CAREERS.map((career) => {
        const active = value === career
        return (
          <TouchableOpacity
            key={career}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(career)}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive, { textAlign: dir }]}>
              {career}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:     { flexWrap: 'wrap', gap: 8 },
  chip:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
})
