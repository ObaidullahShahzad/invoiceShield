import "server-only";
import { z } from "zod";

const schema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().optional(),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  STORAGE_DRIVER: z.enum(["firestore", "firebase", "local"]).default("firestore"),
  AI_PROVIDER: z.enum(["ollama", "openrouter", "none"]).default("ollama"),
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:3b"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini,google/gemini-2.5-flash-lite,mistralai/mistral-small-3.2-24b-instruct"),
  AI_TIMEOUT_MS: z.coerce.number().default(90_000),
  // Vercel rejects function request bodies above 4.5 MB, so 4 MB is the safe ceiling there.
  MAX_UPLOAD_MB: z.coerce.number().default(4),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  return (cached ??= schema.parse(process.env));
}

export function adminConfigured(): boolean {
  const e = env();
  return Boolean(
    (e.FIREBASE_ADMIN_PROJECT_ID && e.FIREBASE_ADMIN_CLIENT_EMAIL && e.FIREBASE_ADMIN_PRIVATE_KEY) || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}
