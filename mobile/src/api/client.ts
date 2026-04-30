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
      if (typeof j.detail === 'string') detail = j.detail;
      else if (Array.isArray(j.detail)) detail = j.detail.map(String).join(', ');
    } catch {
      /* keep text */
    }
    throw new ApiError(detail || res.statusText, res.status, text);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
