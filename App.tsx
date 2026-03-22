import React from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/context/AuthContext'
import { SocketProvider } from './src/context/SocketContext'
import { LanguageProvider } from './src/context/LanguageContext'
import AppNavigator from './src/navigation'
import { colors } from './src/theme'

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <SocketProvider>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
            <AppNavigator />
          </SocketProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  )
}
