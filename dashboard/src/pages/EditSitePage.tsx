import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { StatusBadge } from '../components/Badge';
import type { TemplateField } from '../types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function EditSitePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ['sites', id],
    queryFn: () => api.sites.get(id!),
    enabled: !!id,
  });

  const { data: template } = useQuery({
    queryKey: ['templates', site?.template_id],
    queryFn: () => api.templates.get(site!.template_id),
    enabled: !!site?.template_id,
  });

  const [localContent, setLocalContent] = useState<Record<string, string>>({});
  const [iframeKey, setIframeKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [publishMsg, setPublishMsg] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (site?.content) setLocalContent(site.content);
  }, [site?.content]);

  useEffect(() => {
    const first = template?.schema?.sections[0];
    if (first) setOpenSections(new Set([first.id]));
  }, [template?.schema]);

  const doSave = useCallback(
    async (content: Record<string, string>) => {
      setSaveStatus('saving');
      try {
        await api.sites.saveContent(id!, content);
        setIframeKey((k) => k + 1);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
      }
    },
    [id],
  );

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      setLocalContent((prev) => {
        const next = { ...prev, [key]: value };
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => void doSave(next), 500);
        return next;
      });
    },
    [doSave],
  );

  const handleSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void doSave(localContent);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishMsg('');
    try {
      await api.sites.saveContent(id!, localContent);
      const result = await api.sites.publish(id!);
      setPublishMsg(`✓ Deployed to ${result.project}.pages.dev`);
      setIframeKey((k) => k + 1);
      void qc.invalidateQueries({ queryKey: ['sites', id] });
      void qc.invalidateQueries({ queryKey: ['sites'] });
    } catch (err) {
      setPublishMsg(`Error: ${err instanceof Error ? err.message : 'Deployment failed'}`);
    } finally {
      setPublishing(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  if (siteLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!site) {
    return <div className="flex-1 p-8 text-gray-500 text-sm">Site not found.</div>;
  }

  const schema = template?.schema;
  const previewUrl = api.sites.previewUrl(id!);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/sites"
            className="text-gray-400 hover:text-gray-700 text-sm transition-colors flex-shrink-0"
          >
            ← Sites
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-gray-900 truncate">{site.name}</span>
            <span className="text-gray-400 text-sm font-mono hidden sm:block">/{site.slug}</span>
            <StatusBadge live={!!site.cf_pages_project} />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-mono text-gray-400 hidden md:block">
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && (
              <span className="text-green-600">Saved</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-500">Save failed</span>
            )}
          </span>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-40"
          >
            Save Draft
          </button>
          <button
            onClick={() => void handlePublish()}
            disabled={publishing}
            className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            {publishing ? 'Deploying…' : 'Publish'}
          </button>
          <Link
            to={`/sites/${id}/preview`}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
          >
            ↗ Full Preview
          </Link>
        </div>
      </div>

      {/* Publish status banner */}
      {publishMsg && (
        <div
          className={[
            'flex-shrink-0 px-5 py-2 text-sm font-mono',
            publishMsg.startsWith('Error')
              ? 'bg-red-50 text-red-700 border-b border-red-100'
              : 'bg-green-50 text-green-700 border-b border-green-100',
          ].join(' ')}
        >
          {publishMsg}
        </div>
      )}

      {/* Split panel */}
      <div className="flex flex-1 min-h-0">
        {/* Left: schema form */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          {!schema ? (
            <div className="p-5 text-sm text-gray-400">Loading schema…</div>
          ) : (
            <div>
              {schema.sections.map((section) => (
                <div key={section.id} className="border-b border-gray-100 last:border-0">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">{section.label}</span>
                    <svg
                      className={[
                        'w-4 h-4 text-gray-400 transition-transform flex-shrink-0',
                        openSections.has(section.id) ? 'rotate-180' : '',
                      ].join(' ')}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {openSections.has(section.id) && (
                    <div className="px-4 pb-5 space-y-4">
                      {section.fields.map((field) => (
                        <SchemaField
                          key={field.key}
                          field={field}
                          value={localContent[field.key] ?? field.default ?? ''}
                          onChange={(val) => handleFieldChange(field.key, val)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Right: iframe preview */}
        <div className="flex-1 bg-gray-100 relative min-w-0">
          <iframe
            key={iframeKey}
            src={`${previewUrl}?_t=${iframeKey}`}
            className="w-full h-full border-0"
            title="Live Preview"
          />
        </div>
      </div>
    </div>
  );
}

function SchemaField({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (val: string) => void;
}) {
  const inputBase =
    'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white';

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide font-mono">
        {field.label}
      </label>

      {field.type === 'textarea' ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.default}
          className={`${inputBase} resize-none`}
        />
      ) : field.type === 'color' ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0.5 bg-white"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
          />
        </div>
      ) : field.type === 'image' ? (
        <div className="space-y-1.5">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://pub-…r2.dev/image.jpg"
            className={inputBase}
          />
          {value && (
            <img
              src={value}
              alt="preview"
              className="w-full h-20 object-cover rounded-lg border border-gray-200"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          )}
          <p className="text-xs text-gray-400">Paste a public image URL</p>
        </div>
      ) : (
        <input
          type={
            field.type === 'phone'
              ? 'tel'
              : field.type === 'email'
                ? 'email'
                : field.type === 'url'
                  ? 'url'
                  : 'text'
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.default}
          className={inputBase}
        />
      )}
    </div>
  );
}
