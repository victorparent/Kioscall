export const REFRESH_MS = 10 * 60 * 1000;

const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

export type Outlet = { name: string; initials: string; color: string };

export type Article = {
  outlet: Outlet;
  title: string;
  description: string;
  url: string;
  publishedAt: number;
  /** Category of the thematic feed it came from, if any. */
  categoryHint?: string;
};

export type Story = {
  id: string;
  category: string;
  emoji: string;
  title: string;
  summary: string;
  publishedAt: number;
  /** Distinctive keywords shared by the articles of the story. */
  topics: string[];
  /** True when the grouping and the title were produced by the AI grouping step. */
  aiGrouped?: boolean;
  articles: Article[];
};

const OUTLETS = {
  lemonde: { name: 'Le Monde', initials: 'LM', color: '#8EB5FF' },
  franceinfo: { name: 'franceinfo', initials: 'FI', color: '#F2B77D' },
  figaro: { name: 'Le Figaro', initials: 'LF', color: '#9DDEB5' },
  france24: { name: 'France 24', initials: 'F24', color: '#B6A4FF' },
  numerama: { name: 'Numerama', initials: 'NU', color: '#F29DB8' },
  bfmtv: { name: 'BFMTV', initials: 'BF', color: '#FF9B8A' },
  liberation: { name: 'Libération', initials: 'LI', color: '#E8E27A' },
  lexpress: { name: "L'Express", initials: 'LX', color: '#7FD6D1' },
  lacroix: { name: 'La Croix', initials: 'LC', color: '#C9A8E8' },
  huffpost: { name: 'HuffPost', initials: 'HP', color: '#A8E0A0' },
  humanite: { name: "L'Humanité", initials: 'LH', color: '#F28B9E' },
  rfi: { name: 'RFI', initials: 'RF', color: '#8ED0F2' },
  ouestfrance: { name: 'Ouest-France', initials: 'OF', color: '#E8B77A' },
  vingtminutes: { name: '20 Minutes', initials: '20', color: '#B8C4FF' },
} satisfies Record<string, Outlet>;

export const CATEGORY_EMOJI: Record<string, string> = {
  Monde: '🌍',
  Politique: '🏛',
  Tech: '◈',
  Économie: '↗',
  Climat: '🌱',
  Société: '👥',
};

/** `category` is a hint from thematic feeds; general feeds have none and are classified through the story they join. */
export type Category = { name: string; emoji: string };

/** Rubriques de départ. Le serveur peut en ajouter d'autres (voir news-ai.ts). */
export const DEFAULT_CATEGORIES: Category[] = Object.entries(CATEGORY_EMOJI).map(
  ([name, emoji]) => ({ name, emoji })
);

type Feed = { category?: string; outlet: Outlet; url: string };

