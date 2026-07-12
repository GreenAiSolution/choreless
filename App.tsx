import { useEffect, useMemo, useRef, useState } from "react";

/* ============ DATA ============ */

type Lane = "Business" | "Creator" | "Life";

const LANE_COLOR: Record<Lane, string> = {
  Business: "bg-[#0A5C36] text-white",
  Creator: "bg-[#FF4D00] text-white",
  Life: "bg-[#1B3A6B] text-white",
};

const SERVICES: {
  name: string;
  lane: Lane;
  tagline: string;
  deliverable: string;
  whyNow: string;
  credits: number;
  turnaround: string;
  autopilot?: boolean;
  keywords: string[];
}[] = [
  {
    name: "Reputation Autopilot",
    lane: "Business",
    tagline: "Every review answered. Every week.",
    deliverable: "Monitored reviews across Google, Yelp & Facebook, tone-matched responses posted after your one-tap approval, plus a monthly reputation report.",
    whyNow: "88% of customers read responses to reviews before choosing a local business.",
    credits: 3,
    turnaround: "Runs weekly",
    autopilot: true,
    keywords: ["review", "reputation", "yelp", "google", "rating", "respond"],
  },
  {
    name: "Invoice Chaser",
    lane: "Business",
    tagline: "Your money, politely retrieved.",
    deliverable: "Overdue invoices chased with escalating, tone-matched emails; payment links included; a cash-recovered report at month end.",
    whyNow: "Late payments are the #1 cash-flow killer for small businesses.",
    credits: 2,
    turnaround: "Runs on due dates",
    autopilot: true,
    keywords: ["invoice", "overdue", "payment", "owe", "chase", "unpaid", "money", "collect"],
  },
  {
    name: "Social Autopilot",
    lane: "Business",
    tagline: "A month of posts. Designed, written, scheduled.",
    deliverable: "A 30-day content calendar with fully designed posts and captions in your brand kit, scheduled to your accounts after approval.",
    whyNow: "Consistency beats virality — and no owner has time for daily posting.",
    credits: 8,
    turnaround: "48h",
    autopilot: true,
    keywords: ["social", "post", "instagram", "facebook", "content", "calendar", "tiktok"],
  },
  {
    name: "Competitor Radar",
    lane: "Business",
    tagline: "Know their next move first.",
    deliverable: "A weekly brief on your competitors' pricing changes, new offers, reviews and ad activity — with one recommended counter-move.",
    whyNow: "Markets shift weekly now. Annual competitor research is dead.",
    credits: 2,
    turnaround: "Runs weekly",
    autopilot: true,
    keywords: ["competitor", "rival", "market", "pricing", "spy", "watch"],
  },
  {
    name: "Clip Factory",
    lane: "Creator",
    tagline: "One video in. Ten shorts out.",
    deliverable: "Your long-form video cut into captioned, hook-optimized shorts with thumbnails — each scored for predicted retention before delivery.",
    whyNow: "Short-form is where audiences grow; editing is where creators burn out.",
    credits: 5,
    turnaround: "24h",
    keywords: ["video", "clip", "shorts", "podcast", "edit", "youtube", "reels", "cut"],
  },
  {
    name: "Repurpose Engine",
    lane: "Creator",
    tagline: "Make everything from anything.",
    deliverable: "One piece of content becomes a newsletter, an X thread, a LinkedIn post and a blog article — all in your trained voice profile.",
    whyNow: "Multi-platform presence is table stakes; writing it all isn't.",
    credits: 3,
    turnaround: "24h",
    keywords: ["repurpose", "newsletter", "thread", "blog", "linkedin", "article"],
  },
  {
    name: "Brand Kit Lab",
    lane: "Creator",
    tagline: "Your look, on demand.",
    deliverable: "Thumbnails, banners, and post templates generated to match your locked visual identity — unlimited revisions until it's right.",
    whyNow: "CTR lives and dies on the thumbnail. Designers cost $50+ each.",
    credits: 2,
    turnaround: "12h",
    keywords: ["thumbnail", "banner", "design", "logo", "brand", "template", "graphic"],
  },
  {
    name: "Sponsor Kit",
    lane: "Creator",
    tagline: "Always ready to pitch.",
    deliverable: "A media kit that updates itself with your live stats, plus researched sponsor matches and personalized outreach drafts each month.",
    whyNow: "Brand deals are the top creator revenue line — and the least systematized.",
    credits: 4,
    turnaround: "Runs monthly",
    autopilot: true,
    keywords: ["sponsor", "media kit", "brand deal", "pitch", "outreach"],
  },
  {
    name: "Inbox Concierge",
    lane: "Life",
    tagline: "Wake up to three emails, not three hundred.",
    deliverable: "Daily triage of your inbox: replies drafted and waiting, junk unsubscribed, and a morning digest of the 3 things that actually need you.",
    whyNow: "The average professional loses 2.5 hours a day to email.",
    credits: 3,
    turnaround: "Runs daily",
    autopilot: true,
    keywords: ["email", "inbox", "unsubscribe", "triage", "reply", "gmail"],
  },
  {
    name: "Paperwork Agent",
    lane: "Life",
    tagline: "Forms filed. Disputes disputed.",
    deliverable: "Subscription cancellations, billing disputes, insurance claims, government forms — drafted, filed through the right channel, and tracked to resolution.",
    whyNow: "Companies weaponize friction. We automate it away.",
    credits: 2,
    turnaround: "24h",
    keywords: ["cancel", "dispute", "claim", "form", "refund", "insurance", "subscription", "charge"],
  },
  {
    name: "Career Engine",
    lane: "Life",
    tagline: "Every application, tailored.",
    deliverable: "Paste a job posting: get a tailored resume, cover letter and interview prep brief, plus a tracker across every application.",
    whyNow: "AI screening means generic resumes die on arrival.",
    credits: 2,
    turnaround: "12h",
    keywords: ["resume", "job", "cover letter", "interview", "career", "application", "cv"],
  },
  {
    name: "Life Logistics",
    lane: "Life",
    tagline: "The personal assistant tier of life.",
    deliverable: "Booking-ready travel itineraries, appointment wrangling, gift planning, and price-drop monitoring with automatic refund claims.",
    whyNow: "Admin is the tax on modern life. Stop paying it in hours.",
    credits: 3,
    turnaround: "24h",
    keywords: ["travel", "trip", "itinerary", "appointment", "gift", "book", "plan", "flight", "hotel"],
  },
];

const AD_KEYWORDS = ["ad", "ads", "advertis", "campaign", "promote", "marketing", "meta ads", "google ads", "grow sales", "leads"];

