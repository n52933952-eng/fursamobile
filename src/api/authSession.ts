import { DeviceEventEmitter } from 'react-native'

/** Server said JWT user id is not in MongoDB — must clear storage and sign in again */
export const SESSION_ORPHAN_USER_EVENT = 'fursa-session-orphan-user'

export function emitOrphanSession() {
  DeviceEventEmitter.emit(SESSION_ORPHAN_USER_EVENT)
}
