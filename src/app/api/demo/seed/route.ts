import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { seedDemoData } from "@/lib/server/seed";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  try {
    return ok(await seedDemoData(user), 201);
  } catch (e) {
    if (e instanceof Error && e.message === "exists") throw new ApiError("conflict", "Demo data can only be loaded into an empty workspace.", 409);
    throw e;
  }
});
