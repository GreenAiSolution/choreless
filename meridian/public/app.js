// Meridian canvas UI — vanilla JS, no build step.
// Talks to the JSON API; renders nodes as absolutely-positioned divs and edges
// as SVG bezier paths. Runs stream live over Server-Sent Events.

const $ = (sel) => document.querySelector(sel);
const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw await err(r);
    return r.json();
  },
  async send(method, path, body) {
    const r = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw await err(r);
    return r.json();
  },
};
async function err(r) {
  let msg = `${r.status}`;
  try {
    const j = await r.json();
    msg = j.error || msg;
    if (j.issues?.length) msg += ": " + j.issues.map((i) => i.message).join("; ");
  } catch {}
  return new Error(msg);
}

// ---- State ---------------------------------------------------------------
const state = {
  catalog: [],
  catalogByType: {},
  workflow: null, // { id, name, nodes, edges, variables }
  selectedNodeId: null,
  dragEdge: null, // { from: {node, port}, x, y }
};

// ---- Boot ----------------------------------------------------------------
init();

async function init() {
  bindTopbar();
  state.catalog = await api.get("/api/node-types");
  state.catalogByType = Object.fromEntries(state.catalog.map((t) => [t.type, t]));
  renderPalette();
  await refreshWorkflowList();
  const list = await api.get("/api/workflows");
  if (list.length) await openWorkflow(list[0].id);
  else newWorkflow();
  bindCanvasDragging();
}

// ---- Palette -------------------------------------------------------------
function renderPalette() {
  const host = $("#palette-list");
  host.innerHTML = "";
  const byCat = {};
  for (const t of state.catalog) (byCat[t.category] ??= []).push(t);
  for (const [cat, items] of Object.entries(byCat)) {
    const h = document.createElement("div");
    h.className = "palette-cat";
    h.textContent = cat;
    host.appendChild(h);
    for (const t of items) {
      const el = document.createElement("div");
      el.className = "palette-item";
      el.innerHTML = `<span class="dot" style="background:${t.color}"></span>
        <div><div class="pi-label">${t.label}</div>
        <div class="pi-desc">${t.description.slice(0, 46)}${t.description.length > 46 ? "…" : ""}</div></div>`;
      el.onclick = () => addNode(t.type);
      host.appendChild(el);
    }
  }
}

// ---- Workflow lifecycle --------------------------------------------------
function newWorkflow() {
  state.workflow = {
    id: null,
    name: "Untitled workflow",
    description: "",
    nodes: [],
    edges: [],
    variables: {},
  };
  state.selectedNodeId = null;
  $("#wf-name").value = state.workflow.name;
  renderAll();
}

async function refreshWorkflowList() {
  const list = await api.get("/api/workflows");
  const sel = $("#wf-select");
  sel.innerHTML =
    `<option value="">— open workflow —</option>` +
    list.map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join("");
  if (state.workflow?.id) sel.value = state.workflow.id;
}

async function openWorkflow(id) {
  const wf = await api.get(`/api/workflows/${id}`);
  state.workflow = wf;
  state.selectedNodeId = null;
  $("#wf-name").value = wf.name;
  $("#wf-select").value = id;
  renderAll();
}

async function saveWorkflow() {
  const wf = state.workflow;
  wf.name = $("#wf-name").value.trim() || "Untitled workflow";
  const payload = {
    name: wf.name,
    description: wf.description,
    nodes: wf.nodes,
    edges: wf.edges,
    variables: wf.variables,
  };
  const saved = wf.id
    ? await api.send("PUT", `/api/workflows/${wf.id}`, payload)
    : await api.send("POST", "/api/workflows", payload);
  state.workflow = saved;
  await refreshWorkflowList();
  $("#wf-select").value = saved.id;
  toast("Saved", "ok");
  return saved;
}

// ---- Nodes ---------------------------------------------------------------
function addNode(type) {
  const spec = state.catalogByType[type];
  const wrap = $("#canvas-wrap").getBoundingClientRect();
  const config = {};
  for (const f of spec.fields) if (f.default !== undefined) config[f.key] = f.default;
  const node = {
    id: "n_" + Math.random().toString(36).slice(2, 8),
    type,
    name: spec.label,
    config,
    position: {
      x: 120 + Math.round(Math.random() * 60),
      y: 80 + Math.round(Math.random() * 60),
    },
  };
  state.workflow.nodes.push(node);
  state.selectedNodeId = node.id;
  renderAll();
}

function deleteNode(id) {
  const wf = state.workflow;
  wf.nodes = wf.nodes.filter((n) => n.id !== id);
  wf.edges = wf.edges.filter((e) => e.from.node !== id && e.to.node !== id);
  if (state.selectedNodeId === id) state.selectedNodeId = null;
  renderAll();
}

