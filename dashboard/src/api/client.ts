import type { Template, Site } from '../types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.bymamstudio.com';
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? '';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Email': ADMIN_EMAIL,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  templates: {
    list: () => apiFetch<Template[]>('/templates'),
    get: (id: string) => apiFetch<Template>(`/templates/${id}`),
  },
  sites: {
    list: () => apiFetch<Site[]>('/sites'),
    get: (id: string) => apiFetch<Site>(`/sites/${id}`),
    create: (body: { template_id: string; name: string; slug: string }) =>
      apiFetch<Site>('/sites', { method: 'POST', body: JSON.stringify(body) }),
    saveContent: (id: string, content: Record<string, string>) =>
      apiFetch<{ success: boolean; updated_at: number }>(`/sites/${id}/content`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    publish: (id: string) =>
      apiFetch<{ success: boolean; project: string; deployment_id: string }>(
        `/sites/${id}/publish`,
        { method: 'POST' },
      ),
    previewUrl: (id: string) => `${BASE}/sites/${id}/preview`,
  },
};

export const R2_PUBLIC = (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ?? '';

export function thumbnailUrl(r2Key: string, name: string): string {
  const key = r2Key.replace(/index\.html$/, 'preview.jpg');
  if (R2_PUBLIC) return `${R2_PUBLIC}/${key}`;
  return `https://placehold.co/400x300/f3f4f6/9ca3af?text=${encodeURIComponent(name)}`;
}
