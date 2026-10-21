/**
 * SERVER ONLY. Picks, for every story, the best picture among its articles'
 * thumbnails, after actually looking at the files: they are downloaded (first
 * bytes only), measured, and rejected when too small, not landscape, generic
 * (the same file under several stories) or likely to carry burned-in text
 * (TV screenshots, page captures).
 */
import { imageSize } from 'image-size';

import type { Article, Story } from '@/lib/news';

/** A hero picture fills the top of a card: it must be large and landscape. */
const HERO_MIN_WIDTH = 700;
const HERO_MIN_HEIGHT = 350;
const HERO_MIN_RATIO = 1.25;
const HERO_MAX_RATIO = 2.4;
/** A thumbnail is shown at ~100px: any decent image will do. */
const THUMB_MIN_WIDTH = 300;
const THUMB_MIN_RATIO = 0.8;

/** Heavy files cost mobile data for no visible gain: they only win when nothing lighter is good enough. */
const HEAVY_BYTES = 1_500_000;
const TOO_HEAVY_BYTES = 5_000_000;
const OVERSIZED_WIDTH = 2400;

const MAX_CHECKS_PER_STORY = 4;
const PARALLEL_STORIES = 8;
const FETCH_TIMEOUT_MS = 7_000;
const SNIFF_BYTES = 128 * 1024;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 3000;
/** The same picture under this many stories is a logo or a placeholder, not a photo. */
const GENERIC_AFTER_STORIES = 3;

/** Outlets whose pictures are often TV screenshots with banners and captions burned in. */
const OUTLET_WEIGHT: Record<string, number> = { BFMTV: 0.35, HuffPost: 0.8 };
const CAPTURE_NAME = /capture-d-?ecran|screenshot|screen-shot|capture_ecran/i;

type Verdict = { width: number; height: number; bytes?: number; at: number } | null;
const cache = new Map<string, Verdict>();

/** Same picture, whatever its resizing query string. */
function identity(url: string): string {
  return url.split('?')[0];
}

/** Larger variants some CDNs serve without a signature; the original stays as fallback. */
function candidatesFor(url: string): string[] {
  if (url.startsWith('https://media.ouest-france.fr/')) {
    const upgraded = url
      .replace(/([?&])width=\d+/, '$1width=1200')
      .replace(/([?&])height=\d+/, '$1height=675')
      .replace(/&sign=[^&]*/, '');
    if (upgraded !== url) return [upgraded, url];
  }
  return [url];
}

async function readHead(url: string): Promise<{ head: Uint8Array; bytes?: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Range: `bytes=0-${SNIFF_BYTES - 1}`, 'User-Agent': 'Mozilla/5.0 (compatible; Kioscall)' },
    });
    if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) return null;
    // Full size of the file: from Content-Range ("bytes 0-131071/884211") or Content-Length.
    const range = (response.headers.get('content-range') ?? '').match(/\/(\d+)$/);
    const length = Number(response.headers.get('content-length'));
    const bytes = range ? Number(range[1]) : response.status === 200 && length > 0 ? length : undefined;
    if (!response.body) return { head: new Uint8Array(await response.arrayBuffer()), bytes };

    // Some servers ignore Range and send the whole file: stop after what we need.
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < SNIFF_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
    await reader.cancel().catch(() => undefined);
    const head = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      head.set(chunk, offset);
      offset += chunk.length;
    }
    return { head, bytes };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function measure(url: string): Promise<Verdict> {
  const known = cache.get(url);
  if (known !== undefined && (known === null || Date.now() - known.at < CACHE_TTL_MS)) return known;

  let verdict: Verdict = null;
  const read = await readHead(url);
  if (read) {
    try {
      const { width, height } = imageSize(read.head);
      if (width && height) verdict = { width, height, bytes: read.bytes, at: Date.now() };
    } catch {
      // Unreadable header (or truncated before the size): treated as unusable.
    }
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(url, verdict);
  return verdict;
}

function weightOf(article: Article): number {
  let weight = OUTLET_WEIGHT[article.outlet.name] ?? 1;
  if (article.image && CAPTURE_NAME.test(article.image)) weight *= 0.1;
  return weight;
}

type Picked = { url: string; width: number; height: number; score: number };

async function pickForStory(story: Story, genericImages: Set<string>) {
  // One candidate per outlet, best-weighted outlets first.
  const ordered = story.articles
    .filter(article => article.image && !genericImages.has(identity(article.image)))
    .sort((a, b) => weightOf(b) - weightOf(a));

  let hero: Picked | undefined;
  let thumb: Picked | undefined;
  let checks = 0;

  for (const article of ordered) {
    if (checks >= MAX_CHECKS_PER_STORY || (hero && hero.score >= 1200)) break;

    const weight = weightOf(article);
    for (const url of candidatesFor(article.image as string)) {
      checks += 1;
      const size = await measure(url);
      if (!size) continue;
      const ratio = size.width / size.height;
      if (size.bytes && size.bytes > TOO_HEAVY_BYTES) continue;
      // Beyond ~1600px the picture does not look better on a phone, only heavier.
      let score = weight * Math.min(size.width, 1600);
      if (size.width > OVERSIZED_WIDTH) score *= 0.6;
      if (size.bytes && size.bytes > HEAVY_BYTES) score *= 0.5;
      const picked: Picked = { url, width: size.width, height: size.height, score };

      const isHero =
        size.width >= HERO_MIN_WIDTH && size.height >= HERO_MIN_HEIGHT && ratio >= HERO_MIN_RATIO && ratio <= HERO_MAX_RATIO;
      if (isHero && weight >= 0.5 && (!hero || picked.score > hero.score)) hero = picked;
      if (size.width >= THUMB_MIN_WIDTH && ratio >= THUMB_MIN_RATIO && (!thumb || picked.score > thumb.score)) thumb = picked;
      break; // the first variant that exists is enough for this outlet
    }
  }

  story.image = hero?.url;
  story.thumb = (hero ?? thumb)?.url;
  story.imageChecked = true;
}

/** Runs `worker` over `items` with at most `limit` in flight. */
async function inParallel<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    })
  );
}

export async function attachImages(stories: Story[]): Promise<void> {
  const stories_ = new Map<string, Set<string>>();
  stories.forEach(story =>
    story.articles.forEach(article => {
      if (!article.image) return;
      const key = identity(article.image);
      stories_.set(key, (stories_.get(key) ?? new Set()).add(story.id));
    })
  );
  const generic = new Set([...stories_].filter(([, ids]) => ids.size >= GENERIC_AFTER_STORIES).map(([key]) => key));

  await inParallel(stories, PARALLEL_STORIES, story => pickForStory(story, generic));
}
