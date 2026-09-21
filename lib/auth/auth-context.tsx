'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '@/types/auth';

const AUTH_HINT_COOKIE = 'isomorf_auth_hint';

function hasAuthHint(): boolean {
  return typeof document !== 'undefined' && document.cookie.split(';').some((entry) => entry.trim().startsWith(`${AUTH_HINT_COOKIE}=`));
}

function clearAuthHint(): void {
  if (typeof document !== 'undefined') document.cookie = `${AUTH_HINT_COOKIE}=; Max-Age=0; path=/`;
}

type AuthContextValue = { user: User | null; loading: boolean; error: string | null; login: (email: string, password: string) => Promise<void>; register: (payload: { email: string; password: string; first_name: string; last_name: string }) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const done = () => { if (!cancelled) setLoading(false); };
    if (hasAuthHint()) {
      api.me()
        .then((current) => { if (!cancelled) setUser(current); })
        .catch(() => { if (!cancelled) setUser(null); })
        .finally(done);
    } else {
      queueMicrotask(done);
    }
    return () => { cancelled = true; };
  }, []);
  const value = useMemo(() => ({ user, loading, error, login: async (email: string, password: string) => { setError(null); const result = await api.login({ email, password }); setUser(result.user); }, register: async (payload: { email: string; password: string; first_name: string; last_name: string }) => { setError(null); const result = await api.register(payload); setUser(result.user); }, logout: async () => { await api.logout(); clearAuthHint(); setUser(null); } }), [user, loading, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
