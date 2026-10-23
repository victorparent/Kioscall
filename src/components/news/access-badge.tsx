import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Access } from '@/lib/news';
import { COLORS } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const LOOK: Record<Exclude<Access, 'unknown'>, { label: string; icon: IconName; color: string }> = {
  free: { label: 'Gratuit', icon: 'lock-open-outline', color: COLORS.success },
  paid: { label: 'Abonnés', icon: 'lock-closed', color: COLORS.warning },
};

/** "Gratuit" (readable in full) or "Abonnés" (paywall): nothing is shown when it is not known. */
export function AccessBadge({ access }: { access: Access }) {
  // Anything but a known state (an older server, a corrupted answer) simply shows no label.
  const look = (LOOK as Record<string, (typeof LOOK)['free'] | undefined>)[access];
  if (!look) return null;
  return (
    <View
      style={[styles.badge, { borderColor: look.color, backgroundColor: `${look.color}26` }]}
      accessible
      accessibilityLabel={look.label}
    >
      <Ionicons name={look.icon} size={12} color={look.color} />
      <Text style={[styles.text, { color: look.color }]}>{look.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
});
