import axios from 'axios';
import Cheerio from 'react-native-cheerio';
import { submitInformation, SessionExpiredError } from './utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../components/I18n.js';

const t = (key) => i18n.t(`handleBackgroundTask.${key}`);

export const getMarks = async (host, path, cookies, mainUrl) => {
  // Get not list
  let notListResponse = await axios.get(`${host}/oibs/ogrenci/${path}`, {
    headers: {
      Cookie: cookies,
      Referer: mainUrl,
    },
    withCredentials: false,
  });

  // Load not list
  let $ = Cheerio.load(notListResponse.data);

  // Check if session is expired
  if (notListResponse.headers['expires'] === '-1') {
    throw new SessionExpiredError(t('sessionExpiredError'));
  }

  // Check if student update informatin page is open
  const btnKaydet = $('#btnKaydet');
  if (btnKaydet.length) {
    await submitInformation($, mainUrl, cookies);
    notListResponse = await axios.get(`${host}/oibs/ogrenci/${path}`, {
      headers: {
        Cookie: cookies,
        Referer: mainUrl,
      },
      withCredentials: false,
    });
    $ = Cheerio.load(notListResponse.data);
  }

  const dersAdi = [];
  const durum = [];
  const allExams = [];
  const sinavlar = [];
  const tskor = [];
  const ort = [];
  const harfNotu = [];
  const durumu = [];

  // Find all the lesson rows
  const trElements = $('table#grd_not_listesi tr:not(:first-child)');

  // Check if there are no lessons (Start of new semester)
  if (!trElements.length) {
    if (await AsyncStorage.getItem('dersler')) {
      await AsyncStorage.removeItem('dersler');
    }
    return [];
  } else {
    // Find lesson names, status and letters and push them to arrays
    trElements.each((_, element) => {
      dersAdi.push($(element).find('td:nth-child(3)').text().trim());
      durum.push($(element).find('td:nth-child(4)').text().trim());
      allExams.push($(element).find('td:nth-child(5)'));
      ort.push($(element).find('td:nth-child(6)').text().trim());
      harfNotu.push($(element).find('td:nth-child(7)').text().trim());
      durumu.push($(element).find('td:nth-child(8)').text().trim());
    });

    allExams.forEach((item) => {
      const tskorNotMatch = $(item).find('[id^="grd_not_listesi_lblTSKOR"]');
      tskor.push(tskorNotMatch.text().trim());

      const nestedExams = [];
      const sinavlarMatch = $(item).find('[id^="grd_not_listesi_lblHSnv"]');
      const sinavNotlariMatch = $(item).find('[id^="grd_not_listesi_lblSnv"]');

      sinavNotlariMatch.each((index, element) => {
        if ($(element).text() !== '') {
          // If there is a grade
          nestedExams.push({
            sinavAdi: $(sinavlarMatch[index]).text().replace(/[:\s]/g, ''), // Push the exam name
            sinavNotu: $(element).text().trim(), // Push the exam grade
          });
        }
      });
      sinavlar.push(nestedExams);
    });

    // Create not list
    const notList = [];
    for (let i = 0; i < trElements.length; i++) {
      notList.push({
        dersAdi: dersAdi[i],
        durum: durum[i],
        sinavlar: sinavlar[i],
        tskor: tskor[i] ? tskor[i] : '',
        ort: ort[i] ? ort[i] : '',
        harfNotu: harfNotu[i] ? harfNotu[i] : '',
        durumu: durumu[i] ? durumu[i] : '',
      });
    }
    return notList;
  }
};

export const getGPAInfo = async (host, path, cookies, mainUrl, notList) => {
  let transkriptSenaryosuResponse = await axios.get(`${host}/oibs/ogrenci/${path}`, {
    headers: {
      Cookie: cookies,
      Referer: mainUrl,
    },
    withCredentials: false,
  });

  // Load not list
  let $ = Cheerio.load(transkriptSenaryosuResponse.data);

  const btnKaydet = $('#btnKaydet');
  if (btnKaydet.length) {
    await submitInformation($, mainUrl, cookies);
    transkriptSenaryosuResponse = await axios.get(`${host}/oibs/ogrenci/${path}`, {
      headers: {
        Cookie: cookies,
        Referer: mainUrl,
      },
      withCredentials: false,
    });
    $ = Cheerio.load(transkriptSenaryosuResponse.data);
  }

  const type = $('#lblKrediAktsBaslik').text();
  const harfKatsayiOptions = $('#cmbWinHarf').find('option');
  const harfKatsayi = {};
  harfKatsayiOptions.each((index, element) => {
    if (index === 0 || index === harfKatsayiOptions.length - 1) return;
    const text = $(element).text();
    const harf = text.split(' ')[0];
    const katsayi = Number(text.split(':')[1].replace(',', '.'));
    harfKatsayi[`${harf}`] = katsayi;
  });

  const targetElement = $('table')
    .eq(1) // Get the second table
    .find('tbody tr:first-child td div')
    .find('table tbody')
    .find('tr');

  const lessonNames = $(targetElement).find('[id^="grd_genel_lblDersAd"]');
  const lessonKredi = $(targetElement).find('[id^="grd_genel_lblKredi"]');
  const lessonAkts = $(targetElement).find('[id^="grd_genel_lblAKTS"]');
  const lessonLetter = $(targetElement).find('[id^="grd_genel_lblHarf"]');

  // Remove empty lessons
  lessonNames.each((index, element) => {
    if ($(element).text() === '') {
      lessonNames.splice(index, 1);
      lessonKredi.splice(index, 1);
      lessonAkts.splice(index, 1);
      lessonLetter.splice(index, 1);
    }
  });

  const duplicateNoLetterLessons = [];

  // Remove duplicate lessons
  for (let i = lessonNames.length - 1; i > 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      if ($(lessonNames[i]).text().trim() === $(lessonNames[j]).text().trim()) {
        if ($(lessonLetter[i]).text().trim() === '') {
          duplicateNoLetterLessons.push($(lessonNames[i]).text().trim());
          continue;
        }
        lessonNames.splice(j, 1);
        lessonKredi.splice(j, 1);
        lessonAkts.splice(j, 1);
        lessonLetter.splice(j, 1);
      }
    }
  }

  const ortaKatilmazHarflar = ['', 'V'];
  let totalAktsOrKredi = 0;
  let totalPuan = 0;
  for (let i = lessonNames.length - 1; i >= 0; i--) {
    // Check if lesson is in notList
    const lesson = notList.find((lesson) => lesson.dersAdi === $(lessonNames[i]).text().trim());
    if (lesson) {
      // Edit notList directly
      lesson.aktsOrKredi =
        type === 'AKTS' ? Number($(lessonAkts[i]).text().trim()) : Number($(lessonKredi[i]).text().trim());
      notList[notList.indexOf(lesson)] = lesson;
    }
    if (ortaKatilmazHarflar.includes($(lessonLetter[i]).text().trim())) continue;

    totalAktsOrKredi += type === 'AKTS' ? Number($(lessonAkts[i]).text()) : Number($(lessonKredi[i]).text());

    const puan = harfKatsayi[$(lessonLetter[i]).text().trim()] || 0;

    const aktsOrKredi = type === 'AKTS' ? Number($(lessonAkts[i]).text()) : Number($(lessonKredi[i]).text());
    totalPuan += puan * aktsOrKredi;
  }
  return {
    duplicateNoLetterLessons: duplicateNoLetterLessons,
    harfKatsayi: harfKatsayi,
    totalAktsOrKredi: totalAktsOrKredi,
    totalPuan: totalPuan,
  };
};
