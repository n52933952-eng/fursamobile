import React, { useEffect } from 'react'
import { View, Image, StyleSheet, StatusBar, Animated } from 'react-native'
import { colors } from '../../theme'

export default function SplashScreen() {
  const opacity = new Animated.Value(0)
  const scale   = new Animated.Value(0.8)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, friction: 5,   useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },
})
