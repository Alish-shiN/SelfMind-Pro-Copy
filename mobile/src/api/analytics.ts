import { apiFetch } from './client';

export type MoodAnalyticsPoint = {
  period_start: string;
  period_end: string;
  label: string;
  average_mood: number | null;
  entries_count: number;
};

export type TopEmotionPoint = {
  emotion_label: string;
  count: number;
  percentage: number;
};

export type JournalingFrequency = {
  total_days: number;
  active_days: number;
  entries_count: number;
  entries_per_week: number;
  average_entries_per_active_day: number;
  consistency_percentage: number;
};

export type CorrelationMetric = {
  metric: string;
  coefficient: number | null;
  strength: string;
  interpretation: string;
};

export type EmotionHeatmapDay = {
  date: string;
  dominant_emotion: string | null;
  entries_count: number;
  average_mood: number | null;
  intensity: number;
};

export type MoodAnalyticsInsight = {
  title: string;
  description: string;
};

export type MoodAnalytics = {
  period: string;
  granularity: string;
  start_date: string;
  end_date: string;
  summary: {
    total_entries: number;
    average_mood: number | null;
    min_mood: number | null;
    max_mood: number | null;
  };
  mood_history: MoodAnalyticsPoint[];
  top_emotions: TopEmotionPoint[];
  journaling_frequency: JournalingFrequency;
  streak: {
    current_streak: number;
    longest_streak: number;
    total_active_days: number;
  };
  streak_calendar: Array<{
    date: string;
    has_entry: boolean;
    entries_count: number;
    average_mood: number | null;
    streak_day: number;
  }>;
  correlations: CorrelationMetric[];
  emotion_heatmap: EmotionHeatmapDay[];
  insights: MoodAnalyticsInsight[];
};

export function getMoodAnalytics(period = '30d', granularity = 'day') {
  const query = `?period=${encodeURIComponent(period)}&granularity=${encodeURIComponent(granularity)}`;
  return apiFetch<MoodAnalytics>(`/analytics/mood${query}`, { method: 'GET', auth: true });
}
