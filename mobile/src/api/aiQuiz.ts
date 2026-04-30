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

export type AiQuizDetailResponse = {
  session: AiQuizGenerateResponse;
  result: {
    id: number;
    session_id: number;
    overall_score: number;
    severity_level: string;
    insight: string;
    recommendation: string;
    practice: string;
  } | null;
};

export type AiQuizSubmitAnswer = {
  question_index: number;
  question_text: string;
  answer_text: string;
  score?: number | null;
};

export type AiQuizResult = AiQuizDetailResponse['result'];

export function generateAiQuiz(quiz_type = 'stress_reflection') {
  return apiFetch<AiQuizGenerateResponse>('/ai-quiz/generate', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ quiz_type }),
  });
}

export function getAiQuizSession(session_id: number) {
  return apiFetch<AiQuizDetailResponse>(`/ai-quiz/${session_id}`, {
    method: 'GET',
    auth: true,
  });
}

export function submitAiQuiz(session_id: number, answers: AiQuizSubmitAnswer[]) {
  return apiFetch<NonNullable<AiQuizResult>>(`/ai-quiz/${session_id}/submit`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ answers }),
  });
}

