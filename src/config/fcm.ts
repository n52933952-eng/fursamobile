/**
 * FCM + Notifee — WhatsApp-style push notifications for Fursa
 *
 * Shows heads-up popup banners (like WhatsApp) in ALL states:
 *   - App OPEN      → notifee displays a popup banner over the app
 *   - App BACKGROUND → Android shows heads-up banner over whatever is on screen
 *   - App KILLED    → Android shows heads-up banner, tap opens the app
 *
 * Notification types:
 *   💬 new_message        — new chat message
 *   📋 new_proposal       — client received a new bid
 *   ✅ proposal_accepted  — freelancer's bid was accepted
 *   💸 payment_released   — admin released payment to freelancer
 *   ✅ project_complete   — freelancer marked project done (client notified)
 */

import { saveFcmTokenAPI } from '../api'

// ─── Lazy-load modules (not installed yet until user runs npm install) ────────
function getMessaging() {
  try { return require('@react-native-firebase/messaging').default } catch { return null }
}
function getNotifee() {
  try { return require('@notifee/react-native').default } catch { return null }
}
function getAndroidImportance() {
  try { return require('@notifee/react-native').AndroidImportance } catch { return null }
}
function getAndroidStyle() {
  try { return require('@notifee/react-native').AndroidStyle } catch { return null }
}

// ─── Notification channels (one-time setup, safe to call multiple times) ─────
export async function createNotificationChannels() {
  const notifee = getNotifee()
  const AndroidImportance = getAndroidImportance()
  if (!notifee || !AndroidImportance) return

  // Main channel — HIGH importance = heads-up popup like WhatsApp
  await notifee.createChannel({
    id:          'fursa_messages',
    name:        'Messages',
    importance:  AndroidImportance.HIGH,   // ← this is what makes the popup appear
    sound:       'default',
    vibration:   true,
    vibrationPattern: [300, 500],
  })

  await notifee.createChannel({
    id:          'fursa_activity',
    name:        'Activity (Bids, Payments)',
    importance:  AndroidImportance.HIGH,
    sound:       'default',
    vibration:   true,
  })
}

// ─── Display a heads-up notification using notifee ───────────────────────────
async function showNotification(
  title: string,
  body: string,
  channelId: 'fursa_messages' | 'fursa_activity',
  data: Record<string, string> = {}
) {
  const notifee = getNotifee()
  if (!notifee) return

  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId,
      importance: 5,           // IMPORTANCE_HIGH — forces heads-up popup
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default', launchActivity: 'default' },
      sound: 'default',
      vibrationPattern: [300, 500],
      // Show message preview in notification (like WhatsApp)
      style: {
        type: 0, // BigTextStyle — expands to show full message
        text: body,
      },
    },
  })
}

// ─── Main setup — call once after login ──────────────────────────────────────
export async function setupPushNotifications(): Promise<void> {
  const messaging = getMessaging()
  const notifee   = getNotifee()

  if (!messaging) {
    console.log('[FCM] @react-native-firebase/messaging not installed yet')
    return
  }

  try {
    // 1. Request permission
    const authStatus = await messaging().requestPermission()
    const enabled =
      authStatus === 1 || authStatus === 2 ||
      authStatus === messaging.AuthorizationStatus?.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus?.PROVISIONAL

    if (!enabled) {
      console.log('[FCM] Notification permission denied')
      return
    }

    // 2. Create notification channels (Android)
    await createNotificationChannels()

    // 3. Register FCM token with backend
    const token = await messaging().getToken()
    if (token) {
      await saveFcmTokenAPI(token)
      console.log('[FCM] Token registered ✅')
    }

    // 4. Refresh token when it rotates
    messaging().onTokenRefresh(async (newToken: string) => {
      await saveFcmTokenAPI(newToken)
    })

    // 5. FOREGROUND handler — app is open
    //    FCM does NOT show UI when app is open, so we use notifee to show the popup
    messaging().onMessage(async (remoteMessage: any) => {
      const { notification, data } = remoteMessage
      const title = notification?.title || data?.title || 'Fursa'
      const body  = notification?.body  || data?.body  || ''
      const type  = data?.type || ''

      const channel = type === 'new_message' ? 'fursa_messages' : 'fursa_activity'

      await showNotification(title, body, channel, data || {})
    })

    console.log('[FCM] Push notifications ready ✅')

  } catch (err: any) {
    console.error('[FCM] setup error:', err?.message)
  }
}

// ─── Background / Killed state handler ───────────────────────────────────────
//    Called in index.js (app entry point) BEFORE the app mounts
//    FCM auto-shows the notification, but we can also intercept with notifee
export function registerBackgroundHandler() {
  const messaging = getMessaging()
  if (!messaging) return

  // FCM background handler (required by Firebase — must be registered at root level)
  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    const { notification, data } = remoteMessage
    const title = notification?.title || data?.title || 'Fursa'
    const body  = notification?.body  || data?.body  || ''
    const type  = data?.type || ''

    const channel = type === 'new_message' ? 'fursa_messages' : 'fursa_activity'

    // Use notifee to ensure heads-up popup in background too
    await createNotificationChannels()
    await showNotification(title, body, channel, data || {})
  })
}
