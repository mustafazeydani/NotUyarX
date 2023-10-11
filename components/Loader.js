import React from 'react';
import { View, Image, ActivityIndicator } from 'react-native';
import { Colors } from './styles';

const Loader = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Image
        source={require('../assets/logo.png')}
        style={{
          height: 55,
          width: 130,
          zIndex: 1,
        }}
        resizeMode="contain"
      />
      <ActivityIndicator color={Colors.primary} />
    </View>
  );
};

export default Loader;
