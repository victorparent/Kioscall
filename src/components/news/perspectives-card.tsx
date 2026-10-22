import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Outlet, Perspectives, Story } from '@/lib/news';
import { fetchPerspectives } from '@/lib/perspectives';
import { COLORS } from './theme';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: Perspectives }
  | { status: 'error'; message: string }
  | { status: 'unavailable' };

/**
 * "Ce qui change d'un média à l'autre": an on-demand comparison written by the
 * AI from the titles and chapôs only. It is generated on request (not for every
 * story) and clearly labelled as AI.
 */
export function PerspectivesCard({ story, outlets }: { story: Story; outlets: Outlet[] }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function compare() {
    setState({ status: 'loading' });
    const result = await fetchPerspectives(story);
    setState(result);
  }

  // No server or no API key: the chapôs below already let the reader compare by hand.
  if (state.status === 'unavailable') return null;

  const colorOf = (name: string) => outlets.find(outlet => outlet.name === name)?.color ?? COLORS.muted;
  const initialsOf = (name: string) => outlets.find(outlet => outlet.name === name)?.initials ?? name.slice(0, 2);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="git-compare-outline" size={20} color={COLORS.accent} />
        <Text style={styles.title}>Ce qui change d’un média à l’autre</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>IA</Text>
        </View>
      </View>

      {state.status === 'idle' && (
        <>
          <Text style={styles.text}>
            Les points communs, et ce que chaque média met en avant, à partir de leurs titres et chapôs.
          </Text>
          <Pressable onPress={compare} accessibilityRole="button" style={styles.button}>
            <Text style={styles.buttonText}>Comparer les angles</Text>
          </Pressable>
        </>
      )}

      {state.status === 'loading' && (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={styles.text}>Lecture des articles…</Text>
        </View>
      )}

      {state.status === 'error' && (
        <>
          <Text style={[styles.text, { color: COLORS.danger }]}>{state.message}</Text>
          <Pressable onPress={compare} accessibilityRole="button" style={styles.buttonGhost}>
            <Text style={styles.buttonGhostText}>Réessayer</Text>
          </Pressable>
        </>
      )}

      {state.status === 'ok' && (
        <>
          {state.data.common.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.label}>POINTS COMMUNS</Text>
              {state.data.common.map(line => (
                <View key={line} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.text}>{line}</Text>
                </View>
              ))}
            </View>
          )}

          {state.data.angles.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.label}>CE QUE CHAQUE MÉDIA MET EN AVANT</Text>
              {state.data.angles.map(item => (
                <View key={item.outlet} style={styles.angleRow}>
                  <View style={[styles.logo, { backgroundColor: colorOf(item.outlet) }]}>
                    <Text style={styles.logoText}>{initialsOf(item.outlet)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.outlet}>{item.outlet}</Text>
                    <Text style={styles.text}>{item.angle}</Text>
                    {item.quote ? <Text style={styles.quote}>« {item.quote} »</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {state.data.note ? <Text style={styles.note}>{state.data.note}</Text> : null}
          {state.data.common.length === 0 && state.data.angles.length === 0 && !state.data.note ? (
            <Text style={styles.note}>Les chapôs sont trop proches pour dégager des différences.</Text>
          ) : null}

          <Text style={styles.disclaimer}>
            Synthèse générée par IA à partir des seuls titres et chapôs. Chaque point est appuyé par une
            citation vérifiée par le serveur, mais l’IA peut se tromper : vérifie dans les articles.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
    marginBottom: 28,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '800', flex: 1 },
  badge: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { color: COLORS.accent, fontSize: 11, fontWeight: '900' },
  text: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: { color: COLORS.bg, fontSize: 15, fontWeight: '800' },
  buttonGhost: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonGhostText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  block: { gap: 8 },
  label: { color: COLORS.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: COLORS.accent, fontSize: 15, lineHeight: 22 },
  angleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  logo: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  logoText: { color: '#151520', fontSize: 11, fontWeight: '900' },
  outlet: { color: COLORS.text, fontSize: 14, fontWeight: '800', marginBottom: 1 },
  note: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  quote: { color: COLORS.muted, fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginTop: 3 },
  disclaimer: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
});
