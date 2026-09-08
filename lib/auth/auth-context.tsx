'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '@/types/auth';

type AuthContextValue = { user: User | null; loading: boolean; error: string | null; login: (email: string, password: string) => Promise<void>; register: (payload: { email: string; password: string; first_name: string; last_name: string }) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const value = useMemo(() => ({ user, loading, error, login: async (email: string, password: string) => { setError(null); const result = await api.login({ email, password }); setUser(result.user); }, register: async (payload: { email: string; password: string; first_name: string; last_name: string }) => { setError(null); const result = await api.register(payload); setUser(result.user); }, logout: async () => { await api.logout(); setUser(null); } }), [user, loading, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
