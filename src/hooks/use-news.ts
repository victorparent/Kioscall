import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  DEFAULT_CATEGORIES,
  fetchStories,
  REFRESH_MS,
  type Category,
  type Story,
} from '@/lib/news';

export function useNews() {
  const [stories, setStories] = useState<Story[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const inFlight = useRef(false);
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await fetchStories();
      if (result.stories.length === 0) {
        throw new Error('Aucun flux disponible');
      }
      setStories(result.stories);
      setCategories(result.categories ?? DEFAULT_CATEGORIES);
      setUpdatedAt(Date.now());
      setError(null);
    } catch {
      // Keep the previous stories on screen; just flag the failure.
      setError("Impossible de mettre à jour l'actualité.");
    } finally {
      lastLoad.current = Date.now();
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() - lastLoad.current >= REFRESH_MS) {
        load();
      }
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      subscription.remove();
    };
  }, [load]);

  return { stories, categories, loading, refreshing, error, updatedAt, refresh };
}
