import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import { openBrowserAsync } from 'expo-web-browser';
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedSkeleton } from '@/components/news/skeleton';
import { LeadCard, StoryRow } from '@/components/news/story-cards';
import { StoryDetail } from '@/components/news/story-detail';
import { COLORS, MAX_WIDTH } from '@/components/news/theme';
import { useNews } from '@/hooks/use-news';
import { useReadingState } from '@/hooks/use-reading-state';
import type { Story } from '@/lib/news';
import {
  formatClock,
  formatToday,
  pickLead,
  sectionize,
  storyStatus,
  uniqueOutlets,
} from '@/lib/story-utils';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Tab = 'home' | 'search' | 'saved';

const ALL_CATEGORY = { name: 'Tout', emoji: '✳️' };

const TABS: { key: Tab; label: string; icon: IconName; iconActive: IconName }[] = [
  { key: 'home', label: 'À la une', icon: 'newspaper-outline', iconActive: 'newspaper' },
  { key: 'search', label: 'Recherche', icon: 'search-outline', iconActive: 'search' },
  { key: 'saved', label: 'Enregistrés', icon: 'bookmark-outline', iconActive: 'bookmark' },
];

export default function HomeScreen() {
  const {
    stories,
    newIds,
    categories: serverCategories,
    aiAvailable,
    loading,
    refreshing,
    error,
    updatedAt,
    refresh,
  } = useNews();

  const [tab, setTab] = useState<Tab>('home');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY.name);
  const [search, setSearch] = useState('');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  /** Time of the latest article already seen when the story was opened: newer ones get marked. */
  const [freshAfter, setFreshAfter] = useState<number | undefined>(undefined);
  // Saved stories, what was read and the last visit are kept on the device.
  const { saved, isSaved, toggleSaved, read, markRead, baseline } = useReadingState(stories);

  const categories = useMemo(() => [ALL_CATEGORY, ...serverCategories], [serverCategories]);
  // The server can retire a rubric: fall back to everything if the chosen one is gone.
  const activeCategory = categories.some(c => c.name === selectedCategory)
    ? selectedCategory
    : ALL_CATEGORY.name;

  const statusOf = useCallback(
    (story: Story) => storyStatus(story, read, baseline, newIds),
    [read, baseline, newIds]
  );

  function openStory(story: Story) {
    setFreshAfter(read[story.id]?.latest);
    markRead(story);
    setSelectedStory(story);
  }

  async function openArticle(url: string) {
    try {
      await openBrowserAsync(url);
    } catch {
      Alert.alert('Lien indisponible', 'Impossible d’ouvrir cet article.');
    }
  }

  // Android back button closes the story before leaving the app.
  useEffect(() => {
    if (!selectedStory) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedStory(null);
      return true;
    });
    return () => subscription.remove();
  }, [selectedStory]);

  const homeStories = useMemo(
    () =>
      stories
        .filter(story => activeCategory === ALL_CATEGORY.name || story.category === activeCategory)
        .sort((a, b) => b.publishedAt - a.publishedAt),
    [stories, activeCategory]
  );
  // The most covered story gets the big card; the rest of the feed stays chronological.
  const lead = useMemo(() => pickLead(homeStories), [homeStories]);
  const sections = useMemo(
    () => sectionize(homeStories.filter(story => story !== lead)),
    [homeStories, lead]
  );

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return stories
      .filter(
        story =>
          story.title.toLowerCase().includes(query) ||
          story.category.toLowerCase().includes(query) ||
          story.summary.toLowerCase().includes(query) ||
          uniqueOutlets(story).some(outlet => outlet.name.toLowerCase().includes(query))
      )
      .sort((a, b) => b.publishedAt - a.publishedAt);
  }, [stories, search]);

  const trending = useMemo(
    () =>
      [...stories]
        .sort((a, b) => uniqueOutlets(b).length - uniqueOutlets(a).length || b.publishedAt - a.publishedAt)
        .slice(0, 6),
    [stories]
  );

  function renderRow(story: Story) {
    return (
      <StoryRow
        key={story.id}
        story={story}
        saved={isSaved(story.id)}
        status={statusOf(story)}
        onPress={() => openStory(story)}
        onToggleSave={() => toggleSaved(story)}
      />
    );
  }

  if (selectedStory) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StoryDetail
          key={selectedStory.id}
          story={selectedStory}
          saved={isSaved(selectedStory.id)}
          onBack={() => setSelectedStory(null)}
          onToggleSave={() => toggleSaved(selectedStory)}
          onOpenArticle={openArticle}
          canCompare={aiAvailable}
          freshAfter={freshAfter}
        />
      </SafeAreaView>
    );
  }

  const statusText = error
    ? 'Hors ligne'
    : updatedAt
      ? `Mis à jour à ${formatClock(updatedAt)}`
      : 'Chargement…';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setTab('home')}
          accessibilityRole="button"
          accessibilityLabel="Accueil"
          style={styles.brand}
        >
          <ExpoImage
            source={require('../../assets/images/Kioskole (1).png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.brandName}>kioscall</Text>
        </Pressable>
        <Pressable
          onPress={refresh}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Actualiser"
          style={styles.iconButton}
        >
          {refreshing ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Ionicons name="refresh" size={22} color={COLORS.text} />
          )}
        </Pressable>
      </View>

      {tab === 'home' && (
        <View style={styles.chipsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {categories.map(category => {
              const active = activeCategory === category.name;
              return (
                <Pressable
                  key={category.name}
                  onPress={() => setSelectedCategory(category.name)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={styles.chipEmoji}>{category.emoji}</Text>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {tab === 'search' && (
        <View style={styles.column}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={COLORS.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Un sujet, un média, une personne…"
              placeholderTextColor={COLORS.muted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoFocus
              accessibilityLabel="Rechercher"
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
              >
                <Ionicons name="close-circle" size={20} color={COLORS.muted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.column}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.text} />
        }
      >
        {tab === 'home' && (
          <>
            <View style={styles.dateBlock}>
              <Text style={styles.date}>{formatToday()}</Text>
              <Text style={[styles.status, error ? { color: COLORS.danger } : null]}>
                {statusText}
                {!error && stories.length > 0 ? ` · ${homeStories.length} sujets` : ''}
              </Text>
            </View>

            {error && (
              <Pressable style={styles.errorBanner} onPress={refresh} accessibilityRole="button">
                <Ionicons name="cloud-offline-outline" size={20} color={COLORS.danger} />
                <Text style={styles.errorText}>
                  {error}
                  {stories.length > 0
                    ? ' Les dernières infos reçues restent affichées. Toucher pour réessayer.'
                    : ' Toucher pour réessayer.'}
                </Text>
              </Pressable>
            )}

            {loading && stories.length === 0 ? (
              <FeedSkeleton />
            ) : homeStories.length === 0 ? (
              <EmptyState
                icon="newspaper-outline"
                title="Rien pour l’instant"
                text="Aucun sujet dans cette rubrique. Tire vers le bas pour actualiser."
              />
            ) : (
              <>
                {lead && (
                  <LeadCard
                    story={lead}
                    saved={isSaved(lead.id)}
                    status={statusOf(lead)}
                    onPress={() => openStory(lead)}
                    onToggleSave={() => toggleSaved(lead)}
                  />
                )}
                {sections.map(section => (
                  <View key={section.label}>
                    <Text style={styles.sectionLabel}>{section.label}</Text>
                    {section.items.map(renderRow)}
                  </View>
                ))}
                <Text style={styles.footer}>
                  Tu es à jour. Les nouveaux sujets arrivent ici automatiquement.
                </Text>
              </>
            )}
          </>
        )}

        {tab === 'search' &&
          (search.trim() === '' ? (
            <View style={styles.trending}>
              <Text style={styles.sectionLabel}>Les plus couverts</Text>
              {trending.map(story => (
                <Pressable
                  key={story.id}
                  onPress={() => openStory(story)}
                  accessibilityRole="button"
                  style={styles.trendingRow}
                >
                  <Ionicons name="trending-up" size={18} color={COLORS.accent} />
                  <Text style={styles.trendingText} numberOfLines={2}>
                    {story.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : searchResults.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="Aucun résultat"
              text="Essaie un autre mot, ou le nom d’un média."
            />
          ) : (
            searchResults.map(renderRow)
          ))}

        {tab === 'saved' &&
          (saved.length === 0 ? (
            <EmptyState
              icon="bookmark-outline"
              title="Rien d’enregistré"
              text="Touche le marque-page d’un sujet pour le retrouver ici."
              action="Voir l’actualité"
              onAction={() => setTab('home')}
            />
          ) : (
            <>
              <View style={styles.dateBlock}>
                <Text style={styles.date}>Enregistrés</Text>
                <Text style={styles.status}>
                  {saved.length} sujet{saved.length > 1 ? 's' : ''} · gardés sur cet appareil
                </Text>
              </View>
              {saved.map(renderRow)}
            </>
          ))}
      </ScrollView>

      <View style={styles.nav}>
        {TABS.map(item => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              style={styles.navItem}
            >
              <View>
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={24}
                  color={active ? COLORS.accent : COLORS.muted}
                />
                {item.key === 'saved' && saved.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{saved.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={COLORS.accent} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  column: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  scroll: { flex: 1 },

  header: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  logo: { width: 34, height: 34 },
  brandName: { color: COLORS.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  chipsWrap: { paddingBottom: 6 },
  // flexGrow makes the row at least as wide as the screen so the chips sit in
  // the middle; when there are too many, it simply scrolls from the start.
  chips: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  chipEmoji: { fontSize: 15 },
  chipText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: COLORS.text },

  dateBlock: { paddingTop: 14, paddingBottom: 16, gap: 4 },
  date: { color: COLORS.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  status: { color: COLORS.muted, fontSize: 14 },

  sectionLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 2,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2A1E24',
    borderWidth: 1,
    borderColor: '#5A3340',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: { color: '#F2B8BF', fontSize: 14, lineHeight: 20, flex: 1 },

  searchBox: {
    height: 50,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 16, paddingVertical: 8 },
  trending: { paddingTop: 6 },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  trendingText: { color: COLORS.text, fontSize: 16, lineHeight: 22, flex: 1, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 24,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: COLORS.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyButton: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: { color: COLORS.bg, fontSize: 15, fontWeight: '800' },

  footer: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 28, marginBottom: 8 },

  nav: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 56,
    paddingVertical: 6,
  },
  navLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  navLabelActive: { color: COLORS.accent, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: COLORS.bg, fontSize: 11, fontWeight: '900' },
});
