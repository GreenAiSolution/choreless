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
    name: "Refund & Comp Recovery",
    lane: "Life",
    tagline: "We get your money back — automatically.",
    deliverable: "Purchases, flights, deliveries and outages watched non-stop; price-adjustment claims, delay compensation, outage credits and wrong-charge disputes filed for you. You spend credits only when it actually recovers money.",
    whyNow: "Every company owes refunds they bank on you never claiming.",
    credits: 2,
    turnaround: "Runs continuously",
    autopilot: true,
    keywords: ["refund", "price drop", "money back", "compensation", "delay", "outage", "chargeback", "reimburse", "credit", "claim"],
  },
  {
    name: "Digital Footprint Cleaner",
    lane: "Life",
    tagline: "Disappear from the databases.",
    deliverable: "Removed from data-broker sites, deletion requests filed, zombie accounts closed, mass-unsubscribes done — then monitored monthly so you don't quietly get re-listed.",
    whyNow: "Your personal data is bought and sold daily, and almost no one cleans it up.",
    credits: 6,
    turnaround: "Sweep in 72h, then monthly",
    autopilot: true,
    keywords: ["data broker", "delete", "privacy", "remove me", "unsubscribe", "footprint", "disappear", "opt out", "personal information", "spam"],
  },
  {
    name: "Hard Conversation Ghostwriter",
    lane: "Life",
    tagline: "The email you're dreading — written for you.",
    deliverable: "The message you can't bring yourself to write — firing a client, chasing money owed, a complaint, a raise request, a vendor breakup — written in exactly the right tone, with the follow-up ready if they push back.",
    whyNow: "The messages that cost you sleep are the ones most worth outsourcing.",
    credits: 2,
    turnaround: "6h",
    keywords: ["email", "write", "dreading", "hard", "fire", "raise", "complaint", "conversation", "message", "quit", "breakup", "confront", "apology", "text", "awkward"],
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
  "Refund & Comp Recovery": {
    scene: "You paid $340 for the flight. It dropped to $280 the next morning, and the airline is delighted you'll never notice. The delivery came four days late — that's a refund you're owed and will never claim. The internet was down six hours — that's a bill credit sitting there unasked. This service's whole job is to notice, and to ask, so a slow trickle of your own money finds its way back without you lifting a finger.",
    steps: [
      ["Watch the receipts", "Purchases, flights, packages and services are monitored against prices, delivery promises and uptime — the moment one slips, it's flagged as recoverable money."],
      ["Know the rule", "Airlines owe delay comp under specific rules; retailers honor price-adjustment windows; ISPs credit outages. Each claim is filed citing the exact policy that forces a yes."],
      ["File on your say-so", "Anything account-touching comes back for one-tap approval; the claim goes to the channel that actually pays, with the paper trail retained."],
      ["Bank it", "A running ledger of what's been recovered this month — real dollars back, and credits spent only on the wins."],
    ],
    lands: ["Price-drop, delay, outage and wrong-charge claims filed for you", "One-tap approval on anything account-touching", "A monthly ledger of money actually recovered"],
    finePrint: "Results-priced: credits are spent only when a claim actually recovers money. Needs read access to the receipts/accounts you want watched.",
  },
  "Digital Footprint Cleaner": {
    scene: "Type your own name into Google with a private window open. The home address. The old phone number. The relatives listed like a family tree you didn't publish. Data brokers assembled that for anyone with $2 and a grudge — and they'll rebuild it the week after you remove it, which is why this isn't a one-time scrub but a standing watch that makes you quietly, durably harder to find.",
    steps: [
      ["Map your exposure", "A sweep across the major data-broker networks, people-search sites and breach databases surfaces everywhere you're listed — with links."],
      ["File the removals", "Opt-out and deletion requests submitted to each, using the specific legal request each one is required to honor — not the polite form they hope you'll use."],
      ["Close the zombies", "Dormant accounts you forgot, newsletters you never read, logins tied to old breaches — closed and unsubscribed at the source."],
      ["Keep watch", "Brokers re-list you constantly. Monthly re-scans catch it and re-file, so the cleanup holds instead of quietly undoing itself."],
    ],
    lands: ["Removal from the major data-broker and people-search sites", "Zombie accounts closed, mass-unsubscribes done", "Monthly monitoring + re-removal when you get re-listed"],
    finePrint: "Results-priced after the initial sweep: monitoring credits spend only when a new listing is found and removed. Needs the name/aliases and details you want scrubbed.",
  },
  "Hard Conversation Ghostwriter": {
    scene: "It's the message that's been sitting in your drafts for a week — the client you have to let go, the friend who still owes you $400, the landlord who won't fix the heat, the raise you've earned and can't figure out how to ask for. The words aren't hard because you don't know what you mean. They're hard because tone is everything and you're too close to it. Describe the situation once; get back something that says the hard thing cleanly, keeps the door open where it should be, and closes it where it must.",
    steps: [
      ["Hear the whole situation", "The relationship, the history, the outcome you actually want, and the lines you're afraid to cross — captured in a couple of questions."],
      ["Find the register", "Firm without cruelty, warm without weakness, final without burning the bridge — the exact register the moment needs, matched to your natural voice."],
      ["Draft the message", "The email, text, or letter — ready to send, with the one hard sentence handled instead of hedged into meaninglessness."],
      ["Arm the follow-up", "The reply for when they push back, guilt-trip, or negotiate — drafted in advance so you're never caught flat in the moment that counts."],
    ],
    lands: ["The message you're dreading, written and send-ready", "A follow-up drafted for when they push back", "The right register — firm, warm, or final — matched to your voice"],
    finePrint: "Needs: the situation in your words and any thread it's replying to. Nothing sends without you — the words are yours to use or edit.",
  },
};