const O = OUTLETS;
const FEEDS: Feed[] = [
  // Thematic feeds first: when an article is in several feeds, the first one wins.
  { category: 'Monde', outlet: O.lemonde, url: 'https://www.lemonde.fr/international/rss_full.xml' },
  { category: 'Monde', outlet: O.franceinfo, url: 'https://www.francetvinfo.fr/monde.rss' },
  { category: 'Monde', outlet: O.figaro, url: 'https://www.lefigaro.fr/rss/figaro_international.xml' },
  { category: 'Monde', outlet: O.france24, url: 'https://www.france24.com/fr/rss' },
  { category: 'Monde', outlet: O.rfi, url: 'https://www.rfi.fr/fr/rss' },
  { category: 'Politique', outlet: O.lemonde, url: 'https://www.lemonde.fr/politique/rss_full.xml' },
  { category: 'Politique', outlet: O.franceinfo, url: 'https://www.francetvinfo.fr/politique.rss' },
  { category: 'Politique', outlet: O.figaro, url: 'https://www.lefigaro.fr/rss/figaro_politique.xml' },
  { category: 'Politique', outlet: O.bfmtv, url: 'https://www.bfmtv.com/rss/politique/' },
  { category: 'Tech', outlet: O.lemonde, url: 'https://www.lemonde.fr/pixels/rss_full.xml' },
  { category: 'Tech', outlet: O.franceinfo, url: 'https://www.francetvinfo.fr/internet.rss' },
  { category: 'Tech', outlet: O.figaro, url: 'https://www.lefigaro.fr/rss/figaro_secteur_high-tech.xml' },
  { category: 'Tech', outlet: O.numerama, url: 'https://www.numerama.com/feed/' },
  { category: 'Économie', outlet: O.lemonde, url: 'https://www.lemonde.fr/economie/rss_full.xml' },
  { category: 'Économie', outlet: O.franceinfo, url: 'https://www.francetvinfo.fr/economie.rss' },
  { category: 'Économie', outlet: O.figaro, url: 'https://www.lefigaro.fr/rss/figaro_economie.xml' },
  { category: 'Climat', outlet: O.lemonde, url: 'https://www.lemonde.fr/climat/rss_full.xml' },
  { category: 'Climat', outlet: O.figaro, url: 'https://www.lefigaro.fr/rss/figaro_environnement.xml' },
  // General feeds: more outlets covering the same big stories.
  { outlet: O.lemonde, url: 'https://www.lemonde.fr/rss/une.xml' },
  { outlet: O.lemonde, url: 'https://www.lemonde.fr/societe/rss_full.xml' },
  { outlet: O.franceinfo, url: 'https://www.francetvinfo.fr/titres.rss' },
  { outlet: O.franceinfo, url: 'https://www.francetvinfo.fr/societe.rss' },
  { outlet: O.figaro, url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml' },
  { outlet: O.figaro, url: 'https://www.lefigaro.fr/rss/figaro_flash-actu.xml' },
  { outlet: O.bfmtv, url: 'https://www.bfmtv.com/rss/news-24-7/' },
  { outlet: O.liberation, url: 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml' },
  { outlet: O.lexpress, url: 'https://www.lexpress.fr/arc/outboundfeeds/rss/alaune.xml' },
  { outlet: O.lacroix, url: 'https://www.la-croix.com/RSS' },
  { outlet: O.huffpost, url: 'https://www.huffingtonpost.fr/feeds/index.xml' },
  { outlet: O.humanite, url: 'https://www.humanite.fr/feed' },
  { outlet: O.ouestfrance, url: 'https://www.ouest-france.fr/rss/une' },
  { outlet: O.vingtminutes, url: 'https://www.20minutes.fr/feeds/rss-une.xml' },
];

/* ---------- RSS parsing (no DOMParser in React Native) ---------- */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  laquo: '«', raquo: '»', hellip: '…', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', ndash: '–', mdash: '—',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point =
        code[1].toLowerCase() === 'x'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function cleanText(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  let text = cdata ? cdata[1] : decodeEntities(raw);
  text = decodeEntities(text); // some feeds double-escape
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tagContent(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1] : '';
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** RFC 822 dates ("Mon, 19 Oct 2026 10:24:04 +0200"), parsed by hand because Date.parse is engine-dependent. */
function parseRssDate(raw: string): number {
  const m = raw.match(
    /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*(GMT|UTC|Z|[+-]\d{4})?/
  );
  if (!m) return NaN;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return NaN;
  let offsetMin = 0;
  const tz = m[7];
  if (tz && /^[+-]\d{4}$/.test(tz)) {
    const sign = tz[0] === '-' ? -1 : 1;
    offsetMin = sign * (parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(3, 5), 10));
  }
  return (
    Date.UTC(+m[3], month, +m[1], +m[4], +m[5], m[6] ? +m[6] : 0) - offsetMin * 60_000
  );
}

function parseRss(xml: string, feed: Feed): Article[] {
  const articles: Article[] = [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];

  for (const item of items) {
    const title = cleanText(tagContent(item, 'title'));
    const url = cleanText(tagContent(item, 'link')).replace(/#xtor=.*$/, '');
    const publishedAt = parseRssDate(tagContent(item, 'pubDate'));
    if (!title || !/^https?:\/\//.test(url) || Number.isNaN(publishedAt)) continue;

    articles.push({
      outlet: feed.outlet,
      title,
      description: cleanText(tagContent(item, 'description')),
      url,
      publishedAt,
      categoryHint: feed.category,
    });
  }
  return articles;
}

async function fetchFeed(feed: Feed): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseRss(await response.text(), feed);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Grouping articles about the same event into stories ---------- */

/** A story needs this many distinct outlets, otherwise there is no "perspective" to compare. */
const MIN_OUTLETS_PER_STORY = 3;
const MAX_STORIES = 24;
/** Two articles are linked when they share at least this many distinctive words... */
const MIN_SHARED_TOKENS = 2;
/** ...and either those words are rare enough (sum of IDF weights)... */
const LINK_SCORE = 12;
/** ...a two-word expression ("17 octobre") shared by a limited number of articles adds weight. */
const MAX_BIGRAM_DF = 40;
const BIGRAM_BONUS = 5;
/** A group never holds more articles than this while it is being built... */
const MAX_GROUP_SIZE = 40;
/** ...and a story, once related groups are merged, never more than this. */
const MAX_STORY_SIZE = 80;
/** A story is characterised by its top anchor words; an article stays only if it contains enough of them. */
const ANCHOR_COUNT = 5;
const MIN_ANCHORS_PER_ARTICLE = 2;
/** Groups sharing a two-word expression used by at least this many articles ("17 octobre") are facets of one broad subject. */
const UMBRELLA_MIN_DF = 12;
const FALLBACK_CATEGORY = 'Société';

const STOPWORDS = new Set([
  'dans', 'pour', 'avec', 'sans', 'sous', 'plus', 'moins', 'entre', 'vers', 'chez',
  'cette', 'comme', 'mais', 'ainsi', 'apres', 'avant', 'contre', 'tout', 'tous',
  'sont', 'etre', 'fait', 'faire', 'leur', 'leurs', 'nous', 'vous', 'elle', 'elles',
  'quel', 'quels', 'quelle', 'quelles', 'selon', 'depuis', 'encore', 'aussi',
  'dont', 'alors', 'veut', 'sera', 'peut', 'deux', 'trois', 'premier', 'premiere',
  'ceux', 'celle', 'celui', 'cela', 'etait', 'avoir', 'tres', 'bien', 'sur', 'par',
  'apres', 'lors', 'cest', 'ete', 'ont', 'seront', 'serait', 'font', 'sera', 'cet',
  'ces', 'qui', 'que', 'quoi', 'dire', 'voici', 'video', 'direct', 'live', 'replay',
  'comment', 'pourquoi', 'quand', 'faut', 'jour', 'jours', 'annee', 'annees', 'mois',
  'semaine', 'ans', 'nouveau', 'nouvelle', 'nouveaux', 'nouvelles', 'france',
  'francais', 'francaise', 'francaises', 'apres', 'selon', 'toujours', 'jamais',
]);

type Doc = {
  article: Article;
  /** Distinctive words, from title and description. */
  tokens: Set<string>;
  titleTokens: Set<string>;
  /** Pairs of consecutive words ("17 octobre"): they pin a subject down better than single words. */
  bigrams: Set<string>;
};

/** Normalised word -> a readable form (with accents) to show as a topic. */
const displayForms = new Map<string, string>();

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const words = text.toLowerCase().split(/[^a-z0-9àâäçéèêëîïôöùûüœæ]+/);
  for (const word of words) {
    const plain = word.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const isNumber = /^\d{2,4}$/.test(plain);
    if (!isNumber && plain.length < 4) continue;
    if (STOPWORDS.has(plain)) continue;
    // Crude plural folding: "manifestations" and "manifestation" must match.
    const token = plain.length > 5 && plain.endsWith('s') ? plain.slice(0, -1) : plain;
    tokens.push(token);
    if (!displayForms.has(token)) displayForms.set(token, word);
  }
  return tokens;
}

function bigramsOf(tokens: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 1) {
    if (tokens[i] !== tokens[i + 1]) pairs.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return pairs;
}

export function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Daily digests and press reviews mention many subjects at once and would glue unrelated stories together. */
export const DIGEST_TITLE = /\bl[’']actu\b|revue de presse|les titres de|à la une de/i;

function makeDoc(article: Article): Doc {
  const title = tokenize(article.title);
  const description = tokenize(article.description);
  return {
    article,
    titleTokens: new Set(title),
    tokens: new Set([...title, ...description]),
    bigrams: new Set([...bigramsOf(title), ...bigramsOf(description)]),
  };
}

function countIn<T>(items: Iterable<Set<T>>): Map<T, number> {
  const counts = new Map<T, number>();
  for (const set of items) {
    set.forEach(item => counts.set(item, (counts.get(item) ?? 0) + 1));
  }
  return counts;
}

export function buildStories(articles: Article[]): Story[] {
  const now = Date.now();
  const docs: Doc[] = articles
    .filter(a => now - a.publishedAt <= MAX_AGE_MS && a.publishedAt - now < 3_600_000)
    .filter(a => !DIGEST_TITLE.test(a.title))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .map(makeDoc);

  const tokenDf = countIn(docs.map(d => d.tokens));
  const bigramDf = countIn(docs.map(d => d.bigrams));
  const idf = new Map<string, number>();
  tokenDf.forEach((df, token) => idf.set(token, Math.log((docs.length + 1) / (df + 1))));

  // Candidate links between articles about the same subject, strongest first.
  const links: { i: number; j: number; strength: number }[] = [];
  for (let i = 0; i < docs.length; i += 1) {
    for (let j = i + 1; j < docs.length; j += 1) {
      const a = docs[i];
      const b = docs[j];
      let shared = 0;
      let score = 0;
      a.tokens.forEach(token => {
        if (!b.tokens.has(token)) return;
        shared += 1;
        score += idf.get(token) ?? 0;
      });
      if (shared < MIN_SHARED_TOKENS) continue;

      let sharedBigram = false;
      a.bigrams.forEach(pair => {
        if (sharedBigram || !b.bigrams.has(pair)) return;
        const df = bigramDf.get(pair) ?? 0;
        if (df >= 2 && df <= MAX_BIGRAM_DF) sharedBigram = true;
      });

      const strength = score + (sharedBigram ? BIGRAM_BONUS : 0);
      if (strength >= LINK_SCORE) links.push({ i, j, strength });
    }
  }
  links.sort((x, y) => y.strength - x.strength);

  // Union-find, merging the strongest links first and refusing to build a
  // group bigger than MAX_GROUP_SIZE: without that cap, generic words chain
  // unrelated news into one giant blob.
  const parent = docs.map((_, i) => i);
  const size = docs.map(() => 1);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (const { i, j } of links) {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj || size[ri] + size[rj] > MAX_GROUP_SIZE) continue;
    parent[ri] = rj;
    size[rj] += size[ri];
  }

  const rawGroups = new Map<number, Doc[]>();
  docs.forEach((doc, i) => {
    const root = find(i);
    rawGroups.set(root, [...(rawGroups.get(root) ?? []), doc]);
  });

  // 1. Clean each group: drop articles that only hang on through generic words.
  type Core = { tokens: Set<string>; bigrams: Set<string> };
  const coreOf = (group: Doc[]): Core => {
    const min = Math.max(3, Math.ceil(group.length * 0.2));
    const tokens = new Set<string>();
    const bigrams = new Set<string>();
    countIn(group.map(d => d.tokens)).forEach((n, t) => n >= min && tokens.add(t));
    countIn(group.map(d => d.bigrams)).forEach((n, t) => n >= min && bigrams.add(t));
    return { tokens, bigrams };
  };

  // The words that best define a group: used by many of its articles, rare elsewhere.
  const anchorsOf = (group: Doc[]) => {
    const min = Math.max(3, Math.ceil(group.length * 0.3));
    return [...countIn(group.map(d => d.tokens)).entries()]
      .filter(([, n]) => n >= min)
      .sort((a, b) => b[1] * (idf.get(b[0]) ?? 0) - a[1] * (idf.get(a[0]) ?? 0))
      .slice(0, ANCHOR_COUNT)
      .map(([token]) => token);
  };
  const keepOnTopic = (group: Doc[]) => {
    if (group.length < MIN_OUTLETS_PER_STORY) return group;
    const anchors = anchorsOf(group);
    // Big groups chain more easily, so they must match more anchors.
    const required = group.length >= 12 ? MIN_ANCHORS_PER_ARTICLE + 1 : MIN_ANCHORS_PER_ARTICLE;
    return group.filter(doc => anchors.filter(token => doc.tokens.has(token)).length >= required);
  };

  const cleaned = [...rawGroups.values()]
    .map(keepOnTopic)
    .filter(group => group.length >= MIN_OUTLETS_PER_STORY);

  // 2. Merge facets of one broad subject ("17 octobre": curfews, looting,
  //    political reactions...). They share an expression that many articles
  //    use; each merged subject is then restricted to articles containing it.
  const cores = cleaned.map(coreOf);
  const groupParent = cleaned.map((_, i) => i);
  const groupSize = cleaned.map(g => g.length);
  const umbrella = new Map<number, { pair: string; df: number }>();
  const findGroup = (i: number): number => {
    while (groupParent[i] !== i) {
      groupParent[i] = groupParent[groupParent[i]];
      i = groupParent[i];
    }
    return i;
  };
  for (let i = 0; i < cleaned.length; i += 1) {
    for (let j = i + 1; j < cleaned.length; j += 1) {
      let best: { pair: string; df: number } | null = null;
      cores[i].bigrams.forEach(pair => {
        const df = bigramDf.get(pair) ?? 0;
        if (cores[j].bigrams.has(pair) && df >= UMBRELLA_MIN_DF && (!best || df > best.df)) {
          best = { pair, df };
        }
      });
      if (!best) continue;
      const ri = findGroup(i);
      const rj = findGroup(j);
      if (ri === rj || groupSize[ri] + groupSize[rj] > MAX_STORY_SIZE) continue;
      groupParent[ri] = rj;
      groupSize[rj] += groupSize[ri];
      const candidates = [umbrella.get(ri), umbrella.get(rj), best].filter(
        (c): c is { pair: string; df: number } => !!c
      );
      umbrella.set(rj, candidates.sort((a, b) => b.df - a.df)[0]);
    }
  }

  const components = new Map<number, Doc[][]>();
  cleaned.forEach((group, i) => {
    const root = findGroup(i);
    components.set(root, [...(components.get(root) ?? []), group]);
  });

  // A merged subject keeps only the articles that really contain its umbrella
  // expression. Groups left out of the merge stay stories of their own.
  const groups: Doc[][] = [];
  components.forEach((parts, root) => {
    const shared = umbrella.get(root);
    if (parts.length === 1 || !shared) {
      parts.forEach(part => groups.push(part));
      return;
    }
    const words = shared.pair.split(' ');
    const kept = new Set(
      parts.flat().filter(doc => words.every(word => doc.tokens.has(word)))
    );
    groups.push([...kept]);
    parts.forEach(part => {
      const left = part.filter(doc => !kept.has(doc));
      if (left.length >= MIN_OUTLETS_PER_STORY) groups.push(keepOnTopic(left));
    });
  });
  groups.forEach(group =>
    group.sort((a, b) => b.article.publishedAt - a.article.publishedAt)
  );

  const stories: Story[] = [];
  for (const group of groups) {
    const outlets = new Set(group.map(d => d.article.outlet.name));
    if (outlets.size < MIN_OUTLETS_PER_STORY) continue;

    const counts = countIn(group.map(d => d.tokens));
    const coreMin = Math.max(2, Math.ceil(group.length * 0.25));
    const coreWeight = (token: string) =>
      (counts.get(token) ?? 0) >= coreMin ? (idf.get(token) ?? 0) : 0;
    const representativeness = (doc: Doc) => {
      let total = 0;
      doc.titleTokens.forEach(token => {
        total += coreWeight(token);
      });
      return total;
    };

    // One article per outlet: the one that best represents the story.
    const bestByOutlet = new Map<string, Doc>();
    for (const doc of group) {
      const current = bestByOutlet.get(doc.article.outlet.name);
      if (!current || representativeness(doc) > representativeness(current)) {
        bestByOutlet.set(doc.article.outlet.name, doc);
      }
    }
    const picked = [...bestByOutlet.values()].sort(
      (a, b) => representativeness(b) - representativeness(a)
    );

    const votes = new Map<string, number>();
    group.forEach(d => {
      const hint = d.article.categoryHint;
      if (hint) votes.set(hint, (votes.get(hint) ?? 0) + 1);
    });
    const category =
      [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? FALLBACK_CATEGORY;

    const topics = [...counts.entries()]
      .filter(([, n]) => n >= coreMin)
      .sort((a, b) => b[1] * (idf.get(b[0]) ?? 0) - a[1] * (idf.get(a[0]) ?? 0))
      .slice(0, 4)
      .map(([token]) => displayForms.get(token) ?? token);

    const articlesByDate = picked
      .map(d => d.article)
      .sort((a, b) => b.publishedAt - a.publishedAt);
    const oldest = group[group.length - 1].article;

    stories.push({
      id: hash(oldest.url),
      category,
      emoji: CATEGORY_EMOJI[category] ?? '✳',
      title: picked[0].article.title,
      summary: picked.find(d => d.article.description)?.article.description ?? '',
      publishedAt: articlesByDate[0].publishedAt,
      topics,
      articles: articlesByDate,
    });
  }

  return stories
    .sort(
      (a, b) => b.articles.length - a.articles.length || b.publishedAt - a.publishedAt
    )
    .slice(0, MAX_STORIES);
}

/* ---------- Public API ---------- */

export type NewsResult = {
  stories: Story[];
  failedFeeds: number;
  totalFeeds: number;
  grouping?: 'ai' | 'heuristic';
  /** Rubriques actuellement utilisées (le serveur peut en ajouter ou en retirer). */
  categories?: Category[];
};

/** Reads every feed and returns the articles, without grouping them. */
export async function loadArticles() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));

  // Thematic feeds are listed first, so an article present in several feeds
  // keeps the category hint of the first one.
  const seenUrls = new Set<string>();
  const articles: Article[] = [];
  let failedFeeds = 0;
  results.forEach(result => {
    if (result.status === 'rejected') {
      failedFeeds += 1;
      return;
    }
    for (const article of result.value) {
      if (seenUrls.has(article.url)) continue;
      seenUrls.add(article.url);
      articles.push(article);
    }
  });

  return { articles, failedFeeds, totalFeeds: FEEDS.length };
}

/** Reads every feed and groups them with the built-in heuristic (no AI needed). */
export async function loadStoriesFromFeeds(): Promise<NewsResult> {
  const { articles, failedFeeds, totalFeeds } = await loadArticles();
  return { stories: buildStories(articles), failedFeeds, totalFeeds, grouping: 'heuristic', categories: DEFAULT_CATEGORIES };
}

/**
 * Browsers block cross-origin reads of most RSS feeds (no CORS headers), so on
 * web the feeds go through our own /api/news route instead.
 */
export async function fetchStories(): Promise<NewsResult> {
  // Web uses its own origin. A native build can point to a deployed server
  // (EXPO_PUBLIC_API_URL) to get the AI grouping; without it, it reads the
  // feeds itself and groups them with the heuristic.
  const base =
    process.env.EXPO_OS === 'web' ? '' : (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  if (process.env.EXPO_OS !== 'web' && !base) return loadStoriesFromFeeds();

  const response = await fetch(`${base}/api/news`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as NewsResult;
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) return "À L'INSTANT";
  if (minutes < 60) return `IL Y A ${minutes} MIN`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `IL Y A ${hours} H`;
  return `IL Y A ${Math.round(hours / 24)} J`;
}
