const COLORS: Record<string, string> = {
  agency: 'bg-blue-100 text-blue-800',
  restaurant: 'bg-orange-100 text-orange-800',
  portfolio: 'bg-purple-100 text-purple-800',
  corporate: 'bg-slate-100 text-slate-800',
  salon: 'bg-pink-100 text-pink-800',
  medical: 'bg-teal-100 text-teal-800',
  'real-estate': 'bg-green-100 text-green-800',
  fitness: 'bg-red-100 text-red-800',
  ecommerce: 'bg-yellow-100 text-yellow-800',
  blog: 'bg-indigo-100 text-indigo-800',
};

export function CategoryBadge({ category }: { category: string }) {
  const colors = COLORS[category.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium font-mono ${colors}`}>
      {category}
    </span>
  );
}

export function StatusBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Draft
    </span>
  );
}
