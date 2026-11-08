
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  INTRO_COLORS as C,
  INTRO_FONTS as F,
} from '../../constants/introTheme';

export function WavingMascot() {
  const wave = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const waving = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 350,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: -1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: 1,
          duration: 350,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.delay(800),
      ])
    );

    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -6,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    waving.start();
    floating.start();

    return () => {
      waving.stop();
      floating.stop();
    };
  }, [wave, float]);

  const waveRotation = wave.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-28deg', '-8deg', '24deg'],
  });

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.stage}>
        {/* Translucent glass bubble */}
        <View style={styles.glassBubble}>
          <View style={styles.shine} />
        </View>

        {/* Decorative bubbles */}
        <View style={styles.pinkBubble} />
        <View style={styles.purpleBubble} />

        {/* Ground platform */}
        <View style={styles.platform} />
        <View style={styles.shadow} />

        {/* Your mascot */}
        <Animated.View
          style={[
            styles.character,
            { transform: [{ translateY: float }] },
          ]}
        >
          <Image
            source={require('../../../assets/images/Intro_man_face_no_left_arm.png')}
            resizeMode="contain"
            style={styles.characterImage}
          />

          {/* Character's left arm: animated separately */}
          <Animated.View
            style={[
              styles.armJoint,
              { transform: [{ rotate: waveRotation }] },
            ]}
          >
            <Image
              source={require('../../../assets/images/Left Arm.png')}
              resizeMode="stretch"
              style={styles.armImage}
            />
          </Animated.View>
        </Animated.View>
      </View>

      <Text style={styles.caption}>
        Your next friendship starts here ♡
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
  },

  stage: {
    width: 300,
    height: 285,
    position: 'relative',
    alignSelf: 'center',
  },

  glassBubble: {
    position: 'absolute',
    top: 8,
    left: 30,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.27)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.87)',
  },

  shine: {
    position: 'absolute',
    top: 25,
    left: 38,
    width: 22,
    height: 65,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.54)',
    transform: [{ rotate: '28deg' }],
  },

  pinkBubble: {
    position: 'absolute',
    top: 40,
    right: 3,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,159,187,0.45)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  purpleBubble: {
    position: 'absolute',
    top: 142,
    left: 2,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: 'rgba(102,87,232,0.22)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  platform: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: 240,
    height: 48,
    borderRadius: 100,
    backgroundColor: C.violet,
  },

  shadow: {
    position: 'absolute',
    bottom: 31,
    alignSelf: 'center',
    width: 125,
    height: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(35,20,78,0.18)',
  },

  character: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 300,
    height: 285,
  },

  characterImage: {
    position: 'absolute',
    left: 62,
    top: -15,
    width: 175,
    height: 311,
  },

  armJoint: {
    position: 'absolute',
    left: 208,
    top: 129,
    width: 1,
    height: 1,
  },

  armImage: {
    position: 'absolute',
    left: 0,
    top: -5,
    width: 43,
    height: 65,
  },

  caption: {
    marginTop: 2,
    fontFamily: F.medium,
    fontSize: 14,
    color: C.violetDark,
    textAlign: 'center',
  },
});
