const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const rel = (p) => path.relative(root, p);
const problems = [];
const warnings = [];
const fail = (msg) => problems.push(msg);
const OPTIONAL_ASSETS = /^(favicon\.(svg|ico)|apple-touch-icon\.png|site\.webmanifest|icon-\d+\.png)$/;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".git") || name === "vendor") continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(root);
const js = files.filter((f) => /\.(js|mjs)$/.test(f));

for (const f of js) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    fail("syntax error in " + rel(f) + ": " + String(e.stderr).split("\n").slice(0, 4).join(" "));
  }
}

for (const f of files.filter((f) => f.endsWith(".json") || f.endsWith(".webmanifest"))) {
  try { JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { fail("invalid JSON in " + rel(f)); }
}

const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const f of js.filter((f) => rel(f).startsWith("js" + path.sep))) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\$\("([^"]+)"\)/g)) {
    if (!ids.has(m[1])) fail(rel(f) + ' looks up #' + m[1] + " but index.html has no such id");
  }
}

for (const m of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
  const ref = m[1];
  if (/^(https?:|data:|mailto:|\/\/)/.test(ref)) continue;
  if (fs.existsSync(path.join(root, ref.replace(/^\//, "")))) continue;
  if (OPTIONAL_ASSETS.test(ref)) warnings.push("index.html references " + ref + ", which is not in this folder");
  else fail("index.html references missing file " + ref);
}

const moduleRef = html.match(/<script type="module" src="([^"]+)"/);
if (!moduleRef) fail("index.html has no module script");
else {
  const seen = new Set();
  (function follow(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/from "(\.[^"]+)"/g)) {
      const next = path.resolve(path.dirname(file), m[1]);
      if (!fs.existsSync(next)) fail(rel(file) + " imports missing module " + m[1]);
      else follow(next);
    }
  })(path.join(root, moduleRef[1]));
  for (const f of js.filter((f) => rel(f).startsWith("js" + path.sep) && f !== path.join(root, "js/package.json"))) {
    if (!seen.has(f)) fail(rel(f) + " is not imported by anything");
  }
}

if (/<script(?![^>]*\ssrc=)[^>]*>/.test(html)) fail("index.html has an inline script, which the Content-Security-Policy blocks");
if (/\son[a-z]+="/.test(html)) fail("index.html has an inline event handler, which the Content-Security-Policy blocks");
if (/<style[\s>]/.test(html) || /\sstyle="/.test(html)) fail("index.html has inline styles, which the Content-Security-Policy blocks");

const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const all = (vercel.headers || []).flatMap((h) => h.headers || []).map((h) => h.key);
for (const k of ["Content-Security-Policy", "X-Content-Type-Options", "Strict-Transport-Security"]) {
  if (!all.includes(k)) fail("vercel.json is missing the " + k + " header");
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const deploy = fs.existsSync(path.join(root, "docs/DEPLOYMENT.md")) ? fs.readFileSync(path.join(root, "docs/DEPLOYMENT.md"), "utf8") : "";
const apiSrc = walk(path.join(root, "api")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
for (const m of new Set([...apiSrc.matchAll(/env\("([A-Z_]+)"\)/g)].map((x) => x[1]))) {
  if (!readme.includes(m) && !deploy.includes(m)) fail("environment variable " + m + " is used in api/ but not documented");
}

for (const w of warnings) console.warn("warning: " + w);
if (problems.length) {
  console.error("Checks failed:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log("All checks passed (" + js.length + " scripts, " + ids.size + " page ids).");
