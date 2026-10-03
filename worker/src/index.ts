import { Hono } from 'hono';
import type { Env, CreateSiteBody, SaveContentBody, AddDomainBody, TemplateRow, SiteRow } from './types';
import { adminAuth } from './auth';
import { getRenderedHtml, listAllTemplateFiles } from './inject';
import { ensureGithubRepo, pushFilesToRepo } from './github';
import { ensurePagesProject, triggerDeployment, addCustomDomain } from './pages';

const app = new Hono<{ Bindings: Env }>();

app.use('*', adminAuth);

function toProjectName(name: string): string {
  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `bymamstudio-${safe}`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

app.get('/templates', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, category, preview_url, r2_key, created_at FROM templates ORDER BY created_at DESC',
  ).all<Omit<TemplateRow, 'schema'>>();
  return c.json(results);
});

app.get('/templates/:id', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT * FROM templates WHERE id = ?',
  ).bind(c.req.param('id')).first<TemplateRow>();

  if (!row) return c.json({ error: 'Template not found' }, 404);

  const { schema, ...rest } = row;
  return c.json({ ...rest, schema: JSON.parse(schema) });
});

// ─── Sites ────────────────────────────────────────────────────────────────────

app.post('/sites', async (c) => {
  const body = await c.req.json<CreateSiteBody>();
  const { template_id, name } = body ?? {};

  if (!template_id || !name) {
    return c.json({ error: 'template_id and name are required' }, 400);
  }

  const template = await c.env.DB.prepare(
    'SELECT id FROM templates WHERE id = ?',
  ).bind(template_id).first();
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const id = crypto.randomUUID();
  const now = Date.now();

  await c.env.DB.prepare(
    'INSERT INTO sites (id, template_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, template_id, name, now, now).run();

  return c.json({ id, template_id, name, status: 'draft', created_at: now, updated_at: now }, 201);
});

app.get('/sites', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.template_id, s.name, s.domain, s.subdomain,
           s.status, s.cf_pages_id, s.github_repo,
           s.created_at, s.updated_at,
           t.name AS template_name, t.category
    FROM sites s
    JOIN templates t ON t.id = s.template_id
    ORDER BY s.created_at DESC
  `).all();
  return c.json(results);
});

app.get('/sites/:id', async (c) => {
  const row = await c.env.DB.prepare(`
    SELECT s.id, s.template_id, s.name, s.domain, s.subdomain,
           s.status, s.cf_pages_id, s.github_repo,
           s.created_at, s.updated_at,
           t.name AS template_name, t.category,
           c.data AS content_data
    FROM sites s
    JOIN templates t ON t.id = s.template_id
    LEFT JOIN content c ON c.site_id = s.id
    WHERE s.id = ?
  `).bind(c.req.param('id')).first<SiteRow & { template_name: string; category: string; content_data: string | null }>();

  if (!row) return c.json({ error: 'Site not found' }, 404);

  const { content_data, ...rest } = row;
  return c.json({ ...rest, content: content_data ? JSON.parse(content_data) : null });
});

// ─── Content ──────────────────────────────────────────────────────────────────

app.put('/sites/:id/content', async (c) => {
  const siteId = c.req.param('id');
  const body = await c.req.json<SaveContentBody>();

  if (!body?.content || typeof body.content !== 'object' || Array.isArray(body.content)) {
    return c.json({ error: 'body.content must be a key-value object' }, 400);
  }

  const site = await c.env.DB.prepare(
    'SELECT id FROM sites WHERE id = ?',
  ).bind(siteId).first();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO content (site_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (site_id)
    DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).bind(siteId, JSON.stringify(body.content), now).run();

  await c.env.DB.prepare(
    'UPDATE sites SET updated_at = ? WHERE id = ?',
  ).bind(now, siteId).run();

  return c.json({ success: true, updated_at: now });
});

// ─── Publish ──────────────────────────────────────────────────────────────────

app.post('/sites/:id/publish', async (c) => {
  const siteId = c.req.param('id');

  const row = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.domain, s.subdomain, s.github_repo,
           t.r2_key, c.data
    FROM sites s
    JOIN templates t ON t.id = s.template_id
    LEFT JOIN content c ON c.site_id = s.id
    WHERE s.id = ?
  `).bind(siteId).first<{
    id: string;
    name: string;
    domain: string | null;
    subdomain: string | null;
    github_repo: string | null;
    r2_key: string;
    data: string | null;
  }>();

  if (!row) return c.json({ error: 'Site not found' }, 404);
  if (!row.data) {
    return c.json({ error: 'No content saved — call PUT /sites/:id/content first' }, 400);
  }

  const content = JSON.parse(row.data) as Record<string, string>;

  // 1. Pull every file from the R2 template folder, injecting content into HTML
  const files = await listAllTemplateFiles(c.env.BUCKET, row.r2_key, content);

  // 2. Create the GitHub repo (idempotent) and push the full template
  const repoName = row.github_repo ?? `mam-${siteId}`;
  await ensureGithubRepo(c.env.CF_GITHUB_TOKEN, c.env.GITHUB_OWNER, repoName);
  await pushFilesToRepo(
    c.env.CF_GITHUB_TOKEN,
    c.env.GITHUB_OWNER,
    repoName,
    files,
    `Deploy ${row.name} — ${new Date().toISOString()}`,
  );

  // 3. Create (or retrieve) the CF Pages project linked to the GitHub repo
  const projectName = row.subdomain ?? toProjectName(row.name);
  const pagesProject = await ensurePagesProject(
    c.env.CF_ACCOUNT_ID,
    c.env.CF_API_TOKEN,
    projectName,
    c.env.GITHUB_OWNER,
    repoName,
  );

  // 4. Trigger deployment (CF also auto-deploys from the GitHub push)
  const deploymentId = await triggerDeployment(c.env.CF_ACCOUNT_ID, c.env.CF_API_TOKEN, projectName);

  // 5. Attach custom domain if already configured on the site record
  let domainResult: Awaited<ReturnType<typeof addCustomDomain>> | null = null;
  if (row.domain) {
    domainResult = await addCustomDomain(
      c.env.CF_ACCOUNT_ID,
      c.env.CF_API_TOKEN,
      projectName,
      row.domain,
    );
  }

  // 6. Persist to D1
  const now = Date.now();
  await c.env.DB.prepare(`
    UPDATE sites
    SET github_repo = ?,
        subdomain   = ?,
        cf_pages_id = ?,
        status      = 'published',
        updated_at  = ?
    WHERE id = ?
  `).bind(repoName, projectName, pagesProject.id, now, siteId).run();

  return c.json({
    success: true,
    github_repo: `${c.env.GITHUB_OWNER}/${repoName}`,
    subdomain: projectName,
    cf_pages_id: pagesProject.id,
    deployment_id: deploymentId,
    url: `https://${pagesProject.subdomain}`,
    ...(domainResult ? { domain: row.domain, domain_status: domainResult.status, dns: domainResult.dns } : {}),
  });
});

