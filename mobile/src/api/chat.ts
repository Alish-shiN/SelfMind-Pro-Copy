import { apiFetch } from './client';

export type ChatSessionResponse = {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessageResponse = {
  id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type ChatSessionDetailResponse = {
  session: ChatSessionResponse;
  messages: ChatMessageResponse[];
};

export type ChatSendResponse = {
  user_message: ChatMessageResponse;
  assistant_message: ChatMessageResponse;
};

export function createChatSession(title = 'New conversation') {
  return apiFetch<ChatSessionResponse>('/chat/sessions', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ title }),
  });
}

export function getMyChatSessions() {
  return apiFetch<ChatSessionResponse[]>('/chat/sessions', { method: 'GET', auth: true });
}

export function getChatSessionDetail(sessionId: number) {
  return apiFetch<ChatSessionDetailResponse>(`/chat/sessions/${sessionId}`, {
    method: 'GET',
    auth: true,
  });
}

export function sendChatMessage(sessionId: number, content: string) {
  return apiFetch<ChatSendResponse>(`/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ content }),
  });
}

