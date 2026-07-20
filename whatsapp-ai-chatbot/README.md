# WhatsApp AI Chatbot — Text / Voice / PDF / Image (RAG + Memory)

An importable **n8n** workflow that turns a WhatsApp Business number into a smart,
context-aware assistant. It understands **text, voice notes, images, PDFs and
spreadsheets**, answers with **RAG over MongoDB Atlas Vector Search**, remembers the
conversation, and replies back on WhatsApp — end to end.

> Faithful rebuild of the reference blueprint: **n8n + OpenAI + WhatsApp Cloud API + MongoDB Atlas**.

```
WhatsApp Trigger ─▶ Route Types ─┬─ Text ───────────────────────────────▶ Map text prompt ─────────┐
                                 │                                                                  │
                                 ├─ Voice ─▶ Get URL ▶ Download ▶ Transcribe ▶ Map voice prompt ────┤
                                 │                                                                  │
                                 ├─ Image ─▶ Get URL ▶ Download ▶ Analyze (vision) ▶ Map image ─────┤
                                 │                                                                  ▼
                                 └─ Doc ──▶ Get URL ▶ Download ▶ Route ext ▶ Extract ▶ Map doc ──▶ Knowledge Base Agent ─▶ Send Response
                                                          (PDF / XLS / XLSX)                         │  ▲        ▲
                                                                                    OpenAI Chat Model ┘  │        │
                                                                                         Simple Memory ──┘        │
                                                                          MongoDB Vector Search (tool) ──────────┘
                                                                                     └─ Embeddings OpenAI
```

## Files

| File | What it is |
| --- | --- |
| `workflow.json` | The main chatbot workflow — import this into n8n. |
| `ingest-knowledge-base.json` | Companion workflow to load PDFs/docs into the vector store (RAG is empty until you run this). |

## "Huge context on anything"

- **Chat model:** `gpt-4.1` (≈1M-token context) so the agent can reason over long documents and long histories.
- **Memory window:** `contextWindowLength: 100` turns of conversation per user.
- **Retrieval:** `topK: 8` chunks from MongoDB Atlas, embedded with `text-embedding-3-large`.
- Any modality (voice→transcript, image→vision analysis, doc→extracted text) is normalized into a single `chatInput` field, so the same big-context agent handles all of them.

Change the model in **OpenAI Chat Model**, **OpenAI Analyze Image**, and **Embeddings OpenAI** nodes if you prefer a different one.

---

## Setup (about 20 minutes)

### 1. Prerequisites
- An **n8n** instance (Cloud or self-hosted, v1.60+ recommended — the AI Agent v2 and MongoDB Atlas Vector Store nodes need a recent build).
- An **OpenAI** API key.
- A **MongoDB Atlas** cluster (M0 free tier works) with Vector Search enabled.
- A **Meta / WhatsApp Cloud API** app (WhatsApp Business Platform).

### 2. Create the credentials in n8n
Under **Credentials → New**, create:
1. **OpenAI** — your API key. Used by the chat model, transcription, vision, and embeddings.
2. **MongoDB Atlas** (or the generic MongoDB credential) — connection string to your cluster.
3. **WhatsApp API** — the Cloud API access token + business account. Used by the trigger and the media/send nodes.
4. **WhatsApp Trigger** (OAuth/app secret) — for verifying incoming webhooks.
5. **Header Auth** (generic) — name it e.g. `WhatsApp Media Bearer`, with header
   `Authorization` = `Bearer YOUR_WHATSAPP_PERMANENT_TOKEN`. The three **Download** HTTP
   nodes use this to fetch the media binary from Meta's CDN.

### 3. Prepare MongoDB Atlas Vector Search
1. Create a database (e.g. `choreless`) and a collection named **`knowledge_base`**.
2. In **Atlas → Search → Create Search Index → JSON editor**, create a **Vector Search** index named **`vector_index`** on that collection:
   ```json
   {
     "fields": [
       { "type": "vector", "path": "embedding", "numDimensions": 3072, "similarity": "cosine" },
       { "type": "filter", "path": "metadata.source" }
     ]
   }
   ```
   > `numDimensions: 3072` matches `text-embedding-3-large`. If you switch to
   > `text-embedding-3-small`, use `1536`.

