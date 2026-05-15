import { apiFetch } from './client';

export type AiQuizQuestion = {
  question_index: number;
  question_text: string;
  answer_type: string;
  options?: string[] | null;
};

export type AiQuizGenerateResponse = {
  id: number;
  quiz_type: string;
  status: string;
  generated_questions: AiQuizQuestion[];
  created_at: string;
  updated_at: string;
};

export type AiQuizMicroPractice = {
  title: string;
  description: string;
  estimated_time: string;
  action?: 'journal' | 'mood' | 'goals' | null;
};

export type AiQuizActionPlan = {
  quiz_type: string;
  result_level: string;
  steps: string[];
  micro_practices: AiQuizMicroPractice[];
  reflection_prompt: string;
  suggested_goal?: string | null;
  supportive_message: string;
};

export type AiQuizResultDetail = {
  id: number;
  session_id: number;
  quiz_type?: string | null;
  overall_score: number;
  severity_level: string;
  insight: string;
  recommendation: string;
  practice: string;
  recommendations?: string[] | null;
  micro_practices?: AiQuizMicroPractice[] | null;
  action_plan?: AiQuizActionPlan | null;
  trend_direction?: string | null;
  previous_score?: number | null;
  score_difference?: number | null;
  trend_explanation?: string | null;
  created_at: string;
  updated_at: string;
};

export type AiQuizDetailResponse = {
  session: AiQuizGenerateResponse;
  result: AiQuizResultDetail | null;
};

export type AiQuizSubmitAnswer = {
  question_index: number;
  question_text: string;
  answer_text: string;
  score?: number | null;
};

export type AiQuizType = {
  key: string;
  title: string;
  description: string;
  estimated_minutes: number;
  emoji?: string | null;
  status: 'not_started' | 'completed' | 'completed_recently';
  latest_result_id?: number | null;
  latest_score?: number | null;
  latest_level?: string | null;
  latest_completed_at?: string | null;
};

export type AiQuizHistoryItem = {
  result_id: number;
  session_id: number;
  quiz_type: string;
  quiz_title: string;
  completed_at: string;
  score: number;
  severity_level: string;
  summary: string;
  has_recommendations: boolean;
  has_action_plan: boolean;
  trend_direction?: string | null;
  previous_score?: number | null;
  score_difference?: number | null;
};

export type AiQuizLatestActionPlan = {
  result_id: number;
  session_id: number;
  quiz_type: string;
  quiz_title: string;
  created_at: string;
  score: number;
  severity_level: string;
  summary: string;
  next_actions: string[];
  action_plan: AiQuizActionPlan;
};

export type AiQuizResult = AiQuizResultDetail | null;

export function getAiQuizTypes() {
  return apiFetch<AiQuizType[]>('/ai-quiz/types', { method: 'GET', auth: true });
}

export function generateAiQuiz(quiz_type = 'stress', language = 'en') {
  return apiFetch<AiQuizGenerateResponse>('/ai-quiz/generate', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ quiz_type, language }),
  });
}

export function getAiQuizSession(session_id: number) {
  return apiFetch<AiQuizDetailResponse>(`/ai-quiz/${session_id}`, {
    method: 'GET',
    auth: true,
  });
}

export function submitAiQuiz(session_id: number, answers: AiQuizSubmitAnswer[], language = 'en') {
  return apiFetch<AiQuizResultDetail>(`/ai-quiz/${session_id}/submit`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ answers, language }),
  });
}

export function getAiQuizHistory(limit = 25) {
  return apiFetch<AiQuizHistoryItem[]>(`/ai-quiz/history?limit=${limit}`, {
    method: 'GET',
    auth: true,
  });
}

export function getAiQuizResult(resultId: number) {
  return apiFetch<AiQuizResultDetail>(`/ai-quiz/history/${resultId}`, {
    method: 'GET',
    auth: true,
  });
}

export function getLatestAiQuizActionPlan() {
  return apiFetch<AiQuizLatestActionPlan | null>('/ai-quiz/latest-action-plan', {
    method: 'GET',
    auth: true,
  });
}

export function saveAiQuizActionPlan(resultId: number) {
  return apiFetch<AiQuizLatestActionPlan>(`/ai-quiz/results/${resultId}/save-action-plan`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
}
