# InvoiceShield — Hackathon Demo Script

**Stixor AI Hackathon 2026 · Theme: Sovereign AI for Enterprise**
Judged on Problem & Impact 30% · Innovation 20% · Working Prototype 25% · Demo & Storytelling 25%.

> **The one line:** *InvoiceShield checks every invoice before the money moves, and the invoice, the model and the decision
> never leave the company.*

Slot plan, about 6 minutes: **slides 1–6 (2 min) → live demo (3 min) → slides 8–11 (1 min) → questions.**
Every score below was produced by running the sample PDFs through the app's own parser and rules engine against the seeded history.

---

## 1. Pre-stage (do this before your slot, not on stage)

Local-model analysis takes a few seconds per invoice. Pre-stage the middle of the story, and keep the two strongest moments live.

1. `ollama serve` running; `ollama run qwen2.5:3b "hi"` once so the model is warm. Keep a terminal with `ollama ps` ready.
2. App running (`npm run dev`). For a fully local stack: `npm run emulators` + `npm run dev:emulator`.
3. Sign up a **fresh account** (the seed only loads into an empty workspace).
4. Dashboard → **Load synthetic demo data** → toast: *Loaded 9 vendors and 73 synthetic invoices*.
5. Upload **02, 03 and 04** now (Upload invoice → *Try a synthetic sample*). Check they show High 40, High 58, Medium 36.
6. **Do not** upload 01 or 05 yet; those are live.
7. Tabs: deck · app Overview · app Upload invoice. Browser zoom 110–125%. Notifications off.

| # | Sample | Story | Expected | When |
|---|---|---|---|---|
| 1 | `01-legitimate-apex-supplies.pdf` | The normal one | **Low 0** | Live |
| 2 | `02-duplicate-crescent-logistics.pdf` | "Reminder, still unpaid", but the number is already on file twice | **High 40** | Pre-staged |
| 3 | `03-account-and-amount-meridian.pdf` | "Please note our updated banking details" + amount above range | **High 58** | Pre-staged |
| 4 | `04-lookalike-and-arithmetic.pdf` | "Apex Su**p**lies", total PKR 20,000 more than subtotal + tax | **Medium 36** → 18 after correction | Pre-staged |
| 5 | `05-replayed-invoice-summit.pdf` | Old invoice number replayed, new bank, amount ~4×, due in 2 days | **Critical 98** | Live, the climax |
| ★ | `01-…` again | Same file, byte for byte | **Critical 80** | Live, only if time |

---

## 2. Slides (2 minutes)

| Slide | Beat | Say (in your own words) |
|---|---|---|
| 1 Cover | Who and what | "We built InvoiceShield: AI that checks every invoice before it's paid, and never lets the data leave the company." |
| 2 Problem | **Problem & Impact** | "The invoices that cost money don't look wrong: a duplicate sent as a reminder, a real supplier whose bank details 'changed', a name one letter off. Easy to catch with the evidence in front of you. Nobody has it." |
| 3 Why sovereign | **The theme** | "An invoice is bank accounts, supplier pricing and payment timing. You can't send that to a cloud AI. So the AI comes to the data." |
| 4 What we built | Read → Check → Decide | "A local model reads it, nine rules check it against what we already know, a person decides, and everything is logged." |
| 5 Architecture | **Technical choices** | "Everything in this dashed line is running on this laptop right now. Nothing crosses it." |
| 6 Role of AI | **Innovation**, not a wrapper | "The AI does the reading. It can't invent a number, can't give a verdict, and if it's off, the app still works on rules." |
| 7 Live demo | Switch to the app | "Month-end at Stixor Demo Industries. 73 invoices processed, five more arrive this morning." |

---

## 3. Live demo (3 minutes)

**① Overview, 20 s.** KPIs, risk mix, the review queue already leading with Meridian (58), Crescent (40) and "Apex Suplies" (36).
*"Three months of payables. Most of it is green. The queue is sorted by risk, so the first thing you see is what's most likely to cost money."*

**② Upload invoice 1 live, 40 s.** Upload invoice → *Try a synthetic sample* → **Legitimate invoice**. Narrate the stages: uploading, extracting, checking, summarising.
Result **Low 0**. Point at **Extracted fields** next to the PDF. **Mark reviewed**.
*"The local model read vendor, number, date, amounts and IBAN straight off the PDF. Registered vendor, registered account, maths adds up. That's most invoices: they pass quietly."*

