import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import { processTemplate } from './process-template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const RAW_DIR = path.join(REPO_ROOT, 'templates', 'raw');
const PROCESSED_DIR = path.join(REPO_ROOT, 'templates', 'processed');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const ERRORS_LOG = path.join(__dirname, '..', 'errors.log');

const CONCURRENCY = 5;

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Copy .env.example to .env and add your key.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // --template flag for single-template runs: tsx src/index.ts --template agency-pro
  const singleArg = process.argv.indexOf('--template');
  const singleTemplate = singleArg !== -1 ? process.argv[singleArg + 1] : null;

  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });

  let templateIds: string[];

  if (singleTemplate) {
    templateIds = [singleTemplate];
    console.log(`Running single-template mode: ${singleTemplate}`);
  } else {
    const entries = await fs.readdir(RAW_DIR, { withFileTypes: true }).catch(() => {
      console.error(`Error: templates/raw/ directory not found at ${RAW_DIR}`);
      console.error('Create the directory and add your raw HTML templates as subdirectories.');
      process.exit(1);
    });
    templateIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }

  if (templateIds.length === 0) {
    console.log(`No template directories found in ${RAW_DIR}`);
    return;
  }

  console.log(`Found ${templateIds.length} template(s). Tokenizing with concurrency ${CONCURRENCY}...`);
  console.log(`  Input:  ${RAW_DIR}`);
  console.log(`  Output: ${PROCESSED_DIR}`);
  console.log(`  Logs:   ${LOGS_DIR}\n`);

  const limit = pLimit(CONCURRENCY);
  const errors: string[] = [];
  let done = 0;

  await Promise.all(
    templateIds.map((templateId) =>
      limit(async () => {
        const n = ++done;
        const label = `[${n}/${templateIds.length}] ${templateId}`;
        console.log(`  → ${label}`);
        try {
          await processTemplate(client, templateId, RAW_DIR, PROCESSED_DIR, LOGS_DIR);
          console.log(`  ✓ ${label}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const line = `[${new Date().toISOString()}] ${templateId}: ${msg}`;
          errors.push(line);
          console.error(`  ✗ ${label}: ${msg}`);
        }
      }),
    ),
  );

  if (errors.length > 0) {
    await fs.appendFile(ERRORS_LOG, errors.join('\n') + '\n', 'utf-8');
    console.log(`\n${errors.length} error(s) written to ${ERRORS_LOG}`);
  }

  const successCount = templateIds.length - errors.length;
  console.log(`\nDone. ${successCount}/${templateIds.length} templates processed successfully.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
