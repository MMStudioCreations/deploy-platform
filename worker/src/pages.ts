// Cloudflare Pages API — project lifecycle and custom domain management

interface CFResult<T> {
  success: boolean;
  result: T;
  errors?: Array<{ message: string }>;
}

interface PagesProjectResult {
  id: string;
  name: string;
  subdomain: string;
}

interface DeploymentResult {
  id: string;
}

interface DomainResult {
  name: string;
  status: string;
}

export interface PagesProject {
  id: string;
  name: string;
  subdomain: string;
}

export interface DnsInstructions {
  type: 'CNAME';
  name: string;
  value: string;
  note: string;
}

function cfAuth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * Get or create a CF Pages project backed by a GitHub repo.
 *
 * PREREQUISITE: The Cloudflare Pages GitHub App must be installed on `githubOwner`'s
 * account before this call will succeed for new projects. Install it at:
 * https://github.com/apps/cloudflare-pages
 */
export async function ensurePagesProject(
  accountId: string,
  apiToken: string,
  projectName: string,
  githubOwner: string,
  repoName: string,
): Promise<PagesProject> {
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
  const auth = cfAuth(apiToken);

  // Return early if project already exists
  const checkRes = await fetch(`${base}/${projectName}`, { headers: auth });
  if (checkRes.ok) {
    const existing = await checkRes.json() as CFResult<PagesProjectResult>;
    return existing.result;
  }

  const createRes = await fetch(base, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
      source: {
        type: 'github',
        config: {
          owner: githubOwner,
          repo_name: repoName,
          production_branch: 'main',
          pr_comments_enabled: false,
          deployments_enabled: true,
        },
      },
      build_config: {
        build_command: '',
        destination_dir: '/',
        root_dir: '/',
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Pages project creation failed: ${await createRes.text()}`);
  }

  const data = await createRes.json() as CFResult<PagesProjectResult>;
  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join(', ') ?? 'unknown error';
    throw new Error(`Pages project creation failed: ${msg}`);
  }

  return data.result;
}

/**
 * Trigger a Pages deployment from the current HEAD of the production branch.
 * Returns the deployment ID, or 'auto' if the API doesn't support direct triggers.
 */
export async function triggerDeployment(
  accountId: string,
  apiToken: string,
  projectName: string,
): Promise<string> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { ...cfAuth(apiToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch: 'main' }),
  });

  if (!res.ok) {
    // CF Pages may auto-deploy from the GitHub push; treat as non-fatal
    console.warn(`Deployment trigger returned ${res.status} — CF will auto-deploy from GitHub push`);
    return 'auto';
  }

  const data = await res.json() as CFResult<DeploymentResult>;
  return data.result?.id ?? 'auto';
}

/**
 * Add a custom domain to an existing Pages project.
 * Returns the domain status + DNS instructions for the user.
 */
export async function addCustomDomain(
  accountId: string,
  apiToken: string,
  projectName: string,
  domain: string,
): Promise<{ status: string; dns: DnsInstructions }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/domains`;

  const res = await fetch(url, {
    method: 'POST',
    headers: cfAuth(apiToken),
    body: JSON.stringify({ name: domain }),
  });

  if (!res.ok) {
    const body = await res.text();
    // 409 = domain already added — treat as success
    if (res.status !== 409) throw new Error(`Custom domain failed: ${body}`);
  }

  const data = res.ok ? (await res.json() as CFResult<DomainResult>) : { result: { status: 'active' } };

  const isApex = domain.split('.').length === 2;

  return {
    status: data.result?.status ?? 'pending',
    dns: {
      type: 'CNAME',
      name: domain,
      value: `${projectName}.pages.dev`,
      note: isApex
        ? 'Apex domain: enable Cloudflare proxy (orange cloud) on a CNAME, or use ALIAS/ANAME record with your DNS provider.'
        : `Add a CNAME record pointing ${domain} → ${projectName}.pages.dev`,
    },
  };
}
