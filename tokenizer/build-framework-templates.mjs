// Builds framework templates (Next.js, Gatsby, Nuxt) in templates/raw into static HTML so the tokenizer can use them.
//
//   node tokenizer/build-framework-templates.mjs [filter]
//
// Each project is copied to a scratch dir (WORK_DIR, default %TEMP%/dp-template-builds), installed with
// --ignore-scripts, built as a static export, and the export is copied back to templates/raw/<id>/static-build/.
// raw/ itself never gets node_modules. Results go to tokenizer/logs/framework-builds.json.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "templates", "raw");
const WORK = process.env.WORK_DIR || path.join(os.tmpdir(), "dp-template-builds");
const LOG = path.join(ROOT, "tokenizer", "logs", "framework-builds.json");

// [template id prefix, project root inside the template, framework, undeclared deps the template imports]
const TARGETS = [
  ["applock-next-js-15", "Applock-Nextjs_v1.0/Applock", "next"],
  ["atroly-attorney-lawyer", "Atroly", "next"],
  ["bentos-personal-portfolio", "bentos-next", "next"],
  ["borial-next-js-15", "Borial-Nextjs_v1.0/Borial", "next"],
  ["contis-ai-writer", "contis", "next"],
  ["naru-tailwind-nextjs", "NaruTailwindNextjs", "next"],
  ["nemu-nextjs", "NemuNextjs", "next"],
  ["nino-next-js", "nino-nextjs-package", "next", ["@popperjs/core"]],
  ["nuur-nextjs", "Nuur", "next"],
  ["current-gatsby-js", "Current-Gatsby_v1.0/Current", "gatsby"],
  ["seox-gatsby-js", "SEOX-Gatsby_v1.0/Seox", "gatsby"],
  ["techor-it-solution", "techor", "nuxt"],
  ["webfolio-creative-portfolio-nuxt", "Main_Files/webfolio-nuxtjs", "nuxt"],
];

