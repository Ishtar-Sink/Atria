import { useCallback, useState } from 'react';
import { ApiProblem } from '../../shared/api/problem';
import type { QueryValue } from '../../shared/api/client';

const BASE_URL = '/api/v1';

function filenameOf(response: Response, fallback: string): string {
  const header = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

async function problemOf(response: Response): Promise<ApiProblem> {
  const body = (await response.json().catch(() => ({}))) as { code?: unknown; title?: unknown };
  return new ApiProblem({
    status: response.status,
    code: typeof body.code === 'string' ? body.code : 'unknown_error',
    title: typeof body.title === 'string' ? body.title : response.statusText,
  });
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface DownloadRequest {
  path: string;
  query: Record<string, QueryValue>;
  fallback_name: string;
}

/**
 * Baixa o arquivo como `Blob` pelo mesmo caminho da API, para mostrar os estados carregando e erro
 * (um link direto não tem como mostrar a falha).
 */
export function useFileDownload() {
  const [is_loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiProblem | Error | null>(null);

  const download = useCallback(async ({ path, query, fallback_name }: DownloadRequest) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) params.set(key, String(value));
      }
      let response: Response;
      try {
        response = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
          credentials: 'same-origin',
        });
      } catch {
        throw new ApiProblem({ status: 0, code: 'network_error', title: 'Network error' });
      }
      if (!response.ok) throw await problemOf(response);
      save(await response.blob(), filenameOf(response, fallback_name));
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('download_failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { download, is_loading, error };
}
