import { getOrCreateDeviceIdentity, signDeviceRequest } from '@/lib/device/identity';
import type { DeviceSession, User } from '@/types/auth';
import type { DesignSettings, ElementType, Project, ProjectElement } from '@/types/project';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type DevicePayload = { key_id: string; public_key: string; fingerprint: string; device_name: string };

async function devicePayload(): Promise<DevicePayload> {
  const identity = await getOrCreateDeviceIdentity();
  return { key_id: identity.keyId, public_key: JSON.stringify(identity.publicKey), fingerprint: identity.fingerprint, device_name: `${navigator.platform} browser` };
}

async function request<T>(path: string, init: RequestInit = {}, proof = false): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (proof) Object.entries(await signDeviceRequest(await getOrCreateDeviceIdentity(), init.method ?? 'GET', path)).forEach(([key, value]) => headers.set(key, value));
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? 'Request failed');
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  register: async (payload: { email: string; password: string; first_name: string; last_name: string }) => request<{ user: User; session_id: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...payload, device: await devicePayload() }) }),
  login: async (payload: { email: string; password: string }) => request<{ user: User; session_id: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ ...payload, device: await devicePayload() }) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<User>('/api/auth/me'),
  sessions: () => request<DeviceSession[]>('/api/auth/sessions'),
  revokeSession: (id: string) => request<void>(`/api/auth/sessions/${id}`, { method: 'DELETE' }, true),
  projects: () => request<Project[]>('/api/projects'),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (payload: { name: string; description: string }) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(payload) }, true),
  updateProject: (id: string, payload: Partial<{ name: string; description: string; design_settings: DesignSettings }>) => request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  elements: (id: string) => request<ProjectElement[]>(`/api/projects/${id}/elements`),
  createElement: (projectId: string, payload: ElementPayload) => request<ProjectElement>(`/api/projects/${projectId}/elements`, { method: 'POST', body: JSON.stringify(payload) }, true),
  updateElement: (projectId: string, id: string, payload: Omit<ElementPayload, 'id'>) => request<ProjectElement>(`/api/projects/${projectId}/elements/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  deleteElement: (projectId: string, id: string) => request<void>(`/api/projects/${projectId}/elements/${id}`, { method: 'DELETE' }, true),
};

export type ElementPayload = { id?: string; element_type: ElementType; x1: number; y1: number; x2: number; y2: number; length: number; rotation: number; properties: Record<string, unknown> };
