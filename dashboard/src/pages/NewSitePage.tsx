import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, thumbnailUrl } from '../api/client';
import { CategoryBadge } from '../components/Badge';
import type { Template } from '../types';

type Step = 'template' | 'details';

export function NewSitePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const preselectedId = params.get('template');

  const [step, setStep] = useState<Step>(preselectedId ? 'details' : 'template');
  const [selected, setSelected] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [apiError, setApiError] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: api.templates.list,
  });

  useEffect(() => {
    if (preselectedId && templates.length > 0) {
      const t = templates.find((t) => t.id === preselectedId);
      if (t) setSelected(t);
    }
  }, [preselectedId, templates]);

  useEffect(() => {
    if (!slugManual) {
      setSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      );
    }
  }, [name, slugManual]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.sites.create({ template_id: selected!.id, name, slug }),
    onSuccess: (site) => {
      void qc.invalidateQueries({ queryKey: ['sites'] });
      navigate(`/sites/${site.id}/edit`);
    },
    onError: (err) => {
      setApiError(err instanceof Error ? err.message : 'Failed to create site');
    },
  });

  if (step === 'template') {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="mb-6">
          <Link to="/sites" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Sites
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">New Site</h1>
        <p className="text-sm text-gray-400 mb-8">Pick a template to start from</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelected(t);
                setStep('details');
              }}
              className="group text-left bg-white rounded-xl border-2 border-transparent hover:border-gray-900 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                <img
                  src={thumbnailUrl(t.r2_key, t.name)}
                  alt={t.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">{t.name}</span>
                <CategoryBadge category={t.category} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-6">
        <button
          onClick={() => setStep('template')}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Change Template
        </button>
      </div>

      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Name your Site</h1>
        {selected && (
          <p className="text-sm text-gray-400 mb-8">
            Template:{' '}
            <span className="text-gray-700 font-medium">{selected.name}</span>
          </p>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Site Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Slug
            </label>
            <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-gray-900 bg-white">
              <span className="px-3 py-2 text-sm text-gray-400 font-mono bg-gray-50 border-r border-gray-200 flex-shrink-0">
                bymamstudio-
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugManual(true);
                }}
                placeholder="acme-corp"
                className="flex-1 px-3 py-2 text-sm font-mono focus:outline-none bg-white"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5 font-mono">
              Pages project: bymamstudio-{slug || '…'}
            </p>
          </div>

          {apiError && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              {apiError}
            </div>
          )}

          <button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || !slug.trim() || !selected || createMutation.isPending}
            className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Site →'}
          </button>
        </div>
      </div>
    </div>
  );
}
