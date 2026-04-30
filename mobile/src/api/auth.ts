import { apiFetch } from './client';

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type UserResponse = {
  id: number;
  email: string;
  username: string;
  created_at: string;
  updated_at: string;
};

export function login(email: string, password: string) {
  return apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(payload: {
  email: string;
  username: string;
  password: string;
}) {
  return apiFetch<UserResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
