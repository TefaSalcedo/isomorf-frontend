import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api-client';

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
