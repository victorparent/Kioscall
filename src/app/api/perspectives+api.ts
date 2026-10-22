import { getPerspectives, PerspectivesError } from '@/lib/news-perspectives';

const STATUS = { bad_request: 400, not_enough_articles: 422, rate_limited: 429, unavailable: 502 } as const;

/** Body: { urls: string[] } (the story's article URLs). Needs ANTHROPIC_API_KEY on the server. */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'no_ai' }, { status: 501 });
  }
  try {
    const body = (await request.json()) as { urls?: unknown };
    return Response.json(await getPerspectives(body.urls));
  } catch (error) {
    if (error instanceof PerspectivesError) {
      return Response.json({ error: error.code }, { status: STATUS[error.code] });
    }
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
}
