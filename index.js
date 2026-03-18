/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Must be registered before AppRegistry — handles FCM when app is killed/background
import { registerBackgroundHandler } from './src/config/fcm';
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
