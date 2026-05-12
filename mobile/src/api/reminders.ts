import { apiFetch } from './client';

export type ReminderPreference = {
  id: number;
  user_id: number;
  reminders_enabled: boolean;
  journal_enabled: boolean;
  mood_checkin_enabled: boolean;
  ai_quiz_enabled: boolean;
  journal_time: string;
  mood_checkin_time: string;
  ai_quiz_time: string;
  frequency: 'daily' | 'weekdays' | 'weekly' | string;
  timezone: string;
  push_token: string | null;
  push_platform: string | null;
  created_at: string;
  updated_at: string;
};

export type ReminderPreferenceUpdate = Partial<Pick<ReminderPreference,
  | 'reminders_enabled'
  | 'journal_enabled'
  | 'mood_checkin_enabled'
  | 'ai_quiz_enabled'
  | 'journal_time'
  | 'mood_checkin_time'
  | 'ai_quiz_time'
  | 'frequency'
  | 'timezone'
>>;

export type DueReminder = {
  type: 'journal' | 'mood_checkin' | 'ai_quiz';
  title: string;
  message: string;
  scheduled_time: string;
};

export function getReminderPreferences() {
  return apiFetch<ReminderPreference>('/reminders/preferences', { auth: true });
}

export function updateReminderPreferences(payload: ReminderPreferenceUpdate) {
  return apiFetch<ReminderPreference>('/reminders/preferences', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export function registerPushToken(pushToken: string, pushPlatform: 'ios' | 'android' | 'expo' | 'web') {
  return apiFetch<ReminderPreference>('/reminders/push-token', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ push_token: pushToken, push_platform: pushPlatform }),
  });
}

export function getDueReminders(currentTime?: string) {
  const query = currentTime ? `?current_time=${encodeURIComponent(currentTime)}` : '';
  return apiFetch<DueReminder[]>(`/reminders/due${query}`, { auth: true });
}
