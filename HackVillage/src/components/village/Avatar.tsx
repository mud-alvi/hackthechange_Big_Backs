import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { BASE_LOOK, type AvatarLook } from '../../types/village';

// Bounds of the visible artwork in your existing 1254 × 1254 PNGs.
// Clip the transparent padding at render time; no modified assets are needed.
const parts = {
  head: { source: require('../../../assets/images/Head.png'), box: [48, 134, 1152, 994] },
  torso: { source: require('../../../assets/images/Torso.png'), box: [164, 162, 918, 978] },
  leftArm: { source: require('../../../assets/images/Left Arm.png'), box: [480, 474, 288, 404] },
  rightArm: { source: require('../../../assets/images/Right Arm.png'), box: [480, 474, 288, 404] },
  leftLeg: { source: require('../../../assets/images/Left Leg.png'), box: [418, 322, 410, 654] },
  rightLeg: { source: require('../../../assets/images/Right Leg.png'), box: [418, 322, 410, 654] },
};
function Part({
  part,
  x,
  y,
  width,
  height,
}: {
  part: { source: ImageSourcePropType; box: number[] };
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const [bx, by, bw, bh] = part.box;
  return (
    <View style={{ position: 'absolute', left: x, top: y, width, height, overflow: 'hidden' }}>
      <Image
        source={part.source}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: (1254 * width) / bw,
          height: (1254 * height) / bh,
          left: (-bx * width) / bw,
          top: (-by * height) / bh,
        }}
      />
    </View>
  );
}
const shirtColors = {
  none: 'transparent',
  violet: '#8872F0',
  mint: '#A2D7BE',
  pink: '#F1A4C6',
  ink: '#292737',
};

