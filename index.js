/**
 * @format
 */

// Firebase MUST be the very first import so [DEFAULT] app is ready before anything else
import '@react-native-firebase/app';

import {AppRegistry, I18nManager} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {registerBackgroundHandler} from './src/config/fcm';

// Phone Settings → Language (Arabic etc.): do NOT mirror the whole app like a native RTL app.
// This is independent of Fursa’s in-app EN/AR toggle (that only changes strings / some rows).
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
  I18nManager.swapLeftAndRightInRTL(false);
}

// Must be registered before AppRegistry — handles FCM when app is killed/background
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
