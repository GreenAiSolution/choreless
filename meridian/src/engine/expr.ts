/**
 * A small, safe expression language for node configs.
 *
 * Design constraints:
 *  - No `eval` / `Function` — configs come from user data and must never
 *    execute arbitrary JS.
 *  - Deterministic and pure, except for a whitelist of helper functions.
 *
 * Supports: number/string/boolean/null literals, dotted + bracket member
 * access against a scope, arithmetic (+ - * / %), comparison (== != < <= > >=),
 * logical (&& || !), unary minus, parentheses, and whitelisted function calls.
 *
 * Two entry points:
 *  - `evaluate(expr, scope)` evaluates one expression, returning a typed value.
 *  - `render(text, scope)` interpolates a string containing `{{ ... }}` spans.
 *    A string that is exactly one `{{ ... }}` span returns the raw typed value;
 *    otherwise spans are coerced to text and concatenated.
 */

export type Scope = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

type TokKind =
  | "num"
  | "str"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "comma"
  | "dot"
  | "eof";

interface Tok {
  kind: TokKind;
  value: string;
  pos: number;
}

const OPS = [
  "===",
  "!==",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
  "!",
];

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ kind: "lparen", value: c, pos: i++ });
      continue;
    }
    if (c === ")") {
      toks.push({ kind: "rparen", value: c, pos: i++ });
      continue;
    }
    if (c === "[") {
      toks.push({ kind: "lbracket", value: c, pos: i++ });
      continue;
    }
    if (c === "]") {
      toks.push({ kind: "rbracket", value: c, pos: i++ });
      continue;
    }
    if (c === ",") {
      toks.push({ kind: "comma", value: c, pos: i++ });
      continue;
    }
    if (c === ".") {
      // Only a member-access dot if not the start of a number like `.5`.
      if (!/[0-9]/.test(src[i + 1] ?? "")) {
        toks.push({ kind: "dot", value: c, pos: i++ });
        continue;
      }
    }
    // strings
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let out = "";
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < n) {
          const esc = src[j + 1]!;
          out +=
            esc === "n"
              ? "\n"
              : esc === "t"
                ? "\t"
                : esc === "r"
                  ? "\r"
                  : esc;
          j += 2;
        } else {
          out += src[j];
          j++;
        }
      }
      if (j >= n) throw new ExprError(`Unterminated string at ${i}`);
      toks.push({ kind: "str", value: out, pos: i });
      i = j + 1;
      continue;
    }
    // numbers
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j]!)) j++;
      toks.push({ kind: "num", value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    // identifiers
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j]!)) j++;
      toks.push({ kind: "ident", value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    // operators (longest match first)
    const rest = src.slice(i);
    const op = OPS.find((o) => rest.startsWith(o));
    if (op) {
      toks.push({ kind: "op", value: op, pos: i });
      i += op.length;
      continue;
    }
    throw new ExprError(`Unexpected character '${c}' at ${i}`);
  }
  toks.push({ kind: "eof", value: "", pos: n });
  return toks;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

type Ast =
  | { k: "lit"; v: unknown }
  | { k: "ident"; name: string }
  | { k: "member"; obj: Ast; prop: string }
  | { k: "index"; obj: Ast; index: Ast }
  | { k: "call"; name: string; args: Ast[] }
  | { k: "unary"; op: string; arg: Ast }
  | { k: "binary"; op: string; left: Ast; right: Ast };

export class ExprError extends Error {
  constructor(msg: string) {
    super(`Expression error: ${msg}`);
    this.name = "ExprError";
  }
}

// Binary operator precedence (higher binds tighter).
const PREC: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "===": 3,
  "!=": 3,
  "!==": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok {
    return this.toks[this.p]!;
  }
  private next(): Tok {
    return this.toks[this.p++]!;
  }
  private expect(kind: TokKind): Tok {
    const t = this.next();
    if (t.kind !== kind)
      throw new ExprError(`Expected ${kind} but got '${t.value || t.kind}'`);
    return t;
  }

  parse(): Ast {
    const ast = this.parseBinary(0);
    if (this.peek().kind !== "eof")
      throw new ExprError(`Unexpected trailing '${this.peek().value}'`);
    return ast;
  }

  private parseBinary(minPrec: number): Ast {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t.kind !== "op" || !(t.value in PREC)) break;
      const prec = PREC[t.value]!;
      if (prec < minPrec) break;
      this.next();
      const right = this.parseBinary(prec + 1); // left-associative
      left = { k: "binary", op: t.value, left, right };
    }
    return left;
  }

  private parseUnary(): Ast {
    const t = this.peek();
    if (t.kind === "op" && (t.value === "!" || t.value === "-")) {
      this.next();
      return { k: "unary", op: t.value, arg: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Ast {
    let node = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.kind === "dot") {
        this.next();
        const prop = this.expect("ident").value;
        node = { k: "member", obj: node, prop };
      } else if (t.kind === "lbracket") {
        this.next();
        const index = this.parseBinary(0);
        this.expect("rbracket");
        node = { k: "index", obj: node, index };
      } else {
        break;
      }
    }
    return node;
  }

  private parsePrimary(): Ast {
    const t = this.next();
    switch (t.kind) {
      case "num":
        return { k: "lit", v: Number(t.value) };
      case "str":
        return { k: "lit", v: t.value };
      case "lparen": {
        const inner = this.parseBinary(0);
        this.expect("rparen");
        return inner;
      }
      case "ident": {
        if (t.value === "true") return { k: "lit", v: true };
        if (t.value === "false") return { k: "lit", v: false };
        if (t.value === "null") return { k: "lit", v: null };
        // function call?
        if (this.peek().kind === "lparen") {
          this.next();
          const args: Ast[] = [];
          if (this.peek().kind !== "rparen") {
            args.push(this.parseBinary(0));
            while (this.peek().kind === "comma") {
              this.next();
              args.push(this.parseBinary(0));
            }
          }
          this.expect("rparen");
          return { k: "call", name: t.value, args };
        }
        return { k: "ident", name: t.value };
      }
      default:
        throw new ExprError(`Unexpected '${t.value || t.kind}'`);
    }
  }
}