/* Deep-dive dossiers per service */
const DEEP: Record<string, { scene: string; steps: [string, string][]; lands: string[]; finePrint: string }> = {
  "Reputation Autopilot": {
    scene: "It's 11:47 on a Tuesday night and someone just left you a one-star review over a parking situation you don't control. You're asleep. Good — stay asleep. By the time you're pouring coffee, a response is drafted in your voice: gracious, specific, and quietly persuasive to the 4,000 strangers who'll read it before deciding whether to walk through your door.",
    steps: [
      ["Listen", "Every review on Google, Yelp and Facebook is picked up within the hour — star rating, text, and the reviewer's history."],
      ["Read the room", "The pipeline studies your past replies, your tone rules, and the reviewer's actual complaint. A missed reservation gets a different response than a rant."],
      ["Draft & flag", "A response is written for your one-tap approval — and if three reviews mention the same broken thing, that pattern gets flagged as an operations alert, not just answered politely."],
      ["Report", "A monthly reputation report: rating trends, response times, and the complaint heatmap that tells you what to actually fix."],
    ],
    lands: ["Every review answered within a week, in your voice", "Operations alerts when complaints cluster", "Monthly reputation report with complaint heatmap"],
    finePrint: "Needs: your Google Business / Yelp / Facebook connections and 10 minutes of tone questions at setup.",
  },
  "Invoice Chaser": {
    scene: "You did the work in March. It's July. The awkward part of chasing money isn't writing the email — it's calibrating it: firm enough to get paid, warm enough to get hired again. That calibration is exactly what a pipeline that has read your entire history with this client does better than your 11pm resentment does.",
    steps: [
      ["Rank the ledger", "Overdue invoices sorted by age, amount, and relationship value — the client worth keeping gets a different ladder than the serial late-payer."],
      ["Match the tone", "Each sequence is written from your email history with that client: first a nudge, then a reminder, then firm — never rude, never groveling."],
      ["Send with teeth", "Every email carries a one-click payment link. Escalations schedule themselves until the invoice closes."],
      ["Count the cash", "Month-end report: what was recovered, what's still aging, and who should be on prepayment terms next time."],
    ],
    lands: ["Tone-matched chase sequences, sent from your address", "Payment links in every message", "Cash-recovered report with prepayment recommendations"],
    finePrint: "Needs: QuickBooks / Stripe / a spreadsheet of invoices — whatever you've got, it adapts.",
  },
  "Social Autopilot": {
    scene: "The businesses that win on social aren't the cleverest — they're the ones still posting in week forty. You know this. You also know you will not be designing a carousel about your seasonal special at midnight on a Sunday. So the calendar builds itself: thirty days of posts that look like you hired someone, because in a sense you did.",
    steps: [
      ["Mine what's working", "Your sales data, seasonality, and past post performance decide what gets pushed — winners promoted, slow movers cleared."],
      ["Write the month", "A 30-day calendar with hooks, captions and hashtags in your voice — mixed formats, not thirty variations of the same post."],
      ["Design every tile", "Each post rendered in your locked brand kit: your colors, your type, your logo placement. No lavender-gradient AI mush."],
      ["Schedule on approval", "You review the month in one sitting, tap approve, and it schedules across Instagram and Facebook."],
    ],
    lands: ["30 designed, captioned, scheduled posts", "A content strategy note explaining why each week pushes what it pushes", "Monthly performance recap feeding the next calendar"],
    finePrint: "Needs: your social accounts connected and a brand kit (we build it at onboarding if you don't have one).",
  },
  "Competitor Radar": {
    scene: "Your competitor dropped their prices on Thursday. You found out three weeks later from a customer who'd already left. Never again: now a quiet watcher reads their website, their socials, their reviews and their ad library every week — and every Monday you get one page that ends with a single recommended move.",
    steps: [
      ["Watch everything", "Competitor websites, menus, pricing pages, social feeds, review streams and public ad libraries — diffed weekly against last week."],
      ["Separate signal from noise", "A new logo is noise. A new offer, a price drop, a hiring spree, a wave of bad reviews — that's signal, and it gets ranked."],
      ["Read their reviews too", "Their unhappy customers are your clearest map of what to do differently — mined and summarized."],
      ["One counter-move", "Every brief ends with a single recommendation: match, ignore, or exploit. No 40-page decks."],
    ],
    lands: ["A one-page Monday brief on up to 5 competitors", "Ranked changes with evidence links", "One recommended counter-move per week"],
    finePrint: "Needs: a list of competitors — or we'll identify them from your market at setup.",
  },
  "Clip Factory": {
    scene: "Somewhere in your 74-minute episode is the 40-second moment that would stop a million thumbs. You know it's in there. You also know finding it means scrubbing timelines until 2am. So don't: upload once, and the factory finds the peaks, cuts them, captions them, frames them vertical, and tells you which one to post first — with a number attached.",
    steps: [
      ["Map the peaks", "Full transcription plus an emotional map: laughter, tension, hot takes, story turns — the moments that hold attention."],
      ["Cut for the hook", "Each clip opens on its strongest three seconds. No 'so anyway, as I was saying' cold starts."],
      ["Dress it", "Animated captions in your style, vertical reframing that keeps faces centered, and a thumbnail per clip."],
      ["Score it", "Every clip gets a predicted-retention score and a recommended posting order. You post the winners, skip the rest."],
    ],
    lands: ["8–12 captioned vertical shorts per upload", "A thumbnail for each", "Retention scores + recommended posting order"],
    finePrint: "Needs: a video link or upload. Works from YouTube, Drive, or a raw file.",
  },
  "Repurpose Engine": {
    scene: "You said something brilliant on camera and it will die there unless it becomes a newsletter, a thread, a LinkedIn post and a blog entry — four rewrites you will absolutely not do. The engine doesn't copy-paste your transcript with different line breaks. It rewrites the idea natively for each platform, in a voice profile trained on the way you actually write.",
    steps: [
      ["Extract the ideas", "The argument, the stories, the one-liners — pulled from the source and ranked by strength."],
      ["Rewrite natively", "A thread is built around a hook-and-payoff. A newsletter is built around intimacy. A blog post around search. Same idea, four different crafts."],
      ["Pass the voice gate", "Every piece is QA'd against your trained voice profile — vocabulary, rhythm, opinions. If it doesn't sound like you, it doesn't ship."],
      ["Package for posting", "Formatted for each platform, with suggested timing. One approval, four channels fed."],
    ],
    lands: ["Newsletter issue, X thread, LinkedIn post, blog article", "Each in your trained voice", "Suggested publish timing per platform"],
    finePrint: "Needs: one source piece (video, podcast, or long post) and your voice profile from onboarding.",
  },
  "Brand Kit Lab": {
    scene: "Your last thumbnail took three hours and still looked like a ransom note. Meanwhile the channel you're losing to ships a perfect one every day, because they pay a designer $60 a pop. The Lab locks your visual identity once — colors, type, face treatment, the works — and then produces on demand, unlimited revisions, until it's exactly right.",
    steps: [
      ["Lock the identity", "One session captures your palette, type, logo rules and reference images into a locked identity file every job obeys."],
      ["Generate wide", "Each request produces multiple directions — not one take-it-or-leave-it comp."],
      ["Test before you see it", "Contrast, legibility-at-thumbnail-size, and CTR heuristics filter the weak options before they reach you."],
      ["Revise until right", "Unlimited revisions inside the task. 'Make my face bigger and the text angrier' is a valid instruction."],
    ],
    lands: ["Thumbnails, banners, and post templates on demand", "All obeying your locked identity file", "Source files included — you own everything"],
    finePrint: "Needs: your existing logo/brand assets, or 20 minutes to build the identity file from scratch.",
  },
  "Sponsor Kit": {
    scene: "A brand emailed asking for your media kit and you sent a PDF with numbers from last spring. That silence you heard afterward was money leaving. Now the kit rebuilds itself monthly from your live stats, and alongside it comes a list of brands actively sponsoring creators your size — each with an outreach draft that mentions their last campaign, not 'Dear Partnerships Team.'",
    steps: [
      ["Pull live numbers", "Subscribers, views, engagement, audience demographics — pulled fresh, never stale."],
      ["Rebuild the kit", "A designed media kit in your brand identity, versioned monthly, always send-ready."],
      ["Hunt the matches", "Brands currently spending on creators in your niche and size band — found via their actual campaign activity."],
      ["Draft the pitch", "Personalized outreach referencing the brand's recent campaigns, with your rates positioned confidently."],
    ],
    lands: ["A self-updating media kit", "Monthly list of matched, actively-spending sponsors", "Personalized outreach drafts ready to send"],
    finePrint: "Needs: your channel/social accounts connected. Rates optional — we'll suggest a range from comparable creators.",
  },
  "Inbox Concierge": {
    scene: "There are 300 unread emails and three of them matter. The tragedy of email isn't volume — it's that the three are buried in the 297. Every morning at 6:45, the 297 are already handled: replies drafted, junk unsubscribed, receipts filed. What you open is a digest that says: these three things need you. That's the whole inbox.",
    steps: [
      ["Overnight triage", "Every message classified: needs-you, needs-a-reply-we-can-draft, informational, junk."],
      ["Draft in your voice", "Replies written from your sent-mail history — your sign-offs, your bluntness level, your exclamation-point policy."],
      ["Prune ruthlessly", "Junk unsubscribed at the source, not filtered. Your inbox shrinks structurally, week over week."],
      ["The 6:45 digest", "Three things that need you, five drafts awaiting one-tap send, and nothing else."],
    ],
    lands: ["A daily morning digest of what actually needs you", "Replies drafted and waiting for one tap", "A structurally shrinking inbox"],
    finePrint: "Needs: Gmail or Outlook connected with scoped, revocable permissions. Drafts never send without you.",
  },
  "Paperwork Agent": {
    scene: "The gym requires cancellation by certified letter. The airline's refund form rejects your browser. The insurer wants Form 4B, which references Form 2A, which doesn't exist. This friction is not an accident — it's a business model. The agent's entire job is to be more stubborn than their process, on your behalf, without you feeling any of it.",
    steps: [
      ["Find the real channel", "Every company has one channel that actually works — a specific form, address, or magic phrase. The agent knows or finds it."],
      ["Draft with the right words", "Disputes cite the card network rule. Cancellations cite the contract clause. Claims cite the policy language. Words that make processors comply."],
      ["File and prove it", "Submitted through the proper channel with timestamps and copies retained — a paper trail built like it might be needed."],
      ["Chase to resolution", "No response in their stated window? It escalates automatically. The task closes when the matter closes, not when the form is sent."],
    ],
    lands: ["Filed cancellations, disputes, claims and forms", "A tracked case with full paper trail", "Escalations until actual resolution"],
    finePrint: "Needs: the details of the situation and any documents. Anything requiring your signature comes back for one tap.",
  },
  "Career Engine": {
    scene: "Your resume is being read by software before any human sees it, and the software is looking for twelve specific words. Sending the same PDF to forty jobs is how good people vanish into applicant tracking systems. Paste a posting instead: twenty minutes later there's a resume rebuilt around this job, a cover letter that mentions something true about this company, and a brief on what they'll ask you.",
    steps: [
      ["Decode the posting", "The role's real keywords and priorities extracted — including the unwritten ones implied by the team and seniority."],
      ["Rebuild, never fabricate", "Your actual experience reframed and reordered for this role. Truthful always — it's your history, weaponized, not invented."],
      ["Write the letter that gets read", "Three tight paragraphs referencing the company's actual work. No 'I am writing to express my interest.'"],
      ["Prep the interview", "Likely questions from the role and your gaps, with suggested answers drawn from your real stories."],
    ],
    lands: ["A tailored resume per posting (ATS-tested formatting)", "A specific, human cover letter", "Interview brief + a tracker across all applications"],
    finePrint: "Needs: your current resume once at setup. Then just paste postings.",
  },
  "Life Logistics": {
    scene: "The trip is booked, which means the work has just begun: the confirmation emails, the seat that changed, the hotel that quietly dropped its rate $60 after you paid. Life admin is a thousand paper cuts that nobody gets credit for handling. Consider it handled — itineraries built to your taste, appointments wrangled, refunds claimed while you live your actual life.",
    steps: [
      ["Learn your taste", "Aisle or window, mornings protected, kids' nap schedule, the airline you're loyal to — preferences remembered forever."],
      ["Build booking-ready plans", "Itineraries with real availability, prices, and a plan B for the leg most likely to go wrong."],
      ["Wrangle the calendar", "Appointment scheduling ping-pong handled by email on your behalf — you get the confirmed slot, not the thread."],
      ["Watch the money", "Prices monitored after booking; drops trigger refund claims automatically. Found money, zero effort."],
    ],
    lands: ["Booking-ready itineraries with backup plans", "Appointments confirmed without the email ping-pong", "Automatic price-drop refund claims"],
    finePrint: "Needs: calendar and email access, plus your preferences (gathered once, refined forever).",
  },
};

/* ============ SUBSCRIPTION GATING ============ */

type Plan = "Starter" | "Pro" | "Business";
const PLAN_RANK: Record<Plan, number> = { Starter: 0, Pro: 1, Business: 2 };
const PLAN_CREDITS: Record<Plan, number> = { Starter: 10, Pro: 30, Business: 100 };

/* Which plan unlocks each service */
const MIN_TIER: Record<string, Plan> = {
  "Inbox Concierge": "Starter",
  "Paperwork Agent": "Starter",
  "Career Engine": "Starter",
  "Life Logistics": "Starter",
  "Invoice Chaser": "Starter",
  "Brand Kit Lab": "Starter",
  "Reputation Autopilot": "Pro",
  "Social Autopilot": "Pro",
  "Clip Factory": "Pro",
  "Repurpose Engine": "Pro",
  "Sponsor Kit": "Pro",
  "Competitor Radar": "Business",
};
const unlocked = (svc: string, plan: Plan) => PLAN_RANK[plan] >= PLAN_RANK[MIN_TIER[svc]];

/* ============ SERVICE RUNTIMES (the 12 functioners) ============ */

type Field = { key: string; label: string; type: "text" | "textarea" | "select"; placeholder?: string; options?: string[] };
type Block = { h: string; lines: string[] };
type Runtime = { fields: Field[]; generate: (v: Record<string, string>) => Block[] };

const pick = <T,>(arr: T[], seed: string): T => arr[Math.abs(seed.split("").reduce((n, c) => n + c.charCodeAt(0), 0)) % arr.length];
const excerpt = (t: string, n = 8) => { const w = (t || "").trim().split(/\s+/); return w.slice(0, n).join(" ") + (w.length > n ? "…" : ""); };