// ---- Rendering -----------------------------------------------------------
function renderAll() {
  renderNodes();
  renderEdges();
  renderInspector();
  $("#canvas-empty").style.display = state.workflow.nodes.length ? "none" : "flex";
}

function renderNodes() {
  const canvas = $("#canvas");
  canvas.innerHTML = "";
  for (const node of state.workflow.nodes) {
    const spec = state.catalogByType[node.type] || {
      color: "#888",
      inputs: [],
      outputs: [],
      label: node.type,
    };
    const el = document.createElement("div");
    el.className = "node" + (state.selectedNodeId === node.id ? " selected" : "");
    el.style.left = node.position.x + "px";
    el.style.top = node.position.y + "px";
    el.dataset.id = node.id;

    const inputs = spec.inputs
      .map(
        (p) =>
          `<div class="port in" data-port="${p.name}"><span class="knob" data-dir="in" data-node="${node.id}" data-port="${p.name}"></span><span>${p.name}</span></div>`,
      )
      .join("");
    const outputs = spec.outputs
      .map(
        (p) =>
          `<div class="port out" data-port="${p.name}"><span class="knob" data-dir="out" data-node="${node.id}" data-port="${p.name}"></span><span>${p.name}</span></div>`,
      )
      .join("");

    el.innerHTML = `
      <div class="node-head">
        <span class="swatch" style="background:${spec.color}"></span>
        <span class="node-title">${escapeHtml(node.name)}</span>
        <span class="node-type">${node.type}</span>
      </div>
      <div class="ports">
        <div class="port-col in">${inputs}</div>
        <div class="port-col out">${outputs}</div>
      </div>`;
    canvas.appendChild(el);

    el.querySelector(".node-head").addEventListener("mousedown", (e) =>
      startNodeDrag(e, node),
    );
    el.addEventListener("mousedown", () => selectNode(node.id));
    for (const knob of el.querySelectorAll('.knob[data-dir="out"]'))
      knob.addEventListener("mousedown", (e) => startEdgeDrag(e, node.id, knob.dataset.port));
    for (const knob of el.querySelectorAll('.knob[data-dir="in"]'))
      knob.addEventListener("mouseup", (e) => finishEdgeDrag(e, node.id, knob.dataset.port));
  }
}

function knobCenter(nodeId, dir, port) {
  const sel = `.node[data-id="${nodeId}"] .knob[data-dir="${dir}"][data-port="${port}"]`;
  const knob = document.querySelector(sel);
  const wrap = $("#canvas-wrap").getBoundingClientRect();
  if (!knob) return null;
  const r = knob.getBoundingClientRect();
  return { x: r.left + r.width / 2 - wrap.left, y: r.top + r.height / 2 - wrap.top };
}

function bezier(a, b) {
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

function renderEdges(liveEdgeIds = new Set()) {
  const svg = $("#edges");
  svg.innerHTML = "";
  for (const e of state.workflow.edges) {
    const a = knobCenter(e.from.node, "out", e.from.port);
    const b = knobCenter(e.to.node, "in", e.to.port);
    if (!a || !b) continue;
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", bezier(a, b));
    hit.setAttribute("class", "edge-hit");
    hit.addEventListener("click", () => {
      state.workflow.edges = state.workflow.edges.filter((x) => x.id !== e.id);
      renderAll();
    });
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", bezier(a, b));
    path.setAttribute(
      "class",
      "edge-path" + (liveEdgeIds.has(e.id) ? " live" : ""),
    );
    svg.appendChild(path);
    svg.appendChild(hit);
  }
  if (state.dragEdge) {
    const a = knobCenter(state.dragEdge.from.node, "out", state.dragEdge.from.port);
    if (a) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", bezier(a, { x: state.dragEdge.x, y: state.dragEdge.y }));
      p.setAttribute("class", "edge-temp");
      svg.appendChild(p);
    }
  }
}

// ---- Inspector -----------------------------------------------------------
function selectNode(id) {
  state.selectedNodeId = id;
  document
    .querySelectorAll(".node")
    .forEach((n) => n.classList.toggle("selected", n.dataset.id === id));
  renderInspector();
}

