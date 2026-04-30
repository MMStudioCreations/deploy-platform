import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SYSTEM_PROMPT, BASE_FIELDS, buildTokenizeTool } from './prompt.js';
import type { TemplateSchema, TokenizeResult, ProcessingLog } from './types.js';

const MAX_CSS_FILES = 5;
const MAX_CSS_SIZE_BYTES = 150_000;

export async function processTemplate(
  client: Anthropic,
  templateId: string,
  rawDir: string,
  processedDir: string,
  logsDir: string,
): Promise<void> {
  const start = Date.now();
  const templateRawDir = path.join(rawDir, templateId);
  const templateProcessedDir = path.join(processedDir, templateId);
  const log: ProcessingLog = {
    template_id: templateId,
    status: 'success',
    timestamp: new Date().toISOString(),
    duration_ms: 0,
  };

  try {
    const htmlPath = path.join(templateRawDir, 'index.html');
    const html = await fs.readFile(htmlPath, 'utf-8');

    const cssFiles = await discoverCSSFiles(html, templateRawDir);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16384,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // Prompt caching: system prompt is reused across all 165 template calls
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [buildTokenizeTool()],
      tool_choice: { type: 'tool', name: 'tokenize_template' },
      messages: [
        {
          role: 'user',
          content: buildUserMessage(templateId, html, cssFiles),
        },
      ],
    });

    log.input_tokens = response.usage.input_tokens;
    log.output_tokens = response.usage.output_tokens;

    const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new Error('Claude did not return a tool_use block');
    }

    const result = toolUseBlock.input as TokenizeResult;

    if (!result.html || !result.schema) {
      throw new Error('Tool result missing required html or schema fields');
    }

    ensureBaseFields(result.schema);

    // Copy full raw directory to processed (preserves assets, fonts, js)
    await copyDir(templateRawDir, templateProcessedDir);

    // Overwrite with tokenized HTML
    await fs.writeFile(path.join(templateProcessedDir, 'index.html'), result.html, 'utf-8');

    // Overwrite tokenized CSS files
    for (const cssFile of result.css_files ?? []) {
      const destPath = path.join(templateProcessedDir, cssFile.filename);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, cssFile.content, 'utf-8');
    }

    // Write schema
    await fs.writeFile(
      path.join(templateProcessedDir, 'schema.json'),
      JSON.stringify(result.schema, null, 2),
      'utf-8',
    );

    const totalFields = result.schema.sections.reduce((sum, s) => sum + s.fields.length, 0);
    log.fields_count = totalFields;
    log.sections_count = result.schema.sections.length;
  } catch (err) {
    log.status = 'error';
    log.error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    log.duration_ms = Date.now() - start;
    await fs.mkdir(logsDir, { recursive: true });
    await fs.writeFile(
      path.join(logsDir, `${templateId}.json`),
      JSON.stringify(log, null, 2),
      'utf-8',
    );
  }
}

function buildUserMessage(
  templateId: string,
  html: string,
  cssFiles: Array<{ filename: string; content: string }>,
): string {
  const parts: string[] = [`Tokenize this template.\n\nTemplate ID: "${templateId}"\n`, `=== index.html ===\n${html}`];
  for (const css of cssFiles) {
    parts.push(`\n=== ${css.filename} ===\n${css.content}`);
  }
  return parts.join('\n');
}

async function discoverCSSFiles(
  html: string,
  templateDir: string,
): Promise<Array<{ filename: string; content: string }>> {
  const results: Array<{ filename: string; content: string }> = [];
  const seen = new Set<string>();

  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html)) !== null && results.length < MAX_CSS_FILES) {
    const href = match[1];
    if (href.startsWith('http') || href.startsWith('//') || seen.has(href)) continue;
    seen.add(href);

    const cssPath = path.join(templateDir, href);
    try {
      const stat = await fs.stat(cssPath);
      if (stat.size > MAX_CSS_SIZE_BYTES) continue; // skip very large CSS files
      const content = await fs.readFile(cssPath, 'utf-8');
      results.push({ filename: href, content });
    } catch {
      // file not found or unreadable, skip
    }
  }

  return results;
}

function ensureBaseFields(schema: TemplateSchema): void {
  const existingKeys = new Set(schema.sections.flatMap((s) => s.fields.map((f) => f.key)));

  const missing = BASE_FIELDS.filter((f) => !existingKeys.has(f.key));
  if (missing.length === 0) return;

  // Group missing fields by their section hint
  const bySection = new Map<string, typeof missing>();
  for (const field of missing) {
    const sectionId = field.section_hint;
    if (!bySection.has(sectionId)) bySection.set(sectionId, []);
    bySection.get(sectionId)!.push(field);
  }

  for (const [sectionId, fields] of bySection) {
    const existing = schema.sections.find((s) => s.id === sectionId);
    const fieldDefs = fields.map(({ section_hint: _, ...f }) => f);

    if (existing) {
      existing.fields.unshift(...fieldDefs);
    } else {
      const label = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      // Insert 'general' at the front, others at back
      if (sectionId === 'general') {
        schema.sections.unshift({ id: sectionId, label, fields: fieldDefs });
      } else {
        schema.sections.push({ id: sectionId, label, fields: fieldDefs });
      }
    }
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      return entry.isDirectory() ? copyDir(srcPath, destPath) : fs.copyFile(srcPath, destPath);
    }),
  );
}