const RUNTIME: Record<string, Runtime> = {
  "Reputation Autopilot": {
    fields: [
      { key: "biz", label: "Your business name", type: "text", placeholder: "Bluebird Café" },
      { key: "stars", label: "Star rating of the review", type: "select", options: ["1", "2", "3", "4", "5"] },
      { key: "review", label: "Paste the review", type: "textarea", placeholder: "Waited 40 minutes and the food was cold…" },
      { key: "tone", label: "Your response tone", type: "select", options: ["Warm & personal", "Polished & professional", "Playful"] },
    ],
    generate: (v) => {
      const s = +v.stars;
      const r = (v.review || "").toLowerCase();
      const issue =
        /wait|slow|line|forever/.test(r) ? "wait times" :
        /rude|staff|service|attitude/.test(r) ? "service" :
        /dirty|clean|mess/.test(r) ? "cleanliness" :
        /price|expensive|charge|cost/.test(r) ? "pricing" :
        /cold|stale|quality|broken/.test(r) ? "quality" : "";
      const opener = s <= 2
        ? `Thank you for telling us straight — this isn't the visit we want anyone to have at ${v.biz}, and I'm sorry we missed the mark.`
        : s === 3
        ? `Thanks for the honest, balanced review — we'll take the three stars, but we want the other two back.`
        : `This made our morning — thank you for taking the time to say it.`;
      const middle = issue
        ? `What you described${v.review ? ` ("${excerpt(v.review)}")` : ""} points at our ${issue}, and it's already been raised with the team — that's a fix, not a platitude.`
        : s <= 3
        ? `We've shared your note with the whole team so the next visit reads very differently.`
        : `We've pinned this one up for the team — it's exactly what we're trying to do every day.`;
      const close =
        v.tone === "Playful" ? `Come back soon — the next one's on its best behavior. 🧡` :
        v.tone === "Warm & personal" ? `If you'll give us another chance, ask for me — I'd like to make this right personally.` :
        `We'd welcome the chance to serve you again, and to a higher standard.`;
      const blocks: Block[] = [
        { h: "Drafted response (awaiting your one-tap approval)", lines: [`${opener} ${middle} ${close}`, `— ${v.biz}`] },
      ];
      if (issue && s <= 3)
        blocks.push({ h: "⚠ Operations signal", lines: [`This is the kind of review we cluster: if 2 more mention ${issue} this month, you'll get an ops alert with the pattern, dates, and suggested fix — not just polite replies.`] });
      blocks.push({ h: "This week, on autopilot", lines: ["• 4 platforms monitored hourly (Google, Yelp, Facebook, TripAdvisor)", "• Every response drafted in this voice, posted only after your tap", "• Month-end: rating trend + complaint heatmap report"] });
      return blocks;
    },
  },

  "Invoice Chaser": {
    fields: [
      { key: "client", label: "Client name", type: "text", placeholder: "Meadow Co." },
      { key: "amount", label: "Amount owed", type: "text", placeholder: "$1,850" },
      { key: "days", label: "Days overdue", type: "select", options: ["15", "30", "60", "90+"] },
      { key: "rel", label: "Relationship", type: "select", options: ["Long-time client", "New client", "Repeat late payer"] },
    ],
    generate: (v) => {
      const soft = v.rel !== "Repeat late payer";
      return [
        { h: `Email 1 — the nudge (sends today)`, lines: [
          `Subject: Quick one — invoice for ${v.amount}`,
          soft
            ? `Hi ${v.client} team — hope things are good on your end. The ${v.amount} invoice is showing ${v.days} days past due, which I'm guessing just slipped through. Payment link below — takes about a minute. Thanks!`
            : `Hi ${v.client} team — following up on the ${v.amount} invoice, now ${v.days} days past due. The payment link below settles it in about a minute. Appreciate you closing this out this week.`,
          `[ Pay ${v.amount} now → ]`,
        ]},
        { h: "Email 2 — the reminder (auto-sends in 7 days if unpaid)", lines: [
          `Subject: Second notice — ${v.amount} outstanding`,
          `Hi ${v.client} team — circling back on the ${v.amount} invoice. We want to keep things easy on both sides, so if there's an issue with the invoice itself, reply here and we'll sort it. Otherwise, the link below closes it out today.`,
        ]},
        { h: "Email 3 — the firm one (auto-sends in 14 days if unpaid)", lines: [
          `Subject: Final notice before escalation — ${v.amount}`,
          `Hi ${v.client} — the ${v.amount} invoice remains unpaid after multiple notices. To avoid late fees and a pause on future work, payment is required by end of week. If payment has been sent, forward the confirmation and we'll reconcile immediately.`,
        ]},
        { h: "Escalation plan", lines: [
          soft
            ? `• ${v.rel} — the ladder stays courteous through Email 2; firmness arrives only at Email 3`
            : `• Repeat late payer — the ladder starts firmer and Email 3 recommends prepayment terms for future work`,
          "• Each email carries a one-click payment link and logs opens",
          "• If Email 3 expires: you get an escalation card with options (late fee, collections letter, write-off) — your call, one tap",
        ]},
      ];
    },
  },

  "Social Autopilot": {
    fields: [
      { key: "biz", label: "Your business", type: "text", placeholder: "Kettle & Co. — handmade candles" },
      { key: "push", label: "What should this month push?", type: "text", placeholder: "The new autumn collection" },
      { key: "vibe", label: "Brand vibe", type: "select", options: ["Cozy & warm", "Bold & punchy", "Clean & premium"] },
    ],
    generate: (v) => {
      const cap = (h: string, c: string) => `${h} — "${c}"`;
      const vibeWord = v.vibe === "Bold & punchy" ? "Loud" : v.vibe === "Clean & premium" ? "Quiet luxury" : "Warm";
      return [
        { h: "Week 1 of your 30-day calendar (sample)", lines: [
          cap("MON · Reel", `POV: ${v.push} just dropped and your whole feed can smell it. (hook: 0.8s product macro)`),
          cap("TUE · Story poll", `Two of ${v.push} head-to-head — 'which one lives on your shelf?' (engagement bait, zero production)`),
          cap("WED · Carousel", `The making of ${v.push}: 5 slides, hands + process + one imperfection kept in. People buy the maker.`),
          cap("FRI · Static", `${vibeWord} flat-lay of ${v.push} with one line of copy and nothing else. Let it breathe.`),
          cap("SUN · UGC repost", `Customer photo + your one-line reply. Cheapest trust you'll ever buy.`),
        ]},
        { h: "Strategy note (why this mix)", lines: [
          `• ${v.push} carries the month, but only 40% of posts sell — the rest build the habit of watching ${v.biz}`,
          "• Reels for reach, carousels for saves, stories for votes — each format has one job",
          "• Every tile is rendered in your locked brand kit before you see it; you approve the month in one sitting",
        ]},
        { h: "What the full run delivers", lines: ["• 30 designed posts, captioned + hashtagged", "• Scheduled across Instagram & Facebook after your approval", "• Next month's calendar auto-learns from this month's numbers"] },
      ];
    },
  },

  "Competitor Radar": {
    fields: [
      { key: "biz", label: "Your business", type: "text", placeholder: "Bluebird Café, Portland" },
      { key: "comp", label: "Competitors to watch (comma-separated)", type: "text", placeholder: "Stumptown Corner, The Daily Perk" },
      { key: "worry", label: "What keeps you up at night?", type: "select", options: ["Their pricing", "Their reviews are better", "Their new offers", "Their ads are everywhere"] },
    ],
    generate: (v) => {
      const comps = (v.comp || "your competitors").split(",").map((c) => c.trim()).filter(Boolean);
      const c1 = comps[0] || "Competitor A"; const c2 = comps[1] || comps[0] || "Competitor B";
      return [
        { h: "Monday brief — sample edition", lines: [
          `🔴 SIGNAL — ${c1} changed pricing on 3 core items this week (avg −8%). Their reviews mention 'value' 2× more than last month. This is a positioning move, not a sale.`,
          `🟡 WATCH — ${c2} started running Meta ads Tuesday (4 creatives, all video, all targeting your zip). Small budget so far — a test, not a push. We'll flag if spend jumps.`,
          `🟢 NOISE — ${c1} redesigned their logo. Customers don't care; neither should you.`,
          `📉 THEIR WEAK SPOT — ${c2}'s last 11 reviews: 5 mention slow service at peak hours. That's your opening, not theirs.`,
        ]},
        { h: "The counter-move (one, not forty)", lines: [
          v.worry === "Their pricing"
            ? `Don't match ${c1}'s cut — you lose a price war against nothing. Instead: bundle. A bundle at your current margin reads as generosity without repricing anything, and it's invisible to their comparison.`
            : v.worry === "Their reviews are better"
            ? `Their review lead is volume, not quality. Turn on review-ask automation for your happiest moments (post-purchase, post-compliment). 15 fresh reviews beats their stale 200 in local ranking recency.`
            : v.worry === "Their new offers"
            ? `Their offer is broad; go narrow. One sharply-specific offer for your best segment beats their something-for-everyone — and their unhappy 'slow at peak' reviewers are exactly who to aim it at.`
            : `Their ads buy attention; your speed can steal the conversion. Peak-hour promise ("in and out in 10") aimed at ${c2}'s slow-service complainers turns their ad spend into your foot traffic.`,
        ]},
        { h: "Every week, on autopilot", lines: [`• ${comps.length || 2} competitors watched: sites, socials, reviews, ad libraries — diffed weekly`, "• Ranked signal/watch/noise so you read one page, not forty", "• One recommended move per week. Ignore freely — it keeps coming."] },
      ];
    },
  },

  "Clip Factory": {
    fields: [
      { key: "topic", label: "What's the video about?", type: "textarea", placeholder: "Episode 42: I interviewed a burnout coach about why high performers crash…" },
      { key: "len", label: "Video length", type: "select", options: ["Under 20 min", "20–60 min", "60+ min"] },
      { key: "aud", label: "Who watches you?", type: "text", placeholder: "Ambitious 25-40yo professionals" },
    ],
    generate: (v) => {
      const t = excerpt(v.topic || "your topic", 6);
      const n = v.len === "60+ min" ? "10–12" : v.len === "20–60 min" ? "7–9" : "4–6";
      return [
        { h: `Clip sheet (${n} clips from this upload — top 5 shown)`, lines: [
          `01 · [12:40] "The thing nobody tells you about ${t}" — opens mid-sentence on the boldest claim. Retention score 87 · post FIRST`,
          `02 · [31:05] The story moment — personal, specific, slightly uncomfortable. Score 82 · post 3rd, stories reward mid-week`,
          `03 · [04:18] The contrarian take your ${v.aud || "audience"} will argue about in comments. Score 79 · comments = distribution`,
          `04 · [47:52] The practical bit — '3 things to do tonight.' Saves magnet. Score 74`,
          `05 · [22:11] The laugh — 28 seconds, no context needed. Score 71 · palate cleanser between heavy posts`,
        ]},
        { h: "Every clip arrives dressed", lines: ["• Animated captions in your style (word-by-word, keyword-highlighted)", "• Vertical reframe with faces auto-centered", "• A thumbnail per clip, in your locked brand kit", "• Hook rewritten as the first line of the caption"] },
        { h: "Posting order logic", lines: ["• Highest score ≠ always first — the sheet sequences for momentum: bold claim → argument-starter → story → utility", "• Scores are predictions, not promises: the next upload's scores learn from this one's real numbers"] },
      ];
    },
  },

  "Repurpose Engine": {
    fields: [
      { key: "idea", label: "Paste the core idea / key passage", type: "textarea", placeholder: "Most productivity advice fails because it's designed for people with no obligations…" },
      { key: "voice", label: "Voice", type: "select", options: ["Punchy", "Thoughtful", "Contrarian"] },
    ],
    generate: (v) => {
      const core = excerpt(v.idea || "your idea", 12);
      const vw = v.voice === "Punchy" ? "short. sharp. no wasted words." : v.voice === "Contrarian" ? "against the grain, receipts attached." : "measured, generous, sure of itself.";
      return [
        { h: "X thread (5 of 8 tweets)", lines: [
          `1/ ${core} — and almost everyone gets this backwards. 🧵`,
          `2/ The common advice assumes a life you don't have. That's not a small flaw. It's the whole problem.`,
          `3/ Here's what actually happens when real constraints meet ideal systems: (story beat pulled from your source)`,
          `4/ The fix isn't more discipline. It's a system that expects you to fail on Tuesdays.`,
          `5/ Steal this: (the single most practical line from your source, quoted verbatim)`,
        ]},
        { h: "Newsletter opener", lines: [`I want to tell you about the moment I stopped believing ${core.toLowerCase().replace(/\.$/, "")} — because the way it fell apart says more than the idea ever did. (continues 600–800 words, in your voice: ${vw})`] },
        { h: "LinkedIn post", lines: [`Unpopular opinion from someone who's tested it: ${core}`, `Three observations from the field → one uncomfortable conclusion → a question that makes commenters do your distribution for you.`] },
        { h: "Blog outline (SEO-shaped)", lines: ["• H1: the claim, phrased how people search it", "• H2: Why the standard advice fails (your story)", "• H2: What works instead (the framework, named)", "• H2: How to start this week (3 steps)", "• FAQ block targeting the long-tail questions"] },
        { h: "Voice gate", lines: [`Every piece above is QA'd against your trained voice profile (${v.voice.toLowerCase()}) — vocabulary, rhythm, opinions. If it doesn't sound like you, it doesn't ship.`] },
      ];
    },
  },

  "Brand Kit Lab": {
    fields: [
      { key: "name", label: "Channel / brand name", type: "text", placeholder: "The Honest Kitchen" },
      { key: "colors", label: "Your colors", type: "text", placeholder: "Forest green, cream, a hit of orange" },
      { key: "words", label: "Three words for your style", type: "text", placeholder: "Warm, handmade, confident" },
      { key: "asset", label: "What do you need?", type: "select", options: ["Thumbnail", "Banner", "Post template"] },
    ],
    generate: (v) => [
      { h: `Three ${(v.asset || "asset").toLowerCase()} directions (renders attached in a real run)`, lines: [
        `A · "The Stare" — tight face crop left third, ${v.colors || "your palette"} split background, 3-word overlay max in your display type. Highest CTR pattern for ${v.words || "your"} energy; the eyes do the clicking.`,
        `B · "The Object" — the subject isolated dead-center on cream, one accent bar. ${v.words ? v.words.split(",")[0] : "Clean"} to the point of confidence. Reads at 120px; most thumbnails don't.`,
        `C · "The Tease" — before/after diagonal split, arrow drawn slightly wrong on purpose (handmade > polished for your brand). Curiosity-gap overlay: 2 words + '…'`,
      ]},
      { h: "Why these will look like YOU", lines: [`• All three obey ${v.name || "your"} locked identity file: palette (${v.colors || "captured at setup"}), type, logo rules, face treatment`, "• Contrast + legibility tested at thumbnail size before you ever see them", "• 'Make my face bigger and the text angrier' is a valid revision. Unlimited, inside the task."] },
      { h: "You own everything", lines: ["• Source files delivered with every asset", "• The identity file is exportable — no hostage branding"] },
    ],
  },

  "Sponsor Kit": {
    fields: [
      { key: "niche", label: "Your niche", type: "text", placeholder: "Home cooking for busy parents" },
      { key: "size", label: "Audience size", type: "select", options: ["Under 10k", "10k–100k", "100k–1M", "1M+"] },
      { key: "platform", label: "Main platform", type: "select", options: ["YouTube", "Instagram", "TikTok", "Newsletter"] },
    ],
    generate: (v) => [
      { h: "Your media kit, always current", lines: [`• Live ${v.platform} stats pulled monthly — never send stale numbers again`, `• Audience story: who they are, what they buy, why they trust you on ${v.niche || "your niche"}`, "• Designed in your brand kit; versioned so you can see your own growth"] },
      { h: "This month's matched sponsors (sample archetypes)", lines: [
        `① The category-native: a ${v.niche ? v.niche.toLowerCase() : "niche"} brand already sponsoring creators in the ${v.size} band — warm, obvious, fastest yes.`,
        `② The adjacent mover: a brand one category over whose customers are your audience (found via their actual campaign activity, not guesswork).`,
        `③ The upstart with budget: recently funded, buying its first creator placements, pays above market for exactly your credibility.`,
      ]},
      { h: "Outreach draft (personalized per brand in a real run)", lines: [`Subject: Your [campaign name] campaign + my ${v.platform} audience`, `Hi [name] — I watched your recent creator campaign and there's a gap in it my audience fills: [specific overlap]. My ${v.size} ${v.platform} audience of ${v.niche ? v.niche.toLowerCase() + " loyalists" : "loyalists"} converts on exactly this. Media kit attached — the rates on p.3 hold through [date].`, "— No 'Dear Partnerships Team.' Ever."] },
    ],
  },

  "Inbox Concierge": {
    fields: [
      { key: "name", label: "Your name", type: "text", placeholder: "Jaden" },
      { key: "flavor", label: "What's your inbox like?", type: "select", options: ["Client-heavy", "Newsletter avalanche", "Internal chaos", "All of it"] },
      { key: "style", label: "Reply style", type: "select", options: ["Brief & direct", "Warm & chatty"] },
    ],
    generate: (v) => [
      { h: `Tomorrow, 6:45 AM — ${v.name || "your"} digest`, lines: [
        "NEEDS YOU (3):",
        "① Client X asked for a scope change — I drafted a yes-with-boundaries reply, needs your judgment on the price line.",
        "② Invoice approval expires 5pm — one tap.",
        "③ Your accountant's question about Q2 — only you know this one.",
        "HANDLED (34): 12 replies drafted & waiting · 9 filed to folders · 13 junk unsubscribed at the source",
      ]},
      { h: `Sample drafted reply (${(v.style || "your").toLowerCase()} — trained on your sent mail)`, lines: [
        v.style === "Warm & chatty"
          ? `"Hey! Great timing — yes to Thursday, and I'll bring the numbers we talked about. One thing to flag before then: (your point, made nicely). See you at 2!"`
          : `"Thursday works. I'll bring the Q2 numbers. One flag before then: (your point, one sentence). — ${v.name || "J"}"`,
        "Drafts never send without your tap. Ever.",
      ]},
      { h: "The structural fix", lines: [
        v.flavor === "Newsletter avalanche" ? "• Your 61 newsletter subscriptions: 8 you actually open. The other 53 get unsubscribed at the source this week — inbox shrinks structurally, not cosmetically."
        : v.flavor === "Client-heavy" ? "• Client threads get priority classification + same-day drafts; everything else waits its turn quietly."
        : v.flavor === "Internal chaos" ? "• Internal noise gets digest-batched twice daily; only decisions and deadlines surface individually."
        : "• Week 1 maps your inbox's actual anatomy; weeks 2–4 dismantle it category by category.",
        "• Every unsubscribe, filter and filing rule is logged and reversible",
      ]},
    ],
  },

  "Paperwork Agent": {
    fields: [
      { key: "type", label: "What kind of fight is this?", type: "select", options: ["Cancel a subscription", "Dispute a charge", "File an insurance claim", "Government form / appeal"] },
      { key: "co", label: "Company / agency", type: "text", placeholder: "IronWorks Gym" },
      { key: "sit", label: "The situation, briefly", type: "textarea", placeholder: "They charged me twice in June and support keeps closing my tickets…" },
    ],
    generate: (v) => {
      const isDispute = v.type === "Dispute a charge";
      const isCancel = v.type === "Cancel a subscription";
      const isClaim = v.type === "File an insurance claim";
      return [
        { h: "The channel that actually works", lines: [
          isCancel ? `• ${v.co || "This company"}-type cancellations die in the app on purpose. The channel that works: written notice citing the auto-renewal clause, sent where they're legally required to log it. That's where we file.`
          : isDispute ? `• Support tickets are designed to exhaust you. We skip them: a formal billing dispute citing the card network's rules goes to their billing compliance address — the inbox that can't ignore you — with your card issuer CC'd on day 7 if silent.`
          : isClaim ? `• Claims fail on missing magic words, not missing facts. We file on the correct form, citing your policy's actual coverage language, with the evidence packet they can't 'lose.'`
          : `• The form references three other forms on purpose. We resolve the chain, complete the right one, and file through the channel with a mandated response clock.`,
        ]},
        { h: "Drafted filing (ready for your approval)", lines: [
          `Re: ${v.type} — ${v.co || "[Company]"}`,
          `"I am writing regarding ${excerpt(v.sit || "the matter described", 14)} ${isDispute ? "Under the card network's dispute rules and applicable consumer-billing law, I am formally disputing this charge and requesting written resolution within 30 days." : isCancel ? "Per the terms of the agreement and applicable auto-renewal law, this letter constitutes formal notice of cancellation, effective immediately. Please confirm in writing within 10 business days." : isClaim ? "Per the coverage terms of my policy, I am filing this claim with supporting documentation enclosed, and request a written determination within the period specified by my policy." : "I request review of this matter per the applicable procedure, and a written response within the mandated period."}"`,
          "Timestamped, copied, and retained — a paper trail built like we might need it.",
        ]},
        { h: "What happens next (without you)", lines: ["• Filed on your approval; their response clock starts", "• Silence past their stated window → automatic escalation (supervisor, regulator, or card issuer as appropriate)", "• The task closes when the matter closes — not when the letter sends"] },
      ];
    },
  },

  "Career Engine": {
    fields: [
      { key: "posting", label: "Paste the job posting (or its key lines)", type: "textarea", placeholder: "Seeking a Senior Operations Manager to lead cross-functional teams, own vendor relationships, drive process improvement…" },
      { key: "role", label: "Your current title", type: "text", placeholder: "Operations Lead" },
      { key: "win", label: "Your best real win (one line)", type: "text", placeholder: "Cut fulfillment costs 23% while doubling order volume" },
    ],
    generate: (v) => {
      const words = Array.from(new Set((v.posting || "").toLowerCase().match(/[a-z][a-z-]{5,}/g) || []))
        .filter((w) => !["seeking", "looking", "candidate", "ability", "years", "experience", "including", "strong", "skills"].includes(w))
        .slice(0, 8);
      return [
        { h: "What the screener's software wants", lines: [
          words.length ? `• Extracted from this posting: ${words.join(" · ")}` : "• Paste the posting text and the real keywords appear here",
          "• These exact terms get woven into your bullets — truthfully. It's your history, weaponized, never invented.",
        ]},
        { h: "Rebuilt resume bullets (sample)", lines: [
          `• ${v.win || "Your best win"} — leading with the number, because screeners and humans both stop at numbers`,
          `• Reframed from your ${v.role || "current role"}: same facts, reordered so this job's priorities appear in your first three lines, not buried on page two`,
          `• Formatting ATS-tested: no tables, no text boxes, nothing the parser silently eats`,
        ]},
        { h: "Cover letter opener (no 'I am writing to express…')", lines: [`"${v.win || "The win you're proudest of"} — I mention it first because it's the exact problem this role exists to solve. Here's how I'd do it again for you."`] },
        { h: "They will ask you", lines: ["① Walk me through the win — prepped with your real numbers and a 90-second arc", "② The gap/stretch question your resume invites — with an honest, forward-facing answer drafted", "③ 'Why us?' — answered with something true about their actual work, researched, not flattery"] },
      ];
    },
  },

  "Life Logistics": {
    fields: [
      { key: "dest", label: "Where to?", type: "text", placeholder: "Tokyo" },
      { key: "days", label: "How long?", type: "select", options: ["Weekend", "4–6 days", "1–2 weeks"] },
      { key: "party", label: "Who's going?", type: "text", placeholder: "Me, my partner, our 4-year-old" },
      { key: "vibe", label: "Trip vibe", type: "select", options: ["Slow & deep", "See everything", "Food-first", "Rest, actually"] },
    ],
    generate: (v) => {
      const d = v.dest || "your destination";
      return [
        { h: `${d} — itinerary skeleton (booking-ready in a real run)`, lines: [
          `DAY 1 · Land soft: nothing scheduled before 4pm (${v.party?.toLowerCase().includes("4") || v.party?.toLowerCase().includes("kid") ? "travel day with a kid — protect the nap, win the trip" : "jet lag is a tax; don't pay it twice"}). Evening: one great, easy dinner near the hotel, booked.`,
          v.vibe === "Food-first" ? `DAY 2 · The market morning + the lunch counter locals queue for (reservation impossible — we know the walk-in window) + reserved dinner that anchors the whole trip.`
          : v.vibe === "Rest, actually" ? `DAY 2 · One thing before noon. Then nothing, on purpose, near water or a garden. The itinerary defends your rest against your own FOMO.`
          : v.vibe === "See everything" ? `DAY 2 · The big sights, sequenced by geography + queue data so you're never crossing town twice or standing in the 90-minute line at 11am.`
          : `DAY 2 · One neighborhood, all day. The itinerary picks the one that rewards depth in ${d} and maps it café-to-café.`,
          `DAY 3+ · Built the same way: your pace (${(v.vibe || "").toLowerCase()}), your party (${v.party || "you"}), real availability, real prices.`,
        ]},
        { h: "Plan B, pre-built", lines: [`• The leg most likely to fail in ${d} (weather / strike / sold-out) already has its alternate researched — swap is one tap, not one panicked evening`] },
        { h: "After you book, the watching starts", lines: ["• Flight & hotel prices monitored: drops trigger refund/rebook claims automatically", "• Confirmations, timings and addresses live in one itinerary doc that updates itself", "• Found money and zero admin — the whole point"] },
      ];
    },
  },
};

