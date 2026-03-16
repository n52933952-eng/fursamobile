import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { createDisputeAPI } from '../../api'
import { colors, spacing, radius, font } from '../../theme'

const REASONS = [
  'Work not delivered',
  'Quality does not match description',
  'Freelancer stopped responding',
  'Client not releasing payment',
  'Project scope changed without agreement',
  'Deliverable not as agreed',
  'Other',
]

export default function DisputeScreen() {
  const navigation = useNavigation<any>()
  const route      = useRoute<any>()
  const { projectId, projectTitle } = route.params || {}

  const [selectedReason, setSelectedReason] = useState('')
  const [details, setDetails]               = useState('')
  const [loading, setLoading]               = useState(false)

  const canSubmit = selectedReason.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    const fullReason = details.trim()
      ? `${selectedReason}: ${details.trim()}`
      : selectedReason

    Alert.alert(
      'File Dispute?',
      'This will notify the admin team to review your case. The project will be marked as disputed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', style: 'destructive', onPress: async () => {
          setLoading(true)
          try {
            await createDisputeAPI({ projectId, reason: fullReason })
            Alert.alert(
              '⚠️ Dispute Filed',
              'Our team will review your case and get back to you within 24 hours.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            )
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'Failed to file dispute')
          }
          setLoading(false)
        }},
      ]
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>File a Dispute</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>This is a serious action</Text>
            <Text style={styles.warningText}>
              Filing a dispute will pause the project and notify our admin team. Please try resolving the issue directly first.
            </Text>
          </View>
        </View>

        {/* Project */}
        {projectTitle && (
          <View style={styles.projectBox}>
            <Text style={styles.fieldLabel}>Project</Text>
            <Text style={styles.projectName}>{projectTitle}</Text>
          </View>
        )}

        {/* Reason selection */}
        <Text style={styles.fieldLabel}>Select a Reason *</Text>
        <View style={styles.reasonsList}>
          {REASONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.reasonRow, selectedReason === r && styles.reasonRowSelected]}
              onPress={() => setSelectedReason(r)}
            >
              <View style={[styles.radio, selectedReason === r && styles.radioSelected]}>
                {selectedReason === r && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.reasonText, selectedReason === r && styles.reasonTextSelected]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Extra details */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Additional Details (optional)</Text>
        <TextInput
          style={styles.textarea}
          placeholder="Provide more context about the issue..."
          placeholderTextColor={colors.textDim}
          multiline
          value={details}
          onChangeText={setDetails}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.submitBtnText}>⚠️ Submit Dispute</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.cardDark },
  backBtn:     { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  backArrow:   { color: colors.text, fontSize: font.lg, lineHeight: 22 },
  headerTitle: { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center' },

  content: { padding: spacing.md },

  warningBanner: {
    flexDirection: 'row', gap: spacing.sm,
    backgroundColor: colors.error + '15',
    borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.error + '30',
    marginBottom: spacing.md,
  },
  warningIcon:  { fontSize: 24 },
  warningTitle: { color: colors.error, fontWeight: '700', fontSize: font.base, marginBottom: 4 },
  warningText:  { color: colors.textMuted, fontSize: font.sm, lineHeight: 18 },

  projectBox:   { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  projectName:  { color: colors.text, fontWeight: '700', fontSize: font.base },
  fieldLabel:   { color: colors.textMuted, fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },

  reasonsList:      { gap: spacing.xs },
  reasonRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  reasonRowSelected:{ borderColor: colors.error + '60', backgroundColor: colors.error + '10' },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected:{ borderColor: colors.error },
  radioInner:   { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  reasonText:        { color: colors.textMuted, fontSize: font.base, flex: 1 },
  reasonTextSelected:{ color: colors.text, fontWeight: '600' },

  textarea:   { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.base, borderWidth: 1, borderColor: colors.border, height: 120, textAlignVertical: 'top' },

  submitBtn:         { backgroundColor: colors.error, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: '#fff', fontWeight: '800', fontSize: font.base },
})
