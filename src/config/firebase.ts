import { GoogleSignin } from '@react-native-google-signin/google-signin'

/**
 * Firebase project: mern-382a3
 * webClientId from Firebase Console → Authentication → Sign-in method → Google → Web client ID
 */
GoogleSignin.configure({
  webClientId: '516464094484-ev9gvsdu53r8ual4jjops9msgfeft1vb.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: ['email', 'profile'],
})

export { GoogleSignin }
