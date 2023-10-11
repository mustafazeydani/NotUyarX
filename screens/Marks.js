import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from "react-native";
import { Table, Row, Cell, TableWrapper } from "react-native-reanimated-table";
import { styles, Colors } from "../components/styles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FontAwesome5Icon from "@expo/vector-icons/FontAwesome5";
import * as SecureStore from "expo-secure-store";
import { handleSession } from "../utils/handleBackgroundTask";
import { getMarks, getGPAInfo } from "../utils/requests";
import i18n from "../components/I18n.js";

export default function Marks() {
  const t = (key) => i18n.t(`Marks.${key}`);
  const [dersler, setDersler] = useState([]);
  const [derslerData, setDerslerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState(null);
  const tableHeaderData = [
    "Ders Adı",
    "S.Durum",
    "Sınav Notları",
    "Ort",
    "Not",
    "Durumu",
  ];

  useEffect(() => {
    checkTimer();
    AsyncStorage.getItem("dersler").then((dersler) => {
      if (dersler && JSON.parse(dersler).length > 0) setDersler(JSON.parse(dersler));
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (dersler.length > 0) {
      const data = [];
      dersler.forEach((ders) => {
        const { dersAdi, durum, sinavlar, ort, tskor, harfNotu, durumu } = ders;
        let joinedSinavlar = "";
        sinavlar.forEach((sinav, index) => {
          const { sinavAdi, sinavNotu } = sinav;
          joinedSinavlar += 
            sinavAdi + ": " + sinavNotu + (index !== sinavlar.length - 1 ? "\n" : "");
        });
        if(tskor !== "")
          joinedSinavlar += "\nTskor: " + tskor;
        data.push([dersAdi, durum, joinedSinavlar, ort, harfNotu, durumu]);
      });
      setDerslerData(data);
    }
  }, [dersler]);

  useEffect(() => {
    if(derslerData.length > 0) 
      setLoading(false)
  }, [derslerData])

  // Handle app state change
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        setLoading(true);
        checkTimer();
        AsyncStorage.getItem("dersler").then((dersler) => {
          if (dersler && JSON.parse(dersler).length > 0) setDersler(JSON.parse(dersler));
          else setLoading(false);
        });
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let interval;
    if (disabled) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => {
      clearInterval(interval);
    };
  }, [disabled]);

  useEffect(() => {
    if (timer <= 0) {
      setDisabled(false);
      setTimer(0);
    }
  }, [timer]);

  const checkTimer = async () => {
    const lastRefreshTime = await AsyncStorage.getItem("lastRefreshTime");
    if (lastRefreshTime) {
      const currentTime = Math.floor(Date.now() / 1000);
      const timeElapsed = currentTime - parseInt(lastRefreshTime, 10);
      if (timeElapsed < 60) {
        setDisabled(true);
        setTimer(60 - timeElapsed);
      }
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setDisabled(true);
    setTimer(60); // Reset the timer to 60 seconds
    try {
      await AsyncStorage.setItem(
        "lastRefreshTime",
        Math.floor(Date.now() / 1000).toString()
      );

      const host = JSON.parse(
        await AsyncStorage.getItem("selectedUniversity")
      ).host;

      await handleSession(host);

      const notListPath = JSON.parse(
        await SecureStore.getItemAsync("notListPath")
      );
      const mainUrl = JSON.parse(await SecureStore.getItemAsync("mainUrl"));
      const cookies = JSON.parse(await SecureStore.getItemAsync("cookies"));

      const notList = await getMarks(host, notListPath, cookies, mainUrl);

      if(JSON.stringify(notList) !== JSON.stringify(dersler)) { // If there is a change in the marks
        const harfNotuChanged = notList.some((item, index) => item.harfNotu !== dersler[index].harfNotu);
        if(harfNotuChanged || dersler.length === 0) { // If there is a change in the harfNotu or previous list was empty, update the GPAInfo
          const newGPAInfo = getGPAInfo(host, notListPath, cookies, mainUrl, notList);
          await AsyncStorage.setItem("GPAInfo", JSON.stringify(newGPAInfo));
        }
        else { // Set lesson aktsOrKredi from dersler
          dersler.forEach((ders, index) => {
            notList[index].aktsOrKredi = ders.aktsOrKredi;
          })
        }
        await AsyncStorage.setItem("dersler", JSON.stringify(notList));
        setDersler(notList);
        if(notList.length === 0)
          setLoading(false);
      }
      else
        setLoading(false);
    } catch (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  return (
    <View style={styles.marksOuterContainer}>
      <View style={styles.innerContainer}>
        <View style={styles.marksHeader}>
          <Text style={[styles.pageTitle]}>{t("marksTitle")}</Text>
          {disabled && (
            <Text
              style={[
                styles.paragraph,
                {
                  position: "absolute",
                  right: 40,
                  top: "50%",
                  transform: [{ translateY: -11 }],
                },
              ]}
            >
              {timer}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleRefresh}
            style={{
              position: "absolute",
              top: "50%",
              right: 10,
              transform: [{ translateY: -10 }],
            }}
            disabled={disabled || loading}
          >
            <FontAwesome5Icon
              name="sync-alt"
              size={20}
              color={disabled || loading ? Colors.disabled : Colors.primary}
            />
          </TouchableOpacity>
        </View>

        <Table style={{ flex: 1, width: "100%" }}>
          <Row
            data={tableHeaderData}
            style={styles.marksTableHeader}
            textStyle={styles.marksTableHeaderText}
            flexArr={[2, 2.5, 2, 1, 1, 1.5]}
          />
          {loading ? (
            <View style={{ flex: 1, justifyContent: "center"}}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : derslerData.length === 0 && !loading ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={[styles.paragraph, {textAlign: 'center'}]}>{i18n.t(`Main.messageRegisterCourse`)}</Text>
            </View>
          ) : error ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={[styles.paragraph, {textAlign: 'center'}]}>{error}</Text>
            </View>
          ) : (
              <ScrollView>
                {
                  derslerData.map((rowData, index) => (
                    <TableWrapper key={index} style={{ flexDirection: 'row' }}>
                      {rowData.map((cellData, cellIndex) => (
                        <Cell
                          key={cellIndex}
                          data={cellData}
                          textStyle={[
                            styles.marksRowText, 
                            {
                              color: cellIndex === 1 && 
                              cellData === "Sonuçlandırılmadı" ? 
                                "red" : 
                                Colors.text 
                            }
                          ]}
                          flex={
                            cellIndex === 0 ? 2 : 
                            cellIndex === 1 ? 2.5 : 
                            cellIndex === 2 ? 2 : 
                            cellIndex === 3 ? 1 : 
                            cellIndex === 4 ? 1 : 
                            1.5
                          }
                        />
                        ))
                      }
                    </TableWrapper>
                  ))
                }
              </ScrollView>
            )
          }
        </Table>
      </View>
    </View>
  );
}