function renderInspector() {
  const empty = $("#inspector-empty");
  const body = $("#inspector-body");
  const node = state.workflow.nodes.find((n) => n.id === state.selectedNodeId);
  if (!node) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;
  const spec = state.catalogByType[node.type];
  body.innerHTML = `<h3>${escapeHtml(spec?.label || node.type)}</h3>
    <p class="sub">${escapeHtml(spec?.description || "")}</p>
    <div class="field"><label>Name</label><input id="f-name" value="${escapeHtml(node.name)}" /></div>`;

  for (const f of spec?.fields || []) {
    const val = node.config[f.key];
    body.appendChild(fieldEl(f, val));
  }

  const rel = document.createElement("div");
  rel.className = "field";
  rel.innerHTML = `<label>Reliability</label>
    <div style="display:flex;gap:6px">
      <input id="f-retries" type="number" min="0" max="5" placeholder="retries" value="${node.retries ?? ""}" title="retries" style="width:50%"/>
      <select id="f-onerror" style="width:50%" title="on error">
        <option value="stop"${(node.onError ?? "stop") === "stop" ? " selected" : ""}>stop</option>
        <option value="continue"${node.onError === "continue" ? " selected" : ""}>continue</option>
      </select>
    </div>`;
  body.appendChild(rel);

  const del = document.createElement("button");
  del.className = "danger";
  del.textContent = "Delete node";
  del.onclick = () => deleteNode(node.id);
  body.appendChild(del);

  // Wire inputs.
  $("#f-name").oninput = (e) => {
    node.name = e.target.value;
    const title = document.querySelector(`.node[data-id="${node.id}"] .node-title`);
    if (title) title.textContent = node.name;
  };
  $("#f-retries").oninput = (e) => {
    const v = e.target.value;
    if (v === "") delete node.retries;
    else node.retries = Number(v);
  };
  $("#f-onerror").onchange = (e) => (node.onError = e.target.value);
  for (const f of spec?.fields || []) {
    const inp = document.getElementById("cfg-" + f.key);
    if (!inp) continue;
    inp.addEventListener("input", () => {
      node.config[f.key] = readField(f, inp);
    });
  }
}

function fieldEl(f, val) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const id = "cfg-" + f.key;
  let control;
  if (f.type === "boolean") {
    control = `<select id="${id}"><option value="true"${val ? " selected" : ""}>true</option><option value="false"${!val ? " selected" : ""}>false</option></select>`;
  } else if (f.type === "text" || f.type === "json") {
    const text =
      f.type === "json" && typeof val !== "string"
        ? JSON.stringify(val ?? f.default ?? null, null, 2)
        : val ?? "";
    control = `<textarea id="${id}" placeholder="${f.placeholder || ""}">${escapeHtml(String(text))}</textarea>`;
  } else if (f.type === "number") {
    control = `<input id="${id}" type="number" value="${val ?? ""}" placeholder="${f.placeholder || ""}"/>`;
  } else {
    control = `<input id="${id}" value="${escapeHtml(val ?? "")}" placeholder="${f.placeholder || ""}"/>`;
  }
  wrap.innerHTML = `<label>${f.label}${f.required ? " *" : ""}</label>${control}${f.help ? `<div class="help">${escapeHtml(f.help)}</div>` : ""}`;
  return wrap;
}

function readField(f, inp) {
  if (f.type === "boolean") return inp.value === "true";
  if (f.type === "number") return inp.value === "" ? null : Number(inp.value);
  if (f.type === "json") {
    try {
      return JSON.parse(inp.value);
    } catch {
      return inp.value; // keep as string (may be an expression)
    }
  }
  return inp.value;
}

// ---- Dragging: nodes & edges --------------------------------------------
let nodeDrag = null;
function startNodeDrag(e, node) {
  e.preventDefault();
  const wrap = $("#canvas-wrap").getBoundingClientRect();
  nodeDrag = {
    node,
    offX: e.clientX - wrap.left - node.position.x,
    offY: e.clientY - wrap.top - node.position.y,
  };
}

function startEdgeDrag(e, nodeId, port) {
  e.preventDefault();
  e.stopPropagation();
  state.dragEdge = { from: { node: nodeId, port }, x: e.clientX, y: e.clientY };
}

function finishEdgeDrag(e, nodeId, port) {
  if (!state.dragEdge) return;
  e.stopPropagation();
  const from = state.dragEdge.from;
  if (from.node !== nodeId) {
    // prevent duplicates
    const exists = state.workflow.edges.some(
      (x) =>
        x.from.node === from.node &&
        x.from.port === from.port &&
        x.to.node === nodeId &&
        x.to.port === port,
    );
    if (!exists) {
      state.workflow.edges.push({
        id: "e_" + Math.random().toString(36).slice(2, 8),
        from,
        to: { node: nodeId, port },
      });
    }
  }
  state.dragEdge = null;
  renderAll();
}

