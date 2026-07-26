import Link from "next/link";
import { ArrowRight, Radio, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { PRODUCT_LINES } from "@/lib/catalog";
import { RobotAvatar } from "@/components/robot-avatar";
import { Pricing } from "@/components/marketing/pricing";
import { LeadForm } from "@/components/marketing/lead-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function MarketingHome() {
  return (
    <div className="relative">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-cyan shadow-hud">
              ◈
            </span>
            NEXUS<span className="text-gradient">GROWTH</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#agents" className="hover:text-foreground">Agents</a>
            <a href="#lines" className="hover:text-foreground">Product Lines</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Launch console</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container relative py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <Badge className="mx-auto">Growth, on autopilot</Badge>
          <h1 className="mt-6 font-heading text-5xl font-bold leading-[1.05] md:text-6xl">
            Deploy an <span className="text-gradient">AI growth crew</span> and managed ad-ops from one cockpit.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Five specialist AI agents qualify leads, write ads, follow up, and update your CRM —
            while our ad-operations team runs the spend. Self-serve. Real-time. Relentless.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#pricing">See pricing</a>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-cyan" /> Real-time agent runs</span>
            <span className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-violet" /> Live ROAS dashboards</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-magenta" /> Managed ad-ops</span>
          </div>
        </div>
      </section>

      {/* Agent roster */}
      <section id="agents" className="container py-20">
        <div className="mb-12 text-center">
          <Badge variant="magenta">The Crew</Badge>
          <h2 className="mt-3 font-heading text-3xl font-bold">Meet your agents</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Each agent is a distinct specialist with its own persona, tools, and system prompt.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {AGENTS.map((agent) => (
            <div key={agent.slug} className="hud-panel hud-corners group flex flex-col items-center p-6 text-center transition-transform hover:-translate-y-1">
              <div className="relative h-28 w-28">
                <RobotAvatar variant={agent.avatar} accent={agent.accent} />
              </div>
              <span className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                {agent.persona}
              </span>
              <h3 className="mt-1 font-heading text-base font-semibold">{agent.name}</h3>
              <p className="mt-2 text-xs text-muted-foreground">{agent.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product lines */}
      <section id="lines" className="container py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="hud-panel p-8">
            <Sparkles className="h-8 w-8 text-cyan" />
            <h3 className="mt-4 font-heading text-2xl font-bold">{PRODUCT_LINES.AI_AGENTS.name}</h3>
            <p className="mt-2 text-muted-foreground">{PRODUCT_LINES.AI_AGENTS.blurb}</p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li>› Chat with each agent in real time</li>
              <li>› Custom instructions + saved brand voice</li>
              <li>› Usage metering with graceful limits</li>
            </ul>
          </div>
          <div className="hud-panel p-8">
            <Gauge className="h-8 w-8 text-violet" />
            <h3 className="mt-4 font-heading text-2xl font-bold">{PRODUCT_LINES.AD_OPS.name}</h3>
            <p className="mt-2 text-muted-foreground">{PRODUCT_LINES.AD_OPS.blurb}</p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li>› Spend, CPL, and ROAS dashboards</li>
              <li>› Creative rotation + campaign management</li>
              <li>› Monthly AI-written executive reports</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container py-20">
        <div className="mb-12 text-center">
          <Badge variant="violet">Pricing</Badge>
          <h2 className="mt-3 font-heading text-3xl font-bold">Strategic tiers for both lines</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Hold one subscription per line. Upgrade, downgrade, or cancel anytime from the console.
          </p>
        </div>
        <Pricing />
      </section>

      {/* Social proof */}
      <section className="container py-16">
        <div className="hud-panel grid gap-6 p-8 text-center sm:grid-cols-3">
          {[
            { k: "3.8×", v: "Avg. ROAS lift" },
            { k: "−34%", v: "Cost per lead" },
            { k: "12k+", v: "Agent runs / week" },
          ].map((s) => (
            <div key={s.v}>
              <div className="hud-value text-4xl font-bold text-gradient">{s.k}</div>
              <div className="hud-label mt-2">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Lead capture */}
      <section id="contact" className="container py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <Badge>Talk to us</Badge>
            <h2 className="mt-3 font-heading text-3xl font-bold">
              Get a tailored growth plan
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tell us about your funnel and we&apos;ll map the exact agents and ad-ops tier to hit
              your targets. Submissions flow straight into our CRM.
            </p>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Nexus Growth Platform</span>
          <span className="font-mono text-xs uppercase tracking-widest">Cockpit online · systems nominal</span>
        </div>
      </footer>
    </div>
  );
}
