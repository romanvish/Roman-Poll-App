import { parseEnvironment } from "@/lib/schemas/environment";
import { staticSiteEnvironmentSchema } from "@/lib/schemas/public-poll";

export function rankingResponse(body: unknown, status = 200) {
  const { STATIC_SITE_ORIGIN } = parseEnvironment(staticSiteEnvironmentSchema, process.env);
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": STATIC_SITE_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": status >= 400 ? "no-store" : "public, max-age=0, s-maxage=60, stale-while-revalidate=60",
      Vary: "Origin",
    },
  });
}

export function rankingOptions() {
  try {
    const { STATIC_SITE_ORIGIN } = parseEnvironment(staticSiteEnvironmentSchema, process.env);
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": STATIC_SITE_ORIGIN, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin", "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "GET, OPTIONS", "Cache-Control": "no-store" } });
  }
}
