import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Story } from '@/lib/news';
import type { ReadMap } from '@/lib/story-utils';

/** What the reader keeps on the device: saved stories, what was read, and the last visit. */
const KEYS = {
  saved: 'kioscall:saved:v1',
  read: 'kioscall:read:v1',
  visit: 'kioscall:visit:v1',
};

const SAVED_MAX = 100;
const SAVED_ARTICLES_PER_STORY = 12;
const READ_MAX = 600;
/** Coming back within this delay (a reload, a quick look) is still the same visit. */
const SESSION_GAP_MS = 30 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

type Visit = { lastSeenAt: number; baseline: number };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // unreadable or unavailable storage: start empty
  }
}

function writeJson(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => undefined);
}

export function useReadingState(feed: Story[]) {
  const [savedSnapshots, setSavedSnapshots] = useState<Story[]>([]);
  const [read, setRead] = useState<ReadMap>({});
  /** Stories newer than this are "new since the last visit". null until loaded. */
  const [baseline, setBaseline] = useState<number | null>(null);

  const savedRef = useRef<Story[]>([]);
  const readRef = useRef<ReadMap>({});
  const baselineRef = useRef<number | null>(null);

  const saveVisit = useCallback(() => {
    if (baselineRef.current === null) return;
    const visit: Visit = { lastSeenAt: Date.now(), baseline: baselineRef.current };
    writeJson(KEYS.visit, visit);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, readMap, visit] = await Promise.all([
        readJson<Story[]>(KEYS.saved),
        readJson<ReadMap>(KEYS.read),
        readJson<Visit>(KEYS.visit),
      ]);
      if (cancelled) return;

      const now = Date.now();
      // First ever visit: nothing is "new". A visit after a long absence starts a new
      // session whose baseline is the moment the reader last left; a quick return keeps
      // the baseline of the visit in progress.
      let base = now;
      if (visit) base = now - visit.lastSeenAt > SESSION_GAP_MS ? visit.lastSeenAt : visit.baseline;

      savedRef.current = Array.isArray(saved) ? saved : [];
      readRef.current = readMap && typeof readMap === 'object' ? readMap : {};
      baselineRef.current = base;
      setSavedSnapshots(savedRef.current);
      setRead(readRef.current);
      setBaseline(base);
      saveVisit();
    })();

    // The visit is stamped regularly and when the app leaves the screen: that is
    // the "last time seen" of the next visit.
    const timer = setInterval(saveVisit, HEARTBEAT_MS);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') saveVisit();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [saveVisit]);

  const isSaved = useCallback((id: string) => savedSnapshots.some(story => story.id === id), [savedSnapshots]);

  const toggleSaved = useCallback((story: Story) => {
    const exists = savedRef.current.some(item => item.id === story.id);
    const next = exists
      ? savedRef.current.filter(item => item.id !== story.id)
      : [{ ...story, articles: story.articles.slice(0, SAVED_ARTICLES_PER_STORY) }, ...savedRef.current].slice(0, SAVED_MAX);
    savedRef.current = next;
    setSavedSnapshots(next);
    writeJson(KEYS.saved, next);
  }, []);

  const markRead = useCallback((story: Story) => {
    const next: ReadMap = { ...readRef.current, [story.id]: { latest: story.publishedAt, at: Date.now() } };
    const ids = Object.keys(next);
    if (ids.length > READ_MAX) {
      ids.sort((a, b) => next[a].at - next[b].at).slice(0, ids.length - READ_MAX).forEach(id => delete next[id]);
    }
    readRef.current = next;
    setRead(next);
    writeJson(KEYS.read, next);
  }, []);

  // A saved story shows its latest version when the feed still has it (new articles
  // keep arriving); otherwise the snapshot kept on the device.
  const saved = useMemo(
    () => savedSnapshots.map(snapshot => feed.find(story => story.id === snapshot.id) ?? snapshot),
    [savedSnapshots, feed]
  );

  return { saved, isSaved, toggleSaved, read, markRead, baseline };
}
