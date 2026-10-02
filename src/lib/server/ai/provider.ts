import "server-only";
import { z } from "zod";
import type { SummarySource } from "@/lib/domain/models";
import { env } from "../env";

export type AiSource = Exclude<SummarySource, "template">;

export interface AiStatus {
  provider: "ollama" | "openrouter" | "none";
  available: boolean;
  model: string | null;
  external: boolean;
}

interface JsonRequest {
  system: string;
  user: string;
  schema: z.ZodType;
}

/**
 * Ask the configured model for a JSON object matching `schema`.
 * Returns null on any failure (unavailable, timeout, invalid JSON, schema violation) — callers fall back to rules.
 */
export async function chatJson<T>(req: JsonRequest & { schema: z.ZodType<T> }): Promise<{ data: T; source: AiSource } | null> {
  const e = env();
  if (e.AI_PROVIDER === "none") return null;
  const jsonSchema = z.toJSONSchema(req.schema);
  try {
    let content: string | undefined;
    if (e.AI_PROVIDER === "ollama") {
      const res = await fetch(`${e.OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: e.OLLAMA_MODEL,
          stream: false,
          // Keep the model resident between uploads; loading it from disk is the slowest step.
          keep_alive: "30m",
          format: jsonSchema,
          options: { temperature: 0 },
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
        }),
        signal: AbortSignal.timeout(e.AI_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      content = ((await res.json()) as { message?: { content?: string } }).message?.content;
    } else {
      if (!e.OPENROUTER_API_KEY) return null;
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${e.OPENROUTER_API_KEY}` },
        body: JSON.stringify({
          model: e.OPENROUTER_MODEL,
          temperature: 0,
          response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: jsonSchema } },
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
        }),
        signal: AbortSignal.timeout(e.AI_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      content = ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
    }
    if (!content) return null;
    const parsed = req.schema.safeParse(JSON.parse(content));
    return parsed.success ? { data: parsed.data, source: e.AI_PROVIDER } : null;
  } catch {
    return null;
  }
}

/** Lightweight reachability probe for the UI. Never throws. */
export async function aiStatus(): Promise<AiStatus> {
  const e = env();
  if (e.AI_PROVIDER === "none") return { provider: "none", available: false, model: null, external: false };
  if (e.AI_PROVIDER === "openrouter") {
    return { provider: "openrouter", available: Boolean(e.OPENROUTER_API_KEY), model: e.OPENROUTER_MODEL, external: true };
  }
  try {
    const res = await fetch(`${e.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(1500), cache: "no-store" });
    if (!res.ok) throw new Error();
    const body = (await res.json()) as { models?: { name: string }[] };
    const installed = body.models?.some((m) => m.name === e.OLLAMA_MODEL || m.name.startsWith(e.OLLAMA_MODEL + ":") || e.OLLAMA_MODEL.startsWith(m.name));
    return { provider: "ollama", available: Boolean(installed), model: e.OLLAMA_MODEL, external: false };
  } catch {
    return { provider: "ollama", available: false, model: e.OLLAMA_MODEL, external: false };
  }
}