function bindCanvasDragging() {
  window.addEventListener("mousemove", (e) => {
    const wrap = $("#canvas-wrap").getBoundingClientRect();
    if (nodeDrag) {
      nodeDrag.node.position.x = Math.round(e.clientX - wrap.left - nodeDrag.offX);
      nodeDrag.node.position.y = Math.round(e.clientY - wrap.top - nodeDrag.offY);
      const el = document.querySelector(`.node[data-id="${nodeDrag.node.id}"]`);
      if (el) {
        el.style.left = nodeDrag.node.position.x + "px";
        el.style.top = nodeDrag.node.position.y + "px";
      }
      renderEdges();
    } else if (state.dragEdge) {
      state.dragEdge.x = e.clientX - wrap.left;
      state.dragEdge.y = e.clientY - wrap.top;
      renderEdges();
    }
  });
  window.addEventListener("mouseup", () => {
    nodeDrag = null;
    if (state.dragEdge) {
      state.dragEdge = null;
      renderEdges();
    }
  });
}

// ---- Run (SSE) -----------------------------------------------------------
async function runWorkflow() {
  const saved = await saveWorkflow();
  clearRunStatus();
  document
    .querySelectorAll(".node")
    .forEach((n) =>
      n.classList.remove("status-running", "status-succeeded", "status-failed", "status-skipped"),
    );
  setRunStatus("running", "running");
  logLine("system", "", `Run started for “${saved.name}”`);

  const es = new EventSource(`/api/workflows/${saved.id}/run-stream`);
  es.addEventListener("node:start", (ev) => {
    const { nodeId } = JSON.parse(ev.data);
    markNode(nodeId, "running");
  });
  es.addEventListener("node:log", (ev) => {
    const { nodeId, entry } = JSON.parse(ev.data);
    logLine(entry.level, nodeName(nodeId), entry.message);
  });
  es.addEventListener("node:finish", (ev) => {
    const { nodeRun } = JSON.parse(ev.data);
    markNode(nodeRun.nodeId, nodeRun.status);
    if (nodeRun.status === "failed")
      logLine("error", nodeRun.name, nodeRun.error || "failed");
  });
  es.addEventListener("run:finish", (ev) => {
    const { run } = JSON.parse(ev.data);
    setRunStatus(run.status, run.status);
    if (run.status === "succeeded")
      logLine("system", "", "✓ Completed. Output: " + JSON.stringify(run.output));
    else logLine("error", "", run.error || "Run failed");
  });
  es.addEventListener("done", () => es.close());
  es.addEventListener("error", (ev) => {
    try {
      const d = JSON.parse(ev.data);
      logLine("error", "", d.message || "stream error");
      setRunStatus("failed", "failed");
    } catch {}
    es.close();
  });
}

function markNode(nodeId, status) {
  const el = document.querySelector(`.node[data-id="${nodeId}"]`);
  if (!el) return;
  el.classList.remove("status-running", "status-succeeded", "status-failed", "status-skipped");
  el.classList.add("status-" + status);
}
function nodeName(id) {
  return state.workflow.nodes.find((n) => n.id === id)?.name || id;
}

function logLine(level, tag, msg) {
  const el = document.createElement("div");
  el.className = "log-line " + level;
  el.innerHTML = `${tag ? `<span class="node-tag">${escapeHtml(tag)}</span>` : ""}<span class="msg">${escapeHtml(msg)}</span>`;
  const log = $("#run-log");
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}
function setRunStatus(text, cls) {
  const el = $("#run-status");
  el.textContent = text;
  el.className = "run-status " + cls;
}
function clearRunStatus() {
  $("#run-status").textContent = "";
  $("#run-status").className = "run-status";
}

// ---- Topbar --------------------------------------------------------------
function bindTopbar() {
  $("#btn-new").onclick = () => newWorkflow();
  $("#btn-save").onclick = () => saveWorkflow().catch((e) => toast(e.message, "error"));
  $("#btn-run").onclick = () => runWorkflow().catch((e) => toast(e.message, "error"));
  $("#btn-validate").onclick = () => validateWorkflow().catch((e) => toast(e.message, "error"));
  $("#btn-clear-log").onclick = () => ($("#run-log").innerHTML = "");
  $("#wf-select").onchange = (e) => {
    if (e.target.value) openWorkflow(e.target.value).catch((x) => toast(x.message, "error"));
  };
}

async function validateWorkflow() {
  const saved = await saveWorkflow();
  const res = await api.send("POST", `/api/workflows/${saved.id}/validate`, {});
  if (res.valid && res.issues.length === 0) {
    toast("Valid ✓", "ok");
  } else if (res.valid) {
    toast(res.issues.map((i) => i.message).join("; "), "ok");
  } else {
    toast(res.issues.filter((i) => i.level === "error").map((i) => i.message).join("; "), "error");
  }
}

// ---- Utils ---------------------------------------------------------------
let toastTimer;
function toast(msg, kind = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast " + kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}
function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
