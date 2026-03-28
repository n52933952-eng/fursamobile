import { GoogleSignin } from '@react-native-google-signin/google-signin'

/**
 * Firebase project: mern-382a3
 * webClientId from Firebase Console → Authentication → Sign-in method → Google → Web client ID
 *
 * Release APK: Code 10 / DEVELOPER_ERROR → add **release** keystore SHA-1 (+ SHA-256) in Firebase
 * → Project settings → Android app `com.fursa`. See android/GOOGLE_SIGNIN_RELEASE.md
 */
GoogleSignin.configure({
  webClientId: '516464094484-ev9gvsdu53r8ual4jjops9msgfeft1vb.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: ['email', 'profile'],
})

export { GoogleSignin }