const TIERS = [
  {
    name: "Starter",
    price: 29,
    credits: 10,
    turnaround: "48h turnaround",
    features: ["10 task credits / month", "6 everyday services (Life lane + Invoice Chaser + Brand Kit Lab)", "2 Autopilots", "Credits roll over 1 month"],
    cta: "Go choreless",
    featured: false,
  },
  {
    name: "Pro",
    price: 79,
    credits: 30,
    turnaround: "24h turnaround",
    features: ["30 task credits / month", "11 services — adds the full Creator lane + Reputation & Social Autopilots", "5 Autopilots", "1 free revision per task", "Voice & brand profile training", "Priority queue"],
    cta: "Go Pro",
    featured: true,
  },
  {
    name: "Business",
    price: 199,
    credits: 100,
    turnaround: "12h turnaround",
    features: ["100 task credits / month", "All 12 services — adds Competitor Radar market intelligence", "Unlimited Autopilots", "Human QA on request", "Dedicated success manager", "Team seats (up to 5)"],
    cta: "Scale up",
    featured: false,
  },
];

const OUTCOMES = [
  { stat: "$3,140", label: "recovered in 48h", quote: "Four overdue invoices chased with exactly the right tone per client. Two paid in two days.", who: "Meadow Co. — landscaping, Austin" },
  { stat: "+212%", label: "short-form views in 60 days", quote: "I upload one podcast. Ten scored clips come back. I haven't opened an editor since March.", who: "Dana R. — 340k subscribers" },
  { stat: "11 hrs", label: "saved per week", quote: "My inbox went from 300 unread to a 3-item morning digest. It drafts replies better than I do.", who: "M. Osei — consultant" },
  { stat: "$486", label: "in refunds it claimed for me", quote: "It found the price drops, filed the claims, and tracked them. I did literally nothing.", who: "Priya S. — Pro member" },
  { stat: "4.9★", label: "average rating maintained", quote: "Every review answered within a week, in our voice. Our reputation runs itself now.", who: "Bluebird Café — Portland" },
  { stat: "3.2x", label: "ROAS on first managed campaign", quote: "Choreless Ads built 14 creative variants, killed the losers weekly, and tripled our return.", who: "Kettle & Co. — DTC brand" },
];

