import { apiFetch } from './client';
import type { UserResponse } from './auth';

export type PreferredReflectionFormat = 'diary' | 'chat' | 'quiz';
export type ReminderFrequency = 'daily' | 'few_times_week' | 'weekly' | 'none';
export type AITone = 'calm' | 'practical' | 'motivating' | 'reflective';

export type CommunityProfileVisibility = 'anonymous' | 'members' | 'public';

export type PrivacyPreferences = {
  journal_private_default: boolean;
  anonymous_community_default: boolean;
  share_ai_insights: boolean;
  community_profile_visibility: CommunityProfileVisibility;
  ai_processing_consent: boolean;
  privacy_notice_accepted: boolean;
  privacy_notice_version: string | null;
  privacy_notice_accepted_at: string | null;
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
    community_profile_visibility: 'members',
    ai_processing_consent: false,
    privacy_notice_accepted: false,
    privacy_notice_version: null,
    privacy_notice_accepted_at: null,
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

export type PrivacyCenterResponse = {
  notice_version: string;
  notice: {
    title: string;
    summary: string;
    emotional_data_notice: string;
    ai_processing: string[];
    stored_data: string[];
    controls: string[];
  };
  preferences: UserPreferences;
};

export function getPrivacyCenter() {
  return apiFetch<PrivacyCenterResponse>('/users/me/privacy-center', { auth: true });
}

export function acceptPrivacyNotice() {
  return apiFetch<UserPreferences>('/users/me/privacy-notice/accept', {
    method: 'POST',
    auth: true,
  });
}

export function exportPersonalData() {
  return apiFetch<Record<string, unknown>>('/users/me/export', { auth: true });
}

export function deleteAccount() {
  return apiFetch<void>('/users/me', {
    method: 'DELETE',
    auth: true,
    body: JSON.stringify({ confirmation: 'DELETE' }),
  });
}