export function Avatar({
  look = BASE_LOOK,
  size = 280,
  motion = false,
  platform = true,
}: {
  look?: AvatarLook;
  size?: number;
  motion?: boolean;
  platform?: boolean;
}) {
  const [float] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduceMotion(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!motion || reduceMotion) {
      float.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -5,
          duration: 1600,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [float, motion, reduceMotion]);
  return (
    <View
      accessible
      accessibilityLabel={`Your avatar: ${look.face} face, ${look.shirt === 'none' ? 'baseline body' : look.shirt + ' shirt'}, ${look.headwear === 'none' ? 'no headwear' : look.headwear}`}
      style={{ width: size, height: (size * 345) / 280 }}
    >
      <View
        style={{
          width: 280,
          height: 345,
          transform: [{ scale: size / 280 }],
          transformOrigin: 'top left',
        }}
      >
        {platform && <View style={s.platform} />}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: float }] }]}>
          <Part part={parts.leftLeg} x={94} y={235} width={38} height={62} />
          <Part part={parts.rightLeg} x={151} y={235} width={38} height={62} />
          <Part part={parts.leftArm} x={63} y={189} width={30} height={46} />
          <Part part={parts.rightArm} x={190} y={189} width={30} height={46} />
          <Part part={parts.torso} x={93} y={145} width={97} height={104} />
          {look.shirt !== 'none' && (
            <View style={[s.shirt, { backgroundColor: shirtColors[look.shirt] }]}>
              <View style={s.collar} />
              <Text style={[s.shirtMark, look.shirt === 'ink' && { color: '#FFF' }]}>{'</>'}</Text>
            </View>
          )}
          <Part part={parts.head} x={76} y={33} width={132} height={114} />
          {look.face === 'smirk' && (
            <View style={s.smirkClip}>
              <Image
                source={require('../../../assets/images/man_face.png')}
                style={s.smirkImage}
                resizeMode="stretch"
              />
            </View>
          )}
          {(look.face === 'happy' || look.face === 'sleepy') && (
            <View style={s.face}>
              <View style={s.eyes}>
                <View style={look.face === 'happy' ? s.happyEye : s.sleepyEye} />
                <View style={look.face === 'happy' ? s.happyEye : s.sleepyEye} />
              </View>
              <View style={look.face === 'happy' ? s.smile : s.sleepMouth} />
            </View>
          )}
          {look.headwear === 'cap' && (
            <View style={s.cap}>
              <View style={s.capSeam} />
              <View style={s.brim} />
              <Text style={s.capStar}>✦</Text>
            </View>
          )}
          {look.headwear === 'beanie' && (
            <View style={s.beanie}>
              <View style={s.pom} />
              <View style={s.cuff} />
              <View style={s.beanieLabel} />
            </View>
          )}
          {look.headwear === 'hair' && (
            <View style={s.hair}>
              <View style={s.fringeOne} />
              <View style={s.fringeTwo} />
              <View style={s.fringeThree} />
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  platform: {
    position: 'absolute',
    left: 22,
    top: 182,
    width: 236,
    height: 236,
    borderRadius: 118,
    transform: [{ scaleY: 0.35 }],
    backgroundColor: '#6A51E8',
  },
  shirt: {
    position: 'absolute',
    left: 96,
    top: 159,
    width: 91,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#171719',
    overflow: 'hidden',
  },
  collar: {
    width: 25,
    height: 15,
    backgroundColor: '#FCFCFC',
    borderWidth: 2,
    borderColor: '#171719',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    alignSelf: 'center',
    marginTop: -3,
  },
  shirtMark: {
    textAlign: 'center',
    marginTop: 17,
    fontSize: 18,
    fontWeight: '800',
    color: '#25202F',
  },
  smirkClip: {
    position: 'absolute',
    left: 105,
    top: 73,
    width: 74,
    height: 47,
    borderRadius: 15,
    overflow: 'hidden',
  },
  smirkImage: { position: 'absolute', width: 164, height: 164, left: -45, top: -62 },
  face: { position: 'absolute', left: 110, top: 82, width: 64, height: 39, alignItems: 'center' },
  eyes: { flexDirection: 'row', gap: 21 },
  happyEye: { width: 10, height: 13, backgroundColor: '#181818', borderRadius: 5 },
  sleepyEye: {
    width: 12,
    height: 7,
    borderBottomWidth: 3,
    borderColor: '#181818',
    borderRadius: 8,
  },
  smile: {
    marginTop: 7,
    width: 22,
    height: 13,
    borderBottomWidth: 3,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#181818',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  sleepMouth: {
    marginTop: 10,
    width: 7,
    height: 8,
    borderWidth: 2,
    borderColor: '#181818',
    borderRadius: 5,
  },
  cap: {
    position: 'absolute',
    left: 91,
    top: 23,
    width: 103,
    height: 43,
    backgroundColor: '#8C75EE',
    borderWidth: 2.5,
    borderColor: '#1A1921',
    borderTopLeftRadius: 65,
    borderTopRightRadius: 65,
  },
  capSeam: {
    position: 'absolute',
    left: 50,
    height: 37,
    borderLeftWidth: 1,
    borderColor: '#564097',
  },
  brim: {
    position: 'absolute',
    bottom: -6,
    left: -14,
    width: 124,
    height: 14,
    backgroundColor: '#6A51E8',
    borderWidth: 2.5,
    borderColor: '#1A1921',
    borderRadius: 9,
  },
  capStar: { color: '#FFF', fontSize: 18, position: 'absolute', left: 25, top: 7 },
  beanie: {
    position: 'absolute',
    left: 91,
    top: 19,
    width: 103,
    height: 48,
    backgroundColor: '#A3D5BC',
    borderWidth: 2.5,
    borderColor: '#1A1921',
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
  },
  pom: {
    position: 'absolute',
    top: -12,
    left: 39,
    width: 20,
    height: 20,
    backgroundColor: '#A3D5BC',
    borderWidth: 2,
    borderColor: '#1A1921',
    borderRadius: 12,
  },
  cuff: {
    position: 'absolute',
    bottom: -3,
    left: -5,
    width: 108,
    height: 17,
    backgroundColor: '#81BC9E',
    borderWidth: 2.5,
    borderColor: '#1A1921',
    borderRadius: 5,
  },
  beanieLabel: {
    position: 'absolute',
    bottom: 1,
    left: 44,
    width: 13,
    height: 9,
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  hair: {
    position: 'absolute',
    left: 92,
    top: 28,
    width: 99,
    height: 34,
    backgroundColor: '#3B2A28',
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderWidth: 2,
    borderColor: '#181818',
  },
  fringeOne: {
    position: 'absolute',
    top: 17,
    left: 2,
    width: 34,
    height: 31,
    borderRadius: 20,
    backgroundColor: '#3B2A28',
    transform: [{ rotate: '24deg' }],
  },
  fringeTwo: {
    position: 'absolute',
    top: 13,
    left: 29,
    width: 37,
    height: 27,
    borderRadius: 17,
    backgroundColor: '#3B2A28',
    transform: [{ rotate: '-24deg' }],
  },
  fringeThree: {
    position: 'absolute',
    top: 15,
    right: -1,
    width: 28,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3B2A28',
    transform: [{ rotate: '-24deg' }],
  },
});
