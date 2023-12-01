import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from "react-native";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import { encrypt, solveCaptcha , CaptchaError } from "../utils/utils";
import { getMarks, getGPAInfo } from "../utils/requests";
import axios from "axios";
import JWT from "expo-jwt";
import Cheerio from "react-native-cheerio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { styles, Colors } from "../components/styles";
import { universities } from "../data/universitiesData";
import { AuthContext } from "../context/AuthContext";
import { SECRET_KEY } from "../utils/constants";
import i18n from "../components/I18n.js";

const Login = ({ navigation }) => {
  const t = (key) => i18n.t(`Login.${key}`);
  const [selectedUniversity, setSelectedUniversity] = useState({
    name: t("loginMessageUniversity"),
    id: "number",
  });
  const [inputs, setInputs] = useState({ studentId: "", password: "" });
  const [isClicked, setIsClicked] = useState(null);
  const [uniList, setUniList] = useState(universities);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInputs, setFocusedInputs] = useState([]);
  const { isLoggedIn, login } = useContext(AuthContext);

  const handleFocus = (index) => {
    const newFocusedInputs = [...focusedInputs];
    newFocusedInputs[index] = true;
    setFocusedInputs(newFocusedInputs);
  };

  const handleBlur = (index) => {
    const newFocusedInputs = [...focusedInputs];
    newFocusedInputs[index] = false;
    setFocusedInputs(newFocusedInputs);
  };

  // Filter universities according to search input
  const onSearch = (text) => {
    const filteredList = universities.filter((university) => {
      return university.name.toUpperCase().includes(text.toUpperCase());
    });
    setUniList(filteredList);
  };

  // Check if inputs are empty
  const checkInputs = () => {
    if (selectedUniversity.name === t("loginMessageUniversity")) {
      setError(t("universityError"));
      return false;
    }
    if (inputs.studentId === "") {
      setError(selectedUniversity.id === "number" ? t("studentIdError") : t("usernameError"));
      return false;
    }
    if (inputs.password === "") {
      setError(t("passwordError"));
      return false;
    }
    return true;
  };

  // Login check. If log in is successful, save inputs and selected university to SecureStore
  const handleLogin = async () => {
    Keyboard.dismiss();
    if (checkInputs()) {
      try {
        if (error) setError(""); // Clear error if there is any
        setLoading(true); // Start loading animation inside button

        // Get cookies
        const firstRequest = await axios.get(
          `${selectedUniversity.host}/oibs/ogrenci/login.aspx`,
          {
            withCredentials: false,
          }
        );
        const cookies = firstRequest.headers["set-cookie"];

        // Get captcha image and read it as base64
        const secondRequest = await axios.get(
          `${selectedUniversity.host}/oibs/captcha/CaptchaImg.aspx`,
          {
            responseType: "blob",
            withCredentials: false,
            headers: {
              Cookie: cookies,
            },
          }
        );
        const blob = secondRequest.data;
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const decodedImageData = reader.result.split(",")[1];

            // Create JWT token for authenticating captcha solution request
            const token = JWT.encode({}, SECRET_KEY, { expiresIn: "5s" });

            // Solve captcha
            const captchaSolution = await solveCaptcha(token, decodedImageData);

            // Send login request
            const loginResponse = await axios.post(
              `${selectedUniversity.host}/oibs/ogrenci/login.aspx`,
              {
                __EVENTTARGET: "btnLogin",
                txtParamT01: inputs.studentId,
                txtParamT1: encrypt(inputs.password),
                txtSecCode: captchaSolution,
              },
              {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Cookie: cookies,
                  Referer: `${selectedUniversity.host}/oibs/ogrenci/login.aspx`
                },
                withCredentials: false,
              }
            );

            // Load login response to Cheerio
            let $ = Cheerio.load(loginResponse.data);

            // Check if login failed
            const error = $("#lblSonuclar");
            if (error.length) {
              if (error.text().includes("Güvenlik kodu hatalı girildi !"))
                throw new CaptchaError(t("captchaError"));
              throw new Error(error.text());
            } 

            // Get not list path and mainUrl
            const notListElement = $(
              'a:has(p:contains("Not Liste"):not(:contains("Haz. Not Listesi")))'
            );
            const notListPath = $(notListElement).attr("onclick").split("'")[1];

            const mainUrl = loginResponse.request.responseURL;

            // Get the marks and save them to AsyncStorage (Multiple Promise Request)
            const notList = await getMarks(
              selectedUniversity.host,
              notListPath,
              cookies,
              mainUrl
            );

            if(notList.length !== 0) {
              const transkriptSenaryosuElement = $(
                'a:has(p:contains("Transkript Senaryosu"))'
              );
              const transkriptSenaryosuPath = $(transkriptSenaryosuElement).attr("onclick").split("'")[1];

              const GPAInfo = await getGPAInfo(
                selectedUniversity.host,
                transkriptSenaryosuPath,
                cookies,
                mainUrl,
                notList
              )
              await AsyncStorage.setItem("GPAInfo", JSON.stringify(GPAInfo));
            }
            
            // Save inputs and selected university to SecureStore
            await SecureStore.setItemAsync("inputs", JSON.stringify(inputs));
            await AsyncStorage.setItem(
              "selectedUniversity",
              JSON.stringify(selectedUniversity)
            );
            await AsyncStorage.setItem("dersler", JSON.stringify(notList));
            await AsyncStorage.setItem(
              "isSessionActive",
              JSON.stringify(false)
            );

            setLoading(false); // Stop loading animation inside button
            login(); // Set isLoggedIn to true in AuthContext
          } catch (error) {
            if(error instanceof CaptchaError){
              handleLogin()
            }else{
              setLoading(false);
              setError(error.message);
            }
          }
        };
      } catch (error) {
        setLoading(false);
        setError(error.message);
      }
    }
  };

  // After login, navigate to Main screen
  useEffect(() => {
    if (isLoggedIn) navigation.navigate("Main");
  }, [isLoggedIn]);

  // Reset university list when dropdown is closed
  useEffect(() => {
    if (isClicked === false) setUniList(universities);
  }, [isClicked]);

  return (
    <View style={styles.outerContainer}>
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          if (isClicked)
            setIsClicked(false);
        }}
      >
        <View style={styles.innerContainer}>
          <Image
            style={styles.pageLogo}
            source={require("../assets/logo.png")}
          />
          <Text style={styles.pageTitle}>{(t("loginTitle"))}</Text>
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              style={styles.dropDownSelector}
              onPress={() => {
                setIsClicked(!isClicked);
              }}
            >
              <Text>{selectedUniversity.name}</Text>
              <FontAwesome5
                name={isClicked ? "angle-up" : "angle-down"}
                size={20}
              />
            </TouchableOpacity>

            {isClicked && (
              <View style={styles.dropDownArea}>
                <TextInput
                  style={styles.searchBar}
                  placeholder={t("universitySearchPlaceHolder")}
                  onChangeText={(text) => {
                    onSearch(text);
                  }}
                />
                {uniList.length === 0 ? (
                  <Text style={{ marginVertical: 15, textAlign: "center" }}>
                    Üniversite bulunamadı
                  </Text>
                ) : (
                  <FlatList
                    data={uniList}
                    keyExtractor={(_, index) => index.toString()}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const { name, logo } = item;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.dropDownItem,
                            selectedUniversity.name === name
                              ? { backgroundColor: Colors.disabled }
                              : {},
                          ]}
                          onPress={() => {
                            setSelectedUniversity(item);
                            setIsClicked(false);
                          }}
                        >
                          <Image
                            source={logo}
                            style={{ width: 30, objectFit: "contain" }}
                          />
                          <Text style={{ maxWidth: "80%" }}>{name}</Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </View>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ width: "100%" }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={styles.subTitle}>
                  {selectedUniversity.id === "number"
                    ? t("studentId")
                    : t("studentUsername")}
                </Text>
                <TextInput
                  onFocus={() => handleFocus(0)}
                  onBlur={() => handleBlur(0)}
                  editable={selectedUniversity.name !== t("loginMessageUniversity")}
                  style={[
                    styles.inputField,
                    selectedUniversity.name === t("loginMessageUniversity") && {
                      backgroundColor: Colors.disabled,
                    },
                    focusedInputs[0]
                      ? { borderColor: Colors.primary }
                      : { borderColor: Colors.border },
                  ]}
                  placeholder= {selectedUniversity.id === "number" ? t("studentIdPlaceHolder") : t("studentUsernamePlaceHolder")}
                  onChangeText={(text) => {
                    setInputs({ ...inputs, studentId: text });
                  }}
                />

                <Text style={styles.subTitle}>{t("loginPassword")}</Text>
                <TextInput
                  onFocus={() => handleFocus(1)}
                  onBlur={() => handleBlur(1)}
                  editable={selectedUniversity.name !== t("loginMessageUniversity")}
                  style={[
                    styles.inputField,
                    selectedUniversity.name === t("loginMessageUniversity") && {
                      backgroundColor: Colors.disabled,
                    },
                    focusedInputs[1]
                      ? { borderColor: Colors.primary }
                      : { borderColor: Colors.border },
                  ]}
                  placeholder= {t("passwordPlaceHolder")}
                  secureTextEntry={true}
                  onChangeText={(text) => {
                    setInputs({ ...inputs, password: text });
                  }}
                />
                {error && (
                  <Text
                    style={[styles.errorMessage, { alignSelf: "flex-start" }]}
                  >
                    {error}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  if (!loading) handleLogin();
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.buttonText}>{t("loginButton")}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
};

export default Login;