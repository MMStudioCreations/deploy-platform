import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { TemplatesPage } from './pages/TemplatesPage';
import { TemplateDetailPage } from './pages/TemplateDetailPage';
import { SitesPage } from './pages/SitesPage';
import { NewSitePage } from './pages/NewSitePage';
import { EditSitePage } from './pages/EditSitePage';
import { PreviewPage } from './pages/PreviewPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/templates" replace />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="templates/:id" element={<TemplateDetailPage />} />
            <Route path="sites" element={<SitesPage />} />
            <Route path="sites/new" element={<NewSitePage />} />
            <Route path="sites/:id/edit" element={<EditSitePage />} />
            <Route path="sites/:id/preview" element={<PreviewPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