const DEMO_TASKS = [
  { name: "October social calendar", service: "Social Autopilot", status: "Awaiting approval", eta: "Ready now", pct: 95 },
  { name: "Cut podcast #42 into shorts", service: "Clip Factory", status: "In QA", eta: "~2h", pct: 80 },
  { name: "Dispute duplicate gym charge", service: "Paperwork Agent", status: "Running", eta: "~6h", pct: 45 },
  { name: "Reply drafts — Tuesday inbox", service: "Inbox Concierge", status: "Delivered", eta: "Done 7:04am", pct: 100 },
  { name: "Chase invoice #1082 (Meadow Co.)", service: "Invoice Chaser", status: "Delivered", eta: "Paid ✓", pct: 100 },
];

const STATUS_STYLE: Record<string, string> = {
  "Awaiting approval": "bg-[#FF4D00] text-white",
  "In QA": "bg-[#141414] text-white",
  Running: "bg-[#E8E1D4] text-[#141414]",
  Delivered: "bg-[#0A5C36] text-white",
};

/* ============ SHARED ============ */

const serif = { fontFamily: "Georgia, 'Times New Roman', serif" };

function Wordmark({ light }: { light?: boolean }) {
  return (
    <span className={`text-xl font-bold tracking-tight ${light ? "text-[#FAF7F2]" : "text-[#141414]"}`}>
      CHORELESS<span className="text-[#FF4D00]">.</span>
    </span>
  );
}

/* ============ TASK DROP (live routing demo) ============ */

