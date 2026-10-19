import { getNews } from '@/lib/news-ai';

export async function GET() {
  try {
    return Response.json(await getNews(), {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' },
    });
  } catch (error) {
    console.error('[news] failed:', error);
    return Response.json({ error: 'news_unavailable' }, { status: 502 });
  }
}
