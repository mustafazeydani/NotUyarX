import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import 
  React, 
  { 
    useState, 
    useEffect, 
    useContext,
  } from "react";
import { styles, Colors } from "../components/styles";
import { AuthContext } from "../context/AuthContext";
import * as Notifications from "expo-notifications";
import * as Battery from 'expo-battery';
import { startActivityAsync, ActivityAction } from 'expo-intent-launcher';
import {
  defineTask,
  setNotificationHandler,
  registerBackgroundFetchAsync,
  unregisterBackgroundFetchAsync,
} from "../utils/handleBackgroundTask";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../components/I18n.js";
import { TextInput } from "react-native-gesture-handler";
import { BACKGROUND_FETCH_TASK, AD_KEYWORDS } from "../utils/constants";
import * as TaskManager from "expo-task-manager";

setNotificationHandler();
defineTask();

export default function MarksAlert({ navigation }) {
  const t = (key) => i18n.t(`MarksAlert.${key}`);
  const [isIntervalOn, setIsIntervalOn] = useState(null);
  const [isAdReady, setIsAdReady] = useState(false);
  const [intervalDuration, setIntervalDuration] = useState('30'); // Default interval duration 
  const [customIntervalDuration, setCustomIntervalDuration] = useState('');
  const [selectedOption, setSelectedOption] = useState(2); // For styling the selected option
  const [isCustomClicked, setIsCustomClicked] = useState(false); // For showing the custom interval duration input
  const [durationError, setDurationError] = useState(false);
  const [isPro, setIsPro] = useState(true); // This should be edited
  const [message, setMessage] = useState(null);
  const { isLoggedIn } = useContext(AuthContext);

  // Set the interval state to the last state on first app load
  useEffect(() => {
    AsyncStorage.getItem("intervalLastOption").then((value) => {
      if (value !== null) {
        setIntervalDuration(value);
        setCustomIntervalDuration(value);
        setSelectedOption(1);
      };
    });
    AsyncStorage.getItem("intervalLastState").then((value) => {
      if (JSON.parse(value) === true) setIsIntervalOn(true);
    });
  }, []);

  // Notifications permission check
  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } =
        await Notifications.requestPermissionsAsync();
      if (newStatus !== "granted") {
        showPermissionDeniedAlert();
        return false;
      }
    }
    return true;
  };

  const showPermissionDeniedAlert = async () => {
    Alert.alert(
      t('warningTitle'),
      t('notificationPermissionWarningMessage'),
      [
        {
          text: "OK",
          onPress: () => {},
        },
      ]
    );
  };

  const checkOptimization = async () => {
    try {
      const isOptimizationEnabled = await Battery.isBatteryOptimizationEnabledAsync();
  
      if (isOptimizationEnabled) {
        return new Promise((resolve) => {
          Alert.alert(
            t("warningTitle"),
            t("batteryOptimizationWarningMessage"),
            [
              {
                text: t("optimizationSettingsButton"),
                onPress: () => {
                  startActivityAsync(ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                  resolve(false); // Resolve with false for optimization settings
                },
              },
              {
                text: t("laterButton"),
                onPress: () => {
                  resolve(true); // Resolve with true for handling later
                },
              },
            ]
          );
        });
      } else {
        return true; // Optimization is not enabled
      }
    } catch (error) {
      setMessage(error.message);
      return false; // Error occurred
    }
  };

  // Check if all marks are completed before starting the interval
  const checkCompleted = (dersler) => {
    dersler.forEach((item) => {
      if (item.durum === "Sonuçlandırılmadı") return false;
    });
    return true;
  };

  // Handle select interval duration option
  const handleOptionChange = (option) => {
    setSelectedOption(option);
    if(option === 1) {
      setIsCustomClicked(true);
      setCustomIntervalDuration(prevDuration => prevDuration);
    }
    else if(option === 2) {
      if(isCustomClicked) 
        setIsCustomClicked(false);
      AsyncStorage.getItem("intervalLastOption").then((value) => {
        if(value !== null) 
          AsyncStorage.removeItem("intervalLastOption");
      });
      setIntervalDuration('30');
    }
  };

  const handleChangeText = (text) => {
    if(durationError)
      setDurationError(false);
    const numericValue = Number(text);
    // Check if the numericValue is within the desired range (e.g., 0 to 60)
    if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= 60) {
      setCustomIntervalDuration(text); // Update the state if the value is within range
    }
    else {
      setDurationError(true); 
      setCustomIntervalDuration(''); 
    }
  };

  const handleCustomIntervalSave = () => {
    if(customIntervalDuration === '') { 
      setDurationError(true);
    }
    else if(!durationError) {
      const duration = Number(customIntervalDuration);
      if(duration<=5) {
        Alert.alert(
          t("warningTitle"),
          t("batteryWarningMessage"),
          [
            {
              text: t("alertButton"),
              onPress: () => {},
            },
          ]
        );
      }
      AsyncStorage.setItem("intervalLastOption", customIntervalDuration);
      setIntervalDuration(customIntervalDuration);   
      setIsCustomClicked(false);
    }
  };

  const startInterval = () => {
    setIsIntervalOn(true);
    AsyncStorage.setItem("intervalLastState", JSON.stringify(true));
    setMessage(t("messageIntervalStart"));
  };
  
  const stopInterval = () => {
    setIsIntervalOn(false);
    AsyncStorage.setItem("intervalLastState", JSON.stringify(false));
    setMessage(null);
  };
  
  // Toggle interval
  const toggleInterval = async () => {
    if(!isIntervalOn) {
      if(isCustomClicked)
        setMessage(t('saveCustomIntervalError'));

      else if(await checkPermissions() && await checkOptimization()) {
        const dersler = JSON.parse(await AsyncStorage.getItem("dersler"));
        
        if (dersler.length === 0) 
          setMessage(i18n.t(`Main.messageRegisterCourse`));
        
        // else if (checkCompleted(dersler)) {
          // setMessage(t("messageAllCompleted"));

        // if(isAdReady) {
        //   interstitial.show();
        //   setIsAdReady(false);
        // }
        // else
          startInterval();
      }
    }
    else {
      stopInterval(); 
    // if (!isAdReady) 
    //   interstitial.load();
    }
  };


  // Register/unregister background fetch task
  useEffect(() => {
    TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK).then((res) => {
      if (isIntervalOn === true && !res) {
        registerBackgroundFetchAsync(Number(intervalDuration));
      } else if (isIntervalOn === false && res) {
        unregisterBackgroundFetchAsync();
      }
    });
  }, [isIntervalOn]);

  // Navigate to welcome screen when logout is successful
  useEffect(() => {
    if (!isLoggedIn) {
      navigation.navigate("Welcome");
    }
  }, [isLoggedIn]);

  return (
    <View style={styles.outerContainer}>
      <View style={styles.innerContainer}>
        {/* <View style={{marginTop: 10}}>
          <BannerAd
            unitId={adUnitIdBanner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
          />
        </View> */}
        <Text style={styles.pageTitle}>{t("marksAlertTitle")}</Text>
        <View style={[styles.rowContainer, {justifyContent: 'space-around'}]}>
          <View style={{flexDirection: 'row', alignItems:'center', gap: 15}}>
            <View style={{position: 'relative'}}>
                <TouchableOpacity
                  style={[
                    styles.intervalOption,
                    selectedOption === 1
                      ? styles.selected
                      : (!isPro || isIntervalOn) && { backgroundColor: Colors.disabled },
                  ]}
                  disabled={!isPro || isIntervalOn}
                  onPress={() => {
                    if(!isCustomClicked) { // First click, button text is 'Custom interval'
                      handleOptionChange(1);
                    }
                    else { // Second click, button text is 'Save'
                      handleCustomIntervalSave(); 
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.paragraph,
                      { color: selectedOption === 1 ? Colors.white : Colors.text },
                    ]}
                  >
                    {(selectedOption === 1 && isCustomClicked) ? t('save') : t('customInterval')}
                  </Text>
                </TouchableOpacity>
                {!isPro &&
                  <View style={styles.proTag}>
                    <Text style={[styles.paragraph, {fontSize: 12}]}>
                      Pro
                    </Text>
                  </View>
                }
              </View>
              {isCustomClicked &&
              <View>
                <View style={{position: 'relative', flexDirection: 'row', alignItems: 'center'}}>
                  <TextInput 
                    style={styles.customIntervalInput}
                    value={customIntervalDuration}
                    onChangeText={handleChangeText}
                    keyboardType="numeric" 
                  />
                  <Text style={styles.paragraph}> {t('minutes')}</Text>
                </View>

                {durationError && <Text style={styles.durationError}>{t('durationError')}</Text>}
              </View> 
            } 
          </View>

          <TouchableOpacity
            style={[
              styles.intervalOption,
              selectedOption === 2
                ? styles.selected
                : isIntervalOn && { backgroundColor: Colors.disabled },
            ]}
            disabled={isIntervalOn}
            onPress={() => handleOptionChange(2)}
          >
            <Text
              style={[
                styles.paragraph,
                { color: selectedOption === 2 ? Colors.white : Colors.text },
              ]}
            >
              {t("freeOption")}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <TouchableOpacity
            style={[
              styles.dot,
              styles.center,
              {
                backgroundColor: !isIntervalOn ? Colors.gray : Colors.primary,
              },
            ]}
            onPress={toggleInterval}
          >
            <Text style={[styles.buttonText, { fontSize: 24 }]}>
              {!isIntervalOn ? t("buttonTitleStart") : t("buttonTitleStop")}
            </Text>
          </TouchableOpacity>
        </View>

        {message && (
          <Text
            style={{ position: "absolute", bottom: 0, color: Colors.danger }}
          >
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}
