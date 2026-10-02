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
  // On Vercel both model calls plus the rules must finish inside the 60 s function limit.
  const timeoutMs = process.env.VERCEL ? Math.min(e.AI_TIMEOUT_MS, 20_000) : e.AI_TIMEOUT_MS;
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
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      content = ((await res.json()) as { message?: { content?: string } }).message?.content;
    } else {
      content = await openRouter(req, jsonSchema, timeoutMs);
    }
    if (!content) return null;
    const parsed = req.schema.safeParse(JSON.parse(content));
    return parsed.success ? { data: parsed.data, source: e.AI_PROVIDER } : null;
  } catch {
    return null;
  }
}

/** Remove keywords some providers reject in strict mode; Zod still enforces them on the response. */
function portableSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(portableSchema);
  if (!node || typeof node !== "object") return node;
  const drop = new Set(["$schema", "minLength", "maxLength", "minItems", "maxItems", "pattern", "format"]);
  return Object.fromEntries(Object.entries(node).filter(([k]) => !drop.has(k)).map(([k, v]) => [k, portableSchema(v)]));
}

/** OpenRouter model chain, e.g. "openai/gpt-4o-mini,google/gemini-2.5-flash-lite". The first is preferred. */
const openRouterModels = () =>
  env()
    .OPENROUTER_MODEL.split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, 3);

/**
 * OpenRouter call with three layers of resilience: OpenRouter-side fallback across the model chain, routing only to
 * providers that honour the JSON schema, and one retry on rate limits / transient errors.
 */
async function openRouter(req: JsonRequest, jsonSchema: Record<string, unknown>, timeoutMs: number): Promise<string | undefined> {
  const e = env();
  if (!e.OPENROUTER_API_KEY) return undefined;
  const schema = portableSchema(jsonSchema) as Record<string, unknown>;
  const models = openRouterModels();
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 2_000) break;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${e.OPENROUTER_API_KEY}`,
          "x-title": "InvoiceShield AI",
        },
        body: JSON.stringify({
          model: models[0],
          models,
          provider: { require_parameters: true, data_collection: "deny" },
          temperature: 0,
          max_tokens: 800,
          response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema } },
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
        }),
        signal: AbortSignal.timeout(remaining),
      });
      if (res.ok) {
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = body.choices?.[0]?.message?.content;
        if (content) return content.replace(/^```(?:json)?\s*|\s*```$/g, "");
      } else {
        console.error("[ai] openrouter", res.status, (await res.text()).slice(0, 200));
        if (res.status !== 429 && res.status < 500) break; // bad key / bad request: retrying will not help
      }
    } catch (err) {
      console.error("[ai] openrouter request failed", err instanceof Error ? err.name : err);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return undefined;
}

/** Lightweight reachability probe for the UI. Never throws. */
export async function aiStatus(): Promise<AiStatus> {
  const e = env();
  if (e.AI_PROVIDER === "none") return { provider: "none", available: false, model: null, external: false };
  if (e.AI_PROVIDER === "openrouter") {
    return { provider: "openrouter", available: Boolean(e.OPENROUTER_API_KEY), model: openRouterModels()[0] ?? null, external: true };
  }
  try {
    const res = await fetch(`${e.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(1500), cache: "no-store" });
    if (!res.ok) throw new Error();
    const body = (await res.json()) as { models?: { name: string }[] };
    const installed = body.models?.some((m) => m.name === e.OLLAMA_MODEL || m.name.startsWith(e.OLLAMA_MODEL + ":") || e.OLLAMA_MODEL.startsWith(m.name));
    // Loading the model from disk is the slowest step, so start it now (fire-and-forget) rather than on the first upload.
    if (installed) {
      fetch(`${e.OLLAMA_BASE_URL}/api/generate`, { method: "POST", body: JSON.stringify({ model: e.OLLAMA_MODEL, keep_alive: "30m" }) }).catch(() => undefined);
    }
    return { provider: "ollama", available: Boolean(installed), model: e.OLLAMA_MODEL, external: false };
  } catch {
    return { provider: "ollama", available: false, model: e.OLLAMA_MODEL, external: false };
  }
}
