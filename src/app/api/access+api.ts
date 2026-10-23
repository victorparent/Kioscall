import { AccessError, getAccess } from '@/lib/news-access';

/** Body: { urls: string[] } (a story's article URLs). Answers { access: { [url]: 'free' | 'paid' | 'unknown' } }. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { urls?: unknown };
    return Response.json({ access: await getAccess(body.urls) });
  } catch (error) {
    if (error instanceof AccessError || error instanceof SyntaxError) {
      return Response.json({ error: 'bad_request' }, { status: 400 });
    }
    console.error('[access] failed:', error);
    return Response.json({ error: 'unavailable' }, { status: 502 });
  }
}
