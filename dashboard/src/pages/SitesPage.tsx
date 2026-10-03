import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { CategoryBadge, StatusBadge } from '../components/Badge';

export function SitesPage() {
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: api.sites.list,
  });

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sites</h1>
          <p className="text-sm text-gray-400 mt-1 font-mono">{sites.length} sites</p>
        </div>
        <Link
          to="/sites/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          + New Site
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-400 text-sm mb-3">No sites yet.</p>
          <Link
            to="/sites/new"
            className="text-sm font-medium text-gray-900 hover:underline"
          >
            Create your first site →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sites.map((site) => (
            <div
              key={site.id}
              className="flex items-center justify-between px-5 py-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{site.name}</span>
                    {site.category && <CategoryBadge category={site.category} />}
                    <StatusBadge live={!!site.cf_pages_project} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400 font-mono">/{site.slug}</span>
                    {site.template_name && (
                      <span className="text-xs text-gray-400">· {site.template_name}</span>
                    )}
                    {site.cf_pages_project && (
                      <a
                        href={`https://${site.cf_pages_project}.pages.dev`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline font-mono"
                      >
                        {site.cf_pages_project}.pages.dev ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to={`/sites/${site.id}/preview`}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
                >
                  Preview
                </Link>
                <Link
                  to={`/sites/${site.id}/edit`}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
