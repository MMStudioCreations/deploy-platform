import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL = 'claude-sonnet-4-6';
const CONCURRENCY = 1;
const MAX_RETRIES = 5;
const RETRY_WAIT_MS = 65_000; // 65s clears the per-minute output token bucket
const ERRORS_LOG = path.join(__dirname, 'errors.log');

// 'api' (default) bills the Anthropic API key; 'claude-cli' runs each template through
// `claude -p` on the logged-in Claude subscription instead (no API credits needed).
const BACKEND = process.env.TOKENIZER_BACKEND ?? 'api';
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude.exe';
const CLI_TIMEOUT_MS = 15 * 60_000;
const CLI_LIMIT_WAIT_MS = 30 * 60_000; // fallback when a usage-limit message has no reset time

const SYSTEM_PROMPT = `You are a web template analyst. Given raw HTML, identify all human-editable content zones and return a schema only — do NOT echo back the HTML.

Return ONLY valid JSON: { "schema": { "sections": [...] } }

Each section: { "name": string, "fields": [...] }
Each field: { "key": "snake_case", "type": "text|textarea|image|url|color|phone|email", "label": string, "placeholder": string }

Required base tokens every schema must include:
- business_name (text)
- tagline (text)
- phone (phone)
- email (email)
- address (textarea)
- logo (image)
- primary_color (color)
- secondary_color (color)
- hero_title (text)
- hero_subtitle (text)
- cta_label (text)`;

const CATEGORY_MAP = {
  restaurant:   ['restaurant', 'food', 'cafe', 'bistro', 'dining', 'pizza', 'bakery', 'kitchen', 'catering'],
  agency:       ['agency', 'creative', 'digital', 'marketing', 'studio', 'branding', 'design'],
  portfolio:    ['portfolio', 'personal', 'resume', 'cv', 'freelance'],
  medical:      ['medical', 'clinic', 'health', 'dental', 'doctor', 'hospital', 'wellness', 'pharmacy'],
  'real-estate':['realty', 'real-estate', 'property', 'homes', 'housing', 'realtor', 'estate'],
  fitness:      ['fitness', 'gym', 'yoga', 'sport', 'crossfit', 'training', 'coach'],
  corporate:    ['corporate', 'business', 'consulting', 'finance', 'law', 'legal', 'accounting'],
  ecommerce:    ['shop', 'store', 'ecommerce', 'product', 'commerce', 'boutique'],
  salon:        ['salon', 'beauty', 'spa', 'hair', 'nail', 'barber', 'grooming'],
  blog:         ['blog', 'magazine', 'news', 'journal', 'editorial'],
  construction: ['construction', 'builder', 'contractor', 'architect', 'renovation'],
  education:    ['school', 'education', 'academy', 'tutor', 'course', 'university'],
};

function inferCategory(id) {
  const lower = id.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return 'general';
}

function idToName(id) {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

const SKIP_DIRS = /[\\/](__MACOSX|[Dd]ocumentation|[Dd]ocs|[Dd]oc|node_modules|vendors?|libs?|fonts?|templates|views|_layouts|_includes|_site)[\\/]/;
const MAX_DEPTH = 6;
// Fallback homepage names, in priority order, tried when no index.html exists
const HOME_NAMES = ['home.html', 'index-1.html', 'index1.html', 'index-2.html', 'index2.html', 'landing.html', 'main.html', 'demo.html'];
const DOC_NAMES = /^(documentation|changelog|credits?|readme|license|online docs)\b/i;
// Server-side template markers: Django/Jinja/Twig/Liquid tags, PHP, Blade directives
const SERVER_TEMPLATE = /\{%[\s\S]*?%\}|<\?php|@(extends|section|yield|include)\s*\(/;

async function isStaticHtml(file) {
  if (!/\.html?$/i.test(file) || /\.(blade|twig|jinja2?|j2|liquid|php)\./i.test(path.basename(file))) return false;
  let html;
  try { html = await fs.readFile(file, 'utf-8'); } catch { return false; }
  if (!/<(html|body)[\s>]/i.test(html)) return false;
  return !SERVER_TEMPLATE.test(html);
}

async function findIndexHtml(templateDir) {
  // 0. A static export made by build-framework-templates.mjs / render-php-templates.mjs wins
  const built = path.join(templateDir, 'static-build', 'index.html');
  if (await isStaticHtml(built)) return built;

  // Collect candidate .html files in depth-first order, skipping docs/vendor/server-template dirs
  const files = [];
  async function walk(dir, depth) {
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() && /\.html?$/i.test(e.name) && !DOC_NAMES.test(e.name)) {
        files.push({ file: path.join(dir, e.name), name: e.name.toLowerCase(), depth });
      }
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const sub = path.join(dir, entry.name);
      // Test only the part inside the template, so the repo's own templates/ dir doesn't match
      if (SKIP_DIRS.test(path.sep + path.relative(templateDir, sub) + path.sep)) continue;
      await walk(sub, depth + 1);
    }
  }
  await walk(templateDir, 0);

  // 1. index.html anywhere (first in depth-first order, as before)
  for (const c of files) {
    if (c.name === 'index.html' && await isStaticHtml(c.file)) return c.file;
  }
  // 2. Common homepage names, then index-<variant>.html; shallowest first, light/LTR variants first
  const rank = (c) => {
    const i = HOME_NAMES.indexOf(c.name);
    if (i !== -1) return i;
    return /^index[-_]?[\w-]+\.html?$/.test(c.name) ? HOME_NAMES.length + (/dark|rtl/.test(c.name) ? 1 : 0) : -1;
  };
  const ranked = files
    .filter((c) => rank(c) !== -1)
    .sort((a, b) => a.depth - b.depth || rank(a) - rank(b) || a.name.localeCompare(b.name));
  for (const c of ranked) {
    if (await isStaticHtml(c.file)) return c.file;
  }
  return null;
}

