# Google Sign-In works in debug but **Code 10 / DEVELOPER_ERROR** in release APK

Debug builds are signed with the **debug** keystore. Release APKs use **`fursa-release.keystore`**.  
Google only trusts fingerprints you register, so the **release** SHA-1 must be added in Firebase (and stays in sync with Google Cloud).

## 1. Print SHA-1 and SHA-256 of your **release** keystore

PowerShell (use your real keystore path and the password from `android/keystore.properties`):

```powershell
keytool -list -v -keystore "$env:USERPROFILE\Desktop\fursaapp\fursa\android\app\fursa-release.keystore" -alias fursa_release
```

Copy the lines:

- **SHA1:** `AA:BB:...`
- **SHA256:** `...`

## 2. Add them in Firebase

1. [Firebase Console](https://console.firebase.google.com) → your project  
2. **Project settings** (gear) → **Your apps** → Android app (`com.fursa`)  
3. **Add fingerprint** → paste **SHA-1** (add **SHA-256** too if offered)  
4. Save  

## 3. Refresh Android config (if you use `google-services.json`)

After adding fingerprints, download the updated **`google-services.json`** and replace:

`android/app/google-services.json`

Then rebuild the release APK.

## 4. (Optional) Google Cloud Console

Usually Firebase syncs OAuth clients automatically. If issues persist:

- [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials  
- Open the **Android client** for `com.fursa` and ensure the same SHA-1 appears there.

---

**Why:** `DEVELOPER_ERROR` / code 10 almost always means “this app signature is not registered for this OAuth client.”
