"use client";

import * as React from "react";
import {
  CITATION_SOURCES,
  readCorroboration,
  webLayout,
  type CorroborationAnswers,
} from "@/lib/instruments/corroboration";
import { Instrument, Readout, Figure, Toggle } from "@/components/marketing/instrument";
import { pulse } from "@/components/marketing/pulse";

/**
 * INSTRUMENT 02 — THE CORROBORATION WEB
 *
 * Drawn on canvas because the subject is a shape.
 *
 * The thing an owner has to see is not a list of directories — they have seen
 * that, it is every SEO invoice they have ever paid. It is that their site
 * sits alone in the middle making claims, and that the lines running back to
 * it are either solid, broken, or absent. A table cannot show you that a web
 * is not a web.
 *
 * WHY THE CONFLICT STATE IS DRAWN, NOT COUNTED
 *   A listing that exists with the wrong suite number is worse than no listing
 *   — conflicting records of one business look exactly like records of two.
 *   Drawn as a severed line rather than a missing one, that reads instantly.
 *   Written in a table it reads as a smaller number, which is the opposite of
 *   the truth.
 *
 * RENDERING
 *   Deterministic layout from `webLayout`, so the same answers always draw the
 *   same picture. The canvas is decorative-with-a-shadow: every node is also a
 *   labelled switch in the list beside it, and the canvas carries
 *   `aria-hidden`, so nothing here is canvas-only.
 */

const COLORS = {
  bg: "#07070b",
  hub: "#22d3ee",
  solid: "#34d399",
  broken: "#f0b429",
  faint: "rgba(255,255,255,0.09)",
  text: "rgba(255,255,255,0.55)",
};

export function CorroborationWeb({ onAdd }: { onAdd?: (key: string) => void }) {
  const [answers, setAnswers] = React.useState<CorroborationAnswers>({});
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reading = React.useMemo(() => readCorroboration(answers), [answers]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.36;
    const nodes = webLayout(answers, radius);

    // Edges first, so nodes sit on top of their own lines.
    for (const n of nodes) {
      const x = cx + n.x;
      const y = cy + n.y;
      ctx.beginPath();
      ctx.moveTo(cx, cy);

      if (!n.present) {
        // No record: a hint of where a line would be.
        ctx.setLineDash([2, 6]);
        ctx.strokeStyle = COLORS.faint;
        ctx.lineWidth = 1;
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (n.consistent) {
        ctx.setLineDash([]);
        ctx.strokeStyle = COLORS.solid;
        ctx.lineWidth = n.anchor ? 2 : 1.25;
        ctx.globalAlpha = 0.75;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // Present but disagreeing: drawn severed, because that is what it is.
        const bx = cx + n.x * 0.55;
        const by = cy + n.y * 0.55;
        ctx.setLineDash([]);
        ctx.strokeStyle = COLORS.broken;
        ctx.lineWidth = n.anchor ? 2 : 1.25;
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + n.x * 0.72, cy + n.y * 0.72);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Nodes.
    for (const n of nodes) {
      const x = cx + n.x;
      const y = cy + n.y;
      const r = n.anchor ? 5.5 : 4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = !n.present
        ? "rgba(255,255,255,0.14)"
        : n.consistent
          ? COLORS.solid
          : COLORS.broken;
      ctx.fill();
      if (n.anchor) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = ctx.fillStyle as string;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // The hub — you, making claims.
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.bg;
    ctx.fill();
    ctx.strokeStyle = COLORS.hub;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.hub;
    ctx.font = "600 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("YOU", cx, cy);

    ctx.fillStyle = COLORS.text;
    ctx.font = "8px ui-monospace, monospace";
    ctx.fillText(`${reading.consistent} agreeing · ${reading.conflicts} in conflict`, cx, size - 8);
  }, [answers, reading]);

  function set(key: string, patch: Partial<{ present: boolean; consistent: boolean }>) {
    setAnswers((prev) => {
      const cur = prev[key] ?? { present: false, consistent: false };
      const next = { ...cur, ...patch };
      // A record cannot agree with your site if it does not exist.
      if (!next.present) next.consistent = false;
      return { ...prev, [key]: next };
    });
    pulse("instrument", key);
  }

  return (
    <Instrument
      index={2}
      id="web"
      name="The Corroboration Web"
      reads="Whether anybody except you says you exist — and whether they agree with each other."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="phx-card flex flex-col justify-center p-5 md:p-6">
          <canvas
            ref={canvasRef}
            aria-hidden
            className="mx-auto aspect-square w-full max-w-[30rem]"
          />
          <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[0.68rem] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" /> agrees with your site
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> exists, disagrees
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" /> no record
            </span>
          </div>
        </div>

        <div>
          <p className="text-[0.8rem] leading-relaxed text-muted-foreground">
            Mark where a record of you exists, then whether it carries the{" "}
            <span className="text-foreground">same name, address and phone</span> as your site.
            Ringed sources are the ones a resolver reaches for first.
          </p>

          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {CITATION_SOURCES.map((s) => {
              const st = answers[s.key] ?? { present: false, consistent: false };
              return (
                <li key={s.key} className="flex flex-col gap-1">
                  <Toggle
                    checked={st.present}
                    onChange={(v) => set(s.key, { present: v })}
                    label={s.name}
                    sublabel={s.anchor ? "Anchor source" : s.note}
                  />
                  <div className="pl-3">
                    <Toggle
                      checked={st.consistent}
                      disabled={!st.present}
                      tone="gold"
                      onChange={(v) => set(s.key, { consistent: v })}
                      label="…and it matches exactly"
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-4">
            <Figure value={String(reading.reach)} caption="Domains with a record" tone="cyan" />
            <Figure value={String(reading.consistent)} caption="That agree" tone="signal" />
            <Figure value={String(reading.conflicts)} caption="In conflict" tone="gold" />
          </div>
        </div>
      </div>

      <Readout
        verdict={reading.corroborated ? "clear" : "gap"}
        headline={
          reading.conflictingAnchors.length > 0
            ? `${reading.conflictingAnchors.length} anchor source${reading.conflictingAnchors.length === 1 ? "" : "s"} disagree${reading.conflictingAnchors.length === 1 ? "s" : ""} with your site.`
            : reading.missingAnchors.length > 0
              ? `${reading.missingAnchors.length} anchor source${reading.missingAnchors.length === 1 ? " has" : "s have"} no record of you.`
              : reading.conflicts > 0
                ? `${reading.conflicts} record${reading.conflicts === 1 ? "" : "s"} say something different about you.`
                : "Every anchor present and agreeing."
        }
        body={
          reading.conflictingAnchors.length > 0
            ? `Conflicting records are worse than missing ones. ${reading.conflictingAnchors.map((s) => s.name).join(", ")} ${reading.conflictingAnchors.length === 1 ? "carries" : "carry"} a version of you that contradicts your own site, and to a resolver two contradictory records of one business are indistinguishable from records of two businesses.`
            : reading.missingAnchors.length > 0
              ? `A resolver reads a gap at ${reading.missingAnchors.map((s) => s.name).join(", ")} as doubt rather than as missing data — real businesses of any age are on the maps.`
              : reading.conflicts > 0
                ? "Not fatal, but each one is a reason for a resolver to lower its confidence in the whole entity."
                : "Nothing to fix here. Your web is intact — which makes anything the Inspector above flagged a markup problem rather than a citation one."
        }
        upgradeKey={reading.corroborated ? undefined : "citation-authority"}
        onAdd={onAdd}
      />
    </Instrument>
  );
}
