import React, { useState, useEffect, useRef, useContext } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View } from "react-native";
import FontAwesome5Icon from "@expo/vector-icons/FontAwesome5";
import { Colors } from "../components/styles";
import { AppState } from "react-native";
import { AuthContext } from "../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import i18n from "../components/I18n.js";

// Header
import Header from "../components/Header";

// Screens
import MarksAlert from "./MarksAlert";
import Marks from "./Marks";
import MarksSimulator from "./MarksSimulator";

const Tab = createBottomTabNavigator();

export default function Main() {
  const t = (key) => i18n.t(`Main.${key}`);
  const { logout } = useContext(AuthContext);
  const [viewHeight, setViewHeight] = useState(0);

  const handleLayout = (event) => { // set fixed height for the view (Prevents the view from jumping when the keyboard is opened)
    const { height } = event.nativeEvent.layout;
    setViewHeight(height);
  };

  // Send and dismiss sticky notification on app state change
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        SecureStore.getItemAsync("inputs").then((inputs) => {
          if (!inputs) logout();
        });
        AsyncStorage.getItem("stickyNotificationId").then((value) => {
          if (value !== null)
            Notifications.dismissNotificationAsync(JSON.parse(value));
        });
      } else {
        AsyncStorage.getItem("intervalLastState").then((value) => {
          if (JSON.parse(value) === true) {
            Notifications.scheduleNotificationAsync({
              content: {
                title: t('stickyNotificationTitle'),
                body: t('stickyNotificationMessage'),
                sticky: true,
              },
              trigger: null,
            }).then((notificationId) => {
              AsyncStorage.setItem(
                "stickyNotificationId",
                JSON.stringify(notificationId)
              );
            });
          }
        });
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, minHeight: viewHeight }} onLayout={handleLayout}>
      <Tab.Navigator
        initialRouteName={"MarkChecker"}
        screenOptions={({ route }) => ({
          unmountOnBlur: true,
          tabBarActiveTintColor: Colors.primary,
          tabBarStyle: { padding: 10, height: 70 },
          tabBarLabelStyle: {
            paddingBottom: 5,
            fontSize: 12,
            fontFamily: "Poppins-Medium",
          },
          header: () => <Header />,
          tabBarIcon: ({ color, size }) => {
            let iconName;
            let rn = route.name;
            if (rn === t('iconTitleChecker')) {
              iconName = "redo";
            } else if (rn === t('iconTitleMarks')) {
              iconName = "list";
            }
            else if (rn === t('iconTitleMarksSimulator')) {
              iconName = "calculator";
            }
            return <FontAwesome5Icon name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name={t('iconTitleChecker')} component={MarksAlert} />
        <Tab.Screen name={t('iconTitleMarks')} component={Marks} />
        <Tab.Screen name={t('iconTitleMarksSimulator')} component={MarksSimulator} />
      </Tab.Navigator>
    </View>
  );
}
