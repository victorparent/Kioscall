import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { fetchAccess } from '@/lib/access';
import { type Access, accessDefault, type Article, type Story } from '@/lib/news';
import {
  formatDateTime,
  groupByOutlet,
  relativeTime,
  shortenText,
  storyImage,
  uniqueOutlets,
} from '@/lib/story-utils';
import { AccessBadge } from './access-badge';
import { COLORS, MAX_WIDTH } from './theme';

type Props = {
  story: Story;
  saved: boolean;
  onBack: () => void;
  onToggleSave: () => void;
  onOpenArticle: (url: string) => void;
  /** Time of the latest article the reader had already seen: newer ones are marked. */
  freshAfter?: number;
};

type Mode = 'outlet' | 'time';

function ArticleRow({
  article,
  showOutlet,
  isFresh,
  access,
  onPress,
}: {
  article: Article;
  showOutlet: boolean;
  isFresh: boolean;
  access: Access;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${article.outlet.name} : ${article.title}`}
      style={({ pressed }) => [styles.article, access === 'paid' && styles.articlePaid, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.articleBody}>
        {showOutlet && (
          <View style={styles.articleOutlet}>
            <View style={[styles.logoSmall, { backgroundColor: article.outlet.color }]}>
              <Text style={styles.logoSmallText}>{article.outlet.initials.slice(0, 2)}</Text>
            </View>
            <Text style={styles.articleOutletName}>{article.outlet.name}</Text>
          </View>
        )}
        <AccessBadge access={access} />
        <Text style={styles.articleTitle}>{article.title}</Text>
        {article.description ? (
          <Text style={styles.articleDescription} numberOfLines={3}>
            {article.description}
          </Text>
        ) : null}
        <View style={styles.articleFooter}>
          <Text style={styles.articleDate}>
            {isFresh ? <Text style={styles.articleFresh}>NOUVEAU  </Text> : null}
            {formatDateTime(article.publishedAt)}
          </Text>
          <Text style={styles.articleRead}>{access === 'paid' ? 'Lire (abonnés)' : 'Lire'}</Text>
          <Ionicons name="open-outline" size={14} color={COLORS.accent} />
        </View>
      </View>
      {article.image ? (
        <ExpoImage source={{ uri: article.image }} alt="" style={styles.articleImage} contentFit="cover" transition={150} />
      ) : null}
    </Pressable>
  );
}

export function StoryDetail({ story, saved, onBack, onToggleSave, onOpenArticle, freshAfter }: Props) {
  const [mode, setMode] = useState<Mode>('outlet');
  const image = storyImage(story);
  const lead = story.articles.find(article => article.description);
  const outletCount = uniqueOutlets(story).length;
  // What the publishers' pages say about each article (free or paid); until the server answers,
  // the outlet's usual model.
  const [verified, setVerified] = useState<Record<string, Access>>({});
  useEffect(() => {
    let cancelled = false;
    fetchAccess(story.articles.map(article => article.url)).then(result => {
      if (!cancelled) setVerified(result);
    });
    return () => {
      cancelled = true;
    };
  }, [story.articles]);
  const accessOf = useCallback(
    (article: Article): Access => verified[article.url] ?? accessDefault(article.outlet.name),
    [verified]
  );
  // Articles that can be read in full come first.
  const groups = useMemo(() => groupByOutlet(story.articles, accessOf), [story.articles, accessOf]);
  const chronological = useMemo(
    () => [...story.articles].sort((a, b) => b.publishedAt - a.publishedAt),
    [story.articles]
  );

  async function share() {
    try {
      await Share.share({ message: `${story.title}\n${story.articles[0].url}` });
    } catch {
      // Sharing is not available everywhere (e.g. desktop browsers): nothing to do.
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={share} hitSlop={10} accessibilityRole="button" accessibilityLabel="Partager" style={styles.iconButton}>
          <Ionicons name="share-outline" size={24} color={COLORS.text} />
        </Pressable>
        <Pressable
          onPress={onToggleSave}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Retirer des enregistrés' : 'Enregistrer ce sujet'}
          style={styles.iconButton}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={saved ? COLORS.accent : COLORS.text}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {image ? (
          <ExpoImage source={{ uri: image }} alt="" style={styles.hero} contentFit="cover" transition={200} />
        ) : null}

        <View style={styles.meta}>
          <Text style={styles.category}>{story.category}</Text>
          <Text style={styles.metaText}>· {relativeTime(story.publishedAt)}</Text>
          <Text style={styles.metaText}>· {outletCount} sources</Text>
        </View>
        <Text style={styles.title}>{story.title}</Text>

        {lead && (
          <View style={styles.essential}>
            <Text style={styles.essentialLabel}>L’ESSENTIEL</Text>
            <Text style={styles.essentialText}>{shortenText(lead.description)}</Text>
            <Text style={styles.essentialSource}>
              {lead.outlet.name} · {formatDateTime(lead.publishedAt)}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Les points de vue</Text>
        <Text style={styles.sectionSub}>
          {`Le même sujet, vu par ${outletCount} rédaction${outletCount > 1 ? 's' : ''}.`}
        </Text>

        <View style={styles.segment}>
          {(
            [
              ['outlet', 'Par média'],
              ['time', 'Chronologique'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setMode(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === key }}
              style={[styles.segmentItem, mode === key && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, mode === key && styles.segmentTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'outlet'
          ? groups.map(group => (
              <View key={group.outlet.name} style={styles.group}>
                <View style={styles.groupHeader}>
                  <View style={[styles.logo, { backgroundColor: group.outlet.color }]}>
                    <Text style={styles.logoText}>{group.outlet.initials}</Text>
                  </View>
                  <Text style={styles.groupName}>{group.outlet.name}</Text>
                  <Text style={styles.groupCount}>
                    {group.articles.length} article{group.articles.length > 1 ? 's' : ''}
                  </Text>
                </View>
                {group.articles.map(article => (
                  <ArticleRow
                    key={article.url}
                    article={article}
                    showOutlet={false}
                    isFresh={freshAfter !== undefined && article.publishedAt > freshAfter}
                    access={accessOf(article)}
                    onPress={() => onOpenArticle(article.url)}
                  />
                ))}
              </View>
            ))
          : chronological.map(article => (
              <ArticleRow
                key={article.url}
                article={article}
                showOutlet
                isFresh={freshAfter !== undefined && article.publishedAt > freshAfter}
                access={accessOf(article)}
                onPress={() => onOpenArticle(article.url)}
              />
            ))}

        {story.aiGrouped && (
          <Text style={styles.aiNote}>
            Regroupement et titre générés par IA à partir des flux des médias. Les articles et leurs
            chapôs sont ceux des rédactions.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  hero: { width: '100%', height: 220, borderRadius: 18, backgroundColor: COLORS.surfaceRaised, marginBottom: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  category: { color: COLORS.accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  metaText: { color: COLORS.muted, fontSize: 13 },
  title: { color: COLORS.text, fontSize: 28, lineHeight: 35, fontWeight: '800', letterSpacing: -0.6, marginBottom: 20 },
  essential: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 8,
    marginBottom: 28,
  },
  essentialLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  essentialText: { color: COLORS.textSecondary, fontSize: 16, lineHeight: 25 },
  essentialSource: { color: COLORS.muted, fontSize: 13 },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  sectionSub: { color: COLORS.muted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  segmentItem: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  segmentItemActive: { backgroundColor: COLORS.accentSoft },
  segmentText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: COLORS.text },
  group: { marginTop: 14 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  logo: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#151520', fontSize: 11, fontWeight: '900' },
  logoSmall: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  logoSmallText: { color: '#151520', fontSize: 9, fontWeight: '900' },
  groupName: { color: COLORS.text, fontSize: 17, fontWeight: '800', flex: 1 },
  groupCount: { color: COLORS.muted, fontSize: 13 },
  article: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  articleBody: { flex: 1, gap: 8 },
  articleOutlet: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  articleOutletName: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  articleTitle: { color: COLORS.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  articleDescription: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  articlePaid: { opacity: 0.78 },
  articleFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  articleDate: { color: COLORS.muted, fontSize: 13, flex: 1 },
  articleFresh: { color: COLORS.success, fontWeight: '800', letterSpacing: 0.5 },
  articleRead: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },
  articleImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: COLORS.surfaceRaised },
  aiNote: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 28 },
});
