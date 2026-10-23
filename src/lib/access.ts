import { type Access, apiBase } from '@/lib/news';

/**
 * Asks the server which of these articles can be read in full. Returns what it
 * could verify (the pages declare it themselves); anything missing keeps the
 * outlet's usual model. Without a server, nothing is returned.
 */
export async function fetchAccess(urls: string[]): Promise<Record<string, Access>> {
  const base = apiBase();
  if (base === null) return {};
  try {
    const response = await fetch(`${base}/api/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: urls.slice(0, 24) }),
    });
    if (!response.ok) return {};
    const body = (await response.json()) as { access?: Record<string, Access> };
    // Only the two states we can show; any other value is treated as unknown (never trusted blindly).
    const clean: Record<string, Access> = {};
    for (const [url, value] of Object.entries(body.access ?? {})) {
      clean[url] = value === 'free' || value === 'paid' ? value : 'unknown';
    }
    return clean;
  } catch {
    return {};
  }
}
