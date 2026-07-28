/** Shapes returned by the PHX/GROWTH PLUS public endpoints. */

export type ServiceKey = "premium-ai-ads" | "ai-employees" | "website-creation";
export type Billing = "monthly" | "one_time";

export interface Service {
  key: ServiceKey;
  name: string;
  priceLabel: string;
  includes: string[];
}

export interface Upgrade {
  key: string;
  name: string;
  attachesTo: ServiceKey;
  promise: string;
  fixes: string;
  delivers: string[];
  demandCase: string;
  /** Cents. */
  price: number;
  billing: Billing;
  leading: boolean;
  apex: boolean;
}

export interface Bundle {
  key: string;
  name: string;
  members: string[];
  promise: string;
  rationale: string;
  /** Cents. */
  price: number;
  listPrice: number;
  saving: number;
  apex: boolean;
}

export interface Catalogue {
  brand: { name: string; tagline: string; parent: { name: string; url: string } };
  thesis: string;
  currency: string;
  priceUnit: string;
  services: Service[];
  upgrades: Upgrade[];
  bundles: Bundle[];
  entryPrice: number;
  guarantee: { title?: string; body?: string } & Record<string, unknown>;
  proofPosture: Record<string, unknown>;
}

export interface HealthChannel {
  name: string;
  live: boolean;
  configuredAs?: string;
  fix?: string;
}

export interface Health {
  status: "ok" | "degraded";
  enquiriesReachAHuman: boolean;
  channels: HealthChannel[];
  catalogue: { upgrades: number };
  siteUrl: string;
  knowsItsOwnAddress: boolean;
  siteUrlFrom: string;
  checkedAt: string;
}
