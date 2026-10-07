// Renders plain-PHP templates in templates/raw to static HTML so the tokenizer can use them.
//
//   node tokenizer/render-php-templates.mjs [filter]      (needs php on PATH, or PHP_BIN)
//
// For each template: serve the project root with `php -S`, fetch every top-level .php page, and write
// templates/raw/<id>/static-build/ = all non-PHP files (assets) + one .html per page, with links to
// "page.php" rewritten to "page.html". The source folder is only read. Results go to
// tokenizer/logs/php-renders.json.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "templates", "raw");
const LOG = path.join(ROOT, "tokenizer", "logs", "php-renders.json");
const PHP = process.env.PHP_BIN || "php";

// [template id prefix, project root inside the template]
const TARGETS = [
  ["agenko-creative-digital-agency", "agenko-php"],
  ["baosh-digital-agency", "baosh pack/baosh"],
  ["cargon-logistics", "Cargon-PHP_v1.0/Cargon-PHP"],
  ["piku-creative-saas", "Piku_PHP_v1.0.0/Landing/Light"],
  ["xpovio-digital-creative", "buyer-file"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function renderTemplate(id, sub, port) {
  const src = path.join(RAW, id, sub);
  const dest = path.join(RAW, id, "static-build");
  const server = spawn(PHP, ["-S", `127.0.0.1:${port}`, "-t", src], { cwd: src, stdio: "ignore" });
  try {
    for (let i = 0; i < 40; i++) {
      try { await fetch(`http://127.0.0.1:${port}/`); break; } catch { await sleep(250); }
    }
    const pages = fs.readdirSync(src).filter((f) => f.endsWith(".php"));
    const linkRe = new RegExp(`(["'(/])(${pages.map((p) => p.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})(?=[?#"'])`, "g");
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true, filter: (s) => fs.statSync(s).isDirectory() || !s.endsWith(".php") });
    const rendered = [];
    for (const page of pages) {
      const res = await fetch(`http://127.0.0.1:${port}/${page}`);
      let html = await res.text();
      if (!res.ok || !/<html[\s>]/i.test(html)) continue; // skip fragments, mailers, form handlers
      if (/(Fatal error|Parse error|Warning)<\/b>:/.test(html)) throw new Error(`PHP error rendering ${page}: ${html.match(/<b>(?:Fatal error|Parse error|Warning)<\/b>:[^<]*/)[0]}`);
      html = html.replace(linkRe, (_, pre, p) => pre + p.replace(/\.php$/, ".html"));
      fs.writeFileSync(path.join(dest, page.replace(/\.php$/, ".html")), html);
      rendered.push(page);
    }
    if (!fs.existsSync(path.join(dest, "index.html"))) throw new Error("index.php did not render to a full HTML page");
    return rendered;
  } finally {
    server.kill();
  }
}

const filter = process.argv[2];
const results = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : {};
let port = 8710;
for (const [prefix, sub] of TARGETS) {
  if (filter && !prefix.includes(filter)) continue;
  const id = fs.readdirSync(RAW).find((d) => d.startsWith(prefix));
  if (!id) { results[prefix] = { ok: false, error: "template dir not found" }; continue; }
  process.stdout.write(`php    ${id} ... `);
  try {
    const pages = await renderTemplate(id, sub, port++);
    results[id] = { ok: true, framework: "php", output: `static-build/ (${pages.length} pages rendered from ${sub})` };
    console.log(`ok (${pages.length} pages)`);
  } catch (err) {
    results[id] = { ok: false, framework: "php", error: String(err.message || err).slice(0, 1500) };
    console.log("FAILED");
  }
}
fs.mkdirSync(path.dirname(LOG), { recursive: true });
fs.writeFileSync(LOG, JSON.stringify(results, null, 2));
