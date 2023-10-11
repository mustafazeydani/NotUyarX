import React, { useContext, useEffect, useState } from 'react';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { useFonts } from 'expo-font';
import { AuthContext } from './context/AuthContext';
import Loader from './components/Loader';

// Screens
import Welcome from './screens/Welcome';
import Login from './screens/Login';

// Main
import Main from './screens/Main';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isLoggedIn } = useContext(AuthContext);
  const [loaded, setLoaded] = useState(false);
  const [fontsLoaded] = useFonts({
    'Poppins-Medium': require('./assets/fonts/Poppins-Medium.ttf'),
  });

  useEffect(() => {
    // Start the loading process if not already started
    if (!loaded) {
      setTimeout(() => {
        setLoaded(true);
      }, 1000);
    }
  }, [loaded]);

  // Main component content
  return (
    <>
      {loaded && isLoggedIn !== null && fontsLoaded ? (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            ...TransitionPresets.SlideFromRightIOS,
          }}
        >
          {isLoggedIn ? (
            <Stack.Screen name="Main" component={Main} />
          ) : (
            <>
              <Stack.Screen name="Welcome" component={Welcome} />
              <Stack.Screen name="Login" component={Login} />
            </>
          )}
        </Stack.Navigator>
      ) : (
        <Loader />
      )}
    </>
  );
};

export default AppNavigator;