// ─── Domain ───────────────────────────────────────────────────────────────────

app.post('/sites/:id/domain', async (c) => {
  const siteId = c.req.param('id');
  const body = await c.req.json<AddDomainBody>();

  const domain = body?.domain?.trim().toLowerCase();
  if (!domain) return c.json({ error: 'domain is required' }, 400);

  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return c.json({ error: 'Invalid domain format (e.g. example.com or sub.example.com)' }, 400);
  }

  const site = await c.env.DB.prepare(
    'SELECT id, subdomain FROM sites WHERE id = ?',
  ).bind(siteId).first<{ id: string; subdomain: string | null }>();

  if (!site) return c.json({ error: 'Site not found' }, 404);
  if (!site.subdomain) {
    return c.json({ error: 'Site must be published before adding a custom domain' }, 400);
  }

  const result = await addCustomDomain(
    c.env.CF_ACCOUNT_ID,
    c.env.CF_API_TOKEN,
    site.subdomain,
    domain,
  );

  const now = Date.now();
  await c.env.DB.prepare(
    'UPDATE sites SET domain = ?, updated_at = ? WHERE id = ?',
  ).bind(domain, now, siteId).run();

  return c.json({
    success: true,
    domain,
    subdomain: site.subdomain,
    status: result.status,
    dns_instructions: result.dns,
  });
});

// ─── Preview ──────────────────────────────────────────────────────────────────

app.get('/sites/:id/preview', async (c) => {
  const siteId = c.req.param('id');

  const row = await c.env.DB.prepare(`
    SELECT t.r2_key, c.data
    FROM sites s
    JOIN templates t ON t.id = s.template_id
    LEFT JOIN content c ON c.site_id = s.id
    WHERE s.id = ?
  `).bind(siteId).first<{ r2_key: string; data: string | null }>();

  if (!row) return c.json({ error: 'Site not found' }, 404);

  const content = row.data ? (JSON.parse(row.data) as Record<string, string>) : {};
  const html = await getRenderedHtml(c.env, row.r2_key, content);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

export default app;
