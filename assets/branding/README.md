# Fursa app icon & splash source

1. Replace **`app-icon.png`** with your logo (square PNG, transparent or solid background is fine).
2. From the project root run:
   ```bash
   npm run generate-branding
   ```
3. Rebuild the app:
   - Android: `cd android && ./gradlew assembleRelease` (or `npx react-native run-android`)
   - iOS: open `ios/fursa.xcodeproj` and build

This regenerates Android launcher mipmaps, Android `splash_logo.png`, **Android notification icons** (`drawable-*/ic_stat_fursa.png`), iOS `AppIcon.appiconset`, and iOS `SplashLogo.imageset`.
