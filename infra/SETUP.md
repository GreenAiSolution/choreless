# The hosted engine — zero to running

Two paths. **Path A (n8n Cloud) is the fast one — take it for the demo instance
and your first customers.** Path B (this directory's docker-compose) is the
self-hosted path you graduate to when margin matters more than minutes.

Either way, everything downstream is identical: same engine imports, same
`deploy-assembly.mjs` bundles, same runbook (`../docs/DEPLOYMENT.md`).

---

## Path A — n8n Cloud (≈1 hour, no server)

1. **n8n Cloud** — create the account, Starter plan is fine to begin.
   You get `https://<yourname>.app.n8n.cloud` with TLS and webhooks working
   out of the box. This instance is the engine; every customer runs on it.
2. **OpenAI** — create the API key (platform.openai.com), set a monthly
   budget cap in Billing → Limits. One key serves all tenants.
3. **MongoDB Atlas** — free M0 cluster, database `omniagent`, collection
   `knowledge_base`, vector index `vector_index` (the exact JSON is in
   `../omniagent-engine/README.md`, step 3).
4. **Meta / WhatsApp Cloud API** — Meta developer app → WhatsApp product.
   Your first number is the **demo number**; each customer gets their own
   number added under the same WhatsApp Business Account later.
5. In n8n: create the five credentials listed in `../docs/DEPLOYMENT.md`
   step "Create credentials", then **import** `../omniagent-engine/workflow.json`
   and `ingest-knowledge-base.json`, wire, activate, smoke test.
6. Seed the demo knowledge base with a realistic menu/price list and run the
   playbook's 20-minute demo against it. **This is your sales rig — done.**

## Path B — self-hosted (this directory)

A $10–20/mo VPS (Hetzner/DigitalOcean, 2 vCPU / 4 GB) runs the whole engine.

```bash
# on the server
git clone <this-repo> && cd choreless/infra
cp .env.example .env        # fill in: domain, encryption key, db password
# point DNS: A record engine.yourdomain.com -> server IP  (do this FIRST)
docker compose up -d
# first boot: Caddy fetches TLS automatically; open https://engine.yourdomain.com
```

Then continue from Path A step 2 — the in-n8n work is identical.

**Backups:** volumes `n8n_data` (credentials, workflows) and `postgres_data`
(executions) are the whole state. Snapshot the VPS nightly or
`docker run --rm -v infra_n8n_data:/d -v $PWD:/b alpine tar czf /b/n8n-backup.tgz /d`.

---

## Per-customer go-live (either path, after payment clears)

```bash
cd assemblies
node deploy-assembly.mjs <3|7|15> "<Business Name>" [--swap old=new]
```

Import the bundle from `assemblies/out/<slug>/`, then follow that bundle's
generated `DEPLOY.md` — it lists exactly which `YOUR_*` endpoints still need
wiring for that customer, plus the smoke-test and isolation checklist. Send the
customer the generated `WELCOME.md` when the smoke test passes.

## Cost & capacity notes (premier means margins survive success)

- **Model spend is your COGS now.** At gpt-4.1 pricing, a busy customer doing
  3,000 conversations/mo costs single-digit dollars; the fair-use clause in
  `../docs/SERVICE-AGREEMENT.md` protects the tail. Set the OpenAI budget cap
  anyway.
- Drop to `gpt-4.1-mini` per-tenant (one dropdown in the agent's model node)
  for high-volume/low-complexity customers — same engine, fatter margin.
- One 4 GB VPS comfortably runs dozens of low-volume tenants; n8n Cloud plans
  meter by executions — recheck the plan at ~10 customers.
- WhatsApp Cloud API: the customer-service window is free; template messages
  (Chaser/Reminder/Winback outside 24h) carry Meta's per-template fee — it's
  cents, but it's why each assembly's build fee exists.
