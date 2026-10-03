import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const previewUrl = api.sites.previewUrl(id!);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2.5 bg-white border-b border-gray-200">
        <Link
          to={`/sites/${id}/edit`}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
        >
          ← Editor
        </Link>
        <span className="text-xs text-gray-400 font-mono truncate flex-1 min-w-0">
          {previewUrl}
        </span>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
        >
          Open in tab ↗
        </a>
      </div>
      <iframe
        src={previewUrl}
        className="flex-1 w-full border-0"
        title="Site Preview"
      />
    </div>
  );
}
