// authSession — orphan-session event when API says JWT user id missing from Mongo
import { DeviceEventEmitter } from 'react-native'

export const SESSION_ORPHAN_USER_EVENT = 'fursa-session-orphan-user'

export function emitOrphanSession() {
  DeviceEventEmitter.emit(SESSION_ORPHAN_USER_EVENT)
}
