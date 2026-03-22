/**
 * FCM + Notifee — WhatsApp-style push notifications for Fursa
 *
 * Uses React Native Firebase *modular* Messaging API (no deprecation warnings).
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform, PermissionsAndroid } from 'react-native'
import {
  getMessaging,
  getToken,
  requestPermission,
  onTokenRefresh,
  onMessage,
  setBackgroundMessageHandler,
  AuthorizationStatus,
} from '@react-native-firebase/messaging'
import { saveFcmTokenAPI } from '../api'

/** Android 13+ (API 33): system dialog "Allow notifications?" — FCM's requestPermission alone often skips this. */
async function requestAndroidPostNotificationsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10)
  if (Number.isNaN(api) || api < 33) return true

  try {
    const perm =
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ?? 'android.permission.POST_NOTIFICATIONS'
    const result = await PermissionsAndroid.request(perm as 'android.permission.POST_NOTIFICATIONS')
    return result === PermissionsAndroid.RESULTS.GRANTED
  } catch (e) {
    console.warn('[FCM] POST_NOTIFICATIONS request failed:', e)
    return false
  }
}

// ─── Lazy-load notifee (optional until installed) ─────────────────────────────
function getNotifee() {
  try {
    return require('@notifee/react-native').default
  } catch {
    return null
  }
}
function getAndroidImportance() {
  try {
    return require('@notifee/react-native').AndroidImportance
  } catch {
    return null
  }
}

let fcmListenerCleanups: Array<() => void> = []

async function persistFcmDeviceToken(fcmDeviceToken: string, jwtOverride?: string | null) {
  const jwt = jwtOverride ?? (await AsyncStorage.getItem('token'))
  if (!jwt?.trim()) return
  await saveFcmTokenAPI(fcmDeviceToken, jwt)
}

// ─── Notification channels (Android) ─────────────────────────────────────────
export async function createNotificationChannels() {
  const notifee = getNotifee()
  const AndroidImportance = getAndroidImportance()
  if (!notifee || !AndroidImportance) return

  // Must match backend FCM android.notification.channelId (services/fcm.js)
  await notifee.createChannel({
    id: 'fursa_default',
    name: 'Fursa',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  })

  await notifee.createChannel({
    id: 'fursa_messages',
    name: 'Messages',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500],
  })

  await notifee.createChannel({
    id: 'fursa_activity',
    name: 'Activity (Bids, Payments)',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  })
}

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
      importance: 5,
      // White-on-transparent drawable (see scripts/generate-branding.cjs → ic_stat_fursa)
      smallIcon: 'ic_stat_fursa',
      pressAction: { id: 'default', launchActivity: 'default' },
      sound: 'default',
      vibrationPattern: [300, 500],
      style: { type: 0, text: body },
    },
  })
}

/**
 * Call after login. Pass `accessToken` (JWT) so the first FCM upload uses the same token
 * as the session (avoids 401 / accidental logout from the API interceptor).
 */
export async function setupPushNotifications(accessToken?: string | null): Promise<void> {
  try {
    const messaging = getMessaging()

    fcmListenerCleanups.forEach((fn) => fn())
    fcmListenerCleanups = []

    const androidOk = await requestAndroidPostNotificationsPermission()
    if (Platform.OS === 'android' && !androidOk) {
      console.log('[FCM] User denied notification permission (Android)')
      return
    }

    const authStatus = await requestPermission(messaging)
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL

    if (!enabled) {
      console.log('[FCM] Notification permission denied')
      return
    }

    await createNotificationChannels()

    const deviceToken = await getToken(messaging)
    if (deviceToken) {
      await persistFcmDeviceToken(deviceToken, accessToken)
      console.log('[FCM] Token registered ✅')
    }

    fcmListenerCleanups.push(
      onTokenRefresh(messaging, async (newToken: string) => {
        try {
          await persistFcmDeviceToken(newToken)
        } catch {
          /* non-fatal */
        }
      })
    )

    fcmListenerCleanups.push(
      onMessage(messaging, async (remoteMessage: any) => {
        const { notification, data } = remoteMessage
        const title = notification?.title || data?.title || 'Fursa'
        const body = notification?.body || data?.body || ''
        const type = data?.type || ''
        const channel = type === 'new_message' ? 'fursa_messages' : 'fursa_activity'
        await showNotification(title, body, channel, data || {})
      })
    )

    console.log('[FCM] Push notifications ready ✅')
  } catch (err: any) {
    console.error('[FCM] setup error:', err?.message)
  }
}

export function registerBackgroundHandler() {
  try {
    const messaging = getMessaging()
    setBackgroundMessageHandler(messaging, async (remoteMessage: any) => {
      // When the server sends a `notification` payload, Android/iOS already show the system banner.
      // Showing again via Notifee would duplicate the notification.
      if (remoteMessage.notification?.title != null || remoteMessage.notification?.body != null) {
        return
      }
      const { notification, data } = remoteMessage
      const title = notification?.title || data?.title || 'Fursa'
      const body = notification?.body || data?.body || ''
      const type = data?.type || ''
      const channel = type === 'new_message' ? 'fursa_messages' : 'fursa_activity'
      await createNotificationChannels()
      await showNotification(title, body, channel, data || {})
    })
  } catch (e: any) {
    console.log('[FCM] registerBackgroundHandler error:', e?.message || e)
  }
}
