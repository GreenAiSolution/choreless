import type { Catalogue, Health, Upgrade, Bundle } from "./types.js";

/**
 * The one client for the PHX/GROWTH PLUS site.
 *
 * Everything this server knows comes from the live site over HTTP. It carries
 * no copy of the price list on purpose: two copies of a price means one of them
 * is eventually stale, and the stale one is the one somebody quotes out loud.
 */

export const SITE_URL = (process.env.PHX_PLUS_URL ?? "https://plus.phxgrowth.com").replace(
  /\/$/,
  "",
);

const TIMEOUT_MS = 15_000;
/** Catalogue changes on deploy, not on the minute. */
const CATALOGUE_TTL_MS = 5 * 60_000;

export class SiteError extends Error {}

async function getJson<T>(path: string, acceptStatuses: number[] = [200]): Promise<T> {
  const url = `${SITE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!acceptStatuses.includes(res.status)) {
      throw new SiteError(
        `${url} returned HTTP ${res.status}. ` +
          (res.status === 404
            ? "That endpoint does not exist on this deploy — check PHX_PLUS_URL points at PHX/GROWTH PLUS and that it is running a build from after the catalogue endpoint shipped."
            : "The site is reachable but not answering normally."),
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof SiteError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new SiteError(`${url} did not respond within ${TIMEOUT_MS / 1000}s.`);
    }
    throw new SiteError(
      `Could not reach ${url}: ${err instanceof Error ? err.message : String(err)}. ` +
        `Set PHX_PLUS_URL if the site lives somewhere else.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

let cached: { at: number; value: Catalogue } | undefined;

export async function getCatalogue(): Promise<Catalogue> {
  if (cached && Date.now() - cached.at < CATALOGUE_TTL_MS) return cached.value;
  const value = await getJson<Catalogue>("/api/catalogue");
  cached = { at: Date.now(), value };
  return value;
}

/**
 * `/api/health` answers 503 when nothing can deliver an enquiry — that is the
 * signal, not an error, so it is an accepted status. Treating it as a failure
 * would hide exactly the condition the endpoint exists to report.
 */
export async function getHealth(): Promise<Health> {
  return getJson<Health>("/api/health", [200, 503]);
}

/** Cents to a readable figure. Prices are cents everywhere in this system. */
export function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

export function priceLine(u: Upgrade): string {
  return `${money(u.price)}${u.billing === "monthly" ? "/mo" : " one-time"}`;
}

export function findUpgrade(c: Catalogue, key: string): Upgrade | undefined {
  return c.upgrades.find((u) => u.key === key);
}

export function findBundle(c: Catalogue, key: string): Bundle | undefined {
  return c.bundles.find((b) => b.key === key);
}

/** Listing valid keys in an error is the difference between one retry and five. */
export function keyList(items: { key: string; name: string }[]): string {
  return items.map((i) => `${i.key} (${i.name})`).join(", ");
}
