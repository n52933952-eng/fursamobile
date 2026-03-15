import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { colors } from '../theme'

// Auth Screens
import SplashScreen       from '../screens/auth/SplashScreen'
import LoginScreen        from '../screens/auth/LoginScreen'
import RegisterScreen     from '../screens/auth/RegisterScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'

// Shared Screens
import HomeScreen    from '../screens/shared/HomeScreen'
import ChatScreen    from '../screens/shared/ChatScreen'
import WalletScreen  from '../screens/shared/WalletScreen'
import ProfileScreen from '../screens/shared/ProfileScreen'

// Client Screens
import PostProjectScreen from '../screens/client/PostProjectScreen'

// Freelancer Screens
import MyBidsScreen from '../screens/freelancer/MyBidsScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

const tabIcon = (label: string, focused: boolean) => {
  const icons: Record<string, string> = {
    Home: '🏠', Post: '➕', 'My Bids': '📋',
    Chat: '💬', Wallet: '💰', Profile: '👤',
  }
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] || '•'}</Text>
    </View>
  )
}

const tabOptions = (label: string) => ({
  tabBarIcon: ({ focused }: { focused: boolean }) => tabIcon(label, focused),
  tabBarLabel: label,
  headerShown: false,
})

const tabBarStyle = {
  backgroundColor: colors.cardDark,
  borderTopColor: colors.border,
  paddingBottom: 8,
  paddingTop: 8,
  height: 64,
}

const tabBarLabelStyle = {
  fontSize: 11,
  fontWeight: '600' as const,
}

// Client bottom tabs
function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle,
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home"    component={HomeScreen}        options={tabOptions('Home')} />
      <Tab.Screen name="Post"    component={PostProjectScreen} options={tabOptions('Post')} />
      <Tab.Screen name="Chat"    component={ChatScreen}        options={tabOptions('Chat')} />
      <Tab.Screen name="Wallet"  component={WalletScreen}      options={tabOptions('Wallet')} />
      <Tab.Screen name="Profile" component={ProfileScreen}     options={tabOptions('Profile')} />
    </Tab.Navigator>
  )
}

// Freelancer bottom tabs
function FreelancerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle,
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home"     component={HomeScreen}    options={tabOptions('Home')} />
      <Tab.Screen name="My Bids"  component={MyBidsScreen}  options={tabOptions('My Bids')} />
      <Tab.Screen name="Chat"     component={ChatScreen}    options={tabOptions('Chat')} />
      <Tab.Screen name="Wallet"   component={WalletScreen}  options={tabOptions('Wallet')} />
      <Tab.Screen name="Profile"  component={ProfileScreen} options={tabOptions('Profile')} />
    </Tab.Navigator>
  )
}

// Auth Stack
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="Register"       component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  )
}

// Root navigator
export default function AppNavigator() {
  const { user, loading } = useAuth()

  if (loading) return <SplashScreen />

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : user.role === 'client' ? (
        <ClientTabs />
      ) : (
        <FreelancerTabs />
      )}
    </NavigationContainer>
  )
}
