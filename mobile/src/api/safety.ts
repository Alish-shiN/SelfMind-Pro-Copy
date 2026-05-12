import { apiFetch } from './client';

export type CrisisResource = {
  title: string;
  description: string;
  action_label: string;
  action_value: string;
  country: string;
};

export type SafetyCheckResponse = {
  is_flagged: boolean;
  severity: 'low' | 'medium' | 'high' | 'crisis' | null;
  matched_signals: string[];
  message: string | null;
};

export function getCrisisResources() {
  return apiFetch<CrisisResource[]>('/safety/resources', { auth: false });
}

export function checkSafetyText(text: string) {
  return apiFetch<SafetyCheckResponse>('/safety/check', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ text, source_type: 'manual_check' }),
  });
}
