import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useLang } from '../context/LanguageContext'
import { colors } from '../theme'

// Auth Screens
import SplashScreen         from '../screens/auth/SplashScreen'
import WelcomeScreen        from '../screens/auth/WelcomeScreen'
import LoginScreen          from '../screens/auth/LoginScreen'
import RegisterScreen       from '../screens/auth/RegisterScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import OTPScreen            from '../screens/auth/OTPScreen'
import RoleSelectScreen     from '../screens/auth/RoleSelectScreen'

// Shared Screens
import HomeScreen            from '../screens/shared/HomeScreen'
import ChatScreen            from '../screens/shared/ChatScreen'
import WalletScreen          from '../screens/shared/WalletScreen'
import ProfileScreen         from '../screens/shared/ProfileScreen'
import MessageScreen         from '../screens/shared/MessageScreen'
import ProjectDetailScreen   from '../screens/shared/ProjectDetailScreen'
import ContractScreen        from '../screens/shared/ContractScreen'
import NotificationsScreen   from '../screens/shared/NotificationsScreen'
import DisputeScreen         from '../screens/shared/DisputeScreen'
import ReviewsScreen         from '../screens/shared/ReviewsScreen'

// Client Screens
import PostProjectScreen        from '../screens/client/PostProjectScreen'
import FreelancerSearchScreen   from '../screens/client/FreelancerSearchScreen'

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
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{icons[label] || '•'}</Text>
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

const tabScreenOptions = {
  tabBarStyle,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  headerShown: false,
}

// ─── Client tabs with live badges + translated labels ─────────────────────────
function ClientTabs() {
  const { unreadMessages, unreadNotifications } = useSocket()
  const { tr } = useLang()
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Home"   component={HomeScreen}
        options={{ ...tabOptions('Home'), tabBarLabel: tr.home, tabBarBadge: unreadNotifications > 0 ? unreadNotifications : undefined }} />
      <Tab.Screen name="Post"    component={PostProjectScreen}
        options={{ ...tabOptions('Post'), tabBarLabel: tr.post }} />
      <Tab.Screen name="Chat"    component={ChatScreen}
        options={{ ...tabOptions('Chat'), tabBarLabel: tr.chat, tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined }} />
      <Tab.Screen name="Wallet"  component={WalletScreen}
        options={{ ...tabOptions('Wallet'), tabBarLabel: tr.wallet }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ ...tabOptions('Profile'), tabBarLabel: tr.profile }} />
    </Tab.Navigator>
  )
}

// ─── Freelancer tabs with live badges + translated labels ─────────────────────
function FreelancerTabs() {
  const { unreadMessages, unreadNotifications } = useSocket()
  const { tr } = useLang()
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Home"    component={HomeScreen}
        options={{ ...tabOptions('Home'), tabBarLabel: tr.home }} />
      <Tab.Screen name="My Bids" component={MyBidsScreen}
        options={{ ...tabOptions('My Bids'), tabBarLabel: tr.myBids, tabBarBadge: unreadNotifications > 0 ? unreadNotifications : undefined }} />
      <Tab.Screen name="Chat"    component={ChatScreen}
        options={{ ...tabOptions('Chat'), tabBarLabel: tr.chat, tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined }} />
      <Tab.Screen name="Wallet"  component={WalletScreen}
        options={{ ...tabOptions('Wallet'), tabBarLabel: tr.wallet }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ ...tabOptions('Profile'), tabBarLabel: tr.profile }} />
    </Tab.Navigator>
  )
}

// ─── Auth stack ───────────────────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome"        component={WelcomeScreen} />
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="Register"       component={RegisterScreen} />
      <Stack.Screen name="OTP"            component={OTPScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="RoleSelect"     component={RoleSelectScreen} />
    </Stack.Navigator>
  )
}

// ─── Main stack — tabs + overlay screens ─────────────────────────────────────
function MainStack() {
  const { user } = useAuth()
  const Tabs = user?.role === 'client' ? ClientTabs : FreelancerTabs
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"                component={Tabs} />
      <Stack.Screen name="MessageScreen"       component={MessageScreen} />
      <Stack.Screen name="ProjectDetailScreen" component={ProjectDetailScreen} />
      <Stack.Screen name="ContractScreen"      component={ContractScreen} />
      <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
      <Stack.Screen name="DisputeScreen"            component={DisputeScreen} />
      <Stack.Screen name="ReviewsScreen"            component={ReviewsScreen} />
      <Stack.Screen name="FreelancerSearchScreen"   component={FreelancerSearchScreen} />
    </Stack.Navigator>
  )
}

// ─── Root navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useAuth()
  if (loading) return <SplashScreen />
  return (
    <NavigationContainer>
      {!user ? <AuthStack /> : <MainStack />}
    </NavigationContainer>
  )
}