const run = (cmd, cwd) =>
  execSync(cmd, { cwd, stdio: "pipe", encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", GATSBY_TELEMETRY_DISABLED: "1", NUXT_TELEMETRY_DISABLED: "1", CI: "1" } });

// Wrap the existing next.config so the build is a static export with unoptimized images.
function patchNextConfig(dir) {
  const found = ["next.config.ts", "next.config.mjs", "next.config.js"].find((f) => fs.existsSync(path.join(dir, f)));
  const extra = `output: "export", trailingSlash: true, images: { ...(orig.images || {}), unoptimized: true },
  eslint: { ignoreDuringBuilds: true }, typescript: { ignoreBuildErrors: true }`;
  if (!found) {
    fs.writeFileSync(path.join(dir, "next.config.js"), `const orig = {};\nmodule.exports = { ${extra} };\n`);
    return;
  }
  const ext = path.extname(found);
  const origName = `next.config.orig${ext}`;
  fs.renameSync(path.join(dir, found), path.join(dir, origName));
  const src = fs.readFileSync(path.join(dir, origName), "utf8");
  const isCjs = ext === ".js" && /module\.exports/.test(src);
  const body = isCjs
    ? `const o = require("./${origName}");\nconst orig = typeof o === "function" ? o("phase-production-build", {}) : o;\nmodule.exports = { ...orig, ${extra} };\n`
    : `import o from "./next.config.orig${ext === ".ts" ? "" : ext}";\nconst orig: any = typeof o === "function" ? (o as any)("phase-production-build", {}) : o;\nexport default { ...orig, ${extra} };\n`;
  fs.writeFileSync(path.join(dir, found), ext === ".ts" ? body : body.replace("const orig: any", "const orig").replace("(o as any)", "o"));
}

function build(framework, dir, extraDeps = []) {
  const pm = fs.existsSync(path.join(dir, "yarn.lock")) ? "yarn" : "npm";
  run(pm === "yarn"
    ? "npx --yes yarn@1 install --ignore-scripts --non-interactive --network-timeout 600000"
    : "npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps", dir);
  if (extraDeps.length) run(`npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps ${extraDeps.join(" ")}`, dir);
  if (framework === "next") {
    patchNextConfig(dir);
    run("npx next build", dir);
    return "out";
  }
  if (framework === "gatsby") {
    run("npx gatsby build", dir);
    return "public";
  }
  // nuxi exits non-zero when any crawled sub-page fails to prerender; keep the export if the home page made it.
  try { run("npx nuxi generate", dir); } catch (err) {
    if (!fs.existsSync(path.join(dir, ".output", "public", "index.html"))) throw err;
    // A failed prerender stops before the client bundle is copied into the export; copy it ourselves.
    const client = path.join(dir, ".nuxt", "dist", "client", "_nuxt");
    const target = path.join(dir, ".output", "public", "_nuxt");
    if (!fs.existsSync(target) && fs.existsSync(client)) fs.cpSync(client, target, { recursive: true });
  }
  return fs.existsSync(path.join(dir, ".output", "public")) ? ".output/public" : "dist";
}

// Framework exports reference assets from the site root ("/_next/...", "/images/..."). That only works when the
// site is served at a domain root; rewrite them to "./..." when the file exists, so previews work from any folder.
function relativizeRootPaths(dir) {
  const file = path.join(dir, "index.html");
  const html = fs.readFileSync(file, "utf8");
  const exists = (p) => fs.existsSync(path.join(dir, decodeURIComponent(p.split(/[?#]/)[0])));
  const out = html
    .replace(/(\s(?:src|href|poster|content)=["'])\/(?!\/)([^"'\s>]+)/g, (m, pre, p) => (exists(p) ? `${pre}./${p}` : m))
    .replace(/(\ssrcset=["'])([^"']+)/g, (m, pre, list) =>
      pre + list.replace(/(^|,\s*)\/(?!\/)([^\s,]+)/g, (mm, sep, p) => (exists(p) ? `${sep}./${p}` : mm)));
  if (out !== html) fs.writeFileSync(file, out);
  return out !== html;
}

// `--relativize`: only rewrite root paths in existing builds (raw/<id>/static-build and processed/<id>), then exit.
if (process.argv[2] === "--relativize") {
  for (const [prefix] of TARGETS) {
    for (const base of [RAW, path.join(ROOT, "templates", "processed")]) {
      const id = fs.readdirSync(base).find((d) => d.startsWith(prefix));
      const dir = id && path.join(base, id, base === RAW ? "static-build" : "");
      if (dir && fs.existsSync(path.join(dir, "index.html"))) {
        console.log(`${relativizeRootPaths(dir) ? "rewrote " : "unchanged"} ${path.relative(ROOT, dir)}`);
      }
    }
  }
  process.exit(0);
}

const filter = process.argv[2];
const results = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : {};
fs.mkdirSync(WORK, { recursive: true });

for (const [prefix, sub, framework, extraDeps] of TARGETS) {
  if (filter && !prefix.includes(filter)) continue;
  const id = fs.readdirSync(RAW).find((d) => d.startsWith(prefix));
  if (!id) { results[prefix] = { ok: false, error: "template dir not found" }; continue; }
  const dest = path.join(RAW, id, "static-build");
  if (fs.existsSync(path.join(dest, "index.html"))) { console.log(`skip ${id} (already built)`); continue; }

  const work = path.join(WORK, id);
  const started = Date.now();
  process.stdout.write(`${framework.padEnd(6)} ${id} ... `);
  try {
    fs.rmSync(work, { recursive: true, force: true });
    fs.cpSync(path.join(RAW, id, sub), work, { recursive: true,
      filter: (s) => !/[\\/](node_modules|\.next|\.nuxt|\.output|__MACOSX)([\\/]|$)/.test(s) });
    const outRel = build(framework, work, extraDeps);
    const out = path.join(work, outRel);
    // Some templates redirect "/" to a home variant, so the export has no root page. Use the first variant instead.
    let home = "index.html";
    if (!fs.existsSync(path.join(out, home))) {
      home = ["home", "home1", "home-1", "home-one", "index1", "index-1", "main"]
        .flatMap((n) => [`${n}/index.html`, `${n}.html`]).find((f) => fs.existsSync(path.join(out, f)))
        ?? fs.readdirSync(out).sort().filter((d) => /^index-/.test(d)).map((d) => `${d}/index.html`)
          .find((f) => fs.existsSync(path.join(out, f)));
      if (!home) throw new Error(`build finished but ${outRel} has no index.html or home page`);
    }
    fs.cpSync(out, dest, { recursive: true });
    if (home !== "index.html") fs.copyFileSync(path.join(out, home), path.join(dest, "index.html"));
    relativizeRootPaths(dest);
    results[id] = { ok: true, framework, output: `static-build/ (from ${outRel}, home page ${home})`, seconds: Math.round((Date.now() - started) / 1000) };
    console.log("ok");
  } catch (err) {
    const msg = String(err.stderr || err.stdout || err.message || err).trim().split("\n").slice(-12).join("\n");
    results[id] = { ok: false, framework, error: msg.slice(-1500) };
    console.log("FAILED");
  }
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.writeFileSync(LOG, JSON.stringify(results, null, 2));
}

const ok = Object.values(results).filter((r) => r.ok).length;
console.log(`\n${ok}/${Object.keys(results).length} built. Details: ${path.relative(ROOT, LOG)}`);
