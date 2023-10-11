import { I18n } from 'i18n-js';
import enTranslations from '../translations/en.json';
import trTranslations from '../translations/tr.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

const i18n = new I18n({
  en: enTranslations,
  tr: trTranslations,
});

const setLocale = () => {
  AsyncStorage.getItem('lang').then((lang) => {
    if (lang) i18n.locale = lang;
  });
};
setLocale();

export default i18n;
