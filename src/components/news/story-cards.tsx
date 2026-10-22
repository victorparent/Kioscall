import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Story } from '@/lib/news';
import { relativeTime, storyImage, storyThumb, type StoryStatus, uniqueOutlets } from '@/lib/story-utils';
import { COLORS } from './theme';

type CardProps = {
  story: Story;
  saved: boolean;
  status: StoryStatus;
  onPress: () => void;
  onToggleSave: () => void;
};

function SourceDots({ story }: { story: Story }) {
  const outlets = uniqueOutlets(story);
  return (
    <View style={styles.dots}>
      {outlets.slice(0, 4).map((outlet, index) => (
        <View
          key={outlet.name}
          style={[
            styles.dot,
            { backgroundColor: outlet.color, marginLeft: index === 0 ? 0 : -8, zIndex: 4 - index },
          ]}
        >
          <Text style={styles.dotText}>{outlet.initials.slice(0, 1)}</Text>
        </View>
      ))}
    </View>
  );
}

/** "NOUVEAU" for a story that appeared since the last visit, "+2 articles" for one already read that grew. */
function StatusBadge({ status }: { status: StoryStatus }) {
  if (status.kind === 'new') return <Text style={styles.newText}>NOUVEAU</Text>;
  if (status.kind === 'updated') {
    return (
      <Text style={styles.updatedText}>
        +{status.fresh} article{status.fresh > 1 ? 's' : ''}
      </Text>
    );
  }
  return null;
}

function sourcesLabel(story: Story) {
  const count = uniqueOutlets(story).length;
  return `${count} source${count > 1 ? 's' : ''}`;
}

function SaveButton({ saved, onPress, light }: { saved: boolean; onPress: () => void; light?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Retirer des enregistrés' : 'Enregistrer ce sujet'}
      style={styles.saveButton}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={22}
        color={saved ? COLORS.accent : light ? COLORS.text : COLORS.muted}
      />
    </Pressable>
  );
}

/** The most covered story of the moment, as a large picture card. */
export function LeadCard({ story, saved, status, onPress, onToggleSave }: CardProps) {
  const image = storyImage(story);
  return (
    <View style={styles.lead}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}. ${sourcesLabel(story)}`}
      style={({ pressed }) => [styles.leadPress, pressed && styles.pressed]}
    >
      {image ? (
        <ExpoImage source={{ uri: image }} alt="" style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : null}
      <View style={styles.leadShade}>
        <View style={styles.leadMeta}>
          <View style={styles.leadBadge}>
            <Ionicons name="flame" size={13} color={COLORS.bg} />
            <Text style={styles.leadBadgeText}>Le sujet du moment</Text>
          </View>
          <StatusBadge status={status} />
        </View>
        <Text style={styles.leadTitle} numberOfLines={4}>
          {story.title}
        </Text>
        <View style={styles.leadFooter}>
          <SourceDots story={story} />
          <Text style={styles.leadSub}>
            {sourcesLabel(story)} · {relativeTime(story.publishedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
    {/* Sibling of the card (not a child): a button cannot live inside another button. */}
    <View style={styles.leadSave}>
      <SaveButton saved={saved} onPress={onToggleSave} light />
    </View>
    </View>
  );
}

/** A dense feed row: text on the left, thumbnail on the right. */
export function StoryRow({ story, saved, status, onPress, onToggleSave }: CardProps) {
  const image = storyThumb(story);
  return (
    <View style={styles.row}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}. ${sourcesLabel(story)}`}
      style={({ pressed }) => [styles.rowPress, pressed && styles.pressed]}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <Text style={styles.rowCategory}>{story.category}</Text>
          <StatusBadge status={status} />
          <Text style={styles.rowTime}>· {relativeTime(story.publishedAt)}</Text>
        </View>
        <Text style={[styles.rowTitle, status.kind === 'read' && styles.rowTitleRead]} numberOfLines={4}>
          {story.title}
        </Text>
        <View style={styles.rowFooter}>
          <SourceDots story={story} />
          <Text style={styles.rowSources}>{sourcesLabel(story)}</Text>
        </View>
      </View>
      {image ? (
        <ExpoImage source={{ uri: image }} alt="" style={styles.rowImage} contentFit="cover" transition={150} />
      ) : null}
    </Pressable>
    <View style={[styles.rowSave, image ? { right: 118 } : { right: 0 }]}>
      <SaveButton saved={saved} onPress={onToggleSave} />
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: '#151520', fontSize: 10, fontWeight: '900' },
  saveButton: { padding: 2 },
  newText: { color: COLORS.success, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  updatedText: { color: COLORS.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  lead: {
    height: 300,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceRaised,
    marginBottom: 8,
  },
  leadPress: { flex: 1, justifyContent: 'flex-end' },
  leadSave: { position: 'absolute', right: 16, bottom: 16 },
  leadShade: { backgroundColor: 'rgba(8, 9, 14, 0.78)', padding: 16, gap: 10 },
  leadMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  leadBadgeText: { color: COLORS.bg, fontSize: 12, fontWeight: '800' },
  leadTitle: { color: COLORS.text, fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.4 },
  leadFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leadSub: { color: COLORS.textSecondary, fontSize: 13 },

  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowPress: { flexDirection: 'row', gap: 14, paddingVertical: 16 },
  rowSave: { position: 'absolute', bottom: 14 },
  rowBody: { flex: 1, gap: 8 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowCategory: { color: COLORS.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  rowTime: { color: COLORS.muted, fontSize: 12 },
  rowTitle: { color: COLORS.text, fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  // Already read: the title is dimmed, so the eye goes to what has not been seen.
  rowTitleRead: { color: COLORS.muted },
  rowSources: { color: COLORS.muted, fontSize: 13 },
  rowImage: { width: 104, height: 104, borderRadius: 14, backgroundColor: COLORS.surfaceRaised },
});
