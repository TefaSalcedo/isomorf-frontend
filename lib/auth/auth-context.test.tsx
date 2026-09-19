import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api-client';
import { AuthProvider, useAuth } from './auth-context';

vi.mock('@/lib/api-client', () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? user.email : 'anonymous'}</div>;
}

beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = 'isomorf_auth_hint=; Max-Age=0; path=/';
});

describe('AuthProvider session bootstrap', () => {
  it('does not call /api/auth/me without the hint cookie', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(api.me).not.toHaveBeenCalled();
  });

  it('fetches the current user when the hint cookie exists', async () => {
    document.cookie = 'isomorf_auth_hint=1';
    vi.mocked(api.me).mockResolvedValue({ id: 'u1', email: 'alice@example.com', first_name: 'Alice', last_name: 'Engineer' });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
    expect(api.me).toHaveBeenCalledTimes(1);
  });

  it('falls back to anonymous when the session is invalid', async () => {
    document.cookie = 'isomorf_auth_hint=1';
    vi.mocked(api.me).mockRejectedValue(new Error('401'));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
  });
});
