import { apiFetch } from './client';
import type { UserResponse } from './auth';

export function getCurrentUser() {
  return apiFetch<UserResponse>('/users/me', { auth: true });
}