### 4. Import the workflows
- In n8n: **Workflows → Import from File** → select `workflow.json`, then again for `ingest-knowledge-base.json`.
- Open each node that shows a red credential badge and pick the credential you created in step 2. (Imported templates never carry secrets — you always assign these once.)
- In **MongoDB Vector Search** / **MongoDB Vector Store (Insert)**, confirm the database is selected and the collection is `knowledge_base` and index is `vector_index`.

### 5. Seed the knowledge base
- Open **`ingest-knowledge-base.json`**, open the **Upload Form** trigger, click **Test / Open form URL**, and upload your PDFs/docs — or wire it to Google Drive / a URL list for bulk loads.
- Each file is chunked (1200 chars, 200 overlap), embedded, and stored with a `source` in metadata for citations.

### 6. Connect WhatsApp
1. In **WhatsApp Trigger**, copy the webhook URL n8n gives you (Production URL once the workflow is **Active**).
2. In the Meta App dashboard → **WhatsApp → Configuration**, set that URL as the **Callback URL**, add your **Verify Token**, and subscribe to the **`messages`** field.
3. Add your test phone number as a recipient (or move the app to production).
4. **Activate** the `workflow.json` workflow.

### 7. Test
Message your WhatsApp number:
- Plain text question → grounded answer with `[source: …]` citations.
- A voice note → transcribed, then answered.
- A photo (with or without caption) → described and answered.
- A PDF / XLSX → extracted and answered.
- Ask a follow-up ("and what about the second point?") → memory keeps context.

---

## How it maps to the blueprint

| Blueprint node | This workflow |
| --- | --- |
| WhatsApp Trigger | `WhatsApp Trigger` (subscribes to `messages`) |
| Route Types (Rules) | `Route Types` switch → Text / Voice / Image / Document |
| Gets … URL (mediaUrlGet) | `Get WhatsApp Voice/Image/Document URL` |
| Download Voicemail/Image/Document | HTTP `Download …` nodes (Header-Auth bearer) |
| OpenAI Transcribe | `OpenAI Transcribe Recording` (Whisper) |
| OpenAI Analyze Image | `OpenAI Analyze Image` (gpt-4.1 vision) |
| Map file extensions / Route Document Types | `Map file extensions` + `Route Document Types` |
| Extract from PDF / XLS / XLSX | three `Extract from …` nodes |
| Map … prompt / Map JSON | the `Map … prompt` Set nodes → unified `chatInput` |
| Knowledge Base Agent (Chat / Memory / Tool) | `Knowledge Base Agent` + `OpenAI Chat Model` + `Simple Memory` + `MongoDB Vector Search` |
| Embeddings OpenAI | `Embeddings OpenAI` |
| Send Response | `Send Response` (WhatsApp text) |

## Notes & gotchas
- **Verify node params on import.** n8n occasionally renames parameters between node
  versions. If a node shows a validation warning after import (most likely the WhatsApp
  media `mediaUrlGet` field or the Extract-from-File operation), open it and re-pick the
  operation from the dropdown — the wiring stays intact.
- **WhatsApp free-form replies** are only allowed inside the 24-hour customer service
  window. Outside it you must send an approved template; add a template message node if
  you need proactive outreach.
- **Voice**: WhatsApp delivers voice notes as `.ogg` (Opus). Whisper accepts it directly.
- **Cost control**: lower `contextWindowLength`, `topK`, or switch to `gpt-4.1-mini` /
  `text-embedding-3-small` (remember to change the index `numDimensions` to 1536).
- **Long documents**: extraction + big context handles most files; for very large PDFs,
  route them through the ingestion workflow instead so they're chunked into RAG rather
  than stuffed into one prompt.
