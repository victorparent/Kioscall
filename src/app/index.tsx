
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';

import { useNews } from '@/hooks/use-news';
import { timeAgo, type Story } from '@/lib/news';

const COLORS = {
  bg: '#0B0C12',
  card: '#141620',
  cardLight: '#532885',
  border: '#292B39',
  white: '#F6F5FA',
  muted: '#9396AA',
  purple: '#360697',
  purpleDark: '#28233F',
  green: '#8BE0B1',
};

const ALL_CATEGORY = { name: 'Tout', emoji: '✳' };

function uniqueOutlets(story: Story) {
  const seen = new Map<string, Story['articles'][number]['outlet']>();
  story.articles.forEach(article => seen.set(article.outlet.name, article.outlet));
  return [...seen.values()];
}

export default function HomeScreen() {
  const {
    stories,
    categories: serverCategories,
    loading,
    refreshing,
    error,
    updatedAt,
    refresh,
  } = useNews();
  const [selectedCategory, setActiveCategory] = useState('Tout');
  const categories = useMemo(
    () => [ALL_CATEGORY, ...serverCategories],
    [serverCategories]
  );
  // The server can retire a rubric: fall back to everything if the chosen one is gone.
  const activeCategory = categories.some(c => c.name === selectedCategory)
    ? selectedCategory
    : 'Tout';
  const [activeTab, setActiveTab] = useState('Accueil');
  const [search, setSearch] = useState('');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  // Favorites keep a snapshot of the story so it survives feed refreshes.
  const [favorites, setFavorites] = useState<Story[]>([]);

  const isFavorite = (id: string) => favorites.some(story => story.id === id);

  const visibleStories = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = activeTab === 'Favoris' ? favorites : stories;
    const matches = source.filter(story => {
      const matchesCategory =
        activeCategory === 'Tout' || story.category === activeCategory;
      const matchesSearch =
        !query ||
        story.title.toLowerCase().includes(query) ||
        story.category.toLowerCase().includes(query) ||
        story.summary.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
    // Most recent first.
    return matches.sort((a, b) => b.publishedAt - a.publishedAt);
  }, [activeCategory, activeTab, favorites, search, stories]);

  function toggleFavorite(story: Story) {
    setFavorites(current =>
      current.some(item => item.id === story.id)
        ? current.filter(item => item.id !== story.id)
        : [story, ...current]
    );
  }

  async function openArticle(url: string) {
    try {
      await openBrowserAsync(url);
    } catch {
      Alert.alert('Lien indisponible', "Impossible d’ouvrir cet article.");
    }
  }

  function goHome() {
    setSelectedStory(null);
    setActiveTab('Accueil');
  }

  function renderStoryCard(story: Story) {
    const saved = isFavorite(story.id);

    return (
      <TouchableOpacity
        key={story.id}
        style={styles.storyCard}
        activeOpacity={0.85}
        onPress={() => setSelectedStory(story)}
      >
        <View style={styles.storyTop}>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>
              {story.emoji}  {story.category.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.storyTime}>{timeAgo(story.publishedAt)}</Text>
        </View>

        <Text style={styles.storyTitle}>{story.title}</Text>
        {story.summary ? (
          <Text style={styles.storyPreview} numberOfLines={3}>
            {story.summary}
          </Text>
        ) : null}

        <View style={styles.storyBottom}>
          <View style={styles.sourceAvatars}>
            {uniqueOutlets(story).slice(0, 3).map((outlet, index) => (
              <View
                key={outlet.name}
                style={[
                  styles.miniSource,
                  {
                    backgroundColor: outlet.color,
                    marginLeft: index === 0 ? 0 : -7,
                    zIndex: 3 - index,
                  },
                ]}
              >
                <Text style={styles.miniSourceText}>
                  {outlet.initials.slice(0, 1)}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sourceCount}>
            {uniqueOutlets(story).length} sources · {story.articles.length} articles
          </Text>

          <TouchableOpacity
            onPress={() => toggleFavorite(story)}
            style={styles.saveButton}
          >
            <Text style={[styles.saveIcon, saved && styles.savedIcon]}>
              {saved ? '★' : '☆'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.openArrow}>↗</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderDetail(story: Story) {
    const saved = isFavorite(story.id);
    const lead = story.articles.find(article => article.description);

    return (
      <>
        <TouchableOpacity
          onPress={() => setSelectedStory(null)}
          style={styles.backButton}
        >
          <Text style={styles.backText}>←  Toutes les histoires</Text>
        </TouchableOpacity>

        <View style={styles.detailCategory}>
          <Text style={styles.categoryTagText}>
            {story.emoji}  {story.category.toUpperCase()}
          </Text>
          <Text style={styles.storyTime}>{timeAgo(story.publishedAt)}</Text>
        </View>

        <Text style={styles.detailTitle}>{story.title}</Text>

        {lead && (
          <View style={styles.oneStoryCard}>
            <Text style={styles.factsTitle}>
              L’ESSENTIEL · {lead.outlet.name.toUpperCase()}
            </Text>
            <Text style={styles.summaryText}>{lead.description}</Text>
          </View>
        )}

        <View style={styles.perspectiveHeading}>
          <Text style={styles.sectionTitle}>Every Perspective</Text>
          <Text style={styles.perspectiveSubtitle}>
            {`Le même sujet, vu par ${uniqueOutlets(story).length} rédactions.`}
          </Text>
          {story.aiGrouped && (
            <Text style={styles.aiNote}>
              Regroupement et titre générés par IA à partir des flux des médias.
              Les articles et leurs chapôs sont ceux des rédactions.
            </Text>
          )}
        </View>

        <View style={styles.sourceCountBanner}>
          <Text style={styles.sourceCountBannerText}>
            {story.articles.length} ARTICLE{story.articles.length > 1 ? 'S' : ''}
          </Text>
        </View>

        {story.articles.map(article => (
          <TouchableOpacity
            key={article.url}
            style={styles.sourceCard}
            onPress={() => openArticle(article.url)}
            activeOpacity={0.8}
          >
            <View
              style={[styles.sourceLogo, { backgroundColor: article.outlet.color }]}
            >
              <Text style={styles.sourceLogoText}>{article.outlet.initials}</Text>
            </View>

            <View style={styles.sourceContent}>
              <View style={styles.sourceNameRow}>
                <Text style={styles.sourceName}>{article.outlet.name}</Text>
                <Text style={styles.sourceAngle}>
                  {timeAgo(article.publishedAt)}
                </Text>
              </View>
              <Text style={styles.sourceHeadline}>{article.title}</Text>
              <Text style={styles.readArticle}>Lire l’article ↗</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.favoriteDetailButton}
          onPress={() => toggleFavorite(story)}
        >
          <Text style={styles.favoriteDetailText}>
            {saved ? '★  Retirer des favoris' : '☆  Sauvegarder cette histoire'}
          </Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    
<SafeAreaView style={styles.safeArea}>
  <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

  <View style={styles.appHeader}>
    <TouchableOpacity onPress={goHome} style={styles.brand}>
      <Image
        source={require('../../assets/images/Kioskole (1).png')}
        style={{ width: 42, height: 42 }}
        resizeMode="contain"
      />
      <View>
        <Text style={styles.brandName}>kioscall</Text>
        <Text style={styles.brandTagline}>
          ONE STORY, EVERY PERSPECTIVE.
        </Text>
      </View>
    </TouchableOpacity>


        <TouchableOpacity
          style={styles.profileButton}
          onPress={() =>
            Alert.alert(
              'Ton Kioscall',
              'Les comptes et les profils seront ajoutés dans une prochaine étape.'
            )
          }
        >
          <Text style={styles.profileText}>K</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.white}
          />
        }
      >
        {selectedStory ? (
          renderDetail(selectedStory)
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>L’ACTUALITÉ, AUTREMENT</Text>
              <Text style={styles.heroTitle}>
                Une histoire.
                {'\n'}
                <Text style={styles.heroAccent}>Toutes les visions.</Text>
              </Text>
              <Text style={styles.heroDescription}>
                Comprends les faits. Découvre les perspectives. Fais-toi ton
                propre avis.
              </Text>
            </View>

            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un sujet, une histoire..."
                placeholderTextColor={COLORS.muted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={styles.clearSearch}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Explore les sujets</Text>
              <Text style={styles.sectionMeta}>PAR THÈME</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categories.map(category => {
                const active = activeCategory === category.name;
                return (
                  <TouchableOpacity
                    key={category.name}
                    onPress={() => setActiveCategory(category.name)}
                    style={[
                      styles.categoryBubble,
                      active && styles.categoryBubbleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryEmoji,
                        active && styles.categoryEmojiActive,
                      ]}
                    >
                      {category.emoji}
                    </Text>
                    <Text
                      style={[
                        styles.categoryName,
                        active && styles.categoryNameActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionTitle}>
                  {activeTab === 'Favoris'
                    ? 'Tes histoires sauvegardées'
                    : activeTab === 'Explorer'
                      ? 'Toutes les histoires'
                      : "À la une aujourd'hui"}
                </Text>
                <Text style={styles.sectionSubheading}>
                  Une histoire, plusieurs perspectives.
                </Text>
              </View>
              <View style={styles.livePill}>
                <View
                  style={[styles.liveDot, error && styles.liveDotError]}
                />
                <Text style={[styles.liveText, error && styles.liveTextError]}>
                  {error
                    ? 'HORS LIGNE'
                    : updatedAt
                      ? `MAJ ${new Date(updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'EN DIRECT'}
                </Text>
              </View>
            </View>

            {error && (
              <TouchableOpacity style={styles.errorBanner} onPress={refresh}>
                <Text style={styles.errorBannerText}>
                  {error}
                  {stories.length > 0
                    ? ' Les dernières infos reçues restent affichées. Toucher pour réessayer.'
                    : ' Toucher pour réessayer.'}
                </Text>
              </TouchableOpacity>
            )}

            {loading && stories.length === 0 ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={COLORS.white} />
                <Text style={[styles.emptyText, { marginTop: 14 }]}>
                  Chargement de l’actualité…
                </Text>
              </View>
            ) : visibleStories.length > 0 ? (
              visibleStories.map(renderStoryCard)
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>
                  {activeTab === 'Favoris' ? '☆' : '⌕'}
                </Text>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'Favoris'
                    ? 'Pas encore de favoris'
                    : 'Aucune histoire trouvée'}
                </Text>
                <Text style={styles.emptyText}>
                  {activeTab === 'Favoris'
                    ? 'Sauvegarde une histoire pour la retrouver ici.'
                    : 'Essaie un autre mot-clé ou une autre catégorie.'}
                </Text>
                {activeTab === 'Favoris' && (
                  <TouchableOpacity
                    onPress={() => setActiveTab('Accueil')}
                    style={styles.emptyButton}
                  >
                    <Text style={styles.emptyButtonText}>
                      Explorer les histoires
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.bottomMessage}>
              <Text style={styles.bottomMessageMark}>✳</Text>
              <Text style={styles.bottomMessageTitle}>
                L’information mérite du contexte.
              </Text>
              <Text style={styles.bottomMessageText}>
                Ne te contente pas d’un seul angle. Explore les sources et
                construis ta propre compréhension.
              </Text>
            </View>

            <Text style={styles.footer}>
              KIOSCALL  ·  ONE STORY, EVERY PERSPECTIVE.
            </Text>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        {[
          { name: 'Accueil', icon: '⌂' },
          { name: 'Explorer', icon: '◉' },
          { name: 'Favoris', icon: '☆' },
        ].map(tab => {
          const active = activeTab === tab.name && !selectedStory;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.navItem}
              onPress={() => {
                setSelectedStory(null);
                setActiveTab(tab.name);
                if (tab.name !== 'Explorer') setActiveCategory('Tout');
              }}
            >
              <Text style={[styles.navIcon, active && styles.navIconActive]}>
                {tab.icon}
              </Text>
              <Text
                style={[styles.navLabel, active && styles.navLabelActive]}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  appHeader: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#20212D',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMarkText: {
    color: '#14121E',
    fontSize: 22,
    fontWeight: '900',
  },
  brandName: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  brandTagline: {
    color: COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#48425F',
    backgroundColor: COLORS.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    color: COLORS.purple,
    fontSize: 14,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
  },
  hero: {
    paddingTop: 12,
    paddingBottom: 26,
  },
  heroEyebrow: {
    color: COLORS.purple,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 15,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 37,
    fontWeight: '900',
    lineHeight: 43,
    letterSpacing: -1.5,
  },
  heroAccent: {
    color: COLORS.purple,
  },
  heroDescription: {
    color: '#A5A7B9',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 340,
    marginTop: 13,
  },
  searchBox: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 29,
  },
  searchIcon: {
    color: COLORS.purple,
    fontSize: 26,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 13,
    paddingVertical: 8,
  },
  clearSearch: {
    color: COLORS.muted,
    padding: 5,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionMeta: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  sectionSubheading: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },
  categoryScroll: {
    gap: 10,
    paddingBottom: 30,
  },
  categoryBubble: {
    minWidth: 77,
    height: 86,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  categoryBubbleActive: {
    backgroundColor: COLORS.purpleDark,
    borderColor: COLORS.purple,
  },
  categoryEmoji: {
    fontSize: 21,
    color: COLORS.muted,
  },
  categoryEmojiActive: {
    color: COLORS.purple,
  },
  categoryName: {
    color: '#B5B6C6',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryNameActive: {
    color: COLORS.white,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    backgroundColor: '#1D2926',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
  },
  liveDotError: {
    backgroundColor: '#F28B82',
  },
  liveTextError: {
    color: '#F28B82',
  },
  errorBanner: {
    backgroundColor: '#2A1E24',
    borderWidth: 1,
    borderColor: '#5A3340',
    borderRadius: 12,
    padding: 12,
    marginBottom: 13,
  },
  errorBannerText: {
    color: '#F2B8BF',
    fontSize: 11,
    lineHeight: 17,
  },
  liveText: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  storyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
    marginBottom: 13,
  },
  storyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  categoryTag: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: COLORS.purpleDark,
  },
  categoryTagText: {
    color: COLORS.purple,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  storyTime: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  storyTitle: {
    color: COLORS.white,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  storyPreview: {
    color: '#A6A8BA',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
  },
  storyBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#292B38',
  },
  sourceAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 9,
  },
  miniSource: {
    width: 23,
    height: 23,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSourceText: {
    color: '#151520',
    fontSize: 10,
    fontWeight: '900',
  },
  sourceCount: {
    color: COLORS.muted,
    fontSize: 10,
    flex: 1,
  },
  saveButton: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  saveIcon: {
    color: COLORS.muted,
    fontSize: 22,
  },
  savedIcon: {
    color: COLORS.purple,
  },
  openArrow: {
    color: COLORS.purple,
    fontSize: 19,
    marginLeft: 7,
  },
  bottomMessage: {
    borderWidth: 1,
    borderColor: '#39334F',
    backgroundColor: '#191725',
    borderRadius: 20,
    padding: 19,
    marginTop: 17,
    alignItems: 'flex-start',
  },
  bottomMessageMark: {
    color: COLORS.purple,
    fontSize: 22,
    marginBottom: 10,
  },
  bottomMessageTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  bottomMessageText: {
    color: '#A6A4B8',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
  },
  footer: {
    textAlign: 'center',
    color: '#66697D',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 26,
    marginBottom: 5,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 9,
    marginBottom: 20,
  },
  backText: {
    color: COLORS.purple,
    fontSize: 12,
    fontWeight: '700',
  },
  detailCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  detailTitle: {
    color: COLORS.white,
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 36,
    letterSpacing: -0.8,
    marginBottom: 20,
  },
  disclaimer: {
    backgroundColor: '#292437',
    borderRadius: 12,
    padding: 12,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: '#48405D',
  },
  disclaimerTitle: {
    color: COLORS.purple,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  disclaimerText: {
    color: '#D0CADD',
    fontSize: 11,
    lineHeight: 17,
  },
  oneStoryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
    marginBottom: 29,
  },
  oneStoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 17,
  },
  oneStoryMark: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneStoryMarkText: {
    color: '#161321',
    fontSize: 19,
    fontWeight: '900',
  },
  oneStoryLabel: {
    color: COLORS.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  oneStoryTitle: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 3,
  },
  aiTag: {
    borderWidth: 1,
    borderColor: '#5C507D',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  aiTagText: {
    color: COLORS.purple,
    fontSize: 10,
    fontWeight: '900',
  },
  summaryText: {
    color: '#D2D2E0',
    fontSize: 14,
    lineHeight: 23,
  },
  thinLine: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  factsTitle: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 15,
  },
  factRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  factNumber: {
    color: COLORS.purple,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },
  factText: {
    color: '#D2D2E0',
    fontSize: 12,
    lineHeight: 19,
    flex: 1,
  },
  disclaimerSmall: {
    color: '#7F8196',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
  },
  perspectiveHeading: {
    marginBottom: 16,
  },
  aiNote: {
    color: '#7F8196',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
  },
  perspectiveSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 6,
  },
  sourceCountBanner: {
    backgroundColor: '#191A25',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 11,
  },
  sourceCountBannerText: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sourceCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
  },
  sourceLogo: {
    width: 43,
    height: 43,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceLogoText: {
    color: '#151520',
    fontSize: 12,
    fontWeight: '900',
  },
  sourceContent: {
    flex: 1,
  },
  sourceNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  sourceName: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  sourceAngle: {
    color: COLORS.muted,
    fontSize: 9,
  },
  sourceHeadline: {
    color: '#C6C6D5',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  readArticle: {
    color: COLORS.purple,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 9,
  },
  favoriteDetailButton: {
    borderWidth: 1,
    borderColor: '#51476F',
    borderRadius: 13,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 15,
  },
  favoriteDetailText: {
    color: COLORS.purple,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 38,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  emptyEmoji: {
    color: COLORS.purple,
    fontSize: 33,
    marginBottom: 12,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    backgroundColor: COLORS.purple,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginTop: 17,
  },
  emptyButtonText: {
    color: '#171321',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomNav: {
    minHeight: 65,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#11121B',
    borderTopWidth: 1,
    borderTopColor: '#282937',
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 3,
  },
  navIcon: {
    color: '#777A91',
    fontSize: 21,
  },
  navIconActive: {
    color: COLORS.purple,
  },
  navLabel: {
    color: '#777A91',
    fontSize: 10,
    fontWeight: '600',
  },
  navLabelActive: {
    color: COLORS.purple,
    fontWeight: '800',
  },
});
