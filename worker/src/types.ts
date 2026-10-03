export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  ANTHROPIC_API_KEY: string;
  ADMIN_EMAIL: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  category: string;
  preview_url: string | null;
  schema: string;
  r2_key: string;
  created_at: number;
}

export interface SiteRow {
  id: string;
  template_id: string;
  name: string;
  domain: string | null;
  subdomain: string | null;
  status: 'draft' | 'published';
  cf_pages_id: string | null;
  github_repo: string | null;
  created_at: number;
  updated_at: number;
}

export interface ContentRow {
  site_id: string;
  data: string;
  updated_at: number;
}

export interface CreateSiteBody {
  template_id: string;
  name: string;
}

export interface SaveContentBody {
  content: Record<string, string>;
}

export interface AddDomainBody {
  domain: string;
}
