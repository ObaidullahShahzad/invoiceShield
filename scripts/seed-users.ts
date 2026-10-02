/**
 * Creates demo reviewer accounts in the configured Firebase project and loads a synthetic workspace for each.
 * Idempotent: existing users keep their password and data. Credentials are written to .seed-credentials.local.md (git-ignored).
 *
 *   npm run seed:users
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { adminAuth } from "@/lib/server/firebase-admin";
import { upsertUser } from "@/lib/server/repo";
import { seedDemoData } from "@/lib/server/seed";

const USERS = [
  { name: "Ayesha Khan", email: "ayesha.khan@invoiceshield.test" },
  { name: "Bilal Ahmed", email: "bilal.ahmed@invoiceshield.test" },
];

const password = () => `Is-${randomBytes(9).toString("base64url")}-26`;

async function main() {
  const rows: string[] = [];
  for (const u of USERS) {
    let uid: string;
    let pw: string | null = null;
    try {
      uid = (await adminAuth().getUserByEmail(u.email)).uid;
      console.log(`exists   ${u.email}`);
    } catch {
      pw = password();
      uid = (await adminAuth().createUser({ email: u.email, password: pw, displayName: u.name, emailVerified: true })).uid;
      console.log(`created  ${u.email}`);
    }
    await upsertUser({ uid, email: u.email, name: u.name });
    try {
      const r = await seedDemoData({ uid, name: u.name });
      console.log(`         seeded ${r.vendors} vendors, ${r.invoices} invoices`);
    } catch (e) {
      console.log(`         ${e instanceof Error && e.message === "exists" ? "workspace already has data, not reseeded" : e}`);
    }
    rows.push(`| ${u.name} | ${u.email} | ${pw ?? "(unchanged — existing account)"} |`);
  }
  writeFileSync(
    ".seed-credentials.local.md",
    `# Demo accounts (local only — do not commit)\n\nProject: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n\n| Name | Email | Password |\n|---|---|---|\n${rows.join("\n")}\n`,
  );
  console.log("credentials written to .seed-credentials.local.md");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