async function copyAssets(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name === 'index.html') return;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await copyAssets(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }),
  );
}

async function callWithRetry(client, params) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      const is429 = err?.status === 429 || /rate.limit/i.test(err?.message ?? '');
      if (is429 && attempt < MAX_RETRIES) {
        const wait = RETRY_WAIT_MS * attempt;
        process.stdout.write(`\n  ⏳ rate-limited, waiting ${wait / 1000}s (attempt ${attempt}/${MAX_RETRIES}) ... `);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

function runClaudeCli(input) {
  // Template HTML is third-party content, so the run gets no tools, no MCP servers and no
  // user/project settings (which also keeps hooks such as claude-mem out of these sessions).
  const args = [
    '-p', '--tools', '', '--strict-mcp-config', '--setting-sources', '',
    '--no-session-persistence', '--model', 'sonnet',
    '--system-prompt', SYSTEM_PROMPT, '--output-format', 'text',
  ];
  // The CLI backend runs on the claude.ai login; an ANTHROPIC_API_KEY loaded from .env would override it.
  const { ANTHROPIC_API_KEY: _apiKey, ...env } = process.env;
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, {
      env: { ...env, CLAUDE_CODE_MAX_OUTPUT_TOKENS: '32000' },
      windowsHide: true,
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('claude CLI timed out')); }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exited ${code}: ${(err || out).slice(0, 300)}`));
      resolve(out);
    });
    child.stdin.end(input);
  });
}

function msUntilReset(text) {
  const m = text.match(/resets\s+(\d{1,2})(?::(\d{2}))?\s*([ap]m)/i);
  if (!m) return CLI_LIMIT_WAIT_MS;
  const reset = new Date();
  let hour = Number(m[1]) % 12 + (m[3].toLowerCase() === 'pm' ? 12 : 0);
  reset.setHours(hour, Number(m[2] ?? 0) + 5, 0, 0);
  if (reset <= new Date()) reset.setDate(reset.getDate() + 1);
  return reset - new Date();
}

async function callClaudeCliWithRetry(input) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let text;
    try {
      text = await runClaudeCli(input);
    } catch (err) {
      text = err.message;
      if (!/limit/i.test(text)) throw err;
    }
    if (!/(session|usage|rate) limit|hit your limit/i.test(text)) return text;
    if (attempt === MAX_RETRIES) throw new Error(`usage limit: ${text.slice(0, 200)}`);
    const wait = msUntilReset(text);
    process.stdout.write(`\n  ⏳ usage limit, waiting ${Math.round(wait / 60_000)} min ... `);
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function processTemplate(client, templateId, inputDir, outputDir) {
  const templateDir = path.join(inputDir, templateId);
  const indexPath = await findIndexHtml(templateDir);
  if (!indexPath) throw new Error('No usable index.html found');
  const html = await fs.readFile(indexPath, 'utf-8');

  let raw;
  if (BACKEND === 'claude-cli') {
    raw = await callClaudeCliWithRetry(`Template ID: "${templateId}"\n\n${html}`);
  } else {
  const response = await callWithRetry(client, {
    model: MODEL,
    max_tokens: 16384,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: `Template ID: "${templateId}"\n\n${html}` }],
  });

  raw = response.content.find((b) => b.type === 'text')?.text ?? '';
  }
  const parsed = JSON.parse(extractJSON(raw));

  if (!Array.isArray(parsed.schema?.sections)) {
    throw new Error('Response missing required schema.sections');
  }

  const outDir = path.join(outputDir, templateId);
  await fs.mkdir(outDir, { recursive: true });
  await copyAssets(path.dirname(indexPath), outDir);

  // Store original HTML as-is; token substitution happens at inject time
  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf-8');

  const schema = {
    template_id: templateId,
    name: idToName(templateId),
    category: inferCategory(templateId),
    sections: parsed.schema.sections,
  };
  await fs.writeFile(path.join(outDir, 'schema.json'), JSON.stringify(schema, null, 2), 'utf-8');

  return schema;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  return {
    inputDir:  get('--input')  ?? './templates/raw',
    outputDir: get('--output') ?? './templates/processed',
  };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (BACKEND !== 'claude-cli' && !apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set. Copy tokenizer/.env.example to tokenizer/.env');
    process.exit(1);
  }

  const { inputDir, outputDir } = parseArgs(process.argv);
  const resolvedInput  = path.resolve(inputDir);
  const resolvedOutput = path.resolve(outputDir);

  console.log(`Input:  ${resolvedInput}`);
  console.log(`Output: ${resolvedOutput}`);

  const entries = await fs.readdir(resolvedInput, { withFileTypes: true }).catch(() => {
    console.error(`Input directory not found: ${resolvedInput}`);
    process.exit(1);
  });

  const templateIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (templateIds.length === 0) { console.log('No template directories found.'); return; }

  console.log(`\nFound ${templateIds.length} templates. Concurrency: ${CONCURRENCY}. Backend: ${BACKEND}\n`);

  const client = BACKEND === 'claude-cli' ? null : new Anthropic({ apiKey });
  const limit  = pLimit(CONCURRENCY);
  const manifest = [];
  const errors   = [];
  let done = 0;
  let skipped = 0;

  await Promise.all(
    templateIds.map((id) =>
      limit(async () => {
        const n = ++done;
        const schemaPath = path.join(resolvedOutput, id, 'schema.json');

        // Resume: skip templates already successfully processed
        const existing = await fs.readFile(schemaPath, 'utf-8').catch(() => null);
        if (existing) {
          try {
            const schema = JSON.parse(existing);
            const rel = (p) => path.relative(path.dirname(resolvedOutput), p).replace(/\\/g, '/');
            manifest.push({
              id,
              name:     schema.name,
              category: schema.category,
              preview:  rel(path.join(resolvedOutput, id, 'index.html')),
              schema:   rel(schemaPath),
            });
            skipped++;
            console.log(`[${n}/${templateIds.length}] ${id} ... ⏭  (already done)`);
            return;
          } catch { /* fall through and reprocess */ }
        }

        process.stdout.write(`[${n}/${templateIds.length}] ${id} ... `);
        try {
          const schema = await processTemplate(client, id, resolvedInput, resolvedOutput);
          const rel = (p) =>
            path.relative(path.dirname(resolvedOutput), p).replace(/\\/g, '/');
          manifest.push({
            id,
            name:     schema.name,
            category: schema.category,
            preview:  rel(path.join(resolvedOutput, id, 'index.html')),
            schema:   rel(path.join(resolvedOutput, id, 'schema.json')),
          });
          console.log(`✓  (${schema.sections.length} sections)`);
        } catch (err) {
          const msg = err?.message ?? String(err);
          errors.push(`[${new Date().toISOString()}] ${id}: ${msg}`);
          console.log(`✗  ${msg}`);
        }
      }),
    ),
  );

  manifest.sort((a, b) => a.id.localeCompare(b.id));
  const manifestPath = path.join(path.dirname(resolvedOutput), 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\nManifest → ${manifestPath}  (${manifest.length} entries)`);

  if (errors.length > 0) {
    await fs.appendFile(ERRORS_LOG, errors.join('\n') + '\n', 'utf-8');
    console.log(`Errors  → ${ERRORS_LOG}  (${errors.length})`);
  }

  const ok = manifest.length;
  console.log(`\n${ok}/${templateIds.length} templates succeeded (${skipped} already done, ${templateIds.length - ok - errors.length} no-html).`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
