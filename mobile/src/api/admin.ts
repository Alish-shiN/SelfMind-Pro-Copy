import { API_BASE_URL, API_PREFIX } from '../constants/config';
import { getToken } from '../lib/storage';
import { apiFetch, ApiError } from './client';

export type AdminUserSummary = {
  id: number;
  email: string;
  username: string;
  role: 'user' | 'moderator' | 'admin' | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  journal_entries_count: number;
  ai_chat_sessions_count: number;
  ai_chat_messages_count: number;
  ai_quiz_sessions_count: number;
  community_posts_count: number;
  community_comments_count: number;
};

export type AdminAnalyticsOverview = {
  total_users: number;
  active_users: number;
  total_journal_entries: number;
  total_ai_chat_sessions: number;
  total_ai_chat_messages: number;
  total_ai_quizzes: number;
  total_community_posts: number;
  total_community_comments: number;
  most_common_moods: Array<{ mood_score: number; count: number }>;
  most_common_emotions: Array<{ emotion: string; count: number }>;
};

export type ModerationStatus = 'visible' | 'hidden' | 'pending_review';

export type AdminCommunityPostModeration = {
  id: number;
  user_id: number;
  username: string;
  content: string;
  is_anonymous: boolean;
  moderation_status: ModerationStatus | string;
  moderation_reason: string | null;
  moderated_at: string | null;
  moderated_by_user_id: number | null;
  comments_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminCommunityCommentModeration = {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  content: string;
  is_anonymous: boolean;
  moderation_status: ModerationStatus | string;
  moderation_reason: string | null;
  moderated_at: string | null;
  moderated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AdminRiskItem = {
  source: string;
  id: number;
  user_id: number | null;
  username: string | null;
  content: string;
  matched_keywords: string[];
  created_at: string;
};

export type AdminContentItem = {
  id: number;
  content_type: 'motivational_prompt' | 'onboarding_tip' | 'ai_quiz_template' | string;
  title: string;
  body: string;
  content_metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_by_user_id: number | null;
  updated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export function getAdminUsers() {
  return apiFetch<AdminUserSummary[]>('/admin/users', { auth: true });
}

export function updateAdminUserStatus(userId: number, isActive: boolean) {
  return apiFetch<AdminUserSummary>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ is_active: isActive }),
  });
}

export function updateAdminUserRole(userId: number, role: 'user' | 'moderator' | 'admin') {
  return apiFetch<AdminUserSummary>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ role }),
  });
}

export function getAdminAnalyticsOverview() {
  return apiFetch<AdminAnalyticsOverview>('/admin/analytics/overview', { auth: true });
}

export function getModerationPosts(status?: ModerationStatus) {
  const query = status ? `?moderation_status=${encodeURIComponent(status)}` : '';
  return apiFetch<AdminCommunityPostModeration[]>(`/admin/moderation/posts${query}`, { auth: true });
}

export function moderatePost(
  postId: number,
  moderationStatus: ModerationStatus,
  moderationReason?: string | null
) {
  return apiFetch<AdminCommunityPostModeration>(`/admin/moderation/posts/${postId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({
      moderation_status: moderationStatus,
      moderation_reason: moderationReason ?? null,
    }),
  });
}

export function getModerationComments(status?: ModerationStatus) {
  const query = status ? `?moderation_status=${encodeURIComponent(status)}` : '';
  return apiFetch<AdminCommunityCommentModeration[]>(`/admin/moderation/comments${query}`, { auth: true });
}

export function moderateComment(
  commentId: number,
  moderationStatus: ModerationStatus,
  moderationReason?: string | null
) {
  return apiFetch<AdminCommunityCommentModeration>(`/admin/moderation/comments/${commentId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({
      moderation_status: moderationStatus,
      moderation_reason: moderationReason ?? null,
    }),
  });
}

export function getRiskItems(limit = 20) {
  return apiFetch<AdminRiskItem[]>(`/admin/safety/risk-items?limit=${limit}`, { auth: true });
}

export function getAdminContent(contentType?: string) {
  const query = contentType ? `?content_type=${encodeURIComponent(contentType)}` : '';
  return apiFetch<AdminContentItem[]>(`/admin/content${query}`, { auth: true });
}

export function createAdminContent(payload: {
  content_type: 'motivational_prompt' | 'onboarding_tip' | 'ai_quiz_template';
  title: string;
  body: string;
  content_metadata?: Record<string, unknown> | null;
  is_active?: boolean;
}) {
  return apiFetch<AdminContentItem>('/admin/content', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export function updateAdminContent(contentId: number, payload: Partial<Pick<AdminContentItem, 'title' | 'body' | 'content_metadata' | 'is_active'>>) {
  return apiFetch<AdminContentItem>(`/admin/content/${contentId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getAdminSummaryCsv() {
  const token = await getToken();
  const headers = new Headers({ Accept: 'text/csv' });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/admin/reports/summary.csv`, { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(text || res.statusText, res.status, text);
  }
  return text;
}