**③ Open Meridian, 40 s.** Findings: bank account **•••• 8810 vs registered •••• 5532**, amount **PKR 2,340,000 vs 200k–1.5M**.
Read the **Summary** and first verification step.
*"Real vendor, friendly note, new IBAN. The summary was written by the model on this laptop. It doesn't say fraud, because it isn't allowed to. It says what to check."*
**Flag for investigation** → note: *"Call Meridian on the number in the vendor master to confirm the IBAN change."*
*"The note is mandatory. The next person knows exactly what's pending."*

**④ Open "Apex Suplies", 30 s.** Findings: name **92% similar** to Apex Supplies Ltd., total **PKR 20,000** over subtotal + tax.
In **Extracted fields** set Total to `175500` → **Save and re-run checks** → score drops to **Medium 18**.
*"One letter. A person misses it at 5pm; a string comparison doesn't. And if the vendor sends a corrected total, I fix it, the checks re-run instantly, and the correction is logged."*

**⑤ Upload invoice 5 live, the climax, 40 s.** **Replayed invoice, new bank** → **Critical 98**: duplicate number SFM-0933 (was PKR 324,441), bank **•••• 6620 vs •••• 3317**, amount **PKR 1,450,800 vs 120k–500k**.
*"This is what someone inside a vendor's mailbox does: replay a real invoice, swap the bank details, inflate the amount, make it due in two days. Any one might slip through. Together: Critical. This one never gets paid without a phone call."*

**⑥ Audit trail, 15 s.** Uploaded → analysis completed → marked reviewed → flagged with note → corrected fields (old → new) → analysis completed again.
*"Append-only. Who, what, when, before and after, and why."*

**⑦ Sovereignty proof, 10 s (optional).** Switch to the terminal: `ollama ps` shows `qwen2.5:3b` loaded locally.
*"That's the model. It's on this machine."*
In emulator mode only, and only if rehearsed: turn Wi-Fi off before step ⑤ and run it offline.

**Encore if time:** upload invoice 1 again → **Critical 80** (*Identical file already uploaded* + *Invoice number already recorded*).
*"Same file, byte for byte. The context changed, not the document."*

---

## 4. Back to slides (1 minute)

| Slide | Say |
|---|---|
| 8 What you just saw | Recap invoice 5's three findings and the one next step. |
| 9 Impact | "9 of 73 invoices raised a finding; the rest pass quietly. Zero bytes to an external AI. Every decision recorded." (Demo data, say so.) |
| 10 Technical choices | Only if the room is technical, or hold for questions. |
| 11 Close | "InvoiceShield doesn't approve, reject or pay anything. It reads every invoice, checks it against everything the company knows, and shows the evidence, without the data ever leaving. Thank you." |

---

## 5. Judge questions

| Question | Answer |
|---|---|
| Where's the AI beyond a wrapper? | The local model extracts structured fields from unstructured PDFs and scans, and writes the explanation. It's wrapped in guardrails: numbers verified against the document, verdict words blocked, findings only from rules, automatic rules-only fallback. |
| What's sovereign about it? | Model runs locally via Ollama; files on local disk; no external AI calls by default. Data store runs on the Firebase emulators on-prem, or in the company's own project. Any open model can be swapped in. |
| Is anything still in the cloud? | Be precise: in the default config, auth and invoice metadata are in a Firebase project; `npm run dev:emulator` runs the whole stack locally. Invoice files and the model are local either way. |
| Why a 3B model? | Field extraction with verification doesn't need a giant model, and it runs on hardware finance teams already have. |
| Is the score a fraud probability? | No. It ranks what to review first, built from rule severities. The findings beside it are what matter. |
| What if extraction is wrong? | Unreliable fields are called out; the reviewer corrects them and re-runs checks; the correction is audited. |
| Scanned invoices? | Images go through Tesseract OCR locally. A scanned PDF with no text layer is detected and the user is asked to upload an image. |
| How does it know normal amounts? | A per-vendor range, plus a robust z-score (median/MAD) against that vendor's history once it has 4+ invoices. |
| What's the data? | Entirely synthetic: fictional vendors, generated invoices, marked as synthetic on every PDF. No confidential or personal data. |
| What's next? | ERP connectors, purchase-order and goods-receipt matching, team workspaces and roles, a fine-tuned local extraction model. |

## 6. If something goes wrong live

| Symptom | Fix |
|---|---|
| Upload stuck on *Extracting* | Model cold start. Talk over it ("the model is reading the PDF locally"), or cut to the pre-staged Meridian invoice. |
| Summary source shows *template* | Model unreachable. Say "this is the rules-only fallback; it degrades gracefully" and carry on. |
| Invoice 5 shows no duplicate | Demo data wasn't loaded in this account. Use the slide 8 recap instead. |
| *Identical file already uploaded* too early | That sample was already uploaded in this account. Make it the encore. |

Regenerate the PDFs with `npm run samples`. All vendors and invoices are fictional.
