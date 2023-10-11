import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { styles, Colors } from "../components/styles";
import i18n from "../components/I18n.js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const Welcome = ({ navigation }) => {
  const [locale, setLocale] = useState("en");
  const t = (key) => i18n.t(`Welcome.${key}`);

  useEffect(() => {
    AsyncStorage.getItem("lang").then((lang) => {
      if (lang) 
        setLocale(lang);
    });
  }, []);

  const handlePress = () => {
    navigation.navigate("Login");
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.innerContainer}>
        <Image
          style={styles.pageLogo}
          source={require("../assets/logo.png")}
        />
        <View
          style={{ flexDirection: "row", justifyContent: "center", gap: 20 }}
        >
          <TouchableOpacity
            style={[
              styles.languageButton,
              {
                backgroundColor:
                  locale === "en" ? Colors.primary : Colors.white,
              },
              locale !== "en" && {
                borderColor: Colors.primary,
                borderWidth: 1,
              },
            ]}
            onPress={() => {
              i18n.locale = "en";
              setLocale("en");
              AsyncStorage.setItem("lang", "en");
            }}
          >
            <Text
              style={[
                styles.buttonText,
                locale !== "en" && { color: Colors.primary },
              ]}
            >
              EN
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.languageButton,
              {
                backgroundColor:
                  locale === "tr" ? Colors.primary : Colors.white,
              },
              locale !== "tr" && {
                borderColor: Colors.primary,
                borderWidth: 1,
              },
            ]}
            onPress={() => {
              i18n.locale = "tr";
              setLocale("tr");
              AsyncStorage.setItem("lang", "tr");
            }}
          >
            <Text
              style={[
                styles.buttonText,
                locale !== "tr" && { color: Colors.primary },
              ]}
            >
              TR
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Image
            style={styles.welcomeImage}
            source={require("../assets/welcome.png")}
          />
        </View>
        <Text style={[styles.paragraph, { marginVertical: 10 }]}>
          {t("appTagline")}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handlePress}>
          <Text style={styles.buttonText}>{t("startButton")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Welcome;