function routeTask(text: string) {
  const t = text.toLowerCase();
  if (AD_KEYWORDS.some((k) => t.includes(k)))
    return { type: "ads" as const };
  let best: { s: (typeof SERVICES)[number]; score: number } | null = null;
  for (const s of SERVICES) {
    const score = s.keywords.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best ? { type: "service" as const, service: best.s } : { type: "custom" as const };
}

function TaskDrop() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReturnType<typeof routeTask> | null>(null);

  const examples = [
    "Chase my 3 overdue invoices",
    "Turn my podcast into shorts",
    "Cancel my gym membership and dispute last charge",
    "Run ads for my candle shop",
  ];

  return (
    <div className="border-2 border-[#141414] bg-white shadow-[6px_6px_0_#141414]">
      <div className="border-b-2 border-[#141414] bg-[#141414] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#FAF7F2]">
        Task Drop — try the router live
      </div>
      <div className="p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Describe any task, e.g. "chase my overdue invoices" or "run ads for my shop"…'
          rows={2}
          className="w-full resize-none border-2 border-[#141414] bg-[#FAF7F2] p-3 text-sm outline-none placeholder:text-[#141414]/40"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setResult(routeTask(text))}
            disabled={!text.trim()}
            className="bg-[#FF4D00] px-5 py-2 text-sm font-bold text-white hover:bg-[#e04500] disabled:opacity-40"
          >
            Route it →
          </button>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => { setText(ex); setResult(routeTask(ex)); }}
              className="border border-[#141414]/30 px-2 py-1 text-xs text-[#141414]/60 hover:border-[#141414] hover:text-[#141414]"
            >
              {ex}
            </button>
          ))}
        </div>
        {result && (
          <div className="mt-3 border-2 border-dashed border-[#141414] bg-[#FAF7F2] p-3 text-sm">
            {result.type === "service" && (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0A5C36]">✓ Routed in 0.4s</p>
                <p className="mt-1">
                  <strong>{result.service.name}</strong> pipeline · quote: <strong>{result.service.credits} credit{result.service.credits > 1 ? "s" : ""}</strong> · {result.service.turnaround}
                </p>
                <p className="mt-1 text-xs text-[#141414]/60">Next: hydrate your profile → plan → execute → QA gate → your approval on anything live.</p>
              </>
            )}
            {result.type === "ads" && (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-[#FF4D00]">★ Premium route</p>
                <p className="mt-1"><strong>Choreless Ads</strong> — managed campaign studio. A strategist-grade pipeline builds, launches and optimizes your ads. From <strong>$499/mo</strong> + ad spend.</p>
              </>
            )}
            {result.type === "custom" && (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-[#1B3A6B]">◇ Custom task</p>
                <p className="mt-1">No exact pipeline match — a generalist pipeline takes it, quoted at <strong>2–4 credits</strong> after scope confirm. Popular custom tasks become our next services.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ PAGE TRANSITION ============ */

const IRIS_MS = 420;
const IRIS_EASE = "cubic-bezier(.22,1,.36,1)";

function spawnClickRing(x: number, y: number) {
  const ring = document.createElement("div");
  ring.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:14px;height:14px;margin:-7px 0 0 -7px;border:1.5px solid rgba(255,77,0,.5);border-radius:50%;pointer-events:none;z-index:9999;`;
  document.body.appendChild(ring);
  ring.animate(
    [
      { transform: "scale(.6)", opacity: 0.55 },
      { transform: "scale(3.4)", opacity: 0 },
    ],
    { duration: 420, easing: IRIS_EASE, fill: "forwards" }
  );
  // setTimeout instead of onfinish: some embedded browsers never dispatch WAAPI finish events
  setTimeout(() => ring.remove(), 480);
}

/** Soft paper-tone plate revealed behind the page while the iris opens — a quiet
 *  tonal wipe rather than a full orange flash. */
function FlashBackdrop() {
  return <div aria-hidden className="fixed inset-0 -z-10 bg-[#F1ECE2]" />;
}

/* ============ APP ============ */

type View = "home" | "services" | "ads" | "pricing" | "dashboard";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [laneFilter, setLaneFilter] = useState<"All" | Lane>("All");
  const [onboarding, setOnboarding] = useState(false);
  const [plan, setPlanRaw] = useState<Plan>("Pro");
  const [credits, setCredits] = useState<number>(PLAN_CREDITS["Pro"]);
  const setPlan = (p: Plan) => { setPlanRaw(p); setCredits(PLAN_CREDITS[p]); };
  const spend = (n: number) => setCredits((c) => Math.max(0, c - n));
  const sub = { plan, setPlan, credits, spend };

  const shellRef = useRef<HTMLDivElement>(null);
  const lastClick = useRef({ x: 0, y: 0, t: -1 });
  const firstPaint = useRef(true);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      lastClick.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, []);

  // Iris-open the new page from wherever the user clicked.
  useEffect(() => {
    if (firstPaint.current) { firstPaint.current = false; return; }
    const shell = shellRef.current;
    if (!shell || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { x, y, t } = lastClick.current;
    const fresh = performance.now() - t < 600;
    const cx = fresh ? x : window.innerWidth / 2;
    const cy = fresh ? y : window.innerHeight / 2;
    window.scrollTo(0, 0);
    const rect = shell.getBoundingClientRect();
    const r = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 24;
    shell.animate(
      [
        { clipPath: `circle(0px at ${cx - rect.left}px ${cy - rect.top}px)` },
        { clipPath: `circle(${r}px at ${cx - rect.left}px ${cy - rect.top}px)` },
      ],
      { duration: IRIS_MS, easing: IRIS_EASE }
    );
    spawnClickRing(cx, cy);
  }, [view]);

  const nav: { id: View; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "services", label: "Services" },
    { id: "ads", label: "Choreless Ads" },
    { id: "pricing", label: "Pricing" },
    { id: "dashboard", label: "Dashboard" },
  ];

  return (
    <>
    <FlashBackdrop />
    <div ref={shellRef} className="min-h-screen bg-[#FAF7F2] text-[#141414]">
      <header className="sticky top-0 z-20 border-b-2 border-[#141414] bg-[#FAF7F2]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("home")}><Wordmark /></button>
            <button
              onClick={() => setView("dashboard")}
              className="hidden border-2 border-[#141414] px-2 py-0.5 text-xs font-bold md:block"
              title="Your demo subscription — switch plans on the dashboard"
            >
              {plan} · <span className="text-[#FF4D00]">{credits} cr</span>
            </button>
          </div>
          <nav className="flex items-center gap-1">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`px-2.5 py-1.5 text-sm font-medium ${
                  n.id === "ads" && view !== "ads" ? "text-[#FF4D00]" : ""
                } ${view === n.id ? "bg-[#141414] text-[#FAF7F2]" : "hover:bg-[#E8E1D4]"}`}
              >
                {n.label}
              </button>
            ))}
            <button
              onClick={() => setOnboarding(true)}
              className="ml-3 hidden bg-[#FF4D00] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#e04500] sm:block"
            >
              Start free →
            </button>
          </nav>
        </div>
      </header>

      {view === "home" && <Home goServices={() => setView("services")} goAds={() => setView("ads")} start={() => setOnboarding(true)} />}
      {view === "services" && <Services laneFilter={laneFilter} setLaneFilter={setLaneFilter} start={() => setOnboarding(true)} sub={sub} />}
      {view === "ads" && <Ads start={() => setOnboarding(true)} />}
      {view === "pricing" && <Pricing start={() => setOnboarding(true)} />}
      {view === "dashboard" && <Dashboard sub={sub} />}

      {onboarding && <Onboarding close={() => setOnboarding(false)} finish={() => { setOnboarding(false); setView("dashboard"); }} />}

      <footer className="border-t-2 border-[#141414] bg-[#141414] text-[#FAF7F2]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark light />
          <p className="text-sm text-[#FAF7F2]/70">Work delivered, not chatted. · Every task QA'd before it reaches you.</p>
        </div>
      </footer>
    </div>
    </>
  );
}

/* ============ ONBOARDING ============ */

function Onboarding({ close, finish }: { close: () => void; finish: () => void }) {
  const [step, setStep] = useState(0);
  const [connected, setConnected] = useState<string[]>([]);
  const tools = ["Gmail / Outlook", "Instagram / Facebook", "Google Business", "QuickBooks / Stripe", "YouTube / TikTok", "Calendar"];

  const steps = ["Connect your tools", "Teach us your voice", "First task — free"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/70 p-4">
      <div className="w-full max-w-lg border-2 border-[#141414] bg-[#FAF7F2] shadow-[8px_8px_0_#FF4D00]">
        <div className="flex items-center justify-between border-b-2 border-[#141414] px-5 py-3">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="text-xs font-bold uppercase tracking-widest text-[#141414]/50">Setup · step {step + 1} of 3</span>
          </div>
          <button onClick={close} className="text-xl font-bold hover:text-[#FF4D00]">✕</button>
        </div>
        <div className="flex border-b-2 border-[#141414]">
          {steps.map((s, i) => (
            <div key={s} className={`flex-1 px-2 py-2 text-center text-xs font-bold ${i <= step ? "bg-[#141414] text-[#FAF7F2]" : "text-[#141414]/40"}`}>
              {s}
            </div>
          ))}
        </div>
        <div className="p-5">
          {step === 0 && (
            <>
              <p className="text-sm text-[#141414]/75">Choreless works inside your real accounts. Connect what you use — agents only act through scoped, revocable permissions.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {tools.map((t) => {
                  const on = connected.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => setConnected((c) => (on ? c.filter((x) => x !== t) : [...c, t]))}
                      className={`border-2 border-[#141414] px-3 py-2.5 text-sm font-medium ${on ? "bg-[#0A5C36] text-white" : "bg-white hover:bg-[#E8E1D4]"}`}
                    >
                      {on ? "✓ " : "+ "}{t}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <p className="text-sm text-[#141414]/75">Drop 3 links (your site, socials, or best work) and answer 5 quick questions. We build your brand kit and voice profile — then refine it with every task.</p>
              <div className="mt-4 space-y-2">
                {["https://your-website.com", "https://instagram.com/you", "Your best piece of writing or content"].map((p) => (
                  <input key={p} placeholder={p} className="w-full border-2 border-[#141414] bg-white p-2.5 text-sm outline-none placeholder:text-[#141414]/40" />
                ))}
              </div>
              <p className="mt-3 border-l-4 border-[#FF4D00] pl-3 text-xs italic text-[#141414]/60">
                This is the memory no chatbot has: it persists, improves, and is exportable if you ever leave.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-sm text-[#141414]/75">Your first task is on us — while we learn you, you get finished work. Pick one:</p>
              <div className="mt-4 space-y-2">
                {["Triage my inbox and draft today's replies", "Answer my 5 most recent unanswered reviews", "Turn my last video into 5 shorts"].map((t) => (
                  <button key={t} onClick={finish} className="block w-full border-2 border-[#141414] bg-white px-4 py-3 text-left text-sm font-medium hover:bg-[#E8E1D4]">
                    → {t}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="mt-6 flex justify-between">
            <button onClick={() => (step === 0 ? close() : setStep(step - 1))} className="border-2 border-[#141414] px-4 py-2 text-sm font-bold hover:bg-[#E8E1D4]">
              ← Back
            </button>
            {step < 2 && (
              <button onClick={() => setStep(step + 1)} className="bg-[#141414] px-5 py-2 text-sm font-bold text-[#FAF7F2] hover:bg-black">
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ HOME ============ */

function Home({ goServices, goAds, start }: { goServices: () => void; goAds: () => void; start: () => void }) {
  return (
    <main>
      {/* HERO */}
      <section className="border-b-2 border-[#141414]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[3fr_2fr] md:py-20">
          <div>
            <p className="mb-4 inline-block border-2 border-[#141414] px-3 py-1 text-xs font-bold uppercase tracking-widest">
              The done-for-you AI subscription
            </p>
            <h1 style={serif} className="text-5xl leading-[1.05] md:text-6xl">
              Stop prompting.
              <br />
              <span className="text-[#FF4D00]">Start receiving.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#141414]/80">
              Chatbots give you text. Choreless gives you <strong>finished work</strong> — posts published, invoices
              chased, videos clipped, paperwork filed, ad campaigns run. Drop a task, and AI agent pipelines with real
              tool access do it end-to-end. You just approve.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={start} className="bg-[#141414] px-6 py-3 font-bold text-[#FAF7F2] hover:bg-black">
                First task free →
              </button>
              <button onClick={goServices} className="border-2 border-[#141414] px-6 py-3 font-bold hover:bg-[#E8E1D4]">
                Browse the services
              </button>
            </div>
          </div>
          <div className="self-center"><TaskDrop /></div>
        </div>
      </section>

      {/* WHY NOT A CHATBOT */}
      <section className="border-b-2 border-[#141414] bg-[#141414] text-[#FAF7F2]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 style={serif} className="text-3xl md:text-4xl">Why no chat window can do this</h2>
          <div className="mt-10 grid gap-px bg-[#FAF7F2]/20 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["It remembers you", "Your brand kit, voice profile and business data persist across every task. Nothing to re-explain, ever."],
              ["It acts in your tools", "Agents post, send, schedule and file through your connected accounts — with your one-tap approval on anything live."],
              ["It runs unprompted", "Autopilots work on schedules and triggers. Reviews answered weekly, inbox triaged daily — while you sleep."],
              ["It ships QA'd work", "Every deliverable passes an automated quality gate; anything uncertain is checked by a human before you see it."],
            ].map(([title, body], i) => (
              <div key={title} className="bg-[#141414] p-6">
                <p className="text-4xl font-bold text-[#FF4D00]">{i + 1}</p>
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#FAF7F2]/70">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OUTCOMES WALL */}
      <section className="border-b-2 border-[#141414]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 style={serif} className="text-3xl md:text-4xl">Receipts, not promises.</h2>
          <p className="mt-2 text-[#141414]/70">Every number below is a delivered task.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {OUTCOMES.map((o) => (
              <figure key={o.stat + o.who} className="flex flex-col border-2 border-[#141414] bg-white p-5 shadow-[4px_4px_0_#141414]">
                <p><span style={serif} className="text-4xl text-[#FF4D00]">{o.stat}</span></p>
                <p className="text-xs font-bold uppercase tracking-widest text-[#141414]/60">{o.label}</p>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-[#141414]/85">"{o.quote}"</blockquote>
                <figcaption className="mt-3 border-t border-dashed border-[#141414]/30 pt-2 text-xs font-bold">{o.who}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b-2 border-[#141414]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 style={serif} className="text-3xl md:text-4xl">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["Drop the task", "Type it, forward an email, or send a voice note. Or switch on an Autopilot once and forget it."],
              ["Agents do the work", "A pipeline plans, executes with real tools, and self-checks — then passes a quality gate."],
              ["Approve & it ships", "Finished work lands in your dashboard and your tools. Anything irreversible waits for your tap."],
            ].map(([t, b], i) => (
              <div key={t} className="border-2 border-[#141414] bg-white p-6 shadow-[4px_4px_0_#141414]">
                <p className="text-xs font-bold uppercase tracking-widest text-[#FF4D00]">Step {i + 1}</p>
                <h3 style={serif} className="mt-2 text-xl">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#141414]/75">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ADS BANNER */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-0 border-2 border-[#141414] md:grid-cols-[2fr_1fr]">
            <div className="bg-[#141414] p-8 text-[#FAF7F2]">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FF4D00]">Premium · Choreless Ads</p>
              <h2 style={serif} className="mt-2 text-3xl">We don't just make your ads.<br />We run them.</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#FAF7F2]/75">
                Full campaign studio: strategy, dozens of creative variants, launch on Meta / Google / TikTok, and
                weekly kill-the-losers optimization. Managed like an agency, priced like software.
              </p>
            </div>
            <button onClick={goAds} className="flex items-center justify-center bg-[#FF4D00] p-8 text-xl font-bold text-white hover:bg-[#e04500]">
              See Choreless Ads →
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ============ SERVICES ============ */

type Sub = { plan: Plan; setPlan: (p: Plan) => void; credits: number; spend: (n: number) => void };

function Services({
  laneFilter,
  setLaneFilter,
  start,
  sub,
}: {
  laneFilter: "All" | Lane;
  setLaneFilter: (l: "All" | Lane) => void;
  start: () => void;
  sub: Sub;
}) {
  const filtered = laneFilter === "All" ? SERVICES : SERVICES.filter((s) => s.lane === laneFilter);
  const [open, setOpen] = useState<(typeof SERVICES)[number] | null>(null);
  const [running, setRunning] = useState<(typeof SERVICES)[number] | null>(null);
  return (
    <main className="mx-auto max-w-6xl px-5 py-14">
      <h1 style={serif} className="text-4xl md:text-5xl">The service catalog</h1>
      <p className="mt-3 max-w-2xl text-[#141414]/75">
        Every service is a full pipeline — research, production, quality gate, delivery. Priced in credits from your monthly plan. <strong>Click any card to open its dossier.</strong>
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        {(["All", "Business", "Creator", "Life"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLaneFilter(l)}
            className={`border-2 border-[#141414] px-4 py-1.5 text-sm font-bold ${
              laneFilter === l ? "bg-[#141414] text-[#FAF7F2]" : "bg-white hover:bg-[#E8E1D4]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {filtered.map((s) => (
          <article
            key={s.name}
            onClick={() => setOpen(s)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setOpen(s)}
            className="group flex cursor-pointer flex-col border-2 border-[#141414] bg-white shadow-[4px_4px_0_#141414] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#FF4D00]"
          >
            <div className="flex items-center justify-between border-b-2 border-[#141414] px-4 py-2">
              <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${LANE_COLOR[s.lane]}`}>{s.lane}</span>
              <span className="flex items-center gap-2">
                {s.autopilot && <span className="text-xs font-bold uppercase tracking-widest text-[#FF4D00]">⚡ Autopilot</span>}
                {unlocked(s.name, sub.plan) ? (
                  <span className="bg-[#0A5C36] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">In your plan</span>
                ) : (
                  <span className="bg-[#E8E1D4] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#141414]/70">🔒 {MIN_TIER[s.name]}</span>
                )}
              </span>
            </div>
            <div className="flex-1 px-4 py-4">
              <h2 style={serif} className="text-2xl">{s.name}</h2>
              <p className="mt-1 font-medium text-[#FF4D00]">{s.tagline}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#141414]/80">{s.deliverable}</p>
              <p className="mt-3 border-l-4 border-[#E8E1D4] pl-3 text-xs italic text-[#141414]/60">Why now: {s.whyNow}</p>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-[#141414]/40 px-4 py-2.5 text-xs font-bold">
              <span>{s.credits} credit{s.credits > 1 ? "s" : ""}{s.autopilot ? " / run" : ""}</span>
              <span className="text-[#FF4D00] opacity-0 transition-opacity group-hover:opacity-100">Open the dossier →</span>
              <span className="text-[#141414]/60 group-hover:hidden">{s.turnaround}</span>
            </div>
          </article>
        ))}
      </div>

      {open && (
        <ServiceDossier
          s={open}
          close={() => setOpen(null)}
          start={start}
          sub={sub}
          run={() => { const s = open; setOpen(null); setRunning(s); }}
        />
      )}
      {running && <ServiceRunner s={running} close={() => setRunning(null)} sub={sub} />}
      <div className="mt-12 border-2 border-[#141414] bg-[#141414] p-8 text-center text-[#FAF7F2]">
        <p style={serif} className="text-2xl">Don't see your task? Drop it anyway.</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[#FAF7F2]/70">
          The Task Drop routes anything you describe to the closest pipeline — and the tasks we can't do yet become the services we build next.
        </p>
        <button onClick={start} className="mt-5 bg-[#FF4D00] px-6 py-3 font-bold text-white hover:bg-[#e04500]">
          First task free →
        </button>
      </div>
    </main>
  );
}

/* ============ SERVICE DOSSIER MODAL ============ */

function ServiceDossier({
  s, close, start, sub, run,
}: {
  s: (typeof SERVICES)[number]; close: () => void; start: () => void; sub?: Sub; run?: () => void;
}) {
  const d = DEEP[s.name];
  const isUnlocked = sub ? unlocked(s.name, sub.plan) : true;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#141414]/70 p-4 py-8" onClick={close}>
      <div
        className="w-full max-w-2xl border-2 border-[#141414] bg-[#FAF7F2] shadow-[8px_8px_0_#FF4D00]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className={`flex items-center justify-between border-b-2 border-[#141414] px-5 py-3 ${LANE_COLOR[s.lane]}`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">
              Dossier · {s.lane} lane {s.autopilot ? "· ⚡ Autopilot" : ""}
            </p>
            <h2 style={serif} className="text-2xl">{s.name}</h2>
          </div>
          <button onClick={close} className="text-2xl font-bold hover:opacity-60" aria-label="Close">✕</button>
        </div>

        {d && (
          <div className="p-5">
            {/* the scene */}
            <p className="text-xs font-bold uppercase tracking-widest text-[#FF4D00]">The scene</p>
            <p style={serif} className="mt-2 text-lg leading-relaxed">{d.scene}</p>

            {/* behind the curtain */}
            <p className="mt-6 text-xs font-bold uppercase tracking-widest text-[#FF4D00]">Behind the curtain</p>
            <div className="mt-2 space-y-0 border-2 border-[#141414] bg-white">
              {d.steps.map(([t, b], i) => (
                <div key={t} className={`flex gap-4 px-4 py-3 ${i > 0 ? "border-t border-dashed border-[#141414]/30" : ""}`}>
                  <span style={serif} className="text-2xl text-[#141414]/25">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-bold">{t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-[#141414]/75">{b}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* what lands */}
            <p className="mt-6 text-xs font-bold uppercase tracking-widest text-[#FF4D00]">What lands in your hands</p>
            <ul className="mt-2 space-y-1.5">
              {d.lands.map((l) => (
                <li key={l} className="flex gap-2 text-sm">
                  <span className="font-bold text-[#0A5C36]">✓</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>

            {/* fine print + spec strip */}
            <p className="mt-5 border-l-4 border-[#E8E1D4] pl-3 text-xs italic text-[#141414]/60">{d.finePrint}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#141414] pt-4">
              <div className="text-sm font-bold">
                {s.credits} credit{s.credits > 1 ? "s" : ""}{s.autopilot ? " / run" : ""} · {s.turnaround} ·{" "}
                <span className="text-[#0A5C36]">QA gate included</span>
              </div>
              {run && sub ? (
                isUnlocked ? (
                  <button
                    onClick={run}
                    className="bg-[#FF4D00] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e04500]"
                  >
                    ▶ Run this service now ({s.credits} cr)
                  </button>
                ) : (
                  <button
                    onClick={() => { sub.setPlan(MIN_TIER[s.name]); }}
                    className="bg-[#141414] px-5 py-2.5 text-sm font-bold text-[#FAF7F2] hover:bg-black"
                  >
                    🔒 Unlock with {MIN_TIER[s.name]} — switch plan (demo)
                  </button>
                )
              ) : (
                <button
                  onClick={() => { close(); start(); }}
                  className="bg-[#FF4D00] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e04500]"
                >
                  Try it — first task free →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ SERVICE RUNNER (the functioner) ============ */

function ServiceRunner({ s, close, sub }: { s: (typeof SERVICES)[number]; close: () => void; sub: Sub }) {
  const rt = RUNTIME[s.name];
  const d = DEEP[s.name];
  const [phase, setPhase] = useState<"intake" | "running" | "done">("intake");
  const [values, setValues] = useState<Record<string, string>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const spent = useRef(false);

  const runSteps: string[] = [...(d?.steps.map(([t]) => t) ?? []), "Quality gate"];
  const canRun = rt.fields.every((f) => (values[f.key] || "").trim().length > 0);
  const enough = sub.credits >= s.credits;

  useEffect(() => {
    if (phase !== "running") return;
    if (stepIdx >= runSteps.length) {
      if (!spent.current) { spent.current = true; sub.spend(s.credits); }
      setPhase("done");
      return;
    }
    const t = setTimeout(() => setStepIdx((i) => i + 1), 800);
    return () => clearTimeout(t);
  }, [phase, stepIdx]);

  const blocks = phase === "done" ? rt.generate(values) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#141414]/70 p-4 py-8" onClick={close}>
      <div className="w-full max-w-2xl border-2 border-[#141414] bg-[#FAF7F2] shadow-[8px_8px_0_#0A5C36]" onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between border-b-2 border-[#141414] px-5 py-3 ${LANE_COLOR[s.lane]}`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">
              {phase === "intake" ? "New task" : phase === "running" ? "Pipeline running" : "Deliverable · QA passed"}
            </p>
            <h2 style={serif} className="text-2xl">{s.name}</h2>
          </div>
          <button onClick={close} className="text-2xl font-bold hover:opacity-60" aria-label="Close">✕</button>
        </div>

        {/* INTAKE */}
        {phase === "intake" && (
          <div className="p-5">
            <p className="text-sm text-[#141414]/70">
              Structured intake, not a blank prompt box — the pipeline asks only what it can't learn from your profile.
            </p>
            <div className="mt-4 space-y-4">
              {rt.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="text-xs font-bold uppercase tracking-widest">{f.label}</span>
                  {f.type === "select" ? (
                    <select
                      value={values[f.key] || ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="mt-1 w-full border-2 border-[#141414] bg-white p-2.5 text-sm outline-none"
                    >
                      <option value="" disabled>Choose…</option>
                      {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={values[f.key] || ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="mt-1 w-full resize-none border-2 border-[#141414] bg-white p-2.5 text-sm outline-none placeholder:text-[#141414]/35"
                    />
                  ) : (
                    <input
                      value={values[f.key] || ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="mt-1 w-full border-2 border-[#141414] bg-white p-2.5 text-sm outline-none placeholder:text-[#141414]/35"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#141414] pt-4">
              <span className="text-sm font-bold">
                Cost: {s.credits} credit{s.credits > 1 ? "s" : ""} · you have <span className={enough ? "text-[#0A5C36]" : "text-[#FF4D00]"}>{sub.credits}</span>
              </span>
              {enough ? (
                <button
                  onClick={() => { setStepIdx(0); setPhase("running"); }}
                  disabled={!canRun}
                  className="bg-[#0A5C36] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
                >
                  {canRun ? "▶ Deploy the pipeline" : "Fill every field to deploy"}
                </button>
              ) : (
                <button onClick={() => sub.setPlan("Business")} className="bg-[#141414] px-5 py-2.5 text-sm font-bold text-[#FAF7F2]">
                  Out of credits — upgrade (demo)
                </button>
              )}
            </div>
          </div>
        )}

        {/* RUNNING */}
        {phase === "running" && (
          <div className="p-5">
            <div className="border-2 border-[#141414] bg-[#141414] p-4 font-mono text-sm text-[#FAF7F2]">
              {runSteps.map((t, i) => (
                <p key={t} className={i > stepIdx ? "opacity-25" : ""}>
                  {i < stepIdx ? <span className="text-[#7ee2a8]">✓</span> : i === stepIdx ? <span className="animate-pulse text-[#FF4D00]">▸</span> : "·"}{" "}
                  {t}
                  {i === stepIdx && <span className="animate-pulse">…</span>}
                </p>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#141414]/60">
              In production this runs asynchronously — you'd close this window and the deliverable would arrive in your dashboard within the SLA. The demo compresses {s.turnaround.toLowerCase()} into seconds.
            </p>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="bg-[#0A5C36] px-2 py-1 text-xs font-bold uppercase tracking-widest text-white">✓ QA gate passed</span>
              <span className="text-xs font-bold text-[#141414]/60">{s.credits} credit{s.credits > 1 ? "s" : ""} debited · {sub.credits} left</span>
            </div>
            <div className="mt-4 space-y-4">
              {blocks.map((b) => (
                <div key={b.h} className="border-2 border-[#141414] bg-white">
                  <div className="border-b border-dashed border-[#141414]/40 px-4 py-2 text-xs font-bold uppercase tracking-widest">{b.h}</div>
                  <div className="space-y-2 px-4 py-3">
                    {b.lines.map((l, i) => (
                      <p key={i} className={`text-sm leading-relaxed ${l.startsWith("•") || /^[①②③🔴🟡🟢📉0-9]/.test(l) ? "text-[#141414]/85" : "text-[#141414]"}`}>{l}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#141414] pt-4">
              <p className="text-xs text-[#141414]/60">Miss the brief? The revision is free and the credit comes back.</p>
              <div className="flex gap-2">
                <button onClick={() => { setPhase("intake"); spent.current = false; }} className="border-2 border-[#141414] px-4 py-2 text-sm font-bold hover:bg-[#E8E1D4]">
                  Run again
                </button>
                <button onClick={close} className="bg-[#0A5C36] px-5 py-2 text-sm font-bold text-white hover:opacity-90">
                  ✓ Approve & deliver
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ CHORELESS ADS (premium) ============ */

function Ads({ start }: { start: () => void }) {
  const ADS_TIERS = [
    { name: "Launch", price: 499, spend: "up to $5k/mo ad spend", features: ["1 managed campaign", "14+ creative variants at launch", "Meta or Google", "Weekly optimization pass", "Monthly performance report"] },
    { name: "Growth", price: 1249, spend: "up to $25k/mo ad spend", featured: true, features: ["3 concurrent campaigns", "30+ variants, refreshed monthly", "Meta + Google + TikTok", "Twice-weekly optimization", "Landing page variants included", "Human strategist review"] },
    { name: "Scale", price: 2999, spend: "$25k+/mo ad spend", features: ["Unlimited campaigns", "Full-funnel creative system", "All channels + retargeting", "Daily optimization", "Dedicated strategist", "Custom attribution dashboard"] },
  ];
  return (
    <main className="mx-auto max-w-6xl px-5 py-14">
      <p className="inline-block bg-[#FF4D00] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">Premium studio</p>
      <h1 style={serif} className="mt-3 text-4xl md:text-5xl">Choreless Ads</h1>
      <p className="mt-3 max-w-2xl text-lg text-[#141414]/80">
        Agencies charge $5–15k/mo and take weeks per creative round. Our ad pipelines produce <strong>dozens of
        variants in days</strong>, launch them, and ruthlessly reallocate budget to winners every week — with a human
        strategist signing off on every campaign.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-4">
        {[
          ["01", "Strategy sprint", "Market + competitor ad research, angle map, budget plan. Delivered in 48h."],
          ["02", "Creative factory", "Statics, videos, hooks and copy in your brand kit — 14+ variants per campaign."],
          ["03", "Launch", "Pixel + audiences configured, campaigns live on Meta / Google / TikTok after your approval."],
          ["04", "Kill the losers", "Weekly optimization: losers paused, winners scaled, new variants injected. Reported in plain English."],
        ].map(([n, t, b]) => (
          <div key={n} className="border-2 border-[#141414] bg-white p-5 shadow-[4px_4px_0_#141414]">
            <p className="text-3xl font-bold text-[#FF4D00]">{n}</p>
            <h3 style={serif} className="mt-2 text-lg">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#141414]/75">{b}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {ADS_TIERS.map((t) => (
          <div key={t.name} className={`border-2 border-[#141414] ${t.featured ? "bg-[#141414] text-[#FAF7F2] shadow-[6px_6px_0_#FF4D00]" : "bg-white shadow-[4px_4px_0_#141414]"}`}>
            <div className="px-6 py-6">
              {t.featured && <p className="mb-2 inline-block bg-[#FF4D00] px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-white">Most popular</p>}
              <h2 style={serif} className="text-2xl">{t.name}</h2>
              <p className="mt-3"><span style={serif} className="text-5xl">${t.price.toLocaleString()}</span><span className={t.featured ? "text-[#FAF7F2]/60" : "text-[#141414]/60"}>/mo</span></p>
              <p className={`mt-1 text-sm font-bold ${t.featured ? "text-[#FF4D00]" : "text-[#0A5C36]"}`}>{t.spend}</p>
              <ul className={`mt-5 space-y-2 text-sm ${t.featured ? "text-[#FAF7F2]/85" : "text-[#141414]/85"}`}>
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="font-bold text-[#FF4D00]">✓</span>{f}</li>
                ))}
              </ul>
              <button onClick={start} className={`mt-6 w-full px-4 py-3 font-bold ${t.featured ? "bg-[#FF4D00] text-white hover:bg-[#e04500]" : "bg-[#141414] text-[#FAF7F2] hover:bg-black"}`}>
                Book strategy sprint →
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 border-l-4 border-[#FF4D00] pl-4 text-sm text-[#141414]/70">
        Ad spend is billed directly to your ad accounts — we never touch your budget. Every campaign launch requires
        your approval, and every Choreless Ads plan includes human strategist review (the one place we put people in the
        happy path on purpose).
      </p>
    </main>
  );
}

/* ============ PRICING ============ */

function Pricing({ start }: { start: () => void }) {
  const [tasks, setTasks] = useState(12);
  const [rate, setRate] = useState(60);
  const hoursSaved = useMemo(() => Math.round(tasks * 1.9), [tasks]);
  const moneySaved = useMemo(() => hoursSaved * rate, [hoursSaved, rate]);
  const bestTier = tasks <= 8 ? TIERS[0] : tasks <= 25 ? TIERS[1] : TIERS[2];

  return (
    <main className="mx-auto max-w-6xl px-5 py-14">
      <h1 style={serif} className="text-4xl md:text-5xl">Simple plans. Real work.</h1>
      <p className="mt-3 max-w-2xl text-[#141414]/75">
        Credits are the unit of finished work — a chased invoice, a clipped video, a filed dispute. Unused credits roll
        over one month. Every task includes the quality gate.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <div key={t.name} className={`border-2 border-[#141414] ${t.featured ? "bg-[#141414] text-[#FAF7F2] shadow-[6px_6px_0_#FF4D00]" : "bg-white shadow-[4px_4px_0_#141414]"}`}>
            <div className="px-6 py-6">
              {t.featured && <p className="mb-2 inline-block bg-[#FF4D00] px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-white">Most popular</p>}
              <h2 style={serif} className="text-2xl">{t.name}</h2>
              <p className="mt-3"><span style={serif} className="text-5xl">${t.price}</span><span className={t.featured ? "text-[#FAF7F2]/60" : "text-[#141414]/60"}>/mo</span></p>
              <p className={`mt-1 text-sm font-bold ${t.featured ? "text-[#FF4D00]" : "text-[#0A5C36]"}`}>{t.turnaround}</p>
              <ul className={`mt-5 space-y-2 text-sm ${t.featured ? "text-[#FAF7F2]/85" : "text-[#141414]/85"}`}>
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="font-bold text-[#FF4D00]">✓</span>{f}</li>
                ))}
              </ul>
              <button onClick={start} className={`mt-6 w-full px-4 py-3 font-bold ${t.featured ? "bg-[#FF4D00] text-white hover:bg-[#e04500]" : "bg-[#141414] text-[#FAF7F2] hover:bg-black"}`}>
                {t.cta} →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ROI CALCULATOR */}
      <div className="mt-12 border-2 border-[#141414] bg-white shadow-[6px_6px_0_#141414]">
        <div className="border-b-2 border-[#141414] bg-[#141414] px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-[#FAF7F2]">
          What's your time worth? — ROI calculator
        </div>
        <div className="grid gap-8 p-6 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm font-bold">
                <span>Tasks you'd offload per month</span><span className="text-[#FF4D00]">{tasks}</span>
              </div>
              <input type="range" min={2} max={40} value={tasks} onChange={(e) => setTasks(+e.target.value)} className="mt-2 w-full accent-[#FF4D00]" />
            </div>
            <div>
              <div className="flex justify-between text-sm font-bold">
                <span>What your hour is worth</span><span className="text-[#FF4D00]">${rate}/hr</span>
              </div>
              <input type="range" min={20} max={250} step={5} value={rate} onChange={(e) => setRate(+e.target.value)} className="mt-2 w-full accent-[#FF4D00]" />
            </div>
            <p className="text-xs text-[#141414]/55">Assumes ~1.9 hours saved per task (median across delivered tasks: research, production, follow-up).</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border-2 border-[#141414] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#141414]/60">Hours back / month</p>
              <p style={serif} className="mt-1 text-4xl">{hoursSaved}</p>
            </div>
            <div className="border-2 border-[#141414] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#141414]/60">Value of that time</p>
              <p style={serif} className="mt-1 text-4xl text-[#0A5C36]">${moneySaved.toLocaleString()}</p>
            </div>
            <div className="col-span-2 border-2 border-[#FF4D00] bg-[#FAF7F2] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FF4D00]">Your fit: {bestTier.name} — ${bestTier.price}/mo</p>
              <p style={serif} className="mt-1 text-2xl">
                {Math.round(moneySaved / bestTier.price)}x return on the subscription
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {[
          ["The quality promise", "Work that fails our quality gate never reaches you. If a deliverable misses the brief, the revision is free and the credit is returned."],
          ["You hold the keys", "Anything irreversible — posting, sending, filing — waits for your one-tap approval until you grant a pipeline trusted status."],
          ["Cancel anytime", "Your deliverables, brand kit and voice profile are exportable. No lock-in, no hostage data."],
        ].map(([t, b]) => (
          <div key={t} className="border-2 border-[#141414] bg-white p-5">
            <h3 className="font-bold">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#141414]/75">{b}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

/* ============ DASHBOARD ============ */

function Dashboard({ sub }: { sub: Sub }) {
  const [autopilots, setAutopilots] = useState<Record<string, boolean>>({
    "Inbox Concierge": true,
    "Reputation Autopilot": true,
    "Social Autopilot": false,
    "Competitor Radar": false,
  });
  const [running, setRunning] = useState<(typeof SERVICES)[number] | null>(null);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#FF4D00]">Dashboard · Demo</p>
          <h1 style={serif} className="text-3xl md:text-4xl">Morning, Jaden.</h1>
          <p className="mt-1 text-sm text-[#141414]/70">2 deliverables shipped overnight. 1 approval waiting for you.</p>
        </div>
        <div className="border-2 border-[#141414] bg-white p-1">
          <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Your plan (switch to test gating)</p>
          <div className="flex gap-1 p-1">
            {(["Starter", "Pro", "Business"] as Plan[]).map((p) => (
              <button
                key={p}
                onClick={() => sub.setPlan(p)}
                className={`px-3 py-1.5 text-xs font-bold ${sub.plan === p ? "bg-[#141414] text-[#FAF7F2]" : "hover:bg-[#E8E1D4]"}`}
              >
                {p} · ${TIERS.find((t) => t.name === p)!.price}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6"><TaskDrop /></div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Credits left", `${sub.credits} / ${PLAN_CREDITS[sub.plan]}`, `${sub.plan} plan · resets monthly`],
          ["Services unlocked", `${SERVICES.filter((s) => unlocked(s.name, sub.plan)).length} / 12`, sub.plan === "Business" ? "Everything, including Competitor Radar" : sub.plan === "Pro" ? "Add Competitor Radar with Business" : "Add Creator lane + Autopilots with Pro"],
          ["Hours saved (est.)", "26.5", "vs. doing it yourself"],
        ].map(([label, big, note]) => (
          <div key={label} className="border-2 border-[#141414] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#141414]/60">{label}</p>
            <p style={serif} className="mt-1 text-4xl">{big}</p>
            <p className="mt-1 text-xs text-[#141414]/60">{note}</p>
          </div>
        ))}
      </div>

      {/* RUN A SERVICE */}
      <section className="mt-8 border-2 border-[#141414] bg-white">
        <div className="flex flex-wrap items-center justify-between border-b-2 border-[#141414] px-4 py-2.5">
          <span className="text-sm font-bold uppercase tracking-widest">Run a service</span>
          <span className="text-xs text-[#141414]/60">Live functioners — fill the intake, watch the pipeline, get the deliverable</span>
        </div>
        <div className="grid gap-px bg-[#141414]/10 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => {
            const ok = unlocked(s.name, sub.plan);
            const afford = sub.credits >= s.credits;
            return (
              <button
                key={s.name}
                onClick={() => ok && setRunning(s)}
                disabled={!ok}
                className={`flex items-center justify-between gap-2 bg-white px-4 py-3 text-left ${ok ? "hover:bg-[#E8E1D4]" : "cursor-not-allowed opacity-50"}`}
              >
                <span>
                  <span className="block text-sm font-bold">{ok ? "▶ " : "🔒 "}{s.name}</span>
                  <span className="block text-xs text-[#141414]/60">
                    {ok ? `${s.credits} cr · ${s.turnaround}${!afford ? " · not enough credits" : ""}` : `Requires ${MIN_TIER[s.name]} plan`}
                  </span>
                </span>
                <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${LANE_COLOR[s.lane]}`}>{s.lane[0]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {running && <ServiceRunner s={running} close={() => setRunning(null)} sub={sub} />}

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="border-2 border-[#141414] bg-white">
          <div className="border-b-2 border-[#141414] px-4 py-2.5 text-sm font-bold uppercase tracking-widest">
            Active & recent tasks
          </div>
          <ul className="divide-y divide-[#141414]/15">
            {DEMO_TASKS.map((t) => (
              <li key={t.name} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{t.name}</p>
                    <p className="text-xs text-[#141414]/60">{t.service} · {t.eta}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-[#E8E1D4]">
                  <div className={`h-1.5 ${t.pct === 100 ? "bg-[#0A5C36]" : "bg-[#FF4D00]"}`} style={{ width: `${t.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="border-2 border-[#FF4D00] bg-white shadow-[4px_4px_0_#FF4D00]">
            <div className="border-b-2 border-[#FF4D00] bg-[#FF4D00] px-4 py-2 text-sm font-bold uppercase tracking-widest text-white">
              Needs your approval
            </div>
            <div className="p-4 text-sm">
              <p className="font-bold">Publish October social calendar</p>
              <p className="mt-1 text-[#141414]/70">
                31 designed posts, scheduled Mon/Wed/Fri across Instagram & Facebook. QA passed · brand-kit matched.
              </p>
              <div className="mt-3 flex gap-2">
                <button className="bg-[#0A5C36] px-4 py-2 text-xs font-bold text-white hover:opacity-90">Approve & schedule</button>
                <button className="border-2 border-[#141414] px-4 py-2 text-xs font-bold hover:bg-[#E8E1D4]">Review posts</button>
              </div>
            </div>
          </section>

          <section className="border-2 border-[#141414] bg-white">
            <div className="border-b-2 border-[#141414] px-4 py-2.5 text-sm font-bold uppercase tracking-widest">
              Autopilots
            </div>
            <ul className="divide-y divide-[#141414]/15 text-sm">
              {Object.entries(autopilots).map(([name, on]) => (
                <li key={name} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium">{name}</span>
                  <button
                    onClick={() => setAutopilots((a) => ({ ...a, [name]: !a[name] }))}
                    className={`h-6 w-11 border-2 border-[#141414] p-0.5 transition-colors ${on ? "bg-[#0A5C36]" : "bg-[#E8E1D4]"}`}
                    aria-label={`Toggle ${name}`}
                  >
                    <span className={`block h-3.5 w-3.5 bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
