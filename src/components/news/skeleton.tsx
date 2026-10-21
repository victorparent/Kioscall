import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { COLORS } from './theme';

/** Placeholder shapes shown while the first load is running (less jarring than a lone spinner). */
export function FeedSkeleton() {
  const [pulse] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.45, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }} accessibilityLabel="Chargement de l’actualité">
      <View style={styles.lead} />
      {[0, 1, 2, 3].map(index => (
        <View key={index} style={styles.row}>
          <View style={styles.rowText}>
            <View style={[styles.line, { width: '30%' }]} />
            <View style={[styles.line, { width: '95%', height: 16 }]} />
            <View style={[styles.line, { width: '70%', height: 16 }]} />
          </View>
          <View style={styles.thumb} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lead: { height: 300, borderRadius: 22, backgroundColor: COLORS.surfaceRaised, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 14, paddingVertical: 16 },
  rowText: { flex: 1, gap: 10, justifyContent: 'center' },
  line: { height: 10, borderRadius: 6, backgroundColor: COLORS.surfaceRaised },
  thumb: { width: 104, height: 104, borderRadius: 14, backgroundColor: COLORS.surfaceRaised },
});
