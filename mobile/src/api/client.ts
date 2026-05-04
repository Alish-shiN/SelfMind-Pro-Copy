/// <reference lib="es2015" />
import { API_BASE_URL, API_PREFIX } from '../constants/config';
import { getToken } from '../lib/storage';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function formatDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as { msg?: unknown; loc?: unknown };
          const msg = typeof record.msg === 'string' ? record.msg : JSON.stringify(item);
          if (Array.isArray(record.loc)) return `${record.loc.join('.')}: ${msg}`;
          return msg;
        }
        return String(item);
      })
      .join(', ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return '';
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = false, headers, ...rest } = options;
  const url = `${API_BASE_URL}${API_PREFIX}${path}`;
  const h = new Headers(headers);
  h.set('Accept', 'application/json');
  if (rest.body && !h.has('Content-Type')) {
    h.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = await getToken();
    if (token) {
      h.set('Authorization', `Bearer ${token}`);
    }
  }
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers: h });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Network request failed';
    throw new ApiError(
      `Cannot reach backend (${url}). ${reason}. Make sure backend is running and reachable from your phone.`,
      0
    );
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      detail = formatDetail(j.detail) || detail;
    } catch {
      /* keep text */
    }
    throw new ApiError(detail || res.statusText, res.status, text);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