/* ============ SUBSCRIPTION GATING ============ */

type Plan = "Starter" | "Pro" | "Business";
const PLAN_RANK: Record<Plan, number> = { Starter: 0, Pro: 1, Business: 2 };
const PLAN_CREDITS: Record<Plan, number> = { Starter: 10, Pro: 30, Business: 100 };

/* Which plan unlocks each service */
const MIN_TIER: Record<string, Plan> = {
  "Hard Conversation Ghostwriter": "Starter",
  "Refund & Comp Recovery": "Starter",
  "Clip Factory": "Pro",
  "Digital Footprint Cleaner": "Pro",
  "Social Autopilot": "Pro",
  "Reputation Autopilot": "Business",
};
const unlocked = (svc: string, plan: Plan) => PLAN_RANK[plan] >= PLAN_RANK[MIN_TIER[svc]];

/* ============ SERVICE RUNTIMES (the 6 functioners) ============ */

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

  "Refund & Comp Recovery": {
    fields: [
      { key: "what", label: "What are we recovering on?", type: "select", options: ["A price drop after I bought", "A late flight / delivery", "An internet or service outage", "A wrong or double charge"] },
      { key: "item", label: "What was it & how much?", type: "text", placeholder: "Flight to Denver — $340" },
      { key: "when", label: "When did it happen?", type: "select", options: ["This week", "This month", "1–3 months ago"] },
    ],
    generate: (v) => {
      const kind = v.what || "";
      const isPrice = kind.startsWith("A price");
      const isLate = kind.includes("late");
      const isOutage = kind.includes("outage");
      return [
        { h: "The rule that forces a yes", lines: [
          isPrice ? `• ${v.item || "This purchase"} likely falls inside a price-adjustment window most retailers honor but never advertise. We cite their own policy back to them and request the difference refunded to your original payment.`
          : isLate ? `• ${v.item || "This trip/delivery"} — carriers owe compensation for delays past defined thresholds under specific regulations. We file citing the exact rule and delay length, not a vague complaint.`
          : isOutage ? `• ${v.item || "This service"} — providers credit outages on request but bank on you not asking. We calculate the pro-rated credit and demand it in writing.`
          : `• ${v.item || "This charge"} — a formal dispute citing the card network's rules goes to the billing channel that must respond, with your issuer ready to CC if they stall.`,
        ]},
        { h: "Drafted claim (files on your one tap)", lines: [
          `Re: ${isPrice ? "Price adjustment request" : isLate ? "Delay compensation claim" : isOutage ? "Service outage credit" : "Formal charge dispute"} — ${v.item || "[item]"}`,
          isPrice ? `"I purchased the above ${(v.when || "recently").toLowerCase()} and the price has since dropped. Per your price-adjustment policy, I request the difference refunded to my original payment method within your stated window."`
          : isLate ? `"The above was delayed beyond the threshold at which compensation is owed. I am claiming the compensation due under the applicable regulation and request written confirmation and payment within the mandated period."`
          : isOutage ? `"Service was interrupted for a material period ${(v.when || "recently").toLowerCase()}. I request a pro-rated credit for the outage applied to my next statement, per your service terms."`
          : `"I am formally disputing the above charge under the card network's dispute rules and applicable billing law, and request written resolution within 30 days."`,
        ]},
        { h: "Then it just… watches", lines: [
          "• The claim is filed to the channel that actually pays and tracked to resolution",
          "• Silent past their window → automatic escalation (regulator, card issuer, or supervisor as fits)",
          "• You're charged credits only if it recovers money — a running ledger shows what came back",
        ]},
      ];
    },
  },

  "Digital Footprint Cleaner": {
    fields: [
      { key: "name", label: "Name to scrub", type: "text", placeholder: "Jaden Green" },
      { key: "city", label: "City / state (helps find listings)", type: "text", placeholder: "Phoenix, AZ" },
      { key: "goal", label: "What's driving this?", type: "select", options: ["General privacy", "Reduce spam & robocalls", "A specific person I want to lose me", "Professional / safety reasons"] },
    ],
    generate: (v) => {
      const n = v.name || "your name";
      return [
        { h: `Exposure sweep for ${n} (sample)`, lines: [
          `🔴 12 data-broker profiles found — home address, ${v.city ? v.city + ", " : ""}age, and 3 listed relatives on the top people-search sites`,
          `🔴 2 old breaches include your email + a reused password — flagged for a reset, not just removal`,
          `🟡 41 marketing lists holding your address; 8 you opened this year, 33 you never did`,
          `🟢 6 dormant accounts tied to a breached email — closable on your say-so`,
        ]},
        { h: "Removal plan (files on your approval)", lines: [
          `• Deletion / opt-out requests submitted to all 12 brokers, each citing the specific request it's legally required to honor`,
          v.goal === "A specific person I want to lose me" ? "• The address-revealing sites first — the ones that make you findable — before the low-risk marketing lists"
          : v.goal === "Reduce spam & robocalls" ? "• Marketing lists and number-selling brokers first — the pipeline feeding the robocalls gets cut at the source"
          : v.goal === "Professional / safety reasons" ? "• People-search and address sites escalated, plus a suppression request wherever the law allows one"
          : "• Full sweep across brokers, people-search sites and stale accounts, worst-exposure first",
          "• 33 unread lists unsubscribed at the source; 6 zombie accounts closed",
        ]},
        { h: "Why this is a subscription, not a one-off", lines: [
          "• Brokers re-list you within weeks — a one-time scrub quietly undoes itself",
          "• Monthly re-scans catch new listings and re-file automatically",
          "• Results-priced after the sweep: you spend credits only when a new listing is actually found and removed",
        ]},
      ];
    },
  },

  "Hard Conversation Ghostwriter": {
    fields: [
      { key: "situation", label: "What's the conversation?", type: "select", options: ["Firing / parting ways with a client", "Chasing money a friend owes", "A complaint (landlord, company, service)", "Asking for a raise", "Ending a vendor / partnership", "Setting a hard boundary"] },
      { key: "detail", label: "The situation, in your words", type: "textarea", placeholder: "They've been late three months running and I've covered for them, but I can't keep doing it…" },
      { key: "tone", label: "How should it land?", type: "select", options: ["Firm but kind", "Warm, door left open", "Final — no ambiguity"] },
    ],
    generate: (v) => {
      const sit = v.situation || "";
      const warm = v.tone === "Warm, door left open";
      const final = v.tone === "Final — no ambiguity";
      const opener =
        sit.startsWith("Firing") ? `Hi [name] — I've valued working together, and I want to be straight with you rather than let this drift.`
        : sit.startsWith("Chasing") ? `Hey [name] — I hate that money is the thing between us right now, so I'd rather just say it plainly.`
        : sit.startsWith("A complaint") ? `Hi — I'm writing about an issue that's gone on long enough that a friendly nudge isn't enough anymore.`
        : sit.startsWith("Asking") ? `Hi [name] — I'd like to talk about my compensation, and I want to make the case directly.`
        : sit.startsWith("Ending") ? `Hi [name] — after a lot of thought, I've decided to end our arrangement, and I want to do it cleanly and fairly.`
        : `Hi [name] — I need to be clear about something, because being vague hasn't been fair to either of us.`;
      const hardLine =
        sit.startsWith("Firing") ? `After this project wraps, I'm going to move on from our work together. It isn't about any one thing — it's the right call for where I'm headed.`
        : sit.startsWith("Chasing") ? `The $[amount] from [when] is still outstanding, and I need it settled by [date]. I'd rather sort this now than let it sit between us any longer.`
        : sit.startsWith("A complaint") ? `The [issue] has not been resolved despite [attempts], and I'm now asking for [specific remedy] by [date].`
        : sit.startsWith("Asking") ? `Based on [what I've delivered], I'm asking for a raise to [number]. I've laid out the reasoning below and I'm confident it's earned.`
        : sit.startsWith("Ending") ? `We'll wind down over [notice period], I'll [handoff commitment], and I want to leave this on good terms.`
        : `Going forward, [the boundary]. I'm telling you directly so there's no confusion later.`;
      const close =
        final ? `I've made my decision, so I'm not looking to reopen it — but I'm glad to sort out the practical details whenever works.`
        : warm ? `I really do value what we've built, and I hope we can [stay in touch / work together again down the line]. Happy to talk it through.`
        : `I'd rather handle this like adults than let it fester, so let me know a good time to talk if you'd prefer.`;
      return [
        { h: "Drafted message (ready to send or edit)", lines: [
          opener,
          hardLine,
          close,
          `— [you]`,
        ]},
        { h: "Why it's built this way", lines: [
          `• The one hard sentence is stated once, cleanly — not buried, not repeated, not hedged into mush`,
          `• Tone dialed to "${v.tone || "Firm but kind"}": ${final ? "no openings that invite negotiation" : warm ? "the door is explicitly left open" : "firm on the ask, kind on the person"}`,
          v.detail ? `• Grounded in your specifics ("${excerpt(v.detail, 10)}") so it reads like you, not a template` : `• Add the details above and the draft grounds itself in your specifics`,
        ]},
        { h: "The follow-up, already written", lines: [
          `• When they push back, guilt-trip, or counter — a reply is drafted in advance in the same register`,
          `• You're never caught flat in the moment that actually counts`,
          `• Nothing sends without you. The words are yours to use, soften, or sharpen.`,
        ]},
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
    features: ["10 task credits / month", "2 starter services — Hard Conversation Ghostwriter + Refund & Comp Recovery", "1 Autopilot", "Credits roll over 1 month"],
    cta: "Go choreless",
    featured: false,
  },
  {
    name: "Pro",
    price: 79,
    credits: 30,
    turnaround: "24h turnaround",
    features: ["30 task credits / month", "5 services — adds Clip Factory, Social Autopilot & Digital Footprint Cleaner", "3 Autopilots", "1 free revision per task", "Voice & brand profile training", "Priority queue"],
    cta: "Go Pro",
    featured: true,
  },
  {
    name: "Business",
    price: 199,
    credits: 100,
    turnaround: "12h turnaround",
    features: ["100 task credits / month", "All 6 services — adds Reputation Autopilot", "Unlimited Autopilots", "Human QA on request", "Dedicated success manager", "Team seats (up to 5)"],
    cta: "Scale up",
    featured: false,
  },
];

const OUTCOMES = [
  { stat: "312", label: "data-broker listings removed", quote: "I searched my own name and there was so much — address, relatives, all of it. Now there's almost nothing, and it keeps them from re-adding me.", who: "Marcus T. — Pro member" },
  { stat: "+212%", label: "short-form views in 60 days", quote: "I upload one podcast. Ten scored clips come back. I haven't opened an editor since March.", who: "Dana R. — 340k subscribers" },
  { stat: "1 email", label: "I'd dreaded for a month", quote: "It wrote the 'we're done' message to a client with exactly the right spine. I sent it in one tap and finally slept.", who: "Dana L. — freelance designer" },
  { stat: "$486", label: "in refunds it claimed for me", quote: "It found the price drops, filed the claims, and tracked them. I did literally nothing.", who: "Priya S. — Pro member" },
  { stat: "4.9★", label: "average rating maintained", quote: "Every review answered within a week, in our voice. Our reputation runs itself now.", who: "Bluebird Café — Portland" },
  { stat: "3.2x", label: "ROAS on first managed campaign", quote: "Choreless Ads built 14 creative variants, killed the losers weekly, and tripled our return.", who: "Kettle & Co. — DTC brand" },
];

const DEMO_TASKS = [
  { name: "October social calendar", service: "Social Autopilot", status: "Awaiting approval", eta: "Ready now", pct: 95 },
  { name: "Cut podcast #42 into shorts", service: "Clip Factory", status: "In QA", eta: "~2h", pct: 80 },
  { name: "Remove me from 14 data-broker sites", service: "Digital Footprint Cleaner", status: "Running", eta: "~1 day", pct: 45 },
  { name: "Claim price-drop refund — Denver flight", service: "Refund & Comp Recovery", status: "Delivered", eta: "$60 back ✓", pct: 100 },
  { name: "Draft the raise-request email", service: "Hard Conversation Ghostwriter", status: "Delivered", eta: "Sent ✓", pct: 100 },
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
    "Turn my podcast into shorts",
    "Write the email I've been dreading to a client",
    "Get my money back on that price drop",
    "Remove me from data-broker sites",
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
          placeholder={'Describe any task, e.g. "write the email you\'re dreading" or "run ads for my shop"…'}
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
                {["Write the email I've been dreading to send", "Answer my 5 most recent unanswered reviews", "Turn my last video into 5 shorts"].map((t) => (
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
              Chatbots give you text. Choreless gives you <strong>finished work</strong> — shorts cut, reviews answered,
              money recovered, the hard email written, your data scrubbed. Drop a task, and AI agent pipelines with real
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
              ["It runs unprompted", "Autopilots work on schedules and triggers. Reviews answered weekly, refunds recovered, your data re-scrubbed — while you sleep."],
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

/* ============ EXECUTION ENGINE — the "AI decides, we act" services ============
   Refund & Comp Recovery and Digital Footprint Cleaner don't just generate text —
   they act on the customer's behalf on third-party sites. That needs three things
   the write-only services don't: explicit LEGAL AUTHORIZATION (you cannot file a
   claim or a deletion request as someone without their consent), an AGENTIC
   pipeline that logs into external sites via a headless browser, and HUMAN-OPS
   checkpoints for the steps a bot must not do alone (ID verification, anything
   that moves money, holdout sites). This models that flow end-to-end and gates it
   behind payment + signed authorization. In production the pipeline runs
   server-side on a headless-browser fleet feeding a human-ops queue; the demo
   compresses the SLA into seconds. */

type Actor = "agent" | "ops" | "legal" | "system";
type PipeStep = { label: string; actor: Actor; detail: string };
type LedgerRow = { item: string; status: string; tone: "win" | "pending" | "watch"; note: string };
type Execution = {
  chargeModel: string;
  chargeCta: string;
  consent: { id: string; label: string }[];
  pipeline: PipeStep[];
  ledger: (v: Record<string, string>) => { headline: string; sub: string; recovered?: string; rows: LedgerRow[] };
};

const ACTOR_META: Record<Actor, { icon: string; label: string; text: string; bg: string }> = {
  agent:  { icon: "🤖", label: "AI agent",   text: "text-[#FF4D00]", bg: "bg-[#FF4D00]" },
  ops:    { icon: "🧑‍💼", label: "Human ops",  text: "text-[#0A5C36]", bg: "bg-[#0A5C36]" },
  legal:  { icon: "⚖️", label: "Legal gate",  text: "text-[#141414]", bg: "bg-[#141414]" },
  system: { icon: "⚙️", label: "System",      text: "text-[#141414]/55", bg: "bg-[#141414]/55" },
};

const EXECUTION: Record<string, Execution> = {
  "Refund & Comp Recovery": {
    chargeModel: "Success-based — authorizing costs nothing today. You're only charged (a share of what we win back) when money actually lands.",
    chargeCta: "Authorize & start recovering",
    consent: [
      { id: "act", label: "I authorize Choreless to contact merchants, airlines and providers on my behalf to request the refunds, price adjustments and credits I'm owed." },
      { id: "dispute", label: "I understand Choreless never opens a bank chargeback or formal dispute without my explicit, per-claim approval." },
      { id: "data", label: "I grant read-only access to the receipts and order data I connect, used solely to detect recoverable money." },
    ],
    pipeline: [
      { actor: "system", label: "Index your receipts", detail: "Purchases, flights, deliveries and outages pulled into a live watch-list." },
      { actor: "agent",  label: "Scan for recoverable money", detail: "Prices re-checked, delivery SLAs and uptime cross-referenced against what you actually paid." },
      { actor: "agent",  label: "Match to merchant policy", detail: "Each hit mapped to that merchant's real refund / price-adjustment / comp policy and its filing window." },
      { actor: "legal",  label: "Authorization check", detail: "Confirms your signed authorization covers this merchant and claim type before anything is filed." },
      { actor: "agent",  label: "File the claim in your name", detail: "Logs into the merchant flow on a headless browser and submits the claim with the correct policy citation." },
      { actor: "ops",    label: "Human-ops review", detail: "A specialist checks every claim over $50, and anything touching a dispute, before it sends." },
      { actor: "agent",  label: "Track to resolution", detail: "Claim status followed until the credit lands — automatically re-filed once if wrongly denied." },
    ],
    ledger: (v) => {
      const item = (v.item || "").trim() || "your recent purchase";
      const what = v.what || "";
      const first: LedgerRow =
        what.includes("price")  ? { item: `Price drop after purchase — ${item}`, status: "Recovered ✓", tone: "win", note: "Difference credited to your original card in ~4 days" } :
        what.includes("flight") ? { item: `Late flight / delivery — ${item}`, status: "Filed · pending", tone: "pending", note: "SLA-breach compensation claim submitted; provider reviewing" } :
        what.includes("outage") ? { item: `Service outage — ${item}`, status: "Filed · pending", tone: "pending", note: "Bill-credit request filed under the provider's SLA" } :
                                   { item: `Wrong / double charge — ${item}`, status: "Human-ops review", tone: "watch", note: "Possible dispute — held for your one-tap approval before filing" };
      return {
        headline: "Recovery pipeline is live",
        sub: "You're only charged when money actually lands back with you.",
        recovered: "$187 recovered on average, per member, in the first month",
        rows: [
          first,
          { item: "Denver flight — $60 price drop", status: "Recovered ✓", tone: "win", note: "Auto-filed and credited last week" },
          { item: "Package 4 days late — shipping refund", status: "Filed · pending", tone: "pending", note: "Carrier SLA breach; confirmation expected in 3–5 days" },
          { item: "6-hr internet outage — bill credit", status: "Filed · pending", tone: "pending", note: "$22 credit requested from your provider" },
        ],
      };
    },
  },
  "Digital Footprint Cleaner": {
    chargeModel: "Flat sweep fee + monthly monitoring, charged when the sweep starts. Cancel anytime and the monitoring stops.",
    chargeCta: "Authorize agent & start the sweep",
    consent: [
      { id: "agent", label: "I appoint Choreless as my authorized agent to submit data-deletion and opt-out requests on my behalf (CCPA §1798.135 / GDPR Art. 17)." },
      { id: "process", label: "I consent to Choreless processing the identity details I provide solely to locate and remove my records." },
      { id: "id", label: "I understand some brokers require identity verification I complete myself; Choreless never uploads government ID without my per-request approval." },
    ],
    pipeline: [
      { actor: "system", label: "Build your identity fingerprint", detail: "Names, aliases, emails, phones and past addresses assembled into a match key." },
      { actor: "agent",  label: "Sweep the broker network", detail: "150+ data-broker and people-search sites crawled for records that match you." },
      { actor: "legal",  label: "Attach authorized-agent proof", detail: "Your signed authorization is bundled with each request so brokers are legally obliged to honor it." },
      { actor: "agent",  label: "File opt-outs & deletions", detail: "Removal forms submitted and the confirmation-email loops handled automatically." },
      { actor: "ops",    label: "Human-ops works the holdouts", detail: "Sites demanding a phone call, notarization or postcard are completed by a specialist." },
      { actor: "agent",  label: "Close accounts & unsubscribe", detail: "Dormant logins closed; mailing lists mass-unsubscribed at the source." },
      { actor: "system", label: "Monthly re-scan", detail: "Re-listed records caught and re-filed so you stay off the grid." },
    ],
    ledger: (v) => {
      const n = (v.name || "").trim() || "you";
      return {
        headline: `Erasing ${n} from the data brokers`,
        sub: "72-hour first sweep, then re-scanned and re-filed every month.",
        rows: [
          { item: "Spokeo · BeenVerified · Whitepages", status: "Removed ✓", tone: "win", note: "3 profiles deleted and confirmed" },
          { item: "14 more broker & people-search sites", status: "Opt-outs filed", tone: "pending", note: "Email-confirmation loops in progress (2–10 days)" },
          { item: "Radaris — postcard verification required", status: "Human-ops handling", tone: "watch", note: "A specialist is completing the manual step for you" },
          { item: "33 mailing lists · 6 zombie accounts", status: "Cleared ✓", tone: "win", note: "Unsubscribed at the source and closed" },
        ],
      };
    },
  },
};

function ServiceRunner({ s, close, sub }: { s: (typeof SERVICES)[number]; close: () => void; sub: Sub }) {
  const rt = RUNTIME[s.name];
  const d = DEEP[s.name];
  const ex = EXECUTION[s.name];
  const [phase, setPhase] = useState<"intake" | "authorize" | "running" | "done">("intake");
  const [values, setValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const spent = useRef(false);

  const runSteps: string[] = [...(d?.steps.map(([t]) => t) ?? []), "Quality gate"];
  const runLen = ex ? ex.pipeline.length : runSteps.length;
  const canRun = rt.fields.every((f) => (values[f.key] || "").trim().length > 0);
  const enough = sub.credits >= s.credits;
  const consentOk = ex ? ex.consent.every((c) => consent[c.id]) : true;
  const led = ex && phase === "done" ? ex.ledger(values) : null;

  useEffect(() => {
    if (phase !== "running") return;
    if (stepIdx >= runLen) {
      if (!spent.current) { spent.current = true; sub.spend(s.credits); }
      setPhase("done");
      return;
    }
    const t = setTimeout(() => setStepIdx((i) => i + 1), ex ? 700 : 800);
    return () => clearTimeout(t);
  }, [phase, stepIdx]);

  const blocks = phase === "done" && !ex ? rt.generate(values) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#141414]/70 p-4 py-8" onClick={close}>
      <div className="w-full max-w-2xl border-2 border-[#141414] bg-[#FAF7F2] shadow-[8px_8px_0_#0A5C36]" onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between border-b-2 border-[#141414] px-5 py-3 ${LANE_COLOR[s.lane]}`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">
              {phase === "intake" ? "New task"
                : phase === "authorize" ? "Authorization & payment"
                : phase === "running" ? (ex ? "Agents working" : "Pipeline running")
                : ex ? "Live status" : "Deliverable · QA passed"}
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
              {ex ? (
                <button
                  onClick={() => setPhase("authorize")}
                  disabled={!canRun}
                  className="bg-[#141414] px-5 py-2.5 text-sm font-bold text-[#FAF7F2] hover:opacity-90 disabled:opacity-40"
                >
                  {canRun ? "Review authorization →" : "Fill every field to continue"}
                </button>
              ) : enough ? (
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

        {/* AUTHORIZE — legal consent + payment (execution services only) */}
        {phase === "authorize" && ex && (
          <div className="p-5">
            <p className="text-sm text-[#141414]/70">
              This service acts for you on other companies' sites — so before anything runs, we need your explicit,
              signed authorization. Nothing is filed until every box is checked.
            </p>
            <div className="mt-4 border-2 border-[#141414] bg-white">
              <div className="flex items-center gap-2 border-b-2 border-[#141414] bg-[#141414] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#FAF7F2]">
                <span>⚖️</span> Authorization — we act on your behalf
              </div>
              <div className="space-y-3 px-4 py-4">
                {ex.consent.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      checked={!!consent[c.id]}
                      onChange={(e) => setConsent((p) => ({ ...p, [c.id]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#0A5C36]"
                    />
                    <span className="text-[#141414]/85">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <p className="mt-4 border-l-4 border-[#FF4D00] pl-3 text-xs italic text-[#141414]/70">{ex.chargeModel}</p>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#141414] pt-4">
              <button onClick={() => setPhase("intake")} className="border-2 border-[#141414] px-4 py-2 text-sm font-bold hover:bg-[#E8E1D4]">
                ← Back
              </button>
              {enough ? (
                <button
                  onClick={() => { setStepIdx(0); setPhase("running"); }}
                  disabled={!consentOk}
                  className="bg-[#0A5C36] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
                >
                  {consentOk ? `🔒 ${ex.chargeCta}` : "Check every box to authorize"}
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
            {ex ? (
              <div className="space-y-2">
                {ex.pipeline.map((st, i) => {
                  const m = ACTOR_META[st.actor];
                  const done = i < stepIdx, active = i === stepIdx;
                  return (
                    <div
                      key={st.label}
                      className={`flex gap-3 border-2 p-3 ${active ? "border-[#141414] bg-white shadow-[3px_3px_0_#141414]" : done ? "border-[#141414]/40 bg-white" : "border-[#141414]/15 bg-transparent opacity-45"}`}
                    >
                      <div className="pt-0.5 text-lg leading-none">
                        {done ? <span className="text-[#0A5C36]">✓</span> : active ? <span className="animate-pulse">{m.icon}</span> : m.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{st.label}</span>
                          <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${m.bg}`}>{m.label}</span>
                          {active && <span className="animate-pulse text-xs font-bold text-[#FF4D00]">working…</span>}
                        </div>
                        {(active || done) && <p className="mt-0.5 text-xs text-[#141414]/65">{st.detail}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border-2 border-[#141414] bg-[#141414] p-4 font-mono text-sm text-[#FAF7F2]">
                {runSteps.map((t, i) => (
                  <p key={t} className={i > stepIdx ? "opacity-25" : ""}>
                    {i < stepIdx ? <span className="text-[#7ee2a8]">✓</span> : i === stepIdx ? <span className="animate-pulse text-[#FF4D00]">▸</span> : "·"}{" "}
                    {t}
                    {i === stepIdx && <span className="animate-pulse">…</span>}
                  </p>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-[#141414]/60">
              {ex
                ? "In production these steps run server-side on a headless-browser fleet with a human-ops queue — you'd close this and watch status land in your dashboard. The demo compresses the real SLA into seconds."
                : `In production this runs asynchronously — you'd close this window and the deliverable would arrive in your dashboard within the SLA. The demo compresses ${s.turnaround.toLowerCase()} into seconds.`}
            </p>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div className="p-5">
            {ex && led ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="bg-[#0A5C36] px-2 py-1 text-xs font-bold uppercase tracking-widest text-white">● Live · running for you</span>
                  <span className="text-xs font-bold text-[#141414]/60">Authorized · {s.credits} credit{s.credits > 1 ? "s" : ""} reserved</span>
                </div>
                <h3 style={serif} className="mt-3 text-xl">{led.headline}</h3>
                <p className="text-sm text-[#141414]/70">{led.sub}</p>
                {led.recovered && (
                  <p className="mt-2 inline-block border-2 border-[#141414] bg-[#FF4D00] px-3 py-1 text-sm font-bold text-white">{led.recovered}</p>
                )}
                <div className="mt-4 border-2 border-[#141414] bg-white">
                  {led.rows.map((r, i) => {
                    const tone = r.tone === "win" ? "bg-[#0A5C36] text-white" : r.tone === "pending" ? "bg-[#FF4D00] text-white" : "bg-[#141414] text-white";
                    return (
                      <div key={i} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${i > 0 ? "border-t-2 border-[#141414]" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{r.item}</p>
                          <p className="text-xs text-[#141414]/60">{r.note}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${tone}`}>{r.status}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-[#141414]/60">
                  🧑‍💼 A human-ops specialist reviews every money-moving or ID-verification step before it completes — and you're pinged the moment anything needs your one-tap approval.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#141414] pt-4">
              <p className="text-xs text-[#141414]/60">{ex ? "Only charged on results. Cancel the autopilot anytime from your dashboard." : "Miss the brief? The revision is free and the credit comes back."}</p>
              <div className="flex gap-2">
                <button onClick={() => { setPhase("intake"); spent.current = false; setConsent({}); }} className="border-2 border-[#141414] px-4 py-2 text-sm font-bold hover:bg-[#E8E1D4]">
                  {ex ? "New task" : "Run again"}
                </button>
                <button onClick={close} className="bg-[#0A5C36] px-5 py-2 text-sm font-bold text-white hover:opacity-90">
                  {ex ? "Done — track in dashboard" : "✓ Approve & deliver"}
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
        Credits are the unit of finished work — a clipped video, a recovered refund, a hard email written. Unused credits roll
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
    "Refund & Comp Recovery": true,
    "Reputation Autopilot": true,
    "Social Autopilot": false,
    "Digital Footprint Cleaner": false,
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
          ["Services unlocked", `${SERVICES.filter((s) => unlocked(s.name, sub.plan)).length} / 6`, sub.plan === "Business" ? "Everything, including Reputation Autopilot" : sub.plan === "Pro" ? "Add Reputation Autopilot with Business" : "Add Clip Factory + more with Pro"],
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
