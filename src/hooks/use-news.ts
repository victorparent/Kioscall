import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  DEFAULT_CATEGORIES,
  fetchStories,
  mergeStories,
  REFRESH_MS,
  type Category,
  type Story,
} from '@/lib/news';

/** The feed is also kept on the device: a reload or a restart never starts from an empty page. */
const STORAGE_KEY = 'kioscall:feed:v1';
const STORED_STORIES = 200;
const STORED_ARTICLES_PER_STORY = 12;

type Saved = { stories: Story[]; categories: Category[]; since?: number };

function isSaved(value: unknown): value is Saved {
  const saved = value as Saved | null;
  return (
    !!saved &&
    Array.isArray(saved.stories) &&
    Array.isArray(saved.categories) &&
    saved.stories.every(story => story && typeof story.id === 'string' && Array.isArray(story.articles))
  );
}

export function useNews() {
  const [stories, setStories] = useState<Story[]>([]);
  /** Stories appended by the latest refresh (empty after the first load). */
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const storiesRef = useRef<Story[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  /** True when the server groups with Claude: the "compare the angles" feature then exists. */
  const [aiAvailable, setAiAvailable] = useState(false);
  const categoriesRef = useRef<Category[]>(DEFAULT_CATEGORIES);
  /** Server time of the last answer: asking "since" then returns only what changed. */
  const sinceRef = useRef<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const inFlight = useRef(false);
  const lastLoad = useRef(0);

  /** Rubrics are only ever added: once shown, a rubric stays. */
  const addCategories = useCallback((incoming: Category[]) => {
    const known = new Set(categoriesRef.current.map(category => category.name));
    const added = incoming.filter(category => !known.has(category.name));
    if (added.length === 0) return;
    categoriesRef.current = [...categoriesRef.current, ...added];
    setCategories(categoriesRef.current);
  }, []);

  const persist = useCallback(() => {
    const payload: Saved = {
      stories: [...storiesRef.current]
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, STORED_STORIES)
        .map(story => ({ ...story, articles: story.articles.slice(0, STORED_ARTICLES_PER_STORY) })),
      categories: categoriesRef.current,
      since: sinceRef.current,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await fetchStories(sinceRef.current);
      // An empty answer is normal when nothing changed since the last refresh.
      if (result.stories.length === 0 && storiesRef.current.length === 0) {
        throw new Error('Aucun flux disponible');
      }
      const firstLoad = storiesRef.current.length === 0;
      const { stories: merged, added } = mergeStories(storiesRef.current, result.stories);
      storiesRef.current = merged;
      setStories(merged);
      setNewIds(firstLoad ? new Set() : new Set(added));
      addCategories(result.categories ?? []);
      if (result.grouping) setAiAvailable(result.grouping === 'ai');
      if (result.serverTime) sinceRef.current = result.serverTime;
      persist();
      setUpdatedAt(Date.now());
      setError(null);
    } catch {
      // Keep the previous stories on screen; just flag the failure.
      setError('Impossible de mettre à jour l’actualité.');
    } finally {
      lastLoad.current = Date.now();
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [addCategories, persist]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    // Show what we kept from last time right away, then ask the server for news.
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved: unknown = raw ? JSON.parse(raw) : null;
        if (!cancelled && isSaved(saved) && saved.stories.length > 0) {
          storiesRef.current = saved.stories;
          sinceRef.current = saved.since;
          setStories(saved.stories);
          addCategories(saved.categories);
          setLoading(false);
        }
      } catch {
        // Unreadable or unavailable storage: start from the server's answer.
      }
      if (!cancelled) load();
    })();

    const timer = setInterval(load, REFRESH_MS);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() - lastLoad.current >= REFRESH_MS) {
        load();
      }
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [load, addCategories]);

  return { stories, newIds, categories, aiAvailable, loading, refreshing, error, updatedAt, refresh };
}
