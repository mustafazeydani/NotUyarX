import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as Network from 'expo-network';
import axios from 'axios';
import Cheerio from 'react-native-cheerio';
import JWT from 'expo-jwt';
import {
  solveCaptcha,
  encrypt,
  SessionExpiredError,
  CaptchaError,
  compareArrayWithJson,
  notNotification,
  clearAllExceptOne,
  LoginError,
  NetworkError
} from './utils';
import { getMarks, getGPAInfo } from './requests';
import { BACKGROUND_FETCH_TASK, SECRET_KEY } from './constants';
import i18n from '../components/I18n.js';

let notificationId = null; // "Checking marks" notification id
const t = (key) => i18n.t(`handleBackgroundTask.${key}`);

export const setNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

export const registerBackgroundFetchAsync = async (intervalDuration) => {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: intervalDuration * 60,
    stopOnTerminate: false, // android only,
    startOnBoot: true, // android only
  });
};

export const defineTask = () => {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    await handleSessionAndMarks();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  });
};

export const unregisterBackgroundFetchAsync = async () => {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
};

const handleError = async (error) => {
  if(error instanceof NetworkError) return;
  if(error instanceof LoginError) {
    await SecureStore.deleteItemAsync('inputs');
    await clearAllExceptOne('lang');
  }

  const stickyNotificationId = JSON.parse(await AsyncStorage.getItem('stickyNotificationId'));
  if (stickyNotificationId !== null) await Notifications.dismissNotificationAsync(stickyNotificationId);

  await AsyncStorage.removeItem('isSessionActive');
  await AsyncStorage.removeItem('intervalLastState');
  unregisterBackgroundFetchAsync();

  Notifications.dismissNotificationAsync(notificationId);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('errorNotificationTitle'),
      body: error instanceof LoginError? error.message : `${error.message}\n${t('restart')}`,
    },
    trigger: null, // Send immediately
  });
};

export const handleSession = async (host) => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) throw new NetworkError(t('networkError'))

    const studentId = JSON.parse(await SecureStore.getItemAsync('inputs')).studentId;
    const password = JSON.parse(await SecureStore.getItemAsync('inputs')).password;

    // Get cookies
    const firstRequest = await axios.get(`${host}/oibs/ogrenci/login.aspx`, {
      withCredentials: false,
    });
    const cookies = firstRequest.headers['set-cookie'];

    // Get captcha image
    const secondRequest = await axios.get(`${host}/oibs/captcha/CaptchaImg.aspx`, {
      responseType: 'blob',
      withCredentials: false,
      headers: {
        Cookie: cookies,
      },
    });
    const blob = secondRequest.data;
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    await new Promise((resolve) => {
      reader.onloadend = async () => {
        try {
          const decodedImageData = reader.result.split(',')[1];

          // Create JWT token for authenticating captcha solution request
          const token = JWT.encode({}, SECRET_KEY, { expiresIn: '5s' });

          // Solve captcha
          const captchaSolution = await solveCaptcha(token, decodedImageData);

          // Send login request
          const loginResponse = await axios.post(
            `${host}/oibs/ogrenci/login.aspx`,
            {
              __EVENTTARGET: 'btnLogin',
              txtParamT01: studentId,
              txtParamT1: encrypt(password),
              txtSecCode: captchaSolution,
            },
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Cookie: cookies,
                Referer: `${host}/oibs/ogrenci/login.aspx`,
              },
              withCredentials: false,
            },
          );
          // Load login response
          const $ = Cheerio.load(loginResponse.data);

          // Check if login is successful, if not it means that password has been changed or captcha is wrong
          const error = $('#lblSonuclar');
          if (error.length) {
            if (error.text().includes('Güvenlik kodu hatalı girildi !')) throw new CaptchaError(t('captchaError')); 
            throw new LoginError(t('loginError'));
          }

          // Get not list path and mainUrl
          const notListElement = $('a:has(p:contains("Not Liste"):not(:contains("Haz. Not Listesi")))');
          const notListPath = $(notListElement).attr('onclick').split("'")[1];

          const mainUrl = loginResponse.request.responseURL;

          await AsyncStorage.setItem('isSessionActive', JSON.stringify(true));
          await SecureStore.setItemAsync('cookies', JSON.stringify(cookies));
          await SecureStore.setItemAsync('mainUrl', JSON.stringify(mainUrl));
          await SecureStore.setItemAsync('notListPath', JSON.stringify(notListPath));

          resolve();
        } catch (error) {
          if (error instanceof CaptchaError) {
            AsyncStorage.setItem('isSessionActive', JSON.stringify(false));
            handleSessionAndMarks();
          } else {
            handleError(error);
          }
        }
      };
    });
  } catch (error) {
    handleError(error);
  }
};

const handleMarks = async (host) => {
  try {
    const notListPath = JSON.parse(await SecureStore.getItemAsync('notListPath'));
    const cookies = JSON.parse(await SecureStore.getItemAsync('cookies'));
    const mainUrl = JSON.parse(await SecureStore.getItemAsync('mainUrl'));

    // Call getMarks
    const notList = await getMarks(host, notListPath, cookies, mainUrl);

    // Get saved not list
    const currentMarks = JSON.parse(await AsyncStorage.getItem('dersler'));

    // Compare current not list with the saved one
    const aciklanmisDersler = compareArrayWithJson(notList, currentMarks);

    await Notifications.dismissNotificationAsync(notificationId);

    // If there are no differences, no marks are out yet
    if (!aciklanmisDersler.length) {
      return;
    } else {
      // If there are differences, send notification
      aciklanmisDersler.forEach(async (aciklanmisDers) => {
        // incase there are multiple lessons
        const notificationContentObjs = await notNotification(aciklanmisDers);
        notificationContentObjs.forEach(async (notificationObj) => {
          // incase there are multiple exams out
          await Notifications.scheduleNotificationAsync({
            content: {
              title: notificationObj.title,
              body: notificationObj.body,
            },
            trigger: null, // Send immediately
          });
        });
      });

      // Check if there is a change in the harfNotu, if there is, update the GPAInfo
      const dersler = JSON.parse(await AsyncStorage.getItem('dersler'));
      const harfNotuChanged = notList.some((item, index) => item.harfNotu !== dersler[index].harfNotu);
      if (harfNotuChanged) {
        const newGPAInfo = getGPAInfo(host, notListPath, cookies, mainUrl, notList);
        await AsyncStorage.setItem('GPAInfo', JSON.stringify(newGPAInfo));
      }
    }

    // Save current not list instead of the old one
    await AsyncStorage.setItem('dersler', JSON.stringify(notList));
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      await AsyncStorage.setItem('isSessionActive', JSON.stringify(false));
      handleSessionAndMarks();
    } else {
      handleError(error);
    }
  }
};

export const handleSessionAndMarks = async () => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) throw new NetworkError(t('networkError'));
  
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: t('checkingMarks'),
        sound: false,
      },
      trigger: null, // Show immediately
    });

    const isSessionActive = JSON.parse(await AsyncStorage.getItem('isSessionActive'));
    const intervalDuration = JSON.parse(await AsyncStorage.getItem('intervalDuration'));
    const host = JSON.parse(await AsyncStorage.getItem('selectedUniversity')).host;
    
    if (!isSessionActive || intervalDuration >= 9) {
      await handleSession(host);
    }
    await handleMarks(host);
  } catch (error) {
    handleError(error);
  }
};
