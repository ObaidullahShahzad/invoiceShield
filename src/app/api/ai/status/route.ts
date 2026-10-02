import { aiStatus } from "@/lib/server/ai/provider";
import { handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  await requireApiUser(req);
  return ok(await aiStatus());
});
