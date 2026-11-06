import { toNextJsHandler } from "better-auth/next-js";
import { AuthConfigurationError, getAuth } from "@/lib/server/auth";

type Method = "GET" | "POST";

async function handle(request: Request, method: Method) {
  try {
    const handlers = toNextJsHandler(getAuth());
    return await handlers[method](request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    }
    throw error;
  }
}

export const GET = (request: Request) => handle(request, "GET");
export const POST = (request: Request) => handle(request, "POST");
