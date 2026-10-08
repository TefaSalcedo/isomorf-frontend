const KEY = 'isomorf_pending_invite';

export function rememberPendingInvite(token: string): void {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(KEY, token);
}

export function consumePendingInvite(): string | null {
  if (typeof window === 'undefined') return null;
  const token = window.sessionStorage.getItem(KEY);
  if (token) window.sessionStorage.removeItem(KEY);
  return token;
}

export function pendingInviteRedirect(): string {
  const token = consumePendingInvite();
  return token ? `/invites/${encodeURIComponent(token)}` : '/dashboard';
}
