import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, getToken, setToken } from '../lib/storage';
import { ApiError } from '../api/client';
import { getDashboardHome } from '../api/dashboard';

type AuthContextValue = {
  token: string | null;
  ready: boolean;
  signIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await getToken();
      if (!cancelled) {
        setTokenState(t);
      }

      // If a token exists, validate it once at startup.
      // This prevents rendering the main app when the stored token is expired/invalid.
      if (t) {
        try {
          await getDashboardHome();
        } catch (e) {
          if (
            e instanceof ApiError &&
            (e.status === 401 || e.status === 403)
          ) {
            await clearToken();
            if (!cancelled) setTokenState(null);
          }
        }
      }

      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (accessToken: string) => {
    await setToken(accessToken);
    setTokenState(accessToken);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setTokenState(null);
  }, []);

  const value = useMemo(
    () => ({ token, ready, signIn, signOut }),
    [token, ready, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
