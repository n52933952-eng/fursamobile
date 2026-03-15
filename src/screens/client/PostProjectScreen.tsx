import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, font } from '../../theme'

export default function PostProjectScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>➕ Post Project — Coming Soon</Text>
    </View>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontSize: font.lg },
})
