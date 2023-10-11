import React, { useContext } from 'react';
import { styles, Colors } from './styles';
import { View, Image, TouchableOpacity, Alert } from 'react-native';
import FontAwesome5Icon from '@expo/vector-icons/FontAwesome5';
import { AuthContext } from '../context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unregisterBackgroundFetchAsync } from '../utils/handleBackgroundTask';
import { clearAllExceptOne } from '../utils/utils';
import i18n from '../components/I18n.js';

export default function Header() {
  const t = (key) => i18n.t(`Header.${key}`);
  const { logout } = useContext(AuthContext);

  const handleLogout = async () => {
    const isIntervalOn = JSON.parse(await AsyncStorage.getItem('intervalLastState'));
    if (isIntervalOn) unregisterBackgroundFetchAsync();
    await SecureStore.deleteItemAsync('inputs');
    await SecureStore.deleteItemAsync('selectedUniversity');
    await SecureStore.deleteItemAsync('cookies');
    await SecureStore.deleteItemAsync('mainUrl');
    await SecureStore.deleteItemAsync('notListPath');
    await clearAllExceptOne('lang');
    logout();
  };

  const showAlert = async () => {
    const isIntervalOn = JSON.parse(await AsyncStorage.getItem('intervalLastState'));
    const message = isIntervalOn ? t('exitMessageInterval') : t('exitMessage');
    Alert.alert(
      t('exitTitle'),
      message,
      [
        {
          text: t('logoutButtonNo'),
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: t('logoutButtonYes'),
          onPress: () => handleLogout(),
        },
      ],
      { cancelable: false },
    );
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.innerContainer}>
        <View style={styles.rowContainer}>
          <Image style={styles.pageLogo} source={require('../assets/logo.png')} />
          <TouchableOpacity onPress={showAlert}>
            <FontAwesome5Icon name="sign-out-alt" size={25} color={Colors.black} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
