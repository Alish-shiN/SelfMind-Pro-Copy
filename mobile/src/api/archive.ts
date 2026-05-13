import { apiFetch } from './client';

export type ArchiveTab = 'journals' | 'insights' | 'favorites';
export type ArchiveSort = 'newest' | 'oldest';

export type ArchiveSearchParams = {
  q?: string;
  tab?: ArchiveTab;
  start_date?: string;
  end_date?: string;
  mood_or_emotion?: string;
  tags?: string[];
  favorites_only?: boolean;
  favorite_ids?: number[];
  sort?: ArchiveSort;
};

export type ArchiveSearchResult = {
  id: number;
  result_type: 'journal' | 'insight';
  title: string;
  content_preview: string;
  mood_score: number;
  tags: string[] | null;
  is_private: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  sentiment_label?: string | null;
  emotion_label?: string | null;
  insight_summary?: string | null;
  recommendation?: string | null;
};

export function searchArchive(params: ArchiveSearchParams) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.tab) query.set('tab', params.tab);
  if (params.start_date) query.set('start_date', params.start_date);
  if (params.end_date) query.set('end_date', params.end_date);
  if (params.mood_or_emotion) query.set('mood_or_emotion', params.mood_or_emotion);
  if (params.favorites_only) query.set('favorites_only', 'true');
  if (params.sort) query.set('sort', params.sort);
  (params.tags || []).forEach((tag) => query.append('tags', tag));
  (params.favorite_ids || []).forEach((id) => query.append('favorite_ids', String(id)));

  return apiFetch<ArchiveSearchResult[]>(`/archive/search?${query.toString()}`, {
    method: 'GET',
    auth: true,
  });
}
