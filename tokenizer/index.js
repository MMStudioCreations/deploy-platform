import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL = 'claude-sonnet-4-20250514';
const CONCURRENCY = 5;
const ERRORS_LOG = path.join(__dirname, 'errors.log');

const SYSTEM_PROMPT = `You are a web template analyst. Given raw HTML, identify all human-editable content zones and return:
1. A tokenized version of the HTML where editable text/images/links/colors are replaced with {{snake_case_token}} placeholders
2. A schema.json defining each token with: key, type (text|textarea|image|url|color|phone|email), label, placeholder, and section grouping

Return ONLY valid JSON: { "html": "...", "schema": { "sections": [...] } }

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

async function copyAssets(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name === 'index.html') return; // overwritten by tokenized version
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

async function processTemplate(client, templateId, inputDir, outputDir) {
  const html = await fs.readFile(path.join(inputDir, templateId, 'index.html'), 'utf-8');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }, // reused across all 165 calls
      },
    ],
    messages: [{ role: 'user', content: `Template ID: "${templateId}"\n\n${html}` }],
  });

  const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
  const parsed = JSON.parse(extractJSON(raw));

  if (!parsed.html || !Array.isArray(parsed.schema?.sections)) {
    throw new Error('Response missing required html or schema.sections');
  }

  const outDir = path.join(outputDir, templateId);
  await fs.mkdir(outDir, { recursive: true });
  await copyAssets(path.join(inputDir, templateId), outDir);

  await fs.writeFile(path.join(outDir, 'index.html'), parsed.html, 'utf-8');

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
  if (!apiKey) {
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

  console.log(`\nFound ${templateIds.length} templates. Concurrency: ${CONCURRENCY}\n`);

  const client = new Anthropic({ apiKey });
  const limit  = pLimit(CONCURRENCY);
  const manifest = [];
  const errors   = [];
  let done = 0;

  await Promise.all(
    templateIds.map((id) =>
      limit(async () => {
        const n = ++done;
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

  const ok = templateIds.length - errors.length;
  console.log(`\n${ok}/${templateIds.length} templates succeeded.`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
