// A LOCAL sandbox that stands in for the real third-party sites (a merchant and a
// data broker) so adapters have something concrete to drive without ever touching
// a real service. Binds to 127.0.0.1 only. This is what makes the demo safe to run.
import { createServer } from "node:http";

const MERCHANT = {
  // sku -> current price. "DENVER-FLIGHT" dropped from 340 to 280.
  prices: { "DENVER-FLIGHT": 280, "STANDARD-ITEM": 99 },
};
const BROKER = {
  // name -> records that "match" the person.
  records: {
    "jaden green": [
      { site: "Spokeo", recordId: "sp_1", holdout: false },
      { site: "BeenVerified", recordId: "bv_1", holdout: false },
      { site: "Whitepages", recordId: "wp_1", holdout: false },
      { site: "Radaris", recordId: "rd_1", holdout: true }, // needs postcard verification
    ],
  },
};

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function startMockTarget(port = 4711) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;

    // --- Merchant ---
    if (p === "/merchant/price") {
      const sku = url.searchParams.get("sku") || "";
      return json(res, 200, { sku, price: MERCHANT.prices[sku] ?? null });
    }
    if (p === "/merchant/claim" && req.method === "POST") {
      const body = await readBody(req);
      return json(res, 200, { claimId: "clm_" + Math.random().toString(36).slice(2, 8), status: "accepted", refund: body.amount });
    }

    // --- Broker ---
    if (p === "/broker/search") {
      const name = (url.searchParams.get("name") || "").toLowerCase();
      return json(res, 200, { name, matches: BROKER.records[name] || [] });
    }
    if (p === "/broker/optout" && req.method === "POST") {
      const body = await readBody(req);
      const rec = Object.values(BROKER.records).flat().find((r) => r.recordId === body.recordId);
      if (rec?.holdout) return json(res, 202, { status: "manual_verification_required", method: "postcard" });
      return json(res, 200, { status: "removed", recordId: body.recordId });
    }

    json(res, 404, { error: "not found" });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
  });
}
