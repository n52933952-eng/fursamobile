# Android release signing (Fursa)

## 1. Keystore file

The release keystore lives next to this doc’s **app** module:

- `android/app/fursa-release.keystore` (gitignored via `*.keystore`)

If you need to **create a new keystore** (PowerShell, JDK `keytool` on PATH):

```powershell
cd $env:USERPROFILE\Desktop\fursaapp\fursa\android\app

keytool -genkeypair -v `
  -storetype PKCS12 `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -alias fursa_release `
  -keystore fursa-release.keystore `
  -storepass "YOUR_STRONG_PASSWORD" `
  -keypass "YOUR_STRONG_PASSWORD" `
  -dname "CN=Fursa, OU=Mobile, O=Fursa, L=City, ST=State, C=SA"
```

Use the **same** passwords you put in `keystore.properties`. Keep a **backup** of the keystore + passwords (password manager / secure storage). Losing them blocks Play updates for this signing key.

## 2. `keystore.properties`

```powershell
copy android\keystore.properties.example android\keystore.properties
```

Edit `android/keystore.properties` and set:

- `storePassword` / `keyPassword` — match the keystore
- `keyAlias` — e.g. `fursa_release`
- `storeFile` — `fursa-release.keystore` (relative to `android/app/`)

## 3. Build release APK / AAB

```powershell
cd android
.\gradlew assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`  
AAB (Play Store): `.\gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`

## 4. Google Play

With **Play App Signing**, you upload an **upload key** (this keystore can be that). Register the certificate in Play Console as documented by Google.
