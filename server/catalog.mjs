// Choreless catalog — every service is config, not code. The engine runs any
// service defined here: intake fields, an execution prompt, and a QA rubric.
// Add service #8 by adding an entry; no engine changes required.

export const PLANS = {
  starter: { id: "starter", name: "Starter", priceUsd: 29, credits: 10, sla_hours: 48, autopilots: 2 },
  pro: { id: "pro", name: "Pro", priceUsd: 79, credits: 30, sla_hours: 24, autopilots: 5 },
  business: { id: "business", name: "Business", priceUsd: 199, credits: 100, sla_hours: 12, autopilots: Infinity },
  topup: { id: "topup", name: "Credit top-up", priceUsd: 25, credits: 8, sla_hours: null, autopilots: 0 },
};

export const SERVICES = {
  "before-you-sign": {
    id: "before-you-sign",
    name: "Before You Sign",
    lane: "Life",
    flagship: true,
    tagline: "Never sign anything blind again. Paste the contract, get the trap map.",
    description:
      "Send any lease, job offer, freelance contract, quote, or terms-of-service BEFORE you commit. You get a plain-English risk brief: every clause that can cost you money ranked by worst-case dollar impact, the questions to ask, what's negotiable in your market, and a ready-to-send negotiation email.",
    credits: 2,
    autopilot: false,
    requires_approval: false,
    intake: [
      { key: "document", label: "Paste the full document text", type: "textarea", required: true },
      { key: "doc_type", label: "What is it? (lease, job offer, contract, quote, ToS…)", type: "text", required: true },
      { key: "goal", label: "What do you want out of this deal?", type: "text", required: false },
      { key: "worries", label: "Anything you're already worried about?", type: "text", required: false },
    ],
    keywords: ["lease", "contract", "sign", "offer", "terms", "agreement", "quote", "nda", "negotiate"],
    produce_prompt: (inputs, profile) => `You are Choreless "Before You Sign" — a contracts analyst working for the CUSTOMER (never the counterparty).

Document type: ${inputs.doc_type}
Customer goal: ${inputs.goal || "not stated — infer the obvious goal"}
Customer's stated worries: ${inputs.worries || "none stated"}
${profile ? `Customer profile: ${profile}` : ""}

DOCUMENT:
<<<
${inputs.document}
>>>

Produce a deliverable in Markdown with exactly these sections:
# Risk Brief: ${inputs.doc_type}
## Verdict (one paragraph: sign / negotiate first / walk away, and why)
## Trap Map — clauses ranked by worst-case cost to you
For each: quote the clause (short), plain-English meaning, realistic worst case in dollars or consequences, severity (🔴/🟠/🟡).
## What's missing (protections this document should have but doesn't)
## Questions to ask before signing (numbered, copy-pasteable)
## What's negotiable (and the exact ask for each)
## Ready-to-send negotiation email (complete draft, polite but firm)

Rules: never invent clauses that aren't in the document; if the document is truncated or missing sections, say so explicitly. This is practical analysis, not legal advice — end with a one-line note recommending a licensed attorney for high-stakes documents.`,
    rubric: [
      "Every clause quoted in the Trap Map actually appears in the provided document (no fabrication)",
      "Worst cases are concrete (dollars/consequences), not vague",
      "All seven required sections are present and non-empty",
      "The negotiation email is complete and ready to send as-is",
      "Contains the not-legal-advice note",
    ],
  },

  "ghostwriter": {
    id: "ghostwriter",
    name: "Hard Conversation Ghostwriter",
    lane: "Life",
    tagline: "The message you've been dreading, written right.",
    description:
      "Fire a client, chase overdue money, ask for a raise, push back on scope creep, deliver bad news. You get the message written in your voice, a fallback shorter version, and the follow-up for when they reply.",
    credits: 2,
    autopilot: false,
    requires_approval: true,
    intake: [
      { key: "situation", label: "Describe the situation and history", type: "textarea", required: true },
      { key: "outcome", label: "What outcome do you need?", type: "text", required: true },
      { key: "relationship", label: "Who is it, and do you need to preserve the relationship?", type: "text", required: true },
      { key: "channel", label: "Channel (email, text, Slack, in person script)", type: "text", required: false },
    ],
    keywords: ["email", "message", "raise", "fire", "client", "awkward", "conversation", "chase", "invoice", "overdue"],
    produce_prompt: (inputs, profile) => `You are Choreless's Hard Conversation Ghostwriter. Write FOR the customer, in a natural human voice — never corporate-speak, never AI-sounding.

Situation: ${inputs.situation}
Required outcome: ${inputs.outcome}
Relationship & stakes: ${inputs.relationship}
Channel: ${inputs.channel || "email"}
${profile ? `Customer voice profile: ${profile}` : ""}

Produce in Markdown:
# The Message
## Primary draft (ready to send on ${inputs.channel || "email"})
## Shorter fallback version
## If they push back — your reply
## If they go silent — the follow-up (with timing advice)
## Delivery notes (when to send, tone traps to avoid, one thing NOT to say)

The draft must pursue the stated outcome directly, keep leverage, and stay something the customer can send without editing.`,
    rubric: [
      "Primary draft directly pursues the customer's stated outcome",
      "Voice is natural and human; no corporate filler or AI tells",
      "All five sections present; drafts are complete, not outlines",
      "Advice is specific to this situation, not generic",
    ],
  },

  "refund-recovery": {
    id: "refund-recovery",
    name: "Refund & Comp Recovery",
    lane: "Life",
    tagline: "Every company banks on you never claiming. We claim.",
    autopilot: true,
    credits: 2,
    results_priced: true,
    requires_approval: true,
    description:
      "Price drops, flight delays, outages, wrong charges, hotel fails. You get a filing-ready claim packet: eligibility analysis, the exact claim text, where to file it, and the escalation ladder if they say no. Credits only spent when a claim is filed.",
    intake: [
      { key: "incident", label: "What happened? (dates, amounts, company)", type: "textarea", required: true },
      { key: "evidence", label: "What evidence do you have? (receipts, screenshots, emails)", type: "textarea", required: false },
      { key: "spent", label: "Amount involved ($)", type: "text", required: true },
    ],
    keywords: ["refund", "delay", "flight", "charge", "overcharged", "price drop", "compensation", "outage", "cancelled"],
    produce_prompt: (inputs, profile) => `You are Choreless Refund & Comp Recovery — you build filing-ready claim packets that companies actually pay.

Incident: ${inputs.incident}
Evidence available: ${inputs.evidence || "none listed — note what the customer should gather"}
Amount involved: $${inputs.spent}
${profile ? `Customer profile: ${profile}` : ""}

Produce in Markdown:
# Claim Packet
## Eligibility analysis (what you're owed and under which policy/regulation — cite the actual rule, e.g. EU261, DOT rules, card chargeback rights, retailer price-adjustment policy)
## Realistic recovery estimate ($ range and odds)
## The claim (exact text, ready to paste into their form/chat/email)
## Where and how to file (specific channel; steps)
## Escalation ladder (what to do at each "no": supervisor script → regulator/chargeback → small claims threshold)
## Evidence checklist

Never advise anything fraudulent or exaggerated; claims must match the incident exactly. If nothing is realistically recoverable, say so plainly and spend zero of the customer's time — that IS the deliverable.`,
    rubric: [
      "Cites a real, applicable policy/regulation for eligibility",
      "Claim text is ready to paste and factually matches the incident",
      "Escalation ladder is concrete with scripts",
      "No exaggeration or fabricated damages anywhere",
    ],
  },

  "footprint-cleaner": {
    id: "footprint-cleaner",
    name: "Digital Footprint Cleaner",
    lane: "Life",
    tagline: "Data brokers re-list you. We keep scrubbing.",
    autopilot: true,
    credits: 6,
    results_priced: true,
    requires_approval: true,
    description:
      "A personalized removal campaign: which data brokers likely hold your profile, opt-out request letters generated for each (CCPA/GDPR-grounded), deletion requests for zombie accounts, and a monthly re-scan plan. Production deployment executes filings via the browser fleet after your signed authorization.",
    intake: [
      { key: "name", label: "Full name (as listed publicly)", type: "text", required: true },
      { key: "locations", label: "Cities/states you've lived in", type: "text", required: true },
      { key: "concerns", label: "Main concern (stalking, doxxing, job search, general privacy)", type: "text", required: false },
      { key: "old_accounts", label: "Old accounts/sites you want gone (if known)", type: "textarea", required: false },
    ],
    keywords: ["privacy", "data broker", "remove", "delete my", "doxx", "spokeo", "whitepages", "footprint", "scrub"],
    produce_prompt: (inputs, profile) => `You are Choreless Digital Footprint Cleaner. Build a removal campaign the customer (or our agent fleet, once authorized) can execute today.

Name: ${inputs.name}
Locations: ${inputs.locations}
Primary concern: ${inputs.concerns || "general privacy"}
Zombie accounts mentioned: ${inputs.old_accounts || "none listed"}

Produce in Markdown:
# Footprint Removal Campaign
## Priority broker list (the major people-search/data brokers most likely to list this profile, ordered by exposure for the stated concern; include each one's opt-out URL/channel)
## Opt-out request letter (one master letter citing CCPA §1798.105/§1798.120 and GDPR Art. 17 where applicable, with per-broker fill-in fields)
## Zombie account deletion requests (per named account: where to send, exact request text)
## Search-result hygiene (Google results removal tool, cached pages, social lockdown steps ranked by impact)
## Monthly re-scan plan (what to re-check; brokers are known to re-list)
## What we could NOT do from here (anything needing ID verification, phone calls, or notarized mail — flagged for human-ops)

Accuracy rule: only name brokers and procedures you are confident exist; never invent URLs.`,
    rubric: [
      "Broker list contains only real, well-known data brokers",
      "Letters cite the correct statutes and are usable as-is",
      "Concern-specific prioritization is visible (not a generic list)",
      "Human-ops-required items are explicitly flagged, not glossed over",
    ],
  },

  "clip-factory": {
    id: "clip-factory",
    name: "Clip Factory",
    lane: "Creator",
    tagline: "Long video in. Retention-scored shorts plan out.",
    credits: 5,
    autopilot: false,
    requires_approval: false,
    description:
      "Give us a video link or transcript. You get a full production packet: the highest-retention moments time-coded and scored, hook rewrites for each clip, captions, title/thumbnail concepts, and a posting schedule. (Rendered video export ships via the production pipeline.)",
    intake: [
      { key: "source", label: "Video link and/or transcript", type: "textarea", required: true },
      { key: "audience", label: "Who's the audience and what platform?", type: "text", required: true },
      { key: "count", label: "How many clips do you want?", type: "text", required: false },
    ],
    keywords: ["video", "clip", "shorts", "reel", "tiktok", "youtube", "edit", "podcast"],
    produce_prompt: (inputs, profile) => `You are Choreless Clip Factory. Turn long-form source material into a short-form production packet.

Source: ${inputs.source}
Audience/platform: ${inputs.audience}
Clips requested: ${inputs.count || "5"}
${profile ? `Creator brand/voice profile: ${profile}` : ""}

Produce in Markdown:
# Clip Production Packet
For each of the ${inputs.count || "5"} clips:
## Clip N — "title"
- Source moment (timestamp if determinable from the source, else quote the passage)
- Retention score (1-10) and WHY this moment holds attention
- Hook (first 2 seconds, rewritten for the platform)
- Full caption text
- Title + thumbnail concept
Then finish with:
## Posting schedule (order, days, times, platform-specific notes)
## The one clip to bet on (and why)

If the source is only a link with no transcript, work from what the link metadata implies and state clearly which parts need the transcript to finalize.`,
    rubric: [
      "Every clip maps to a real moment/passage in the provided source",
      "Hooks are platform-native, not generic",
      "Retention reasoning is specific per clip",
      "Posting schedule and top-pick sections present",
    ],
  },

  "reputation-autopilot": {
    id: "reputation-autopilot",
    name: "Reputation Autopilot",
    lane: "Business",
    tagline: "Reviews answered every week, in your voice, before they fester.",
    credits: 3,
    autopilot: true,
    requires_approval: true,
    description:
      "Weekly run: your new reviews get on-brand responses drafted (praise amplified, problems defused, fake reviews flagged with a removal request), plus a monthly reputation report. Posts after your one-tap approval.",
    intake: [
      { key: "business", label: "Business name and what you do", type: "text", required: true },
      { key: "reviews", label: "Paste the reviews to handle (or connect Google/Yelp in production)", type: "textarea", required: true },
      { key: "voice", label: "Your voice (e.g. warm, witty, formal)", type: "text", required: false },
    ],
    keywords: ["review", "reviews", "google", "yelp", "reputation", "star", "respond"],
    produce_prompt: (inputs, profile) => `You are Choreless Reputation Autopilot for "${inputs.business}".
Voice: ${inputs.voice || "warm and professional"}
${profile ? `Brand profile: ${profile}` : ""}

REVIEWS:
<<<
${inputs.reviews}
>>>

Produce in Markdown:
# Review Response Batch
For each review: quote it (short), classify (praise / fixable complaint / unfair-suspicious), then the ready-to-post response in the business's voice. For suspicious/fake reviews, also include a platform removal request draft.
## Patterns this batch reveals (operational insight, 3 bullets max)
## This week's reputation score (1-10 with one-line justification)

Responses must never argue, never admit legal liability, always move complaints offline with a concrete next step.`,
    rubric: [
      "Every provided review gets a response; none skipped",
      "Responses match the requested voice and never argue",
      "Complaints are moved offline with a concrete step",
      "Suspicious reviews get a removal-request draft",
    ],
  },

  "social-autopilot": {
    id: "social-autopilot",
    name: "Social Autopilot",
    lane: "Business",
    tagline: "A month of on-brand posts, scheduled after one approval.",
    credits: 8,
    autopilot: true,
    requires_approval: true,
    description:
      "A 30-day content calendar designed for your business: post copy, image direction, hashtags, and timing per platform. Approve once; production deployment schedules it into your connected accounts.",
    intake: [
      { key: "business", label: "Business name, what you sell, to whom", type: "textarea", required: true },
      { key: "platforms", label: "Platforms (Instagram, LinkedIn, X, TikTok…)", type: "text", required: true },
      { key: "goals", label: "This month's goal (launches, promos, events)", type: "text", required: false },
    ],
    keywords: ["social", "instagram", "post", "content calendar", "linkedin", "tiktok", "marketing"],
    produce_prompt: (inputs, profile) => `You are Choreless Social Autopilot.
Business: ${inputs.business}
Platforms: ${inputs.platforms}
Goal this month: ${inputs.goals || "consistent presence and engagement"}
${profile ? `Brand profile: ${profile}` : ""}

Produce in Markdown:
# 30-Day Content Calendar
## Strategy (5 lines max: pillars, cadence per platform, voice)
## The calendar
A table: Day | Platform | Post copy (complete, ready to post) | Visual direction | Hashtags | Best time
Cover 30 days at a realistic cadence for the platforms listed (not necessarily daily on all).
## Content to prepare in advance (photos/videos the owner should capture, one list)

Copy must be specific to THIS business — no placeholder-brand filler.`,
    rubric: [
      "Calendar covers 30 days at a stated, realistic cadence",
      "Post copy is complete and business-specific, not templated filler",
      "Visual directions are actionable by a non-designer",
      "Strategy section ties pillars to the stated goal",
    ],
  },
};

// Keyword router for Task Drop. Returns {service, confidence} or null.
export function routeTask(text) {
  const t = text.toLowerCase();
  let best = null;
  for (const svc of Object.values(SERVICES)) {
    const hits = svc.keywords.filter((k) => t.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { service: svc.id, hits };
  }
  return best ? { service: best.service, confidence: Math.min(0.5 + best.hits * 0.15, 0.95) } : null;
}
