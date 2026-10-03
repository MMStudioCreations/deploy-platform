import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, thumbnailUrl } from '../api/client';
import { CategoryBadge } from '../components/Badge';

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: template, isLoading } = useQuery({
    queryKey: ['templates', id],
    queryFn: () => api.templates.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="animate-pulse space-y-4 max-w-4xl">
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="flex gap-8">
            <div className="w-64 aspect-[4/3] bg-gray-100 rounded-xl" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-48 bg-gray-100 rounded" />
              <div className="h-4 w-32 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!template) {
    return <div className="flex-1 overflow-auto p-8 text-gray-500">Template not found.</div>;
  }

  const schema = template.schema;
  const fieldCount = schema?.sections.reduce((acc, s) => acc + s.fields.length, 0) ?? 0;

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-6">
        <Link to="/templates" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Templates
        </Link>
      </div>

      <div className="flex items-start gap-8 max-w-5xl">
        {/* Thumbnail */}
        <div className="w-72 flex-shrink-0">
          <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
            <img
              src={thumbnailUrl(template.r2_key, template.name)}
              alt={template.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">{template.name}</h1>
            <CategoryBadge category={template.category} />
          </div>
          <p className="text-xs text-gray-400 font-mono mb-7">{template.id}</p>

          {schema && (
            <div className="mb-7 p-5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-6 mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Schema</h2>
                <span className="text-xs text-gray-400 font-mono">
                  {schema.sections.length} sections · {fieldCount} fields
                </span>
              </div>
              <div className="space-y-2.5">
                {schema.sections.map((section) => (
                  <div key={section.id} className="flex gap-3 text-xs">
                    <span className="font-medium text-gray-600 w-28 flex-shrink-0">
                      {section.label}
                    </span>
                    <span className="text-gray-400 font-mono truncate">
                      {section.fields.map((f) => f.key).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            to={`/sites/new?template=${template.id}`}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Create Site with this Template
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
