import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from './theme';

/** A thin boundary in the list: what is below was already there at the reader's last visit. */
export function SeenDivider({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 22, paddingBottom: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  text: { color: COLORS.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
