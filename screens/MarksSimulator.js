import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { styles, Colors } from '../components/styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome5Icon from '@expo/vector-icons/FontAwesome5';
import { Table, Row, Cell, TableWrapper } from 'react-native-reanimated-table';
import i18n from '../components/I18n.js';

export default function Marks() {
  const t = (key) => i18n.t(`MarksSimulator.${key}`);
  const [dersler, setDersler] = useState([]);
  const [derslerData, setDerslerData] = useState([]);
  const [GPAInfo, setGPAInfo] = useState(null);
  const [CGPA, setCGPA] = useState(0);
  const [GPA, setGPA] = useState(0);
  const [loading, setLoading] = useState(true);
  const [originalValues, setOriginalValues] = useState([]);
  const [selectedValues, setSelectedValues] = useState([]);
  const defaultHarflar = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FD', 'FF'];
  const ortalamaKatilmazHarflar = ['', '--', 'V'];
  const tableHeaderData = [t('tableHeaderLessonName'), t('tableHeaderLessonLetter')];

  const handlePickerChange = (itemValue, index) => {
    const updatedValues = [...selectedValues];
    updatedValues[index] = itemValue;
    setSelectedValues(updatedValues);
  };

  const pickerElement = (index, selectedHarfNotu) => {
    return (
      <Picker
        selectedValue={selectedValues[index]}
        style={{ marginLeft: -10 }}
        onValueChange={(itemValue) => handlePickerChange(itemValue, index)}
      >
        <Picker.Item label="--" value="--" />
        {defaultHarflar.map((harf) => (
          <Picker.Item style={{ fontSize: 14 }} key={harf} label={harf} value={harf} />
        ))}
        {!defaultHarflar.includes(selectedHarfNotu) && selectedHarfNotu !== '--' && (
          <Picker.Item style={{ fontSize: 14 }} label={selectedHarfNotu} value={selectedHarfNotu} />
        )}
      </Picker>
    );
  };

  useEffect(() => {
    AsyncStorage.getItem('dersler').then((dersler) => {
      if (JSON.parse(dersler).length > 0) setDersler(JSON.parse(dersler));
      else setLoading(false);
    });
    AsyncStorage.getItem('GPAInfo').then((GPAInfo) => {
      if (GPAInfo) {
        const GPAInfoParsed = JSON.parse(GPAInfo);
        setGPAInfo(GPAInfoParsed);
      }
    });
  }, []);

  useEffect(() => {
    if (dersler.length > 0) {
      setOriginalValues(dersler.map((ders) => (ders.harfNotu ? ders.harfNotu : '--')));
      setSelectedValues(dersler.map((ders) => (ders.harfNotu ? ders.harfNotu : '--')));

      const data = [];
      dersler.forEach((ders) => {
        data.push([ders.dersAdi, '']);
      });
      setDerslerData(data);
    }
  }, [dersler]);

  useEffect(() => {
    if (derslerData.length > 0) setLoading(false);
  }, [derslerData]);

  useEffect(() => {
    if (selectedValues.length > 0 && GPAInfo) {
      setCGPA(calculateCGPA());
      setGPA(calculateGPA());
    }
  }, [selectedValues, GPAInfo]);

  function calculateCGPA() {
    let totalPuan = GPAInfo.totalPuan;
    let totalAktsOrKredi = GPAInfo.totalAktsOrKredi;
    const DNLL = GPAInfo.duplicateNoLetterLessons;
    selectedValues.forEach((harfNotu, index) => {
      if (ortalamaKatilmazHarflar.includes(harfNotu)) {
        // Check if the selected harfNotu doesnt affect the average
        if (ortalamaKatilmazHarflar.includes(dersler[index].harfNotu)) return; // If lesson was already not included in the real average, do nothing
        let puan = GPAInfo.harfKatsayi[dersler[index].harfNotu];
        totalPuan -= (puan ?? 0) * dersler[index].aktsOrKredi;
        totalAktsOrKredi -= dersler[index].aktsOrKredi;
      } else if (ortalamaKatilmazHarflar.includes(dersler[index].harfNotu) && !DNLL.includes(dersler[index].dersAdi)) {
        // If the selected harfNotu affects the average, and if the lesson was not included in the real average add it
        let puan = GPAInfo.harfKatsayi[harfNotu];
        totalPuan += (puan ?? 0) * dersler[index].aktsOrKredi;
        totalAktsOrKredi += dersler[index].aktsOrKredi;
      } else {
        // If the selected harfNotu affects the average, and if the lesson was included in the real average, update it
        let puan = GPAInfo.harfKatsayi[harfNotu];
        let oldPuan = GPAInfo.harfKatsayi[dersler[index].harfNotu];
        totalPuan = totalPuan - (oldPuan ?? 0) * dersler[index].aktsOrKredi + (puan ?? 0) * dersler[index].aktsOrKredi;
      }
    });
    if (totalAktsOrKredi === 0) return 0;
    return (totalPuan / totalAktsOrKredi).toFixed(2);
  }

  const calculateGPA = () => {
    let totalPuan = 0;
    let totalAktsOrKredi = 0;
    selectedValues.forEach((harfNotu, index) => {
      if (ortalamaKatilmazHarflar.includes(harfNotu)) return;
      let puan = GPAInfo.harfKatsayi[harfNotu];
      totalPuan += (puan ?? 0) * dersler[index].aktsOrKredi;
      totalAktsOrKredi += dersler[index].aktsOrKredi;
    });
    if (totalAktsOrKredi === 0) return 0;
    return (totalPuan / totalAktsOrKredi).toFixed(2);
  };

  // Handle app state change
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        setLoading(true);
        AsyncStorage.getItem('dersler').then((dersler) => {
          if (JSON.parse(dersler).length > 0) setDersler(JSON.parse(dersler));
          else setLoading(false);
        });
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.marksOuterContainer}>
      <View style={styles.innerContainer}>
        <Text style={[styles.pageTitle]}>{t('marksSimulatorTitle')}</Text>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            width: '100%',
            marginBottom: 10,
          }}
        >
          <Text
            style={[
              styles.paragraph,
              {
                color:
                  originalValues.length > 0 &&
                  selectedValues.length > 0 &&
                  JSON.stringify(originalValues) !== JSON.stringify(selectedValues)
                    ? 'blue'
                    : Colors.text,
              },
            ]}
          >
            {t('cgpa')}: {CGPA}
          </Text>

          <TouchableOpacity
            onPress={() => {
              if (originalValues.length > 0) setSelectedValues(originalValues);
            }}
          >
            <FontAwesome5Icon name="undo" size={20} color={Colors.primary} />
          </TouchableOpacity>

          <Text
            style={[
              styles.paragraph,
              {
                color:
                  originalValues.length > 0 &&
                  selectedValues.length > 0 &&
                  JSON.stringify(originalValues) !== JSON.stringify(selectedValues)
                    ? 'blue'
                    : Colors.text,
              },
            ]}
          >
            {t('gpa')}: {GPA}
          </Text>
        </View>

        <Table style={{ flex: 1, width: '100%' }}>
          <Row
            data={tableHeaderData}
            style={styles.marksTableHeader}
            textStyle={styles.marksTableHeaderText}
            flexArr={[1.5, 1]}
          />
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : derslerData.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={[styles.paragraph, { textAlign: 'center' }]}>{i18n.t(`Main.messageRegisterCourse`)}</Text>
            </View>
          ) : (
            <ScrollView>
              {derslerData.map((rowData, index) => (
                <TableWrapper key={index} style={{ flexDirection: 'row' }}>
                  {rowData.map((cellData, cellIndex) => (
                    <Cell
                      key={cellIndex}
                      style={cellIndex === 2 ? { alignItems: 'center' } : {}}
                      data={cellIndex === 1 ? pickerElement(index, selectedValues[index]) : cellData}
                      textStyle={styles.marksRowText}
                      flex={cellIndex === 0 ? 1.5 : cellIndex === 1 && 1}
                    />
                  ))}
                </TableWrapper>
              ))}
            </ScrollView>
          )}
        </Table>
      </View>
    </View>
  );
}
