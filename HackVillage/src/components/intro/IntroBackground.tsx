
import { StyleSheet, View } from 'react-native';

export function IntroBackground() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <View style={styles.pinkBlob} />
      <View style={styles.purpleBlob} />

      <View style={styles.glassBubble}>
        <View style={styles.bubbleShine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinkBlob: {
    position: 'absolute',
    top: 65,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,159,187,0.24)',
  },

  purpleBlob: {
    position: 'absolute',
    top: 480,
    left: -125,
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: 'rgba(102,87,232,0.13)',
  },

  glassBubble: {
    position: 'absolute',
    top: 325,
    right: 18,
    width: 65,
    height: 65,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.92)',
  },

  bubbleShine: {
    position: 'absolute',
    top: 11,
    left: 12,
    width: 19,
    height: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    transform: [{ rotate: '-35deg' }],
  },
});
