#!/usr/bin/env node
/**
 * deploy-assembly.mjs — assemble a paid package for one customer.
 *
 *   node deploy-assembly.mjs <3|7|15> "<Business Name>" [--swap old.json=new.json]
 *
 * Reads the assembly manifest, pulls each bot from ../omniagent-engine/,
 * stamps the customer's business name into every agent's system message,
 * prefixes every workflow name with the business, and writes a complete
 * import-ready bundle to ./out/<business-slug>/ along with DEPLOY.md —
 * the wiring checklist for that specific assembly (every YOUR_* placeholder
 * found in the actual files, listed per bot).
 *
 * This is the deliverable. It is produced per paying customer, after
 * payment — the manifests and this script never ship to the public repo.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(here, '..', 'omniagent-engine');

const [, , size, business, ...rest] = process.argv;
if (!size || !business || !['3', '7', '15'].includes(size)) {
  console.error('usage: node deploy-assembly.mjs <3|7|15> "<Business Name>" [--swap old.json=new.json]');
  process.exit(1);
}

// optional seat swaps: --swap workflow-reservations.json=workflow-customer-support.json
const swaps = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--swap' && rest[i + 1] && rest[i + 1].includes('=')) {
    const [from, to] = rest[i + 1].split('=');
    swaps[from] = to;
  }
}

const manifest = JSON.parse(readFileSync(join(here, `assembly-${size}.json`), 'utf8'));
const slug = business.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const outDir = join(here, 'out', slug);
mkdirSync(outDir, { recursive: true });

const deployed = [];
const allPlaceholders = new Map(); // placeholder -> [bot roles]

function stampNode(node, biz) {
  if (node.parameters?.options?.systemMessage) {
    node.parameters.options.systemMessage = node.parameters.options.systemMessage
      .replaceAll('YOUR BUSINESS', biz)
      .replaceAll('the Omniagent WhatsApp assistant', `the ${biz} WhatsApp assistant`)
      .replaceAll('the Omniagent knowledge base', `the ${biz} knowledge base`);
  }
  return node;
}

for (const bot of manifest.bots) {
  const file = swaps[bot.file] || bot.file;
  const src = join(ENGINE, file);
  if (!existsSync(src)) {
    console.error(`missing engine file: ${file} — aborting, nothing partial shipped`);
    process.exit(1);
  }
  const wf = JSON.parse(readFileSync(src, 'utf8'));
  wf.name = `${business} — ${wf.name.replace(/^Omniagent — /, '')}`;
  wf.nodes = wf.nodes.map(n => stampNode(n, business));

  // collect YOUR_* placeholders that still need wiring for this customer
  const raw = JSON.stringify(wf);
  for (const m of raw.matchAll(/YOUR_[A-Z_]+/g)) {
    if (!allPlaceholders.has(m[0])) allPlaceholders.set(m[0], new Set());
    allPlaceholders.get(m[0]).add(bot.role);
  }

  const outFile = join(outDir, file);
  writeFileSync(outFile, JSON.stringify(wf, null, 2));
  deployed.push({ role: bot.role, file, requires: bot.requires || null });
}

// shared infra (knowledge ingestion) ships with every assembly
for (const extra of manifest.sharedInfra || []) {
  const src = join(ENGINE, extra);
  if (existsSync(src)) {
    writeFileSync(join(outDir, extra), readFileSync(src, 'utf8'));
    deployed.push({ role: 'Knowledge Ingestion', file: extra, requires: null });
  }
}

// per-customer wiring checklist, generated from what's actually in the files
const lines = [];
lines.push(`# ${manifest.name} — deployment for ${business}`);
lines.push('');
lines.push(`Generated ${new Date().toISOString().slice(0, 10)} · ${deployed.length} workflows · $${manifest.monthly}/mo + $${manifest.buildFee} build`);
lines.push('');
lines.push('## Import order');
lines.push('');
deployed.forEach((d, i) => {
  lines.push(`${i + 1}. \`${d.file}\` — ${d.role}${d.requires ? `  ⚠ requires: ${d.requires}` : ''}`);
});
lines.push('');
lines.push('## Wiring still needed (found in the shipped files)');
lines.push('');
if (allPlaceholders.size === 0) {
  lines.push('None — all endpoints stamped.');
} else {
  for (const [ph, roles] of allPlaceholders) {
    lines.push(`- [ ] \`${ph}\` — used by: ${[...roles].join(', ')}`);
  }
}
lines.push('');
lines.push('## Standard go-live (per docs/DEPLOYMENT.md)');
lines.push('');
lines.push('- [ ] Provision the WhatsApp number for this customer');
lines.push('- [ ] Create/assign credentials on every red-badged node');
lines.push('- [ ] Seed their knowledge base via the ingestion workflow');
lines.push('- [ ] Smoke test: cited answer, refusal, CONFIRM gate, memory follow-up');
lines.push('- [ ] Verify zero cross-tenant leakage in vector search before activation');
writeFileSync(join(outDir, 'DEPLOY.md'), lines.join('\n') + '\n');

// customer-facing welcome kit — send this (as PDF or paper) when the smoke test passes
const w = [];
w.push(`# Welcome to your ${manifest.name}`);
w.push('');
w.push(`**${business}** — your crew is live. This page is everything you need to know,`);
w.push('and it fits on one sheet on purpose.');
w.push('');
w.push('## Your staff');
w.push('');
for (const bot of manifest.bots) {
  const file = swaps[bot.file] || bot.file;
  if (swaps[bot.file]) {
    w.push(`- **${bot.role} seat** — filled at your request by a different specialist (${file.replace('workflow-', '').replace('.json', '')}).`);
  } else {
    w.push(`- **${bot.role}** — ${bot.why}${bot.requires ? ` *(activates once your ${bot.requires} is connected)*` : ''}`);
  }
}
w.push('');
w.push('## How to work with it');
w.push('');
w.push('- **Just message your number.** Text, voice notes, photos, PDFs — customers');
w.push('  (and you) talk to it like a person. Nothing to install.');
w.push('- **It only says what it knows.** Every factual answer comes from the documents');
w.push('  you gave us, with the source cited. If it doesn\'t know, it says so and brings');
w.push('  in a human — it does not guess.');
w.push('- **Nothing irreversible happens without you.** Money, bookings, quotes: the');
w.push('  agent proposes the exact action and waits for a typed **CONFIRM**. No CONFIRM,');
w.push('  no action. Every time.');
w.push('- **Updating its knowledge:** send us new menus, prices or policies any time —');
w.push('  they\'re loaded as part of your plan\'s knowledge refresh.');
w.push('');
w.push('## Your data');
w.push('');
w.push('Your knowledge base and conversations are isolated to your business alone.');
w.push('Nothing trains on them. Cancel and they\'re deleted, not archived.');
w.push('');
w.push('## When something looks wrong');
w.push('');
w.push('Reply to any message from us, or write **hello@omniagent.ai** with the word');
w.push('URGENT in the subject. A human reads it. That\'s the whole process.');
writeFileSync(join(outDir, 'WELCOME.md'), w.join('\n') + '\n');

console.log(`${manifest.name} assembled for "${business}"`);
console.log(`  ${deployed.length} workflows -> assemblies/out/${slug}/`);
console.log(`  wiring checklist -> assemblies/out/${slug}/DEPLOY.md`);
console.log(`  customer welcome kit -> assemblies/out/${slug}/WELCOME.md`);
