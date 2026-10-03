import type { Env } from './types';

export function injectContent(html: string, content: Record<string, string>): string {
  return html.replace(/\{\{([a-z0-9_]+)\}\}/gi, (match, token: string) => {
    return Object.prototype.hasOwnProperty.call(content, token) ? content[token] : match;
  });
}

export async function getRenderedHtml(
  env: Env,
  r2Key: string,
  content: Record<string, string>,
): Promise<string> {
  const obj = await env.BUCKET.get(r2Key);
  if (!obj) throw new Error(`Template not found in R2: ${r2Key}`);
  const html = await obj.text();
  return injectContent(html, content);
}

export interface TemplateFile {
  path: string;
  content: Uint8Array;
}

/**
 * List every file in the template folder in R2, inject content into HTML files,
 * and return them as raw byte arrays ready to push to GitHub.
 */
export async function listAllTemplateFiles(
  bucket: R2Bucket,
  r2Key: string,
  content: Record<string, string>,
): Promise<TemplateFile[]> {
  const prefix = r2Key.slice(0, r2Key.lastIndexOf('/') + 1);
  const objects: R2Object[] = [];

  let cursor: string | undefined;
  do {
    const listing = await bucket.list({ prefix, cursor });
    objects.push(...listing.objects);
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  const files: TemplateFile[] = [];

  for (const obj of objects) {
    const relativePath = obj.key.slice(prefix.length);
    if (!relativePath) continue;

    const item = await bucket.get(obj.key);
    if (!item) continue;

    const bytes = new Uint8Array(await item.arrayBuffer());

    if (obj.key.endsWith('.html') || obj.key.endsWith('.htm')) {
      const html = new TextDecoder().decode(bytes);
      files.push({ path: relativePath, content: new TextEncoder().encode(injectContent(html, content)) });
    } else {
      files.push({ path: relativePath, content: bytes });
    }
  }

  if (files.length === 0) throw new Error(`No template files found in R2 at prefix: ${prefix}`);
  return files;
}
