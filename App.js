import React, { useEffect } from 'react';
import { BackHandler, Alert, StatusBar, Platform } from 'react-native';
import AppNavigator from './AppNavigator';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import 'react-native-gesture-handler';
import i18n from './components/I18n.js';

export default function App() {
  const t = (key) => i18n.t(`App.${key}`);

  // This will dismiss the sticky notification on App startup
  useEffect(() => {
    AsyncStorage.getItem('stickyNotificationId').then((value) => {
      if (value !== null) Notifications.dismissNotificationAsync(JSON.parse(value));
    });
  }, []);

  // Fix top white padding shown in production
  useEffect(() => {
    if (Platform.OS === "android") {
      StatusBar.setBackgroundColor("transparent");
      StatusBar.setTranslucent(true);
    }
  })

  const backPressed = async () => {
    const isIntervalOn = JSON.parse(await AsyncStorage.getItem('intervalLastState'));
    const message = isIntervalOn ? t('exitMessageBackground') : t('exitMessage');
    Alert.alert(
      t('exitTitle'),
      message,
      [
        { text: t('exitButtonNo'), onPress: () => {}, style: 'cancel' },
        {
          text: t('exitButtonYes'),
          onPress: () => {
            BackHandler.exitApp();
          },
        },
      ],
      { cancelable: false },
    );
    return true;
  };

  useEffect(() => {
    BackHandler.addEventListener('hardwareBackPress', backPressed);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', backPressed);
    };
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
