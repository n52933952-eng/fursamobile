import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { PROJECT_CATEGORIES } from '../constants/projectCategories'
import { colors, spacing, radius, font } from '../theme'

type Props = {
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  isArabic: boolean
}

export default function ProjectCategoryPicker({ selected, onChange, disabled, isArabic }: Props) {
  const dir = isArabic ? 'right' as const : 'left' as const
  const toggle = (cat: string) => {
    if (disabled) return
    const on = selected.includes(cat)
    onChange(on ? selected.filter((c) => c !== cat) : [...selected, cat])
  }

  return (
    <View style={[styles.wrap, { flexDirection: isArabic ? 'row-reverse' : 'row' }]}>
      {PROJECT_CATEGORIES.map((cat) => {
        const active = selected.includes(cat)
        return (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggle(cat)}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive, { textAlign: dir }]}>
              {cat}
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
