import { getNews } from '@/lib/news-ai';

export async function GET(request: Request) {
  try {
    // `since` (ms): only send the stories that changed after this server time.
    // The client already holds the others, so a refresh stays light.
    const since = Number(new URL(request.url).searchParams.get('since')) || 0;
    const result = await getNews();
    const stories = since
      ? result.stories.filter(story => (story.updatedAt ?? story.publishedAt) > since)
      : result.stories;

    return Response.json(
      { ...result, stories, serverTime: Date.now() },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' } }
    );
  } catch (error) {
    console.error('[news] failed:', error);
    return Response.json({ error: 'news_unavailable' }, { status: 502 });
  }
}
