import { apiBase, type Perspectives, type Story } from '@/lib/news';

export type PerspectivesResult =
  | { status: 'ok'; data: Perspectives }
  /** No server, or a server without an API key: the feature is simply not offered. */
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

/** Asks the server to compare the angles of a story. Only the article URLs are sent. */
export async function fetchPerspectives(story: Story): Promise<PerspectivesResult> {
  const base = apiBase();
  if (base === null) return { status: 'unavailable' };

  try {
    const response = await fetch(`${base}/api/perspectives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: story.articles.map(article => article.url).slice(0, 20) }),
    });
    if (response.status === 501) return { status: 'unavailable' };
    if (response.status === 429) {
      return { status: 'error', message: 'Beaucoup de comparaisons demandées pour l’instant. Réessaie dans un moment.' };
    }
    if (response.status === 422) {
      return { status: 'error', message: 'Pas assez de médias différents pour comparer ce sujet.' };
    }
    if (!response.ok) return { status: 'error', message: 'La comparaison n’a pas pu être générée.' };
    return { status: 'ok', data: (await response.json()) as Perspectives };
  } catch {
    return { status: 'error', message: 'Impossible de joindre le serveur.' };
  }
}