// ---------------------------------------------------------------------------
// Whitelisted helper functions
// ---------------------------------------------------------------------------

const HELPERS: Record<string, (...args: unknown[]) => unknown> = {
  upper: (s) => String(s ?? "").toUpperCase(),
  lower: (s) => String(s ?? "").toLowerCase(),
  trim: (s) => String(s ?? "").trim(),
  len: (s) => (s == null ? 0 : (s as { length?: number }).length ?? 0),
  // first non-nullish argument
  default: (...args) => args.find((a) => a !== null && a !== undefined) ?? null,
  json: (v) => JSON.stringify(v ?? null),
  parse: (s) => {
    try {
      return JSON.parse(String(s));
    } catch {
      return null;
    }
  },
  number: (v) => Number(v),
  string: (v) => (v == null ? "" : String(v)),
  bool: (v) => Boolean(v),
  round: (v) => Math.round(Number(v)),
  floor: (v) => Math.floor(Number(v)),
  ceil: (v) => Math.ceil(Number(v)),
  abs: (v) => Math.abs(Number(v)),
  min: (...a) => Math.min(...a.map(Number)),
  max: (...a) => Math.max(...a.map(Number)),
  concat: (...a) => a.map((x) => (x == null ? "" : String(x))).join(""),
  contains: (hay, needle) =>
    String(hay ?? "").includes(String(needle ?? "")),
  now: () => new Date().toISOString(),
  coalesce: (...args) => args.find((a) => a !== null && a !== undefined) ?? null,
};

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

function evalAst(node: Ast, scope: Scope): unknown {
  switch (node.k) {
    case "lit":
      return node.v;
    case "ident":
      return scope[node.name];
    case "member": {
      const obj = evalAst(node.obj, scope);
      if (obj == null) return undefined;
      return (obj as Record<string, unknown>)[node.prop];
    }
    case "index": {
      const obj = evalAst(node.obj, scope);
      if (obj == null) return undefined;
      const idx = evalAst(node.index, scope) as string | number;
      return (obj as Record<string | number, unknown>)[idx];
    }
    case "call": {
      const fn = HELPERS[node.name];
      if (!fn) throw new ExprError(`Unknown function '${node.name}'`);
      return fn(...node.args.map((a) => evalAst(a, scope)));
    }
    case "unary": {
      const v = evalAst(node.arg, scope);
      return node.op === "!" ? !v : -Number(v);
    }
    case "binary":
      return evalBinary(node, scope);
  }
}

function evalBinary(node: Extract<Ast, { k: "binary" }>, scope: Scope): unknown {
  const { op } = node;
  // Short-circuit logical operators.
  if (op === "&&") return evalAst(node.left, scope) && evalAst(node.right, scope);
  if (op === "||") return evalAst(node.left, scope) || evalAst(node.right, scope);
  const l = evalAst(node.left, scope) as never;
  const r = evalAst(node.right, scope) as never;
  switch (op) {
    case "+":
      // If either side is a string, concatenate; else numeric add.
      return typeof l === "string" || typeof r === "string"
        ? String(l) + String(r)
        : (l as number) + (r as number);
    case "-":
      return (l as number) - (r as number);
    case "*":
      return (l as number) * (r as number);
    case "/":
      return (l as number) / (r as number);
    case "%":
      return (l as number) % (r as number);
    case "==":
    case "===":
      return l === r;
    case "!=":
    case "!==":
      return l !== r;
    case "<":
      return l < r;
    case "<=":
      return l <= r;
    case ">":
      return l > r;
    case ">=":
      return l >= r;
    default:
      throw new ExprError(`Unknown operator '${op}'`);
  }
}

const astCache = new Map<string, Ast>();

function compile(expr: string): Ast {
  let ast = astCache.get(expr);
  if (!ast) {
    ast = new Parser(lex(expr)).parse();
    astCache.set(expr, ast);
  }
  return ast;
}

/** Evaluate a single expression string against a scope. */
export function evaluate(expr: string, scope: Scope): unknown {
  return evalAst(compile(expr), scope);
}

const SPAN = /\{\{([\s\S]*?)\}\}/g;

/**
 * Render a template string. If the whole string is exactly one `{{ ... }}`
 * span, the raw typed value is returned; otherwise every span is stringified
 * and concatenated with the surrounding text.
 */
export function render(text: string, scope: Scope): unknown {
  const trimmed = text.trim();
  const single = /^\{\{([\s\S]*)\}\}$/.exec(trimmed);
  if (single && !single[1]!.includes("}}")) {
    return evaluate(single[1]!, scope);
  }
  return text.replace(SPAN, (_m, e: string) => {
    const v = evaluate(e, scope);
    return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}

/**
 * Deep-resolve a config object: any string containing `{{ }}` is rendered,
 * arrays/objects are walked recursively. Non-template values pass through.
 */
export function resolveConfig<T>(config: T, scope: Scope): T {
  if (typeof config === "string") {
    return (config.includes("{{") ? render(config, scope) : config) as T;
  }
  if (Array.isArray(config)) {
    return config.map((v) => resolveConfig(v, scope)) as unknown as T;
  }
  if (config && typeof config === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config)) out[k] = resolveConfig(v, scope);
    return out as T;
  }
  return config;
}
