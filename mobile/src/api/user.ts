import { apiFetch } from './client';
import type { UserResponse } from './auth';

export type PreferredReflectionFormat = 'diary' | 'chat' | 'quiz';
export type ReminderFrequency = 'daily' | 'few_times_week' | 'weekly' | 'none';
export type AITone = 'calm' | 'practical' | 'motivating' | 'reflective';

export type PrivacyPreferences = {
  journal_private_default: boolean;
  anonymous_community_default: boolean;
  share_ai_insights: boolean;
};

export type UserPreferences = {
  emotional_goals: string[];
  preferred_reflection_format: PreferredReflectionFormat;
  reminder_frequency: ReminderFrequency;
  privacy_preferences: PrivacyPreferences;
  ai_tone: AITone;
  onboarding_completed: boolean;
  onboarding_skipped: boolean;
};

export type UserPreferencesUpdate = Partial<UserPreferences>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  emotional_goals: [],
  preferred_reflection_format: 'diary',
  reminder_frequency: 'none',
  privacy_preferences: {
    journal_private_default: true,
    anonymous_community_default: false,
    share_ai_insights: false,
  },
  ai_tone: 'calm',
  onboarding_completed: false,
  onboarding_skipped: false,
};

export function getCurrentUser() {
  return apiFetch<UserResponse>('/users/me', { auth: true });
}

export function getUserPreferences() {
  return apiFetch<UserPreferences>('/users/me/preferences', { auth: true });
}

export function updateUserPreferences(payload: UserPreferencesUpdate) {
  return apiFetch<UserPreferences>('/users/me/preferences', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
}
