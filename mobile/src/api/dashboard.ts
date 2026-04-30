import { apiFetch } from './client';

export type DashboardHome = {
  user: { id: number; username: string; email: string };
  stats: {
    total_entries: number;
    average_mood: number | null;
    current_streak: number;
    longest_streak: number;
  };
  active_dates: string[];
  recent_entries: Array<{
    id: number;
    title: string;
    mood_score: number;
    is_private: boolean;
    created_at: string;
  }>;
  latest_analysis: {
    journal_entry_id: number;
    sentiment_label: string;
    emotion_label: string;
    confidence_score: number;
    short_summary: string;
    recommendation: string;
  } | null;
};

export function getDashboardHome() {
  return apiFetch<DashboardHome>('/dashboard/home', { method: 'GET', auth: true });
}
