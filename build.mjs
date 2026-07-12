// Choreless build — turns App.tsx (source of truth) into a single self-contained
// index.html. No framework toolchain: React + Tailwind load from CDN, App.tsx is
// transpiled with esbuild and inlined, and the iris page-transition enhancement is
// carried over verbatim from the previous bundle.
//
//   node build.mjs
//
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL(".", import.meta.url).pathname;

// 1. Transform App.tsx: swap the react import for UMD globals, drop the default
//    export, and append the mount call.
let src = readFileSync(ROOT + "App.tsx", "utf8");
src = src.replace(
  'import { useEffect, useMemo, useRef, useState } from "react";',
  "const { useEffect, useMemo, useRef, useState } = React;"
);
src = src.replace("export default function App()", "function App()");
src += "\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));\n";

// 2. Transpile TSX -> JS with esbuild (classic JSX -> React.createElement, uses the
//    React UMD global). Fed via stdin so no temp file is left behind.
const appJs = execFileSync(
  "npx",
  ["--yes", "esbuild@0.21.5", "--loader=tsx", "--format=iife", "--minify"],
  { input: src, maxBuffer: 64 * 1024 * 1024 }
).toString();

// 3. The iris-transition enhancement (custom <style> + <script>) lives in a static
//    partial, extracted once from the original bundle. Reading it from a fixed file
//    (rather than re-parsing index.html) keeps this build idempotent.
const enhHtml = readFileSync(ROOT + "iris-transition.html", "utf8");
const enh = [];
const re = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
let m;
while ((m = re.exec(enhHtml))) enh.push(m[0]);

// 4. Assemble the self-contained page.
const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Choreless — the subscription that does the work, not the talking. AI pipelines deliver finished, QA'd work: shorts cut, money recovered, hard emails written, your data scrubbed.">
<title>Choreless</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>html,body{margin:0;background:#FAF7F2;color:#141414;font-family:ui-sans-serif,system-ui,sans-serif}</style>
${enh.filter((b) => b.startsWith("<style")).join("\n")}
</head><body>
<div id="root"></div>
<script>${appJs}</script>
${enh.filter((b) => b.startsWith("<script")).join("\n")}
</body></html>`;

writeFileSync(ROOT + "index.html", html);
writeFileSync(ROOT + "CHORELESS-platform.html", html);
console.log(`Built index.html (${(html.length / 1024).toFixed(0)} KB) + CHORELESS-platform.html`);
