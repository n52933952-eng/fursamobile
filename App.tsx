import React from 'react'
import { StatusBar } from 'react-native'
import { AuthProvider } from './src/context/AuthContext'
import AppNavigator from './src/navigation'
import { colors } from './src/theme'

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <AppNavigator />
    </AuthProvider>
  )
}
