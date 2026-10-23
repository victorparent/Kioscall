/**
 * SERVER ONLY. Tells whether an article can be read in full or asks for a
 * subscription, from what the publisher's own page declares:
 *  - the schema.org flag `isAccessibleForFree` (the paywall markup Google asks publishers for);
 *  - or the `article:content_tier` meta tag ("free" / "locked").
 * When a page says nothing, or refuses automated reads (Le Monde answers 402,
 * Libération 403), nothing is claimed: the answer is "unknown" and no label is
 * shown. Only outlets that have no paywall at all are labelled free by default.
 *
 * Safety: only HTTPS pages of the outlets we read are ever fetched (also after
 * a redirect), the number of pages fetched per hour is capped, and every answer
 * is cached on disk, so one story costs a few page reads once, not at every view.
 */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import zlib from 'node:zlib';

import { type Access, accessDefault, outletOfUrl } from '@/lib/news';
import { STATE_DIR } from '@/lib/server-paths';

const FILE = path.join(STATE_DIR, 'access.json');
const MAX_URLS = 24;
const MAX_FETCHES_PER_HOUR = Number(process.env.ACCESS_CHECKS_PER_HOUR ?? 800);
const PARALLEL = 6;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 400_000;
const MAX_REDIRECTS = 3;
/** A paywall rarely changes for an article: a verified answer is kept a week. */
const VERIFIED_TTL_MS = 7 * 24 * 3_600_000;
/** An answer taken from the outlet's usual model is re-checked sooner. */
const FALLBACK_TTL_MS = 3_600_000;
const MAX_ENTRIES = 6000;

type Entry = { access: Access; verified: boolean; at: number };
type Store = { entries: Record<string, Entry>; fetches: number[] };

function readStore(): Store {
  try {
    const store = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Partial<Store>;
    return { entries: store.entries ?? {}, fetches: store.fetches ?? [] };
  } catch {
    return { entries: {}, fetches: [] };
  }
}

function writeStore(store: Store) {
  const urls = Object.keys(store.entries);
  if (urls.length > MAX_ENTRIES) {
    urls
      .sort((a, b) => store.entries[a].at - store.entries[b].at)
      .slice(0, urls.length - MAX_ENTRIES)
      .forEach(url => delete store.entries[url]);
  }
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store));
  } catch {
    // No writable disk: answers are simply not kept.
  }
}

/* ---------- Reading what the page declares ---------- */

/** A page's own statement: true = free, false = paid, null = silent. */
export function declaredFree(html: string): boolean | null {
  let verdict: boolean | null = null;

  // schema.org: any node saying isAccessibleForFree (a paid node wins: sites flag the locked part).
  for (const block of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === 'object') {
          const value = (node as Record<string, unknown>).isAccessibleForFree;
          if (value !== undefined) {
            const free = String(value).toLowerCase() === 'true';
            verdict = verdict === false ? false : free;
          }
          Object.values(node).forEach(walk);
        }
      };
      walk(JSON.parse(block[1]));
    } catch {
      // Malformed JSON-LD: ignore this block.
    }
  }
  if (verdict !== null) return verdict;

  // Open Graph style tier ("free", "locked", "metered").
  const tier = html.match(/<meta[^>]+(?:property|name)=["']article:content_tier["'][^>]*content=["']([^"']*)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']article:content_tier["']/i)?.[1];
  if (tier) return tier.toLowerCase() === 'free';
  return null;
}

/** Reads the start of a page with Node's own HTTPS client, which sends exactly the headers given. */
function requestPage(url: string): Promise<{ status: number; location?: string; html: string } | null> {
  return new Promise(resolve => {
    let done = false;
    const finish = (value: { status: number; location?: string; html: string } | null) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    const request = https.request(
      url,
      {
        method: 'GET',
        timeout: FETCH_TIMEOUT_MS,
        // Honest identity, with the ordinary headers of a reader (some sites refuse requests without them).
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Kioscall/1.0)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Accept-Encoding': 'gzip, br',
        },
      },
      response => {
        const status = response.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          response.resume();
          finish({ status, location: response.headers.location, html: '' });
          return;
        }
        const encoding = String(response.headers['content-encoding'] ?? '');
        const body =
          encoding === 'gzip'
            ? response.pipe(zlib.createGunzip())
            : encoding === 'br'
              ? response.pipe(zlib.createBrotliDecompress())
              : response;
        const chunks: Buffer[] = [];
        let total = 0;
        const end = () => finish({ status, html: Buffer.concat(chunks).toString('utf-8') });
        body.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          total += chunk.length;
          if (total >= MAX_BYTES) {
            request.destroy(); // the flag is near the top of the page: no need for the rest
            end();
          }
        });
        body.on('end', end);
        body.on('error', end);
      }
    );
    request.on('timeout', () => {
      request.destroy();
      finish(null);
    });
    request.on('error', () => finish(null));
    request.end();
  });
}

async function readPage(url: string, hops = 0): Promise<{ status: number; html: string } | null> {
  if (!outletOfUrl(url)) return null; // never anything but the outlets' own HTTPS pages
  const page = await requestPage(url);
  if (!page) return null;
  if (page.status >= 300 && page.status < 400) {
    if (!page.location || hops >= MAX_REDIRECTS) return { status: page.status, html: '' };
    return readPage(new URL(page.location, url).toString(), hops + 1); // checked again against the outlet list
  }
  return { status: page.status, html: page.html };
}

async function check(url: string): Promise<Entry> {
  const outlet = outletOfUrl(url) ?? '';
  const page = await readPage(url);
  const declared = page?.html ? declaredFree(page.html) : null;
  if (declared !== null) return { access: declared ? 'free' : 'paid', verified: true, at: Date.now() };
  return { access: accessDefault(outlet), verified: false, at: Date.now() };
}

export class AccessError extends Error {
  constructor(readonly code: 'bad_request') {
    super(code);
  }
}

/** Access of each article URL. Unknown sites are ignored (not fetched, not answered). */
export async function getAccess(urls: unknown): Promise<Record<string, Access>> {
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_URLS || !urls.every(u => typeof u === 'string' && u.length < 600)) {
    throw new AccessError('bad_request');
  }

  const store = readStore();
  const now = Date.now();
  const answer: Record<string, Access> = {};
  const todo: string[] = [];
  for (const url of new Set(urls as string[])) {
    if (!outletOfUrl(url)) continue;
    const entry = store.entries[url];
    const ttl = entry?.verified ? VERIFIED_TTL_MS : FALLBACK_TTL_MS;
    // An entry written by an older version may hold a value that no longer exists: check again.
    const valid = entry && ['free', 'paid', 'unknown'].includes(entry.access);
    if (entry && valid && now - entry.at < ttl) answer[url] = entry.access;
    else todo.push(url);
  }

  // Hourly cap on pages fetched: beyond it, the outlet's usual model answers.
  store.fetches = store.fetches.filter(at => now - at < 3_600_000);
  const allowed = Math.max(0, MAX_FETCHES_PER_HOUR - store.fetches.length);
  const toFetch = todo.slice(0, allowed);
  for (const url of todo.slice(allowed)) answer[url] = accessDefault(outletOfUrl(url) ?? '');
  store.fetches.push(...toFetch.map(() => now));

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, toFetch.length) }, async () => {
      while (next < toFetch.length) {
        const url = toFetch[next++];
        const entry = await check(url);
        store.entries[url] = entry;
        answer[url] = entry.access;
      }
    })
  );

  // Another request may have written meanwhile: keep its entries.
  const latest = readStore();
  writeStore({ entries: { ...latest.entries, ...store.entries }, fetches: store.fetches });
  return answer;
}
