import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, thumbnailUrl } from '../api/client';
import { useFilterStore } from '../store';
import { CategoryBadge } from '../components/Badge';
import type { Template } from '../types';

export function TemplatesPage() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: api.templates.list,
  });

  const { searchQuery, categoryFilter, setSearchQuery, setCategoryFilter } = useFilterStore();

  const categories = [...new Set(templates.map((t) => t.category))].sort();

  const filtered = templates.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      (!q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) &&
      (!categoryFilter || t.category === categoryFilter)
    );
  });

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
        <p className="text-sm text-gray-400 mt-1 font-mono">
          {templates.length} available
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-7">
        <input
          type="search"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="All"
            active={!categoryFilter}
            onClick={() => setCategoryFilter('')}
          />
          {categories.map((cat) => (
            <FilterChip
              key={cat}
              label={cat}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
            />
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-xl aspect-[4/3]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          No templates match your filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors font-mono',
        active
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-400',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <div className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-200">
      <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
        <img
          src={thumbnailUrl(template.r2_key, template.name)}
          alt={template.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="text-sm font-medium text-gray-900 leading-tight line-clamp-1">
            {template.name}
          </h3>
          <CategoryBadge category={template.category} />
        </div>
        <Link
          to={`/templates/${template.id}`}
          className="block text-center py-1.5 px-3 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Use Template
        </Link>
      </div>
    </div>
  );
}
