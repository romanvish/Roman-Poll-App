import { getPublishedPoll } from "@/lib/server/published-polls";
import { rankingRouteParamsSchema } from "@/lib/schemas/rankings-route";
import { rankingOptions, rankingResponse } from "@/app/api/rankings/http";

type Context = { params: Promise<{ season: string; week: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const params = rankingRouteParamsSchema.safeParse(await context.params);
    if (!params.success) return rankingResponse({ error: "Poll not found." }, 404);
    const poll = await getPublishedPoll(params.data.season, params.data.week);
    return rankingResponse(poll ?? { error: "Poll not found." }, poll ? 200 : 404);
  } catch {
    return Response.json({ error: "Rankings are not available." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const OPTIONS = rankingOptions;
