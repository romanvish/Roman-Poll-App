import { getLatestPublishedPoll } from "@/lib/server/published-polls";
import { rankingOptions, rankingResponse } from "@/app/api/rankings/http";

export async function GET() {
  try {
    const poll = await getLatestPublishedPoll();
    return rankingResponse(poll ?? { error: "No published poll is available." }, poll ? 200 : 404);
  } catch {
    return Response.json({ error: "Rankings are not available." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const OPTIONS = rankingOptions;
