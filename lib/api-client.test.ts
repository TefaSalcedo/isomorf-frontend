import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api-client';

vi.mock('./device/identity', () => ({
  getOrCreateDeviceIdentity: vi.fn().mockResolvedValue({ keyId: 'dev-1' }),
  regenerateDeviceIdentity: vi.fn().mockResolvedValue({ keyId: 'dev-2' }),
  signDeviceRequest: vi.fn().mockResolvedValue({ 'X-Device-Key-Id': 'dev-1', 'X-Device-Timestamp': '0', 'X-Device-Nonce': 'n', 'X-Device-Signature': 's' }),
}));

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request handling', () => {
  it('returns the parsed body on success', async () => {
    const user = { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, user)));
    await expect(api.me()).resolves.toEqual(user);
  });

  it('throws ApiError with status and detail on client errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { detail: 'Project not found' })));
    await expect(api.me()).rejects.toMatchObject({ status: 404, message: 'Project not found' });
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
  });

  it('maps server errors to a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { detail: 'boom' })));
    await expect(api.me()).rejects.toMatchObject({ status: 500, message: expect.stringContaining('could not complete') });
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api.logout()).resolves.toBeUndefined();
  });

  it('reports connection failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(api.me()).rejects.toThrow('Unable to connect to the API');
  });
});

describe('team endpoints', () => {
  function capture() {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }
  function call(fetchMock: ReturnType<typeof vi.fn>, index = 0): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
    return { url, init };
  }

  it('lists teams without device proof', async () => {
    const fetchMock = capture();
    await api.teams();
    const { url, init } = call(fetchMock);
    expect(url).toMatch(/\/api\/teams$/);
    expect(new Headers(init.headers).has('X-Device-Key-Id')).toBe(false);
  });

  it('signs team mutations with device proof', async () => {
    const fetchMock = capture();
    await api.createTeam({ name: 'Structures' });
    const { url, init } = call(fetchMock);
    expect(url).toMatch(/\/api\/teams$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Structures' }));
    expect(new Headers(init.headers).has('X-Device-Key-Id')).toBe(true);
  });

  it('builds invite, member and share routes', async () => {
    const fetchMock = capture();
    await api.invitePreview('tok');
    await api.acceptInvite('tok');
    await api.updateMemberRole('t1', 'm1', 'editor');
    await api.shareProject('t1', 'p1');
    await api.unshareProject('t1', 'p1');
    expect(call(fetchMock, 0).url).toMatch(/\/api\/teams\/invites\/tok$/);
    expect(call(fetchMock, 1)).toMatchObject({ url: expect.stringMatching(/\/api\/teams\/invites\/accept$/), init: { method: 'POST', body: JSON.stringify({ token: 'tok' }) } });
    expect(call(fetchMock, 2)).toMatchObject({ url: expect.stringMatching(/\/api\/teams\/t1\/members\/m1\/role$/), init: { method: 'PATCH', body: JSON.stringify({ role: 'editor' }) } });
    expect(call(fetchMock, 3)).toMatchObject({ url: expect.stringMatching(/\/api\/teams\/t1\/projects$/), init: { method: 'POST', body: JSON.stringify({ project_id: 'p1' }) } });
    expect(call(fetchMock, 4)).toMatchObject({ url: expect.stringMatching(/\/api\/teams\/t1\/projects\/p1$/), init: { method: 'DELETE' } });
  });
});
