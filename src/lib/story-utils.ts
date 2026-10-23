import type { Access, Article, Outlet, Story } from '@/lib/news';

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** "lun. 19 oct., 14:32" (written by hand: Intl locale support differs between engines). */
export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatClock(timestamp: number): string {
  const d = new Date(timestamp);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Mardi 20 octobre" */
export function formatToday(now = new Date()): string {
  const day = DAYS_LONG[now.getDay()];
  return `${day[0].toUpperCase()}${day.slice(1)} ${now.getDate()} ${MONTHS_LONG[now.getMonth()]}`;
}

/** "il y a 12 min", "il y a 3 h", "il y a 2 j" */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

/** Shortens a long chapô at a sentence end when possible ("…" otherwise). */
export function shortenText(text: string, max = 320): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export function uniqueOutlets(story: Story): Outlet[] {
  const seen = new Map<string, Outlet>();
  story.articles.forEach(article => seen.set(article.outlet.name, article.outlet));
  return [...seen.values()];
}

/**
 * Large picture of a story. Once the server has looked at the pictures
 * (`imageChecked`), "no image" means none was good enough: we show none rather
 * than a blurry or captioned one. Without a server, the first feed thumbnail.
 */
export function storyImage(story: Story): string | undefined {
  if (story.imageChecked) return story.image;
  return story.articles.find(article => article.image)?.image;
}

/** Small picture for list rows. */
export function storyThumb(story: Story): string | undefined {
  if (story.imageChecked) return story.thumb ?? story.image;
  return story.articles.find(article => article.image)?.image;
}

export type OutletGroup = { outlet: Outlet; articles: Article[] };

/** Free first: what the reader can open and read in full comes before what asks for a subscription. */
export function accessRank(access: Access): number {
  return { free: 0, unknown: 1, paid: 2 }[access];
}

/**
 * Articles grouped by outlet. With `accessOf`, free articles come first inside
 * each outlet, and outlets that have a free article come before the others;
 * ties keep the most recent first.
 */
export function groupByOutlet(articles: Article[], accessOf?: (article: Article) => Access): OutletGroup[] {
  const rank = (article: Article) => (accessOf ? accessRank(accessOf(article)) : 0);
  const groups = new Map<string, OutletGroup>();
  [...articles]
    .sort((a, b) => rank(a) - rank(b) || b.publishedAt - a.publishedAt)
    .forEach(article => {
      const group = groups.get(article.outlet.name) ?? { outlet: article.outlet, articles: [] };
      group.articles.push(article);
      groups.set(article.outlet.name, group);
    });
  const newest = (group: OutletGroup) => Math.max(...group.articles.map(article => article.publishedAt));
  const best = (group: OutletGroup) => Math.min(...group.articles.map(rank));
  return [...groups.values()].sort((a, b) => best(a) - best(b) || newest(b) - newest(a));
}


/** The "subject of the moment": the most covered story of the last 24 hours. */
export function pickLead(stories: Story[], now = Date.now()): Story | undefined {
  let best: Story | undefined;
  // The big card needs a good picture: stories without one only lead when nothing else can.
  const withPicture = stories.filter(story => storyImage(story));
  for (const story of withPicture.length > 0 ? withPicture : stories) {
    if (now - story.publishedAt > 24 * 3_600_000) continue;
    if (
      !best ||
      uniqueOutlets(story).length > uniqueOutlets(best).length ||
      (uniqueOutlets(story).length === uniqueOutlets(best).length && story.publishedAt > best.publishedAt)
    ) {
      best = story;
    }
  }
  return best;
}

/** What the reader has already seen of a story: the time of its latest article when it was opened. */
export type ReadEntry = { latest: number; at: number };
export type ReadMap = Record<string, ReadEntry>;

/**
 * - new: never opened and it appeared since the last visit
 * - updated: already opened, but it received articles since
 * - read: opened, nothing new
 * - unread: never opened, but it was there before the last visit
 */
export type StoryStatus = { kind: 'new' | 'updated' | 'read' | 'unread'; fresh: number };

export function storyStatus(
  story: Story,
  read: ReadMap,
  baseline: number | null,
  arrivedThisSession?: Set<string>
): StoryStatus {
  const entry = read[story.id];
  if (entry) {
    const fresh = story.articles.filter(article => article.publishedAt > entry.latest).length;
    return fresh > 0 ? { kind: 'updated', fresh } : { kind: 'read', fresh: 0 };
  }
  const isNew = (baseline !== null && story.publishedAt > baseline) || !!arrivedThisSession?.has(story.id);
  return { kind: isNew ? 'new' : 'unread', fresh: 0 };
}

export type Section = { label: string; items: Story[] };

function bucketOf(timestamp: number, now: Date): string {
  const diff = now.getTime() - timestamp;
  if (diff < 3_600_000) return 'Dernière heure';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= startOfToday) return 'Aujourd’hui';
  if (timestamp >= startOfToday - 86_400_000) return 'Hier';
  return 'Plus tôt';
}

/** Splits an already sorted (newest first) list into time sections. */
export function sectionize(stories: Story[], now = new Date()): Section[] {
  const sections: Section[] = [];
  for (const story of stories) {
    const label = bucketOf(story.publishedAt, now);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.items.push(story);
    else sections.push({ label, items: [story] });
  }
  return sections;
}
