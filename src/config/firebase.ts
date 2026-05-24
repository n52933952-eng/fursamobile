// firebase — Google Sign-In webClientId (release APK needs SHA-1 in Firebase console)
import { GoogleSignin } from '@react-native-google-signin/google-signin'

// Firebase project mern-382a3 — Code 10 on release? add release keystore SHA-1 in console
GoogleSignin.configure({
  webClientId: '516464094484-ev9gvsdu53r8ual4jjops9msgfeft1vb.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: ['email', 'profile'],
})

export { GoogleSignin }
