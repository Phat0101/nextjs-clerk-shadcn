High-level plan to introduce a template - matching vector DB flow (no code yet)
1. Choose the vector-search layer
Convex now supports “vector indices” (beta).
Fits naturally with existing Convex tables / auth.
Keeps data in the same infra, no network hops.
If we later outgrow Convex’s vector limits we can swap to Turbopuffer or another server-less store behind the same API; schema stays the same.
New Convex table
invoiceTemplates
id (Convex)
supplier string
clientName string | null
headerFields Field[] ← exact shape we already use
lineItemFields Field[]
embedding vector<float32>[1536] (Gemini)
createdBy userId
createdAt number
Embedding + search helpers (server side only)
generateEmbedding(text): wraps Vercel AI SDK → Gemini /embed.
matchTemplate({ supplier, clientName })
build search vector = embed( supplier + ' ' + clientName ).
ctx.db.query('invoiceTemplates').near('embedding', searchVector, {limit:1})
return template + similarity.
Mutations / routes
POST /api/template-match
body: { supplier, clientName }
→ if similarity ≥ 0.90 return null else return template.
mutation saveTemplate
args: supplier, clientName, headerFields, lineItemFields
embed metadata, insert row.
Updated front-end flow
When user picks files but before field confirmation:
Quick low-cost LLM call (Gemini flash) extracts supplier & client name only.
Call /api/template-match with those two strings.
If a template is returned →
set analysisResult from template.
skip “Confirm Fields” step and jump directly to “Extract Data”.
UI still shows review table later so user can edit values.
Else → current flow (Confirm Fields) stays.
After the user finishes review for a NEW template → on “Complete Job” also call saveTemplate so it’s available next time.
Changes to existing routes
/api/analyze-invoice
Only invoked when no template match found.
/api/extract-data (unchanged).
/api/export-csv now already respects custom labels.
Client-side state tweaks
Add workflow branch: selecting → (optional analyzingSupplier) →
if templateFound → extracting → reviewing → completed
else → analyzing → confirming → …
Security & multi-tenant isolation
Vector table rows scoped to clientId so suppliers’ templates aren’t leaked across companies.
In matchTemplate include where clientId == user.clientId.
For admin view just lift restriction.
Roll-out sequence
Ship table & saveTemplate first (runs only after manual confirmation).
Add matchTemplate pre-check; still default to manual flow until confidence verified.
Gradually raise similarity threshold (e.g., start at 0.8 → 0.9).
Observability
Log when a template is used vs. created.
Dashboard card: “Templates reused this week”.
Future enhancements
Add “Template Manager” UI for admins/clients to edit or delete stored templates.
Store more metadata (currency, country) to improve match precision.