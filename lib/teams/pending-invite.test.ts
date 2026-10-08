import { beforeEach, describe, expect, it } from 'vitest';
import { consumePendingInvite, pendingInviteRedirect, rememberPendingInvite } from './pending-invite';

beforeEach(() => window.sessionStorage.clear());

describe('pending invite', () => {
  it('defaults to the dashboard when nothing is pending', () => {
    expect(pendingInviteRedirect()).toBe('/dashboard');
  });

  it('redirects to the invite once and then forgets it', () => {
    rememberPendingInvite('abc/def');
    expect(pendingInviteRedirect()).toBe('/invites/abc%2Fdef');
    expect(consumePendingInvite()).toBeNull();
  });
});
